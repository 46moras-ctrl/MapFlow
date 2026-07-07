"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/app/icon";
import { LibretaContactos } from "@/components/app/libreta-contactos";
import { StatusBadge } from "@/components/app/status-badge";
import { AjustesRecordatorios } from "./ajustes-recordatorios";
import {
  ETIQUETA_MEDIO,
  ICONO_MEDIO,
  MEDIOS_COBRO,
  MEDIOS_PAGO,
  estadoVisual,
  fmt,
  formatearFecha,
  hoyISO,
  sumarMeses,
  type ConfigEmpresa,
  type DatosFactura,
  type FacturaDB,
  type MedioPago,
  type TipoFactura,
} from "@/lib/facturas";
import { iniciales } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  actualizarFactura,
  cambiarEstado,
  crearFactura,
  eliminarFactura,
  pagarConCredito,
  pagarFactura,
} from "./actions";

type Filtro = "todas" | "pendientes" | "vencidas" | "pagadas";

const filtrosDisponibles: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "pendientes", label: "Pendientes" },
  { id: "vencidas", label: "Vencidas" },
  { id: "pagadas", label: "Pagadas" },
];

// Colorimetría: POR PAGAR se ve claramente más verde que POR COBRAR
function obtenerTema(tipo: TipoFactura) {
  if (tipo === "pagar") {
    return {
      contraparte: "Proveedor / acreedor",
      numeroLabel: "N° / referencia",
      tarjeta: "border-primary-container bg-primary-fixed/40",
      filtros: "border-primary-container bg-primary-fixed/25",
      tabla: "border-primary-container bg-primary-fixed/20",
      thead: "border-primary-container bg-primary-container/40",
      hoverFila: "hover:bg-primary-container/25",
      pieTabla: "border-primary-container bg-primary-container/25",
      cta: "bg-secondary text-on-secondary",
      avatar: "bg-secondary-container text-on-secondary-container",
      divisor: "divide-primary-container/70",
    };
  }
  return {
    contraparte: "Cliente",
    numeroLabel: "N° de factura",
    tarjeta: "border-outline-variant bg-surface-container-lowest",
    filtros: "border-outline-variant bg-surface",
    tabla: "border-outline-variant bg-surface-container-lowest",
    thead: "border-outline-variant bg-surface-container-low",
    hoverFila: "hover:bg-surface-container",
    pieTabla: "border-outline-variant bg-surface-container-low",
    cta: "bg-primary text-on-primary",
    avatar: "bg-primary-container text-on-primary-container",
    divisor: "divide-outline-variant",
  };
}

