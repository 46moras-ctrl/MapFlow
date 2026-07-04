import { createSupabaseServer } from "@/lib/supabase/server";
import type { FacturaDB } from "@/lib/facturas";
import { FacturasCliente } from "./facturas-cliente";

export default async function FacturasPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const supabase = createSupabaseServer();

  // El middleware garantiza que hay sesión; aquí buscamos la empresa
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nombre")
    .eq("id_usuario", user?.id ?? "")
    .maybeSingle();

  let facturas: FacturaDB[] = [];
  if (empresa) {
    const { data } = await supabase
      .from("facturas")
      .select("*")
      .eq("id_empresa", empresa.id)
      .order("created_at", { ascending: false });
    facturas = (data as FacturaDB[]) ?? [];
  }

  return (
    <FacturasCliente
      facturas={facturas}
      nombreEmpresa={empresa?.nombre ?? null}
      tabInicial={searchParams?.tab === "pagar" ? "pagar" : "cobrar"}
    />
  );
}
