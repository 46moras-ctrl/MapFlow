"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { contextoEmpresa } from "@/lib/supabase/contexto";
import {
  hoyISO,
  proximaFechaRecurrente,
  sumarMeses,
  type DatosFactura,
  type FacturaDB,
  type MedioPago,
} from "@/lib/facturas";
import {
  normalizarConfigComisiones,
  periodoCierre,
  porcentajeParaVenta,
  type ConfigComisiones,
  type ConfigNomina,
} from "@/lib/nomina";

interface Resultado {
  ok: boolean;
  error?: string;
}

const MEDIOS: MedioPago[] = ["transferencia", "tarjeta", "efectivo", "credito"];

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

/**
 * LIBRETA AUTOMÁTICA: crea o actualiza el contacto de la factura
 * y devuelve su id para vincularlo vía facturas.id_contacto.
 *
 * - Busca por nombre (sin distinguir mayúsculas): si existe, solo
 *   completa teléfono/email si vienen nuevos. Si no existe y hay
 *   algún dato de contacto, lo crea.
 * - Es "best effort": si la libreta falla (ej. teléfono duplicado,
 *   regla UNIQUE), la factura se guarda igual sin vincular — nunca
 *   se bloquea el registro de dinero por un problema de agenda.
 */
async function vincularContacto(
  supabase: SupabaseClient,
  empresaId: string,
  datos: DatosFactura
): Promise<string | null> {
  const nombre = datos.cliente.trim();
  const telefono = datos.telefono_contacto?.trim() || null;
  const email = datos.email_contacto?.trim() || null;
  const tipoContacto = datos.tipo === "pagar" ? "proveedor" : "cliente";

  try {
    // ¿Ya existe? (mismo criterio que el UNIQUE: nombre normalizado)
    const { data: existente } = await supabase
      .from("contactos")
      .select("id, telefono, email")
      .ilike("nombre", nombre)
      .maybeSingle();

    if (existente) {
      // Completar datos nuevos sin borrar los que ya había
      const cambios: Record<string, string> = {};
      if (telefono && telefono !== existente.telefono)
        cambios.telefono = telefono;
      if (email && email !== existente.email) cambios.email = email;
      if (Object.keys(cambios).length > 0) {
        await supabase.from("contactos").update(cambios).eq("id", existente.id);
      }
      return existente.id as string;
    }

    // Solo crear el contacto si aporta algo (teléfono o email);
    // un nombre suelto ya vive en la factura misma.
    if (!telefono && !email) return null;

    const { data: creado, error } = await supabase
      .from("contactos")
      .insert({
        id_empresa: empresaId,
        nombre,
        telefono,
        email,
        tipo: tipoContacto,
      })
      .select("id")
      .single();

    if (error || !creado) return null;
    return creado.id as string;
  } catch {
    return null; // la agenda jamás bloquea la factura
  }
}

/**
 * % de comisión del vendedor para ESTA venta, congelado al momento
 * de asignarlo: si mañana cambia la configuración, las ventas ya
 * registradas conservan el % con el que nacieron.
 *   · Escalonada por monto → depende del tamaño de la venta.
 *   · Escalonada por cantidad → depende de cuántas ventas lleva el
 *     vendedor en el período de cierre (esta es la nº N; el sistema
 *     sube el % solo al cruzar el tramo).
 *   · Metas → null (solo bonificaciones).
 */
