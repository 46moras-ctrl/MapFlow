import { AsistenteBurbuja } from "@/components/app/asistente-burbuja";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { generarAlertas, type Alerta } from "@/lib/alertas";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Alertas de vencimientos para la campana del header
  let alertas: Alerta[] = [];
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: empresa } = await supabase
        .from("empresas")
        .select("id")
        .eq("id_usuario", user.id)
        .maybeSingle();

      if (empresa) {
        const { data } = await supabase
          .from("facturas")
          .select(
            "id, numero_factura, cliente, concepto, fecha_vencimiento, estado, tipo"
          )
          .eq("id_empresa", empresa.id)
          .neq("estado", "pagado");
        alertas = generarAlertas((data as never[]) ?? []);
      }
    }
  } catch {
    // Sin alertas si algo falla: la app sigue funcionando
  }

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <div className="ml-64">
        <Topbar alertas={alertas} />
        <main className="fade-in-up mx-auto w-full max-w-container px-12 py-8">
          {children}
        </main>
      </div>
      {/* Asistente conversacional, visible en toda la app autenticada */}
      <AsistenteBurbuja />
    </div>
  );
}
