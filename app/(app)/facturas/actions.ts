"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  hoyISO,
  proximaFechaRecurrente,
  sumarMeses,
  type DatosFactura,
  type FacturaDB,
  type MedioPago,
} from "@/lib/facturas";

interface Resultado {
  ok: boolean;
  error?: string;
}

const MEDIOS: MedioPago[] = ["transferencia", "tarjeta", "efectivo", "credito"];

/**
 * Toda operación parte de aquí: usuario autenticado + su empresa.
 * Así una petición jamás puede tocar facturas de otra empresa.
 */
async function contextoEmpresa() {
  const supabase = createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." as const };
  }

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id")
    .eq("id_usuario", user.id)
    .maybeSingle();

  if (!empresa) {
    return {
      error:
        "No encontramos una empresa asociada a tu cuenta. Cierra sesión y vuelve a entrar." as const,
    };
  }

  return { supabase, empresaId: empresa.id as string };
}

function validar(datos: DatosFactura): string | null {
  if (!datos.numero_factura?.trim())
    return "El número o referencia es obligatorio.";
  if (!datos.cliente?.trim())
    return datos.tipo === "pagar"
      ? "El proveedor o acreedor es obligatorio."
      : "El cliente es obligatorio.";
  if (!Number.isFinite(datos.monto) || datos.monto <= 0)
    return "El monto debe ser mayor a cero.";
  if (!datos.fecha_emision) return "La fecha de emisión es obligatoria.";
  if (datos.es_recurrente) {
    const dia = Number(datos.dia_recurrencia);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31)
      return "Para un pago recurrente indica el día del mes (1 a 31).";
  }
  return null;
}

function mensajeDuplicado(numero: string, tipo: string): string {
  const espacio = tipo === "pagar" ? "cuentas por pagar" : "cuentas por cobrar";
  return `Ya existe ${numero} en tus ${espacio}. No se creó un duplicado.`;
}

function filaDesdeDatos(datos: DatosFactura, empresaId: string) {
  return {
    id_empresa: empresaId,
    numero_factura: datos.numero_factura.trim(),
    cliente: datos.cliente.trim(),
    monto: datos.monto,
    fecha_emision: datos.fecha_emision,
    fecha_vencimiento: datos.fecha_vencimiento || null,
    concepto: datos.concepto?.trim() || null,
    tipo: datos.tipo,
    medio_pago_previsto: datos.medio_pago_previsto || null,
    es_recurrente: Boolean(datos.es_recurrente),
    dia_recurrencia: datos.es_recurrente ? Number(datos.dia_recurrencia) : null,
  };
}

export async function crearFactura(datos: DatosFactura): Promise<Resultado> {
  const invalido = validar(datos);
  if (invalido) return { ok: false, error: invalido };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase.from("facturas").insert({
    ...filaDesdeDatos(datos, ctx.empresaId),
    estado: "pendiente",
  });

  if (error) {
    // 23505 = violación de UNIQUE (id_empresa, tipo, numero_factura):
    // la regla anti-duplicación de la base de datos actuó.
    if (error.code === "23505")
      return { ok: false, error: mensajeDuplicado(datos.numero_factura.trim(), datos.tipo) };
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }

  revalidatePath("/facturas");
  return { ok: true };
}

export async function actualizarFactura(
  id: string,
  datos: DatosFactura
): Promise<Resultado> {
  const invalido = validar(datos);
  if (invalido) return { ok: false, error: invalido };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const fila: Partial<ReturnType<typeof filaDesdeDatos>> = filaDesdeDatos(
    datos,
    ctx.empresaId
  );
  delete fila.id_empresa; // la pertenencia no se edita jamás

  const { error } = await ctx.supabase
    .from("facturas")
    .update({
      ...fila,
      ...(datos.estado ? { estado: datos.estado } : {}),
    })
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId); // nunca tocar facturas ajenas

  if (error) {
    if (error.code === "23505")
      return {
        ok: false,
        error: `Ya existe otro documento con el número ${datos.numero_factura.trim()}. No se guardó el cambio.`,
      };
    return { ok: false, error: "No se pudo actualizar." };
  }

  revalidatePath("/facturas");
  revalidatePath(`/facturas/${id}`);
  return { ok: true };
}

/**
 * Marcar como pagada indicando el MEDIO de pago.
 * Si la factura es recurrente, genera automáticamente la instancia
 * del mes siguiente (la regla anti-duplicación evita generarla dos veces).
 */
