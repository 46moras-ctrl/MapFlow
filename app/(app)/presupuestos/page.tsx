import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/facturas";
import { PresupuestosCliente, type PresupuestoDB } from "./presupuestos-cliente";

// Se llega aquí desde el menú o el widget de Reportes, SOLO si el
// módulo de presupuestos está activado en Configuración.
export default async function PresupuestosPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("*")
    .eq("id_usuario", user?.id ?? "")
    .maybeSingle();

  // Módulo apagado (u oculto por defecto): la ruta no existe para ti
  if (!empresa?.mostrar_presupuestos) redirect("/reportes");

  let presupuestos: PresupuestoDB[] = [];
  let gastosMes: { categoria: string | null; monto: number }[] = [];

  if (empresa) {
    const mesActual = hoyISO().slice(0, 7);
    const [pres, egresos] = await Promise.all([
      supabase
        .from("presupuestos")
        .select("*")
        .eq("id_empresa", empresa.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("movimientos")
        .select("categoria, monto")
        .eq("id_empresa", empresa.id)
        .in("tipo", ["egreso", "pago"])
        .gte("fecha", `${mesActual}-01`),
    ]);
    presupuestos = (pres.data as PresupuestoDB[]) ?? [];
    gastosMes = (egresos.data ?? []) as { categoria: string | null; monto: number }[];
  }

  return <PresupuestosCliente presupuestos={presupuestos} gastosMes={gastosMes} />;
}
