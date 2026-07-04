import { Icon } from "@/components/app/icon";
import { categoriasGasto, egresos, fmt } from "@/lib/mock-data";

const iconoOrigen: Record<string, { icono: string; texto: string }> = {
  csv: { icono: "laptop_mac", texto: "CSV" },
  web: { icono: "language", texto: "Web" },
  whatsapp: { icono: "chat_bubble", texto: "WhatsApp" },
};

// Donut SVG con separadores de 2px y etiquetas directas en la leyenda
function DonutCategorias() {
  const r = 40;
  const C = 2 * Math.PI * r;
  const gap = 2.5; // separador visible entre segmentos
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0 -rotate-90" role="img" aria-label="Distribución del gasto por categoría">
        {categoriasGasto.map((c) => {
          const largo = (c.pct / 100) * C - gap;
          const el = (
            <circle
              key={c.nombre}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={c.color}
              strokeWidth="14"
              strokeDasharray={`${largo} ${C - largo}`}
              strokeDashoffset={-offset}
            >
              <title>{`${c.nombre}: ${fmt(c.monto)} (${c.pct}%)`}</title>
            </circle>
          );
          offset += (c.pct / 100) * C;
          return el;
        })}
      </svg>
      <ul className="flex flex-col gap-2">
        {categoriasGasto.map((c) => (
          <li key={c.nombre} className="flex items-center gap-2 text-sm">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: c.color }}
            />
            <span className="font-light text-on-surface-variant">
              {c.nombre}
            </span>
            <span className="ml-auto pl-4 font-semibold tabular-nums text-on-surface">
              {c.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function EgresosPage() {
  const totalGastado = 35200;
  const presupuesto = 54000;
  const pctPresupuesto = Math.round((totalGastado / presupuesto) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">
            Egresos y gastos
          </h1>
          <p className="mt-1 text-lg font-light text-on-surface-variant">
            Cada peso que sale, bajo control.
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          <Icon name="add" className="text-[18px]" />
          Registrar gasto
        </button>
      </div>

      {/* Bento de resumen */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-primary-container bg-surface-container-lowest p-6 transition-colors hover:border-primary">
          <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Total gastado (junio)
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums text-on-surface">
            {fmt(totalGastado)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs font-light text-error">
            <Icon name="arrow_upward" className="text-[14px]" />
            12% más que mayo
          </div>
        </div>

        <div className="rounded-xl border border-primary-container bg-surface-container-lowest p-6 transition-colors hover:border-primary">
          <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Gasto vs presupuesto
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-on-surface">
              {pctPresupuesto}%
            </span>
            <span className="text-xs font-light text-on-surface-variant">
              de {fmt(presupuesto)}
            </span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-1000"
              style={{ width: `${pctPresupuesto}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-primary-container bg-surface-container-lowest p-6 transition-colors hover:border-primary">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Gasto por categoría
          </div>
          <DonutCategorias />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface p-4">
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Filtrar:
        </span>
        {["Todas las categorías", "Junio 2026"].map((f) => (
          <button
            key={f}
            type="button"
            className="flex items-center gap-1 rounded-lg bg-surface-container-high px-3 py-1.5 text-xs font-light text-on-surface-variant transition-colors hover:bg-surface-container-highest"
          >
            {f}
            <Icon name="expand_more" className="text-[16px]" />
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            aria-label="Descargar"
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
          >
            <Icon name="download" className="text-[20px]" />
          </button>
          <button
            type="button"
            aria-label="Imprimir"
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
          >
            <Icon name="print" className="text-[20px]" />
          </button>
        </div>
      </div>

      {/* Tabla de egresos */}
      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-1">
        <table className="w-full text-left">
          <thead className="border-b border-outline-variant bg-surface-container-low">
            <tr className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              <th className="px-6 py-3">Fecha</th>
              <th className="px-6 py-3">Concepto</th>
              <th className="px-6 py-3">Categoría</th>
              <th className="px-6 py-3">Proveedor</th>
              <th className="px-6 py-3 text-right">Monto</th>
              <th className="px-6 py-3">Origen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {egresos.map((e) => {
              const origen = iconoOrigen[e.origen];
              return (
                <tr
                  key={`${e.fecha}-${e.concepto}`}
                  className="text-sm transition-colors hover:bg-surface-container"
                >
                  <td className="px-6 py-3.5 font-light text-on-surface-variant">
                    {e.fecha}
                  </td>
                  <td className="px-6 py-3.5 font-semibold text-on-surface">
                    {e.concepto}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="inline-flex rounded-full bg-primary-container/20 px-2.5 py-1 text-[11px] font-bold text-on-primary-container">
                      {e.categoria}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 font-light text-on-surface-variant">
                    {e.proveedor}
                  </td>
                  <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-on-surface">
                    {fmt(e.monto)}
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1.5 font-light text-on-surface-variant">
                      <Icon name={origen.icono} className="text-[18px]" />
                      {origen.texto}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
