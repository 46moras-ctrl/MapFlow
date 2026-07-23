"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/app/icon";
import type { Alerta, NivelAlerta } from "@/lib/alertas";
import { cn } from "@/lib/utils";

const titulos: [string, string][] = [
  ["/dashboard", "Inicio"],
  ["/facturas/", "Detalle de Factura"],
  ["/facturas", "Facturas"],
  ["/pendientes", "Pendientes"],
  ["/reportes", "Reportes"],
  ["/presupuestos", "Presupuesto"],
  ["/movimientos", "Detalle financiero"],
  ["/ventas", "Ventas"],
  ["/configuracion", "Ajustes"],
];

// Estilos por nivel: PAGAR llamativo y escalonado, COBRAR discreto
const estiloNivel: Record<
  NivelAlerta,
  { contenedor: string; icono: string; etiqueta: string }
> = {
  // Lo urgente ya no grita en rojo: usa el color de acento, más sutil
  urgente: {
    contenedor:
      "border-tertiary bg-tertiary-container/70 text-on-tertiary-container hover:bg-tertiary-container",
    icono: "text-tertiary",
    etiqueta: "PAGAR · URGENTE",
  },
  media: {
    contenedor:
      "border-caution-amber bg-caution-amber/20 text-on-surface hover:bg-caution-amber/30",
    icono: "text-caution-amber",
    etiqueta: "PAGAR · PRÓXIMO",
  },
  suave: {
    contenedor:
      "border-caution-amber/40 bg-caution-amber/10 text-on-surface hover:bg-caution-amber/20",
    icono: "text-caution-amber",
    etiqueta: "PAGAR",
  },
  info: {
    contenedor:
      "border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container",
    icono: "text-primary",
    etiqueta: "COBRAR",
  },
};

// TopAppBar (DESIGN.md §8.2): h-16 sticky, fondo surface
export function Topbar({
  alertas,
  empresa,
}: {
  alertas: Alerta[];
  empresa?: { nombre?: string | null; foto_url?: string | null } | null;
}) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  // "Borrar notificaciones": las oculta en esta sesión del navegador
  const [borradas, setBorradas] = useState(false);
  const visibles = borradas ? [] : alertas;
  const titulo =
    titulos.find(([ruta]) => pathname.startsWith(ruta))?.[1] ?? "MapFlow";

  const inicialesEmpresa = (empresa?.nombre ?? "Mi negocio")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-4 md:px-8">
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
        {/* Campana de notificaciones */}
        <div className="relative">
          <button
            type="button"
            aria-label={`Notificaciones (${visibles.length})`}
            onClick={() => setAbierto((v) => !v)}
            className={cn(
              "relative rounded-full p-2 transition-colors hover:bg-surface-variant",
              abierto
                ? "bg-surface-variant text-on-surface"
                : "text-on-surface-variant"
            )}
          >
            <Icon
              name={
                visibles.length > 0 ? "notifications_active" : "notifications"
              }
              filled={visibles.length > 0}
              className="text-[22px]"
            />
            {visibles.length > 0 && (
              // Contador en color de acento (sutil), ya no en rojo
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-tertiary px-1 text-[10px] font-bold text-on-tertiary">
                {visibles.length}
              </span>
            )}
          </button>

          {abierto && (
            <>
              {/* Clic fuera = cerrar */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setAbierto(false)}
              />
              <div className="absolute right-0 top-12 z-50 w-96 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-level-2">
                <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-4 py-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Notificaciones
                  </span>
                  {visibles.length > 0 && (
                    <span className="text-xs font-light text-on-surface-variant">
                      {visibles.length} alerta{visibles.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                <div className="max-h-[420px] overflow-y-auto p-3">
                  {visibles.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-center">
                      <Icon
                        name="notifications_off"
                        className="text-[32px] text-outline"
                      />
                      <p className="mt-2 text-sm font-light text-on-surface-variant">
                        Todo en orden: sin vencimientos cercanos.
                      </p>
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {visibles.map((a) => {
                        const estilo = estiloNivel[a.nivel];
                        return (
                          <li key={a.id}>
                            <Link
                              href={a.href ?? `/facturas/${a.facturaId}`}
                              onClick={() => setAbierto(false)}
                              className={cn(
                                "flex items-start gap-3 rounded-xl border p-3 transition-all",
                                estilo.contenedor,
                                a.nivel === "urgente" && "py-4"
                              )}
                            >
                              <Icon
                                name={a.icono}
                                filled={a.nivel === "urgente"}
                                className={cn(
                                  "mt-0.5 shrink-0",
                                  estilo.icono,
                                  a.nivel === "urgente"
                                    ? "text-[26px]"
                                    : "text-[20px]"
                                )}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block text-[10px] font-bold uppercase tracking-wider opacity-80">
                                  {estilo.etiqueta}
                                </span>
                                <span
                                  className={cn(
                                    "block truncate text-sm",
                                    a.nivel === "urgente"
                                      ? "font-bold"
                                      : "font-semibold"
                                  )}
                                >
                                  {a.titulo}
                                </span>
                                <span className="block text-xs font-light opacity-90">
                                  {a.detalle}
                                </span>
                                {a.nivel === "urgente" && (
                                  <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider">
                                    Gestionar ahora
                                    <Icon
                                      name="arrow_forward"
                                      className="text-[14px]"
                                    />
                                  </span>
                                )}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Borrar notificaciones (se limpian en esta sesión) */}
                {visibles.length > 0 && (
                  <div className="border-t border-outline-variant bg-surface-container-low px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setBorradas(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
                    >
                      <Icon name="clear_all" className="text-[18px]" />
                      Borrar notificaciones
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Ayuda"
          className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-variant"
        >
          <Icon name="help" className="text-[22px]" />
        </button>
        {/* Foto de perfil: se cambia en Configuración → Perfil */}
        <Link
          href="/configuracion"
          title={empresa?.nombre ?? "Mi cuenta"}
          aria-label="Ir a Configuración"
          className="ml-2 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary-container text-sm font-bold text-on-primary-container transition-transform hover:scale-105"
        >
          {empresa?.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={empresa.foto_url}
              alt={`Foto de perfil de ${empresa?.nombre ?? "la empresa"}`}
              className="h-full w-full object-cover"
            />
          ) : (
            inicialesEmpresa
          )}
        </Link>
      </div>
    </header>
  );
}
