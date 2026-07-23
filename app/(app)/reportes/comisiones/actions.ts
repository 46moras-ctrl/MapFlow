"use server";

import { revalidatePath } from "next/cache";
import { hoyISO } from "@/lib/facturas";
import {
  comisionDeFactura,
  normalizarConfigComisiones,
  type ConfigComisiones,
} from "@/lib/nomina";
import { contextoEmpresa } from "@/lib/supabase/contexto";

// ============================================================
// LIQUIDAR COMISIONES — marca como pagadas las comisiones de un
// empleado (todas las pendientes o un rango de fechas), evalúa
// las metas sobre lo liquidado y guarda el historial. Opcional:
// registra el egreso en el flujo de caja para no capturar doble.
// ============================================================

interface Resultado {
  ok: boolean;
  error?: string;
}

export async function liquidarComisiones(datos: {
  idEmpleado: string;
  desde: string | null; // null = todo lo pendiente
  hasta: string | null;
  registrarEgreso: boolean;
}): Promise<Resultado> {
  if (datos.desde && datos.hasta && datos.desde > datos.hasta)
    return { ok: false, error: "El rango de fechas está invertido." };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: empleado } = await ctx.supabase
    .from("empleados")
    .select("id, nombre")
    .eq("id", datos.idEmpleado)
    .eq("id_empresa", ctx.empresaId)
    .maybeSingle();
  if (!empleado) return { ok: false, error: "No se encontró el empleado." };

  // Ventas PENDIENTES del empleado (en el rango si aplica). También
  // las de % nulo: en la modalidad de metas la comisión directa es 0
  // y lo que se paga son las bonificaciones.
  let consulta = ctx.supabase
    .from("facturas")
    .select("id, numero_factura, cliente, monto, fecha_emision, comision_porcentaje")
    .eq("id_empresa", ctx.empresaId)
    .eq("id_vendedor", datos.idEmpleado)
    .eq("tipo", "cobrar")
    .eq("comision_liquidada", false);
  if (datos.desde) consulta = consulta.gte("fecha_emision", datos.desde);
  if (datos.hasta) consulta = consulta.lte("fecha_emision", datos.hasta);

  const { data: ventas, error: errorVentas } = await consulta;
  if (errorVentas)
    return { ok: false, error: "No se pudieron leer las comisiones pendientes." };
  if (!ventas || ventas.length === 0)
    return {
      ok: false,
      error: datos.desde
        ? "No hay comisiones pendientes en ese rango de fechas."
        : "Este empleado no tiene comisiones pendientes.",
    };

  const detalleFacturas = ventas.map((v) => ({
    id: v.id as string,
    numero: v.numero_factura as string,
    fecha: v.fecha_emision as string,
    cliente: v.cliente as string,
    monto: Number(v.monto),
    porcentaje: Number(v.comision_porcentaje),
    comision: comisionDeFactura({
      monto: Number(v.monto),
      comision_porcentaje: Number(v.comision_porcentaje),
    }),
  }));
  const totalComision =
    Math.round(detalleFacturas.reduce((s, f) => s + f.comision, 0) * 100) / 100;

  // Metas: solo existen en la modalidad de metas (excluyente) y se
  // evalúan sobre LO QUE SE ESTÁ LIQUIDANDO (monto acumulado o
  // cantidad de ventas incluidas en esta liquidación)
  const { data: empresa } = await ctx.supabase
    .from("empresas")
    .select("config_comisiones")
    .eq("id", ctx.empresaId)
    .maybeSingle();
  const config = normalizarConfigComisiones(
    empresa?.config_comisiones as ConfigComisiones | null
  );
  const montoVentas = detalleFacturas.reduce((s, f) => s + f.monto, 0);
  // "veces": las metas de monto/cantidad se ganan una vez; la de
  // venta única se gana por CADA venta que iguale o supere el valor
  const detalleMetas = (config.modalidad === "metas" ? config.metas : []).map((m) => {
    const veces =
      m.tipo === "venta_unica"
        ? detalleFacturas.filter((f) => f.monto >= Number(m.valor)).length
        : (m.tipo === "cantidad" ? detalleFacturas.length : montoVentas) >= Number(m.valor)
          ? 1
          : 0;
    return { ...m, alcanzada: veces > 0, veces };
  });
  const totalBonificacion = detalleMetas.reduce(
    (s, m) => s + m.veces * Number(m.bonificacion),
    0
  );

  // Historial primero; las facturas quedan enlazadas a esta liquidación
  const { data: liquidacion, error: errorLiq } = await ctx.supabase
    .from("liquidaciones_comision")
    .insert({
      id_empresa: ctx.empresaId,
      id_empleado: datos.idEmpleado,
      desde: datos.desde,
      hasta: datos.hasta,
      num_facturas: detalleFacturas.length,
      total_comision: totalComision,
      total_bonificacion: totalBonificacion,
      detalle: { facturas: detalleFacturas, metas: detalleMetas },
      registrado_egreso: datos.registrarEgreso,
    })
    .select("id")
    .single();
  if (errorLiq || !liquidacion)
    return { ok: false, error: "No se pudo guardar la liquidación." };

  const { error: errorMarca } = await ctx.supabase
    .from("facturas")
    .update({ comision_liquidada: true, id_liquidacion: liquidacion.id })
    .eq("id_empresa", ctx.empresaId)
    .in("id", detalleFacturas.map((f) => f.id));
  if (errorMarca)
    return {
      ok: false,
      error: "La liquidación se creó pero no se pudieron marcar las facturas.",
    };

  // Egreso automático en el flujo de caja (opcional; con total $0
  // no hay nada que registrar)
  const totalPagado = Math.round((totalComision + totalBonificacion) * 100) / 100;
  if (datos.registrarEgreso && totalPagado > 0) {
    const { error: errorEgreso } = await ctx.supabase.from("movimientos").insert({
      id_empresa: ctx.empresaId,
      tipo: "egreso",
      monto: totalPagado,
      descripcion:
        `Comisiones de ${empleado.nombre} (${detalleFacturas.length} venta${detalleFacturas.length === 1 ? "" : "s"})` +
        (totalBonificacion > 0 ? " + bonificación por meta" : ""),
      fecha: hoyISO(),
      categoria: "Nómina",
      canal_origen: "web",
      contraparte: empleado.nombre as string,
      estado: "pagado",
      // Huella determinista: liquidar dos veces jamás duplica el egreso
      huella_unica: `comision:${liquidacion.id}`,
    });
    if (errorEgreso && errorEgreso.code !== "23505")
      return {
        ok: false,
        error:
          "Las comisiones quedaron liquidadas, pero no se pudo registrar el egreso.",
      };
  }

  revalidatePath("/reportes/comisiones");
  revalidatePath("/reportes");
  revalidatePath("/movimientos");
  revalidatePath("/dashboard");
  return { ok: true };
}
