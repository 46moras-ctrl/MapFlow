// ============================================================
// NÓMINA + COMISIONES — tipos y helpers puros compartidos por
// Ajustes (pestaña Nómina), Facturas (campo Vendedor), Reportes
// (página Comisiones) y la alerta de nómina próxima.
// Configuración en empresas.config_nomina / config_comisiones;
// empleados y liquidaciones en sus tablas (migracion_nomina.sql).
// ============================================================

import type { Alerta } from "@/lib/alertas";
import { diasHasta, fmt, formatearFecha, hoyISO } from "@/lib/facturas";

// ===== EMPLEADOS =====

export type TipoContrato = "indefinido" | "fijo" | "prestacion" | "otro";

export interface EmpleadoDB {
  id: string;
  id_empresa: string;
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
  activo: boolean;
  created_at: string;
}

export const ROLES_SUGERIDOS = [
  "Vendedor",
  "Administrador",
  "Gerente",
  "Supervisor",
  "Contador",
  "Secretaria",
  "Recepcionista",
  "Cajero",
  "Operario",
  "Técnico",
  "Auxiliar",
  "Almacenista / Bodeguero",
  "Conductor / Mensajero",
  "Mesero",
  "Cocinero",
  "Marketing",
  "Practicante / Aprendiz",
] as const;

export const TIPOS_CONTRATO: { id: TipoContrato; label: string }[] = [
  { id: "indefinido", label: "Indefinido" },
  { id: "fijo", label: "Fijo" },
  { id: "prestacion", label: "Prestación de servicios" },
  { id: "otro", label: "Otro" },
];

// ===== FRECUENCIA DE PAGO DEL SUELDO =====

export type FrecuenciaPago = "semanal" | "quincenal" | "mensual";

// Cada cuánto se CIERRA la nómina (los cambios de método de
// comisión se aplican en el próximo cierre, no de inmediato)
export type CierreNomina = "mensual" | "trimestral" | "semestral" | "anual";

export interface ConfigNomina {
  frecuencia: FrecuenciaPago;
  // semanal: días de la semana (0=Domingo … 6=Sábado)
  // quincenal/mensual: días del mes (1 a 31, con ajuste de mes corto)
  dias: number[];
  // Cierre de nómina: último día del período calendario (fin de
  // mes, de trimestre…). Sin definir se asume mensual.
  cierre?: CierreNomina;
}

export const ETIQUETA_CIERRE: Record<CierreNomina, string> = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const ETIQUETA_FRECUENCIA: Record<FrecuenciaPago, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
};

// ===== COMISIONES =====
// Las modalidades son EXCLUYENTES (las empresas manejan una sola):
//   · "venta": comisión por cada venta — directa (% fijo por
//     cargo) o escalonada (el % depende del monto de la venta).
//   · "metas": solo bonificaciones al alcanzar metas del período.

export type ModalidadComision = "venta" | "metas";
export type TipoComisionVenta = "directa" | "escalonada";
// Escalonada: el % puede escalar por el MONTO de cada venta o por
// la CANTIDAD de ventas que el vendedor acumula en el período de
// cierre ("de la venta 31 en adelante ya no es 2% sino 4%").
export type EscalaComision = "monto" | "cantidad";

export interface RolComision {
  cargo: string;
  porcentaje: number; // % por venta (solo aplica en venta directa)
}

// Tramo escalonado: por monto → "desde una venta de $X, el % es Y";
// por cantidad → "desde la venta nº X del período, el % es Y".
// Siempre aplica el tramo más alto alcanzado.
export interface TramoComision {
  desde: number;
  porcentaje: number;
}

export interface MetaComision {
  // monto acumulado de ventas · nº de ventas · UNA sola venta que
  // iguale o supere el valor (se gana cada vez que ocurra)
  tipo: "monto" | "cantidad" | "venta_unica";
  valor: number; // valor de la meta
  bonificacion: number; // lo que gana al alcanzarla
  periodo: FrecuenciaPago;
}

export interface ConfigComisiones {
  // Configuraciones guardadas antes del selector de modalidad no
  // traen estos campos: se interpretan como venta directa.
  modalidad?: ModalidadComision;
  tipo_venta?: TipoComisionVenta;
  escala?: EscalaComision;
  roles: RolComision[];
  tramos?: TramoComision[];
  metas: MetaComision[];
}

// Cambio de método programado: se aplica en el próximo cierre de
// nómina SOLO si el usuario lo confirma antes; si no, se descarta.
export interface CambioComisionPendiente {
  config: ConfigComisiones;
  aplica_el: string; // fecha del cierre (YYYY-MM-DD)
  confirmado: boolean;
  aviso_enviado: boolean; // correo de "¿aún deseas ejecutar el cambio?"
  solicitado_el: string;
}