async function porcentajeVendedor(
  supabase: SupabaseClient,
  empresaId: string,
  idVendedor: string,
  monto: number,
  fechaEmision: string,
  excluirFacturaId?: string
): Promise<number | null> {
  const [{ data: empleado }, { data: empresa }] = await Promise.all([
    supabase
      .from("empleados")
      .select("cargo")
      .eq("id", idVendedor)
      .eq("id_empresa", empresaId)
      .maybeSingle(),
    supabase
      .from("empresas")
      .select("config_comisiones, config_nomina")
      .eq("id", empresaId)
      .maybeSingle(),
  ]);
  if (!empleado) return null;

  const config = empresa?.config_comisiones as ConfigComisiones | null;
  const n = normalizarConfigComisiones(config);

  // Escalonada por cantidad: contar las ventas del vendedor dentro
  // del período de cierre al que pertenece esta venta
  let numeroVenta: number | undefined;
  if (n.modalidad === "venta" && n.tipo_venta === "escalonada" && n.escala === "cantidad") {
    const cierre = (empresa?.config_nomina as ConfigNomina | null)?.cierre;
    const { desde, hasta } = periodoCierre(cierre, fechaEmision);
    let consulta = supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("id_empresa", empresaId)
      .eq("id_vendedor", idVendedor)
      .eq("tipo", "cobrar")
      .gte("fecha_emision", desde)
      .lte("fecha_emision", hasta);
    if (excluirFacturaId) consulta = consulta.neq("id", excluirFacturaId);
    const { count } = await consulta;
    numeroVenta = (count ?? 0) + 1;
  }

  return porcentajeParaVenta(config, empleado.cargo as string, monto, numeroVenta);
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
    // Sin vencimiento = el movimiento vence el mismo día de emisión
    fecha_vencimiento: datos.fecha_vencimiento || datos.fecha_emision,
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

  // Libreta automática: el contacto se crea/actualiza y se vincula
  const idContacto = await vincularContacto(ctx.supabase, ctx.empresaId, datos);

  // Vendedor de la venta (solo cobros): comisión sobre el monto
  // total con el % congelado. Los campos solo viajan si hay
  // vendedor, para no requerir la migración de nómina.
  let camposComision = {};
  if (datos.tipo === "cobrar" && datos.id_vendedor) {
    camposComision = {
      id_vendedor: datos.id_vendedor,
      comision_porcentaje: await porcentajeVendedor(
        ctx.supabase,
        ctx.empresaId,
        datos.id_vendedor,
        datos.monto,
        datos.fecha_emision
      ),
    };
  }

  // REGLA: toda factura entra como PAGADA (celda blanca). Solo el
  // registro de un cobro/pago pendiente (triángulo ⚠️ / Pendientes)
  // la pasa a pendiente y la pinta de rosa.
  const { error } = await ctx.supabase.from("facturas").insert({
    ...filaDesdeDatos(datos, ctx.empresaId),
    ...camposComision,
    id_contacto: idContacto,
    estado: datos.estado ?? "pagado",
  });

  if (error) {
    // 23505 = violación de UNIQUE (id_empresa, tipo, numero_factura):
    // la regla anti-duplicación de la base de datos actuó.
    if (error.code === "23505")
      return { ok: false, error: mensajeDuplicado(datos.numero_factura.trim(), datos.tipo) };
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }

  revalidatePath("/facturas");
  revalidatePath("/dashboard");
  revalidatePath("/ventas");
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

  // Libreta automática también al editar (por si se corrige
  // el nombre o se completan teléfono/email)
  const idContacto = await vincularContacto(ctx.supabase, ctx.empresaId, datos);

  // Vendedor al editar: si cambia, se congela el % nuevo; si es el
  // mismo, se conserva el % original; una comisión ya liquidada no
  // se toca. Sin la migración de nómina este select falla y los
  // campos simplemente no viajan.
  let camposComision = {};
  if (datos.id_vendedor !== undefined) {
    const { data: actual } = await ctx.supabase
      .from("facturas")
      .select("id_vendedor, comision_liquidada")
      .eq("id", id)
      .eq("id_empresa", ctx.empresaId)
      .maybeSingle();
    if (actual && !actual.comision_liquidada) {
      const nuevoVendedor =
        datos.tipo === "pagar" ? null : datos.id_vendedor || null;
      if (nuevoVendedor !== actual.id_vendedor) {
        camposComision = {
          id_vendedor: nuevoVendedor,
          comision_porcentaje: nuevoVendedor
            ? await porcentajeVendedor(
                ctx.supabase,
                ctx.empresaId,
                nuevoVendedor,
                datos.monto,
                datos.fecha_emision,
                id
              )
            : null,
        };
      }
    }
  }

  const { error } = await ctx.supabase
    .from("facturas")
    .update({
      ...fila,
      ...camposComision,
      ...(idContacto ? { id_contacto: idContacto } : {}),
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
  revalidatePath("/dashboard");
  revalidatePath("/ventas");
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
  revalidatePath("/dashboard");
  revalidatePath("/ventas");
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
  revalidatePath("/dashboard");
  revalidatePath("/ventas");
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
  revalidatePath("/dashboard");
  revalidatePath("/ventas");
  return { ok: true };
}

/**
 * AJUSTES DE RECORDATORIOS (tabla empresas):
 * - email/teléfono del DUEÑO (dónde recibe recordatorios de pagos)
 * - switch de recordatorios de pagos + canal
 * - canal general de recordatorios de cobros (siempre activos)
 * RLS solo permite actualizar la empresa propia.
 */
export interface AjustesRecordatorios {
  email_dueno: string | null;
  telefono_dueno: string | null;
  recordatorios_pagos_activo: boolean;
  recordatorios_pagos_canal: "whatsapp" | "email" | "ambos";
  recordatorios_cobros_canal: "whatsapp" | "email" | "ambos";
}

export async function guardarAjustesRecordatorios(
  ajustes: AjustesRecordatorios
): Promise<Resultado> {
  const canales = ["whatsapp", "email", "ambos"];
  if (
    !canales.includes(ajustes.recordatorios_pagos_canal) ||
    !canales.includes(ajustes.recordatorios_cobros_canal)
  ) {
    return { ok: false, error: "Canal no válido." };
  }

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("empresas")
    .update({
      email_dueno: ajustes.email_dueno?.trim() || null,
      telefono_dueno: ajustes.telefono_dueno?.trim() || null,
      recordatorios_pagos_activo: ajustes.recordatorios_pagos_activo,
      recordatorios_pagos_canal: ajustes.recordatorios_pagos_canal,
      recordatorios_cobros_canal: ajustes.recordatorios_cobros_canal,
    })
    .eq("id", ctx.empresaId);

  if (error) {
    // 42703 = columna inexistente: falta aplicar la migración
    if (error.code === "42703" || /column/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Falta aplicar la migración supabase/migracion_asistente_contactos.sql en Supabase.",
      };
    }
    return { ok: false, error: "No se pudieron guardar los ajustes." };
  }

  revalidatePath("/facturas");
  revalidatePath("/dashboard");
  revalidatePath("/ventas");
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
  revalidatePath("/dashboard");
  revalidatePath("/ventas");
  return { ok: true };
}
