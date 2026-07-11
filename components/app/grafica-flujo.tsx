"use client";

import { useState } from "react";
import { fmt } from "@/lib/facturas";
import type { PuntoFlujo } from "@/lib/finanzas";
import { cn } from "@/lib/utils";

// ============================================================
// SPLINE AREA CHART — curvas suavizadas con área de relleno
// degradado. Compartida por Dashboard y Reportes.
// Los colores salen de las variables CSS de la plataforma
// (--primary / --secondary): si el dueño cambia su identidad
// de marca en Configuración, la gráfica se recolorea sola.
// ============================================================

type Serie = "ingresos" | "egresos" | "presupuesto" | "deudas";

// Mapeo fijo de colores: INGRESOS = color primario de la marca,
// EGRESOS = secundario, DEUDAS = el rosado de Pendientes.
// Presupuesto es una línea de referencia punteada (solo si el
// módulo está activo).
const SERIES: {
  id: Serie;
  label: string;
  color: string;
  conArea: boolean;
  punteada?: boolean;
}[] = [
  { id: "ingresos", label: "Ingresos", color: "hsl(var(--primary))", conArea: true },
  { id: "egresos", label: "Egresos", color: "hsl(var(--secondary))", conArea: true },
  { id: "deudas", label: "Deudas", color: "#EFBBD0", conArea: true },
  { id: "presupuesto", label: "Presupuesto", color: "#8D9286", conArea: false, punteada: true },
];

/** Curva suave (catmull-rom → bézier cúbica) que pasa por los puntos */
function curvaSuave(puntos: { x: number; y: number }[]): string {
  if (puntos.length === 0) return "";
  if (puntos.length === 1) return `M${puntos[0].x},${puntos[0].y}`;
  let d = `M${puntos[0].x},${puntos[0].y}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[Math.max(0, i - 1)];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = puntos[Math.min(puntos.length - 1, i + 2)];
    const t = 0.3;
    d += ` C${p1.x + (p2.x - p0.x) * t},${p1.y + (p2.y - p0.y) * t} ${p2.x - (p3.x - p1.x) * t},${p2.y - (p3.y - p1.y) * t} ${p2.x},${p2.y}`;
  }
  return d;
}

/** La misma curva, cerrada hasta la base para rellenar el área */
function areaSuave(puntos: { x: number; y: number }[], baseY: number): string {
  if (puntos.length === 0) return "";
  return `${curvaSuave(puntos)} L${puntos[puntos.length - 1].x},${baseY} L${puntos[0].x},${baseY} Z`;
}

export function GraficaFlujo({
  datos,
  conFiltros = false,
  conPresupuesto = true,
}: {
  datos: PuntoFlujo[];
  conFiltros?: boolean;
  conPresupuesto?: boolean; // false = módulo apagado: ni serie ni botón
}) {
  const [activas, setActivas] = useState<Record<Serie, boolean>>({
    ingresos: true,
    egresos: true,
    deudas: true,
    presupuesto: conFiltros && conPresupuesto,
  });

  // Con el módulo de presupuestos apagado, esa serie no existe
  const seriesDisponibles = SERIES.filter(
    (s) => s.id !== "presupuesto" || conPresupuesto
  );
  const visibles = seriesDisponibles.filter((s) => activas[s.id]);

  // Lienzo: viewBox fijo, se estira al ancho de la tarjeta
  const W = 720;
  const H = 240;
  const PAD_X = 42;
  const PAD_TOP = 18;
  const PAD_BOTTOM = 26;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + plotH;
  const paso = datos.length > 1 ? (W - PAD_X * 2) / (datos.length - 1) : 0;

  const max = Math.max(1, ...datos.flatMap((d) => visibles.map((s) => d[s.id])));

  const puntosDe = (serie: Serie) =>
    datos.map((d, i) => ({
      x: PAD_X + i * paso,
      y: PAD_TOP + plotH - (d[serie] / max) * plotH,
    }));

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        role="img"
        aria-label="Gráfica de flujo de caja por mes"
      >
        <defs>
          {SERIES.map((s) => (
            <linearGradient key={s.id} id={`area-${s.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="70%" stopColor={s.color} stopOpacity={0.08} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* Rejilla horizontal recesiva con montos de referencia */}
        {[0.25, 0.5, 0.75, 1].map((frac) => {
          const y = PAD_TOP + plotH - frac * plotH;
          return (
            <g key={frac}>
              <line
                x1={PAD_X}
                x2={W - PAD_X}
                y1={y}
                y2={y}
                stroke="#E3E2DE"
                strokeWidth="1"
                strokeDasharray="3 6"
              />
              <text
                x={PAD_X - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-on-surface-variant text-[9px] font-light"
              >
                {max * frac >= 1000
                  ? `${Math.round((max * frac) / 1000)}k`
                  : Math.round(max * frac)}
              </text>
            </g>
          );
        })}
        <line x1={PAD_X} x2={W - PAD_X} y1={baseY} y2={baseY} stroke="#E3E2DE" />

        {/* Áreas suavizadas (primero, para que las líneas queden encima) */}
        {visibles.map(
          (s) =>
            s.conArea && (
              <path
                key={`a-${s.id}`}
                d={areaSuave(puntosDe(s.id), baseY)}
                fill={`url(#area-${s.id})`}
              />
            )
        )}

        {/* Curvas spline */}
        {visibles.map((s) => (
          <path
            key={`c-${s.id}`}
            d={curvaSuave(puntosDe(s.id))}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={s.punteada ? "5 6" : undefined}
          />
        ))}

        {/* Puntos con tooltip nativo por mes y serie */}
        {visibles.map((s) =>
          puntosDe(s.id).map((p, i) => (
            <g key={`p-${s.id}-${i}`}>
              <circle cx={p.x} cy={p.y} r="3" fill="#FFFFFF" stroke={s.color} strokeWidth="2" />
              <circle cx={p.x} cy={p.y} r="12" fill="transparent">
                <title>{`${datos[i].etiqueta} — ${s.label}: ${fmt(datos[i][s.id])}`}</title>
              </circle>
            </g>
          ))
        )}

        {/* Meses en la base */}
        {datos.map((d, i) => (
          <text
            key={d.ym}
            x={PAD_X + i * paso}
            y={H - 8}
            textAnchor="middle"
            className="fill-on-surface-variant text-[10px] font-light"
          >
            {d.etiqueta}
          </text>
        ))}
      </svg>

      {/* Leyenda (sin filtros) o filtros por serie (Reportes) */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {seriesDisponibles.map((s) =>
          conFiltros ? (
            <button
              key={s.id}
              type="button"
              onClick={() => setActivas((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
              aria-pressed={activas[s.id]}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
                activas[s.id]
                  ? "bg-surface-container-high font-bold text-on-surface"
                  : "font-light text-on-surface-variant opacity-50 hover:opacity-80"
              )}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </button>
          ) : (
            activas[s.id] && (
              <span
                key={s.id}
                className="flex items-center gap-1.5 text-xs font-light text-on-surface-variant"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </span>
            )
          )
        )}
      </div>
    </div>
  );
}
