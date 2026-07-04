// Datos de ejemplo para el cascarón navegable de MapFlow.
// Se reemplazarán por consultas a Supabase en la siguiente fase.

export type EstadoFactura = "vencida" | "por_vencer" | "pendiente" | "pagada";

export interface Factura {
  id: string;
  cliente: string;
  monto: number;
  emision: string;
  vencimiento: string;
  estado: EstadoFactura;
  diasMora?: number;
  concepto: string;
  contacto: string;
}

// Formato de moneda determinista (mismo resultado en server y cliente)
export function fmt(n: number): string {
  return "$" + n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export const facturas: Factura[] = [
  {
    id: "FAC-2023-001",
    cliente: "Tech Solutions S.A.",
    monto: 8200,
    emision: "01 Jun 2026",
    vencimiento: "18 Jun 2026",
    estado: "vencida",
    diasMora: 15,
    concepto: "Desarrollo e implementación de módulo de inventario",
    contacto: "+52 55 1234 5678",
  },
  {
    id: "FAC-001",
    cliente: "EcoTech Soluciones",
    monto: 24500,
    emision: "05 May 2026",
    vencimiento: "05 Jun 2026",
    estado: "vencida",
    diasMora: 28,
    concepto: "Consultoría en eficiencia energética — Fase 2",
    contacto: "+52 55 8765 4321",
  },
  {
    id: "FAC-012",
    cliente: "Nova Logística",
    monto: 15200,
    emision: "15 Jun 2026",
    vencimiento: "08 Jul 2026",
    estado: "por_vencer",
    concepto: "Servicio de distribución regional junio",
    contacto: "+52 33 1122 3344",
  },
  {
    id: "FAC-998",
    cliente: "Urban Design Studio",
    monto: 8400,
    emision: "02 Jun 2026",
    vencimiento: "22 Jun 2026",
    estado: "pagada",
    concepto: "Rediseño de identidad y materiales impresos",
    contacto: "+52 81 9988 7766",
  },
  {
    id: "FAC-005",
    cliente: "Global Consulting",
    monto: 17600,
    emision: "10 May 2026",
    vencimiento: "10 Jun 2026",
    estado: "vencida",
    diasMora: 23,
    concepto: "Auditoría de procesos operativos",
    contacto: "+52 55 4455 6677",
  },
  {
    id: "FAC-021",
    cliente: "Café Andino",
    monto: 5900,
    emision: "25 Jun 2026",
    vencimiento: "25 Jul 2026",
    estado: "pendiente",
    concepto: "Suministro mensual de empaques",
    contacto: "+52 55 2233 4455",
  },
  {
    id: "FAC-019",
    cliente: "Distribuidora Rivera",
    monto: 12750,
    emision: "20 Jun 2026",
    vencimiento: "20 Jul 2026",
    estado: "pendiente",
    concepto: "Pedido mayorista #4482",
    contacto: "+52 33 5566 7788",
  },
  {
    id: "FAC-016",
    cliente: "Hotel Mirador",
    monto: 9300,
    emision: "28 May 2026",
    vencimiento: "15 Jun 2026",
    estado: "pagada",
    concepto: "Servicio de catering evento corporativo",
    contacto: "+52 81 3344 5566",
  },
];

export const kpisDashboard = {
  totalPorCobrar: 125400,
  totalVencido: 42100,
  ingresosMes: 86300,
  egresosMes: 35200,
};

// Flujo de caja Ene–Jun (para línea de saldo y barras ingresos/egresos)
export const flujoCaja = [
  { mes: "Ene", ingresos: 52400, egresos: 39100 },
  { mes: "Feb", ingresos: 61200, egresos: 42300 },
  { mes: "Mar", ingresos: 58100, egresos: 42800 },
  { mes: "Abr", ingresos: 72600, egresos: 48500 },
  { mes: "May", ingresos: 66900, egresos: 47100 },
  { mes: "Jun", ingresos: 86300, egresos: 35200 },
];

export interface Egreso {
  fecha: string;
  concepto: string;
  categoria: string;
  proveedor: string;
  monto: number;
  origen: "csv" | "web" | "whatsapp";
}

export const egresos: Egreso[] = [
  { fecha: "12 Jun 2026", concepto: "Nómina quincenal", categoria: "Nómina", proveedor: "Interno", monto: 12450, origen: "csv" },
  { fecha: "10 Jun 2026", concepto: "Harina e insumos", categoria: "Suministros", proveedor: "Molinos del Sur", monto: 1200, origen: "web" },
  { fecha: "08 Jun 2026", concepto: "Hosting y servicios AWS", categoria: "Software", proveedor: "Amazon Web Services", monto: 4820, origen: "whatsapp" },
  { fecha: "05 Jun 2026", concepto: "Renta del local", categoria: "Renta", proveedor: "Inmobiliaria Centro", monto: 8500, origen: "web" },
  { fecha: "03 Jun 2026", concepto: "Campaña publicitaria", categoria: "Marketing", proveedor: "Meta Ads", monto: 2100, origen: "csv" },
  { fecha: "01 Jun 2026", concepto: "Electricidad", categoria: "Servicios", proveedor: "CFE", monto: 1730, origen: "web" },
];

// Distribución de gasto por categoría (suma = egresos del mes)
export const categoriasGasto = [
  { nombre: "Nómina", monto: 14080, pct: 40, color: "#4E6544" },
  { nombre: "Suministros", monto: 8800, pct: 25, color: "#B7D1A9" },
  { nombre: "Software", monto: 7040, pct: 20, color: "#7B5264" },
  { nombre: "Otros", monto: 5280, pct: 15, color: "#74796F" },
];

export interface Recordatorio {
  fecha: string;
  canal: "Email" | "WhatsApp";
  tono: "AMABLE" | "FIRME";
  estado: "Respondido" | "Enviado" | "Programado";
}

export const recordatoriosFactura: Recordatorio[] = [
  { fecha: "28 Jun 2026", canal: "Email", tono: "AMABLE", estado: "Respondido" },
  { fecha: "22 Jun 2026", canal: "WhatsApp", tono: "AMABLE", estado: "Enviado" },
  { fecha: "19 Jun 2026", canal: "WhatsApp", tono: "FIRME", estado: "Enviado" },
];

export interface Presupuesto {
  categoria: string;
  tope: number;
  gastado: number;
  periodo: string;
  alertaPct: number;
}

export const presupuestos: Presupuesto[] = [
  { categoria: "Nómina", tope: 15000, gastado: 14080, periodo: "Mensual", alertaPct: 80 },
  { categoria: "Suministros", tope: 12000, gastado: 8800, periodo: "Mensual", alertaPct: 80 },
  { categoria: "Renta", tope: 9000, gastado: 8500, periodo: "Mensual", alertaPct: 90 },
  { categoria: "Software", tope: 8000, gastado: 7040, periodo: "Mensual", alertaPct: 80 },
  { categoria: "Marketing", tope: 4000, gastado: 2100, periodo: "Mensual", alertaPct: 75 },
  { categoria: "Servicios", tope: 3000, gastado: 1730, periodo: "Mensual", alertaPct: 80 },
];

export function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
