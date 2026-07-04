import Link from "next/link";
import { Icon } from "@/components/app/icon";
import { StatusBadge } from "@/components/app/status-badge";
import {
  facturas,
  flujoCaja,
  fmt,
  iniciales,
  kpisDashboard,
} from "@/lib/mock-data";

const kpis = [
  {
    label: "Total por cobrar",
    valor: kpisDashboard.totalPorCobrar,
    icono: "account_balance_wallet",
    tinte: "bg-primary-container/40 text-on-primary-container",
    tendencia: "8 facturas abiertas",
  },
  {
    label: "Total vencido",
    valor: kpisDashboard.totalVencido,
    icono: "warning",
    tinte: "bg-error-container text-on-error-container",
    tendencia: "3 facturas vencidas",
  },
  {
    label: "Ingresos del mes",
    valor: kpisDashboard.ingresosMes,
    icono: "trending_up",
    tinte: "bg-secondary-container/60 text-on-secondary-container",
    tendencia: "+29% vs mayo",
  },
  {
    label: "Egresos del mes",
    valor: kpisDashboard.egresosMes,
    icono: "payments",
    tinte: "bg-surface-container-high text-on-surface-variant",
    tendencia: "-25% vs mayo",
  },
];

// Línea de saldo neto (ingresos - egresos) — una sola serie
function LineaFlujoCaja() {
  const datos = flujoCaja.map((d) => ({
    mes: d.mes,
    saldo: d.ingresos - d.egresos,
  }));
  const max = 40000;
  const W = 560;
  const H = 200;
  const padX = 36;
  const padY = 16;
  const paso = (W - padX * 2) / (datos.length - 1);
  const y = (v: number) => H - padY - (v / max) * (H - padY * 2);
  const puntos = datos.map((d, i) => ({
    x: padX + i * paso,
    y: y(d.saldo),
    ...d,
  }));
  const path = puntos
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 24}`}
      className="w-full"
      role="img"
      aria-label="Saldo neto mensual de enero a junio"
    >
      {/* Rejilla recesiva */}
      {[0, 10000, 20000, 30000, 40000].map((v) => (
        <g key={v}>
          <line
            x1={padX}
            x2={W - padX}
            y1={y(v)}
            y2={y(v)}
            stroke="#E3E2DE"
            strokeWidth="1"
          />
          <text
            x={padX - 6}
            y={y(v) + 3}
            textAnchor="end"
            className="fill-on-surface-variant text-[9px] font-light"
          >
            {v / 1000}k
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#4E6544" strokeWidth="2" />
      {puntos.map((p) => (
        <g key={p.mes}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#FFFFFF" stroke="#4E6544" strokeWidth="2" />
          {/* Área de hover amplia con tooltip nativo */}
          <circle cx={p.x} cy={p.y} r="14" fill="transparent">
            <title>{`${p.mes}: ${fmt(p.saldo)} de saldo neto`}</title>
          </circle>
          <text
            x={p.x}
            y={H + 16}
            textAnchor="middle"
            className="fill-on-surface-variant text-[10px] font-light"
          >
            {p.mes}
          </text>
        </g>
      ))}
      {/* Etiqueta directa solo en el último punto */}
      <text
        x={puntos[puntos.length - 1].x}
        y={puntos[puntos.length - 1].y - 10}
        textAnchor="end"
        className="fill-on-surface text-[11px] font-semibold"
      >
        {fmt(datos[datos.length - 1].saldo)}
      </text>
    </svg>
  );
}

export default function DashboardPage() {
  const pendientes = facturas.filter((f) => f.estado !== "pagada").slice(0, 4);
  const recientes = facturas.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-on-surface">
          Hola, María 👋
        </h1>
        <p className="mt-1 text-lg font-light text-on-surface-variant">
          Así se ve la salud financiera de tu negocio hoy.
        </p>
      </div>

      {/* KPI Cards — Bento Grid */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {k.label}
                </div>
                <div className="mt-2 text-3xl font-bold tabular-nums text-on-surface">
                  {fmt(k.valor)}
                </div>
                <div className="mt-1 text-xs font-light text-on-surface-variant">
                  {k.tendencia}
                </div>
              </div>
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full ${k.tinte}`}
              >
                <Icon name={k.icono} className="text-[26px]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Flujo de caja + Facturas pendientes */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-on-surface">
              Flujo de caja — saldo neto
            </h3>
            <span className="text-xs font-light text-on-surface-variant">
              Ene – Jun 2026
            </span>
          </div>
          <LineaFlujoCaja />
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-on-surface">
              Facturas pendientes
            </h3>
            <Link
              href="/facturas"
              className="text-xs font-bold uppercase tracking-wider text-primary hover:underline"
            >
              Ver todas
            </Link>
          </div>
          <ul className="divide-y divide-outline-variant">
            {pendientes.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/facturas/${f.id}`}
                  className="flex items-center gap-3 py-3 transition-colors hover:bg-surface-container"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
                    {iniciales(f.cliente)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-on-surface">
                      {f.cliente}
                    </span>
                    <span className="block text-xs font-light text-on-surface-variant">
                      {f.id} · vence {f.vencimiento}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-on-surface">
                    {fmt(f.monto)}
                  </span>
                  <StatusBadge estado={f.estado} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Últimas transacciones */}
      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-1">
        <div className="flex items-center justify-between px-6 py-4">
          <h3 className="text-xl font-bold text-on-surface">
            Últimas transacciones
          </h3>
          <Link
            href="/facturas"
            className="text-xs font-bold uppercase tracking-wider text-primary hover:underline"
          >
            Ver movimientos
          </Link>
        </div>
        <table className="w-full text-left">
          <thead className="border-b border-outline-variant bg-surface-container-low">
            <tr className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              <th className="px-6 py-3">Cliente</th>
              <th className="px-6 py-3">Factura</th>
              <th className="px-6 py-3">Emisión</th>
              <th className="px-6 py-3 text-right">Monto</th>
              <th className="px-6 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {recientes.map((f) => (
              <tr
                key={f.id}
                className="text-sm transition-colors hover:bg-surface-container"
              >
                <td className="px-6 py-3.5 font-semibold text-on-surface">
                  {f.cliente}
                </td>
                <td className="px-6 py-3.5 font-light text-on-surface-variant">
                  {f.id}
                </td>
                <td className="px-6 py-3.5 font-light text-on-surface-variant">
                  {f.emision}
                </td>
                <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-on-surface">
                  {fmt(f.monto)}
                </td>
                <td className="px-6 py-3.5">
                  <StatusBadge estado={f.estado} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
