"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/app/icon";
import { fmt, formatearFecha } from "@/lib/facturas";
import {
  DIAS_SEMANA,
  ETIQUETA_CIERRE,
  ETIQUETA_FRECUENCIA,
  ROLES_SUGERIDOS,
  TIPOS_CONTRATO,
  normalizarConfigComisiones,
  type CambioComisionPendiente,
  type CierreNomina,
  type ConfigComisiones,
  type ConfigNomina,
  type EmpleadoDB,
  type EscalaComision,
  type FrecuenciaPago,
  type MetaComision,
  type ModalidadComision,
  type RolComision,
  type TipoComisionVenta,
  type TipoContrato,
  type TramoComision,
} from "@/lib/nomina";
import { cn } from "@/lib/utils";
import {
  actualizarEmpleado,
  cambiarActivoEmpleado,
  confirmarCambioComisiones,
  crearEmpleado,
  descartarCambioComisiones,
  eliminarEmpleado,
  guardarConfigComisiones,
  guardarConfigNomina,
  type DatosEmpleado,
} from "./nomina-actions";

// ============================================================
// AJUSTES → NÓMINA: dos desplegables (acordeón).
//   1) EMPLEADOS: lista + agregar/editar/desactivar/eliminar, y
//      debajo la frecuencia de pago del sueldo (una sola config
//      para toda la empresa).
//   2) COMISIONES (opcional): qué roles comisionan y con qué %,
//      y metas de bonificación. Si no se configura nada, las
//      comisiones NO aparecen en ninguna parte de la plataforma.
// ============================================================

const claseCampo =
  "mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary";
const claseEtiqueta =
  "text-xs font-bold uppercase tracking-wider text-on-surface-variant";
const botonGuardar =
  "flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-60";
const botonAnexar =
  "flex w-fit items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-container";

function Acordeon({
  titulo,
  descripcion,
  icono,
  abierto,
  onToggle,
  children,
}: {
  titulo: string;
  descripcion?: string;
  icono: string;
  abierto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <span>
          <span className="flex items-center gap-2 text-xl font-bold text-on-surface">
            <Icon name={icono} className="text-[22px] text-primary" />
            {titulo}
          </span>
          {descripcion && (
            <span className="mt-0.5 block text-sm font-light text-on-surface-variant">
              {descripcion}
            </span>
          )}
        </span>
        <Icon
          name={abierto ? "expand_less" : "expand_more"}
          className="text-[24px] text-on-surface-variant"
        />
      </button>
      {abierto && (
        <div className="border-t border-outline-variant px-6 py-5">{children}</div>
      )}
    </div>
  );
}

