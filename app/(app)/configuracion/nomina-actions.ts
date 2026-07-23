"use server";

import { revalidatePath } from "next/cache";
import { hoyISO } from "@/lib/facturas";
import { contextoEmpresa } from "@/lib/supabase/contexto";
import {
  hayComisiones,
  normalizarConfigComisiones,
  proximoCierre,
  type CambioComisionPendiente,
  type ConfigComisiones,
  type ConfigNomina,
  type TipoContrato,
} from "@/lib/nomina";

// ============================================================
// NÓMINA — acciones de la pestaña Ajustes → Nómina:
//   · Empleados: crear, editar, activar/desactivar, eliminar.
//   · Frecuencia de pago del sueldo (empresas.config_nomina).
//   · Comisiones: roles que comisionan + metas de bonificación
//     (empresas.config_comisiones).
// Todo aislado por empresa vía contextoEmpresa().
// ============================================================

interface Resultado {
  ok: boolean;
  error?: string;
}

const FALTA_MIGRACION =
  "Falta aplicar la migración supabase/migracion_nomina.sql en Supabase.";

function errorAmigable(
  codigo: string | undefined,
  detalle: string | undefined,
  mensaje: string
): string {
  // Columna o tabla inexistente → falta la migración. Supabase lo
  // reporta como 42703/42P01 (Postgres) o PGRST204/PGRST205
  // ("schema cache" de la API) según por dónde llegue el error.
  if (
    codigo === "42703" ||
    codigo === "42P01" ||
    codigo === "PGRST204" ||
    codigo === "PGRST205" ||
    /schema cache/i.test(detalle ?? "")
  )
    return FALTA_MIGRACION;
  return mensaje;
}

function refrescarNomina() {
  // La configuración de nómina toca Ajustes, Facturas (campo
  // Vendedor), Reportes (botón Comisiones) y la campana del layout
  revalidatePath("/", "layout");
}

// ===== EMPLEADOS =====

export interface DatosEmpleado {
  nombre: string;
  documento: string | null;
  telefono: string | null;
  direccion: string | null;
  cargo: string;
  tipo_contrato: TipoContrato;
  fecha_ingreso: string | null;
  salario_mensual: number;
  fecha_nacimiento: string | null;
  email: string | null;
  emergencia_nombre: string | null;
  emergencia_telefono: string | null;
}

function validarEmpleado(datos: DatosEmpleado): string | null {
  if (!datos.nombre?.trim()) return "El nombre del empleado es obligatorio.";
  if (!datos.cargo?.trim()) return "El cargo del empleado es obligatorio.";
  if (!Number.isFinite(datos.salario_mensual) || datos.salario_mensual < 0)
    return "El salario mensual no es válido.";
  if (!["indefinido", "fijo", "prestacion", "otro"].includes(datos.tipo_contrato))
    return "El tipo de contrato no es válido.";
  return null;
}

function filaEmpleado(datos: DatosEmpleado) {
  return {
    nombre: datos.nombre.trim(),
    documento: datos.documento?.trim() || null,
    telefono: datos.telefono?.trim() || null,
    direccion: datos.direccion?.trim() || null,
    cargo: datos.cargo.trim(),
    tipo_contrato: datos.tipo_contrato,
    fecha_ingreso: datos.fecha_ingreso || null,
    salario_mensual: datos.salario_mensual,
    fecha_nacimiento: datos.fecha_nacimiento || null,
    email: datos.email?.trim() || null,
    emergencia_nombre: datos.emergencia_nombre?.trim() || null,
    emergencia_telefono: datos.emergencia_telefono?.trim() || null,
  };
}

export async function crearEmpleado(datos: DatosEmpleado): Promise<Resultado> {
  const invalido = validarEmpleado(datos);
  if (invalido) return { ok: false, error: invalido };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("empleados")
    .insert({ id_empresa: ctx.empresaId, ...filaEmpleado(datos) });

  if (error)
    return { ok: false, error: errorAmigable(error.code, error.message, "No se pudo guardar el empleado.") };
  refrescarNomina();
  return { ok: true };
}

export async function actualizarEmpleado(
  id: string,
  datos: DatosEmpleado
): Promise<Resultado> {
  const invalido = validarEmpleado(datos);
  if (invalido) return { ok: false, error: invalido };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("empleados")
    .update(filaEmpleado(datos))
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId);

  if (error)
    return { ok: false, error: errorAmigable(error.code, error.message, "No se pudo actualizar el empleado.") };
  refrescarNomina();
  return { ok: true };
}

/** Desactivar conserva el historial de comisiones; el empleado
 *  deja de aparecer en el desplegable de Vendedor. */
export async function cambiarActivoEmpleado(
  id: string,
  activo: boolean
): Promise<Resultado> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("empleados")
    .update({ activo })
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId);

  if (error) return { ok: false, error: "No se pudo cambiar el estado del empleado." };
  refrescarNomina();
  return { ok: true };
}

