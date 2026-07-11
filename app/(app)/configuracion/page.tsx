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
      sesiones={sesiones}
      migracionPendiente={migracionPendiente}
    />
  );
}
