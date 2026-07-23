import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
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
  let egresos: { fecha: string; monto: number }[] = [];

  if (empresa) {
    // TODOS los egresos registrados (movimientos de gasto/pago +
    // facturas de pago ya pagadas): cada uno descuenta del
    // presupuesto, sin filtrar por categoría.
    const [pres, movs, facts] = await Promise.all([
      supabase
        .from("presupuestos")
        .select("*")
        .eq("id_empresa", empresa.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("movimientos")
        .select("fecha, monto")
        .eq("id_empresa", empresa.id)
        .in("tipo", ["egreso", "pago"])
        .limit(2000),
      supabase
        .from("facturas")
        .select("fecha_emision, fecha_vencimiento, monto")
        .eq("id_empresa", empresa.id)
        .eq("tipo", "pagar")
        .eq("estado", "pagado"),
    ]);
    presupuestos = (pres.data as PresupuestoDB[]) ?? [];
    egresos = [
      ...(movs.data ?? []).map((m) => ({
        fecha: m.fecha as string,
        monto: Number(m.monto),
      })),
      ...(facts.data ?? []).map((f) => ({
        fecha: (f.fecha_vencimiento ?? f.fecha_emision) as string,
        monto: Number(f.monto),
      })),
    ];
  }

  return <PresupuestosCliente presupuestos={presupuestos} egresos={egresos} />;
}
