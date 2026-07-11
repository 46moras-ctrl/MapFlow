import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Toda operación de servidor parte de aquí: usuario autenticado
 * + SU empresa. Así una petición jamás puede tocar datos de otra
 * empresa (regla de oro: aislamiento por empresa).
 */
export async function contextoEmpresa() {
  const supabase = createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." as const };
  }

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id")
    .eq("id_usuario", user.id)
    .maybeSingle();

  if (!empresa) {
    return {
      error:
        "No encontramos una empresa asociada a tu cuenta. Cierra sesión y vuelve a entrar." as const,
    };
  }

  return { supabase, empresaId: empresa.id as string, userId: user.id };
}
