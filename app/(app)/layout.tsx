import { AsistenteBurbuja } from "@/components/app/asistente-burbuja";
import { BottomNav } from "@/components/app/bottom-nav";
import { MonedaGlobal } from "@/components/app/moneda-global";
import { Sidebar } from "@/components/app/sidebar";
import { TemaMarca } from "@/components/app/tema-marca";
import { Topbar } from "@/components/app/topbar";
import { generarAlertas, type Alerta } from "@/lib/alertas";
import { gestionarCambioComisiones } from "@/lib/comisiones-pendientes";
import { configurarMoneda } from "@/lib/moneda";
import {
  generarAlertaNomina,
  type CambioComisionPendiente,
  type ConfigComisiones,
  type ConfigNomina,
  type EmpleadoDB,
} from "@/lib/nomina";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Guardia de sesión: todas las rutas de este grupo (dashboard,
  // facturas, movimientos, reportes, presupuestos, configuración,
  // pendientes, ventas) exigen usuario autenticado. Antes lo hacía
  // el middleware, pero el Edge Runtime de Vercel no lo toleraba;
  // aquí, en un Server Component (Node), es más simple y robusto.
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sin sesión → al login
  if (!user) {
    redirect("/login");
  }

  // Alertas para la campana + perfil de la empresa (foto del topbar
  // y colores de marca). select("*") a propósito: los campos nuevos
  // nacen en migraciones y la app no debe romperse sin ellas.
  let alertas: Alerta[] = [];
  let empresa: {
    id?: string;
    nombre?: string | null;
    foto_url?: string | null;
    colores_marca?: { primario?: string; secundario?: string } | null;
    mostrar_presupuestos?: boolean | null;
    moneda?: string | null;
    config_nomina?: ConfigNomina | null;
    config_comisiones?: ConfigComisiones | null;
    config_comisiones_pendiente?: CambioComisionPendiente | null;
  } | null = null;
  try {
    {
      const { data } = await supabase
        .from("empresas")
        .select("*")
        .eq("id_usuario", user.id)
        .maybeSingle();
      empresa = data;
      configurarMoneda(data?.moneda);

      if (data) {
        // Cambio de método de comisión programado: se aplica o
        // descarta al llegar el cierre, y avisa 3 días antes
        const alertaCambio = await gestionarCambioComisiones(
          supabase,
          data.id,
          data.config_comisiones_pendiente,
          user.email ?? null
        );

        const { data: facturas } = await supabase
          .from("facturas")
          .select(
            "id, numero_factura, cliente, concepto, fecha_vencimiento, estado, tipo"
          )
          .eq("id_empresa", data.id)
          .neq("estado", "pagado");
        alertas = generarAlertas((facturas as never[]) ?? []);
        if (alertaCambio) alertas = [alertaCambio, ...alertas];

        // Aviso de nómina próxima: cuánto toca pagar en salarios y
        // comisiones pendientes según los días de pago configurados.
        if (data.config_nomina?.frecuencia) {
          const [emp, ventas] = await Promise.all([
            supabase
              .from("empleados")
              .select("*")
              .eq("id_empresa", data.id)
              .eq("activo", true),
            supabase
              .from("facturas")
              .select("monto, comision_porcentaje")
              .eq("id_empresa", data.id)
              .eq("tipo", "cobrar")
              .eq("comision_liquidada", false)
              .not("id_vendedor", "is", null),
          ]);
          const comisionesPendientes = (ventas.data ?? []).reduce(
            (s, f) => s + Number(f.monto) * (Number(f.comision_porcentaje) || 0) / 100,
            0
          );
          const alertaNomina = generarAlertaNomina(
            data.config_nomina,
            (emp.data as EmpleadoDB[]) ?? [],
            comisionesPendientes
          );
          if (alertaNomina) alertas = [alertaNomina, ...alertas];
        }
      }
    }
  } catch {
    // Sin alertas si algo falla: la app sigue funcionando
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Colores de marca del dueño, aplicados a toda la plataforma */}
      <TemaMarca colores={empresa?.colores_marca} />
      {/* Moneda de la empresa: formatea todos los montos de la app */}
      <MonedaGlobal moneda={empresa?.moneda} />
      {/* Escritorio: sidebar · Móvil: barra inferior */}
      <Sidebar />
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
