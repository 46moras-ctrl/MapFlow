import { createSupabaseServer } from "@/lib/supabase/server";
import { PendientesCliente, type PlanConFactura } from "./pendientes-cliente";
import type { TipoPlan } from "@/lib/planes-pago";

export default async function PendientesPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
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

  let planes: PlanConFactura[] = [];
  let migracionPendiente = false;
  if (empresa) {
    const { data, error } = await supabase
      .from("planes_pago")
      .select("*, factura:facturas(*)")
      .eq("id_empresa", empresa.id)
      // Solo lo ACTIVO: al completarse, el plan sale de esta lista
      .eq("estado", "activo")
      .order("created_at", { ascending: false });
    // 42P01 = la tabla no existe todavía: falta la migración
    if (error?.code === "42P01") migracionPendiente = true;
    else planes = (data as PlanConFactura[]) ?? [];
  }

  const tabInicial: TipoPlan =
    searchParams?.tab === "pago" ? "pago" : "cobro";

  return (
    <PendientesCliente
      planes={planes}
      migracionPendiente={migracionPendiente}
      tabInicial={tabInicial}
    />
  );
}