/** Config con todos los campos presentes (compatibilidad con lo
 *  guardado antes de existir la modalidad excluyente). */
export function normalizarConfigComisiones(
  c: ConfigComisiones | null | undefined
): Required<ConfigComisiones> {
  return {
    modalidad: c?.modalidad ?? "venta",
    tipo_venta: c?.tipo_venta ?? "directa",
    escala: c?.escala ?? "monto",
    roles: c?.roles ?? [],
    tramos: c?.tramos ?? [],
    metas: c?.metas ?? [],
  };
}

/** ¿Las comisiones están configuradas y completas? De esto depende
 *  que existan en la plataforma (campo Vendedor, botón Comisiones
 *  en Reportes, etc.). */
export function hayComisiones(c: ConfigComisiones | null | undefined): boolean {
  if (!c) return false;
  const n = normalizarConfigComisiones(c);
  if (!n.roles.some((r) => r.cargo?.trim())) return false;
  if (n.modalidad === "metas")
    return n.metas.some((m) => Number(m.valor) > 0 && Number(m.bonificacion) > 0);
  if (n.tipo_venta === "escalonada")
    return n.tramos.some((t) => Number(t.porcentaje) > 0);
  return n.roles.some((r) => Number(r.porcentaje) > 0);
}

export function esCargoComisionable(
  c: ConfigComisiones | null | undefined,
  cargo: string
): boolean {
  return Boolean(
    c?.roles?.some(
      (r) => r.cargo.trim().toLowerCase() === cargo.trim().toLowerCase()
    )
  );
}

/**
 * % que corresponde a UNA venta según la configuración vigente
 * (se congela en la factura al asignar el vendedor):
 *   · venta directa → el % del cargo.
 *   · escalonada por monto → el tramo más alto que alcance el
 *     monto de esa venta.
 *   · escalonada por cantidad → el tramo más alto que alcance el
 *     número de venta del vendedor en el período de cierre
 *     (numeroVenta: esta venta es la nº N del período).
 *   · metas → null (no hay % por venta; solo bonificaciones).
 */
export function porcentajeParaVenta(
  c: ConfigComisiones | null | undefined,
  cargo: string,
  monto: number,
  numeroVenta?: number
): number | null {
  const n = normalizarConfigComisiones(c);
  if (!esCargoComisionable(c, cargo)) return null;
  if (n.modalidad === "metas") return null;

  if (n.tipo_venta === "escalonada") {
    const base = n.escala === "cantidad" ? Number(numeroVenta ?? 1) : Number(monto);
    const tramo = n.tramos
      .filter((t) => Number(t.porcentaje) > 0 && base >= Number(t.desde))
      .sort((a, b) => Number(a.desde) - Number(b.desde))
      .pop();
    return tramo ? Number(tramo.porcentaje) : null;
  }

  const rol = n.roles.find(
    (r) => r.cargo.trim().toLowerCase() === cargo.trim().toLowerCase()
  );
  const pct = Number(rol?.porcentaje);
  return Number.isFinite(pct) && pct > 0 ? pct : null;
}

/** Comisión de una venta con su % congelado, redondeada a centavos */
export function comisionDeFactura(f: {
  monto: number;
  comision_porcentaje: number | null;
}): number {
  return Math.round(Number(f.monto) * (Number(f.comision_porcentaje) || 0)) / 100;
}

// ===== FECHAS DE PERÍODOS Y PAGOS =====

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Período VIGENTE de una meta (donde se mide su progreso hoy):
 * semanal = lunes a domingo de esta semana; quincenal = 1–15 o
 * 16–fin de mes; mensual = el mes completo.
 */
