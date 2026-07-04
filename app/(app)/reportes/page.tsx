import { Icon } from "@/components/app/icon";
import { flujoCaja, fmt } from "@/lib/mock-data";

const descargas = [
  { nombre: "Estado de Resultados", icono: "request_quote", tinte: "text-primary" },
  { nombre: "Balance General", icono: "account_balance", tinte: "text-on-secondary-container" },
  { nombre: "Egresos por Categoría", icono: "donut_small", tinte: "text-tertiary" },
];

const resumen = [
  { categoria: "Ventas", ingresos: 45200, egresos: 12450 },
  { categoria: "Consultoría", ingresos: 18900, egresos: 2100 },
  { categoria: "Producto digital", ingresos: 22200, egresos: 6800 },
  { categoria: "Gastos operativos", ingresos: 0, egresos: 8400 },
  { categoria: "Nómina", ingresos: 0, egresos: 14080 },
];

// Barras agrupadas ingresos vs egresos (CSS puro, tooltips nativos)
function BarrasFlujo() {
  const max = 100000;
  return (
    <div>
      <div className="flex h-56 items-end gap-4 border-b border-outline-variant pb-px">
        {flujoCaja.map((d) => (
          <div key={d.mes} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end justify-center gap-[3px]">
              <div
                title={`${d.mes} — Ingresos: ${fmt(d.ingresos)}`}
                className="w-1/3 max-w-6 rounded-t bg-primary transition-opacity hover:opacity-80"
                style={{ height: `${(d.ingresos / max) * 200}px` }}
              />
              <div
                title={`${d.mes} — Egresos: ${fmt(d.egresos)}`}
                className="w-1/3 max-w-6 rounded-t bg-primary-container transition-opacity hover:opacity-80"
                style={{ height: `${(d.egresos / max) * 200}px` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-4">
        {flujoCaja.map((d) => (
          <div
            key={d.mes}
            className="flex-1 text-center text-[11px] font-light text-on-surface-variant"
          >
            {d.mes}
          </div>
        ))}
      </div>
      {/* Leyenda */}
      <div className="mt-4 flex items-center gap-5 text-xs font-light text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-primary" />
          Ingresos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-primary-container" />
          Egresos
        </span>
        <span className="ml-auto">
          Junio: {fmt(86300)} ingresos · {fmt(35200)} egresos
        </span>
      </div>
    </div>
  );
}

export default function ReportesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">
            Reportes y Análisis
          </h1>
          <p className="mt-1 text-lg font-light text-on-surface-variant">
            Entiende hacia dónde va tu negocio.
          </p>
        </div>
        {/* Selector de periodo */}
        <div className="flex rounded-xl bg-surface-container-high p-1">
          {["Mes actual", "Trimestre", "Año", "Personalizado"].map((p, i) => (
            <button
              key={p}
              type="button"
              className={
                i === 0
                  ? "rounded-lg bg-white px-4 py-2 text-xs font-bold text-on-surface shadow-sm"
                  : "rounded-lg px-4 py-2 text-xs font-light text-on-surface-variant transition-colors hover:text-on-surface"
              }
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Gráfica de barras */}
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1 lg:col-span-8">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-bold text-on-surface">
              Flujo de caja mensual
            </h3>
            <span className="text-xs font-light text-on-surface-variant">
              Ene – Jun 2026
            </span>
          </div>
          <BarrasFlujo />
        </div>

        {/* Descargas + Proyección IA */}
        <div className="flex flex-col gap-4 lg:col-span-4">
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1">
            <h3 className="mb-4 text-xl font-bold text-on-surface">
              Descargar reportes
            </h3>
            <ul className="flex flex-col gap-2">
              {descargas.map((d) => (
                <li key={d.nombre}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg border border-outline-variant/60 px-4 py-3 text-left text-sm font-light text-on-surface transition-colors hover:bg-white hover:shadow-level-1"
                  >
                    <Icon name={d.icono} className={`text-[22px] ${d.tinte}`} />
                    {d.nombre}
                    <Icon
                      name="download"
                      className="ml-auto text-[18px] text-on-surface-variant"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-primary p-6 text-white shadow-level-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <Icon name="auto_awesome" filled className="text-[20px]" />
              Proyección de Flujo (IA)
            </div>
            <p className="mt-3 text-sm font-light leading-relaxed text-white/90">
              Con tu ritmo actual de cobros, julio cerraría con un saldo
              estimado de <strong className="font-semibold">{fmt(54800)}</strong>.
            </p>
            <button
              type="button"
              className="mt-4 rounded-xl bg-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-white/25"
            >
              Ver proyección completa
            </button>
          </div>
        </div>
      </div>

      {/* Resumen ejecutivo */}
      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-1">
        <h3 className="px-6 py-4 text-xl font-bold text-on-surface">
          Resumen ejecutivo por categoría
        </h3>
        <table className="w-full text-left">
          <thead className="border-b border-outline-variant bg-surface-container-low">
            <tr className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              <th className="px-6 py-3">Categoría</th>
              <th className="px-6 py-3 text-right">Ingresos</th>
              <th className="px-6 py-3 text-right">Egresos</th>
              <th className="px-6 py-3 text-right">Neto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {resumen.map((r) => {
              const neto = r.ingresos - r.egresos;
              return (
                <tr
                  key={r.categoria}
                  className="text-sm transition-colors hover:bg-surface-container"
                >
                  <td className="px-6 py-3.5 font-semibold text-on-surface">
                    {r.categoria}
                  </td>
                  <td className="px-6 py-3.5 text-right font-light tabular-nums text-on-surface-variant">
                    {r.ingresos ? fmt(r.ingresos) : "—"}
                  </td>
                  <td className="px-6 py-3.5 text-right font-light tabular-nums text-on-surface-variant">
                    {r.egresos ? fmt(r.egresos) : "—"}
                  </td>
                  <td
                    className={`px-6 py-3.5 text-right font-semibold tabular-nums ${
                      neto >= 0 ? "text-secondary" : "text-error"
                    }`}
                  >
                    {neto >= 0 ? "+" : "−"}
                    {fmt(Math.abs(neto))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer atmosférico */}
      <div className="relative overflow-hidden rounded-2xl border border-primary-container bg-gradient-to-r from-primary-container/40 via-surface-container-low to-primary-container/20 p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-primary-container/40 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xl font-bold text-on-surface">
              <Icon name="map" filled className="text-[24px] text-primary" />
              Análisis de Ubicación Geográfica
            </div>
            <p className="mt-1 max-w-xl text-sm font-light text-on-surface-variant">
              Descubre en qué zonas se concentran tus ventas y tus clientes
              morosos con el mapa interactivo de MapFlow Insights.
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            Abrir MapFlow Insights
          </button>
        </div>
      </div>
    </div>
  );
}
