"use client";

import { useEffect } from "react";

// ============================================================
// TEMA DE MARCA — recolorea TODA la plataforma con los 2 colores
// del dueño (verde oscuro = primario, verde claro = secundario).
// Además de --primary/--secondary, deriva los tonos claros de
// contenedor (fondos de tarjetas, chips, resaltados) manteniendo
// el mismo matiz. El fondo general de la app no se toca.
// Se monta en el layout (colores guardados) y Configuración lo
// usa para la vista previa en vivo.
// ============================================================

export interface ColoresMarca {
  primario: string; // hex, ej. #4E6544
  secundario: string;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexAHsl(hex: string): Hsl | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const aVar = ({ h, s, l }: Hsl) => `${h} ${s}% ${l}%`;

export function aplicarColoresMarca(colores: Partial<ColoresMarca> | null | undefined) {
  if (typeof document === "undefined" || !colores) return;
  const raiz = document.documentElement;

  const p = colores.primario ? hexAHsl(colores.primario) : null;
  if (p) {
    raiz.style.setProperty("--primary", aVar(p));
    raiz.style.setProperty("--ring", aVar(p));
    // Tintes claros del mismo matiz para contenedores y resaltados
    raiz.style.setProperty(
      "--primary-container",
      aVar({ h: p.h, s: Math.min(45, Math.max(22, p.s)), l: 74 })
    );
    raiz.style.setProperty("--on-primary-container", aVar({ h: p.h, s: p.s, l: 28 }));
    raiz.style.setProperty(
      "--primary-fixed",
      aVar({ h: p.h, s: Math.min(55, Math.max(30, p.s + 15)), l: 85 })
    );
  }

  const sec = colores.secundario ? hexAHsl(colores.secundario) : null;
  if (sec) {
    raiz.style.setProperty("--secondary", aVar(sec));
    raiz.style.setProperty(
      "--secondary-container",
      aVar({ h: sec.h, s: Math.min(70, Math.max(35, sec.s + 20)), l: 81 })
    );
    raiz.style.setProperty("--on-secondary-container", aVar({ h: sec.h, s: sec.s, l: 30 }));
  }
}

/** Montado en el layout: aplica los colores guardados de la empresa */
export function TemaMarca({ colores }: { colores?: Partial<ColoresMarca> | null }) {
  useEffect(() => {
    aplicarColoresMarca(colores);
  }, [colores]);
  return null;
}
