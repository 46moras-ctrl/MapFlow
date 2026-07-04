"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/app/icon";

const titulos: [string, string][] = [
  ["/dashboard", "Dashboard"],
  ["/facturas/", "Detalle de Factura"],
  ["/facturas", "Cuentas por Cobrar"],
  ["/egresos", "Egresos y Gastos"],
  ["/reportes", "Reportes y Análisis"],
  ["/presupuestos", "Presupuestos"],
  ["/configuracion", "Configuración"],
];

// TopAppBar (DESIGN.md §8.2): h-16 sticky, fondo surface
export function Topbar() {
  const pathname = usePathname();
  const titulo =
    titulos.find(([ruta]) => pathname.startsWith(ruta))?.[1] ?? "MapFlow";

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-8">
      <div className="flex items-center gap-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
          {titulo}
        </h2>
        <label className="hidden items-center gap-2 rounded-full bg-surface-container-low px-4 py-2 md:flex">
          <Icon name="search" className="text-[20px] text-on-surface-variant" />
          <input
            type="search"
            placeholder="Buscar facturas, clientes…"
            className="w-56 bg-transparent text-sm font-light text-on-surface outline-none placeholder:text-on-surface-variant/60"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Notificaciones"
          className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-variant"
        >
          <Icon name="notifications" className="text-[22px]" />
        </button>
        <button
          type="button"
          aria-label="Ayuda"
          className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-variant"
        >
          <Icon name="help" className="text-[22px]" />
        </button>
        <div
          className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container"
          title="María González — Panadería La Espiga"
        >
          MG
        </div>
      </div>
    </header>
  );
}
