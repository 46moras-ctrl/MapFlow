import Link from "next/link";
import { GraficaFlujo } from "@/components/app/grafica-flujo";
import { Icon } from "@/components/app/icon";
import { fmt, hoyISO } from "@/lib/facturas";
import { construirFlujo, ultimosMeses, type FilaDinero } from "@/lib/finanzas";
import { createSupabaseServer } from "@/lib/supabase/server";

// ============================================================
// DASHBOARD — bienvenida simple con resumen (datos reales):
//   1. Saludo con el nombre.
//   2. Gráfica de resumen (curva wave-bar, compartida con Reportes).
//   3. Pendientes de cobros / pagos SOLO como número.
//   4. "Ventas de hoy" = cobros pagados del día.
// ============================================================

export default async function DashboardPage() {
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

  let porCobrar = 0;
  let porPagar = 0;
  let ventasHoy = 0;
  let totalVentasHoy = 0;
  let filas: FilaDinero[] = [];
  let deudas: { fecha: string; monto: number }[] = [];

  if (empresa) {
    const [cobrosRes, pagosRes, ventasMovsRes, ventasFactsRes, movsRes, factsRes] = await Promise.all([
      // Cobros pendientes: los MISMOS planes activos que lista la
      // pestaña Pendientes (todo lo registrado, no solo lo del día)
      supabase
        .from("planes_pago")
        .select("id", { count: "exact", head: true })
        .eq("id_empresa", empresa.id)
        .eq("tipo", "cobro")
        .eq("estado", "activo"),
      // Pagos pendientes (ídem)
      supabase
        .from("planes_pago")
        .select("id", { count: "exact", head: true })
        .eq("id_empresa", empresa.id)
        .eq("tipo", "pago")
        .eq("estado", "activo"),
      // Ventas de hoy: TODO ingreso registrado con fecha de HOY,
      // sin importar su estado
      supabase
        .from("movimientos")
        .select("monto")
        .eq("id_empresa", empresa.id)
        .eq("tipo", "ingreso")
        .eq("fecha", hoy),
      // Ventas de hoy: facturas de cobro EMITIDAS hoy (pagadas o
      // pendientes; un cobro viejo pagado hoy NO cuenta)
      supabase
        .from("facturas")
        .select("monto")
        .eq("id_empresa", empresa.id)
        .eq("tipo", "cobrar")
        .eq("fecha_emision", hoy),
      // Para la gráfica: todos los movimientos
      supabase
        .from("movimientos")
        .select("id, tipo, monto, fecha")
        .eq("id_empresa", empresa.id)
        .in("tipo", ["ingreso", "egreso", "pago"])
        .limit(1000),
      // Para la gráfica: todas las facturas (pagadas alimentan
      // ingresos/egresos; las no pagadas, la serie de deudas)
      supabase
        .from("facturas")
        .select("id, tipo, monto, estado, fecha_emision, fecha_vencimiento")
        .eq("id_empresa", empresa.id),
    ]);
    porCobrar = cobrosRes.count ?? 0;
    porPagar = pagosRes.count ?? 0;

    const ingresosDia = ventasMovsRes.data ?? [];
    const cobrosDia = ventasFactsRes.data ?? [];
    ventasHoy = ingresosDia.length + cobrosDia.length;
    totalVentasHoy =
      ingresosDia.reduce((s, v) => s + Number(v.monto), 0) +
      cobrosDia.reduce((s, f) => s + Number(f.monto), 0);

    const facturas = factsRes.data ?? [];
    filas = [
      ...(movsRes.data ?? []).map((m) => ({
        id: `m-${m.id}`,
        fecha: m.fecha as string,
        monto: Number(m.monto),
        esIngreso: m.tipo === "ingreso",
        contraparte: "",
        categoria: "",
      })),
      ...facturas
        .filter((f) => f.estado === "pagado")
        .map((f) => ({
          id: `f-${f.id}`,
          fecha: (f.fecha_vencimiento ?? f.fecha_emision) as string,
          monto: Number(f.monto),
          esIngreso: f.tipo === "cobrar",
          contraparte: "",
          categoria: "",
        })),
    ];
    // Serie de deudas: facturas sin pagar, por mes de vencimiento
    deudas = facturas
      .filter((f) => f.estado !== "pagado")
      .map((f) => ({
        fecha: (f.fecha_vencimiento ?? f.fecha_emision) as string,
        monto: Number(f.monto),
      }));
  }

  const flujo = construirFlujo(ultimosMeses(12, hoy), filas, deudas, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Bienvenida */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-on-surface">
          Hola, {empresa?.nombre ?? "bienvenida"}
        </h1>
        <p className="mt-1 text-lg font-light text-on-surface-variant">
          Bienvenida a MapFlow. Este es el pulso de tu negocio hoy.
        </p>
      </div>

      {/* 3 + 4. Números de pendientes y ventas de ayer */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Link
          href="/pendientes?tab=cobro"
          className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1 transition-colors hover:border-primary"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            <Icon name="call_received" className="text-[18px]" />
            Cobros
          </div>
          <div className="mt-2 text-4xl font-bold tabular-nums text-on-surface">
            {porCobrar}
          </div>
          <div className="mt-1 text-xs font-light text-on-surface-variant">
            cobro{porCobrar === 1 ? "" : "s"} pendiente{porCobrar === 1 ? "" : "s"} en Pendientes
          </div>
        </Link>
        <Link
          href="/pendientes?tab=pago"
          className="rounded-xl border border-primary-container bg-primary-fixed/40 p-6 shadow-level-1 transition-colors hover:border-primary"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            <Icon name="call_made" className="text-[18px]" />
            Pagos
          </div>
          <div className="mt-2 text-4xl font-bold tabular-nums text-on-surface">
            {porPagar}
          </div>
          <div className="mt-1 text-xs font-light text-on-surface-variant">
            pago{porPagar === 1 ? "" : "s"} pendiente{porPagar === 1 ? "" : "s"} en Pendientes
          </div>
        </Link>
        <div className="rounded-xl border border-secondary-container bg-secondary-container/30 p-6 shadow-level-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-secondary-container">
            <Icon name="storefront" className="text-[18px]" />
            Ventas de hoy
          </div>
          <div className="mt-2 text-4xl font-bold tabular-nums text-on-surface">
            {ventasHoy}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs font-light text-on-surface-variant">
            <span>
              {ventasHoy === 0
                ? "sin ventas registradas hoy"
                : `${fmt(totalVentasHoy)} en total`}
            </span>
            <Link
              href="/ventas?rango=hoy"
              className="font-bold uppercase tracking-wider text-primary hover:underline"
            >
              Ver detalle
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Gráfica de resumen (compartida con Reportes) */}
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-on-surface">Flujo de caja</h3>
          <span className="text-xs font-light text-on-surface-variant">
            Últimos 12 meses
          </span>
        </div>
        <GraficaFlujo datos={flujo} />
      </div>
    </div>
  );
}
