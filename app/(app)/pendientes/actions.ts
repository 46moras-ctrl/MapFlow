"use server";

import { revalidatePath } from "next/cache";
import type { FacturaDB } from "@/lib/facturas";
import type { DatosPlanPago } from "@/lib/planes-pago";
import { contextoEmpresa } from "@/lib/supabase/contexto";

interface Resultado {
  ok: boolean;
  error?: string;
}

// Factura encontrada por código + su contacto de la libreta (si tiene)
export interface FacturaEncontrada extends FacturaDB {
  contacto: { nombre: string; telefono: string | null; email: string | null } | null;
}

const FALTA_MIGRACION =
  "Falta aplicar la migración supabase/migracion_reestructura_ui.sql en Supabase.";

function esTablaInexistente(codigo: string | undefined): boolean {
  return codigo === "42P01";
}

/**
 * BUSCADOR de Pendientes: por el CÓDIGO ÚNICO de la factura
 * (numero_factura). Valida SIEMPRE que la factura pertenezca a
 * la empresa del usuario logueado: un código de otra empresa
 * responde "no encontrada", jamás filtra datos ajenos.
 */
export async function buscarFacturaPorCodigo(
  codigo: string
): Promise<{ ok: boolean; factura?: FacturaEncontrada; error?: string }> {
  const q = codigo.trim();
  if (!q) return { ok: false, error: "Escribe el código de la factura." };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data } = await ctx.supabase
    .from("facturas")
    .select("*, contacto:contactos(nombre, telefono, email)")
    .eq("id_empresa", ctx.empresaId) // aislamiento explícito (además del RLS)
    .ilike("numero_factura", q)
    .maybeSingle();

  if (!data) {
    return {
      ok: false,
      error: `No existe una factura con el código «${q}» en tu empresa.`,
    };
  }
  return { ok: true, factura: data as FacturaEncontrada };
}

/**
 * ANTI-DUPLICACIÓN WEB vs VOZ: ¿ya existe HOY un cobro con el
 * MISMO monto exacto para el MISMO cliente (nombre similar)?
 * Mira facturas de cobro emitidas hoy y movimientos de ingreso
 * de hoy (por si la nota de voz de Telegram entró como
 * movimiento). No bloquea: la interfaz pregunta antes de guardar.
 */
export async function verificarDuplicadoCobro(datos: {
  nombre: string;
  monto: number;
  excluirFacturaId?: string; // al planear sobre una factura existente, no compararse consigo misma
}): Promise<{ ok: boolean; duplicado: boolean; error?: string }> {
  const nombre = datos.nombre?.trim();
  if (!nombre || !Number.isFinite(datos.monto) || datos.monto <= 0)
    return { ok: true, duplicado: false };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, duplicado: false, error: ctx.error };

  const hoy = new Date().toISOString().slice(0, 10);

  let consultaFacturas = ctx.supabase
    .from("facturas")
    .select("id")
    .eq("id_empresa", ctx.empresaId)
    .eq("tipo", "cobrar")
    .eq("monto", datos.monto)
    .eq("fecha_emision", hoy)
    .ilike("cliente", `%${nombre}%`)
    .limit(1);
  if (datos.excluirFacturaId)
    consultaFacturas = consultaFacturas.neq("id", datos.excluirFacturaId);

  const [facts, movs] = await Promise.all([
    consultaFacturas,
    ctx.supabase
      .from("movimientos")
      .select("id")
      .eq("id_empresa", ctx.empresaId)
      .eq("tipo", "ingreso")
      .eq("monto", datos.monto)
      .eq("fecha", hoy)
      .ilike("contraparte", `%${nombre}%`)
      .limit(1),
  ]);

  const duplicado =
    (facts.data?.length ?? 0) > 0 || (movs.data?.length ?? 0) > 0;
  return { ok: true, duplicado };
}

function validarPlan(datos: DatosPlanPago): string | null {
  if (!datos.id_factura) return "Falta la factura del plan.";
  if (datos.tipo !== "cobro" && datos.tipo !== "pago")
    return "Elige si es un cobro o un pago.";
  const n = Math.trunc(datos.cuotas);
  if (!Number.isInteger(n) || n < 1 || n > 48)
    return "Indica entre 1 y 48 cuotas.";
  const fechas = (datos.fechas_pago ?? []).filter(Boolean);
  if (fechas.length === 0) return "Indica al menos una fecha de pago.";
  return null;
}

