"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/app/icon";
import { fmt, formatearFecha, hoyISO } from "@/lib/facturas";
import { ultimosMeses } from "@/lib/finanzas";
import { cn } from "@/lib/utils";
import {
  crearPresupuesto,
  eliminarPresupuesto,
  type DatosPresupuesto,
} from "./actions";

// ============================================================
// PRESUPUESTOS — registro (botón superior derecho), botón
// "Detalle" hacia la página de Egresos, barra de filtros de
// tiempo, y listado de presupuestos. REGLA: TODOS los egresos
// registrados se descuentan del presupuesto (sin categorías);
// el rango por defecto es el mes actual y se reinicia cada mes.
// ============================================================

type Rango = "1m" | "3m" | "6m" | "1a" | "total" | "custom";

const RANGOS: { id: Exclude<Rango, "custom">; label: string; meses: number }[] = [
  { id: "1m", label: "Mes actual", meses: 1 },
  { id: "3m", label: "3 meses", meses: 3 },
  { id: "6m", label: "6 meses", meses: 6 },
  { id: "1a", label: "1 año", meses: 12 },
  { id: "total", label: "Total", meses: 0 },
];

export interface PresupuestoDB {
  id: string;
  categoria: string;
  monto_tope: number;
  periodo: "semanal" | "mensual" | "trimestral" | "anual";
  alerta_porcentaje: number | null;
  created_at: string;
}

const ETIQUETA_PERIODO: Record<PresupuestoDB["periodo"], string> = {
  semanal: "Semanal",
  mensual: "Mensual",
  trimestral: "Trimestral",
  anual: "Anual",
};

