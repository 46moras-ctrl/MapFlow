import { createSupabaseServer } from "@/lib/supabase/server";
import type { FilaDinero } from "@/lib/finanzas";
import {
  MovimientosCliente,
  type DeudaDetalle,
  type TabDetalle,
} from "./movimientos-cliente";

// ============================================================
// DETALLE FINANCIERO — se llega desde los KPIs de Reportes.
// Una sola página con subpestañas: Ingresos | Egresos | Deudas.
// ============================================================

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams?: { tab?: string; desde?: string; hasta?: string };
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

  let filas: FilaDinero[] = [];
  let deudas: DeudaDetalle[] = [];

  if (empresa) {
    const [movs, facts] = await Promise.all([
      supabase
        .from("movimientos")
        .select("id, tipo, monto, descripcion, fecha, categoria, contraparte")
        .eq("id_empresa", empresa.id)
        .in("tipo", ["ingreso", "egreso", "pago"])
        .order("fecha", { ascending: false })
        .limit(2000),
      supabase
        .from("facturas")
        .select("id, numero_factura, cliente, monto, tipo, estado, concepto, fecha_emision, fecha_vencimiento")
        .eq("id_empresa", empresa.id),
    ]);

    filas = [
      ...((movs.data ?? []).map((m) => ({
        id: `m-${m.id}`,
        fecha: m.fecha as string,
        monto: Number(m.monto),
        esIngreso: m.tipo === "ingreso",
        contraparte: (m.contraparte as string) || (m.descripcion as string) || "—",
        categoria:
          (m.categoria as string) || (m.tipo === "ingreso" ? "Ingresos" : "Egresos"),
      })) as FilaDinero[]),
      ...((facts.data ?? [])
        .filter((f) => f.estado === "pagado")
        .map((f) => ({
          id: `f-${f.id}`,
          fecha: (f.fecha_vencimiento ?? f.fecha_emision) as string,
          monto: Number(f.monto),
          esIngreso: f.tipo === "cobrar",
          contraparte: f.cliente as string,
          categoria: f.tipo === "cobrar" ? "Facturas cobradas" : "Facturas pagadas",
        })) as FilaDinero[]),
    ].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

    deudas = (facts.data ?? [])
      .filter((f) => f.estado !== "pagado")
      .map((f) => ({
        id: f.id as string,
        numero_factura: f.numero_factura as string,
        cliente: f.cliente as string,
        concepto: (f.concepto as string) || null,
        monto: Number(f.monto),
        esCobro: f.tipo === "cobrar",
        fecha_vencimiento: (f.fecha_vencimiento ?? f.fecha_emision) as string,
      }))
      .sort((a, b) => (a.fecha_vencimiento < b.fecha_vencimiento ? -1 : 1));
  }

  const tabs: TabDetalle[] = ["ingresos", "egresos", "deudas"];
  const tabInicial: TabDetalle = tabs.includes(searchParams?.tab as TabDetalle)
    ? (searchParams?.tab as TabDetalle)
    : "ingresos";

  // El rango puede llegar en la URL (ej. desde "Ventas realizadas")
  const esISO = (s: string | undefined): s is string =>
    /^\d{4}-\d{2}-\d{2}$/.test(s ?? "");

  return (
    <MovimientosCliente
      filas={filas}
      deudas={deudas}
      tabInicial={tabInicial}
      desdeInicial={esISO(searchParams?.desde) ? searchParams!.desde! : ""}
      hastaInicial={esISO(searchParams?.hasta) ? searchParams!.hasta! : ""}
    />
  );
}
