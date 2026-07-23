import { createSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Guardia inverso para las páginas públicas de acceso (login y
 * registro): si ya hay sesión activa, no tiene sentido mostrarlas
 * → directo al dashboard. Antes esto lo hacía el middleware; ahora
 * vive en un Server Component (Node), sin depender del Edge Runtime.
 */
export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