/* ================= TARJETA CÍCLICA (punto 1) ================= */
function TarjetaCiclica({
  facturas,
  tipo,
}: {
  facturas: FacturaDB[];
  tipo: TipoFactura;
}) {
  const [idx, setIdx] = useState(0);
  const hoy = hoyISO();

  const vencidas = facturas.filter(
    (f) => estadoVisual(f, hoy) === "vencida"
  ).length;
  const pendientes = facturas.filter((f) =>
    ["pendiente", "por_vencer"].includes(estadoVisual(f, hoy))
  ).length;
  const pagadas = facturas.filter((f) => f.estado === "pagado").length;

  const estados = [
    {
      titulo: "Facturas vencidas",
      valor: vencidas,
      icono: "warning",
      clase: "border-error/40 bg-error-container/70 text-on-error-container",
      sub:
        tipo === "cobrar"
          ? "lo más urgente: a quién cobrar ya"
          : "lo más urgente: qué pagar ya",
    },
    {
      titulo: "Facturas pendientes",
      valor: pendientes,
      icono: "pending_actions",
      clase:
        "border-tertiary-container bg-tertiary-container/50 text-on-tertiary-container",
      sub: "en curso, aún a tiempo",
    },
    {
      titulo: "Facturas pagadas",
      valor: pagadas,
      icono: "task_alt",
      clase:
        "border-primary-container bg-secondary-container/60 text-on-secondary-container",
      sub: "completadas",
    },
  ];
  const e = estados[idx];

  return (
    <button
      type="button"
      onClick={() => setIdx((idx + 1) % estados.length)}
      aria-label={`${e.titulo}: ${e.valor}. Clic para ver el siguiente estado`}
      className={cn(
        "rounded-xl border p-6 text-left transition-all duration-200 active:scale-[0.98]",
        e.clase
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <Icon name={e.icono} className="text-[18px]" />
          {e.titulo}
        </div>
        <Icon name="sync" className="text-[16px] opacity-60" />
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">{e.valor}</div>
      <div className="mt-1 text-xs font-light opacity-80">
        {e.sub} · clic para alternar
      </div>
    </button>
  );
}

/* ================= SECCIÓN COMPLETA POR TIPO ================= */
export function SeccionFacturas({
  tipo,
  facturas,
  config,
}: {
  tipo: TipoFactura;
  facturas: FacturaDB[];
  config: ConfigEmpresa;
}) {
  const tema = obtenerTema(tipo);
  const hoy = hoyISO();

  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busqueda, setBusqueda] = useState("");
  // modal === undefined: cerrado · null: crear · FacturaDB: editar
  const [modal, setModal] = useState<FacturaDB | null | undefined>(undefined);
  const [recurrente, setRecurrente] = useState(false);
  const [aEliminar, setAEliminar] = useState<FacturaDB | null>(null);
  const [pagando, setPagando] = useState<FacturaDB | null>(null);
  const [pasoCredito, setPasoCredito] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [libretaAbierta, setLibretaAbierta] = useState(false);
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [ocupado, startTransition] = useTransition();

  const totalAbierto = facturas
    .filter((f) => f.estado !== "pagado")
    .reduce((s, f) => s + Number(f.monto), 0);
  const abiertas = facturas.filter((f) => f.estado !== "pagado").length;
  const listaVencidas = facturas.filter(
    (f) => estadoVisual(f, hoy) === "vencida"
  );
  const totalVencido = listaVencidas.reduce((s, f) => s + Number(f.monto), 0);

  const visibles = facturas.filter((f) => {
    const visual = estadoVisual(f, hoy);
    const pasaEstado =
      filtro === "todas" ||
      (filtro === "pendientes" &&
        (visual === "pendiente" || visual === "por_vencer")) ||
      (filtro === "vencidas" && visual === "vencida") ||
      (filtro === "pagadas" && visual === "pagada");
    const q = busqueda.trim().toLowerCase();
    const pasaBusqueda =
      !q ||
      f.cliente.toLowerCase().includes(q) ||
      f.numero_factura.toLowerCase().includes(q);
    return pasaEstado && pasaBusqueda;
  });

  function abrirModal(f: FacturaDB | null) {
    setErrorForm(null);
    setRecurrente(Boolean(f?.es_recurrente));
    setModal(f);
  }

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorForm(null);
    const fd = new FormData(e.currentTarget);
    const datos: DatosFactura = {
      tipo,
      numero_factura: String(fd.get("numero_factura") ?? ""),
      cliente: String(fd.get("cliente") ?? ""),
      monto: Number(fd.get("monto")),
      fecha_emision: String(fd.get("fecha_emision") ?? ""),
      fecha_vencimiento: String(fd.get("fecha_vencimiento") ?? "") || null,
      concepto: String(fd.get("concepto") ?? "") || null,
      // Datos de la libreta: si vienen, el contacto se crea o
      // actualiza automáticamente y queda vinculado a la factura
      telefono_contacto: String(fd.get("telefono_contacto") ?? "") || null,
      email_contacto: String(fd.get("email_contacto") ?? "") || null,
      ...(tipo === "pagar"
        ? {
            medio_pago_previsto:
              (String(fd.get("medio_pago_previsto") ?? "") as MedioPago) ||
              null,
            es_recurrente: recurrente,
            dia_recurrencia: recurrente
              ? Number(fd.get("dia_recurrencia"))
              : null,
          }
        : {}),
      ...(modal ? { estado: fd.get("estado") as DatosFactura["estado"] } : {}),
    };

    startTransition(async () => {
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

  function elegirMedio(medio: MedioPago) {
    if (!pagando) return;
    if (tipo === "pagar" && medio === "credito") {
      setPasoCredito(true);
      return;
    }
    setErrorForm(null);
    startTransition(async () => {
      const res = await pagarFactura(pagando.id, medio);
      if (!res.ok) {
        setErrorForm(res.error ?? "Ocurrió un error.");
        return;
      }
      setPagando(null);
    });
  }

  function confirmarCredito(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pagando) return;
    setErrorForm(null);
    const fd = new FormData(e.currentTarget);
    const cuotas = Number(fd.get("cuotas"));
    const primera = String(fd.get("primera_fecha") ?? "");
    startTransition(async () => {
      const res = await pagarConCredito(pagando.id, cuotas, primera);
      if (!res.ok) {
        setErrorForm(res.error ?? "Ocurrió un error.");
        return;
      }
      setPagando(null);
      setPasoCredito(false);
    });
  }

  function reabrir(f: FacturaDB) {
    setErrorGeneral(null);
    startTransition(async () => {
      const res = await cambiarEstado(f.id, "pendiente");
      if (!res.ok) setErrorGeneral(res.error ?? "Ocurrió un error.");
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

  const mediosDisponibles = tipo === "pagar" ? MEDIOS_PAGO : MEDIOS_COBRO;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-light text-on-surface-variant">
          {tipo === "cobrar"
            ? "Dinero que te deben tus clientes."
            : "Todo lo pendiente de pagar: proveedores, renta, servicios, créditos."}
        </p>
        <div className="flex items-center gap-2">
          {/* Libreta: clientes en Cobrar, proveedores en Pagar */}
          <button
            type="button"
            onClick={() => setLibretaAbierta(true)}
            className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Icon name="contacts" className="text-[18px]" />
            Contactos
          </button>
          {/* Ajustes de recordatorios (canal, switch de pagos, datos del dueño) */}
          <button
            type="button"
            onClick={() => setAjustesAbiertos(true)}
            aria-label="Ajustes de recordatorios"
            title="Ajustes de recordatorios"
            className="flex items-center rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Icon name="settings" className="text-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => abrirModal(null)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90 active:scale-[0.98]",
              tema.cta
            )}
          >
            <Icon name="add" className="text-[18px]" />
            {tipo === "cobrar" ? "Nueva factura" : "Registrar cuenta por pagar"}
          </button>
        </div>
      </div>

      {errorGeneral && (
        <div className="flex items-center gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
          <Icon name="error" className="text-[18px]" />
          {errorGeneral}
        </div>
      )}

      {/* Tarjetas de resumen (la tercera es la cíclica) */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className={cn("rounded-xl border p-6 shadow-level-1", tema.tarjeta)}>
          <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            {tipo === "cobrar" ? "Total por cobrar" : "Total por pagar"}
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums text-on-surface">
            {fmt(totalAbierto)}
          </div>
          <div className="mt-1 text-xs font-light text-on-surface-variant">
            {abiertas} cuenta{abiertas === 1 ? "" : "s"} abierta
            {abiertas === 1 ? "" : "s"}
          </div>
        </div>
        <div className={cn("rounded-xl border p-6 shadow-level-1", tema.tarjeta)}>
          <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Total vencido
          </div>
          <div
            className={cn(
              "mt-2 text-3xl font-bold tabular-nums",
              totalVencido > 0 ? "text-error" : "text-on-surface"
            )}
          >
            {fmt(totalVencido)}
          </div>
          <div className="mt-1 text-xs font-light text-on-surface-variant">
            {listaVencidas.length === 0
              ? "Nada vencido. ¡Bien ahí!"
              : `${listaVencidas.length} requiere${listaVencidas.length === 1 ? "" : "n"} acción inmediata`}
          </div>
        </div>
        <TarjetaCiclica facturas={facturas} tipo={tipo} />
      </div>

      {/* Filtros */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-xl border p-4",
          tema.filtros
        )}
      >
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Filtrar:
        </span>
        {filtrosDisponibles.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={
              filtro === f.id
                ? cn(
                    "rounded-lg px-3 py-1.5 text-xs font-bold",
                    tipo === "pagar"
                      ? "bg-secondary text-on-secondary"
                      : "bg-primary text-on-primary"
                  )
                : "rounded-lg bg-surface-container-high px-3 py-1.5 text-xs font-light text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            }
          >
            {f.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 rounded-full bg-surface-container-low px-4 py-2">
          <Icon name="search" className="text-[18px] text-on-surface-variant" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={
              tipo === "cobrar" ? "Cliente o n°…" : "Proveedor o n°…"
            }
            className="w-44 bg-transparent text-sm font-light text-on-surface outline-none placeholder:text-on-surface-variant/60"
          />
        </label>
      </div>

      {/* Tabla o estado vacío */}
      {facturas.length === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center",
            tipo === "pagar"
              ? "border-primary-container bg-primary-fixed/25"
              : "border-outline-variant bg-surface-container-lowest"
          )}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container/50">
            <Icon
              name={tipo === "cobrar" ? "description" : "payments"}
              className="text-[32px] text-on-primary-container"
            />
          </div>
          <h3 className="mt-4 text-xl font-bold text-on-surface">
            {tipo === "cobrar"
              ? "Aún no tienes facturas por cobrar"
              : "Aún no registras cuentas por pagar"}
          </h3>
          <p className="mt-1 max-w-md text-sm font-light text-on-surface-variant">
            {tipo === "cobrar"
              ? "Registra tu primera factura y MapFlow vigilará los vencimientos por ti."
              : "Registra la renta, servicios, proveedores y deudas para no olvidar ningún pago."}
          </p>
          <button
            type="button"
            onClick={() => abrirModal(null)}
            className={cn(
              "mt-6 flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90",
              tema.cta
            )}
          >
            <Icon name="add" className="text-[18px]" />
            {tipo === "cobrar"
              ? "Registrar mi primera factura"
              : "Registrar mi primer pago pendiente"}
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "overflow-hidden rounded-xl border shadow-level-1",
            tema.tabla
          )}
        >
          <table className="w-full text-left">
            <thead className={cn("border-b", tema.thead)}>
              <tr className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                <th className="px-6 py-3">{tema.contraparte}</th>
                <th className="px-6 py-3">{tema.numeroLabel}</th>
                <th className="px-6 py-3 text-right">Monto</th>
                <th className="px-6 py-3">Vencimiento</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", tema.divisor)}>
              {visibles.map((f) => {
                const visual = estadoVisual(f, hoy);
                return (
                  <tr
                    key={f.id}
                    className={cn(
                      "group text-sm transition-colors",
                      tema.hoverFila
                    )}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            tema.avatar
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
                          <Icon
                            name="event_repeat"
                            className="text-[16px] text-secondary"
                            // título nativo del navegador
                          />
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
                      {f.es_recurrente && f.dia_recurrencia && (
                        <div className="text-[11px] font-light text-secondary">
                          el {f.dia_recurrencia} de cada mes
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-on-surface">
                      {fmt(Number(f.monto))}
                    </td>
                    <td className="px-6 py-3.5 font-light text-on-surface-variant">
                      {formatearFecha(f.fecha_vencimiento)}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge estado={visual} />
                      {f.estado === "pagado" && f.medio_pago && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-light text-on-surface-variant">
                          <Icon
                            name={ICONO_MEDIO[f.medio_pago]}
                            className="text-[13px]"
                          />
                          {ETIQUETA_MEDIO[f.medio_pago]}
                        </div>
                      )}
                      {f.estado !== "pagado" &&
                        tipo === "pagar" &&
                        f.medio_pago_previsto && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] font-light text-on-surface-variant">
                            <Icon
                              name={ICONO_MEDIO[f.medio_pago_previsto]}
                              className="text-[13px]"
                            />
                            pagar por {ETIQUETA_MEDIO[f.medio_pago_previsto]}
                          </div>
                        )}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Link
                          href={`/facturas/${f.id}`}
                          aria-label={`Ver detalle de ${f.numero_factura}`}
                          title="Ver detalle"
                          className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant hover:text-primary"
                        >
                          <Icon name="visibility" className="text-[20px]" />
                        </Link>
                        {f.estado === "pagado" ? (
                          <button
                            type="button"
                            onClick={() => reabrir(f)}
                            disabled={ocupado}
                            title="Marcar pendiente"
                            aria-label={`Marcar ${f.numero_factura} como pendiente`}
                            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant hover:text-secondary disabled:opacity-50"
                          >
                            <Icon name="undo" className="text-[20px]" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setErrorForm(null);
                              setPasoCredito(false);
                              setPagando(f);
                            }}
                            disabled={ocupado}
                            title="Marcar pagada"
                            aria-label={`Marcar ${f.numero_factura} como pagada`}
                            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant hover:text-secondary disabled:opacity-50"
                          >
                            <Icon name="check_circle" className="text-[20px]" />
                          </button>
                        )}
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
                    </td>
                  </tr>
                );
              })}
              {visibles.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm font-light text-on-surface-variant"
                  >
                    Nada coincide con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div
            className={cn(
              "flex items-center justify-between border-t px-6 py-3",
              tema.pieTabla
            )}
          >
            <span className="text-xs font-light text-on-surface-variant">
              Mostrando {visibles.length} de {facturas.length}
            </span>
          </div>
        </div>
      )}

      {/* ===== Modal crear / editar ===== */}
      {modal !== undefined && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-on-surface">
                {modal
                  ? `Editar ${modal.numero_factura}`
                  : tipo === "cobrar"
                    ? "Nueva factura por cobrar"
                    : "Nueva cuenta por pagar"}
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

            <form onSubmit={guardar} className="mt-5 flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    {tema.contraparte} *
                  </label>
                  <input
                    name="cliente"
                    required
                    defaultValue={modal?.cliente ?? ""}
                    placeholder={
                      tipo === "cobrar" ? "Nombre del cliente" : "Ej: Colanta"
                    }
                    className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    {tema.numeroLabel} *
                  </label>
                  <input
                    name="numero_factura"
                    required
                    defaultValue={modal?.numero_factura ?? ""}
                    placeholder={tipo === "cobrar" ? "FAC-001" : "RENTA-JUL"}
                    className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Contacto del cliente/proveedor → libreta automática */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    WhatsApp {tipo === "cobrar" ? "del cliente" : "del proveedor"}
                  </label>
                  <input
                    name="telefono_contacto"
                    type="tel"
                    placeholder="+57 300 000 0000"
                    className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Email {tipo === "cobrar" ? "del cliente" : "del proveedor"}
                  </label>
                  <input
                    name="email_contacto"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </div>
                <p className="-mt-2 text-[11px] font-light text-on-surface-variant sm:col-span-2">
                  Opcional. Se guarda en tu libreta de contactos para los
                  recordatorios automáticos.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Monto *
                  </label>
                  <input
                    name="monto"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    defaultValue={modal ? Number(modal.monto) : ""}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light tabular-nums text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Emisión *
                  </label>
                  <input
                    name="fecha_emision"
                    type="date"
                    required
                    defaultValue={modal?.fecha_emision ?? hoy}
                    className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Vencimiento
                  </label>
                  <input
                    name="fecha_vencimiento"
                    type="date"
                    defaultValue={modal?.fecha_vencimiento ?? ""}
                    className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Concepto
                </label>
                <textarea
                  name="concepto"
                  rows={2}
                  defaultValue={modal?.concepto ?? ""}
                  placeholder={
                    tipo === "cobrar"
                      ? "¿Qué se facturó?"
                      : "Ej: insumos, renta del local, cuota del crédito…"
                  }
                  className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                />
              </div>

              {tipo === "pagar" && (
                <>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      ¿Por qué medio se debe pagar?
                    </label>
                    <select
                      name="medio_pago_previsto"
                      defaultValue={modal?.medio_pago_previsto ?? ""}
                      className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
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
                        de cada mes. Al pagarla, MapFlow genera la del mes
                        siguiente.
                      </div>
                    )}
                  </div>
                </>
              )}

              {modal && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Estado
                  </label>
                  <select
                    name="estado"
                    defaultValue={modal.estado}
                    className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="pagado">Pagada</option>
                    <option value="vencido">Vencida</option>
                  </select>
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
                    tema.cta
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

      {/* ===== Modal "¿Con qué medio se pagó?" (+ crédito) ===== */}
      {pagando && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-on-surface">
                {pasoCredito
                  ? "Pago con crédito: define las cuotas"
                  : tipo === "cobrar"
                    ? "¿Cómo te pagaron?"
                    : "¿Con qué medio pagaste?"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setPagando(null);
                  setPasoCredito(false);
                }}
                aria-label="Cerrar"
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            <p className="mt-1 text-sm font-light text-on-surface-variant">
              {pagando.numero_factura} · {pagando.cliente} ·{" "}
              {fmt(Number(pagando.monto))}
            </p>

            {!pasoCredito ? (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {mediosDisponibles.map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={ocupado}
                      onClick={() => elegirMedio(m)}
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
                          la deuda pasa a tu tarjeta
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {ocupado && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm font-light text-on-surface-variant">
                    <Icon
                      name="progress_activity"
                      className="animate-spin text-[18px]"
                    />
                    Registrando pago…
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={confirmarCredito} className="mt-5 flex flex-col gap-4">
                <div className="rounded-lg border border-tertiary-container bg-tertiary-container/20 px-4 py-3 text-sm font-light leading-relaxed text-on-tertiary-container">
                  <strong className="font-semibold">
                    La deuda no desaparece: cambia de acreedor.
                  </strong>{" "}
                  Esta cuenta quedará pagada (medio: crédito) y se creará una
                  nueva deuda con tu tarjeta, enlazada a esta factura, dividida
                  en las cuotas que definas.
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Número de cuotas *
                    </label>
                    <input
                      name="cuotas"
                      type="number"
                      min={1}
                      max={48}
                      required
                      defaultValue={1}
                      className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm tabular-nums text-on-surface outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Primera cuota vence *
                    </label>
                    <input
                      name="primera_fecha"
                      type="date"
                      required
                      defaultValue={sumarMeses(hoy, 1)}
                      className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {errorForm && (
                  <div className="flex items-start gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
                    <Icon name="error" className="mt-0.5 shrink-0 text-[18px]" />
                    {errorForm}
                  </div>
                )}

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
                        <Icon
                          name="progress_activity"
                          className="animate-spin text-[16px]"
                        />
                        Generando cuotas…
                      </>
                    ) : (
                      "Confirmar pago con crédito"
                    )}
                  </button>
                </div>
              </form>
            )}

            {!pasoCredito && errorForm && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
                <Icon name="error" className="mt-0.5 shrink-0 text-[18px]" />
                {errorForm}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Libreta de contactos (clientes o proveedores) ===== */}
      {libretaAbierta && (
        <LibretaContactos
          tipo={tipo === "cobrar" ? "cliente" : "proveedor"}
          facturas={facturas}
          onCerrar={() => setLibretaAbierta(false)}
        />
      )}

      {/* ===== Ajustes de recordatorios ===== */}
      {ajustesAbiertos && (
        <AjustesRecordatorios
          config={config}
          onCerrar={() => setAjustesAbiertos(false)}
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