export function SeccionNomina({
  empleados,
  configNomina,
  configComisiones,
  cambioPendiente,
  exito,
  fallo,
}: {
  empleados: EmpleadoDB[];
  configNomina: ConfigNomina | null;
  configComisiones: ConfigComisiones | null;
  cambioPendiente: CambioComisionPendiente | null;
  exito: (msg: string) => void;
  fallo: (msg: string) => void;
}) {
  const router = useRouter();
  const [ocupado, startTransition] = useTransition();

  const [empleadosAbierto, setEmpleadosAbierto] = useState(true);
  const [comisionesAbierto, setComisionesAbierto] = useState(false);

  // ----- Empleados -----
  // null = agregar nuevo · EmpleadoDB = editar · undefined = cerrado
  const [empleadoModal, setEmpleadoModal] = useState<EmpleadoDB | null | undefined>(undefined);
  const [cargoOtro, setCargoOtro] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [aEliminar, setAEliminar] = useState<EmpleadoDB | null>(null);

  // ----- Frecuencia de pago y cierre de nómina -----
  const [frecuencia, setFrecuencia] = useState<FrecuenciaPago>(
    configNomina?.frecuencia ?? "mensual"
  );
  const [diasPago, setDiasPago] = useState<number[]>(configNomina?.dias ?? []);
  const [cierre, setCierre] = useState<CierreNomina>(configNomina?.cierre ?? "mensual");

  // ----- Comisiones (modalidades EXCLUYENTES) -----
  const configInicial = normalizarConfigComisiones(configComisiones);
  const [modalidad, setModalidad] = useState<ModalidadComision>(configInicial.modalidad);
  const [tipoVenta, setTipoVenta] = useState<TipoComisionVenta>(configInicial.tipo_venta);
  const [escala, setEscala] = useState<EscalaComision>(configInicial.escala);
  const [roles, setRoles] = useState<RolComision[]>(configInicial.roles);
  const [tramos, setTramos] = useState<TramoComision[]>(configInicial.tramos);
  const [metas, setMetas] = useState<MetaComision[]>(configInicial.metas);

  // Cargos elegibles para comisionar: los sugeridos + los cargos
  // reales de los empleados (incluye los escritos en "Otro")
  const cargosDisponibles = Array.from(
    new Set([
      ...ROLES_SUGERIDOS,
      ...empleados.map((e) => e.cargo.trim()).filter(Boolean),
    ])
  );

  function abrirEmpleado(e: EmpleadoDB | null) {
    setCargoOtro(Boolean(e && !ROLES_SUGERIDOS.includes(e.cargo as never)));
    setEmpleadoModal(e);
  }

  function guardarEmpleadoModal(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const cargoElegido = String(fd.get("cargo") ?? "");
    const datos: DatosEmpleado = {
      nombre: String(fd.get("nombre") ?? ""),
      documento: String(fd.get("documento") ?? "") || null,
      telefono: String(fd.get("telefono") ?? "") || null,
      direccion: String(fd.get("direccion") ?? "") || null,
      cargo:
        cargoElegido === "__otro__"
          ? String(fd.get("cargo_otro") ?? "")
          : cargoElegido,
      tipo_contrato: String(fd.get("tipo_contrato") ?? "indefinido") as TipoContrato,
      fecha_ingreso: String(fd.get("fecha_ingreso") ?? "") || null,
      salario_mensual: Number(fd.get("salario_mensual") ?? 0),
      fecha_nacimiento: String(fd.get("fecha_nacimiento") ?? "") || null,
      email: String(fd.get("email") ?? "") || null,
      emergencia_nombre: String(fd.get("emergencia_nombre") ?? "") || null,
      emergencia_telefono: String(fd.get("emergencia_telefono") ?? "") || null,
    };
    const editando = empleadoModal;
    startTransition(async () => {
      const res = editando
        ? await actualizarEmpleado(editando.id, datos)
        : await crearEmpleado(datos);
      if (!res.ok) return fallo(res.error ?? "No se pudo guardar el empleado.");
      setEmpleadoModal(undefined);
      exito(editando ? "Empleado actualizado." : "Empleado agregado.");
      router.refresh();
    });
  }

  function cambiarActivo(e: EmpleadoDB) {
    setMenuAbierto(null);
    startTransition(async () => {
      const res = await cambiarActivoEmpleado(e.id, !e.activo);
      if (!res.ok) return fallo(res.error ?? "No se pudo cambiar el estado.");
      exito(e.activo ? `${e.nombre} quedó inactivo.` : `${e.nombre} quedó activo.`);
      router.refresh();
    });
  }

  function confirmarEliminar() {
    if (!aEliminar) return;
    startTransition(async () => {
      const res = await eliminarEmpleado(aEliminar.id);
      setAEliminar(null);
      if (!res.ok) return fallo(res.error ?? "No se pudo eliminar.");
      exito("Empleado eliminado.");
      router.refresh();
    });
  }

  function toggleDiaPago(dia: number) {
    setDiasPago((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  }

  function guardarFrecuencia() {
    startTransition(async () => {
      const res = await guardarConfigNomina({ frecuencia, dias: diasPago, cierre });
      if (!res.ok) return fallo(res.error ?? "No se pudo guardar.");
      exito("Frecuencia de pago y cierre de nómina guardados.");
      router.refresh();
    });
  }

  function guardarComisiones() {
    startTransition(async () => {
      const res = await guardarConfigComisiones({
        modalidad,
        tipo_venta: tipoVenta,
        escala,
        roles,
        tramos,
        metas,
      });
      if (!res.ok) return fallo(res.error ?? "No se pudo guardar.");
      if (res.diferido) {
        exito(
          `Cambio de método programado para el cierre de nómina (${formatearFecha(res.diferido)}). Lo que resta del período se sigue comisionando con el método actual; recuerda confirmarlo antes del cierre.`
        );
      } else {
        exito(
          roles.length > 0
            ? "Comisiones configuradas: el campo Vendedor ya está disponible al registrar facturas."
            : "Comisiones desactivadas: no aparecerán en la plataforma."
        );
      }
      router.refresh();
    });
  }

  function responderCambioPendiente(confirmar: boolean) {
    startTransition(async () => {
      const res = confirmar
        ? await confirmarCambioComisiones()
        : await descartarCambioComisiones();
      if (!res.ok) return fallo(res.error ?? "No se pudo procesar.");
      exito(
        confirmar
          ? "Cambio confirmado: se aplicará automáticamente en el cierre de nómina."
          : "Cambio descartado: se sigue con el método actual."
      );
      router.refresh();
    });
  }

  const empleadoEnEdicion = empleadoModal ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* ============ DESPLEGABLE 1: EMPLEADOS ============ */}
      <Acordeon
        titulo="Empleados"
        descripcion="Tu equipo y la frecuencia con la que pagas los sueldos."
        icono="groups"
        abierto={empleadosAbierto}
        onToggle={() => setEmpleadosAbierto((v) => !v)}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => abrirEmpleado(null)}
            className="flex items-center gap-2 rounded-xl border border-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/5"
          >
            <Icon name="person_add" className="text-[16px]" />
            Agregar empleado
          </button>
        </div>

        {empleados.length === 0 ? (
          <p className="py-6 text-center text-sm font-light text-on-surface-variant">
            Aún no registras empleados. Usa «Agregar empleado» para armar tu nómina.
          </p>
        ) : (
          <div className="mt-3">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_40px] gap-2 px-2 pb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              <span>Nombre</span>
              <span>Cargo</span>
              <span className="text-right">Salario mensual</span>
              <span>Ingreso</span>
              <span />
            </div>
            {empleados.map((e) => (
              <div
                key={e.id}
                className={cn(
                  "grid grid-cols-[1.4fr_1fr_1fr_0.8fr_40px] items-center gap-2 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-surface-container",
                  !e.activo && "opacity-50"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold text-on-surface">
                    {e.nombre}
                  </span>
                  {!e.activo && (
                    <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Inactivo
                    </span>
                  )}
                </span>
                <span className="truncate font-light text-on-surface-variant">
                  {e.cargo}
                </span>
                <span className="text-right font-light tabular-nums text-on-surface-variant">
                  {fmt(Number(e.salario_mensual))}
                </span>
                <span className="truncate font-light text-on-surface-variant">
                  {e.fecha_ingreso ? formatearFecha(e.fecha_ingreso) : "—"}
                </span>
                <div className="relative justify-self-end">
                  <button
                    type="button"
                    onClick={() => setMenuAbierto(menuAbierto === e.id ? null : e.id)}
                    aria-label={`Opciones de ${e.nombre}`}
                    className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-variant"
                  >
                    <Icon name="more_vert" className="text-[20px]" />
                  </button>
                  {menuAbierto === e.id && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuAbierto(null)}
                      />
                      <div className="absolute right-0 top-9 z-50 w-44 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuAbierto(null);
                            abrirEmpleado(e);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-light text-on-surface hover:bg-surface-container"
                        >
                          <Icon name="edit" className="text-[18px]" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => cambiarActivo(e)}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-light text-on-surface hover:bg-surface-container"
                        >
                          <Icon
                            name={e.activo ? "person_off" : "person_check"}
                            className="text-[18px]"
                          />
                          {e.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuAbierto(null);
                            setAEliminar(e);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-light text-error hover:bg-error/5"
                        >
                          <Icon name="delete" className="text-[18px]" />
                          Eliminar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ----- Frecuencia de pago del sueldo (toda la empresa) ----- */}
        <div className="mt-5 rounded-xl border border-primary-container bg-primary-fixed/20 p-5">
          <h4 className="flex items-center gap-2 text-sm font-bold text-on-surface">
            <Icon name="event_repeat" className="text-[18px] text-primary" />
            Frecuencia de pago del sueldo
          </h4>
          <p className="mt-1 text-xs font-light text-on-surface-variant">
            Una sola configuración para toda la empresa. MapFlow te avisará
            cuando se acerque el día de pago con el total de salarios y
            comisiones pendientes.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(["semanal", "quincenal", "mensual"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFrecuencia(f);
                  setDiasPago([]);
                }}
                className={
                  frecuencia === f
                    ? "rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-on-primary"
                    : "rounded-lg bg-surface-container-high px-4 py-1.5 text-xs font-light text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                }
              >
                {ETIQUETA_FRECUENCIA[f]}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <span className={claseEtiqueta}>
              {frecuencia === "semanal" ? "Días de la semana" : "Días del mes"}
            </span>
            {frecuencia === "semanal" ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map((nombre, dia) => (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => toggleDiaPago(dia)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs transition-colors",
                      diasPago.includes(dia)
                        ? "bg-secondary font-bold text-on-secondary"
                        : "bg-surface-container-high font-light text-on-surface-variant hover:bg-surface-container-highest"
                    )}
                  >
                    {nombre}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-7 gap-1.5 sm:grid-cols-11">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => toggleDiaPago(dia)}
                    className={cn(
                      "rounded-lg py-1.5 text-center text-xs tabular-nums transition-colors",
                      diasPago.includes(dia)
                        ? "bg-secondary font-bold text-on-secondary"
                        : "bg-surface-container-high font-light text-on-surface-variant hover:bg-surface-container-highest"
                    )}
                  >
                    {dia}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] font-light text-on-surface-variant">
              {frecuencia === "quincenal"
                ? "Lo usual: dos días, por ejemplo el 15 y el 30."
                : frecuencia === "mensual"
                  ? "El día 31 se ajusta solo en los meses cortos."
                  : "Elige el día (o días) de la semana en que pagas."}
            </p>
          </div>

          {/* Cierre de nómina: aquí se aplican los cambios de
              método de comisión programados */}
          <div className="mt-4">
            <span className={claseEtiqueta}>Cierre de nómina</span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(["mensual", "trimestral", "semestral", "anual"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCierre(c)}
                  className={
                    cierre === c
                      ? "rounded-lg bg-secondary px-4 py-1.5 text-xs font-bold text-on-secondary"
                      : "rounded-lg bg-surface-container-high px-4 py-1.5 text-xs font-light text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                  }
                >
                  {ETIQUETA_CIERRE[c]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] font-light text-on-surface-variant">
              El cierre ocurre el último día del período (fin de mes, de
              trimestre…). Los cambios de método de comisión se aplican en el
              próximo cierre, y ahí también se reinicia el conteo de ventas de
              la comisión escalonada por cantidad.
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={guardarFrecuencia}
              disabled={ocupado || diasPago.length === 0}
              className={botonGuardar}
            >
              <Icon name="save" className="text-[16px]" />
              Guardar frecuencia
            </button>
          </div>
        </div>
      </Acordeon>

      {/* ============ DESPLEGABLE 2: COMISIONES ============ */}
      <Acordeon
        titulo="Comisiones"
        descripcion="Opcional: si no configuras nada aquí, las comisiones no aparecen en la plataforma."
        icono="percent"
        abierto={comisionesAbierto}
        onToggle={() => setComisionesAbierto((v) => !v)}
      >
        {/* ----- Cambio de método programado (requiere confirmación) ----- */}
        {cambioPendiente && (
          <div className="mb-5 rounded-xl border border-tertiary-container bg-tertiary-container/40 p-4">
            <div className="flex items-start gap-3">
              <Icon
                name={cambioPendiente.confirmado ? "event_available" : "pending_actions"}
                className="mt-0.5 text-[22px] text-on-tertiary-container"
              />
              <div className="flex-1 text-sm text-on-tertiary-container">
                <strong className="font-semibold">
                  {cambioPendiente.confirmado
                    ? `Cambio de método confirmado: se aplica el ${formatearFecha(cambioPendiente.aplica_el)}.`
                    : `Tienes un cambio de método programado para el cierre de nómina (${formatearFecha(cambioPendiente.aplica_el)}).`}
                </strong>{" "}
                <span className="font-light">
                  Lo que resta del período se sigue comisionando con el método
                  actual.{" "}
                  {!cambioPendiente.confirmado &&
                    "Si no lo confirmas antes del cierre, el cambio no se realizará."}
                </span>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              {!cambioPendiente.confirmado && (
                <button
                  type="button"
                  onClick={() => responderCambioPendiente(true)}
                  disabled={ocupado}
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  Confirmar cambio
                </button>
              )}
              <button
                type="button"
                onClick={() => responderCambioPendiente(false)}
                disabled={ocupado}
                className="rounded-xl border border-outline-variant px-5 py-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant disabled:opacity-60"
              >
                Descartar
              </button>
            </div>
          </div>
        )}

        {/* ----- Modalidad (EXCLUYENTE): por venta o por metas ----- */}
        <h4 className="text-sm font-bold text-on-surface">¿Cómo se comisiona?</h4>
        <p className="mt-1 text-xs font-light text-on-surface-variant">
          Las empresas manejan una sola forma de comisionar: al activar una,
          la otra se desactiva.
        </p>
        <div className="mt-3 flex rounded-xl bg-surface-container-high p-1">
          {(
            [
              {
                id: "venta",
                label: "Comisión por venta",
                icono: "percent",
              },
              {
                id: "metas",
                label: "Meta con bonificación",
                icono: "emoji_events",
              },
            ] as const
          ).map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => setModalidad(op.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors",
                modalidad === op.id
                  ? "bg-primary font-bold text-on-primary shadow-sm"
                  : "font-light text-on-surface-variant hover:text-on-surface"
              )}
            >
              <Icon name={op.icono} className="text-[18px]" />
              {op.label}
            </button>
          ))}
        </div>

        {/* ----- Quién comisiona (en ambas modalidades) ----- */}
        <h4 className="mt-5 text-sm font-bold text-on-surface">Cargos que comisionan</h4>
        <p className="mt-1 text-xs font-light text-on-surface-variant">
          {modalidad === "venta" && tipoVenta === "directa"
            ? "Elige los cargos y su % por venta. Todos los empleados del cargo heredan el mismo %. El % de cada venta queda congelado al registrarla: cambiarlo después no toca el historial."
            : "Elige los cargos que participan: sus empleados aparecerán en el campo Vendedor de las facturas."}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {roles.map((rol, i) => (
            <div key={i} className="flex items-center gap-3">
              <select
                value={rol.cargo}
                onChange={(ev) =>
                  setRoles(roles.map((r, j) => (j === i ? { ...r, cargo: ev.target.value } : r)))
                }
                aria-label={`Cargo que comisiona ${i + 1}`}
                className="w-full rounded-lg border border-primary-container bg-surface-container-low p-2.5 text-sm font-light text-on-surface outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">— Elige el cargo —</option>
                {Array.from(new Set([...cargosDisponibles, rol.cargo])).filter(Boolean).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {/* El % por cargo solo existe en la venta DIRECTA */}
              {modalidad === "venta" && tipoVenta === "directa" && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <input
                    type="number"
                    min={0.1}
                    max={100}
                    step={0.1}
                    value={rol.porcentaje || ""}
                    onChange={(ev) =>
                      setRoles(
                        roles.map((r, j) =>
                          j === i ? { ...r, porcentaje: Number(ev.target.value) } : r
                        )
                      )
                    }
                    placeholder="5"
                    aria-label={`Porcentaje de comisión del cargo ${rol.cargo || i + 1}`}
                    className="w-20 rounded-lg border border-primary-container bg-surface-container-low p-2.5 text-center text-sm tabular-nums text-on-surface outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm font-bold text-on-surface-variant">
                    % por venta
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setRoles(roles.filter((_, j) => j !== i))}
                aria-label={`Quitar el cargo ${rol.cargo || i + 1}`}
                className="shrink-0 rounded-full p-1.5 text-on-surface-variant hover:bg-surface-variant hover:text-error"
              >
                <Icon name="close" className="text-[16px]" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRoles([...roles, { cargo: "", porcentaje: 0 }])}
            className={botonAnexar}
          >
            <Icon name="add" className="text-[14px]" />
            Anexar cargo
          </button>
        </div>

        {/* ----- MODALIDAD VENTA: directa o escalonada ----- */}
        {modalidad === "venta" && (
          <>
            <h4 className="mt-6 text-sm font-bold text-on-surface">
              Tipo de comisión por venta
            </h4>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(
                [
                  { id: "directa", label: "Directa (% fijo)" },
                  { id: "escalonada", label: "Escalonada (% por niveles)" },
                ] as const
              ).map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setTipoVenta(op.id)}
                  className={
                    tipoVenta === op.id
                      ? "rounded-lg bg-secondary px-4 py-1.5 text-xs font-bold text-on-secondary"
                      : "rounded-lg bg-surface-container-high px-4 py-1.5 text-xs font-light text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                  }
                >
                  {op.label}
                </button>
              ))}
            </div>

            {tipoVenta === "escalonada" && (
              <div className="mt-3 rounded-xl border border-primary-container bg-primary-fixed/20 p-4">
                {/* ¿Por qué escala? monto de cada venta o nº de ventas */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={claseEtiqueta}>Escala por:</span>
                  {(
                    [
                      { id: "monto", label: "Monto de cada venta" },
                      { id: "cantidad", label: "Cantidad de ventas del período" },
                    ] as const
                  ).map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => {
                        setEscala(op.id);
                        setTramos([]);
                      }}
                      className={
                        escala === op.id
                          ? "rounded-lg bg-tertiary px-4 py-1.5 text-xs font-bold text-on-tertiary"
                          : "rounded-lg bg-surface-container-high px-4 py-1.5 text-xs font-light text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                      }
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs font-light text-on-surface-variant">
                  {escala === "monto"
                    ? "El % depende del monto de cada venta: aplica el tramo más alto que la venta alcance. Ejemplo: desde $0 → 5%, desde $500.000 → 10% (una venta de $600.000 comisiona el 10%)."
                    : "El % sube según cuántas ventas acumula el vendedor en el período de cierre. Ejemplo: desde la venta nº 1 → 2%, desde la nº 31 → 4% (la venta 31 en adelante comisiona el 4%). El sistema lo aplica solo y el conteo se reinicia en cada cierre."}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {tramos.map((tramo, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-light text-on-surface-variant">
                        {escala === "monto" ? "Desde una venta de" : "Desde la venta nº"}
                      </span>
                      <input
                        type="number"
                        min={escala === "cantidad" ? 1 : 0}
                        step={escala === "cantidad" ? 1 : "0.01"}
                        value={Number.isFinite(tramo.desde) ? tramo.desde : ""}
                        onChange={(ev) =>
                          setTramos(
                            tramos.map((t, j) =>
                              j === i ? { ...t, desde: Number(ev.target.value) } : t
                            )
                          )
                        }
                        placeholder={escala === "cantidad" ? "1" : "0"}
                        aria-label={
                          escala === "cantidad"
                            ? `Número de venta desde del tramo ${i + 1}`
                            : `Monto desde del tramo ${i + 1}`
                        }
                        className="w-36 rounded-lg border border-primary-container bg-surface-container-low p-2.5 text-right text-sm tabular-nums text-on-surface outline-none focus:ring-2 focus:ring-primary"
                      />
                      {escala === "cantidad" && (
                        <span className="text-sm font-light text-on-surface-variant">
                          del período
                        </span>
                      )}
                      <span className="text-sm font-light text-on-surface-variant">
                        comisiona
                      </span>
                      <input
                        type="number"
                        min={0.1}
                        max={100}
                        step={0.1}
                        value={tramo.porcentaje || ""}
                        onChange={(ev) =>
                          setTramos(
                            tramos.map((t, j) =>
                              j === i ? { ...t, porcentaje: Number(ev.target.value) } : t
                            )
                          )
                        }
                        placeholder="5"
                        aria-label={`Porcentaje del tramo ${i + 1}`}
                        className="w-20 rounded-lg border border-primary-container bg-surface-container-low p-2.5 text-center text-sm tabular-nums text-on-surface outline-none focus:ring-2 focus:ring-primary"
                      />
                      <span className="text-sm font-bold text-on-surface-variant">%</span>
                      <button
                        type="button"
                        onClick={() => setTramos(tramos.filter((_, j) => j !== i))}
                        aria-label={`Quitar el tramo ${i + 1}`}
                        className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-variant hover:text-error"
                      >
                        <Icon name="close" className="text-[16px]" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setTramos([
                        ...tramos,
                        {
                          desde:
                            tramos.length === 0 ? (escala === "cantidad" ? 1 : 0) : Number.NaN,
                          porcentaje: 0,
                        },
                      ])
                    }
                    className={botonAnexar}
                  >
                    <Icon name="add" className="text-[14px]" />
                    Anexar tramo
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ----- MODALIDAD METAS: bonificación por objetivos ----- */}
        {modalidad === "metas" && (
          <>
        <h4 className="mt-6 text-sm font-bold text-on-surface">
          Metas con bonificación
        </h4>
        <p className="mt-1 text-xs font-light text-on-surface-variant">
          El empleado gana la bonificación al alcanzar la meta del período:
          por monto acumulado, por cantidad de ventas cerradas, o por lograr
          UNA sola venta grande (esa se gana cada vez que ocurra). Cada
          empleado persigue las metas con sus propias ventas y puede ganar
          varias bonificaciones.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {metas.map((meta, i) => (
            <div
              key={i}
              className="flex flex-wrap items-end gap-3 rounded-lg border border-outline-variant p-3"
            >
              <div className="min-w-36">
                <span className={claseEtiqueta}>La meta es por</span>
                <select
                  value={meta.tipo}
                  onChange={(ev) =>
                    setMetas(
                      metas.map((m, j) =>
                        j === i ? { ...m, tipo: ev.target.value as MetaComision["tipo"] } : m
                      )
                    )
                  }
                  aria-label={`Tipo de la meta ${i + 1}`}
                  className={claseCampo}
                >
                  <option value="monto">Monto vendido</option>
                  <option value="cantidad">Nº de ventas</option>
                  <option value="venta_unica">Una sola venta de</option>
                </select>
              </div>
              <div className="min-w-32 flex-1">
                <span className={claseEtiqueta}>
                  {meta.tipo === "cantidad"
                    ? "Ventas a alcanzar"
                    : meta.tipo === "venta_unica"
                      ? "Monto de esa venta (o más)"
                      : "Monto a alcanzar"}
                </span>
                <input
                  type="number"
                  min={1}
                  step={meta.tipo === "cantidad" ? 1 : 0.01}
                  value={meta.valor || ""}
                  onChange={(ev) =>
                    setMetas(
                      metas.map((m, j) =>
                        j === i ? { ...m, valor: Number(ev.target.value) } : m
                      )
                    )
                  }
                  placeholder={meta.tipo === "cantidad" ? "20" : "1000000"}
                  aria-label={`Valor de la meta ${i + 1}`}
                  className={cn(claseCampo, "tabular-nums")}
                />
              </div>
              <div className="min-w-32 flex-1">
                <span className={claseEtiqueta}>Bonificación</span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={meta.bonificacion || ""}
                  onChange={(ev) =>
                    setMetas(
                      metas.map((m, j) =>
                        j === i ? { ...m, bonificacion: Number(ev.target.value) } : m
                      )
                    )
                  }
                  placeholder="50000"
                  aria-label={`Bonificación de la meta ${i + 1}`}
                  className={cn(claseCampo, "tabular-nums")}
                />
              </div>
              <div className="min-w-32">
                <span className={claseEtiqueta}>Período</span>
                <select
                  value={meta.periodo}
                  onChange={(ev) =>
                    setMetas(
                      metas.map((m, j) =>
                        j === i
                          ? { ...m, periodo: ev.target.value as FrecuenciaPago }
                          : m
                      )
                    )
                  }
                  aria-label={`Período de la meta ${i + 1}`}
                  className={claseCampo}
                >
                  <option value="semanal">Semanal</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => setMetas(metas.filter((_, j) => j !== i))}
                aria-label={`Quitar la meta ${i + 1}`}
                className="mb-2 shrink-0 rounded-full p-1.5 text-on-surface-variant hover:bg-surface-variant hover:text-error"
              >
                <Icon name="close" className="text-[16px]" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setMetas([
                ...metas,
                { tipo: "monto", valor: 0, bonificacion: 0, periodo: "mensual" },
              ])
            }
            className={botonAnexar}
          >
            <Icon name="add" className="text-[14px]" />
            Anexar meta
          </button>
        </div>
          </>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={guardarComisiones}
            disabled={ocupado}
            className={botonGuardar}
          >
            <Icon name="save" className="text-[16px]" />
            Guardar comisiones
          </button>
        </div>
      </Acordeon>

      {/* ===== Modal agregar / editar empleado ===== */}
      {empleadoModal !== undefined && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={empleadoEnEdicion ? "Editar empleado" : "Agregar empleado"}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-on-surface">
                {empleadoEnEdicion ? `Editar a ${empleadoEnEdicion.nombre}` : "Agregar empleado"}
              </h2>
              <button
                type="button"
                onClick={() => setEmpleadoModal(undefined)}
                aria-label="Cerrar"
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            <form onSubmit={guardarEmpleadoModal} className="mt-5 flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={claseEtiqueta}>Nombre completo *</label>
                  <input
                    name="nombre"
                    required
                    defaultValue={empleadoEnEdicion?.nombre ?? ""}
                    placeholder="Nombre y apellidos"
                    className={claseCampo}
                  />
                </div>
                <div>
                  <label className={claseEtiqueta}>Documento</label>
                  <input
                    name="documento"
                    defaultValue={empleadoEnEdicion?.documento ?? ""}
                    placeholder="CC / DNI / RFC…"
                    className={claseCampo}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={claseEtiqueta}>Teléfono</label>
                  <input
                    name="telefono"
                    type="tel"
                    defaultValue={empleadoEnEdicion?.telefono ?? ""}
                    placeholder="+57 300 000 0000"
                    className={claseCampo}
                  />
                </div>
                <div>
                  <label className={claseEtiqueta}>Correo electrónico</label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={empleadoEnEdicion?.email ?? ""}
                    placeholder="correo@ejemplo.com"
                    className={claseCampo}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={claseEtiqueta}>Dirección</label>
                  <input
                    name="direccion"
                    defaultValue={empleadoEnEdicion?.direccion ?? ""}
                    placeholder="Calle, ciudad"
                    className={claseCampo}
                  />
                </div>
                <div>
                  <label className={claseEtiqueta}>Fecha de nacimiento</label>
                  <input
                    name="fecha_nacimiento"
                    type="date"
                    defaultValue={empleadoEnEdicion?.fecha_nacimiento ?? ""}
                    className={claseCampo}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={claseEtiqueta}>Cargo / rol *</label>
                  <select
                    name="cargo"
                    required
                    defaultValue={
                      empleadoEnEdicion
                        ? ROLES_SUGERIDOS.includes(empleadoEnEdicion.cargo as never)
                          ? empleadoEnEdicion.cargo
                          : "__otro__"
                        : ""
                    }
                    onChange={(ev) => setCargoOtro(ev.target.value === "__otro__")}
                    className={claseCampo}
                  >
                    <option value="">— Elige el cargo —</option>
                    {ROLES_SUGERIDOS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    <option value="__otro__">Otro…</option>
                  </select>
                  {cargoOtro && (
                    <input
                      name="cargo_otro"
                      required
                      defaultValue={
                        empleadoEnEdicion &&
                        !ROLES_SUGERIDOS.includes(empleadoEnEdicion.cargo as never)
                          ? empleadoEnEdicion.cargo
                          : ""
                      }
                      placeholder="Escribe el cargo"
                      className={cn(claseCampo, "mt-2")}
                    />
                  )}
                </div>
                <div>
                  <label className={claseEtiqueta}>Tipo de contrato *</label>
                  <select
                    name="tipo_contrato"
                    required
                    defaultValue={empleadoEnEdicion?.tipo_contrato ?? "indefinido"}
                    className={claseCampo}
                  >
                    {TIPOS_CONTRATO.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={claseEtiqueta}>Fecha de ingreso</label>
                  <input
                    name="fecha_ingreso"
                    type="date"
                    defaultValue={empleadoEnEdicion?.fecha_ingreso ?? ""}
                    className={claseCampo}
                  />
                </div>
                <div>
                  <label className={claseEtiqueta}>Salario mensual *</label>
                  <input
                    name="salario_mensual"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    defaultValue={
                      empleadoEnEdicion ? Number(empleadoEnEdicion.salario_mensual) : ""
                    }
                    placeholder="0.00"
                    className={cn(claseCampo, "tabular-nums")}
                  />
                </div>
              </div>

              {/* Contacto de emergencia */}
              <div className="rounded-lg border border-outline-variant bg-surface-container-low/50 p-4">
                <span className={claseEtiqueta}>Contacto de emergencia</span>
                <div className="mt-1 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={claseEtiqueta}>Nombre</label>
                    <input
                      name="emergencia_nombre"
                      defaultValue={empleadoEnEdicion?.emergencia_nombre ?? ""}
                      placeholder="Nombre del contacto"
                      className={claseCampo}
                    />
                  </div>
                  <div>
                    <label className={claseEtiqueta}>Número</label>
                    <input
                      name="emergencia_telefono"
                      type="tel"
                      defaultValue={empleadoEnEdicion?.emergencia_telefono ?? ""}
                      placeholder="+57 300 000 0000"
                      className={claseCampo}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEmpleadoModal(undefined)}
                  className="rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={ocupado} className={botonGuardar}>
                  {ocupado ? (
                    <>
                      <Icon name="progress_activity" className="animate-spin text-[16px]" />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <Icon name={empleadoEnEdicion ? "save" : "person_add"} className="text-[16px]" />
                      {empleadoEnEdicion ? "Guardar cambios" : "Agregar"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
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
                <Icon name="delete_forever" className="text-[24px] text-on-error-container" />
              </div>
              <h2 className="text-xl font-bold text-on-surface">
                ¿Eliminar a {aEliminar.nombre}?
              </h2>
            </div>
            <p className="mt-4 text-sm font-light leading-relaxed text-on-surface-variant">
              Si solo dejó de trabajar contigo, mejor usa{" "}
              <strong className="font-semibold text-on-surface">Desactivar</strong>:
              conserva su historial de comisiones. Eliminar es definitivo.
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
                {ocupado ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
