import Link from "next/link";
import { Icon } from "@/components/app/icon";
import { fmt, formatearFecha, hoyISO } from "@/lib/facturas";
import { createSupabaseServer } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

// ============================================================
// VENTAS — resumen de TODOS los ingresos y cobros del periodo,
// pagados o pendientes, agrupados por día (cada día inicia a
// las 00:00; manda la FECHA DE EMISIÓN = el día de la venta).
// Se llega desde el "Ver detalle" del Dashboard (día de hoy)
// y tiene filtros: hoy, ayer, 7 días, 15 días, 30 días.
// ============================================================

type Rango = "hoy" | "ayer" | "semana" | "quincena" | "mes";

function restarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(fecha) - dias * 86400000).toISOString().slice(0, 10);
}

const RANGOS: { id: Rango; label: string; dias: number }[] = [
  { id: "hoy", label: "Hoy", dias: 0 },
  { id: "ayer", label: "Ayer", dias: 1 },
  { id: "semana", label: "7 días", dias: 7 },
  { id: "quincena", label: "15 días", dias: 15 },
  { id: "mes", label: "30 días", dias: 30 },
];

export default async function VentasPage({
  searchParams,
}: {
  searchParams?: { rango?: string; desde?: string; hasta?: string };
}) {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nombre")
    .eq("id_usuario", user?.id ?? "")
    .maybeSingle();

  const hoy = hoyISO();
  const esISO = (s: string | undefined): s is string => /^\d{4}-\d{2}-\d{2}$/.test(s ?? "");

  // Rango elegido: personalizado (calendario) o botones rápidos
  const personalizado = esISO(searchParams?.desde) && esISO(searchParams?.hasta);
  const rango: Rango =
    RANGOS.find((r) => r.id === searchParams?.rango)?.id ?? "hoy";

  let desde: string;
  let hasta: string;
  if (personalizado) {
    desde = searchParams!.desde!;
    hasta = searchParams!.hasta!;
  } else if (rango === "hoy") {
    desde = hoy;
    hasta = hoy;
  } else if (rango === "ayer") {
    desde = restarDias(hoy, 1);
    hasta = desde;
  } else {
    const dias = RANGOS.find((r) => r.id === rango)!.dias;
    desde = restarDias(hoy, dias);
    hasta = hoy;
  }

  const titulo = personalizado
    ? "Ventas"
    : rango === "hoy"
      ? "Ventas de hoy"
      : rango === "ayer"
        ? "Ventas de ayer"
        : rango === "semana"
          ? "Ventas de los últimos 7 días"
          : rango === "quincena"
            ? "Ventas de los últimos 15 días"
            : "Ventas de los últimos 30 días";

  interface Venta {
    id: string;
    fecha: string;
    contraparte: string;
    detalle: string;
    monto: number;
  }
  let ventas: Venta[] = [];

  if (empresa) {
    // Movimientos de ingreso en el rango
    const movs = await supabase
      .from("movimientos")
      .select("id, fecha, monto, contraparte, descripcion, categoria")
      .eq("id_empresa", empresa.id)
      .eq("tipo", "ingreso")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false });

    // TODOS los cobros EMITIDOS en el rango, pagados o pendientes:
    // la venta cuenta el día que se hizo (fecha_emision), sin
    // importar cuándo se pague. Un cobro viejo pagado hoy no entra.
    const facts = await supabase
      .from("facturas")
      .select("id, cliente, monto, concepto, estado, fecha_emision")
      .eq("id_empresa", empresa.id)
      .eq("tipo", "cobrar")
      .gte("fecha_emision", desde)
      .lte("fecha_emision", hasta);

    // SOLO INGRESOS: aunque las consultas ya filtran por tipo,
    // este candado descarta cualquier monto no positivo que se
    // hubiera colado (aquí se habla de ventas, jamás de egresos).
    ventas = [
      ...((movs.data ?? []).map((m) => ({
        id: `m-${m.id}`,
        fecha: m.fecha as string,
        contraparte: (m.contraparte as string) || "—",
        detalle: (m.descripcion as string) || (m.categoria as string) || "Ingreso",
        monto: Number(m.monto),
      })) as Venta[]),
      ...((facts.data ?? []).map((f) => ({
        id: `f-${f.id}`,
        fecha: f.fecha_emision as string,
        contraparte: f.cliente as string,
        detalle:
          ((f.concepto as string) || "Factura de cobro") +
          (f.estado === "pagado" ? "" : " · pendiente"),
        monto: Number(f.monto),
      })) as Venta[]),
    ]
      .filter((v) => v.monto > 0)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }

  // Resumen por día (cada día inicia a las 00:00)
  const dias = new Map<string, { cantidad: number; total: number }>();
  for (const v of ventas) {
    const d = dias.get(v.fecha) ?? { cantidad: 0, total: 0 };
    d.cantidad++;
    d.total += v.monto;
    dias.set(v.fecha, d);
  }
  const resumenDias = Array.from(dias.entries()).sort((a, b) =>
    a[0] < b[0] ? 1 : -1
  );
  const totalVentas = ventas.length;
  const montoTotal = ventas.reduce((s, v) => s + v.monto, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">
            {titulo}
          </h1>
          <p className="mt-1 text-lg font-light text-on-surface-variant">
            {desde === hasta
              ? `Ingresos del ${formatearFecha(desde)}.`
              : `Ingresos del ${formatearFecha(desde)} al ${formatearFecha(hasta)}.`}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant"
        >
          <Icon name="arrow_back" className="text-[16px]" />
          Volver
        </Link>
      </div>

      {/* Filtros rápidos + calendario personalizado */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface p-4">
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Ver:
        </span>
        {RANGOS.map((r) => (
          <Link
            key={r.id}
            href={`/ventas?rango=${r.id}`}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs transition-colors",
              !personalizado && rango === r.id
                ? "bg-primary font-bold text-on-primary"
                : "bg-surface-container-high font-light text-on-surface-variant hover:bg-surface-container-highest"
            )}
          >
            {r.label}
          </Link>
        ))}
        {/* Calendario: rango a la medida (envía por GET) */}
        <form action="/ventas" className="ml-auto flex flex-wrap items-center gap-2">
          <Icon name="calendar_month" className="text-[20px] text-on-surface-variant" />
          <input
            type="date"
            name="desde"
            required
            defaultValue={personalizado ? desde : ""}
            aria-label="Desde"
            className="rounded-lg border border-primary-container bg-surface-container-low p-2 text-sm font-light text-on-surface outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-xs font-light text-on-surface-variant">a</span>
          <input
            type="date"
            name="hasta"
            required
            defaultValue={personalizado ? hasta : ""}
            aria-label="Hasta"
            className="rounded-lg border border-primary-container bg-surface-container-low p-2 text-sm font-light text-on-surface outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90"
          >
            Filtrar
          </button>
        </form>
      </div>

      {/* Totales del periodo */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Clic → Detalle financiero (Ingresos) con ESTE mismo rango */}
        <Link
          href={`/movimientos?tab=ingresos&desde=${desde}&hasta=${hasta}`}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1 transition-colors hover:border-primary"
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Ventas realizadas
            <Icon name="arrow_forward" className="text-[16px] text-primary" />
          </div>
          <div className="mt-2 text-4xl font-bold tabular-nums text-on-surface">
            {totalVentas}
          </div>
          <div className="mt-1 text-xs font-bold uppercase tracking-wider text-primary">
            Ver detalle de ingresos
          </div>
        </Link>
        <div className="rounded-xl border border-secondary-container bg-secondary-container/30 p-6 shadow-level-1">
          <div className="text-xs font-bold uppercase tracking-wider text-on-secondary-container">
            Monto total
          </div>
          <div className="mt-2 text-4xl font-bold tabular-nums text-on-surface">
            {fmt(montoTotal)}
          </div>
        </div>
      </div>

      {/* Resumen por día */}
      {ventas.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-16 text-center">
          <Icon name="storefront" className="text-[40px] text-outline" />
          <p className="mt-3 text-sm font-light text-on-surface-variant">
            No hay ventas registradas en este periodo.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-1">
          <h3 className="px-6 py-4 text-xl font-bold text-on-surface">
            Resumen
          </h3>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left">
            <thead className="border-b border-outline-variant bg-surface-container-low">
              <tr className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                <th className="px-6 py-3">Día</th>
                <th className="px-6 py-3 text-right">Ventas</th>
                <th className="px-6 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {resumenDias.map(([fecha, d]) => (
                <tr key={fecha} className="text-sm transition-colors hover:bg-surface-container">
                  <td className="px-6 py-3.5 font-semibold text-on-surface">
                    {formatearFecha(fecha)}
                  </td>
                  <td className="px-6 py-3.5 text-right font-light tabular-nums text-on-surface-variant">
                    {d.cantidad}
                  </td>
                  <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-secondary">
                    {fmt(d.total)}
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
