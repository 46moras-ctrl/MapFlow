"use server";

import { revalidatePath } from "next/cache";
import { contextoEmpresa } from "@/lib/supabase/contexto";

interface Resultado {
  ok: boolean;
  error?: string;
}

export interface DatosPresupuesto {
  categoria: string;
  monto_tope: number;
  periodo: "semanal" | "mensual" | "trimestral" | "anual";
  alerta_porcentaje: number;
}

export async function crearPresupuesto(datos: DatosPresupuesto): Promise<Resultado> {
  if (!datos.categoria.trim())
    return { ok: false, error: "La categoría o detalle es obligatoria." };
  if (!Number.isFinite(datos.monto_tope) || datos.monto_tope <= 0)
    return { ok: false, error: "El monto debe ser mayor a cero." };
  if (!["semanal", "mensual", "trimestral", "anual"].includes(datos.periodo))
    return { ok: false, error: "Periodo no válido." };
  const alerta = Math.trunc(datos.alerta_porcentaje);
  if (!Number.isInteger(alerta) || alerta < 1 || alerta > 100)
    return { ok: false, error: "La alerta debe estar entre 1 y 100%." };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase.from("presupuestos").insert({
    id_empresa: ctx.empresaId,
    categoria: datos.categoria.trim(),
    monto_tope: datos.monto_tope,
    periodo: datos.periodo,
    alerta_porcentaje: alerta,
  });

  if (error) return { ok: false, error: "No se pudo registrar el presupuesto." };
  revalidatePath("/presupuestos");
  revalidatePath("/reportes");
  return { ok: true };
}

export async function eliminarPresupuesto(id: string): Promise<Resultado> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("presupuestos")
    .delete()
    .eq("id", id)
    .eq("id_empresa", ctx.empresaId); // nunca tocar presupuestos ajenos

  if (error) return { ok: false, error: "No se pudo eliminar el presupuesto." };
  revalidatePath("/presupuestos");
  revalidatePath("/reportes");
  return { ok: true };
}
