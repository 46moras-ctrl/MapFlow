// Tipos y helpers para facturas reales de Supabase

import { formatearMoneda } from "@/lib/moneda";

export type TipoFactura = "cobrar" | "pagar";
export type MedioPago = "transferencia" | "tarjeta" | "efectivo" | "credito";

export interface FacturaDB {
  id: string;
  id_empresa: string;
  numero_factura: string;
  cliente: string; // contraparte: cliente (cobrar) o proveedor (pagar)
  monto: number;
  fecha_emision: string; // YYYY-MM-DD
  fecha_vencimiento: string | null;
  estado: "pendiente" | "pagado" | "vencido";
  concepto: string | null;
  tipo: TipoFactura;
  medio_pago_previsto: MedioPago | null;
  medio_pago: MedioPago | null;
  es_recurrente: boolean;
  dia_recurrencia: number | null;
  id_factura_origen: string | null;
  id_contacto: string | null; // libreta de contactos (tabla contactos)
  // Comisiones (migracion_nomina.sql): vendedor asignado a la venta
  // y % CONGELADO al momento de asignarlo (cambios futuros del %
  // del rol no tocan el historial).
  id_vendedor: string | null;
  comision_porcentaje: number | null;
  comision_liquidada: boolean;
  id_liquidacion: string | null;
  created_at: string;
}

// Fila de la tabla contactos (libreta de clientes/proveedores)
export interface ContactoDB {
  id: string;
  id_empresa: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  tipo: "cliente" | "proveedor" | null;
  created_at: string;
}

// Configuración de la empresa que usan Ajustes y el agente.
// Los campos son opcionales porque algunos nacen en migraciones
// que pueden no estar aplicadas aún (la app no debe romperse).
export interface ConfigEmpresa {
  email_dueno?: string | null;
  telefono_dueno?: string | null;
  recordatorios_pagos_activo?: boolean;
  recordatorios_pagos_canal?: "whatsapp" | "email" | "ambos";
  recordatorios_cobros_canal?: "whatsapp" | "email" | "ambos";
}

export interface DatosFactura {
  numero_factura: string;
  cliente: string;
  monto: number;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  concepto: string | null;
  tipo: TipoFactura;
  medio_pago_previsto?: MedioPago | null;
  es_recurrente?: boolean;
  dia_recurrencia?: number | null;
  estado?: "pendiente" | "pagado" | "vencido";
  // Contacto del cliente/proveedor: si vienen, se crea o actualiza
  // el contacto en la libreta y se vincula a la factura.
  telefono_contacto?: string | null;
  email_contacto?: string | null;
  // Vendedor que hizo la venta (solo cobros, si hay roles
  // comisionables configurados). "" o null = sin comisión.
  id_vendedor?: string | null;
}

export type EstadoVisual = "pagada" | "vencida" | "por_vencer" | "pendiente";

export const MEDIOS_COBRO: MedioPago[] = ["efectivo", "transferencia", "tarjeta"];
export const MEDIOS_PAGO: MedioPago[] = ["transferencia", "tarjeta", "efectivo", "credito"];

export const ETIQUETA_MEDIO: Record<MedioPago, string> = {
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  credito: "Crédito",
};

export const ICONO_MEDIO: Record<MedioPago, string> = {
  transferencia: "account_balance",
  tarjeta: "credit_card",
  efectivo: "payments",
  credito: "credit_score",
};

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Días entre hoy y una fecha (negativo = ya pasó) */
export function diasHasta(fecha: string, hoy: string = hoyISO()): number {
  return Math.round((Date.parse(fecha) - Date.parse(hoy)) / 86400000);
}

/**
 * Estado que se muestra en la interfaz, derivado del estado guardado
 * y de la fecha de vencimiento:
 *  - pagado            → PAGADA
 *  - vencido (o fecha ya pasada) → VENCIDA
 *  - vence en ≤ 7 días → POR VENCER
 *  - resto             → PENDIENTE
 */
export function estadoVisual(
  f: Pick<FacturaDB, "estado" | "fecha_vencimiento">,
  hoy: string = hoyISO()
): EstadoVisual {
  if (f.estado === "pagado") return "pagada";
  if (f.estado === "vencido") return "vencida";
  if (!f.fecha_vencimiento) return "pendiente";
  if (f.fecha_vencimiento < hoy) return "vencida";
  return diasHasta(f.fecha_vencimiento, hoy) <= 7 ? "por_vencer" : "pendiente";
}

export function diasDeMora(
  f: Pick<FacturaDB, "estado" | "fecha_vencimiento">,
  hoy: string = hoyISO()
): number {
  if (f.estado === "pagado" || !f.fecha_vencimiento) return 0;
  return Math.max(0, -diasHasta(f.fecha_vencimiento, hoy));
}

/**
 * Próximo vencimiento de un pago recurrente: mismo día pero del mes
 * siguiente a "desde" (con ajuste si el mes es más corto, ej. día 31).
 */
export function proximaFechaRecurrente(dia: number, desde: string): string {
  const [y, m] = desde.split("-").map(Number);
  let ny = y;
  let nm = m + 1;
  if (nm > 12) {
    nm = 1;
    ny++;
  }
  const ultimoDia = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const d = Math.min(dia, ultimoDia);
  return `${ny}-${String(nm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Suma N meses a una fecha ISO conservando el día (con ajuste de mes corto) */
export function sumarMeses(fecha: string, meses: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const total = (m - 1) + meses;
  const ny = y + Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const ultimoDia = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, ultimoDia)).padStart(2, "0")}`;
}

const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/** '2026-06-18' → '18 Jun 2026' (sin problemas de zona horaria) */
export function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  const mes = MESES[Number(m) - 1] ?? m;
  return `${Number(d)} ${mes} ${a}`;
}

/**
 * Formato de moneda determinista (mismo resultado en server y
 * cliente). Usa la moneda elegida en Perfil → Datos de la empresa;
 * sin moneda configurada mantiene el formato histórico ($1,234.56).
 */
export function fmt(n: number): string {
  return formatearMoneda(n);
}
