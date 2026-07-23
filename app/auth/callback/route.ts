import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Callback de OAuth (Google) y de enlaces de confirmación por email.
 * Intercambia el código por una sesión y garantiza que el usuario
 * tenga una empresa creada en la tabla "empresas".
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Red de seguridad para usuarios creados antes del trigger:
      // upsert idempotente — si la empresa ya existe, no hace nada
      // (ignoreDuplicates apoyado en la constraint UNIQUE de id_usuario).
      // Jamás crea una segunda empresa para el mismo usuario.
      await supabase.from("empresas").upsert(
        {
          nombre:
            (data.user.user_metadata?.nombre_negocio as string) ??
            (data.user.user_metadata?.full_name as string) ??
            "Mi negocio",
          id_usuario: data.user.id,
        },
        { onConflict: "id_usuario", ignoreDuplicates: true }
      );

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
