import { createSupabaseServer } from "@/lib/supabase/server";
import { sincronizarSheetsSiToca } from "@/app/(app)/configuracion/importar-actions";
import { FacturasCliente, type FacturaConContacto } from "./facturas-cliente";

export default async function FacturasPage() {
  // Google Sheets conectado: trae lo nuevo (máx. 1 vez por hora,
  // mejor esfuerzo — nunca bloquea la página si la hoja falla)
  await sincronizarSheetsSiToca();

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
