// Helpers puros de finanzas, compartidos por Dashboard (server),
// Reportes (cliente) y Ventas: filas unificadas de dinero y
// agrupación mensual para la gráfica de flujo de caja.

export interface FilaDinero {
  id: string;
  fecha: string; // YYYY-MM-DD
  monto: number;
  esIngreso: boolean;
  contraparte: string;
  categoria: string;
}

export interface PuntoFlujo {
  ym: string; // YYYY-MM
  etiqueta: string; // "Jul"
  ingresos: number;
  egresos: number;
  presupuesto: number;
  deudas: number;
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function etiquetaMes(ym: string): string {
  const [, m] = ym.split("-");
  return MESES[Number(m) - 1] ?? ym;
}

/** Los últimos n meses terminando en `hasta` (YYYY-MM-DD), como YYYY-MM */
export function ultimosMeses(n: number, hasta: string): string[] {
  const [y, m] = hasta.split("-").map(Number);
  const meses: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const total = (m - 1) - i;
    const yy = y + Math.floor(total / 12);
    const mm = ((total % 12) + 12) % 12;
    meses.push(`${yy}-${String(mm + 1).padStart(2, "0")}`);
  }
  return meses;
}

/** Meses (YYYY-MM) entre dos fechas ISO, inclusive; tope de seguridad 36 */
export function mesesEntre(desde: string, hasta: string): string[] {
  const meses: string[] = [];
  let [y, m] = desde.slice(0, 7).split("-").map(Number);
  const fin = hasta.slice(0, 7);
  while (meses.length < 36) {
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    meses.push(ym);
    if (ym === fin) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return meses;
}

/**
 * Agrupa por mes: ingresos/egresos desde las filas de dinero,
 * deudas por su fecha de vencimiento y el presupuesto mensual
 * como referencia constante.
 */
export function construirFlujo(
  meses: string[],
  filas: FilaDinero[],
  deudas: { fecha: string | null; monto: number }[],
  presupuestoMensual: number
): PuntoFlujo[] {
  return meses.map((ym) => {
    const delMes = filas.filter((f) => f.fecha.startsWith(ym));
    return {
      ym,
      etiqueta: etiquetaMes(ym),
      ingresos: delMes.filter((f) => f.esIngreso).reduce((s, f) => s + f.monto, 0),
      egresos: delMes.filter((f) => !f.esIngreso).reduce((s, f) => s + f.monto, 0),
      presupuesto: presupuestoMensual,
      deudas: deudas
        .filter((d) => (d.fecha ?? "").startsWith(ym))
        .reduce((s, d) => s + Number(d.monto), 0),
    };
  });
}
