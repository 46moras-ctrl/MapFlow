// Tipos y helpers del PLAN DE COBRO/PAGO (tabla planes_pago).
// Lo crea el cuadro modal compartido (Facturas y Pendientes) y
// lo lista la pantalla Pendientes.

export type TipoPlan = "cobro" | "pago";
export type EstadoPlan = "activo" | "completado" | "cancelado";
export type MetodoPlan = "transferencia" | "tarjeta" | "efectivo" | "otro";

export interface PlanPagoDB {
  id: string;
  id_empresa: string;
  id_factura: string;
  tipo: TipoPlan;
  cuotas: number;
  fechas_pago: string[]; // YYYY-MM-DD
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_email: string | null;
  metodo_pago: MetodoPlan | null;
  detalle_metodo: string | null;
  destino_envio: "empresa" | "contacto";
  estado: EstadoPlan;
  created_at: string;
}

// Lo que envía el modal al guardar
export interface DatosPlanPago {
  id_factura: string;
  tipo: TipoPlan;
  cuotas: number;
  fechas_pago: string[];
  contacto_nombre?: string | null;
  contacto_telefono?: string | null;
  contacto_email?: string | null;
  metodo_pago?: MetodoPlan | null;
  detalle_metodo?: string | null;
  destino_envio?: "empresa" | "contacto";
}

export const ETIQUETA_ESTADO_PLAN: Record<EstadoPlan, string> = {
  activo: "Activo",
  completado: "Completado",
  cancelado: "Cancelado",
};

export const ETIQUETA_METODO_PLAN: Record<MetodoPlan, string> = {
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  otro: "Otro",
};