export function PresupuestosCliente({
  presupuestos,
  egresos,
}: {
  presupuestos: PresupuestoDB[];
  egresos: { fecha: string; monto: number }[];
}) {
  const hoy = hoyISO();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [aEliminar, setAEliminar] = useState<PresupuestoDB | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, startTransition] = useTransition();

  // Barra de filtros de tiempo (por defecto, el mes actual)
  const [rango, setRango] = useState<Rango>("1m");
  const [desdeCustom, setDesdeCustom] = useState("");
  const [hastaCustom, setHastaCustom] = useState("");
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);

  const { desde, hasta } = useMemo(() => {
    if (rango === "custom" && desdeCustom && hastaCustom)
      return { desde: desdeCustom, hasta: hastaCustom };
    if (rango === "total") return { desde: "", hasta: hoy };
    const n = RANGOS.find((r) => r.id === rango)?.meses ?? 1;
    return { desde: `${ultimosMeses(n, hoy)[0]}-01`, hasta: hoy };
  }, [rango, desdeCustom, hastaCustom, hoy]);

  // TODOS los egresos del rango se descuentan del presupuesto
  const gastadoRango = useMemo(
    () =>
      egresos
        .filter((e) => (!desde || e.fecha >= desde) && e.fecha <= hasta)
        .reduce((s, e) => s + e.monto, 0),
    [egresos, desde, hasta]
  );

  function aplicarCalendario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!desdeCustom || !hastaCustom) return;
    setRango("custom");
    setCalendarioAbierto(false);
  }

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const datos: DatosPresupuesto = {
      categoria: String(fd.get("categoria") ?? ""),
      monto_tope: Number(fd.get("monto_tope")),
      periodo: (fd.get("periodo") as DatosPresupuesto["periodo"]) ?? "mensual",
      alerta_porcentaje: Number(fd.get("alerta_porcentaje") ?? 80),
    };
    startTransition(async () => {
      const res = await crearPresupuesto(datos);
      if (!res.ok) {
        setError(res.error ?? "Ocurrió un error.");
        return;
      }
      setModalAbierto(false);
    });
  }

  function confirmarEliminar() {
    if (!aEliminar) return;
    startTransition(async () => {
      const res = await eliminarPresupuesto(aEliminar.id);
      if (!res.ok) setError(res.error ?? "Ocurrió un error.");
      setAEliminar(null);
    });
  }

  const claseCampo =
    "mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary";
  const claseEtiqueta =
    "text-xs font-bold uppercase tracking-wider text-on-surface-variant";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/reportes"
              aria-label="Volver a Reportes"
              className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
            >
              <Icon name="arrow_back" className="text-[22px]" />
            </Link>
            <h1 className="text-4xl font-bold tracking-tight text-on-surface">
              Presupuestos
            </h1>
          </div>
          <p className="mt-1 text-lg font-light text-on-surface-variant">
            Ponle un tope a cada categoría y MapFlow te avisa antes de pasarte.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Detalle → página de Egresos con el rango elegido
              (el mismo camino que hace Ventas hacia Ingresos) */}
          <Link
            href={`/movimientos?tab=egresos&desde=${desde}&hasta=${hasta}`}
            className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Icon name="payments" className="text-[18px]" />
            Detalle
          </Link>
          {/* Registro: botón superior derecho */}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setModalAbierto(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <Icon name="add" className="text-[18px]" />
            Registrar presupuesto
          </button>
        </div>
      </div>

      {/* Barra de filtros de tiempo */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface p-4">
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Periodo:
        </span>
        {RANGOS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRango(r.id)}
            className={
              rango === r.id
                ? "rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary"
                : "rounded-lg bg-surface-container-high px-3 py-1.5 text-xs font-light text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            }
          >
            {r.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCalendarioAbierto((v) => !v)}
          aria-expanded={calendarioAbierto}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
            rango === "custom"
              ? "bg-primary font-bold text-on-primary"
              : "bg-surface-container-high font-light text-on-surface-variant hover:bg-surface-container-highest"
          )}
        >
          <Icon name="calendar_month" className="text-[16px]" />
          Calendario
        </button>
        {calendarioAbierto && (
          <form onSubmit={aplicarCalendario} className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={desdeCustom}
              onChange={(e) => setDesdeCustom(e.target.value)}
              required
              aria-label="Desde"
              className="rounded-lg border border-primary-container bg-surface-container-low p-2 text-sm font-light text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-xs font-light text-on-surface-variant">a</span>
            <input
              type="date"
              value={hastaCustom}
              onChange={(e) => setHastaCustom(e.target.value)}
              required
              aria-label="Hasta"
              className="rounded-lg border border-primary-container bg-surface-container-low p-2 text-sm font-light text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90"
            >
              Aplicar
            </button>
          </form>
        )}
        <span className="ml-auto text-xs font-light text-on-surface-variant">
          Egresos del periodo: <strong className="font-bold">{fmt(gastadoRango)}</strong>
        </span>
      </div>

      {error && !modalAbierto && (
        <div className="flex items-center gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
          <Icon name="error" className="text-[18px]" />
          {error}
        </div>
      )}

      {presupuestos.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container/50">
            <Icon name="savings" className="text-[32px] text-on-primary-container" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-on-surface">
            Aún no registras presupuestos
          </h3>
          <p className="mt-1 max-w-md text-sm font-light text-on-surface-variant">
            Define cuánto quieres gastar por categoría y sigue el gasto real
            desde Reportes y el Dashboard.
          </p>
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="mt-6 flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90"
          >
            <Icon name="add" className="text-[18px]" />
            Registrar mi primer presupuesto
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-1">
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left">
            <thead className="border-b border-outline-variant bg-surface-container-low">
              <tr className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                <th className="px-6 py-3">Detalle</th>
                <th className="px-6 py-3 text-right">Monto tope</th>
                <th className="px-6 py-3">Periodo</th>
                <th className="px-6 py-3">Gastado en el periodo</th>
                <th className="px-6 py-3">Registrado</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {presupuestos.map((p) => {
                // TODOS los egresos del periodo descuentan de cada
                // presupuesto (regla global, sin categorías)
                const g = gastadoRango;
                const pct = Math.round((g / Number(p.monto_tope)) * 100);
                const enAlerta = pct >= (p.alerta_porcentaje ?? 80);
                return (
                  <tr key={p.id} className="group text-sm transition-colors hover:bg-surface-container">
                    <td className="px-6 py-3.5 font-semibold text-on-surface">
                      {p.categoria}
                      <div className="text-xs font-light text-on-surface-variant">
                        alerta al {p.alerta_porcentaje ?? 80}%
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-on-surface">
                      {fmt(Number(p.monto_tope))}
                    </td>
                    <td className="px-6 py-3.5 font-light text-on-surface-variant">
                      {ETIQUETA_PERIODO[p.periodo]}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-2 w-24 overflow-hidden rounded-full bg-surface-container-high"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${p.categoria}: ${pct}% usado`}
                        >
                          <div
                            className={cn(
                              "h-full rounded-full",
                              enAlerta ? "bg-error" : "bg-primary"
                            )}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            "tabular-nums",
                            enAlerta
                              ? "font-semibold text-error"
                              : "font-light text-on-surface-variant"
                          )}
                        >
                          {fmt(g)} ({pct}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-light text-on-surface-variant">
                      {formatearFecha(p.created_at.slice(0, 10))}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => setAEliminar(p)}
                          title="Eliminar"
                          aria-label={`Eliminar presupuesto de ${p.categoria}`}
                          className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant hover:text-error"
                        >
                          <Icon name="delete" className="text-[20px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      )}

      {/* ===== Modal de registro ===== */}
      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-on-surface">
                Registrar presupuesto
              </h2>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                aria-label="Cerrar"
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            <form onSubmit={guardar} className="mt-5 flex flex-col gap-4">
              <div>
                <label className={claseEtiqueta}>Categoría / detalle *</label>
                <input
                  name="categoria"
                  required
                  placeholder="Ej: Insumos, Nómina, Publicidad…"
                  className={claseCampo}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={claseEtiqueta}>Monto tope *</label>
                  <input
                    name="monto_tope"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    className={cn(claseCampo, "tabular-nums")}
                  />
                </div>
                <div>
                  <label className={claseEtiqueta}>Periodo *</label>
                  <select name="periodo" defaultValue="mensual" className={claseCampo}>
                    <option value="semanal">Semanal</option>
                    <option value="mensual">Mensual</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
                <div>
                  <label className={claseEtiqueta}>Alerta al (%)</label>
                  <input
                    name="alerta_porcentaje"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={80}
                    className={cn(claseCampo, "tabular-nums")}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
                  <Icon name="error" className="mt-0.5 shrink-0 text-[18px]" />
                  {error}
                </div>
              )}

              <div className="mt-1 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={ocupado}
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {ocupado ? (
                    <>
                      <Icon name="progress_activity" className="animate-spin text-[16px]" />
                      Guardando…
                    </>
                  ) : (
                    "Guardar"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Confirmación de eliminación ===== */}
      {aEliminar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
            <h2 className="text-xl font-bold text-on-surface">
              ¿Eliminar este presupuesto?
            </h2>
            <p className="mt-3 text-sm font-light leading-relaxed text-on-surface-variant">
              Vas a eliminar el presupuesto de{" "}
              <strong className="font-semibold text-on-surface">
                {aEliminar.categoria}
              </strong>{" "}
              por{" "}
              <strong className="font-semibold text-on-surface">
                {fmt(Number(aEliminar.monto_tope))}
              </strong>
              .
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAEliminar(null)}
                className="rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                disabled={ocupado}
                className="rounded-xl bg-error px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-error transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
