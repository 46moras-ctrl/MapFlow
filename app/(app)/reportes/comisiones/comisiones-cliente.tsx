"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/app/icon";
import { fmt, formatearFecha, hoyISO } from "@/lib/facturas";
import {
  ETIQUETA_FRECUENCIA,
  comisionDeFactura,
  periodoVigente,
  type EmpleadoDB,
  type MetaComision,
} from "@/lib/nomina";
import { cn } from "@/lib/utils";
import { liquidarComisiones } from "./actions";

// ============================================================
// COMISIONES — acordeón por empleado con ventas: rol, ventas y
// comisión del período; al expandir, el detalle factura por
// factura, el progreso de metas y el historial de liquidaciones.
// "Liquidar comisiones" marca lo pendiente como pagado (todo o
// un rango) y puede registrar el egreso en el flujo de caja.
// ============================================================

export interface VentaComision {
  id: string;
  numero_factura: string;
  cliente: string;
  concepto: string | null; // el "producto" de la venta
  monto: number;
  fecha_emision: string;
  id_vendedor: string;
  comision_porcentaje: number | null;
  comision_liquidada: boolean;
}

export interface LiquidacionDB {
  id: string;
  id_empleado: string;
  desde: string | null;
  hasta: string | null;
  num_facturas: number;
  total_comision: number;
  total_bonificacion: number;
  registrado_egreso: boolean;
  created_at: string;
}

type Rango = "1m" | "3m" | "6m" | "1a" | "total";

const RANGOS: { id: Rango; label: string }[] = [
  { id: "1m", label: "Mes actual" },
  { id: "3m", label: "3 meses" },
  { id: "6m", label: "6 meses" },
  { id: "1a", label: "1 año" },
  { id: "total", label: "Total" },
];

/** Fecha "desde" del rango elegido ("" = sin límite) */
function desdeDeRango(rango: Rango, hoy: string): string {
  if (rango === "total") return "";
  if (rango === "1m") return `${hoy.slice(0, 7)}-01`;
  const meses = rango === "3m" ? 3 : rango === "6m" ? 6 : 12;
  const d = new Date(hoy + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - (meses - 1));
  return `${d.toISOString().slice(0, 7)}-01`;
}

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** '2026-07' → 'Julio 2026' */
function etiquetaMes(ym: string): string {
  const [a, m] = ym.split("-");
  return `${NOMBRES_MES[Number(m) - 1] ?? m} ${a}`;
}

/** Ventas agrupadas por mes, del más reciente al más viejo */
function agruparPorMes(ventas: VentaComision[]): { mes: string; filas: VentaComision[] }[] {
  const grupos = new Map<string, VentaComision[]>();
  for (const v of ventas) {
    const mes = v.fecha_emision.slice(0, 7);
    if (!grupos.has(mes)) grupos.set(mes, []);
    grupos.get(mes)!.push(v);
  }
  return Array.from(grupos.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([mes, filas]) => ({ mes, filas }));
}