export async function pagarFactura(
  id: string,
  medio: MedioPago
): Promise<Resultado> {
  if (!MEDIOS.includes(medio))
    return { ok: false, error: "Medio de pago no válido." };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: factura } = await ctx.supabase
    .from("facturas")
    .select("*")
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId)
    .maybeSingle<FacturaDB>();
  if (!factura) return { ok: false, error: "No se encontró la factura." };

  const { error } = await ctx.supabase
    .from("facturas")
    .update({ estado: "pagado", medio_pago: medio })
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId);
  if (error) return { ok: false, error: "No se pudo registrar el pago." };

  // Regenerar la próxima instancia de un pago recurrente
  if (factura.es_recurrente && factura.dia_recurrencia) {
    const base = factura.fecha_vencimiento ?? hoyISO();
    const proxima = proximaFechaRecurrente(factura.dia_recurrencia, base);
    // Número determinista por periodo: si por cualquier motivo ya se
    // generó, el UNIQUE lo rechaza y lo ignoramos en silencio.
    const numeroBase = factura.numero_factura.replace(/-\d{4}-\d{2}$/, "");
    const { error: errorSiguiente } = await ctx.supabase
      .from("facturas")
      .insert({
        id_empresa: ctx.empresaId,
        numero_factura: `${numeroBase}-${proxima.slice(0, 7)}`,
        cliente: factura.cliente,
        monto: factura.monto,
        fecha_emision: hoyISO(),
        fecha_vencimiento: proxima,
        concepto: factura.concepto,
        tipo: factura.tipo,
        medio_pago_previsto: factura.medio_pago_previsto,
        es_recurrente: true,
        dia_recurrencia: factura.dia_recurrencia,
        estado: "pendiente",
      });
    if (errorSiguiente && errorSiguiente.code !== "23505") {
      return {
        ok: false,
        error:
          "El pago se registró, pero no se pudo generar la próxima instancia recurrente.",
      };
    }
  }

  revalidatePath("/facturas");
  revalidatePath(`/facturas/${id}`);
  return { ok: true };
}

/**
 * Pago con CRÉDITO: la deuda no desaparece, cambia de acreedor.
 * - La factura original queda PAGADA (medio: crédito).
 * - Se generan N cuotas como nuevas cuentas por pagar, enlazadas a la
 *   original vía id_factura_origen, con vencimientos mensuales.
 */
export async function pagarConCredito(
  id: string,
  numCuotas: number,
  primeraFecha: string
): Promise<Resultado> {
  const n = Math.trunc(numCuotas);
  if (!Number.isInteger(n) || n < 1 || n > 48)
    return { ok: false, error: "Indica entre 1 y 48 cuotas." };
  if (!primeraFecha)
    return { ok: false, error: "Indica la fecha de la primera cuota." };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: factura } = await ctx.supabase
    .from("facturas")
    .select("*")
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId)
    .maybeSingle<FacturaDB>();
  if (!factura) return { ok: false, error: "No se encontró la factura." };
  if (factura.estado === "pagado")
    return { ok: false, error: "Esta factura ya está pagada." };

  // Cuotas: reparto en centavos exactos (la última absorbe el redondeo)
  const total = Number(factura.monto);
  const cuotaBase = Math.floor((total / n) * 100) / 100;
  const ultima = Math.round((total - cuotaBase * (n - 1)) * 100) / 100;

  const descripcion = factura.concepto?.trim() || factura.numero_factura;
  const cuotas = Array.from({ length: n }, (_, i) => ({
    id_empresa: ctx.empresaId,
    numero_factura: `TC-${factura.numero_factura}-${i + 1}/${n}`,
    cliente: "Tarjeta de crédito",
    monto: i === n - 1 ? ultima : cuotaBase,
    fecha_emision: hoyISO(),
    fecha_vencimiento: sumarMeses(primeraFecha, i),
    concepto:
      `Deuda tarjeta de crédito - ${descripcion} - pago a ${factura.cliente}` +
      (n > 1 ? ` (cuota ${i + 1} de ${n})` : ""),
    tipo: "pagar" as const,
    id_factura_origen: factura.id,
    estado: "pendiente" as const,
  }));

  const { error: errorCuotas } = await ctx.supabase
    .from("facturas")
    .insert(cuotas);
  if (errorCuotas) {
    if (errorCuotas.code === "23505")
      return {
        ok: false,
        error:
          "Las cuotas de esta factura ya fueron generadas antes. No se duplicaron.",
      };
    return { ok: false, error: "No se pudieron generar las cuotas." };
  }

  // Solo después de generar la deuda nueva, la original queda pagada.
  const { error } = await ctx.supabase
    .from("facturas")
    .update({ estado: "pagado", medio_pago: "credito" })
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId);
  if (error)
    return {
      ok: false,
      error: "Las cuotas se crearon pero no se pudo marcar la original como pagada.",
    };

  revalidatePath("/facturas");
  revalidatePath(`/facturas/${id}`);
  return { ok: true };
}

export async function cambiarEstado(
  id: string,
  estado: "pendiente" | "pagado" | "vencido"
): Promise<Resultado> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("facturas")
    .update({
      estado,
      // al reabrir una factura se limpia el medio con que "se pagó"
      ...(estado !== "pagado" ? { medio_pago: null } : {}),
    })
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId);

  if (error) return { ok: false, error: "No se pudo cambiar el estado." };

  revalidatePath("/facturas");
  revalidatePath(`/facturas/${id}`);
  return { ok: true };
}

export async function eliminarFactura(id: string): Promise<Resultado> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("facturas")
    .delete()
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId);

  if (error) return { ok: false, error: "No se pudo eliminar la factura." };

  revalidatePath("/facturas");
  return { ok: true };
}
