"use client";

import { useState } from "react";
import { Icon } from "@/components/app/icon";
import type { ConfigEmpresa, FacturaDB, TipoFactura } from "@/lib/facturas";
import { cn } from "@/lib/utils";
import { SeccionFacturas } from "./seccion-facturas";

export function FacturasCliente({
  facturas,
  nombreEmpresa,
  config,
  tabInicial,
}: {
  facturas: FacturaDB[];
  nombreEmpresa: string | null;
  config: ConfigEmpresa;
  tabInicial: TipoFactura;
}) {
  const [tab, setTab] = useState<TipoFactura>(tabInicial);

  const cobrar = facturas.filter((f) => (f.tipo ?? "cobrar") === "cobrar");
  const pagar = facturas.filter((f) => f.tipo === "pagar");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-on-surface">
          Facturas
        </h1>
        <p className="mt-1 text-lg font-light text-on-surface-variant">
          {nombreEmpresa
            ? `Lo que entra y lo que sale de ${nombreEmpresa}.`
            : "Lo que entra y lo que sale de tu negocio."}
        </p>
      </div>

      {/* Pestañas Cobrar | Pagar */}
      <div className="flex gap-6 border-b border-outline-variant">
        <button
          type="button"
          onClick={() => setTab("cobrar")}
          className={cn(
            "-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm transition-colors",
            tab === "cobrar"
              ? "border-primary font-bold text-primary"
              : "border-transparent font-light text-on-surface-variant hover:text-on-surface"
          )}
        >
          <Icon name="call_received" className="text-[18px]" />
          Cuentas por cobrar
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-bold",
              tab === "cobrar"
                ? "bg-primary-container/60 text-on-primary-container"
                : "bg-surface-container-high text-on-surface-variant"
            )}
          >
            {cobrar.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("pagar")}
          className={cn(
            "-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm transition-colors",
            tab === "pagar"
              ? "border-secondary font-bold text-secondary"
              : "border-transparent font-light text-on-surface-variant hover:text-on-surface"
          )}
        >
          <Icon name="call_made" className="text-[18px]" />
          Cuentas por pagar
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-bold",
              tab === "pagar"
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-surface-container-high text-on-surface-variant"
            )}
          >
            {pagar.length}
          </span>
        </button>
      </div>

      {tab === "cobrar" ? (
        <SeccionFacturas key="cobrar" tipo="cobrar" facturas={cobrar} config={config} />
      ) : (
        <SeccionFacturas key="pagar" tipo="pagar" facturas={pagar} config={config} />
      )}
    </div>
  );
}
