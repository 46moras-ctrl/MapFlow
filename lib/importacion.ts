// ============================================================
// IMPORTACIÓN DE FACTURAS — helpers puros compartidos por el
// modal de Ajustes (cliente) y las acciones de servidor
// (archivo Excel/CSV y Google Sheets).
// ============================================================

// Campos de MapFlow a los que se mapean las columnas del usuario
export const CAMPOS_MAPFLOW = [
  { id: "contacto", label: "Contacto (cliente/proveedor)", requerido: true },
  { id: "monto", label: "Monto", requerido: true },
  { id: "numero_factura", label: "Nº de factura", requerido: false },
  { id: "fecha_emision", label: "Fecha de emisión", requerido: false },
  { id: "fecha_vencimiento", label: "Fecha de vencimiento", requerido: false },
  { id: "concepto", label: "Concepto", requerido: false },
  { id: "tipo", label: "Tipo (cobro/pago)", requerido: false },
  { id: "estado", label: "Estado", requerido: false },
  { id: "medio_pago", label: "Medio de pago", requerido: false },
  { id: "vendedor", label: "Vendedor (comisiones)", requerido: false },
] as const;

// Campos extra del usuario ("Anexar campo"): columnas de SU archivo
// que no existen en MapFlow y se guardan dentro del concepto.
export interface CampoExtra {
  etiqueta: string;
  columna: string;
}

export type CampoMapFlow = (typeof CAMPOS_MAPFLOW)[number]["id"];

// columna del archivo elegida para cada campo ("" = sin mapear)
export type Mapeo = Partial<Record<CampoMapFlow, string>>;

// Una fila del archivo ya traducida a campos de MapFlow (crudos)
export type FilaCruda = Partial<Record<CampoMapFlow, string>> & {
  extras?: Record<string, string>;
};

// Fila lista para insertar en la tabla facturas
export interface FilaNormalizada {
  numero_factura: string | null;
  cliente: string;
  monto: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  concepto: string | null;
  tipo: "cobrar" | "pagar";
  estado: "pendiente" | "pagado" | "vencido";
  medio_pago: "transferencia" | "tarjeta" | "efectivo" | "credito" | null;
  // Nombre del vendedor tal como viene en el archivo; el servidor
  // lo cruza con los empleados comisionables para asignar comisión
  vendedor: string | null;
}

/** Autodetecta el mapeo por nombres obvios de columnas */
export function autoMapear(encabezados: string[]): Mapeo {
  const patrones: [CampoMapFlow, RegExp][] = [
    ["fecha_vencimiento", /venc/i],
    ["fecha_emision", /emisi|emitid|^fecha$|creaci/i],
    ["numero_factura", /n[°ºo]?\s*\.?\s*factura|n[uú]mero|referencia/i],
    ["contacto", /cliente|contacto|proveedor|nombre|tercero/i],
    ["monto", /monto|valor|total|importe|precio/i],
    ["concepto", /concepto|descrip|detalle|observaci/i],
    ["tipo", /^tipo/i],
    ["estado", /estado|status/i],
    ["medio_pago", /medio|m[eé]todo/i],
    ["vendedor", /vendedor|vende|comisiona/i],
  ];
  const mapeo: Mapeo = {};
  const usadas = new Set<string>();
  for (const [campo, patron] of patrones) {
    const col = encabezados.find((e) => !usadas.has(e) && patron.test(e));
    if (col) {
      mapeo[campo] = col;
      usadas.add(col);
    }
  }
  return mapeo;
}

