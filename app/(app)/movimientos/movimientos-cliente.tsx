"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/app/icon";
import { fmt, formatearFecha } from "@/lib/facturas";
import type { FilaDinero } from "@/lib/finanzas";
import { cn } from "@/lib/utils";

// ============================================================
// DETALLE FINANCIERO — subpestañas Ingresos | Egresos | Deudas.
// En Deudas, un filtro adicional separa cobros y pagos.
// ============================================================

export type TabDetalle = "ingresos" | "egresos" | "deudas";

export interface DeudaDetalle {
  id: string;
  numero_factura: string;
  cliente: string;
  concepto: string | null;
  monto: number;
  esCobro: boolean;
  fecha_vencimiento: string;
}

type FiltroDeuda = "todas" | "cobros" | "pagos";

export function MovimientosCliente({
  filas,
  deudas,
  tabInicial,
}: {
  filas: FilaDinero[];
  deudas: DeudaDetalle[];
  tabInicial: TabDetalle;
}) {
  const [tab, setTab] = useState<TabDetalle>(tabInicial);
  const [filtroDeuda, setFiltroDeuda] = useState<FiltroDeuda>("todas");

  const ingresos = filas.filter((f) => f.esIngreso);
  const egresos = filas.filter((f) => !f.esIngreso);
  const deudasVisibles = deudas.filter(
    (d) =>
      filtroDeuda === "todas" ||
      (filtroDeuda === "cobros" && d.esCobro) ||
      (filtroDeuda === "pagos" && !d.esCobro)
  );

  const totalTab =
    tab === "ingresos"
      ? ingresos.reduce((s, f) => s + f.monto, 0)
      : tab === "egresos"
        ? egresos.reduce((s, f) => s + f.monto, 0)
        : deudasVisibles.reduce((s, d) => s + d.monto, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
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
              Detalle financiero
            </h1>
          </div>
          <p className="mt-1 text-lg font-light text-on-surface-variant">
            Todos tus ingresos, egresos y deudas, en un solo lugar.
          </p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-3 text-right shadow-level-1">
          <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Total {tab === "deudas" ? `deudas (${filtroDeuda})` : tab}
          </div>
          <div className="text-2xl font-bold tabular-nums text-on-surface">
            {fmt(totalTab)}
          </div>
        </div>
      </div>

      {/* Subpestañas */}
      <div className="flex gap-6 border-b border-outline-variant">
        {(
          [
            { id: "ingresos", label: "Ingresos", icono: "trending_up", n: ingresos.length },
            { id: "egresos", label: "Egresos", icono: "payments", n: egresos.length },
            { id: "deudas", label: "Deudas", icono: "account_balance_wallet", n: deudas.length },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm transition-colors",
              tab === t.id
                ? "border-primary font-bold text-primary"
                : "border-transparent font-light text-on-surface-variant hover:text-on-surface"
            )}
          >
            <Icon name={t.icono} className="text-[18px]" />
            {t.label}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold",
                tab === t.id
                  ? "bg-primary-container/60 text-on-primary-container"
                  : "bg-surface-container-high text-on-surface-variant"
              )}
            >
              {t.n}
            </span>
          </button>
        ))}
      </div>

      {/* Filtro cobros/pagos (solo Deudas) */}
      {tab === "deudas" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Filtrar:
          </span>
          {(
            [
              { id: "todas", label: "Todas" },
              { id: "cobros", label: "Cobros" },
              { id: "pagos", label: "Pagos" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroDeuda(f.id)}
              className={
                filtroDeuda === f.id
                  ? "rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-on-primary"
                  : "rounded-lg bg-surface-container-high px-4 py-1.5 text-xs font-light text-on-surface-variant transition-colors hover:bg-surface-container-highest"
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Tabla de la subpestaña activa */}
      {tab !== "deudas" ? (
        (tab === "ingresos" ? ingresos : egresos).length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-14 text-center text-sm font-light text-on-surface-variant">
            Aún no hay {tab} registrados.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-1">
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left">
              <thead className="border-b border-outline-variant bg-surface-container-low">
                <tr className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Contraparte</th>
                  <th className="px-6 py-3">Categoría</th>
                  <th className="px-6 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {(tab === "ingresos" ? ingresos : egresos).slice(0, 200).map((f) => (
                  <tr key={f.id} className="text-sm transition-colors hover:bg-surface-container">
                    <td className="px-6 py-3.5 font-light text-on-surface-variant">
                      {formatearFecha(f.fecha)}
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-on-surface">
                      {f.contraparte}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold",
                          f.esIngreso
                            ? "bg-secondary-container/60 text-on-secondary-container"
                            : "bg-primary-container/20 text-on-primary-container"
                        )}
                      >
                        {f.categoria}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-6 py-3.5 text-right font-semibold tabular-nums",
                        f.esIngreso ? "text-secondary" : "text-on-surface"
                      )}
                    >
                      {f.esIngreso ? "+" : "−"}
                      {fmt(f.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )
      ) : deudasVisibles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-14 text-center text-sm font-light text-on-surface-variant">
          No hay deudas {filtroDeuda === "todas" ? "" : `de ${filtroDeuda} `}
          pendientes. ¡Bien ahí!
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-1">
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left">
            <thead className="border-b border-outline-variant bg-surface-container-low">
              <tr className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                <th className="px-6 py-3">Cliente / proveedor</th>
                <th className="px-6 py-3">Nº de factura</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">Vence</th>
                <th className="px-6 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {deudasVisibles.map((d) => (
                <tr key={d.id} className="text-sm transition-colors hover:bg-surface-container">
                  <td className="px-6 py-3.5">
                    <div className="font-semibold text-on-surface">{d.cliente}</div>
                    {d.concepto && (
                      <div className="max-w-64 truncate text-xs font-light text-on-surface-variant">
                        {d.concepto}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3.5 font-light text-on-surface-variant">
                    <Link
                      href={`/facturas/${d.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {d.numero_factura}
                    </Link>
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
                        d.esCobro
                          ? "bg-primary-container/60 text-on-primary-container"
                          : "bg-secondary-container text-on-secondary-container"
                      )}
                    >
                      <Icon
                        name={d.esCobro ? "call_received" : "call_made"}
                        className="text-[13px]"
                      />
                      {d.esCobro ? "Cobro" : "Pago"}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 font-light text-on-surface-variant">
                    {formatearFecha(d.fecha_vencimiento)}
                  </td>
                  <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-on-surface">
                    {fmt(d.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
