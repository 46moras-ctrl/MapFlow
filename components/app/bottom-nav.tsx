"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/app/icon";
import { cn } from "@/lib/utils";

// ============================================================
// BOTTOM NAV — navegación móvil (solo < md; en escritorio manda
// el Sidebar). Mismos destinos que el menú lateral, con un botón
// central "+" que abre directo el formulario de Nueva Factura.
// ============================================================

const izquierda = [
  { href: "/dashboard", label: "Inicio", icon: "dashboard" },
  { href: "/facturas", label: "Facturas", icon: "description" },
];

const derecha = [
  { href: "/pendientes", label: "Pendientes", icon: "pending_actions" },
  { href: "/reportes", label: "Reportes", icon: "analytics" },
];

function ItemNav({
  item,
  activo,
}: {
  item: { href: string; label: string; icon: string };
  activo: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors",
        activo ? "font-bold text-primary" : "font-light text-on-surface-variant"
      )}
    >
      <Icon name={item.icon} filled={activo} className="text-[24px]" />
      {item.label}
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const esActivo = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 flex items-center border-t border-outline-variant bg-surface-container-lowest pb-[env(safe-area-inset-bottom)] shadow-level-2 md:hidden"
    >
      {izquierda.map((item) => (
        <ItemNav key={item.href} item={item} activo={esActivo(item.href)} />
      ))}

      {/* Botón central: Nueva Factura (ingreso rápido) */}
      <div className="flex flex-1 justify-center">
        <Link
          href="/facturas?nueva=1"
          aria-label="Nueva factura"
          className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-level-2 transition-transform active:scale-95"
        >
          <Icon name="add" className="text-[28px]" />
        </Link>
      </div>

      {derecha.map((item) => (
        <ItemNav key={item.href} item={item} activo={esActivo(item.href)} />
      ))}
      <ItemNav
        item={{ href: "/configuracion", label: "Ajustes", icon: "settings" }}
        activo={esActivo("/configuracion")}
      />
    </nav>
  );
}