export async function eliminarEmpleado(id: string): Promise<Resultado> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  // Con ventas asignadas se protege el historial: mejor desactivar
  const { count } = await ctx.supabase
    .from("facturas")
    .select("id", { count: "exact", head: true })
    .eq("id_empresa", ctx.empresaId)
    .eq("id_vendedor", id);
  if ((count ?? 0) > 0)
    return {
      ok: false,
      error:
        "Este empleado tiene ventas con comisión asignadas. Desactívalo en su lugar para conservar el historial.",
    };

  const { error } = await ctx.supabase
    .from("empleados")
    .delete()
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId);

  if (error) return { ok: false, error: "No se pudo eliminar el empleado." };
  refrescarNomina();
  return { ok: true };
}

// ===== FRECUENCIA DE PAGO DEL SUELDO =====

export async function guardarConfigNomina(
  config: ConfigNomina | null
): Promise<Resultado> {
  if (config) {
    if (!["semanal", "quincenal", "mensual"].includes(config.frecuencia))
      return { ok: false, error: "La frecuencia de pago no es válida." };
    if (config.cierre && !["mensual", "trimestral", "semestral", "anual"].includes(config.cierre))
      return { ok: false, error: "El cierre de nómina no es válido." };
    const dias = (config.dias ?? []).filter((n) => Number.isInteger(n));
    const tope = config.frecuencia === "semanal" ? 6 : 31;
    const piso = config.frecuencia === "semanal" ? 0 : 1;
    if (dias.length === 0 || dias.some((d) => d < piso || d > tope))
      return { ok: false, error: "Elige al menos un día de pago válido." };
    config = {
      frecuencia: config.frecuencia,
      dias: Array.from(new Set(dias)).sort((a, b) => a - b),
      cierre: config.cierre ?? "mensual",
    };
  }

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("empresas")
    .update({ config_nomina: config })
    .eq("id", ctx.empresaId);

  if (error)
    return { ok: false, error: errorAmigable(error.code, error.message, "No se pudo guardar la frecuencia de pago.") };
  refrescarNomina();
  return { ok: true };
}

// ===== COMISIONES =====
// Modalidades EXCLUYENTES: al guardar una, los datos de la otra se
// limpian (una empresa maneja una sola forma de comisionar).
// CAMBIO DE MÉTODO DIFERIDO: si ya hay un método activo y el nuevo
// es distinto, el cambio queda PROGRAMADO para el próximo cierre de
// nómina y requiere confirmación; hasta entonces se sigue
// comisionando con el método actual.