/** '$ 1.234,56' / '1,234.56' / '1500' → número (o null si no se puede) */
export function parsearMonto(crudo: string | undefined): number | null {
  if (!crudo) return null;
  let s = String(crudo).replace(/[^\d.,-]/g, "").trim();
  if (!s) return null;
  const ultimaComa = s.lastIndexOf(",");
  const ultimoPunto = s.lastIndexOf(".");
  if (ultimaComa > -1 && ultimoPunto > -1) {
    // El separador que aparece de último es el decimal
    if (ultimaComa > ultimoPunto) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (ultimaComa > -1) {
    const decimales = s.length - ultimaComa - 1;
    s = decimales <= 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** ¿Es una fecha REAL del calendario? (rechaza mes 13, día 45, etc.) */
function fechaValida(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const fecha = new Date(Date.UTC(y, m - 1, d));
  return (
    fecha.getUTCFullYear() === y &&
    fecha.getUTCMonth() === m - 1 &&
    fecha.getUTCDate() === d
  );
}

/**
 * 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY' → 'YYYY-MM-DD' (o null).
 * Una fecha imposible (ej. "2027-13-45") devuelve null: la
 * importación es tolerante y usará la fecha de respaldo en su lugar.
 */
export function parsearFecha(cruda: string | undefined): string | null {
  if (!cruda) return null;
  const s = String(cruda).trim().slice(0, 10);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) {
    const [y, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (!fechaValida(y, mes, d)) return null;
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s);
  if (m) {
    // Se asume día/mes/año (formato hispano)
    const [d, mes, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (!fechaValida(y, mes, d)) return null;
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

/** Parser CSV mínimo con soporte de comillas (sirve en cliente y servidor) */
export function parsearCSV(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') enComillas = false;
      else celda += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda);
      celda = "";
      if (fila.some((x) => x.trim() !== "")) filas.push(fila);
      fila = [];
    } else celda += c;
  }
  fila.push(celda);
  if (fila.some((x) => x.trim() !== "")) filas.push(fila);
  return filas;
}

/** Matriz (encabezados + filas) + mapeo → filas crudas de MapFlow */
export function aplicarMapeo(
  encabezados: string[],
  filas: string[][],
  mapeo: Mapeo,
  extras: CampoExtra[] = []
): FilaCruda[] {
  const indice: Partial<Record<CampoMapFlow, number>> = {};
  for (const campo of Object.keys(mapeo) as CampoMapFlow[]) {
    const col = mapeo[campo];
    if (!col) continue;
    const i = encabezados.indexOf(col);
    if (i >= 0) indice[campo] = i;
  }
  const indicesExtra = extras
    .map((e) => ({ etiqueta: e.etiqueta.trim(), i: encabezados.indexOf(e.columna) }))
    .filter((e) => e.etiqueta && e.i >= 0);

  return filas.map((f) => {
    const cruda: FilaCruda = {};
    for (const campo of Object.keys(indice) as CampoMapFlow[]) {
      cruda[campo] = String(f[indice[campo]!] ?? "").trim();
    }
    if (indicesExtra.length > 0) {
      cruda.extras = {};
      for (const e of indicesExtra) {
        const valor = String(f[e.i] ?? "").trim();
        if (valor) cruda.extras[e.etiqueta] = valor;
      }
    }
    return cruda;
  });
}

/**
 * Fila cruda → fila lista para la tabla facturas, con las reglas
 * de importación: entra PAGADA salvo que el archivo diga otra
 * cosa; sin vencimiento se usa la emisión. Devuelve null si la
 * fila no tiene contacto o monto válidos.
 */
export function normalizarFila(
  cruda: FilaCruda,
  hoy: string
): FilaNormalizada | null {
  const cliente = cruda.contacto?.trim();
  const monto = parsearMonto(cruda.monto);
  if (!cliente || !monto) return null;

  const emision = parsearFecha(cruda.fecha_emision) ?? hoy;
  const vencimiento = parsearFecha(cruda.fecha_vencimiento) ?? emision;

  const tipoCrudo = (cruda.tipo ?? "").toLowerCase();
  const tipo: FilaNormalizada["tipo"] = /pag|gast|egres|prove/.test(tipoCrudo)
    ? "pagar"
    : "cobrar";

  const estadoCrudo = (cruda.estado ?? "").toLowerCase();
  let estado: FilaNormalizada["estado"] = /pend|abiert|debe/.test(estadoCrudo)
    ? "pendiente"
    : /venc|mora/.test(estadoCrudo)
      ? "vencido"
      : "pagado"; // regla: todo entra pagado salvo indicación contraria
  // "Pendiente" con la fecha ya pasada es, en la práctica, vencida
  if (estado === "pendiente" && vencimiento < hoy) estado = "vencido";

  const medioCrudo = (cruda.medio_pago ?? "").toLowerCase();
  const medio: FilaNormalizada["medio_pago"] = /transf|consig|nequi|davipl/.test(medioCrudo)
    ? "transferencia"
    : /tarj|datáf|dataf/.test(medioCrudo)
      ? "tarjeta"
      : /efect|cash|contado/.test(medioCrudo)
        ? "efectivo"
        : /cr[eé]d/.test(medioCrudo)
          ? "credito"
          : null;

  // Los campos anexados por el usuario viajan dentro del concepto,
  // visibles en el detalle de la factura: "Bodega: A1 · Vendedor: Juan"
  const extras = Object.entries(cruda.extras ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
  const concepto =
    [cruda.concepto?.trim(), extras].filter(Boolean).join(" · ") || null;

  return {
    numero_factura: cruda.numero_factura?.trim() || null,
    cliente,
    monto,
    fecha_emision: emision,
    fecha_vencimiento: vencimiento,
    concepto,
    tipo,
    estado,
    medio_pago: medio,
    vendedor: cruda.vendedor?.trim() || null,
  };
}

/** Clave anti-duplicación: contacto + monto + fecha de emisión */
export function claveDuplicado(f: {
  cliente: string;
  monto: number;
  fecha_emision: string;
}): string {
  return `${f.cliente
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()}|${Number(f.monto)}|${f.fecha_emision}`;
}
