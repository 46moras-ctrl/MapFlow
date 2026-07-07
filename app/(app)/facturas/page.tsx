import { createSupabaseServer } from "@/lib/supabase/server";
import type { ConfigEmpresa, FacturaDB } from "@/lib/facturas";
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

  // select("*") a propósito: la config de recordatorios vive en
  // columnas que nacen en migraciones; si alguna aún no está
  // aplicada, la app sigue funcionando (campos opcionales).
  const { data: empresa } = await supabase
    .from("empresas")
    .select("*")
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
      config={(empresa ?? {}) as ConfigEmpresa}
      tabInicial={searchParams?.tab === "pagar" ? "pagar" : "cobrar"}
    />
  );
}
