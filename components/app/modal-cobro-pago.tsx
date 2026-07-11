"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/app/icon";
import {
  guardarPlanPago,
  verificarDuplicadoCobro,
} from "@/app/(app)/pendientes/actions";
import { fmt, formatearFecha, hoyISO, sumarMeses, type FacturaDB } from "@/lib/facturas";
import type { MetodoPlan, PlanPagoDB, TipoPlan } from "@/lib/planes-pago";
import { cn } from "@/lib/utils";

// ============================================================
// MODAL DE REGISTRO DE COBRO/PAGO — COMPONENTE COMPARTIDO.
// Se abre desde Facturas (triángulo amarillo ⚠️ de cada fila)
// y desde Pendientes (botón "Agregar cobro/pago" tras buscar la
// factura por código). NO duplicar: es el mismo en ambas pantallas.
//
//  - Barra selectora arriba: Cobro | Pago.
//  - Cobro:  fechas de pago, cuotas y contacto del cliente.
//  - Pago:   además, "enviar a datos de la empresa o permitidos"
//            y sección anexable con método de pago y su detalle.
// ============================================================

interface ContactoInicial {
  nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
}

export function ModalCobroPago({
  factura,
  contactoInicial,
  planExistente,
  tipoInicial,
  onCerrar,
  onGuardado,
}: {
  factura: FacturaDB;
  contactoInicial?: ContactoInicial | null;
  planExistente?: PlanPagoDB | null;
  tipoInicial?: TipoPlan; // en Pendientes manda la pestaña activa
  onCerrar: () => void;
  onGuardado?: () => void;
}) {
  const router = useRouter();
  const hoy = hoyISO();

  // El tipo arranca según el plan guardado, la pestaña que lo abre
  // o la factura (cobrar → cobro); la barra selectora permite cambiarlo.
  const [tipo, setTipo] = useState<TipoPlan>(
    planExistente?.tipo ??
      tipoInicial ??
      (factura.tipo === "pagar" ? "pago" : "cobro")
  );
  const [cuotas, setCuotas] = useState(planExistente?.cuotas ?? 1);
  const [fechas, setFechas] = useState<string[]>(
    planExistente?.fechas_pago?.length
      ? planExistente.fechas_pago
      : [factura.fecha_vencimiento ?? hoy]
  );
  const [nombre, setNombre] = useState(
    planExistente?.contacto_nombre ?? contactoInicial?.nombre ?? factura.cliente
  );
  const [telefono, setTelefono] = useState(
    planExistente?.contacto_telefono ?? contactoInicial?.telefono ?? ""
  );
  const [email, setEmail] = useState(
    planExistente?.contacto_email ?? contactoInicial?.email ?? ""
  );
  // Solo PAGO:
  const [destino, setDestino] = useState<"empresa" | "contacto">(
    planExistente?.destino_envio ?? "empresa"
  );
  const [anexarInfo, setAnexarInfo] = useState(
    Boolean(planExistente?.metodo_pago || planExistente?.detalle_metodo)
  );
  const [metodo, setMetodo] = useState<MetodoPlan | "">(
    planExistente?.metodo_pago ?? ""
  );
  const [detalleMetodo, setDetalleMetodo] = useState(
    planExistente?.detalle_metodo ?? ""
  );

  const [error, setError] = useState<string | null>(null);
  // Anti-duplicación voz vs web: si ya hay un cobro igual HOY,
  // se avisa una vez; el siguiente clic confirma que es diferente.
  const [avisoDuplicado, setAvisoDuplicado] = useState(false);
  const [ocupado, startTransition] = useTransition();

  // Al cambiar el número de cuotas, la lista de fechas se ajusta:
  // se conservan las escritas y las nuevas se proponen mes a mes.
  function ajustarCuotas(n: number) {
    const total = Math.max(1, Math.min(48, Math.trunc(n) || 1));
    setCuotas(total);
    setFechas((prev) => {
      const base = prev[0] || factura.fecha_vencimiento || hoy;
      const nuevas = Array.from({ length: total }, (_, i) =>
        prev[i] ? prev[i] : sumarMeses(base, i)
      );
      return nuevas.slice(0, total);
    });
  }

  function cambiarFecha(i: number, valor: string) {
    setFechas((prev) => prev.map((f, idx) => (idx === i ? valor : f)));
  }

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      // Antes de guardar un COBRO: ¿ya se registró uno igual hoy
      // (posiblemente vía nota de voz en Telegram)?
      if (tipo === "cobro" && !avisoDuplicado && !planExistente) {
        const dup = await verificarDuplicadoCobro({
          nombre: nombre || factura.cliente,
          monto: Number(factura.monto),
          excluirFacturaId: factura.id,
        });
        if (dup.duplicado) {
          setAvisoDuplicado(true);
          return;
        }
      }
      const res = await guardarPlanPago({
        id_factura: factura.id,
        tipo,
        cuotas,
        fechas_pago: fechas,
        contacto_nombre: nombre,
        contacto_telefono: telefono,
        contacto_email: email,
        ...(tipo === "pago"
          ? {
              destino_envio: destino,
              metodo_pago: anexarInfo && metodo ? metodo : null,
              detalle_metodo: anexarInfo ? detalleMetodo : null,
            }
          : { destino_envio: "contacto" as const }),
      });
      if (!res.ok) {
        setError(res.error ?? "Ocurrió un error.");
        return;
      }
      router.refresh();
      onGuardado?.();
      onCerrar();
    });
  }

  const claseCampo =
    "mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary";
  const claseEtiqueta =
    "text-xs font-bold uppercase tracking-wider text-on-surface-variant";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Registro de cobro o pago"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold text-on-surface">
            <Icon name="warning" filled className="text-[22px] text-amber-500" />
            Registrar {tipo === "cobro" ? "cobro" : "pago"}
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

        {/* Info de la factura, detectada automáticamente */}
        <div className="mt-3 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-on-surface">
              {factura.numero_factura} · {factura.cliente}
            </span>
            <span className="font-bold tabular-nums text-on-surface">
              {fmt(Number(factura.monto))}
            </span>
          </div>
          <div className="mt-1 text-xs font-light text-on-surface-variant">
            {factura.concepto ? `${factura.concepto} · ` : ""}
            Emitida {formatearFecha(factura.fecha_emision)} · Vence{" "}
            {formatearFecha(factura.fecha_vencimiento)}
          </div>
        </div>

        {/* Barra selectora Cobro | Pago */}
        <div className="mt-4 flex rounded-xl bg-surface-container-high p-1">
          {(
            [
              { id: "cobro", label: "Cobro", icono: "call_received" },
              { id: "pago", label: "Pago", icono: "call_made" },
            ] as const
          ).map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => setTipo(op.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors",
                tipo === op.id
                  ? "bg-primary font-bold text-on-primary shadow-sm"
                  : "font-light text-on-surface-variant hover:text-on-surface"
              )}
            >
              <Icon name={op.icono} className="text-[18px]" />
              {op.label}
            </button>
          ))}
        </div>

        <form onSubmit={guardar} className="mt-5 flex flex-col gap-4">
          {/* Cuotas + fechas de pago */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={claseEtiqueta}>Cuotas *</label>
              <input
                type="number"
                min={1}
                max={48}
                required
                value={cuotas}
                onChange={(e) => ajustarCuotas(Number(e.target.value))}
                className={cn(claseCampo, "tabular-nums")}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={claseEtiqueta}>
                Fecha{cuotas > 1 ? "s" : ""} de pago *
              </label>
              <div className="mt-1 flex max-h-40 flex-col gap-2 overflow-y-auto">
                {fechas.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {cuotas > 1 && (
                      <span className="w-14 shrink-0 text-xs font-light text-on-surface-variant">
                        Cuota {i + 1}
                      </span>
                    )}
                    <input
                      type="date"
                      required
                      value={f}
                      onChange={(e) => cambiarFecha(i, e.target.value)}
                      className="w-full rounded-lg border border-primary-container bg-surface-container-low p-2.5 text-sm font-light text-on-surface outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Contacto del cliente (cobro) / acreedor (pago) */}
          <div className="rounded-lg border border-outline-variant bg-surface-container-low/60 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              {tipo === "cobro"
                ? "Contacto del cliente (para enviarle mensajes)"
                : "Contacto del proveedor / acreedor"}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={claseEtiqueta}>Nombre</label>
                <input
                  value={nombre ?? ""}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre del contacto"
                  className={claseCampo}
                />
              </div>
              <div>
                <label className={claseEtiqueta}>Teléfono</label>
                <input
                  type="tel"
                  value={telefono ?? ""}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+57 300 000 0000"
                  className={claseCampo}
                />
              </div>
              <div>
                <label className={claseEtiqueta}>Email</label>
                <input
                  type="email"
                  value={email ?? ""}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className={claseCampo}
                />
              </div>
            </div>
          </div>

          {/* Solo PAGO: destino del envío + anexar método de pago */}
          {tipo === "pago" && (
            <>
              <div>
                <label className={claseEtiqueta}>¿A dónde se envía la información?</label>
                <select
                  value={destino}
                  onChange={(e) =>
                    setDestino(e.target.value as "empresa" | "contacto")
                  }
                  className={claseCampo}
                >
                  <option value="empresa">
                    A los datos de la empresa o permitidos
                  </option>
                  <option value="contacto">Al contacto de arriba</option>
                </select>
              </div>

              <div className="rounded-lg border border-primary-container bg-primary-fixed/30 p-4">
                <button
                  type="button"
                  onClick={() => setAnexarInfo((v) => !v)}
                  className="flex w-full items-center gap-2 text-sm font-semibold text-on-surface"
                >
                  <Icon
                    name={anexarInfo ? "expand_less" : "attach_file"}
                    className="text-[18px] text-primary"
                  />
                  {anexarInfo
                    ? "Info del pago anexada"
                    : "Anexar info de a quién le debemos (método de pago)"}
                </button>
                {anexarInfo && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={claseEtiqueta}>Método de pago</label>
                      <select
                        value={metodo}
                        onChange={(e) => setMetodo(e.target.value as MetodoPlan | "")}
                        className={claseCampo}
                      >
                        <option value="">Sin definir</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className={claseEtiqueta}>Detalle del método</label>
                      <input
                        value={detalleMetodo}
                        onChange={(e) => setDetalleMetodo(e.target.value)}
                        placeholder="Banco, nº de cuenta, link…"
                        className={claseCampo}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Alerta naranja: posible duplicado del día (voz vs web) */}
          {avisoDuplicado && (
            <div className="flex items-start gap-2 rounded-lg border border-caution-amber bg-caution-amber/15 px-4 py-3 text-sm text-on-surface">
              <Icon
                name="warning"
                filled
                className="mt-0.5 shrink-0 text-[18px] text-caution-amber"
              />
              <span className="font-light">
                <strong className="font-semibold">
                  ⚠️ Ya registraste un cobro por este monto para este cliente
                  hoy (posiblemente vía Telegram).
                </strong>{" "}
                ¿Seguro que es diferente? Si lo es, vuelve a pulsar guardar.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
              <Icon name="error" className="mt-0.5 shrink-0 text-[18px]" />
              {error}
            </div>
          )}

          <div className="mt-1 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={ocupado}
              className={cn(
                "flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-60",
                avisoDuplicado
                  ? "bg-caution-amber text-ink"
                  : "bg-primary text-on-primary"
              )}
            >
              {ocupado ? (
                <>
                  <Icon name="progress_activity" className="animate-spin text-[16px]" />
                  Guardando…
                </>
              ) : avisoDuplicado ? (
                "Sí, es diferente — guardar"
              ) : (
                <>
                  <Icon name="save" className="text-[16px]" />
                  Guardar {tipo === "cobro" ? "cobro" : "pago"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
