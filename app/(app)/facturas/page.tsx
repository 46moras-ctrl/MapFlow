export const runtime = "edge";
import { hayComisiones, type ConfigComisiones } from "@/lib/nomina";
import { createSupabaseServer } from "@/lib/supabase/server";
import { sincronizarSheetsSiToca } from "@/app/(app)/configuracion/importar-actions";
import {
  FacturasCliente,
  type FacturaConContacto,
  type VendedorOpcion,
} from "./facturas-cliente";

export default async function FacturasPage() {
  // Google Sheets conectado: trae lo nuevo (máx. 1 vez por hora,
  // mejor esfuerzo — nunca bloquea la página si la hoja falla)
  await sincronizarSheetsSiToca();

  const supabase = createSupabaseServer();

  // El middleware garantiza que hay sesión; aquí buscamos la empresa.
  // select("*") a propósito: config_comisiones nace en una migración.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("*")
    .eq("id_usuario", user?.id ?? "")
    .maybeSingle();

  let facturas: FacturaConContacto[] = [];
  let vendedores: VendedorOpcion[] = [];
  if (empresa) {
    // El contacto vinculado viaja junto para precargar el modal
    // de cobro/pago sin otra consulta.
    const { data } = await supabase
      .from("facturas")
      .select("*, contacto:contactos(nombre, telefono, email)")
      .eq("id_empresa", empresa.id)
      .order("created_at", { ascending: false });
    facturas = (data as FacturaConContacto[]) ?? [];

    // El campo Vendedor solo existe con roles comisionables: son
    // los empleados ACTIVOS cuyo cargo está configurado en
    // Ajustes → Nómina → Comisiones.
    const config = empresa.config_comisiones as ConfigComisiones | null;
    if (hayComisiones(config)) {
      const cargos = config!.roles.map((r) => r.cargo.trim().toLowerCase());
      const { data: empleados } = await supabase
        .from("empleados")
        .select("id, nombre, cargo")
        .eq("id_empresa", empresa.id)
        .eq("activo", true)
        .order("nombre", { ascending: true });
      vendedores = ((empleados as VendedorOpcion[]) ?? []).filter((e) =>
        cargos.includes(e.cargo.trim().toLowerCase())
      );
    }
  }

  return (
    <FacturasCliente
      facturas={facturas}
      vendedores={vendedores}
      nombreEmpresa={empresa?.nombre ?? null}
    />
  );
}
