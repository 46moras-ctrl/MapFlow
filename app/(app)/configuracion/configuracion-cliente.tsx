"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/app/icon";
import { aplicarColoresMarca } from "@/components/app/tema-marca";
import { ImportarFacturas } from "./importar-facturas";
import type { ConexionSheets } from "./importar-actions";
import { confirmarBorrado, solicitarCodigoBorrado } from "./borrar-actions";
import { getSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  cerrarSesionDispositivo,
  guardarMarca,
  guardarMostrarPresupuestos,
  guardarNotificaciones,
  guardarPerfil,
  guardarPersonasBot,
  registrarSesion,
  reportarSesion,
  responderConfirmacion,
  type ColoresMarca,
  type PersonaBot,
  type PreferenciasNotificaciones,
  type SesionDB,
} from "./actions";

// ============================================================
// CONFIGURACIÓN — tres secciones: Perfil, Notificaciones y
// Sesiones. Las personas que reciben los mensajes del bot viven
// en el cuadro "Canales" del Perfil. La foto de perfil alimenta
// el círculo del topbar, y los colores de marca (primario y
// secundario) recolorean la plataforma en vivo.
// ============================================================

export interface EmpresaConfig {
  id?: string;
  nombre?: string;
  foto_url?: string | null;
  personas_bot?: PersonaBot[];
  colores_marca?: Partial<ColoresMarca>;
  notificaciones?: Partial<PreferenciasNotificaciones>;
  mostrar_presupuestos?: boolean;
  hoja_calculo?: ConexionSheets | null;
}

type Seccion = "perfil" | "notificaciones" | "sesiones";

const COLORES_BASE: ColoresMarca = {
  primario: "#4E6544",
  secundario: "#42682F",
};

// ---------- Utilidades del dispositivo actual (Sesiones) ----------

function describirDispositivo(): string {
  const ua = navigator.userAgent;
  const so = /Windows/.test(ua)
    ? "Windows"
    : /Macintosh|Mac OS/.test(ua)
      ? "Mac"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iPhone/iPad"
          : /Linux/.test(ua)
            ? "Linux"
            : "Dispositivo";
  const nav = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navegador";
  return `${so} · ${nav}`;
}

