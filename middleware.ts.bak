import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que requieren sesión activa
const rutasProtegidas = [
  "/dashboard",
  "/facturas",
  "/egresos",
  "/reportes",
  "/presupuestos",
  "/configuracion",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() valida el token contra Supabase y refresca la sesión
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  const esProtegida = rutasProtegidas.some(
    (r) => ruta === r || ruta.startsWith(r + "/")
  );

  // Sin sesión en ruta protegida → al login
  if (!user && esProtegida) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Con sesión en login/registro → al dashboard
  if (user && (ruta === "/login" || ruta === "/registro")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/facturas/:path*",
    "/egresos/:path*",
    "/reportes/:path*",
    "/presupuestos/:path*",
    "/configuracion/:path*",
    "/login",
    "/registro",
  ],
};
