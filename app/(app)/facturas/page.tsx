import { createSupabaseServer } from "@/lib/supabase/server";
import { FacturasCliente, type FacturaConContacto } from "./facturas-cliente";

export default async function FacturasPage() {
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

  let facturas: FacturaConContacto[] = [];
  if (empresa) {
    // El contacto vinculado viaja junto para precargar el modal
    // de cobro/pago sin otra consulta.
    const { data } = await supabase
      .from("facturas")
      .select("*, contacto:contactos(nombre, telefono, email)")
      .eq("id_empresa", empresa.id)
      .order("created_at", { ascending: false });
    facturas = (data as FacturaConContacto[]) ?? [];
  }

  return (
    <FacturasCliente facturas={facturas} nombreEmpresa={empresa?.nombre ?? null} />
  );
}
