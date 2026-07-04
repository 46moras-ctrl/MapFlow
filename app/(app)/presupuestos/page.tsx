import { Icon } from "@/components/app/icon";
import { StatusBadge } from "@/components/app/status-badge";
import { fmt, presupuestos } from "@/lib/mock-data";

export default function PresupuestosPage() {
  const topeTotal = presupuestos.reduce((s, p) => s + p.tope, 0);
  const gastadoTotal = presupuestos.reduce((s, p) => s + p.gastado, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">
            Presupuestos
          </h1>
          <p className="mt-1 text-lg font-light text-on-surface-variant">
            Ponle un tope a cada categoría y recibe alertas antes de pasarte.
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          <Icon name="add" className="text-[18px]" />
          Nuevo presupuesto
        </button>
      </div>

      {/* Resumen */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1">
          <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Presupuesto mensual total
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums text-on-surface">
            {fmt(topeTotal)}
          </div>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1">
          <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Gastado en junio
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums text-on-surface">
            {fmt(gastadoTotal)}
          </div>
          <div className="mt-1 text-xs font-light text-on-surface-variant">
            {Math.round((gastadoTotal / topeTotal) * 100)}% del total
          </div>
        </div>
        <div className="rounded-xl border border-primary-container bg-primary-container/20 p-6">
          <div className="text-xs font-bold uppercase tracking-wider text-on-primary-container">
            Disponible
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums text-on-primary-container">
            {fmt(topeTotal - gastadoTotal)}
          </div>
          <div className="mt-1 text-xs font-light text-on-primary-container/80">
            para lo que resta del mes
          </div>
        </div>
      </div>

      {/* Cards por categoría */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {presupuestos.map((p) => {
          const pct = Math.round((p.gastado / p.tope) * 100);
          const enAlerta = pct >= p.alertaPct;
          return (
            <div
              key={p.categoria}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1 transition-colors hover:border-primary-container"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-on-surface">
                    {p.categoria}
                  </h3>
                  <div className="text-xs font-light text-on-surface-variant">
                    {p.periodo} · alerta al {p.alertaPct}%
                  </div>
                </div>
                <StatusBadge estado={enAlerta ? "optimizar" : "estable"} />
              </div>

              <div className="mt-4 flex items-baseline justify-between text-sm">
                <span className="font-semibold tabular-nums text-on-surface">
                  {fmt(p.gastado)}
                </span>
                <span className="font-light tabular-nums text-on-surface-variant">
                  de {fmt(p.tope)}
                </span>
              </div>
              <div
                className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${p.categoria}: ${pct}% del presupuesto usado`}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-1000 ${
                    enAlerta ? "bg-error" : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span
                  className={`font-semibold ${
                    enAlerta ? "text-error" : "text-on-surface-variant"
                  }`}
                >
                  {pct}% utilizado
                </span>
                <span className="font-light text-on-surface-variant">
                  quedan {fmt(p.tope - p.gastado)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
