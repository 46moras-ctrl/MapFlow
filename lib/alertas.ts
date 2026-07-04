import {
  diasHasta,
  formatearFecha,
  hoyISO,
  type FacturaDB,
} from "@/lib/facturas";

// Niveles: los de PAGAR son llamativos y escalonados; los de COBRAR
// son informativos, para distinguirlos de un vistazo.
export type NivelAlerta = "urgente" | "media" | "suave" | "info";

export interface Alerta {
  id: string;
  facturaId: string;
  nivel: NivelAlerta;
  titulo: string;
  detalle: string;
  icono: string;
}

const ORDEN: Record<NivelAlerta, number> = {
  urgente: 0,
  media: 1,
  suave: 2,
  info: 3,
};

type FacturaAlerta = Pick<
  FacturaDB,
  | "id"
  | "numero_factura"
  | "cliente"
  | "concepto"
  | "fecha_vencimiento"
  | "estado"
  | "tipo"
>;

export function generarAlertas(
  facturas: FacturaAlerta[],
  hoy: string = hoyISO()
): Alerta[] {
  const alertas: (Alerta & { orden: number })[] = [];

  for (const f of facturas) {
    if (f.estado === "pagado" || !f.fecha_vencimiento) continue;
    const dias = diasHasta(f.fecha_vencimiento, hoy);
    const nombre = f.concepto?.trim() || f.numero_factura;
    const tipo = f.tipo ?? "cobrar";

    if (tipo === "pagar") {
      // === CUENTAS POR PAGAR: escalonadas y llamativas ===
      if (dias < 0) {
        alertas.push({
          id: `pagar-vencida-${f.id}`,
          facturaId: f.id,
          nivel: "urgente",
          titulo: `Pago vencido: ${nombre}`,
          detalle:
            dias === -1
              ? "Venció ayer. Gestiónalo ahora."
              : `Venció hace ${-dias} días. Gestiónalo ahora.`,
          icono: "error",
          orden: dias,
        });
      } else if (dias <= 2) {
        alertas.push({
          id: `pagar-proxima-${f.id}`,
          facturaId: f.id,
          nivel: "media",
          titulo: `Pago próximo: ${nombre}`,
          detalle:
            dias === 0
              ? "Vence hoy."
              : dias === 1
                ? "Vence mañana."
                : "Vence en 2 días.",
          icono: "schedule",
          orden: dias,
        });
      } else if (dias <= 5) {
        alertas.push({
          id: `pagar-cerca-${f.id}`,
          facturaId: f.id,
          nivel: "suave",
          titulo: `Se acerca un pago: ${nombre}`,
          detalle: `Vence el ${formatearFecha(f.fecha_vencimiento)} (${f.cliente}).`,
          icono: "event_upcoming",
          orden: dias,
        });
      }
    } else {
      // === CUENTAS POR COBRAR: informativas y suaves ===
      if (dias < 0) {
        alertas.push({
          id: `cobrar-mora-${f.id}`,
          facturaId: f.id,
          nivel: "info",
          titulo: `${f.cliente} tiene ${-dias} día${dias === -1 ? "" : "s"} de mora`,
          detalle: `${f.numero_factura} · toca para ver el contacto y gestionar el cobro.`,
          icono: "hourglass_bottom",
          orden: dias,
        });
      } else if (dias <= 2) {
        alertas.push({
          id: `cobrar-porvencer-${f.id}`,
          facturaId: f.id,
          nivel: "info",
          titulo:
            dias === 0
              ? `${f.cliente} debe pagarte hoy`
              : dias === 1
                ? `${f.cliente} debe pagarte mañana`
                : `${f.cliente} debe pagarte en 2 días`,
          detalle: `${f.numero_factura} · vence el ${formatearFecha(f.fecha_vencimiento)}.`,
          icono: "notifications",
          orden: dias,
        });
      }
    }
  }

  return alertas
    .sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel] || a.orden - b.orden)
    .map((a) => ({
      id: a.id,
      facturaId: a.facturaId,
      nivel: a.nivel,
      titulo: a.titulo,
      detalle: a.detalle,
      icono: a.icono,
    }));
}