export function ComisionesCliente({
  empleados,
  ventas,
  liquidaciones,
  metas,
  modalidad,
}: {
  empleados: EmpleadoDB[];
  ventas: VentaComision[];
  liquidaciones: LiquidacionDB[];
  metas: MetaComision[];
  modalidad: "venta" | "metas";
}) {
  const hoy = hoyISO();
  const router = useRouter();
  const [rango, setRango] = useState<Rango>("1m");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [historialAbierto, setHistorialAbierto] = useState<string | null>(null);
  // Modal de liquidación del empleado seleccionado
  const [liquidarDe, setLiquidarDe] = useState<EmpleadoDB | null>(null);
  const [modoRango, setModoRango] = useState(false);
  const [desdeLiq, setDesdeLiq] = useState("");
  const [hastaLiq, setHastaLiq] = useState("");
  const [registrarEgreso, setRegistrarEgreso] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [ocupado, startTransition] = useTransition();

  const desde = desdeDeRango(rango, hoy);

  // En modalidad de metas TODA venta con vendedor cuenta (para el
  // progreso); en comisión por venta, solo las que tienen % > 0
  const ventasComision = useMemo(
    () =>
      modalidad === "metas"
        ? ventas
        : ventas.filter((v) => Number(v.comision_porcentaje) > 0),
    [ventas, modalidad]
  );

  // Empleados que aparecen: con ventas en el período elegido o
  // con comisiones pendientes de cualquier fecha (no desaparecen
  // del listado hasta que se les pague)
  const filasEmpleados = useMemo(() => {
    return empleados
      .map((e) => {
        const suyas = ventasComision.filter((v) => v.id_vendedor === e.id);
        const enPeriodo = suyas.filter((v) => !desde || v.fecha_emision >= desde);
        const pendientes = suyas.filter((v) => !v.comision_liquidada);
        return {
          empleado: e,
          enPeriodo,
          pendientes,
          montoPeriodo: enPeriodo.reduce((s, v) => s + Number(v.monto), 0),
          comisionPeriodo: enPeriodo.reduce((s, v) => s + comisionDeFactura(v), 0),
          comisionPendiente: pendientes.reduce((s, v) => s + comisionDeFactura(v), 0),
        };
      })
      .filter((f) => f.enPeriodo.length > 0 || f.pendientes.length > 0);
  }, [empleados, ventasComision, desde]);

  const totalPendiente = filasEmpleados.reduce((s, f) => s + f.comisionPendiente, 0);

  function abrirLiquidar(e: EmpleadoDB) {
    setError(null);
    setModoRango(false);
    setDesdeLiq("");
    setHastaLiq("");
    setRegistrarEgreso(true);
    setLiquidarDe(e);
  }

  // Vista previa de la liquidación (misma regla que el servidor:
  // las metas se evalúan sobre lo que se está liquidando)
  const previaLiquidacion = useMemo(() => {
    if (!liquidarDe) return null;
    const pendientes = ventasComision.filter(
      (v) =>
        v.id_vendedor === liquidarDe.id &&
        !v.comision_liquidada &&
        (!modoRango || !desdeLiq || v.fecha_emision >= desdeLiq) &&
        (!modoRango || !hastaLiq || v.fecha_emision <= hastaLiq)
    );
    const montoVentas = pendientes.reduce((s, v) => s + Number(v.monto), 0);
    const comision = pendientes.reduce((s, v) => s + comisionDeFactura(v), 0);
    // Misma regla que el servidor: la meta de venta única se gana
    // por cada venta que la cumpla; las demás, una vez
    const conVeces = metas.map((m) => ({
      meta: m,
      veces:
        m.tipo === "venta_unica"
          ? pendientes.filter((v) => Number(v.monto) >= Number(m.valor)).length
          : (m.tipo === "cantidad" ? pendientes.length : montoVentas) >= Number(m.valor)
            ? 1
            : 0,
    }));
    const metasAlcanzadas = conVeces.filter((x) => x.veces > 0);
    const bonificacion = metasAlcanzadas.reduce(
      (s, x) => s + x.veces * Number(x.meta.bonificacion),
      0
    );
    return { pendientes, comision, bonificacion, metasAlcanzadas };
  }, [liquidarDe, ventasComision, modoRango, desdeLiq, hastaLiq, metas]);

  function confirmarLiquidacion() {
    if (!liquidarDe) return;
    setError(null);
    startTransition(async () => {
      const res = await liquidarComisiones({
        idEmpleado: liquidarDe.id,
        desde: modoRango ? desdeLiq || null : null,
        hasta: modoRango ? hastaLiq || null : null,
        registrarEgreso,
      });
      if (!res.ok) return setError(res.error ?? "No se pudo liquidar.");
      setExito(`Comisiones de ${liquidarDe.nombre} liquidadas: pasaron al historial.`);
      setTimeout(() => setExito(null), 5000);
      setLiquidarDe(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/reportes"
        className="flex w-fit items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:text-primary"
      >
        <Icon name="arrow_back" className="text-[18px]" />
        Volver a Reportes
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">
            Comisiones
          </h1>
          <p className="mt-1 text-lg font-light text-on-surface-variant">
            Lo que cada vendedor lleva ganado y lo que está pendiente de pago.
          </p>
        </div>
        {totalPendiente > 0 && (
          <div className="rounded-xl border border-tertiary-container bg-tertiary-container/40 px-5 py-3 text-right">
            <div className="text-xs font-bold uppercase tracking-wider text-on-tertiary-container">
              Pendiente por pagar
            </div>
            <div className="text-2xl font-bold tabular-nums text-on-surface">
              {fmt(totalPendiente)}
            </div>
          </div>
        )}
      </div>

      {exito && (
        <div className="flex items-center gap-2 rounded-lg bg-secondary-container/60 px-4 py-3 text-sm font-light text-on-secondary-container">
          <Icon name="check_circle" className="text-[18px]" />
          {exito}
        </div>
      )}

      {/* Filtro de período */}
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
      </div>

      {filasEmpleados.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container/50">
            <Icon name="percent" className="text-[32px] text-on-primary-container" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-on-surface">
            Aún no hay ventas con vendedor asignado
          </h3>
          <p className="mt-1 max-w-md text-sm font-light text-on-surface-variant">
            Al registrar una factura de cobro, elige quién la vendió en el
            campo «Vendedor» y su comisión aparecerá aquí sola.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filasEmpleados.map(
            ({ empleado, enPeriodo, montoPeriodo, comisionPeriodo, comisionPendiente }) => {
              const expandido = abierto === empleado.id;
              const suLiquidaciones = liquidaciones.filter(
                (l) => l.id_empleado === empleado.id
              );
              // Ventas del período vigente de cada meta (para la barra)
              const ventasEmpleado = ventasComision.filter(
                (v) => v.id_vendedor === empleado.id
              );
              return (
                <div
                  key={empleado.id}
                  className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-1"
                >
                  {/* Cabecera del acordeón */}
                  <button
                    type="button"
                    onClick={() => setAbierto(expandido ? null : empleado.id)}
                    aria-expanded={expandido}
                    className="flex w-full flex-wrap items-center gap-4 px-6 py-4 text-left"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container">
                        {empleado.nombre
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((p) => p[0]?.toUpperCase())
                          .join("")}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-base font-bold text-on-surface">
                          {empleado.nombre}
                          {!empleado.activo && (
                            <span className="ml-2 rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-light text-on-surface-variant">
                          {empleado.cargo}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-6 text-right">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                          Ventas del período
                        </div>
                        <div className="text-sm font-semibold tabular-nums text-on-surface">
                          {enPeriodo.length} · {fmt(montoPeriodo)}
                        </div>
                      </div>
                      {modalidad === "venta" ? (
                        <>
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                              Comisión del período
                            </div>
                            <div className="text-sm font-semibold tabular-nums text-on-surface">
                              {fmt(comisionPeriodo)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                              Pendiente
                            </div>
                            <div
                              className={cn(
                                "text-sm font-bold tabular-nums",
                                comisionPendiente > 0 ? "text-tertiary" : "text-secondary"
                              )}
                            >
                              {fmt(comisionPendiente)}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                            Sin liquidar
                          </div>
                          <div className="text-sm font-bold tabular-nums text-on-surface">
                            {ventasComision.filter(
                              (v) => v.id_vendedor === empleado.id && !v.comision_liquidada
                            ).length}{" "}
                            ventas
                          </div>
                        </div>
                      )}
                      <Icon
                        name={expandido ? "expand_less" : "expand_more"}
                        className="text-[24px] text-on-surface-variant"
                      />
                    </div>
                  </button>

                  {expandido && (
                    <div className="border-t border-outline-variant px-6 py-5">
                      {/* Progreso de metas (período vigente de cada meta) */}
                      {metas.length > 0 && (
                        <div className="mb-5 grid gap-3 sm:grid-cols-2">
                          {metas.map((meta, i) => {
                            const { desde: d, hasta: h } = periodoVigente(meta.periodo, hoy);
                            const delPeriodo = ventasEmpleado.filter(
                              (v) => v.fecha_emision >= d && v.fecha_emision <= h
                            );
                            // Venta única: cuenta CADA venta que iguale o
                            // supere el valor; la barra mide la mejor venta
                            const esUnica = meta.tipo === "venta_unica";
                            const veces = esUnica
                              ? delPeriodo.filter((v) => Number(v.monto) >= Number(meta.valor)).length
                              : 0;
                            const progreso = esUnica
                              ? delPeriodo.reduce((s, v) => Math.max(s, Number(v.monto)), 0)
                              : meta.tipo === "cantidad"
                                ? delPeriodo.length
                                : delPeriodo.reduce((s, v) => s + Number(v.monto), 0);
                            const pct = Math.min(100, (progreso / Number(meta.valor)) * 100);
                            const lograda = esUnica ? veces > 0 : progreso >= Number(meta.valor);
                            const bonoGanado = Number(meta.bonificacion) * (esUnica ? veces : 1);
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "rounded-xl border p-4",
                                  lograda
                                    ? "border-secondary-container bg-secondary-container/40"
                                    : "border-outline-variant bg-surface-container-low"
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                    Meta {ETIQUETA_FRECUENCIA[meta.periodo].toLowerCase()}:{" "}
                                    {meta.tipo === "cantidad"
                                      ? `${meta.valor} ventas`
                                      : esUnica
                                        ? `una venta ≥ ${fmt(Number(meta.valor))}`
                                        : fmt(Number(meta.valor))}
                                  </div>
                                  {lograda && (
                                    <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-secondary">
                                      <Icon name="emoji_events" className="text-[12px]" />
                                      {esUnica && veces > 1 ? `${veces} × ` : "+"}
                                      {fmt(esUnica && veces > 1 ? bonoGanado : Number(meta.bonificacion))}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-variant">
                                  <div
                                    className={cn(
                                      "h-2 rounded-full transition-all",
                                      lograda ? "bg-secondary" : "bg-tertiary"
                                    )}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <div className="mt-1.5 text-xs font-light text-on-surface-variant">
                                  {esUnica
                                    ? `Mejor venta: ${fmt(progreso)} · logradas: ${veces} (se gana por cada venta que cumpla)`
                                    : `Lleva ${
                                        meta.tipo === "cantidad"
                                          ? `${progreso} venta${progreso === 1 ? "" : "s"}`
                                          : fmt(progreso)
                                      }`}{" "}
                                  ({formatearFecha(d)} – {formatearFecha(h)}) · bonificación:{" "}
                                  {fmt(Number(meta.bonificacion))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Detalle de facturas del período */}
                      {enPeriodo.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-outline-variant px-4 py-6 text-center text-sm font-light text-on-surface-variant">
                          Sin ventas en el período elegido (tiene comisiones
                          pendientes de fechas anteriores).
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-outline-variant">
                          <table className="w-full min-w-[680px] text-left">
                            <thead className="border-b border-outline-variant bg-surface-container-low">
                              <tr className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                <th className="px-4 py-2.5">Fecha</th>
                                <th className="px-4 py-2.5">Producto</th>
                                <th className="px-4 py-2.5">Cliente</th>
                                <th className="px-4 py-2.5 text-right">Monto</th>
                                {modalidad === "venta" && (
                                  <th className="px-4 py-2.5 text-right">Comisión</th>
                                )}
                                <th className="px-4 py-2.5 text-right">Estado</th>
                                <th className="px-4 py-2.5 text-right" aria-label="Ver factura" />
                              </tr>
                            </thead>
                            {/* Ventas mes a mes, del más reciente al más viejo */}
                            {agruparPorMes(enPeriodo).map((grupo) => (
                              <tbody key={grupo.mes} className="divide-y divide-outline-variant">
                                <tr className="bg-surface-container-low/70">
                                  <td
                                    colSpan={modalidad === "venta" ? 7 : 6}
                                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant"
                                  >
                                    {etiquetaMes(grupo.mes)} · {grupo.filas.length} venta
                                    {grupo.filas.length === 1 ? "" : "s"} ·{" "}
                                    {fmt(grupo.filas.reduce((s, v) => s + Number(v.monto), 0))}
                                  </td>
                                </tr>
                                {grupo.filas.map((v) => (
                                  <tr key={v.id} className="text-sm hover:bg-surface-container">
                                    <td className="px-4 py-2.5 font-light text-on-surface-variant">
                                      {formatearFecha(v.fecha_emision)}
                                    </td>
                                    <td className="max-w-48 truncate px-4 py-2.5 font-light text-on-surface">
                                      {v.concepto?.trim() || v.numero_factura}
                                    </td>
                                    <td className="max-w-40 truncate px-4 py-2.5 font-light text-on-surface-variant">
                                      {v.cliente}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-on-surface">
                                      {fmt(Number(v.monto))}
                                    </td>
                                    {modalidad === "venta" && (
                                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-on-surface">
                                        {fmt(comisionDeFactura(v))}{" "}
                                        <span className="font-light text-on-surface-variant">
                                          ({Number(v.comision_porcentaje)}%)
                                        </span>
                                      </td>
                                    )}
                                    <td className="px-4 py-2.5 text-right">
                                      <span
                                        className={cn(
                                          "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                          v.comision_liquidada
                                            ? "bg-secondary-container text-on-secondary-container"
                                            : "bg-tertiary-container text-on-tertiary-container"
                                        )}
                                      >
                                        {v.comision_liquidada ? "Pagada" : "Pendiente"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      {/* OJITO: detalle completo de la factura */}
                                      <Link
                                        href={`/facturas/${v.id}`}
                                        title={`Ver la factura ${v.numero_factura}`}
                                        aria-label={`Ver detalle de la factura ${v.numero_factura}`}
                                        className="inline-flex rounded-full p-1.5 text-on-surface-variant hover:bg-surface-variant hover:text-primary"
                                      >
                                        <Icon name="visibility" className="text-[20px]" />
                                      </Link>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            ))}
                          </table>
                        </div>
                      )}

                      {/* Liquidar + historial */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        {suLiquidaciones.length > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setHistorialAbierto(
                                historialAbierto === empleado.id ? null : empleado.id
                              )
                            }
                            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:text-primary"
                          >
                            <Icon name="history" className="text-[16px]" />
                            Historial de liquidaciones ({suLiquidaciones.length})
                            <Icon
                              name={historialAbierto === empleado.id ? "expand_less" : "expand_more"}
                              className="text-[16px]"
                            />
                          </button>
                        ) : (
                          <span />
                        )}
                        <button
                          type="button"
                          onClick={() => abrirLiquidar(empleado)}
                          disabled={comisionPendiente <= 0}
                          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          <Icon name="paid" className="text-[16px]" />
                          Liquidar comisiones
                        </button>
                      </div>

                      {historialAbierto === empleado.id && suLiquidaciones.length > 0 && (
                        <ul className="mt-3 divide-y divide-outline-variant rounded-xl border border-outline-variant">
                          {suLiquidaciones.map((l) => (
                            <li
                              key={l.id}
                              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                            >
                              <div className="font-light text-on-surface-variant">
                                {formatearFecha(l.created_at.slice(0, 10))} ·{" "}
                                {l.desde
                                  ? `${formatearFecha(l.desde)} – ${formatearFecha(l.hasta)}`
                                  : "todo lo pendiente"}{" "}
                                · {l.num_facturas} venta{l.num_facturas === 1 ? "" : "s"}
                                {l.registrado_egreso && (
                                  <span className="ml-2 rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
                                    Egreso registrado
                                  </span>
                                )}
                              </div>
                              <div className="font-semibold tabular-nums text-on-surface">
                                {fmt(Number(l.total_comision))}
                                {Number(l.total_bonificacion) > 0 && (
                                  <span className="font-light text-on-surface-variant">
                                    {" "}
                                    + {fmt(Number(l.total_bonificacion))} de bonificación
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      )}

      {/* ===== Modal Liquidar comisiones ===== */}
      {liquidarDe && previaLiquidacion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Liquidar comisiones de ${liquidarDe.nombre}`}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-on-surface">
                Liquidar comisiones
              </h2>
              <button
                type="button"
                onClick={() => setLiquidarDe(null)}
                aria-label="Cerrar"
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            <p className="mt-1 text-sm font-light text-on-surface-variant">
              {liquidarDe.nombre} · {liquidarDe.cargo}
            </p>

            {/* Todo lo pendiente o un rango */}
            <div className="mt-4 flex rounded-xl bg-surface-container-high p-1">
              {(
                [
                  { id: false, label: "Todo lo pendiente" },
                  { id: true, label: "Rango de fechas" },
                ] as const
              ).map((op) => (
                <button
                  key={String(op.id)}
                  type="button"
                  onClick={() => setModoRango(op.id)}
                  className={cn(
                    "flex-1 rounded-lg px-4 py-2.5 text-sm transition-colors",
                    modoRango === op.id
                      ? "bg-primary font-bold text-on-primary shadow-sm"
                      : "font-light text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  {op.label}
                </button>
              ))}
            </div>

            {modoRango && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="date"
                  value={desdeLiq}
                  onChange={(e) => setDesdeLiq(e.target.value)}
                  aria-label="Desde"
                  className="w-full rounded-lg border border-primary-container bg-surface-container-low p-2.5 text-sm font-light text-on-surface outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-xs font-light text-on-surface-variant">a</span>
                <input
                  type="date"
                  value={hastaLiq}
                  onChange={(e) => setHastaLiq(e.target.value)}
                  aria-label="Hasta"
                  className="w-full rounded-lg border border-primary-container bg-surface-container-low p-2.5 text-sm font-light text-on-surface outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {/* Resumen de lo que se va a pagar */}
            <div className="mt-4 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm">
              {previaLiquidacion.pendientes.length === 0 ? (
                <p className="font-light text-on-surface-variant">
                  No hay comisiones pendientes{modoRango ? " en ese rango" : ""}.
                </p>
              ) : (
                <>
                  {modalidad === "venta" ? (
                    <div className="flex justify-between">
                      <span className="font-light text-on-surface-variant">
                        {previaLiquidacion.pendientes.length} venta
                        {previaLiquidacion.pendientes.length === 1 ? "" : "s"} · comisión
                      </span>
                      <span className="font-semibold tabular-nums text-on-surface">
                        {fmt(previaLiquidacion.comision)}
                      </span>
                    </div>
                  ) : (
                    <div className="font-light text-on-surface-variant">
                      {previaLiquidacion.pendientes.length} venta
                      {previaLiquidacion.pendientes.length === 1 ? "" : "s"} por liquidar
                    </div>
                  )}
                  {previaLiquidacion.bonificacion > 0 && (
                    <div className="mt-1 flex justify-between">
                      <span className="font-light text-on-surface-variant">
                        Bonificación por meta{previaLiquidacion.metasAlcanzadas.length === 1 ? "" : "s"} alcanzada{previaLiquidacion.metasAlcanzadas.length === 1 ? "" : "s"}
                      </span>
                      <span className="font-semibold tabular-nums text-on-surface">
                        {fmt(previaLiquidacion.bonificacion)}
                      </span>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between border-t border-outline-variant pt-2">
                    <span className="font-bold text-on-surface">Total a pagar</span>
                    <span className="font-bold tabular-nums text-on-surface">
                      {fmt(previaLiquidacion.comision + previaLiquidacion.bonificacion)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={registrarEgreso}
                onChange={(e) => setRegistrarEgreso(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#42682F]"
              />
              <span className="text-sm font-light text-on-surface">
                <strong className="font-semibold">Registrar como egreso</strong> en
                el flujo de caja (categoría Nómina), para no capturarlo dos veces.
              </span>
            </label>

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
                <Icon name="error" className="mt-0.5 shrink-0 text-[18px]" />
                {error}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setLiquidarDe(null)}
                className="rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarLiquidacion}
                disabled={ocupado || previaLiquidacion.pendientes.length === 0}
                className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {ocupado ? (
                  <>
                    <Icon name="progress_activity" className="animate-spin text-[16px]" />
                    Liquidando…
                  </>
                ) : (
                  "Marcar como pagadas"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
