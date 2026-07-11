"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/app/icon";
import { StatusBadge } from "@/components/app/status-badge";
import {
  estadoVisual,
  fmt,
  formatearFecha,
  hoyISO,
  type ContactoDB,
  type FacturaDB,
} from "@/lib/facturas";
import { iniciales } from "@/lib/mock-data";
import { getSupabaseClient } from "@/lib/supabase/client";

// ============================================================
// LIBRETA DE CONTACTOS — modal compartido:
//   Cuentas por Cobrar → clientes · Cuentas por Pagar → proveedores
// Lista los contactos de la tabla `contactos` (RLS filtra por
// empresa) con barra de búsqueda; al elegir uno muestra sus datos
// y TODO su historial de facturas (pagadas o no).
// ============================================================

function normalizar(s: string): string {
  return s.trim().toLowerCase();
}

export function LibretaContactos({
  tipo,
  facturas,
  onCerrar,
}: {
  tipo?: "cliente" | "proveedor"; // sin tipo: libreta completa
  facturas: FacturaDB[];
  onCerrar: () => void;
}) {
  const [contactos, setContactos] = useState<ContactoDB[] | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState<ContactoDB | null>(null);
  const hoy = hoyISO();

  // Carga de la libreta. Sin filtro de id_empresa a mano: RLS
  // solo devuelve los contactos de la empresa del usuario.
  useEffect(() => {
    let activo = true;
    getSupabaseClient()
      .from("contactos")
      .select("*")
      .order("nombre")
      .then(({ data, error }) => {
        if (!activo) return;
        if (error) setErrorCarga(true);
        else setContactos((data as ContactoDB[]) ?? []);
      });
    return () => {
      activo = false;
    };
  }, []);

  // Solo los del tipo de esta libreta (los sin tipo se muestran
  // en ambas: mejor verlos de más que perderlos)
  const delTipo = useMemo(
    () => (contactos ?? []).filter((c) => !tipo || !c.tipo || c.tipo === tipo),
    [contactos, tipo]
  );

  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return delTipo;
    return delTipo.filter((c) => normalizar(c.nombre).includes(q));
  }, [delTipo, busqueda]);

  // Historial del contacto elegido: por vínculo id_contacto y,
  // para facturas antiguas sin vincular, por nombre normalizado.
  const historial = useMemo(() => {
    if (!elegido) return [];
    return facturas.filter(
      (f) =>
        f.id_contacto === elegido.id ||
        normalizar(f.cliente) === normalizar(elegido.nombre)
    );
  }, [elegido, facturas]);

  const etiqueta =
    tipo === "cliente"
      ? "clientes"
      : tipo === "proveedor"
        ? "proveedores"
        : "contactos";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Libreta de ${etiqueta}`}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-level-2">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container/60">
              <Icon
                name="contacts"
                className="text-[22px] text-on-primary-container"
              />
            </div>
            <div>
              <h2 className="text-xl font-bold capitalize text-on-surface">
                {etiqueta}
              </h2>
              <p className="text-xs font-light text-on-surface-variant">
                Se llena sola al registrar facturas con teléfono o email.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        {!elegido ? (
          <>
            {/* Barra de búsqueda (lupa) */}
            <div className="px-6 pt-4">
              <label className="flex items-center gap-2 rounded-full bg-surface-container-low px-4 py-2.5">
                <Icon
                  name="search"
                  className="text-[20px] text-on-surface-variant"
                />
                <input
                  type="search"
                  autoFocus
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder={`Buscar ${tipo ?? "contacto"} por nombre…`}
                  className="w-full bg-transparent text-sm font-light text-on-surface outline-none placeholder:text-on-surface-variant/60"
                />
              </label>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {contactos === null && !errorCarga && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm font-light text-on-surface-variant">
                  <Icon
                    name="progress_activity"
                    className="animate-spin text-[18px]"
                  />
                  Cargando libreta…
                </div>
              )}
              {errorCarga && (
                <div className="rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
                  No se pudo cargar la libreta. Cierra y vuelve a intentar.
                </div>
              )}
              {contactos !== null && visibles.length === 0 && (
                <div className="py-10 text-center text-sm font-light text-on-surface-variant">
                  {delTipo.length === 0
                    ? `Aún no hay ${etiqueta} en tu libreta. Registra una factura con teléfono o email y aparecerá aquí.`
                    : "Nadie coincide con la búsqueda."}
                </div>
              )}
              <ul className="divide-y divide-outline-variant">
                {visibles.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setElegido(c)}
                      className="flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-surface-container"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
                        {iniciales(c.nombre)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-on-surface">
                          {c.nombre}
                        </span>
                        <span className="block truncate text-xs font-light text-on-surface-variant">
                          {[c.telefono, c.email].filter(Boolean).join(" · ") ||
                            "Sin datos de contacto"}
                        </span>
                      </span>
                      <Icon
                        name="chevron_right"
                        className="text-[20px] text-on-surface-variant"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          /* ===== Ficha del contacto + historial de facturas ===== */
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <button
              type="button"
              onClick={() => setElegido(null)}
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-on-surface"
            >
              <Icon name="arrow_back" className="text-[16px]" />
              Volver a la lista
            </button>

            <div className="mt-4 flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-container text-base font-bold text-on-primary-container">
                {iniciales(elegido.nombre)}
              </span>
              <div>
                <div className="text-lg font-bold text-on-surface">
                  {elegido.nombre}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-light text-on-surface-variant">
                  {elegido.telefono && (
                    <span className="flex items-center gap-1">
                      <Icon name="call" className="text-[16px]" />
                      {elegido.telefono}
                    </span>
                  )}
                  {elegido.email && (
                    <span className="flex items-center gap-1">
                      <Icon name="mail" className="text-[16px]" />
                      {elegido.email}
                    </span>
                  )}
                  {!elegido.telefono && !elegido.email && "Sin datos de contacto"}
                </div>
              </div>
            </div>

            <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Historial de facturas ({historial.length})
            </h3>
            {historial.length === 0 ? (
              <p className="mt-2 text-sm font-light text-on-surface-variant">
                Sin facturas registradas en esta pestaña.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-outline-variant">
                {historial.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/facturas/${f.id}`}
                      className="flex items-center gap-3 px-1 py-3 transition-colors hover:bg-surface-container"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-on-surface">
                          {f.numero_factura}
                        </span>
                        <span className="block truncate text-xs font-light text-on-surface-variant">
                          {f.concepto || "Sin concepto"} · vence{" "}
                          {formatearFecha(f.fecha_vencimiento)}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-on-surface">
                        {fmt(Number(f.monto))}
                      </span>
                      <StatusBadge estado={estadoVisual(f, hoy)} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
