"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/app/icon";
import { ModalCobroPago } from "@/components/app/modal-cobro-pago";
import { StatusBadge } from "@/components/app/status-badge";
import {
  ETIQUETA_MEDIO,
  ICONO_MEDIO,
  fmt,
  formatearFecha,
  hoyISO,
  type FacturaDB,
} from "@/lib/facturas";
import {
  ETIQUETA_ESTADO_PLAN,
  ETIQUETA_METODO_PLAN,
  type PlanPagoDB,
  type TipoPlan,
} from "@/lib/planes-pago";
import { iniciales } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  buscarFacturaPorCodigo,
  completarPlan,
  completarPlanConCredito,
  eliminarPlan,
  type FacturaEncontrada,
} from "./actions";
import { sumarMeses } from "@/lib/facturas";

// ============================================================
// PENDIENTES — gestión de cobros (deudores) y pagos (acreedores).
// Reutiliza el MISMO cuadro modal de cobro/pago de Facturas
// (components/app/modal-cobro-pago.tsx): aquí se llega a él
// buscando la factura por su CÓDIGO ÚNICO (numero_factura).
// ============================================================

export interface PlanConFactura extends PlanPagoDB {
  factura: FacturaDB | null;
}

export function PendientesCliente({
  planes,
  migracionPendiente,
  tabInicial = "cobro",
}: {
  planes: PlanConFactura[];
  migracionPendiente: boolean;
  tabInicial?: TipoPlan;
}) {
  const hoy = hoyISO();
  const [tab, setTab] = useState<TipoPlan>(tabInicial);

  // Buscador por código de factura
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [encontrada, setEncontrada] = useState<FacturaEncontrada | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  // Modal compartido (nuevo plan sobre la encontrada, o editar uno existente)
  const [modalFactura, setModalFactura] = useState<FacturaEncontrada | null>(null);
  const [planEnEdicion, setPlanEnEdicion] = useState<PlanConFactura | null>(null);
  // Plan que se está marcando como pagado (pregunta el medio)
  const [planAPagar, setPlanAPagar] = useState<PlanConFactura | null>(null);
  // Paso 2 del crédito: cuotas, fechas y entidad bancaria
  const [pasoCredito, setPasoCredito] = useState(false);
  const [cuotasCred, setCuotasCred] = useState(1);
  const [fechasCred, setFechasCred] = useState<string[]>([]);

  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [ocupado, startTransition] = useTransition();

  const delTab = planes.filter((p) => p.tipo === tab);
  const cobros = planes.filter((p) => p.tipo === "cobro").length;
  const pagos = planes.filter((p) => p.tipo === "pago").length;

  function abrirBuscador() {
    setCodigo("");
    setEncontrada(null);
    setErrorBusqueda(null);
    setBuscadorAbierto(true);
  }

  function buscar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorBusqueda(null);
    setEncontrada(null);
    startTransition(async () => {
      // La acción valida que la factura sea de TU empresa
      const res = await buscarFacturaPorCodigo(codigo);
      if (!res.ok || !res.factura) {
        setErrorBusqueda(res.error ?? "No se encontró la factura.");
        return;
      }
      setEncontrada(res.factura);
    });
  }

  function continuarConEncontrada() {
    if (!encontrada) return;
    setBuscadorAbierto(false);
    setModalFactura(encontrada);
  }

  // Chulito: primero pregunta el medio de pago; al confirmarlo, el
  // plan sale de esta lista y la factura vuelve a blanca en Facturas.
  // CRÉDITO es especial: la deuda se traslada del proveedor al banco.
  function confirmarPago(medio: "efectivo" | "transferencia" | "tarjeta" | "credito") {
    if (!planAPagar) return;
    if (medio === "credito") {
      // Paso 2: cuotas, fechas y entidad bancaria
      setCuotasCred(1);
      setFechasCred([sumarMeses(hoy, 1)]);
      setPasoCredito(true);
      return;
    }
    setErrorGeneral(null);
    startTransition(async () => {
      const res = await completarPlan(planAPagar.id, medio);
      if (!res.ok) {
        setErrorGeneral(res.error ?? "Ocurrió un error.");
      }
      setPlanAPagar(null);
    });
  }

  // Al cambiar las cuotas del crédito, las fechas se proponen mes a mes
  function ajustarCuotasCred(n: number) {
    const total = Math.max(1, Math.min(48, Math.trunc(n) || 1));
    setCuotasCred(total);
    setFechasCred((prev) => {
      const base = prev[0] || sumarMeses(hoy, 1);
      return Array.from({ length: total }, (_, i) =>
        prev[i] ? prev[i] : sumarMeses(base, i)
      ).slice(0, total);
    });
  }

  function confirmarCredito(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!planAPagar) return;
    const fd = new FormData(e.currentTarget);
    setErrorGeneral(null);
    startTransition(async () => {
      const res = await completarPlanConCredito(planAPagar.id, {
        cuotas: cuotasCred,
        fechas: fechasCred,
        entidad: String(fd.get("entidad") ?? ""),
      });
      if (!res.ok) {
        setErrorGeneral(res.error ?? "Ocurrió un error.");
      }
      setPasoCredito(false);
      setPlanAPagar(null);
    });
  }

  function eliminar(plan: PlanConFactura) {
    setErrorGeneral(null);
    startTransition(async () => {
      const res = await eliminarPlan(plan.id);
      if (!res.ok) setErrorGeneral(res.error ?? "Ocurrió un error.");
    });
  }

  // Próxima fecha de pago no pasada (o la última si ya pasaron todas)
  function proximaFecha(p: PlanConFactura): string | null {
    const fechas = [...(p.fechas_pago ?? [])].sort();
    if (fechas.length === 0) return null;
    return fechas.find((f) => f >= hoy) ?? fechas[fechas.length - 1];
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">
            Pendientes
          </h1>
          <p className="mt-1 text-lg font-light text-on-surface-variant">
            Cobros y pagos pendientes
          </p>
        </div>
        {/* Botón principal según la pestaña activa */}
        <button
          type="button"
          onClick={abrirBuscador}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          <Icon name="add" className="text-[18px]" />
          {tab === "cobro" ? "Agregar cobro" : "Agregar pago"}
        </button>
      </div>

      {migracionPendiente && (
        <div className="flex items-start gap-2 rounded-lg bg-tertiary-container/50 px-4 py-3 text-sm font-light text-on-tertiary-container">
          <Icon name="info" className="mt-0.5 shrink-0 text-[18px]" />
          Para usar Pendientes falta ejecutar la migración{" "}
          <strong className="font-semibold">
            supabase/migracion_reestructura_ui.sql
          </strong>{" "}
          en el SQL Editor de Supabase.
        </div>
      )}

      {errorGeneral && (
        <div className="flex items-center gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
          <Icon name="error" className="text-[18px]" />
          {errorGeneral}
        </div>
      )}

      {/* Pestañas Por Cobrar | Por Pagar */}
      <div className="flex gap-6 border-b border-outline-variant">
        {(
          [
            { id: "cobro", label: "Cobros", icono: "call_received", n: cobros },
            { id: "pago", label: "Pagos", icono: "call_made", n: pagos },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm transition-colors",
              tab === t.id
                ? "border-primary font-bold text-primary"
                : "border-transparent font-light text-on-surface-variant hover:text-on-surface"
            )}
          >
            <Icon name={t.icono} className="text-[18px]" />
            {t.label}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold",
                tab === t.id
                  ? "bg-primary-container/60 text-on-primary-container"
                  : "bg-surface-container-high text-on-surface-variant"
              )}
            >
              {t.n}
            </span>
          </button>
        ))}
      </div>

      {/* Listado de pendientes registrados */}
      {delTab.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container/50">
            <Icon
              name={tab === "cobro" ? "call_received" : "call_made"}
              className="text-[32px] text-on-primary-container"
            />
          </div>
          <h3 className="mt-4 text-xl font-bold text-on-surface">
            {tab === "cobro"
              ? "Aún no registras cobros pendientes"
              : "Aún no registras pagos pendientes"}
          </h3>
          <p className="mt-1 max-w-md text-sm font-light text-on-surface-variant">
            {tab === "cobro"
              ? "Busca la factura por su código y registra el plan de cobro del deudor."
              : "Busca la factura por su código y registra el plan de pago al acreedor."}
          </p>
          <button
            type="button"
            onClick={abrirBuscador}
            className="mt-6 flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90"
          >
            <Icon name="search" className="text-[18px]" />
            {tab === "cobro" ? "Agregar cobro" : "Agregar pago"}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-1">
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left">
            <thead className="border-b border-outline-variant bg-surface-container-low">
              <tr className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                <th className="px-6 py-3">
                  {tab === "cobro" ? "Deudor / factura" : "Acreedor / factura"}
                </th>
                <th className="px-6 py-3 text-right">Monto</th>
                <th className="px-6 py-3">Cuotas</th>
                <th className="px-6 py-3">Próximo pago</th>
                <th className="px-6 py-3">Contacto</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {delTab.map((p) => {
                const f = p.factura;
                const nombre = p.contacto_nombre || f?.cliente || "—";
                return (
                  <tr
                    key={p.id}
                    className="group text-sm transition-colors hover:bg-surface-container"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
                          {iniciales(nombre)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-on-surface">
                            {nombre}
                          </div>
                          <div className="text-xs font-light text-on-surface-variant">
                            {f?.numero_factura ?? "Factura eliminada"}
                            {p.tipo === "pago" && p.metodo_pago
                              ? ` · ${ETIQUETA_METODO_PLAN[p.metodo_pago]}${p.detalle_metodo ? ` (${p.detalle_metodo})` : ""}`
                              : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-on-surface">
                      {f ? fmt(Number(f.monto)) : "—"}
                    </td>
                    <td className="px-6 py-3.5 font-light tabular-nums text-on-surface-variant">
                      {p.cuotas}
                    </td>
                    <td className="px-6 py-3.5 font-light text-on-surface-variant">
                      {formatearFecha(proximaFecha(p))}
                    </td>
                    <td className="px-6 py-3.5 font-light text-on-surface-variant">
                      <div className="flex flex-col">
                        {p.contacto_telefono && <span>{p.contacto_telefono}</span>}
                        {p.contacto_email && (
                          <span className="truncate">{p.contacto_email}</span>
                        )}
                        {!p.contacto_telefono && !p.contacto_email && "—"}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge
                        estado={
                          p.estado === "activo"
                            ? "pendiente"
                            : p.estado === "completado"
                              ? "pagada"
                              : ETIQUETA_ESTADO_PLAN[p.estado]
                        }
                      />
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {/* Chulito: marcar pagado (pregunta el medio) */}
                        <button
                          type="button"
                          onClick={() => setPlanAPagar(p)}
                          disabled={ocupado}
                          title="Marcar como pagado"
                          aria-label={`Marcar plan de ${nombre} como pagado`}
                          className="rounded-full p-2 text-secondary hover:bg-secondary-container/40 disabled:opacity-50"
                        >
                          <Icon name="check_circle" className="text-[22px]" />
                        </button>
                        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => setPlanEnEdicion(p)}
                            title="Editar plan"
                            aria-label={`Editar plan de ${nombre}`}
                            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant hover:text-primary"
                          >
                            <Icon name="edit" className="text-[20px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminar(p)}
                            disabled={ocupado}
                            title="Eliminar plan"
                            aria-label={`Eliminar plan de ${nombre}`}
                            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant hover:text-error disabled:opacity-50"
                          >
                            <Icon name="delete" className="text-[20px]" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      )}

      {/* ===== Buscador por código único de factura ===== */}
      {buscadorAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Buscar factura por código"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-on-surface">
                {tab === "cobro" ? "Agregar cobro" : "Agregar pago"}
              </h2>
              <button
                type="button"
                onClick={() => setBuscadorAbierto(false)}
                aria-label="Cerrar"
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            <p className="mt-1 text-sm font-light text-on-surface-variant">
              Escribe el código único de la factura (su número) y MapFlow
              anexa la información automáticamente.
            </p>

            <form onSubmit={buscar} className="mt-4 flex items-center gap-2">
              <label className="flex flex-1 items-center gap-2 rounded-full bg-surface-container-low px-4 py-2.5">
                <Icon name="search" className="text-[18px] text-on-surface-variant" />
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ej: FAC-001"
                  aria-label="Código de la factura"
                  className="w-full bg-transparent text-sm font-light text-on-surface outline-none placeholder:text-on-surface-variant/60"
                />
              </label>
              <button
                type="submit"
                disabled={ocupado || !codigo.trim()}
                className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {ocupado ? (
                  <Icon name="progress_activity" className="animate-spin text-[16px]" />
                ) : (
                  "Buscar"
                )}
              </button>
            </form>

            {errorBusqueda && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
                <Icon name="error" className="mt-0.5 shrink-0 text-[18px]" />
                {errorBusqueda}
              </div>
            )}

            {/* Info detectada de la factura */}
            {encontrada && (
              <div className="mt-4 rounded-lg border border-primary-container bg-primary-fixed/30 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-on-surface">
                    {encontrada.numero_factura} · {encontrada.cliente}
                  </span>
                  <span className="font-bold tabular-nums text-on-surface">
                    {fmt(Number(encontrada.monto))}
                  </span>
                </div>
                <div className="mt-1 text-xs font-light text-on-surface-variant">
                  {encontrada.concepto ? `${encontrada.concepto} · ` : ""}
                  Emitida {formatearFecha(encontrada.fecha_emision)} · Vence{" "}
                  {formatearFecha(encontrada.fecha_vencimiento)}
                </div>
                <button
                  type="button"
                  onClick={continuarConEncontrada}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90"
                >
                  <Icon name="arrow_forward" className="text-[16px]" />
                  Continuar con esta factura
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== MODAL COMPARTIDO (el mismo de Facturas) ===== */}
      {modalFactura && (
        <ModalCobroPago
          factura={modalFactura}
          contactoInicial={modalFactura.contacto}
          tipoInicial={tab}
          onCerrar={() => setModalFactura(null)}
        />
      )}
      {planEnEdicion && planEnEdicion.factura && (
        <ModalCobroPago
          factura={planEnEdicion.factura}
          planExistente={planEnEdicion}
          onCerrar={() => setPlanEnEdicion(null)}
        />
      )}

      {/* ===== "¿Con qué medio se pagó?" antes de completar ===== */}
      {planAPagar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-on-surface">
                {pasoCredito
                  ? "Pago con crédito"
                  : planAPagar.tipo === "cobro"
                    ? "¿Cómo te pagaron?"
                    : "¿Con qué medio pagaste?"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setPlanAPagar(null);
                  setPasoCredito(false);
                }}
                aria-label="Cerrar"
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            <p className="mt-1 text-sm font-light text-on-surface-variant">
              {planAPagar.factura?.numero_factura} ·{" "}
              {planAPagar.contacto_nombre || planAPagar.factura?.cliente} ·{" "}
              {planAPagar.factura ? fmt(Number(planAPagar.factura.monto)) : ""}
            </p>

            {!pasoCredito ? (
              <>
                <p className="mt-2 text-xs font-light text-on-surface-variant">
                  Al confirmar, este pendiente sale de la lista y la factura
                  queda pagada (celda blanca) en Facturas.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {(
                    planAPagar.tipo === "cobro"
                      ? (["efectivo", "transferencia", "tarjeta"] as const)
                      : (["efectivo", "transferencia", "tarjeta", "credito"] as const)
                  ).map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={ocupado}
                      onClick={() => confirmarPago(m)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-semibold transition-all hover:shadow-level-1 active:scale-[0.98] disabled:opacity-50",
                        m === "credito"
                          ? "border-tertiary-container bg-tertiary-container/30 text-on-tertiary-container hover:border-tertiary"
                          : "border-primary-container bg-surface-container-low text-on-surface hover:border-primary"
                      )}
                    >
                      <Icon name={ICONO_MEDIO[m]} className="text-[26px]" />
                      {ETIQUETA_MEDIO[m]}
                      {m === "credito" && (
                        <span className="text-[10px] font-light text-on-tertiary-container">
                          la deuda pasa al banco
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {ocupado && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm font-light text-on-surface-variant">
                    <Icon name="progress_activity" className="animate-spin text-[18px]" />
                    Registrando pago…
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={confirmarCredito} className="mt-4 flex flex-col gap-4">
                <div className="rounded-lg border border-tertiary-container bg-tertiary-container/20 px-4 py-3 text-sm font-light leading-relaxed text-on-tertiary-container">
                  <strong className="font-semibold">
                    El crédito no cierra el saldo: lo traslada al banco.
                  </strong>{" "}
                  Este pendiente con el proveedor queda pagado y se crea una
                  nueva deuda con la entidad, con sus cuotas, que seguirá viva
                  aquí en Pendientes.
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Entidad bancaria *
                  </label>
                  <input
                    name="entidad"
                    required
                    placeholder="Ej: Bancolombia"
                    className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Cuotas *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={48}
                      required
                      value={cuotasCred}
                      onChange={(e) => ajustarCuotasCred(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm tabular-nums text-on-surface outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Fecha{cuotasCred > 1 ? "s" : ""} de pago *
                    </label>
                    <div className="mt-1 flex max-h-36 flex-col gap-2 overflow-y-auto">
                      {fechasCred.map((f, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {cuotasCred > 1 && (
                            <span className="w-14 shrink-0 text-xs font-light text-on-surface-variant">
                              Cuota {i + 1}
                            </span>
                          )}
                          <input
                            type="date"
                            required
                            value={f}
                            onChange={(e) =>
                              setFechasCred((prev) =>
                                prev.map((x, j) => (j === i ? e.target.value : x))
                              )
                            }
                            className="w-full rounded-lg border border-primary-container bg-surface-container-low p-2.5 text-sm font-light text-on-surface outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setPasoCredito(false)}
                    className="rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant"
                  >
                    Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={ocupado}
                    className="flex items-center gap-2 rounded-xl bg-secondary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-secondary transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {ocupado ? (
                      <>
                        <Icon name="progress_activity" className="animate-spin text-[16px]" />
                        Trasladando deuda…
                      </>
                    ) : (
                      "Confirmar crédito"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
