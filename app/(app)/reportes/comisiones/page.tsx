import { redirect } from "next/navigation";
import {
  hayComisiones,
  normalizarConfigComisiones,
  type ConfigComisiones,
  type EmpleadoDB,
} from "@/lib/nomina";
import { configurarMoneda } from "@/lib/moneda";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  ComisionesCliente,
  type LiquidacionDB,
  type VentaComision,
} from "./comisiones-cliente";

// ============================================================
// REPORTES → COMISIONES — solo existe con roles comisionables
// configurados en Ajustes → Nómina. El servidor entrega las
// ventas con vendedor, los empleados y el historial; el cliente
// arma el acordeón por empleado y la liquidación.
// ============================================================

export default async function ComisionesPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("*")
    .eq("id_usuario", user?.id ?? "")
    .maybeSingle();

  const config = (empresa?.config_comisiones as ConfigComisiones | null) ?? null;
  if (!empresa || !hayComisiones(config)) redirect("/reportes");
  configurarMoneda(empresa.moneda);

  const [emp, ventas, liq] = await Promise.all([
    supabase
      .from("empleados")
      .select("*")
      .eq("id_empresa", empresa.id)
      .order("nombre", { ascending: true }),
    supabase
      .from("facturas")
      .select(
        "id, numero_factura, cliente, concepto, monto, fecha_emision, id_vendedor, comision_porcentaje, comision_liquidada"
      )
      .eq("id_empresa", empresa.id)
      .eq("tipo", "cobrar")
      .not("id_vendedor", "is", null)
      .order("fecha_emision", { ascending: false }),
    supabase
      .from("liquidaciones_comision")
      .select("*")
      .eq("id_empresa", empresa.id)
      .order("created_at", { ascending: false }),
  ]);

  const n = normalizarConfigComisiones(config);
  return (
    <ComisionesCliente
      empleados={(emp.data as EmpleadoDB[]) ?? []}
      ventas={(ventas.data as VentaComision[]) ?? []}
      liquidaciones={(liq.data as LiquidacionDB[]) ?? []}
      metas={n.modalidad === "metas" ? n.metas : []}
      modalidad={n.modalidad}
    />
  );
}