export async function guardarConfigComisiones(
  config: ConfigComisiones
): Promise<Resultado & { diferido?: string }> {
  const n = normalizarConfigComisiones(config);
  if (!["venta", "metas"].includes(n.modalidad))
    return { ok: false, error: "La modalidad de comisión no es válida." };
  if (!["directa", "escalonada"].includes(n.tipo_venta))
    return { ok: false, error: "El tipo de comisión por venta no es válido." };
  if (!["monto", "cantidad"].includes(n.escala))
    return { ok: false, error: "La escala de la comisión escalonada no es válida." };

  const esVentaDirecta = n.modalidad === "venta" && n.tipo_venta === "directa";
  const esEscalonada = n.modalidad === "venta" && n.tipo_venta === "escalonada";

  const roles = n.roles
    .map((r) => ({
      cargo: r.cargo?.trim() ?? "",
      // El % por cargo solo existe en la venta directa
      porcentaje: esVentaDirecta ? Number(r.porcentaje) : 0,
    }))
    .filter((r) => r.cargo);
  if (
    esVentaDirecta &&
    roles.some((r) => !Number.isFinite(r.porcentaje) || r.porcentaje <= 0 || r.porcentaje > 100)
  )
    return { ok: false, error: "Cada cargo necesita un % de comisión entre 0 y 100." };
  const cargos = roles.map((r) => r.cargo.toLowerCase());
  if (new Set(cargos).size !== cargos.length)
    return { ok: false, error: "Hay un cargo repetido en la lista de comisiones." };
  // Sin cargos las comisiones quedan APAGADAS: se guarda vacío y
  // no aparecen en la plataforma (regla del módulo).
  const apagado = roles.length === 0;

  const tramos =
    esEscalonada && !apagado
      ? n.tramos
          .map((t) => ({ desde: Number(t.desde), porcentaje: Number(t.porcentaje) }))
          .sort((a, b) => a.desde - b.desde)
      : [];
  if (esEscalonada && !apagado) {
    const porCantidad = n.escala === "cantidad";
    if (tramos.length === 0)
      return { ok: false, error: "La comisión escalonada necesita al menos un tramo." };
    for (const t of tramos) {
      if (!Number.isFinite(t.desde) || t.desde < 0)
        return {
          ok: false,
          error: porCantidad
            ? "Cada tramo necesita un número de venta «desde» válido."
            : "Cada tramo necesita un monto «desde» válido (0 o más).",
        };
      if (porCantidad && (!Number.isInteger(t.desde) || t.desde < 1))
        return { ok: false, error: "En la escala por cantidad, «desde» es el número de venta (1, 31…)." };
      if (!Number.isFinite(t.porcentaje) || t.porcentaje <= 0 || t.porcentaje > 100)
        return { ok: false, error: "Cada tramo necesita un % entre 0 y 100." };
    }
    if (new Set(tramos.map((t) => t.desde)).size !== tramos.length)
      return { ok: false, error: "Hay dos tramos con el mismo «desde»." };
  }

  const metas =
    n.modalidad === "metas" && !apagado
      ? n.metas.map((m) => ({
          tipo: m.tipo,
          valor: Number(m.valor),
          bonificacion: Number(m.bonificacion),
          periodo: m.periodo,
        }))
      : [];
  if (n.modalidad === "metas" && !apagado && metas.length === 0)
    return { ok: false, error: "La modalidad de metas necesita al menos una meta." };
  for (const m of metas) {
    if (!["monto", "cantidad", "venta_unica"].includes(m.tipo))
      return { ok: false, error: "El tipo de meta no es válido." };
    if (!["semanal", "quincenal", "mensual"].includes(m.periodo))
      return { ok: false, error: "El período de la meta no es válido." };
    if (!Number.isFinite(m.valor) || m.valor <= 0)
      return { ok: false, error: "Cada meta necesita un valor mayor a cero." };
    if (!Number.isFinite(m.bonificacion) || m.bonificacion <= 0)
      return { ok: false, error: "Cada meta necesita una bonificación mayor a cero." };
  }

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const nueva: ConfigComisiones = {
    modalidad: n.modalidad,
    tipo_venta: n.tipo_venta,
    escala: n.escala,
    roles,
    tramos,
    metas,
  };

  // ¿Cambio de MÉTODO con uno ya activo? → programado para el
  // próximo cierre de nómina. Ajustes de valores dentro del mismo
  // método, la primera configuración y el apagado aplican ya.
  const { data: empresa } = await ctx.supabase
    .from("empresas")
    .select("config_comisiones, config_nomina")
    .eq("id", ctx.empresaId)
    .maybeSingle();
  const actual = normalizarConfigComisiones(
    (empresa?.config_comisiones as ConfigComisiones | null) ?? null
  );
  const habiaMetodoActivo = hayComisiones(
    (empresa?.config_comisiones as ConfigComisiones | null) ?? null
  );
  const cambiaMetodo =
    habiaMetodoActivo &&
    !apagado &&
    (actual.modalidad !== n.modalidad ||
      (n.modalidad === "venta" &&
        (actual.tipo_venta !== n.tipo_venta ||
          (n.tipo_venta === "escalonada" && actual.escala !== n.escala))));

  if (cambiaMetodo) {
    const cierre = (empresa?.config_nomina as ConfigNomina | null)?.cierre;
    const pendiente: CambioComisionPendiente = {
      config: nueva,
      aplica_el: proximoCierre(cierre),
      confirmado: false,
      aviso_enviado: false,
      solicitado_el: hoyISO(),
    };
    const { error } = await ctx.supabase
      .from("empresas")
      .update({ config_comisiones_pendiente: pendiente })
      .eq("id", ctx.empresaId);
    if (error)
      return { ok: false, error: errorAmigable(error.code, error.message, "No se pudo programar el cambio de método.") };
    refrescarNomina();
    return { ok: true, diferido: pendiente.aplica_el };
  }

  const { error } = await ctx.supabase
    .from("empresas")
    .update({ config_comisiones: nueva })
    .eq("id", ctx.empresaId);

  if (error)
    return { ok: false, error: errorAmigable(error.code, error.message, "No se pudo guardar la configuración de comisiones.") };
  refrescarNomina();
  return { ok: true };
}

/** Confirma el cambio programado: se aplicará en el cierre */
export async function confirmarCambioComisiones(): Promise<Resultado> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: empresa } = await ctx.supabase
    .from("empresas")
    .select("config_comisiones_pendiente")
    .eq("id", ctx.empresaId)
    .maybeSingle();
  const pendiente = empresa?.config_comisiones_pendiente as CambioComisionPendiente | null;
  if (!pendiente) return { ok: false, error: "No hay ningún cambio de método programado." };

  const { error } = await ctx.supabase
    .from("empresas")
    .update({ config_comisiones_pendiente: { ...pendiente, confirmado: true } })
    .eq("id", ctx.empresaId);
  if (error) return { ok: false, error: "No se pudo confirmar el cambio." };
  refrescarNomina();
  return { ok: true };
}

/** Descarta el cambio programado: se sigue con el método actual */
export async function descartarCambioComisiones(): Promise<Resultado> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("empresas")
    .update({ config_comisiones_pendiente: null })
    .eq("id", ctx.empresaId);
  if (error) return { ok: false, error: "No se pudo descartar el cambio." };
  refrescarNomina();
  return { ok: true };
}
