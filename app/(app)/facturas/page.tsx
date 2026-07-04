import Link from "next/link";
import { Icon } from "@/components/app/icon";
import { StatusBadge } from "@/components/app/status-badge";
import { facturas, fmt, iniciales } from "@/lib/mock-data";

export default function FacturasPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">
            Cuentas por cobrar
          </h1>
          <p className="mt-1 text-lg font-light text-on-surface-variant">
            Da seguimiento a tus facturas y recupera tu dinero a tiempo.
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          <Icon name="add" className="text-[18px]" />
          Nueva factura
        </button>
      </div>

      {/* Summary Bento — 3 columnas */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1">
          <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Total por cobrar
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums text-on-surface">
            {fmt(125400)}
          </div>
          <div className="mt-1 text-xs font-light text-on-surface-variant">
            8 facturas abiertas
          </div>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1">
          <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Total vencido
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums text-error">
            {fmt(42100)}
          </div>
          <div className="mt-1 text-xs font-light text-on-surface-variant">
            3 facturas requieren acción
          </div>
        </div>
        <div className="rounded-xl border border-primary-container bg-primary-container/20 p-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-primary-container">
            <Icon name="trending_up" className="text-[18px]" />
            Eficiencia de cobro
          </div>
          <div className="mt-2 text-3xl font-bold text-on-primary-container">
            +12%
          </div>
          <div className="mt-1 text-xs font-light text-on-primary-container/80">
            más rápido que el trimestre anterior
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface p-4">
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Filtrar:
        </span>
        {["Todas", "Pendientes", "Vencidas", "Pagadas"].map((f, i) => (
          <button
            key={f}
            type="button"
            className={
              i === 0
                ? "rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary"
                : "rounded-lg bg-surface-container-high px-3 py-1.5 text-xs font-light text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            }
          >
            {f}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-sm font-light text-on-surface-variant">
          <Icon name="calendar_month" className="text-[20px]" />
          Últimos 90 días
          <Icon name="expand_more" className="text-[20px]" />
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-1">
        <table className="w-full text-left">
          <thead className="border-b border-outline-variant bg-surface-container-low">
            <tr className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              <th className="px-6 py-3">Cliente</th>
              <th className="px-6 py-3">N° factura</th>
              <th className="px-6 py-3 text-right">Monto</th>
              <th className="px-6 py-3">Emisión</th>
              <th className="px-6 py-3">Vencimiento</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {facturas.map((f) => (
              <tr
                key={f.id}
                className="group text-sm transition-colors hover:bg-surface-container"
              >
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
                      {iniciales(f.cliente)}
                    </span>
                    <span className="font-semibold text-on-surface">
                      {f.cliente}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-3.5 font-light text-on-surface-variant">
                  {f.id}
                </td>
                <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-on-surface">
                  {fmt(f.monto)}
                </td>
                <td className="px-6 py-3.5 font-light text-on-surface-variant">
                  {f.emision}
                </td>
                <td className="px-6 py-3.5 font-light text-on-surface-variant">
                  {f.vencimiento}
                </td>
                <td className="px-6 py-3.5">
                  <StatusBadge estado={f.estado} />
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link
                      href={`/facturas/${f.id}`}
                      aria-label={`Ver detalle de ${f.id}`}
                      className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant hover:text-primary"
                    >
                      <Icon name="visibility" className="text-[20px]" />
                    </Link>
                    <button
                      type="button"
                      aria-label={`Enviar recordatorio por WhatsApp de ${f.id}`}
                      className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant hover:text-secondary"
                    >
                      <Icon name="chat_bubble" className="text-[20px]" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Paginación */}
        <div className="flex items-center justify-between border-t border-outline-variant bg-surface-container-low px-6 py-3">
          <span className="text-xs font-light text-on-surface-variant">
            Mostrando 1–8 de 124 facturas
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-light text-on-surface-variant hover:bg-surface-variant"
            >
              Anterior
            </button>
            {["1", "2", "3"].map((n, i) => (
              <button
                key={n}
                type="button"
                className={
                  i === 0
                    ? "rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary"
                    : "rounded-lg px-3 py-1.5 text-xs font-light text-on-surface-variant hover:bg-surface-variant"
                }
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-light text-on-surface-variant hover:bg-surface-variant"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