/**
 * Guarda (crea o actualiza) el plan de cobro/pago de una factura.
 * Verifica que la factura sea de la empresa del usuario ANTES de
 * escribir: nadie puede colgarle un plan a una factura ajena.
 */
export async function guardarPlanPago(datos: DatosPlanPago): Promise<Resultado> {
  const invalido = validarPlan(datos);
  if (invalido) return { ok: false, error: invalido };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: factura } = await ctx.supabase
    .from("facturas")
    .select("id")
    .eq("id", datos.id_factura)
    .eq("id_empresa", ctx.empresaId)
    .maybeSingle();
  if (!factura)
    return { ok: false, error: "Esa factura no existe en tu empresa." };

  const { error } = await ctx.supabase.from("planes_pago").upsert(
    {
      id_empresa: ctx.empresaId,
      id_factura: datos.id_factura,
      tipo: datos.tipo,
      cuotas: Math.trunc(datos.cuotas),
      fechas_pago: (datos.fechas_pago ?? []).filter(Boolean),
      contacto_nombre: datos.contacto_nombre?.trim() || null,
      contacto_telefono: datos.contacto_telefono?.trim() || null,
      contacto_email: datos.contacto_email?.trim() || null,
      metodo_pago: datos.tipo === "pago" ? datos.metodo_pago || null : null,
      detalle_metodo:
        datos.tipo === "pago" ? datos.detalle_metodo?.trim() || null : null,
      destino_envio: datos.destino_envio ?? "contacto",
      estado: "activo",
    },
    { onConflict: "id_factura" } // un plan por factura: se actualiza, no se duplica
  );

  if (error) {
    if (esTablaInexistente(error.code)) return { ok: false, error: FALTA_MIGRACION };
    return { ok: false, error: "No se pudo guardar el plan. Intenta de nuevo." };
  }

  // Registrar el pendiente PINTA la factura de rosa en Facturas:
  // su estado pasa a 'pendiente' hasta que el plan se complete.
  await ctx.supabase
    .from("facturas")
    .update({ estado: "pendiente" })
    .eq("id", datos.id_factura)
    .eq("id_empresa", ctx.empresaId);

  revalidatePath("/pendientes");
  revalidatePath("/facturas");
  return { ok: true };
}

/**
 * Chulito de Pendientes: marca el plan como COMPLETADO indicando
 * el medio de pago. El plan sale de la lista de pendientes y la
 * factura vuelve a PAGADA (celda blanca en Facturas).
 */
export async function completarPlan(
  id: string,
  medio: "efectivo" | "transferencia" | "tarjeta" | "credito"
): Promise<Resultado> {
  if (!["efectivo", "transferencia", "tarjeta", "credito"].includes(medio))
    return { ok: false, error: "Medio de pago no válido." };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: plan } = await ctx.supabase
    .from("planes_pago")
    .select("id, id_factura")
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId) // nunca tocar planes ajenos
    .maybeSingle();
  if (!plan) return { ok: false, error: "No se encontró el pendiente." };

  const { error } = await ctx.supabase
    .from("planes_pago")
    .update({ estado: "completado" })
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId);
  if (error) return { ok: false, error: "No se pudo marcar como pagado." };

  await ctx.supabase
    .from("facturas")
    .update({ estado: "pagado", medio_pago: medio })
    .eq("id", plan.id_factura)
    .eq("id_empresa", ctx.empresaId);

  revalidatePath("/pendientes");
  revalidatePath("/facturas");
  return { ok: true };
}

/**
 * PAGO CON CRÉDITO: el crédito no cierra el saldo, lo TRASLADA
 * del proveedor al banco.
 *  1. El pendiente original queda COMPLETADO y su factura PAGADA
 *     (el banco le pagó al proveedor).
 *  2. Se crea UNA factura nueva por el total, con contacto = la
 *     entidad bancaria, y su plan de pago con las cuotas y fechas
 *     adentro → sigue viva en Pendientes como deuda con el banco.
 */
