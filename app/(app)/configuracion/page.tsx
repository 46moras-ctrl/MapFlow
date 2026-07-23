export const runtime = "edge";
import type { EmpleadoDB } from "@/lib/nomina";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { SesionDB } from "./actions";
import { ConfiguracionCliente, type EmpresaConfig } from "./configuracion-cliente";

export default async function ConfiguracionPage() {
  const supabase = createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // select("*") a propósito: varios campos nacen en la migración
  // migracion_reestructura_ui.sql; si aún no está aplicada, la
  // página funciona igual y lo avisa al guardar.
  const { data: empresa } = await supabase
    .from("empresas")
    .select("*")
    .eq("id_usuario", user?.id ?? "")
    .maybeSingle();

  // Empleados de la pestaña Nómina (sin la migración, lista vacía)
  let empleados: EmpleadoDB[] = [];
  if (empresa) {
    const { data: dataEmpleados } = await supabase
      .from("empleados")
      .select("*")
      .eq("id_empresa", empresa.id)
      .order("activo", { ascending: false })
      .order("nombre", { ascending: true });
    empleados = (dataEmpleados as EmpleadoDB[]) ?? [];
  }

  let sesiones: SesionDB[] = [];
  let migracionPendiente = false;
  const { data: dataSesiones, error: errorSesiones } = await supabase
    .from("sesiones_dispositivos")
    .select("*")
    .eq("id_usuario", user?.id ?? "")
    .order("ultima_actividad", { ascending: false });
  if (errorSesiones?.code === "42P01") migracionPendiente = true;
  else sesiones = (dataSesiones as SesionDB[]) ?? [];

  return (
    <ConfiguracionCliente
      empresa={(empresa ?? {}) as EmpresaConfig}
      empleados={empleados}
      sesiones={sesiones}
      migracionPendiente={migracionPendiente}
    />
  );
}
