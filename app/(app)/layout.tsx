import { AsistenteBurbuja } from "@/components/app/asistente-burbuja";
import { BottomNav } from "@/components/app/bottom-nav";
import { Sidebar } from "@/components/app/sidebar";
import { TemaMarca } from "@/components/app/tema-marca";
import { Topbar } from "@/components/app/topbar";
import { generarAlertas, type Alerta } from "@/lib/alertas";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Alertas para la campana + perfil de la empresa (foto del topbar
  // y colores de marca). select("*") a propósito: los campos nuevos
  // nacen en migraciones y la app no debe romperse sin ellas.
  let alertas: Alerta[] = [];
  let empresa: {
    nombre?: string | null;
    foto_url?: string | null;
    colores_marca?: { primario?: string; secundario?: string } | null;
    mostrar_presupuestos?: boolean | null;
  } | null = null;
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("empresas")
        .select("*")
        .eq("id_usuario", user.id)
        .maybeSingle();
      empresa = data;

      if (data) {
        const { data: facturas } = await supabase
          .from("facturas")
          .select(
            "id, numero_factura, cliente, concepto, fecha_vencimiento, estado, tipo"
          )
          .eq("id_empresa", data.id)
          .neq("estado", "pagado");
        alertas = generarAlertas((facturas as never[]) ?? []);
      }
    }
  } catch {
    // Sin alertas si algo falla: la app sigue funcionando
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Colores de marca del dueño, aplicados a toda la plataforma */}
      <TemaMarca colores={empresa?.colores_marca} />
      {/* Escritorio: sidebar · Móvil: barra inferior */}
      <Sidebar mostrarPresupuestos={Boolean(empresa?.mostrar_presupuestos)} />
      <div className="ml-0 md:ml-64">
        <Topbar alertas={alertas} empresa={empresa} />
        {/* pb extra en móvil para que la BottomNav no tape contenido */}
        <main className="fade-in-up mx-auto w-full max-w-container px-4 py-6 pb-28 md:px-12 md:py-8 md:pb-8">
          {children}
        </main>
      </div>
      <BottomNav />
      {/* Asistente conversacional, visible en toda la app autenticada */}
      <AsistenteBurbuja />
    </div>
  );
}
