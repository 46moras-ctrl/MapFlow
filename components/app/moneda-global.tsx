"use client";

import { configurarMoneda } from "@/lib/moneda";

/**
 * Fija la moneda de la empresa en el navegador. Vive al inicio del
 * layout, ANTES de las páginas, para que todo fmt() del árbol
 * (incluida la hidratación) use ya la moneda correcta.
 * La asignación es idempotente: no dispara renders ni efectos.
 */
export function MonedaGlobal({ moneda }: { moneda: string | null | undefined }) {
  configurarMoneda(moneda);
  return null;
}
