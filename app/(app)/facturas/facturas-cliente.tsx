"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/app/icon";
import { LibretaContactos } from "@/components/app/libreta-contactos";
import { ModalCobroPago } from "@/components/app/modal-cobro-pago";
import {
  fmt,
  formatearFecha,
  hoyISO,
  type DatosFactura,
  type FacturaDB,
  type MedioPago,
  type TipoFactura,
} from "@/lib/facturas";
import { iniciales } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  actualizarFactura,
  crearFactura,
  eliminarFactura,
} from "./actions";
import { verificarDuplicadoCobro } from "@/app/(app)/pendientes/actions";

// ============================================================
// FACTURAS — registro y visualización, sin estados a la vista:
// una factura PENDIENTE o VENCIDA se distingue porque su fila
// va rellena del color de acento; una PAGADA queda en blanco.
// El tipo (cobro/pago) vive en el filtro de encima de la tabla.
// El triángulo ⚠️ abre el modal compartido de cobro/pago.
// ============================================================

export interface FacturaConContacto extends FacturaDB {
  contacto: { nombre: string; telefono: string | null; email: string | null } | null;
}

type FiltroTipo = "todas" | "cobros" | "pagos";

export function FacturasCliente({
  facturas,
  nombreEmpresa,
}: {
  facturas: FacturaConContacto[];
  nombreEmpresa: string | null;
}) {
  const hoy = hoyISO();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todas");
  // Saldadas = ya pagadas · Pendientes = aún sin pagar (rosadas)
  const [filtroEstado, setFiltroEstado] = useState<"todas" | "saldadas" | "pendientes">("todas");
  const [busqueda, setBusqueda] = useState("");
  // modal === undefined: cerrado · null: crear · FacturaDB: editar
  const [modal, setModal] = useState<FacturaDB | null | undefined>(undefined);
  const [tipoNueva, setTipoNueva] = useState<TipoFactura>("cobrar");
  const [recurrente, setRecurrente] = useState(false);
  const [aEliminar, setAEliminar] = useState<FacturaDB | null>(null);
  const [planPara, setPlanPara] = useState<FacturaConContacto | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  // Anti-duplicación voz vs web al crear un cobro
  const [avisoDuplicado, setAvisoDuplicado] = useState(false);
  const [libretaAbierta, setLibretaAbierta] = useState(false);
  const [ocupado, startTransition] = useTransition();

  // Ingreso rápido: el botón "Nueva Factura" del menú lateral llega
  // con ?nueva=1 y abre el formulario directo.
  useEffect(() => {
    if (searchParams.get("nueva")) {
      setErrorForm(null);
      setRecurrente(false);
      setTipoNueva("cobrar");
      setModal(null);
      router.replace("/facturas", { scroll: false });
    }
  }, [searchParams, router]);

  // Tipo efectivo del formulario (editable también al editar,
  // para poder reclasificar un cobro que en realidad era un pago)
  const tipoForm: TipoFactura = tipoNueva;

  const visibles = facturas.filter((f) => {
    const pasaTipo =
      filtroTipo === "todas" ||
      (filtroTipo === "cobros" && (f.tipo ?? "cobrar") === "cobrar") ||
      (filtroTipo === "pagos" && f.tipo === "pagar");
    const pasaEstado =
      filtroEstado === "todas" ||
      (filtroEstado === "saldadas" && f.estado === "pagado") ||
      (filtroEstado === "pendientes" && f.estado !== "pagado");
    const q = busqueda.trim().toLowerCase();
    const pasaBusqueda =
      !q ||
      f.cliente.toLowerCase().includes(q) ||
      f.numero_factura.toLowerCase().includes(q);
    return pasaTipo && pasaEstado && pasaBusqueda;
  });

  // Cuánto dinero suma lo que se está viendo con los filtros puestos
  const sumaVisible = visibles.reduce((s, f) => s + Number(f.monto), 0);

  function abrirModal(f: FacturaDB | null) {
    setErrorForm(null);
    setAvisoDuplicado(false);
    setRecurrente(Boolean(f?.es_recurrente));
    // Al editar, el selector permite RECLASIFICAR cobro ↔ pago
    setTipoNueva(f?.tipo ?? "cobrar");
    setModal(f);
  }

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorForm(null);
    const fd = new FormData(e.currentTarget);
    const datos: DatosFactura = {
      tipo: tipoForm,
      numero_factura: String(fd.get("numero_factura") ?? ""),
      cliente: String(fd.get("cliente") ?? ""),
      monto: Number(fd.get("monto")),
      fecha_emision: String(fd.get("fecha_emision") ?? ""),
      fecha_vencimiento: String(fd.get("fecha_vencimiento") ?? "") || null,
      concepto: String(fd.get("concepto") ?? "") || null,
      telefono_contacto: String(fd.get("telefono_contacto") ?? "") || null,
      email_contacto: String(fd.get("email_contacto") ?? "") || null,
      ...(tipoForm === "pagar"
        ? {
            medio_pago_previsto:
              (String(fd.get("medio_pago_previsto") ?? "") as MedioPago) || null,
            es_recurrente: recurrente,
            dia_recurrencia: recurrente ? Number(fd.get("dia_recurrencia")) : null,
          }
        : {}),
      ...(modal ? { estado: fd.get("estado") as DatosFactura["estado"] } : {}),
    };

    startTransition(async () => {
      // Antes de crear un COBRO: ¿ya hay uno igual registrado hoy
      // (posiblemente vía nota de voz en Telegram)?
      if (!modal && tipoForm === "cobrar" && !avisoDuplicado) {
        const dup = await verificarDuplicadoCobro({
          nombre: datos.cliente,
          monto: datos.monto,
        });
        if (dup.duplicado) {
          setAvisoDuplicado(true);
          return;
        }
      }
      const res = modal
        ? await actualizarFactura(modal.id, datos)
        : await crearFactura(datos);
      if (!res.ok) {
        setErrorForm(res.error ?? "Ocurrió un error.");
        return;
      }
      setModal(undefined);
    });
  }

  function confirmarEliminar() {
    if (!aEliminar) return;
    setErrorGeneral(null);
    startTransition(async () => {
      const res = await eliminarFactura(aEliminar.id);
      if (!res.ok) setErrorGeneral(res.error ?? "Ocurrió un error.");
      setAEliminar(null);
    });
  }

  const claseCampo =
    "mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary";
  const claseEtiqueta =
    "text-xs font-bold uppercase tracking-wider text-on-surface-variant";

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado + Contactos + Nueva Factura */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">
            Facturas
          </h1>
          <p className="mt-1 text-lg font-light text-on-surface-variant">
            {nombreEmpresa
              ? `Registro y detalle de las facturas de ${nombreEmpresa}.`
              : "Registro y detalle de todas tus facturas."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLibretaAbierta(true)}
            className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Icon name="contacts" className="text-[18px]" />
            Contactos
          </button>
          <button
            type="button"
            onClick={() => abrirModal(null)}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <Icon name="add" className="text-[18px]" />
            Nueva Factura
          </button>
        </div>
      </div>

      {errorGeneral && (
        <div className="flex items-center gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
          <Icon name="error" className="text-[18px]" />
          {errorGeneral}
        </div>
      )}

      {/* Filtro Cobros | Pagos + buscador, encima de la tabla */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface p-4">
        {(
          [
            { id: "todas", label: "Todas" },
            { id: "cobros", label: "Cobros" },
            { id: "pagos", label: "Pagos" },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltroTipo(f.id)}
            className={
              filtroTipo === f.id
                ? "rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-on-primary"
                : "rounded-lg bg-surface-container-high px-4 py-1.5 text-xs font-light text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            }
          >
            {f.label}
          </button>
        ))}
        <span className="h-5 w-px bg-outline-variant" />
        {(
          [
            { id: "todas", label: "Todas" },
            { id: "saldadas", label: "Saldadas" },
            { id: "pendientes", label: "Pendientes" },
          ] as const
        ).map((f) => (
          <button
            key={`e-${f.id}`}
            type="button"
            onClick={() => setFiltroEstado(f.id)}
            className={
              filtroEstado === f.id
                ? "rounded-lg bg-tertiary px-4 py-1.5 text-xs font-bold text-on-tertiary"
                : "rounded-lg bg-surface-container-high px-4 py-1.5 text-xs font-light text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            }
          >
            {f.label}
          </button>
        ))}
        <span className="flex items-center gap-1.5 text-xs font-light text-on-surface-variant">
          <span className="h-3 w-3 rounded-sm bg-tertiary-container" />
          color ={" "}
          <Link
            href="/pendientes"
            className="font-bold text-tertiary underline-offset-2 hover:underline"
          >
            pendientes
          </Link>
        </span>
        <label className="ml-auto flex items-center gap-2 rounded-full bg-surface-container-low px-4 py-2">
          <Icon name="search" className="text-[18px] text-on-surface-variant" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Cliente o nº de factura…"
            className="w-52 bg-transparent text-sm font-light text-on-surface outline-none placeholder:text-on-surface-variant/60"
          />
        </label>
      </div>

      {/* Tabla o estado vacío */}
      {facturas.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container/50">
            <Icon name="description" className="text-[32px] text-on-primary-container" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-on-surface">
            Aún no tienes facturas registradas
          </h3>
          <p className="mt-1 max-w-md text-sm font-light text-on-surface-variant">
            Registra tu primera factura y MapFlow vigilará los vencimientos por ti.
          </p>
          <button
            type="button"
            onClick={() => abrirModal(null)}
            className="mt-6 flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90"
          >
            <Icon name="add" className="text-[18px]" />
            Registrar mi primera factura
          </button>
        </div>
      ) : (
        <>
        {/* ===== Móvil: tarjetas apiladas (la tabla se rompe en celular) ===== */}
        <div className="flex flex-col gap-3 md:hidden">
          {visibles.map((f) => {
            const pendiente = f.estado !== "pagado";
            return (
              <div
                key={f.id}
                className={cn(
                  "rounded-xl border p-4 shadow-level-1",
                  pendiente
                    ? "border-tertiary-container bg-tertiary-container/50"
                    : "border-outline-variant bg-surface-container-lowest"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-on-surface">
                      {f.cliente}
                    </div>
                    <div className="text-xs font-light text-on-surface-variant">
                      {f.numero_factura} · Vence {formatearFecha(f.fecha_vencimiento)}
                    </div>
                    {f.concepto && (
                      <div className="mt-0.5 truncate text-xs font-light text-on-surface-variant">
                        {f.concepto}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-base font-bold tabular-nums text-on-surface">
                    {fmt(Number(f.monto))}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-end gap-1 border-t border-outline-variant/40 pt-2">
                  <Link
                    href={`/facturas/${f.id}`}
                    aria-label={`Ver detalle de ${f.numero_factura}`}
                    className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
                  >
                    <Icon name="visibility" className="text-[20px]" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPlanPara(f)}
                    aria-label={`Registrar cobro o pago de ${f.numero_factura}`}
                    className="rounded-full p-2 text-amber-500"
                  >
                    <Icon name="warning" filled className="text-[20px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirModal(f)}
                    aria-label={`Editar ${f.numero_factura}`}
                    className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
                  >
                    <Icon name="edit" className="text-[20px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAEliminar(f)}
                    aria-label={`Eliminar ${f.numero_factura}`}
                    className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant hover:text-error"
                  >
                    <Icon name="delete" className="text-[20px]" />
                  </button>
                </div>
              </div>
            );
          })}
          {visibles.length === 0 && (
            <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-10 text-center text-sm font-light text-on-surface-variant">
              Nada coincide con el filtro.
            </p>
          )}
        </div>

        {/* ===== Escritorio: tabla ===== */}
        <div className="hidden overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-1 md:block">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-b border-outline-variant bg-surface-container-low">
              <tr className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                <th className="px-6 py-3">Cliente / proveedor</th>
                <th className="px-6 py-3">Nº de factura</th>
                <th className="px-6 py-3 text-right">Monto</th>
                <th className="px-6 py-3">Vencimiento</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {visibles.map((f) => {
                const pendiente = f.estado !== "pagado";
                return (
                  <tr
                    key={f.id}
                    className={cn(
                      "group text-sm transition-colors",
                      // Sin badges de estado: lo pendiente/vencido se
                      // resalta con el color de acento; lo pagado, no.
                      pendiente
                        ? "bg-tertiary-container/50 hover:bg-tertiary-container/70"
                        : "hover:bg-surface-container"
                    )}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            pendiente
                              ? "bg-tertiary text-on-tertiary"
                              : "bg-primary-container text-on-primary-container"
                          )}
                        >
                          {iniciales(f.cliente)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-on-surface">
                            {f.cliente}
                          </div>
                          {f.concepto && (
                            <div className="max-w-56 truncate text-xs font-light text-on-surface-variant">
                              {f.concepto}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-light text-on-surface-variant">
                      <div className="flex items-center gap-1.5">
                        {f.numero_factura}
                        {f.es_recurrente && (
                          <Icon name="event_repeat" className="text-[16px] text-secondary" />
                        )}
                        {f.id_factura_origen && (
                          <Link
                            href={`/facturas/${f.id_factura_origen}`}
                            title="Ver de dónde viene esta deuda"
                            className="text-tertiary hover:opacity-70"
                          >
                            <Icon name="link" className="text-[16px]" />
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-on-surface">
                      {fmt(Number(f.monto))}
                    </td>
                    <td className="px-6 py-3.5 font-light text-on-surface-variant">
                      {formatearFecha(f.fecha_vencimiento)}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {/* OJITO: detalle (siempre visible) */}
                        <Link
                          href={`/facturas/${f.id}`}
                          aria-label={`Ver detalle de ${f.numero_factura}`}
                          title="Ver detalle"
                          className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant hover:text-primary"
                        >
                          <Icon name="visibility" className="text-[20px]" />
                        </Link>
                        {/* TRIÁNGULO AMARILLO: cobro/pago (siempre visible) */}
                        <button
                          type="button"
                          onClick={() => setPlanPara(f)}
                          title="Registrar cobro/pago"
                          aria-label={`Registrar cobro o pago de ${f.numero_factura}`}
                          className="rounded-full p-2 text-amber-500 hover:bg-amber-50"
                        >
                          <Icon name="warning" filled className="text-[20px]" />
                        </button>
                        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => abrirModal(f)}
                            title="Editar"
                            aria-label={`Editar ${f.numero_factura}`}
                            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant hover:text-primary"
                          >
                            <Icon name="edit" className="text-[20px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setAEliminar(f)}
                            title="Eliminar"
                            aria-label={`Eliminar ${f.numero_factura}`}
                            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant hover:text-error"
                          >
                            <Icon name="delete" className="text-[20px]" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibles.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm font-light text-on-surface-variant"
                  >
                    Nada coincide con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <div className="flex items-center justify-between border-t border-outline-variant bg-surface-container-low px-6 py-3">
            <span className="text-xs font-light text-on-surface-variant">
              Mostrando {visibles.length} de {facturas.length}
            </span>
            <span className="text-xs font-bold tabular-nums text-on-surface">
              Suma de lo filtrado: {fmt(sumaVisible)}
            </span>
          </div>
        </div>
        </>
      )}

      {/* ===== Modal crear / editar factura ===== */}
      {modal !== undefined && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-on-surface">
                {modal ? `Editar ${modal.numero_factura}` : "Nueva factura"}
              </h2>
              <button
                type="button"
                onClick={() => setModal(undefined)}
                aria-label="Cerrar"
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            {/* ¿Cobro o pago? (al editar sirve para reclasificar) */}
            {(
              <div className="mt-4 flex rounded-xl bg-surface-container-high p-1">
                {(
                  [
                    { id: "cobrar", label: "Cobro", icono: "call_received" },
                    { id: "pagar", label: "Pago", icono: "call_made" },
                  ] as const
                ).map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setTipoNueva(op.id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors",
                      tipoNueva === op.id
                        ? "bg-primary font-bold text-on-primary shadow-sm"
                        : "font-light text-on-surface-variant hover:text-on-surface"
                    )}
                  >
                    <Icon name={op.icono} className="text-[18px]" />
                    {op.label}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={guardar} className="mt-5 flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={claseEtiqueta}>
                    {tipoForm === "pagar" ? "Proveedor / acreedor *" : "Cliente *"}
                  </label>
                  <input
                    name="cliente"
                    required
                    defaultValue={modal?.cliente ?? ""}
                    placeholder={
                      tipoForm === "cobrar" ? "Nombre del cliente" : "Ej: Colanta"
                    }
                    className={claseCampo}
                  />
                </div>
                <div>
                  <label className={claseEtiqueta}>
                    {tipoForm === "pagar" ? "N° / referencia *" : "N° de factura *"}
                  </label>
                  <input
                    name="numero_factura"
                    required
                    defaultValue={modal?.numero_factura ?? ""}
                    placeholder={tipoForm === "cobrar" ? "FAC-001" : "RENTA-JUL"}
                    className={claseCampo}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={claseEtiqueta}>
                    WhatsApp {tipoForm === "cobrar" ? "del cliente" : "del proveedor"}
                  </label>
                  <input
                    name="telefono_contacto"
                    type="tel"
                    placeholder="+57 300 000 0000"
                    className={claseCampo}
                  />
                </div>
                <div>
                  <label className={claseEtiqueta}>
                    Email {tipoForm === "cobrar" ? "del cliente" : "del proveedor"}
                  </label>
                  <input
                    name="email_contacto"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    className={claseCampo}
                  />
                </div>
                <p className="-mt-2 text-[11px] font-light text-on-surface-variant sm:col-span-2">
                  Opcional. Se guarda en tu libreta de contactos para los
                  recordatorios automáticos.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={claseEtiqueta}>Monto *</label>
                  <input
                    name="monto"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    defaultValue={modal ? Number(modal.monto) : ""}
                    placeholder="0.00"
                    className={cn(claseCampo, "tabular-nums")}
                  />
                </div>
                <div>
                  <label className={claseEtiqueta}>Emisión *</label>
                  <input
                    name="fecha_emision"
                    type="date"
                    required
                    defaultValue={modal?.fecha_emision ?? hoy}
                    className={claseCampo}
                  />
                </div>
                <div>
                  <label className={claseEtiqueta}>Vencimiento</label>
                  <input
                    name="fecha_vencimiento"
                    type="date"
                    defaultValue={modal?.fecha_vencimiento ?? ""}
                    className={claseCampo}
                  />
                </div>
              </div>

              <div>
                <label className={claseEtiqueta}>Concepto</label>
                <textarea
                  name="concepto"
                  rows={2}
                  defaultValue={modal?.concepto ?? ""}
                  placeholder={
                    tipoForm === "cobrar"
                      ? "¿Qué se facturó?"
                      : "Ej: insumos, renta del local, cuota del crédito…"
                  }
                  className={claseCampo}
                />
              </div>

              {tipoForm === "pagar" && (
                <>
                  <div>
                    <label className={claseEtiqueta}>
                      ¿Por qué medio se debe pagar?
                    </label>
                    <select
                      name="medio_pago_previsto"
                      defaultValue={modal?.medio_pago_previsto ?? ""}
                      className={claseCampo}
                    >
                      <option value="">Sin definir</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="credito">Crédito</option>
                    </select>
                  </div>

                  <div className="rounded-lg border border-primary-container bg-primary-fixed/30 p-4">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={recurrente}
                        onChange={(e) => setRecurrente(e.target.checked)}
                        className="h-4 w-4 accent-[#42682F]"
                      />
                      <span className="text-sm font-semibold text-on-surface">
                        Pago recurrente (renta, nómina, servicios…)
                      </span>
                    </label>
                    {recurrente && (
                      <div className="mt-3 flex items-center gap-2 text-sm font-light text-on-surface-variant">
                        Se paga el día
                        <input
                          name="dia_recurrencia"
                          type="number"
                          min={1}
                          max={31}
                          required
                          defaultValue={modal?.dia_recurrencia ?? 1}
                          className="w-20 rounded-lg border border-primary-container bg-surface-container-low p-2 text-center text-sm tabular-nums text-on-surface outline-none focus:ring-2 focus:ring-primary"
                        />
                        de cada mes. Al pagarla, MapFlow genera la del mes siguiente.
                      </div>
                    )}
                  </div>
                </>
              )}

              {modal && (
                <div>
                  <label className={claseEtiqueta}>¿Ya está pagada?</label>
                  <select
                    name="estado"
                    defaultValue={modal.estado}
                    className={claseCampo}
                  >
                    <option value="pendiente">No, sigue pendiente</option>
                    <option value="pagado">Sí, ya está pagada</option>
                    <option value="vencido">No, y ya venció</option>
                  </select>
                  <p className="mt-1 text-[11px] font-light text-on-surface-variant">
                    Las facturas sin pagar se ven resaltadas en la tabla.
                  </p>
                </div>
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
                      ⚠️ Ya registraste un cobro por este monto para este
                      cliente hoy (posiblemente vía Telegram).
                    </strong>{" "}
                    ¿Seguro que es diferente? Si lo es, vuelve a pulsar guardar.
                  </span>
                </div>
              )}

              {errorForm && (
                <div className="flex items-start gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
                  <Icon name="error" className="mt-0.5 shrink-0 text-[18px]" />
                  {errorForm}
                </div>
              )}

              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModal(undefined)}
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
                      <Icon
                        name="progress_activity"
                        className="animate-spin text-[16px]"
                      />
                      Guardando…
                    </>
                  ) : avisoDuplicado ? (
                    "Sí, es diferente — guardar"
                  ) : modal ? (
                    "Guardar cambios"
                  ) : (
                    "Guardar"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL COMPARTIDO de cobro/pago (triángulo ⚠️) ===== */}
      {planPara && (
        <ModalCobroPago
          factura={planPara}
          contactoInicial={planPara.contacto}
          onCerrar={() => setPlanPara(null)}
        />
      )}

      {/* ===== Libreta de contactos ===== */}
      {libretaAbierta && (
        <LibretaContactos
          facturas={facturas}
          onCerrar={() => setLibretaAbierta(false)}
        />
      )}

      {/* ===== Confirmación de eliminación ===== */}
      {aEliminar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-error-container">
                <Icon
                  name="delete_forever"
                  className="text-[24px] text-on-error-container"
                />
              </div>
              <h2 className="text-xl font-bold text-on-surface">
                ¿Eliminar este registro?
              </h2>
            </div>
            <p className="mt-4 text-sm font-light leading-relaxed text-on-surface-variant">
              Vas a eliminar{" "}
              <strong className="font-semibold text-on-surface">
                {aEliminar.numero_factura}
              </strong>{" "}
              de{" "}
              <strong className="font-semibold text-on-surface">
                {aEliminar.cliente}
              </strong>{" "}
              por{" "}
              <strong className="font-semibold text-on-surface">
                {fmt(Number(aEliminar.monto))}
              </strong>
              . Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAEliminar(null)}
                className="rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                disabled={ocupado}
                className="flex items-center gap-2 rounded-xl bg-error px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-error transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {ocupado ? (
                  <>
                    <Icon
                      name="progress_activity"
                      className="animate-spin text-[16px]"
                    />
                    Eliminando…
                  </>
                ) : (
                  "Sí, eliminar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
