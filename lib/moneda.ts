// ============================================================
// MONEDA DE LA EMPRESA — la moneda elegida en Perfil → Datos de
// la empresa formatea TODOS los montos de la plataforma.
// No hay conversión de divisas: cada empresa maneja UNA moneda
// y solo cambia el símbolo y los separadores.
// ============================================================

export interface Moneda {
  codigo: string;
  nombre: string;
  simbolo: string;
  miles: string; // separador de miles
  decimal: string; // separador decimal
  decimales: number;
}

// Sin moneda configurada se usa exactamente el formato histórico
// de MapFlow ($1,234.56), para no alterar nada a quien no elija.
const POR_DEFECTO: Moneda = {
  codigo: "",
  nombre: "Sin definir",
  simbolo: "$",
  miles: ",",
  decimal: ".",
  decimales: 2,
};

export const MONEDAS: Moneda[] = [
  { codigo: "COP", nombre: "Peso colombiano", simbolo: "$", miles: ".", decimal: ",", decimales: 0 },
  { codigo: "USD", nombre: "Dólar estadounidense", simbolo: "$", miles: ",", decimal: ".", decimales: 2 },
  { codigo: "EUR", nombre: "Euro", simbolo: "€", miles: ".", decimal: ",", decimales: 2 },
  { codigo: "MXN", nombre: "Peso mexicano", simbolo: "$", miles: ",", decimal: ".", decimales: 2 },
  { codigo: "ARS", nombre: "Peso argentino", simbolo: "$", miles: ".", decimal: ",", decimales: 2 },
  { codigo: "PEN", nombre: "Sol peruano", simbolo: "S/ ", miles: ",", decimal: ".", decimales: 2 },
  { codigo: "CLP", nombre: "Peso chileno", simbolo: "$", miles: ".", decimal: ",", decimales: 0 },
  { codigo: "BRL", nombre: "Real brasileño", simbolo: "R$ ", miles: ".", decimal: ",", decimales: 2 },
  { codigo: "GTQ", nombre: "Quetzal guatemalteco", simbolo: "Q", miles: ",", decimal: ".", decimales: 2 },
  { codigo: "CRC", nombre: "Colón costarricense", simbolo: "₡", miles: ".", decimal: ",", decimales: 0 },
  { codigo: "DOP", nombre: "Peso dominicano", simbolo: "RD$ ", miles: ",", decimal: ".", decimales: 2 },
  { codigo: "BOB", nombre: "Boliviano", simbolo: "Bs ", miles: ".", decimal: ",", decimales: 2 },
  { codigo: "PYG", nombre: "Guaraní paraguayo", simbolo: "₲", miles: ".", decimal: ",", decimales: 0 },
  { codigo: "UYU", nombre: "Peso uruguayo", simbolo: "$U ", miles: ".", decimal: ",", decimales: 2 },
  { codigo: "HNL", nombre: "Lempira hondureño", simbolo: "L ", miles: ",", decimal: ".", decimales: 2 },
  { codigo: "NIO", nombre: "Córdoba nicaragüense", simbolo: "C$ ", miles: ",", decimal: ".", decimales: 2 },
];

// País → moneda sugerida (el usuario puede cambiarla igual)
export const PAISES: { nombre: string; moneda: string }[] = [
  { nombre: "Colombia", moneda: "COP" },
  { nombre: "México", moneda: "MXN" },
  { nombre: "Argentina", moneda: "ARS" },
  { nombre: "Perú", moneda: "PEN" },
  { nombre: "Chile", moneda: "CLP" },
  { nombre: "Ecuador", moneda: "USD" },
  { nombre: "Venezuela", moneda: "USD" },
  { nombre: "Brasil", moneda: "BRL" },
  { nombre: "Bolivia", moneda: "BOB" },
  { nombre: "Paraguay", moneda: "PYG" },
  { nombre: "Uruguay", moneda: "UYU" },
  { nombre: "Guatemala", moneda: "GTQ" },
  { nombre: "Honduras", moneda: "HNL" },
  { nombre: "El Salvador", moneda: "USD" },
  { nombre: "Nicaragua", moneda: "NIO" },
  { nombre: "Costa Rica", moneda: "CRC" },
  { nombre: "Panamá", moneda: "USD" },
  { nombre: "República Dominicana", moneda: "DOP" },
  { nombre: "Estados Unidos", moneda: "USD" },
  { nombre: "España", moneda: "EUR" },
  { nombre: "Otro", moneda: "USD" },
];

// Moneda activa del proceso: en el navegador la fija <MonedaGlobal>
// (layout) antes de que se pinte cualquier monto; en el servidor la
// fija cada página al leer su empresa (configurarMoneda).
let monedaActiva: Moneda = POR_DEFECTO;

export function configurarMoneda(codigo: string | null | undefined): void {
  monedaActiva = MONEDAS.find((m) => m.codigo === codigo) ?? POR_DEFECTO;
}

export function monedaActual(): Moneda {
  return monedaActiva;
}

/**
 * Formato de moneda determinista (mismo resultado en server y
 * cliente) según la moneda configurada de la empresa.
 */
export function formatearMoneda(n: number): string {
  const m = monedaActiva;
  const valor = Number(n);
  const [entero, decimales] = Math.abs(valor)
    .toFixed(m.decimales)
    .split(".");
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, m.miles);
  const signo = valor < 0 ? "-" : "";
  return signo + m.simbolo + miles + (decimales ? m.decimal + decimales : "");
}