export async function completarPlanConCredito(
  id: string,
  datos: { cuotas: number; fechas: string[]; entidad: string }
): Promise<Resultado> {
  const entidad = datos.entidad?.trim();
  if (!entidad) return { ok: false, error: "Escribe la entidad bancaria." };
  const n = Math.trunc(datos.cuotas);
  if (!Number.isInteger(n) || n < 1 || n > 48)
    return { ok: false, error: "Indica entre 1 y 48 cuotas." };
  const fechas = (datos.fechas ?? []).filter(Boolean);
  if (fechas.length === 0)
    return { ok: false, error: "Indica al menos una fecha de cuota." };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: plan } = await ctx.supabase
    .from("planes_pago")
    .select("id, id_factura, factura:facturas(id, numero_factura, cliente, monto, concepto)")
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId)
    .maybeSingle();
  const factura = (plan as {
    factura?: {
      id: string;
      numero_factura: string;
      cliente: string;
      monto: number;
      concepto: string | null;
    } | null;
  } | null)?.factura;
  if (!plan || !factura)
    return { ok: false, error: "No se encontró el pendiente." };

  const hoy = new Date().toISOString().slice(0, 10);
  const primeraCuota = [...fechas].sort()[0];

  // 1. Nueva factura: la deuda con el banco (UNA sola, por el total)
  const { data: nueva, error: errorNueva } = await ctx.supabase
    .from("facturas")
    .insert({
      id_empresa: ctx.empresaId,
      numero_factura: `CRED-${factura.numero_factura}`,
      cliente: entidad,
      monto: factura.monto,
      fecha_emision: hoy,
      fecha_vencimiento: primeraCuota,
      concepto: `Crédito con ${entidad} — pago de ${factura.numero_factura} a ${factura.cliente}${n > 1 ? ` (${n} cuotas)` : ""}`,
      tipo: "pagar",
      id_factura_origen: factura.id,
      estado: "pendiente",
    })
    .select("id")
    .single();
  if (errorNueva || !nueva) {
    if (errorNueva?.code === "23505")
      return {
        ok: false,
        error: "El crédito de esta factura ya fue registrado antes. No se duplicó.",
      };
    return { ok: false, error: "No se pudo crear la deuda con el banco." };
  }

  // 2. Su plan de pago: las cuotas y fechas viven adentro
  await ctx.supabase.from("planes_pago").insert({
    id_empresa: ctx.empresaId,
    id_factura: nueva.id,
    tipo: "pago",
    cuotas: n,
    fechas_pago: fechas,
    contacto_nombre: entidad,
    metodo_pago: null,
    detalle_metodo: `Crédito ${entidad}`,
    destino_envio: "contacto",
    estado: "activo",
  });

  // 3. Solo con la deuda nueva creada, se salda la del proveedor
  const { error } = await ctx.supabase
    .from("planes_pago")
    .update({ estado: "completado" })
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId);
  if (error)
    return {
      ok: false,
      error: "La deuda con el banco se creó, pero no se pudo cerrar el pendiente original.",
    };

  await ctx.supabase
    .from("facturas")
    .update({ estado: "pagado", medio_pago: "credito" })
    .eq("id", plan.id_factura)
    .eq("id_empresa", ctx.empresaId);

  revalidatePath("/pendientes");
  revalidatePath("/facturas");
  return { ok: true };
}

export async function eliminarPlan(id: string): Promise<Resultado> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: plan } = await ctx.supabase
    .from("planes_pago")
    .select("id, id_factura")
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "No se encontró el pendiente." };

  const { error } = await ctx.supabase
    .from("planes_pago")
    .delete()
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId);
  if (error) return { ok: false, error: "No se pudo eliminar el plan." };

  // Sin pendiente registrado, la factura vuelve a verse pagada (blanca)
  await ctx.supabase
    .from("facturas")
    .update({ estado: "pagado" })
    .eq("id", plan.id_factura)
    .eq("id_empresa", ctx.empresaId);

  revalidatePath("/pendientes");
  revalidatePath("/facturas");
  return { ok: true };
}
