export const runtime = "edge";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { FilaDinero } from "@/lib/finanzas";
import { hayComisiones, type ConfigComisiones } from "@/lib/nomina";
import { ReportesCliente, type DeudaMin } from "./reportes-cliente";

// ============================================================
// REPORTES — el servidor entrega los datos crudos de la empresa
// (aislados por id_empresa) y el cliente aplica el filtro de
// tiempo (1/3/6 meses, 1 año, total o calendario a la medida).
// ============================================================

export default async function ReportesPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // select("*"): mostrar_presupuestos nace en una migración y la
  // página no debe romperse si aún no está aplicada
  const { data: empresa } = await supabase
    .from("empresas")
    .select("*")
    .eq("id_usuario", user?.id ?? "")
    .maybeSingle();

  let filas: FilaDinero[] = [];
  let deudas: DeudaMin[] = [];
  let presupuestoMensual = 0;

  if (empresa) {
    const [movs, facts, pres] = await Promise.all([
      supabase
        .from("movimientos")
        .select("id, tipo, monto, descripcion, fecha, categoria, contraparte")
        .eq("id_empresa", empresa.id)
        .in("tipo", ["ingreso", "egreso", "pago"])
        .order("fecha", { ascending: false })
        .limit(2000),
      supabase
        .from("facturas")
        .select("id, cliente, monto, tipo, estado, fecha_emision, fecha_vencimiento")
        .eq("id_empresa", empresa.id),
      supabase
        .from("presupuestos")
        .select("categoria, monto_tope, periodo")
        .eq("id_empresa", empresa.id),
    ]);

    // Filas de dinero: movimientos + facturas pagadas (no hay doble
    // conteo: pagar una factura no genera movimiento automático)
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
    ];

    deudas = (facts.data ?? [])
      .filter((f) => f.estado !== "pagado")
      .map((f) => ({
        fecha: (f.fecha_vencimiento ?? f.fecha_emision) as string,
        monto: Number(f.monto),
        esCobro: f.tipo === "cobrar",
      }));

    presupuestoMensual = (pres.data ?? [])
      .filter((p) => p.periodo === "mensual")
      .reduce((s, p) => s + Number(p.monto_tope), 0);
  }

  return (
    <ReportesCliente
      nombreEmpresa={empresa?.nombre ?? null}
      filas={filas}
      deudas={deudas}
      presupuestoMensual={presupuestoMensual}
      mostrarPresupuestos={Boolean(empresa?.mostrar_presupuestos)}
      hayComisiones={hayComisiones(
        (empresa?.config_comisiones as ConfigComisiones | null) ?? null
      )}
    />
  );
}