export function periodoVigente(
  periodo: FrecuenciaPago,
  hoy: string = hoyISO()
): { desde: string; hasta: string } {
  const d = new Date(hoy + "T00:00:00Z");
  if (periodo === "semanal") {
    const desdeLunes = (d.getUTCDay() + 6) % 7; // lunes = 0
    const desde = new Date(d);
    desde.setUTCDate(d.getUTCDate() - desdeLunes);
    const hasta = new Date(desde);
    hasta.setUTCDate(desde.getUTCDate() + 6);
    return { desde: iso(desde), hasta: iso(hasta) };
  }
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const mes = `${y}-${String(m + 1).padStart(2, "0")}`;
  const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  if (periodo === "quincenal") {
    return d.getUTCDate() <= 15
      ? { desde: `${mes}-01`, hasta: `${mes}-15` }
      : { desde: `${mes}-16`, hasta: `${mes}-${ultimo}` };
  }
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

/**
 * Período de CIERRE de nómina que contiene una fecha: mes,
 * trimestre, semestre o año calendario. Aquí se cuenta la
 * "venta nº N" de la escalonada por cantidad y se aplican los
 * cambios de método programados.
 */
export function periodoCierre(
  cierre: CierreNomina | undefined,
  fecha: string
): { desde: string; hasta: string } {
  const y = Number(fecha.slice(0, 4));
  const m = Number(fecha.slice(5, 7)); // 1-12
  const tam =
    cierre === "anual" ? 12 : cierre === "semestral" ? 6 : cierre === "trimestral" ? 3 : 1;
  const mesInicio = Math.floor((m - 1) / tam) * tam + 1; // 1-based
  const mesFin = mesInicio + tam - 1;
  const ultimo = new Date(Date.UTC(y, mesFin, 0)).getUTCDate();
  return {
    desde: `${y}-${String(mesInicio).padStart(2, "0")}-01`,
    hasta: `${y}-${String(mesFin).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`,
  };
}

/** Fecha del próximo cierre de nómina (fin del período actual) */
export function proximoCierre(
  cierre: CierreNomina | undefined,
  hoy: string = hoyISO()
): string {
  return periodoCierre(cierre, hoy).hasta;
}

/** Próxima fecha de pago de nómina según la configuración (o null) */
export function proximoPagoNomina(
  config: ConfigNomina | null | undefined,
  hoy: string = hoyISO()
): string | null {
  const dias = (config?.dias ?? []).filter((n) => Number.isInteger(n));
  if (!config?.frecuencia || dias.length === 0) return null;
  const base = new Date(hoy + "T00:00:00Z");

  if (config.frecuencia === "semanal") {
    for (let i = 0; i <= 7; i++) {
      const d = new Date(base);
      d.setUTCDate(base.getUTCDate() + i);
      if (dias.includes(d.getUTCDay())) return iso(d);
    }
    return null;
  }

  // Quincenal/mensual: días del mes; el día 31 en un mes corto se
  // ajusta al último día real (igual que los pagos recurrentes).
  for (let i = 0; i <= 62; i++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    const ultimo = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
    ).getUTCDate();
    if (dias.some((dia) => Math.min(dia, ultimo) === d.getUTCDate())) return iso(d);
  }
  return null;
}

/** Salario aproximado que toca pagar en UN día de pago */
export function salarioPorPago(
  frecuencia: FrecuenciaPago,
  salarioMensualTotal: number
): number {
  if (frecuencia === "quincenal") return salarioMensualTotal / 2;
  if (frecuencia === "semanal") return salarioMensualTotal / 4;
  return salarioMensualTotal;
}

// ===== ALERTA DE NÓMINA PRÓXIMA (campana del topbar) =====

/**
 * Cuando el día de pago configurado está a 3 días o menos, avisa
 * cuánto toca pagar: salarios del período + comisiones pendientes.
 * Sin empleados activos ni comisiones no se genera nada.
 */
export function generarAlertaNomina(
  config: ConfigNomina | null | undefined,
  empleados: EmpleadoDB[],
  comisionesPendientes: number,
  hoy: string = hoyISO()
): Alerta | null {
  const fechaPago = proximoPagoNomina(config, hoy);
  if (!config || !fechaPago) return null;

  const dias = diasHasta(fechaPago, hoy);
  if (dias < 0 || dias > 3) return null;

  const totalMensual = empleados
    .filter((e) => e.activo)
    .reduce((s, e) => s + Number(e.salario_mensual), 0);
  const salarios = salarioPorPago(config.frecuencia, totalMensual);
  if (salarios <= 0 && comisionesPendientes <= 0) return null;

  const partes: string[] = [];
  if (salarios > 0) partes.push(`aprox. ${fmt(salarios)} en salarios`);
  if (comisionesPendientes > 0)
    partes.push(`${fmt(comisionesPendientes)} en comisiones pendientes`);

  return {
    id: `nomina-${fechaPago}`,
    facturaId: "",
    href: comisionesPendientes > 0 ? "/reportes/comisiones" : "/configuracion",
    nivel: dias <= 1 ? "media" : "suave",
    titulo:
      dias === 0
        ? "Hoy toca pagar la nómina"
        : dias === 1
          ? "Mañana toca pagar la nómina"
          : `Se acerca el pago de nómina (${formatearFecha(fechaPago)})`,
    detalle: `Debes ${partes.join(" + ")}.`,
    icono: "payments",
  };
}
