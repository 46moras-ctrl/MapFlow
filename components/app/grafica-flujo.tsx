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

// Mapeo fijo de colores:
//   INGRESOS     = color primario de la marca (identidad)
//   EGRESOS      = rosado claro (tertiary-container)
//   PRESUPUESTO  = color secundario de la marca (identidad)
//   DEUDAS       = rojo de alertas (--destructive)
const SERIES: {
  id: Serie;
  label: string;
  color: string;
  conArea: boolean;
  punteada?: boolean;
}[] = [
  { id: "ingresos", label: "Ingresos", color: "hsl(var(--primary))", conArea: true },
  { id: "egresos", label: "Egresos", color: "#EFBBD0", conArea: true },
  { id: "deudas", label: "Deudas", color: "hsl(var(--destructive))", conArea: true },
  { id: "presupuesto", label: "Presupuesto", color: "hsl(var(--secondary))", conArea: false, punteada: true },
];

/**
 * Curva monótona (evita oscilaciones/overshooting que ensucian la
 * lectura). Usa interpolación cúbica con pendientes limitadas para
 * que la curva NUNCA suba más alto que el punto máximo adyacente.
 */
function curvaMonotona(puntos: { x: number; y: number }[]): string {
  if (puntos.length === 0) return "";
  if (puntos.length === 1) return `M${puntos[0].x},${puntos[0].y}`;

  let d = `M${puntos[0].x},${puntos[0].y}`;

  for (let i = 0; i < puntos.length - 1; i++) {
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    // Handle control point: 1/3 of horizontal distance
    const cpx = (p2.x - p1.x) / 3;
    d += ` C${p1.x + cpx},${p1.y} ${p2.x - cpx},${p2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** La misma curva, cerrada hasta la base para rellenar el área */
function areaMonotona(puntos: { x: number; y: number }[], baseY: number): string {
  if (puntos.length === 0) return "";
  return `${curvaMonotona(puntos)} L${puntos[puntos.length - 1].x},${baseY} L${puntos[0].x},${baseY} Z`;
}

/** Formato compacto para el eje Y: 1.2M, 350k, 800 */
function fmtEje(valor: number): string {
  if (valor >= 1_000_000) return `${(valor / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (valor >= 1_000) return `${Math.round(valor / 1_000)}k`;
  return String(Math.round(valor));
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

  // Lienzo con más altura para que las curvas tengan espacio
  const W = 720;
  const H = 280;
  const PAD_LEFT = 52;
  const PAD_RIGHT = 16;
  const PAD_TOP = 20;
  const PAD_BOTTOM = 32;
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + plotH;
  const paso = datos.length > 1 ? plotW / (datos.length - 1) : 0;

  // Escala Y con margen superior del 10% para que no toquen el tope
  const maxRaw = Math.max(1, ...datos.flatMap((d) => visibles.map((s) => d[s.id])));
  const max = maxRaw * 1.1;

  const puntosDe = (serie: Serie) =>
    datos.map((d, i) => ({
      x: PAD_LEFT + i * paso,
      y: PAD_TOP + plotH - (d[serie] / max) * plotH,
    }));

  // Escalones bonitos para el eje Y (4 líneas)
  const escalones = [0.25, 0.5, 0.75, 1].map((f) => ({
    valor: max * f,
    y: PAD_TOP + plotH - f * plotH,
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
              <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.03} />
            </linearGradient>
          ))}
        </defs>

        {/* Rejilla horizontal sutil */}
        {escalones.map((e) => (
          <g key={e.valor}>
            <line
              x1={PAD_LEFT}
              x2={W - PAD_RIGHT}
              y1={e.y}
              y2={e.y}
              stroke="#E8E7E3"
              strokeWidth="0.5"
            />
            <text
              x={PAD_LEFT - 10}
              y={e.y + 3.5}
              textAnchor="end"
              className="fill-on-surface-variant text-[9px] font-light"
            >
              {fmtEje(e.valor)}
            </text>
          </g>
        ))}
        {/* Línea base */}
        <line
          x1={PAD_LEFT}
          x2={W - PAD_RIGHT}
          y1={baseY}
          y2={baseY}
          stroke="#E8E7E3"
          strokeWidth="0.5"
        />
        <text
          x={PAD_LEFT - 10}
          y={baseY + 3.5}
          textAnchor="end"
          className="fill-on-surface-variant text-[9px] font-light"
        >
          0
        </text>

        {/* Áreas suavizadas (primero, para que las líneas queden encima) */}
        {visibles.map(
          (s) =>
            s.conArea && (
              <path
                key={`a-${s.id}`}
                d={areaMonotona(puntosDe(s.id), baseY)}
                fill={`url(#area-${s.id})`}
              />
            )
        )}

        {/* Curvas */}
        {visibles.map((s) => (
          <path
            key={`c-${s.id}`}
            d={curvaMonotona(puntosDe(s.id))}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={s.punteada ? "6 4" : undefined}
          />
        ))}

        {/* Puntos solo en los vértices (limpios, sin ruido) */}
        {visibles.map((s) =>
          puntosDe(s.id).map((p, i) => (
            <g key={`p-${s.id}-${i}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r="3.5"
                fill="#FFFFFF"
                stroke={s.color}
                strokeWidth="1.5"
              />
              {/* Zona de hover invisible más grande para el tooltip */}
              <circle cx={p.x} cy={p.y} r="14" fill="transparent">
                <title>{`${datos[i].etiqueta} — ${s.label}: ${fmt(datos[i][s.id])}`}</title>
              </circle>
            </g>
          ))
        )}

        {/* Etiquetas de meses en la base */}
        {datos.map((d, i) => (
          <text
            key={d.ym}
            x={PAD_LEFT + i * paso}
            y={H - 10}
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
