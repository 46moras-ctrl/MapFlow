"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GraficaFlujo } from "@/components/app/grafica-flujo";
import { Icon } from "@/components/app/icon";
import { fmt, hoyISO } from "@/lib/facturas";
import {
  construirFlujo,
  mesesEntre,
  ultimosMeses,
  type FilaDinero,
} from "@/lib/finanzas";
import { cn } from "@/lib/utils";

export interface DeudaMin {
  fecha: string;
  monto: number;
  esCobro: boolean;
}

type Rango = "1m" | "3m" | "6m" | "1a" | "total" | "custom";

// ============================================================
// SALUD DEL PRESUPUESTO — reemplaza el botón de Presupuesto:
//   disponible = tope mensual − gastos del mes.
//   · Sano: alcanza para la nómina y la operación.
//   · Al límite: consumido ≥ 85% (nómina a salvo).
//   · Riesgo crítico: lo disponible NO cubre la nómina → CTA
//     "Cobrar facturas vencidas".
// ============================================================
function SaludPresupuesto({
  presupuestoTotalMes,
  gastosActuales,
  costoNomina,
}: {
  presupuestoTotalMes: number;
  gastosActuales: number;
  costoNomina: number;
}) {
  const disponible = presupuestoTotalMes > 0 ? presupuestoTotalMes - gastosActuales : 0;
  const pctConsumido =
    presupuestoTotalMes > 0 ? (gastosActuales / presupuestoTotalMes) * 100 : 0;
  const alcanzaNomina = disponible >= costoNomina;
  const faltanteNomina = alcanzaNomina ? 0 : costoNomina - disponible;
  const alertaLimite = pctConsumido >= 85;

  let estado = {
    caja: "border-secondary-container bg-secondary-container/50",
    texto: "text-on-secondary-container",
    icono: "check_circle",
    titulo: "Presupuesto sano",
    mensaje: "Fondos suficientes para la operación.",
    barra: "bg-secondary",
  };

  if (presupuestoTotalMes === 0) {
    estado = {
      caja: "border-outline-variant bg-surface-container-low",
      texto: "text-on-surface-variant",
      icono: "info",
      titulo: "Sin presupuesto definido",
      mensaje: "Aún no has definido topes de gasto. Establece un presupuesto para ver tu salud financiera.",
      barra: "bg-outline-variant",
    };
  } else if (costoNomina > 0 && !alcanzaNomina) {
    estado = {
      caja: "border-error/40 bg-error-container/70",
      texto: "text-on-error-container",
      icono: "warning",
      titulo: "Riesgo crítico de nómina",
      mensaje: `Faltan ${fmt(faltanteNomina)} para cubrir la nómina del mes.`,
      barra: "bg-error",
    };
  } else if (disponible < 0) {
    estado = {
      caja: "border-error/40 bg-error-container/70",
      texto: "text-on-error-container",
      icono: "warning",
      titulo: "Presupuesto excedido",
      mensaje: `Has superado tu presupuesto mensual por ${fmt(Math.abs(disponible))}.`,
      barra: "bg-error",
    };
  } else if (alertaLimite) {
    estado = {
      caja: "border-tertiary-container bg-tertiary-container/60",
      texto: "text-on-tertiary-container",
      icono: "info",
      titulo: "Presupuesto al límite",
      mensaje: "Has consumido más del 85%. Frena gastos no esenciales.",
      barra: "bg-tertiary",
    };
  }

  // Adjust default message if they have a payroll budget and it's safe
  if (presupuestoTotalMes > 0 && disponible >= 0 && costoNomina > 0 && !alertaLimite) {
    estado.mensaje = "Fondos suficientes para la nómina y operaciones.";
  } else if (presupuestoTotalMes > 0 && alertaLimite && costoNomina > 0 && alcanzaNomina) {
    estado.mensaje = "Has consumido más del 85%. Frena gastos no esenciales (nómina a salvo).";
  }

  return (
    <div className={cn("rounded-xl border p-6 shadow-level-1", estado.caja)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Icon
            name={estado.icono}
            filled
            className={cn("text-[30px]", estado.texto)}
          />
          <div>
            <h3 className={cn("text-xl font-bold", estado.texto)}>
              {estado.titulo}
            </h3>
            <p className={cn("mt-1 text-sm font-light opacity-90", estado.texto)}>
              {estado.mensaje}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-light uppercase tracking-wider text-on-surface-variant">
            Disponible
          </p>
          <p className="text-2xl font-bold tabular-nums text-on-surface">
            {fmt(disponible)}
          </p>
          <Link
            href="/presupuestos"
            className="mt-1 flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wider text-primary hover:underline"
          >
            Gestionar presupuesto
            <Icon name="arrow_forward" className="text-[14px]" />
          </Link>
        </div>
      </div>

      {/* Barra de consumo del presupuesto */}
      <div className="mt-6">
        <div className="mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
          <span>Consumido: {pctConsumido.toFixed(1)}%</span>
          <span>
            Tope: {fmt(presupuestoTotalMes)} · Nómina: {fmt(costoNomina)}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-variant">
          <div
            className={cn(
              "h-2.5 rounded-full transition-all duration-1000",
              estado.barra
            )}
            style={{ width: `${Math.min(pctConsumido, 100)}%` }}
          />
        </div>
      </div>

      {/* Acción sugerida si la nómina está en riesgo */}
      {costoNomina > 0 && !alcanzaNomina && (
        <Link
          href="/pendientes?tab=cobro"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-error px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-error transition-opacity hover:opacity-90"
        >
          <Icon name="payments" className="text-[16px]" />
          Cobrar facturas vencidas
        </Link>
      )}
    </div>
  );
}

// Por defecto siempre el MES ACTUAL; el resto son miradas hacia atrás
const RANGOS: { id: Exclude<Rango, "custom">; label: string; meses: number }[] = [
  { id: "1m", label: "Mes actual", meses: 1 },
  { id: "3m", label: "3 meses", meses: 3 },
  { id: "6m", label: "6 meses", meses: 6 },
  { id: "1a", label: "1 año", meses: 12 },
  { id: "total", label: "Total", meses: 0 },
];

export function ReportesCliente({
  nombreEmpresa,
  filas,
  deudas,
  presupuestoMensual,
  costoNomina,
  mostrarPresupuestos,
}: {
  nombreEmpresa: string | null;
  filas: FilaDinero[];
  deudas: DeudaMin[];
  presupuestoMensual: number;
  costoNomina: number;
  mostrarPresupuestos: boolean;
}) {
  const hoy = hoyISO();
  const [rango, setRango] = useState<Rango>("1m");
  const [desdeCustom, setDesdeCustom] = useState("");
  const [hastaCustom, setHastaCustom] = useState("");
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);

  // Rango efectivo → lista de meses para la gráfica y corte de filas
  const { meses, desde, hasta } = useMemo(() => {
    if (rango === "custom" && desdeCustom && hastaCustom) {
      return {
        meses: mesesEntre(desdeCustom, hastaCustom),
        desde: desdeCustom,
        hasta: hastaCustom,
      };
    }
    if (rango === "total") {
      const fechas = filas.map((f) => f.fecha).filter(Boolean).sort();
      const primera = fechas[0] ?? hoy;
      return { meses: mesesEntre(primera, hoy), desde: primera, hasta: hoy };
    }
    const n = RANGOS.find((r) => r.id === rango)?.meses ?? 6;
    const lista = ultimosMeses(n, hoy);
    return { meses: lista, desde: `${lista[0]}-01`, hasta: hoy };
  }, [rango, desdeCustom, hastaCustom, filas, hoy]);

  const filasEnRango = useMemo(
    () => filas.filter((f) => f.fecha >= desde && f.fecha <= hasta),
    [filas, desde, hasta]
  );

  const flujo = useMemo(
    () => construirFlujo(meses, filasEnRango, deudas, presupuestoMensual),
    [meses, filasEnRango, deudas, presupuestoMensual]
  );

  const ingresos = filasEnRango.filter((f) => f.esIngreso).reduce((s, f) => s + f.monto, 0);
  const egresos = filasEnRango.filter((f) => !f.esIngreso).reduce((s, f) => s + f.monto, 0);
  const deudaCobro = deudas.filter((d) => d.esCobro).reduce((s, d) => s + d.monto, 0);
  const deudaPago = deudas.filter((d) => !d.esCobro).reduce((s, d) => s + d.monto, 0);

  // La salud del presupuesto siempre mira el MES ACTUAL (la nómina
  // y el tope son mensuales), sin importar el periodo del reporte.
  const mesActual = hoy.slice(0, 7);
  const gastosMesActual = filas
    .filter((f) => !f.esIngreso && f.fecha.startsWith(mesActual))
    .reduce((s, f) => s + f.monto, 0);

  function aplicarCalendario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!desdeCustom || !hastaCustom) return;
    setRango("custom");
    setCalendarioAbierto(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-on-surface">
          Reportes
        </h1>
        <p className="mt-1 text-lg font-light text-on-surface-variant">
          {nombreEmpresa
            ? `Las finanzas de ${nombreEmpresa}, acumuladas y en orden.`
            : "Las finanzas de tu negocio, acumuladas y en orden."}
        </p>
      </div>

      {/* ===== Filtro de tiempo (encima de los KPIs) ===== */}
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
        {/* Calendario: de qué fecha a qué fecha */}
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
      </div>

      {/* ===== KPIs del periodo (clic → detalle con subpestañas) ===== */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Link
          href="/movimientos?tab=ingresos"
          className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1 transition-colors hover:border-primary"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Ingresos totales
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-on-surface">
                {fmt(ingresos)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary">
                Ver todos
                <Icon name="arrow_forward" className="text-[14px]" />
              </div>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-container/60 text-on-secondary-container">
              <Icon name="trending_up" className="text-[24px]" />
            </div>
          </div>
        </Link>

        <Link
          href="/movimientos?tab=egresos"
          className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1 transition-colors hover:border-primary"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Egresos totales
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-on-surface">
                {fmt(egresos)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary">
                Ver todos
                <Icon name="arrow_forward" className="text-[14px]" />
              </div>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
              <Icon name="payments" className="text-[24px]" />
            </div>
          </div>
        </Link>

        <Link
          href="/movimientos?tab=deudas"
          className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1 transition-colors hover:border-primary"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Deudas totales
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-on-surface">
                {fmt(deudaCobro + deudaPago)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary">
                Ver todas
                <Icon name="arrow_forward" className="text-[14px]" />
              </div>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
              <Icon name="account_balance_wallet" className="text-[24px]" />
            </div>
          </div>
        </Link>
      </div>

      {/* ===== Salud del presupuesto (solo con el módulo activo) ===== */}
      {mostrarPresupuestos && (
        <SaludPresupuesto
          presupuestoTotalMes={presupuestoMensual}
          gastosActuales={gastosMesActual}
          costoNomina={costoNomina}
        />
      )}

      {/* ===== Gráfica (sin título) con filtros de series debajo.
             Con el módulo de presupuesto apagado, esa serie ni aparece ===== */}
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1">
        <GraficaFlujo datos={flujo} conFiltros conPresupuesto={mostrarPresupuestos} />
      </div>
    </div>
  );
}