// Identificador estable del dispositivo (hash simple del user agent)
function huellaDispositivo(): string {
  const base = `${navigator.userAgent}|${navigator.language}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) {
    h = (h * 31 + base.charCodeAt(i)) | 0;
  }
  return `d-${Math.abs(h)}`;
}

/** '2026-07-08T14:03:00Z' → '08/07/2026 14:03' (determinista, sin zona) */
function fechaHora(ts: string): string {
  return `${ts.slice(8, 10)}/${ts.slice(5, 7)}/${ts.slice(0, 4)} ${ts.slice(11, 16)}`;
}

// Reduce la imagen elegida a 256px y la devuelve como data-URL
function redimensionarImagen(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const lado = 256;
      const canvas = document.createElement("canvas");
      canvas.width = lado;
      canvas.height = lado;
      const ctx = canvas.getContext("2d");
      if (!ctx) return rechazar(new Error("Canvas no disponible"));
      const min = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - min) / 2,
        (img.height - min) / 2,
        min,
        min,
        0,
        0,
        lado,
        lado
      );
      URL.revokeObjectURL(url);
      resolver(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => rechazar(new Error("No se pudo leer la imagen"));
    img.src = url;
  });
}

// ---------- Piezas de interfaz compartidas ----------

function Toggle({
  activo,
  onCambio,
  label,
}: {
  activo: boolean;
  onCambio: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={activo}
        onChange={(e) => onCambio(e.target.checked)}
        className="peer sr-only"
        aria-label={label}
      />
      <div className="h-6 w-11 rounded-full bg-outline-variant transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-secondary peer-checked:after:translate-x-5" />
    </label>
  );
}

function Tarjeta({
  titulo,
  children,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-on-surface">{titulo}</h3>
          {descripcion && (
            <p className="mt-1 text-sm font-light text-on-surface-variant">
              {descripcion}
            </p>
          )}
        </div>
        {accion}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

// ============================================================

export function ConfiguracionCliente({
  empresa,
  sesiones,
  migracionPendiente,
}: {
  empresa: EmpresaConfig;
  sesiones: SesionDB[];
  migracionPendiente: boolean;
}) {
  const router = useRouter();
  const [seccion, setSeccion] = useState<Seccion>("perfil");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, startTransition] = useTransition();

  // ----- Perfil -----
  const [nombre, setNombre] = useState(empresa.nombre ?? "");
  const [foto, setFoto] = useState<string | null>(empresa.foto_url ?? null);
  const inputFoto = useRef<HTMLInputElement>(null);

  // ----- Módulos -----
  const [mostrarPresupuestos, setMostrarPresupuestos] = useState(
    Boolean(empresa.mostrar_presupuestos)
  );

  // ----- Importar facturas (archivo o Google Sheets) -----
  const [importarAbierto, setImportarAbierto] = useState(false);

  // ----- Borrar datos de la cuenta (código por correo) -----
  const [borrarAbierto, setBorrarAbierto] = useState(false);
  const [borrarPaso, setBorrarPaso] = useState<"resumen" | "codigo" | "listo">("resumen");
  const [borrarConteos, setBorrarConteos] = useState<{
    facturas: number;
    pendientes: number;
    presupuestos: number;
    movimientos: number;
    mensajes: number;
  } | null>(null);
  const [borrarCorreo, setBorrarCorreo] = useState<string | null>(null);
  const [borrarError, setBorrarError] = useState<string | null>(null);

  // ----- Personas con acceso a los mensajes del bot -----
  const [personas, setPersonas] = useState<PersonaBot[]>(empresa.personas_bot ?? []);
  // índice de la persona en edición (null = anexar nueva; undefined = cerrado)
  const [personaModal, setPersonaModal] = useState<number | null | undefined>(undefined);
  const [menuAbierto, setMenuAbierto] = useState<number | null>(null);

  // ----- Identidad de marca (acordeón colapsado por defecto) -----
  const [marcaAbierta, setMarcaAbierta] = useState(false);
  const [colores, setColores] = useState<ColoresMarca>({
    ...COLORES_BASE,
    ...(empresa.colores_marca ?? {}),
  });

  // ----- Notificaciones (sin "generales") -----
  const [prefs, setPrefs] = useState<PreferenciasNotificaciones>({
    alertas_empresa: {
      email: true,
      telegram: true,
      whatsapp: false,
      ...(empresa.notificaciones?.alertas_empresa ?? {}),
    },
    alertas_cobros: {
      email: true,
      whatsapp: false,
      ...(empresa.notificaciones?.alertas_cobros ?? {}),
    },
    generales: empresa.notificaciones?.generales ?? {},
  });

  // ----- Sesiones -----
  const [huellaActual, setHuellaActual] = useState<string | null>(null);
  const [preguntaSesion, setPreguntaSesion] = useState<SesionDB | null>(null);
  const registrada = useRef(false);

  // Al entrar, registra este dispositivo. Si el lugar es nuevo,
  // aparece el aviso "Abriste sesión en [lugar]. ¿Fuiste tú?".
  useEffect(() => {
    if (registrada.current || migracionPendiente) return;
    registrada.current = true;
    const huella = huellaDispositivo();
    setHuellaActual(huella);
    (async () => {
      let lugar: string | null = null;
      try {
        const r = await fetch("https://ipapi.co/json/", {
          signal: AbortSignal.timeout(4000),
        });
        if (r.ok) {
          const d = await r.json();
          if (d?.city) lugar = `${d.city}, ${d.country_name ?? ""}`.replace(/, $/, "");
        }
      } catch {
        /* sin lugar: se registra igual */
      }
      const res = await registrarSesion({
        huella,
        dispositivo: describirDispositivo(),
        lugar,
      });
      if (res.ok && res.lugarNuevo && res.sesion) setPreguntaSesion(res.sesion);
      router.refresh();
    })();
  }, [migracionPendiente, router]);

  function exito(msg: string) {
    setError(null);
    setMensaje(msg);
    setTimeout(() => setMensaje(null), 4000);
  }

  function fallo(msg: string) {
    setMensaje(null);
    setError(msg);
  }

  // ----- Guardados -----

  function guardarSeccionPerfil() {
    startTransition(async () => {
      const res = await guardarPerfil({ nombre, foto_url: foto });
      if (!res.ok) return fallo(res.error ?? "No se pudo guardar.");
      exito("Perfil guardado.");
      router.refresh(); // el círculo del topbar toma la foto nueva
    });
  }

  // El toggle de Presupuestos se guarda al momento y refresca el menú
  function cambiarMostrarPresupuestos(valor: boolean) {
    setMostrarPresupuestos(valor);
    startTransition(async () => {
      const res = await guardarMostrarPresupuestos(valor);
      if (!res.ok) {
        setMostrarPresupuestos(!valor); // revertir si falló
        return fallo(res.error ?? "No se pudo guardar.");
      }
      exito(
        valor
          ? "Módulo de presupuestos activado."
          : "Módulo de presupuestos oculto."
      );
      router.refresh();
    });
  }

  // Las personas se guardan al momento (anexar, editar o eliminar)
  function persistirPersonas(nuevas: PersonaBot[]) {
    setPersonas(nuevas);
    startTransition(async () => {
      const res = await guardarPersonasBot(nuevas);
      if (!res.ok) return fallo(res.error ?? "No se pudo guardar.");
      exito("Lista de personas actualizada.");
    });
  }

  function guardarPersonaModal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const persona: PersonaBot = {
      nombre: String(fd.get("nombre") ?? "").trim(),
      correo: String(fd.get("correo") ?? "").trim(),
      numero: String(fd.get("numero") ?? "").trim(),
    };
    const nuevas =
      personaModal === null
        ? [...personas, persona]
        : personas.map((p, i) => (i === personaModal ? persona : p));
    setPersonaModal(undefined);
    persistirPersonas(nuevas);
  }

  function cambiarColor(campo: keyof ColoresMarca, valor: string) {
    const nuevos = { ...colores, [campo]: valor };
    setColores(nuevos);
    aplicarColoresMarca(nuevos); // vista previa inmediata en toda la app
  }

  function guardarSeccionMarca() {
    startTransition(async () => {
      const res = await guardarMarca(colores);
      if (!res.ok) return fallo(res.error ?? "No se pudo guardar.");
      aplicarColoresMarca(colores);
      exito("Los colores de tu plataforma cambiaron.");
      router.refresh();
    });
  }

  function guardarSeccionNotificaciones() {
    startTransition(async () => {
      const res = await guardarNotificaciones(prefs);
      if (!res.ok) return fallo(res.error ?? "No se pudo guardar.");
      exito("Preferencias de notificaciones guardadas.");
    });
  }

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    try {
      setFoto(await redimensionarImagen(archivo));
    } catch {
      fallo("No se pudo leer esa imagen. Prueba con otra.");
    }
  }

  // ----- Sesiones: acciones -----

  function responderPregunta(fuiYo: boolean) {
    if (!preguntaSesion) return;
    startTransition(async () => {
      await responderConfirmacion(preguntaSesion.id, fuiYo);
      setPreguntaSesion(null);
      if (!fuiYo) {
        exito("Sesión reportada. Te recomendamos cambiar tu contraseña cuanto antes.");
      }
      router.refresh();
    });
  }

  function cerrarDispositivo(s: SesionDB) {
    startTransition(async () => {
      if (s.huella === huellaActual) {
        await cerrarSesionDispositivo(s.id);
        await getSupabaseClient().auth.signOut();
        router.push("/login");
        return;
      }
      const res = await cerrarSesionDispositivo(s.id);
      if (!res.ok) return fallo(res.error ?? "No se pudo cerrar la sesión.");
      await getSupabaseClient().auth.signOut({ scope: "others" });
      exito("Sesión cerrada en los demás dispositivos.");
      router.refresh();
    });
  }

  function reportar(s: SesionDB) {
    startTransition(async () => {
      const res = await reportarSesion(s.id);
      if (!res.ok) return fallo(res.error ?? "No se pudo reportar.");
      exito("Sesión reportada. Te recomendamos cambiar tu contraseña.");
      router.refresh();
    });
  }

  function abrirBorrado() {
    setBorrarError(null);
    setBorrarConteos(null);
    setBorrarPaso("resumen");
    setBorrarAbierto(true);
    startTransition(async () => {
      const res = await solicitarCodigoBorrado();
      if (!res.ok || !res.conteos) {
        setBorrarError(res.error ?? "No se pudo preparar el borrado.");
        return;
      }
      setBorrarConteos(res.conteos);
      setBorrarCorreo(res.correo ?? null);
      setBorrarPaso("codigo");
    });
  }

  function ejecutarBorrado(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBorrarError(null);
    startTransition(async () => {
      const res = await confirmarBorrado(
        String(fd.get("codigo") ?? ""),
        String(fd.get("palabra") ?? "")
      );
      if (!res.ok) {
        setBorrarError(res.error ?? "No se pudo borrar.");
        return;
      }
      setBorrarPaso("listo");
      router.refresh();
    });
  }

  const claseCampo =
    "mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:border-transparent focus:ring-2 focus:ring-primary";
  const claseEtiqueta =
    "text-xs font-bold uppercase tracking-wider text-on-surface-variant";
  const botonGuardar =
    "flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-60";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-on-surface">
          Ajustes
        </h1>
        <p className="mt-1 text-lg font-light text-on-surface-variant">
          Ajusta MapFlow a la medida de tu negocio.
        </p>
      </div>

      {migracionPendiente && (
        <div className="flex items-start gap-2 rounded-lg bg-tertiary-container/50 px-4 py-3 text-sm font-light text-on-tertiary-container">
          <Icon name="info" className="mt-0.5 shrink-0 text-[18px]" />
          Para guardar estos ajustes falta ejecutar la migración{" "}
          <strong className="font-semibold">
            supabase/migracion_reestructura_ui.sql
          </strong>{" "}
          en el SQL Editor de Supabase.
        </div>
      )}

      {/* Aviso de seguridad: sesión en lugar nuevo */}
      {preguntaSesion && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-tertiary-container bg-tertiary-container/40 px-5 py-4">
          <Icon name="gpp_maybe" className="text-[24px] text-on-tertiary-container" />
          <div className="flex-1 text-sm text-on-tertiary-container">
            <strong className="font-semibold">
              Abriste sesión en {preguntaSesion.lugar ?? "un lugar nuevo"}.
            </strong>{" "}
            ¿Fuiste tú?
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => responderPregunta(true)}
              disabled={ocupado}
              className="rounded-xl bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-on-primary hover:opacity-90 disabled:opacity-60"
            >
              Sí, fui yo
            </button>
            <button
              type="button"
              onClick={() => responderPregunta(false)}
              disabled={ocupado}
              className="rounded-xl bg-error px-5 py-2 text-xs font-bold uppercase tracking-wider text-on-error hover:opacity-90 disabled:opacity-60"
            >
              No fui yo
            </button>
          </div>
        </div>
      )}

      {mensaje && (
        <div className="flex items-center gap-2 rounded-lg bg-secondary-container/60 px-4 py-3 text-sm font-light text-on-secondary-container">
          <Icon name="check_circle" className="text-[18px]" />
          {mensaje}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
          <Icon name="error" className="text-[18px]" />
          {error}
        </div>
      )}

      {/* Pestañas de sección */}
      <div className="flex gap-6 border-b border-outline-variant">
        {(
          [
            { id: "perfil", label: "Perfil", icono: "storefront" },
            { id: "notificaciones", label: "Notificaciones", icono: "notifications" },
            { id: "sesiones", label: "Sesiones", icono: "devices" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSeccion(t.id)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm transition-colors",
              seccion === t.id
                ? "border-primary font-bold text-primary"
                : "border-transparent font-light text-on-surface-variant hover:text-on-surface"
            )}
          >
            <Icon name={t.icono} className="text-[18px]" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ================= SECCIÓN A: PERFIL ================= */}
      {seccion === "perfil" && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Datos de la empresa + módulos */}
            <div className="flex flex-col gap-6 lg:col-span-5"><Tarjeta titulo="Datos de la empresa">
                <div className="flex items-center gap-4">
                  {/* Foto de perfil → alimenta el círculo del topbar */}
                  <button
                    type="button"
                    onClick={() => inputFoto.current?.click()}
                    aria-label="Cambiar foto de perfil"
                    className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low"
                  >
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={foto}
                        alt="Foto de perfil de la empresa"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon
                        name="storefront"
                        className="text-[36px] text-on-surface-variant"
                      />
                    )}
                    <span className="absolute inset-0 hidden items-center justify-center bg-ink/40 text-[11px] font-bold uppercase text-white group-hover:flex">
                      Cambiar
                    </span>
                  </button>
                  <input
                    ref={inputFoto}
                    type="file"
                    accept="image/*"
                    onChange={elegirFoto}
                    className="hidden"
                  />
                  <div className="flex-1">
                    <label className={claseEtiqueta}>Nombre de la empresa</label>
                    <input
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej: Green Coffee"
                      className={claseCampo}
                    />
                    <p className="mt-2 text-[11px] font-light text-on-surface-variant">
                      La foto también aparece arriba a la derecha de la app.
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={guardarSeccionPerfil}
                    disabled={ocupado}
                    className={botonGuardar}
                  >
                    {ocupado ? (
                      <>
                        <Icon name="progress_activity" className="animate-spin text-[16px]" />
                        Guardando…
                      </>
                    ) : (
                      <>
                        <Icon name="save" className="text-[16px]" />
                        Guardar perfil
                      </>
                    )}
                  </button>
                </div>
              </Tarjeta>

              {/* Importar facturas (archivo o Google Sheets) */}
              <Tarjeta
                titulo="Importar factura"
                descripcion="Trae tus facturas desde Excel/CSV o conecta un Google Sheets en vivo."
                accion={
                  <button
                    type="button"
                    onClick={() => setImportarAbierto(true)}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90"
                  >
                    <Icon name="upload_file" className="text-[16px]" />
                    Importar factura
                  </button>
                }
              >
                <p className="text-xs font-light text-on-surface-variant">
                  {empresa.hoja_calculo?.url
                    ? "Tienes una hoja de Google Sheets conectada: se sincroniza sola al usar la app."
                    : "Con anti-duplicación: si importas dos veces, no se repite nada."}
                </p>
              </Tarjeta>

              {/* Módulos: mostrar u ocultar Presupuestos */}
              <Tarjeta
                titulo="Módulos"
                descripcion="Activa o desactiva partes de la plataforma."
              >
                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-sm font-semibold text-on-surface">
                      Presupuestos
                    </div>
                    <div className="text-xs font-light text-on-surface-variant">
                      Muestra el módulo en el menú y en Reportes. Al ocultarlo
                      no se borra ningún dato.
                    </div>
                  </div>
                  <Toggle
                    activo={mostrarPresupuestos}
                    onCambio={cambiarMostrarPresupuestos}
                    label="Mostrar módulo de presupuestos"
                  />
                </div>
              </Tarjeta>
            </div>

            {/* Cuadro CANALES: personas con acceso a los mensajes del bot */}
            <div className="lg:col-span-7">
              <Tarjeta
                titulo="Canales"
                descripcion="Personas con acceso a los mensajes del bot."
                accion={
                  <button
                    type="button"
                    onClick={() => setPersonaModal(null)}
                    className="flex items-center gap-2 rounded-xl border border-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/5"
                  >
                    <Icon name="add" className="text-[16px]" />
                    Anexar
                  </button>
                }
              >
                {personas.length === 0 ? (
                  <p className="py-6 text-center text-sm font-light text-on-surface-variant">
                    Aún no agregas personas. Usa «Anexar» para dar acceso.
                  </p>
                ) : (
                  <div>
                    {/* Tabla sin bordes: nombre · correo · número + menú ⋮ */}
                    <div className="grid grid-cols-[1fr_1fr_1fr_40px] gap-2 px-2 pb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      <span>Nombre</span>
                      <span>Correo</span>
                      <span>Número</span>
                      <span />
                    </div>
                    {personas.map((p, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_1fr_1fr_40px] items-center gap-2 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-surface-container"
                      >
                        <span className="truncate font-semibold text-on-surface">
                          {p.nombre}
                        </span>
                        <span className="truncate font-light text-on-surface-variant">
                          {p.correo || "—"}
                        </span>
                        <span className="truncate font-light text-on-surface-variant">
                          {p.numero || "—"}
                        </span>
                        <div className="relative justify-self-end">
                          <button
                            type="button"
                            onClick={() => setMenuAbierto(menuAbierto === i ? null : i)}
                            aria-label={`Opciones de ${p.nombre}`}
                            className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-variant"
                          >
                            <Icon name="more_vert" className="text-[20px]" />
                          </button>
                          {menuAbierto === i && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setMenuAbierto(null)}
                              />
                              <div className="absolute right-0 top-9 z-50 w-40 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuAbierto(null);
                                    setPersonaModal(i);
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-light text-on-surface hover:bg-surface-container"
                                >
                                  <Icon name="edit" className="text-[18px]" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuAbierto(null);
                                    persistirPersonas(personas.filter((_, j) => j !== i));
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
              </Tarjeta>
            </div>
          </div>

          {/* Acordeón: Identidad de marca (2 colores, en vivo) */}
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-1">
            <button
              type="button"
              onClick={() => setMarcaAbierta((v) => !v)}
              aria-expanded={marcaAbierta}
              className="flex w-full items-center justify-between px-6 py-4 text-left"
            >
              <span className="flex items-center gap-2 text-xl font-bold text-on-surface">
                <Icon name="palette" className="text-[22px] text-primary" />
                Identidad de marca
              </span>
              <Icon
                name={marcaAbierta ? "expand_less" : "expand_more"}
                className="text-[24px] text-on-surface-variant"
              />
            </button>
            {marcaAbierta && (
              <div className="border-t border-outline-variant px-6 py-5">
                <p className="text-sm font-light text-on-surface-variant">
                  Cambia los colores de tu plataforma: se aplican al instante
                  en botones, enlaces y acentos. Edita el código hex o toca el
                  color.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      { id: "primario", label: "Primario" },
                      { id: "secundario", label: "Secundario" },
                    ] as const
                  ).map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-outline-variant p-4"
                    >
                      <div className={claseEtiqueta}>{c.label}</div>
                      <div className="mt-2 flex items-center gap-3">
                        <input
                          type="color"
                          value={colores[c.id]}
                          onChange={(e) => cambiarColor(c.id, e.target.value)}
                          aria-label={`Elegir color ${c.label}`}
                          className="h-10 w-10 cursor-pointer rounded-lg border border-outline-variant bg-transparent"
                        />
                        <input
                          value={colores[c.id]}
                          onChange={(e) => cambiarColor(c.id, e.target.value)}
                          aria-label={`Código hex del color ${c.label}`}
                          className="w-full rounded-lg border border-primary-container bg-surface-container-low p-2.5 font-mono text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={guardarSeccionMarca}
                    disabled={ocupado}
                    className={botonGuardar}
                  >
                    <Icon name="save" className="text-[16px]" />
                    Guardar colores
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============= SECCIÓN B: NOTIFICACIONES ============= */}
      {seccion === "notificaciones" && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Tarjeta
              titulo="Alertas para la empresa"
              descripcion="Avisos internos: morosos, vencimientos y resúmenes para ti y tu equipo."
            >
              <ul className="divide-y divide-outline-variant">
                {(
                  [
                    { id: "email", label: "Email", detalle: "Al correo del dueño" },
                    { id: "telegram", label: "Telegram", detalle: "Al chat del bot de MapFlow" },
                    { id: "whatsapp", label: "WhatsApp", detalle: "Próximamente" },
                  ] as const
                ).map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-semibold text-on-surface">
                        {c.label}
                      </div>
                      <div className="text-xs font-light text-on-surface-variant">
                        {c.detalle}
                      </div>
                    </div>
                    <Toggle
                      activo={Boolean(prefs.alertas_empresa[c.id])}
                      onCambio={(v) =>
                        setPrefs((prev) => ({
                          ...prev,
                          alertas_empresa: { ...prev.alertas_empresa, [c.id]: v },
                        }))
                      }
                      label={`Alertas para la empresa por ${c.label}`}
                    />
                  </li>
                ))}
              </ul>
            </Tarjeta>

            <Tarjeta
              titulo="Alertas de cobros"
              descripcion="Los mensajes que el bot envía a tus deudores (recordatorios de pago)."
            >
              <ul className="divide-y divide-outline-variant">
                {(
                  [
                    { id: "email", label: "Email", detalle: "Recordatorio con botón de pago" },
                    { id: "whatsapp", label: "WhatsApp", detalle: "Próximamente" },
                  ] as const
                ).map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-semibold text-on-surface">
                        {c.label}
                      </div>
                      <div className="text-xs font-light text-on-surface-variant">
                        {c.detalle}
                      </div>
                    </div>
                    <Toggle
                      activo={Boolean(prefs.alertas_cobros[c.id])}
                      onCambio={(v) =>
                        setPrefs((prev) => ({
                          ...prev,
                          alertas_cobros: { ...prev.alertas_cobros, [c.id]: v },
                        }))
                      }
                      label={`Alertas de cobros por ${c.label}`}
                    />
                  </li>
                ))}
              </ul>
            </Tarjeta>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={guardarSeccionNotificaciones}
              disabled={ocupado}
              className={botonGuardar}
            >
              {ocupado ? (
                <>
                  <Icon name="progress_activity" className="animate-spin text-[16px]" />
                  Guardando…
                </>
              ) : (
                <>
                  <Icon name="save" className="text-[16px]" />
                  Guardar notificaciones
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================ SECCIÓN C: SESIONES ================ */}
      {seccion === "sesiones" && (
        <Tarjeta
          titulo="Dispositivos con tu cuenta abierta"
          descripcion="Si no reconoces un dispositivo o un lugar, ciérralo y repórtalo."
        >
          {sesiones.length === 0 ? (
            <p className="py-6 text-center text-sm font-light text-on-surface-variant">
              {migracionPendiente
                ? "Las sesiones se registrarán cuando apliques la migración."
                : "Registrando este dispositivo…"}
            </p>
          ) : (
            <ul className="divide-y divide-outline-variant">
              {sesiones.map((s) => {
                const esEste = s.huella === huellaActual;
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 py-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-container/50">
                      <Icon
                        name={/Android|iPhone/.test(s.dispositivo) ? "smartphone" : "computer"}
                        className="text-[22px] text-on-primary-container"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                        {s.dispositivo}
                        {esEste && (
                          <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
                            Este dispositivo
                          </span>
                        )}
                        {s.estado === "reportada" && (
                          <span className="rounded-full bg-error px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-error">
                            Reportada
                          </span>
                        )}
                        {s.estado === "cerrada" && (
                          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                            Cerrada
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-light text-on-surface-variant">
                        {s.lugar ?? "Ubicación desconocida"} · Última actividad:{" "}
                        {fechaHora(s.ultima_actividad)}
                      </div>
                    </div>
                    {s.estado === "activa" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => cerrarDispositivo(s)}
                          disabled={ocupado}
                          className="rounded-xl border border-outline-variant px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant disabled:opacity-50"
                        >
                          Cerrar sesión
                        </button>
                        <button
                          type="button"
                          onClick={() => reportar(s)}
                          disabled={ocupado}
                          className="rounded-xl border border-error px-4 py-2 text-xs font-bold uppercase tracking-wider text-error transition-colors hover:bg-error/5 disabled:opacity-50"
                        >
                          Reportar
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 flex items-start gap-2 text-xs font-light text-on-surface-variant">
            <Icon name="info" className="mt-0.5 shrink-0 text-[16px]" />
            Al cerrar la sesión de otro dispositivo, por seguridad se cierran
            TODAS las sesiones menos esta. Cuando entres desde un lugar nuevo,
            MapFlow te preguntará si fuiste tú.
          </p>
        </Tarjeta>
      )}

      {/* ===== ZONA DE PELIGRO: borrar datos de la cuenta ===== */}
      <div className="mt-4 rounded-xl border border-error/40 bg-error-container/20 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-error">
              <Icon name="delete_forever" className="text-[22px]" />
              Borrar datos de la cuenta
            </h3>
            <p className="mt-1 max-w-xl text-sm font-light text-on-surface-variant">
              Elimina todas las facturas (cobros y pagos), pendientes,
              presupuestos, ingresos/egresos y el historial del bot de TU
              empresa, dejando la cuenta limpia. Requiere un código que se
              envía a tu correo. Esta acción no se puede deshacer.
            </p>
          </div>
          <button
            type="button"
            onClick={abrirBorrado}
            className="rounded-xl bg-error px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-error transition-opacity hover:opacity-90"
          >
            Borrar datos de la cuenta
          </button>
        </div>
      </div>

      {/* ===== Modal de confirmación del borrado ===== */}
      {borrarAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar borrado de datos"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-bold text-error">
                <Icon name="warning" filled className="text-[22px]" />
                Borrar datos de la cuenta
              </h2>
              <button
                type="button"
                onClick={() => setBorrarAbierto(false)}
                aria-label="Cerrar"
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            {borrarPaso === "resumen" && !borrarError && (
              <div className="mt-6 flex items-center justify-center gap-2 py-6 text-sm font-light text-on-surface-variant">
                <Icon name="progress_activity" className="animate-spin text-[18px]" />
                Preparando el resumen y enviando el código a tu correo…
              </div>
            )}

            {borrarPaso === "codigo" && borrarConteos && (
              <form onSubmit={ejecutarBorrado} className="mt-4 flex flex-col gap-4">
                <div className="rounded-lg border border-error/30 bg-error-container/30 px-4 py-3 text-sm font-light leading-relaxed text-on-surface">
                  <strong className="font-semibold">Se eliminará para siempre:</strong>
                  <ul className="mt-1">
                    <li>· {borrarConteos.facturas} facturas (cobros y pagos)</li>
                    <li>· {borrarConteos.pendientes} pendientes</li>
                    <li>· {borrarConteos.presupuestos} presupuestos</li>
                    <li>· {borrarConteos.movimientos} ingresos/egresos</li>
                    <li>· {borrarConteos.mensajes} mensajes del bot</li>
                  </ul>
                  Los contactos y la configuración se conservan.
                </div>
                <p className="text-sm font-light text-on-surface-variant">
                  Te enviamos un código de 6 dígitos a{" "}
                  <strong className="font-semibold">{borrarCorreo}</strong>
                  {" "}(vence en 10 minutos).
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={claseEtiqueta}>Código del correo *</label>
                    <input
                      name="codigo"
                      required
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      className={cn(claseCampo, "text-center text-lg tracking-[6px]")}
                    />
                  </div>
                  <div>
                    <label className={claseEtiqueta}>Escribe BORRAR *</label>
                    <input
                      name="palabra"
                      required
                      placeholder="BORRAR"
                      className={cn(claseCampo, "text-center uppercase")}
                    />
                  </div>
                </div>
                {borrarError && (
                  <div className="flex items-start gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
                    <Icon name="error" className="mt-0.5 shrink-0 text-[18px]" />
                    {borrarError}
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setBorrarAbierto(false)}
                    className="rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={ocupado}
                    className="flex items-center gap-2 rounded-xl bg-error px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-error transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {ocupado ? (
                      <>
                        <Icon name="progress_activity" className="animate-spin text-[16px]" />
                        Borrando…
                      </>
                    ) : (
                      "Eliminar todo definitivamente"
                    )}
                  </button>
                </div>
              </form>
            )}

            {borrarPaso === "resumen" && borrarError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
                <Icon name="error" className="mt-0.5 shrink-0 text-[18px]" />
                {borrarError}
              </div>
            )}

            {borrarPaso === "listo" && (
              <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
                <Icon name="check_circle" filled className="text-[40px] text-secondary" />
                <p className="text-sm font-light text-on-surface">
                  Listo: tu cuenta quedó limpia. Puedes empezar a registrar o
                  importar tu información desde cero.
                </p>
                <button
                  type="button"
                  onClick={() => setBorrarAbierto(false)}
                  className="rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary hover:opacity-90"
                >
                  Entendido
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Modal Importar facturas ===== */}
      {importarAbierto && (
        <ImportarFacturas
          hoja={empresa.hoja_calculo ?? null}
          onCerrar={() => setImportarAbierto(false)}
        />
      )}

      {/* ===== Modal Anexar / editar persona ===== */}
      {personaModal !== undefined && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Anexar persona"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-on-surface">
                {personaModal === null ? "Anexar persona" : "Editar persona"}
              </h2>
              <button
                type="button"
                onClick={() => setPersonaModal(undefined)}
                aria-label="Cerrar"
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            <form onSubmit={guardarPersonaModal} className="mt-5 flex flex-col gap-4">
              <div>
                <label className={claseEtiqueta}>Nombre *</label>
                <input
                  name="nombre"
                  required
                  defaultValue={
                    personaModal !== null ? personas[personaModal]?.nombre : ""
                  }
                  placeholder="Nombre completo"
                  className={claseCampo}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={claseEtiqueta}>Correo</label>
                  <input
                    name="correo"
                    type="email"
                    defaultValue={
                      personaModal !== null ? personas[personaModal]?.correo : ""
                    }
                    placeholder="correo@ejemplo.com"
                    className={claseCampo}
                  />
                </div>
                <div>
                  <label className={claseEtiqueta}>Número</label>
                  <input
                    name="numero"
                    type="tel"
                    defaultValue={
                      personaModal !== null ? personas[personaModal]?.numero : ""
                    }
                    placeholder="+57 300 000 0000"
                    className={claseCampo}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPersonaModal(undefined)}
                  className="rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant"
                >
                  Cancelar
                </button>
                <button type="submit" className={botonGuardar}>
                  <Icon name={personaModal === null ? "add" : "save"} className="text-[16px]" />
                  {personaModal === null ? "Anexar" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
