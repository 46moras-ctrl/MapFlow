"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/app/icon";
import { getSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// SideNavBar (DESIGN.md §8.1): 256px fija, fondo surface-container-low.
// Solo en pantallas md+: en móvil la navegación vive en BottomNav.
export function Sidebar({
  mostrarPresupuestos = false,
}: {
  mostrarPresupuestos?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/facturas", label: "Facturas", icon: "description" },
    { href: "/pendientes", label: "Pendientes", icon: "pending_actions" },
    { href: "/reportes", label: "Reportes", icon: "analytics" },
    // El módulo de presupuestos se activa desde Configuración
    ...(mostrarPresupuestos
      ? [{ href: "/presupuestos", label: "Presupuestos", icon: "savings" }]
      : []),
    { href: "/configuracion", label: "Configuración", icon: "settings" },
  ];

  async function cerrarSesion() {
    await getSupabaseClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-outline-variant bg-surface-container-low px-4 py-6 md:flex">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 px-2">
        <Icon name="explore" filled className="text-[28px] text-primary" />
        <div>
          <div className="text-xl font-bold leading-tight text-primary">
            MapFlow
          </div>
          <div className="text-xs font-light text-on-surface-variant">
            Copiloto Financiero
          </div>
        </div>
      </Link>

      {/* Navegación */}
      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const activo =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors duration-200",
                activo
                  ? "border-r-2 border-primary bg-secondary-container/10 font-bold text-primary"
                  : "font-light text-on-surface-variant hover:bg-secondary-container/20 hover:text-on-surface"
              )}
            >
              <Icon name={item.icon} filled={activo} className="text-[22px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* CTA inferior */}
      <div className="flex flex-col gap-2">
        {/* Ingreso rápido: abre directo el formulario de nueva factura */}
        <Link
          href="/facturas?nueva=1"
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          <Icon name="add" className="text-[18px]" />
          Nueva Factura
        </Link>
        <button
          type="button"
          onClick={cerrarSesion}
          className="flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-xs font-light text-on-surface-variant transition-colors hover:bg-surface-variant"
        >
          <Icon name="logout" className="text-[18px]" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
