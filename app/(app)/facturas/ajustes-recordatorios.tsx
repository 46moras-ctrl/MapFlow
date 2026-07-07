"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/app/icon";
import type { ConfigEmpresa } from "@/lib/facturas";
import { cn } from "@/lib/utils";
import { guardarAjustesRecordatorios } from "./actions";

// ============================================================
// AJUSTES DE RECORDATORIOS — modal accesible desde Cuentas por
// Cobrar y por Pagar:
//   · Canal general de COBROS (siempre activos, solo se elige canal)
//   · PAGOS: switch on/off + canal + email/teléfono del dueño
// Todo se guarda en la tabla empresas (RLS: solo la propia).
// ============================================================

type Canal = "whatsapp" | "email" | "ambos";

const CANALES: { id: Canal; label: string; icono: string }[] = [
  { id: "whatsapp", label: "WhatsApp", icono: "chat" },
  { id: "email", label: "Email", icono: "mail" },
  { id: "ambos", label: "Ambos", icono: "sync_alt" },
];

function SelectorCanal({
  valor,
  onCambio,
}: {
  valor: Canal;
  onCambio: (c: Canal) => void;
}) {
  return (
    <div className="flex gap-2">
      {CANALES.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onCambio(c.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-colors",
            valor === c.id
              ? "bg-primary font-bold text-on-primary"
              : "bg-surface-container-high font-light text-on-surface-variant hover:bg-surface-container-highest"
          )}
        >
          <Icon name={c.icono} className="text-[16px]" />
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function AjustesRecordatorios({
  config,
  onCerrar,
}: {
  config: ConfigEmpresa;
  onCerrar: () => void;
}) {
  const [email, setEmail] = useState(config.email_dueno ?? "");
  const [telefono, setTelefono] = useState(config.telefono_dueno ?? "");
  const [pagosActivo, setPagosActivo] = useState(
    config.recordatorios_pagos_activo ?? true
  );
  const [canalPagos, setCanalPagos] = useState<Canal>(
    config.recordatorios_pagos_canal ?? "ambos"
  );
  const [canalCobros, setCanalCobros] = useState<Canal>(
    config.recordatorios_cobros_canal ?? "ambos"
  );
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [ocupado, startTransition] = useTransition();

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const res = await guardarAjustesRecordatorios({
        email_dueno: email || null,
        telefono_dueno: telefono || null,
        recordatorios_pagos_activo: pagosActivo,
        recordatorios_pagos_canal: canalPagos,
        recordatorios_cobros_canal: canalCobros,
      });
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar.");
        return;
      }
      setGuardado(true);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Ajustes de recordatorios"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-on-surface">
            Ajustes de recordatorios
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <form onSubmit={guardar} className="mt-5 flex flex-col gap-5">
          {/* ===== Cobros: canal general (sin switch: siempre activos) ===== */}
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <Icon name="call_received" className="text-[18px] text-primary" />
              Recordatorios de cobro a tus clientes
            </div>
            <p className="mt-1 text-xs font-light text-on-surface-variant">
              Siempre activos: MapFlow cobra por ti. Solo elige por dónde
              saldrán los mensajes.
            </p>
            <div className="mt-3">
              <SelectorCanal valor={canalCobros} onCambio={setCanalCobros} />
            </div>
          </div>

          {/* ===== Pagos: switch + canal + datos del dueño ===== */}
          <div className="rounded-xl border border-primary-container bg-primary-fixed/25 p-4">
            <label className="flex cursor-pointer items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                <Icon name="call_made" className="text-[18px] text-secondary" />
                Recordarme mis pagos pendientes
              </span>
              <input
                type="checkbox"
                checked={pagosActivo}
                onChange={(e) => setPagosActivo(e.target.checked)}
                className="h-5 w-9 accent-[#42682F]"
              />
            </label>
            <p className="mt-1 text-xs font-light text-on-surface-variant">
              Avisos para ti cuando un pago a proveedor esté por vencer o en
              mora.
            </p>

            {pagosActivo && (
              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Canal preferido
                  </span>
                  <div className="mt-2">
                    <SelectorCanal valor={canalPagos} onCambio={setCanalPagos} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Tu email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@negocio.com"
                      className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Tu WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="+57 300 000 0000"
                      className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
              <Icon name="error" className="mt-0.5 shrink-0 text-[18px]" />
              {error}
            </div>
          )}
          {guardado && (
            <div className="flex items-center gap-2 rounded-lg bg-secondary-container/60 px-4 py-3 text-sm font-light text-on-secondary-container">
              <Icon name="check_circle" className="text-[18px]" />
              Ajustes guardados.
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={ocupado}
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {ocupado ? (
                <>
                  <Icon
                    name="progress_activity"
                    className="animate-spin text-[16px]"
                  />
                  Guardando…
                </>
              ) : (
                "Guardar ajustes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
