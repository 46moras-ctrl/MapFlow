"use server";

import { revalidatePath } from "next/cache";
import { contextoEmpresa } from "@/lib/supabase/contexto";

interface Resultado {
  ok: boolean;
  error?: string;
}

const FALTA_MIGRACION =
  "Falta aplicar la migración supabase/migracion_reestructura_ui.sql en Supabase.";

function errorAmigable(codigo: string | undefined, mensaje: string): string {
  // 42703 columna inexistente / 42P01 tabla inexistente → falta migración
  if (codigo === "42703" || codigo === "42P01") return FALTA_MIGRACION;
  return mensaje;
}

// ===== PERFIL =====

export async function guardarPerfil(datos: {
  nombre: string;
  foto_url: string | null;
}): Promise<Resultado> {
  if (!datos.nombre.trim())
    return { ok: false, error: "El nombre de la empresa es obligatorio." };
  // La foto viaja como data-URL ya redimensionada por el cliente;
  // este tope evita que alguien guarde un archivo gigante.
  if (datos.foto_url && datos.foto_url.length > 200_000)
    return { ok: false, error: "La imagen es demasiado grande. Usa una más pequeña." };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("empresas")
    .update({ nombre: datos.nombre.trim(), foto_url: datos.foto_url })
    .eq("id", ctx.empresaId);

  if (error)
    return { ok: false, error: errorAmigable(error.code, "No se pudo guardar el perfil.") };
  revalidatePath("/configuracion");
  return { ok: true };
}

// ===== CANALES: PERSONAS CON ACCESO A LOS MENSAJES DEL BOT =====

export interface PersonaBot {
  nombre: string;
  correo: string;
  numero: string;
}

export async function guardarPersonasBot(
  personas: PersonaBot[]
): Promise<Resultado> {
  if (personas.some((p) => !p.nombre.trim()))
    return { ok: false, error: "Cada persona necesita al menos un nombre." };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("empresas")
    .update({ personas_bot: personas.slice(0, 50) })
    .eq("id", ctx.empresaId);

  if (error)
    return { ok: false, error: errorAmigable(error.code, "No se pudo guardar la lista de personas.") };
  revalidatePath("/configuracion");
  return { ok: true };
}

// ===== IDENTIDAD DE MARCA (primario + secundario) =====

export interface ColoresMarca {
  primario: string;
  secundario: string;
}

export async function guardarMarca(colores: ColoresMarca): Promise<Resultado> {
  const esHex = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);
  if (!esHex(colores.primario) || !esHex(colores.secundario))
    return { ok: false, error: "Los colores deben ser códigos hex válidos, ej: #4E6544." };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("empresas")
    .update({ colores_marca: colores })
    .eq("id", ctx.empresaId);

  if (error)
    return { ok: false, error: errorAmigable(error.code, "No se pudieron guardar los colores.") };
  revalidatePath("/configuracion");
  return { ok: true };
}

// ===== MÓDULOS: mostrar/ocultar Presupuestos =====

export async function guardarMostrarPresupuestos(
  mostrar: boolean
): Promise<Resultado> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("empresas")
    .update({ mostrar_presupuestos: mostrar })
    .eq("id", ctx.empresaId);

  if (error) {
    if (error.code === "42703")
      return {
        ok: false,
        error:
          "Falta aplicar la migración supabase/migracion_toggle_presupuestos.sql en Supabase.",
      };
    return { ok: false, error: "No se pudo guardar la preferencia de presupuestos." };
  }
  // El menú, Reportes y /presupuestos leen este valor
  revalidatePath("/", "layout");
  return { ok: true };
}

// ===== NOTIFICACIONES =====

export interface PreferenciasNotificaciones {
  alertas_empresa: Record<string, boolean>; // avisos internos, por canal
  alertas_cobros: Record<string, boolean>; // mensajes del bot a deudores, por canal
  generales: Record<string, boolean>;
}

export async function guardarNotificaciones(
  prefs: PreferenciasNotificaciones
): Promise<Resultado> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("empresas")
    .update({ notificaciones: prefs })
    .eq("id", ctx.empresaId);

  if (error)
    return { ok: false, error: errorAmigable(error.code, "No se pudieron guardar las notificaciones.") };
  revalidatePath("/configuracion");
  return { ok: true };
}

// ===== SESIONES / DISPOSITIVOS =====

export interface SesionDB {
  id: string;
  huella: string;
  dispositivo: string;
  lugar: string | null;
  ultima_actividad: string;
  estado: "activa" | "cerrada" | "reportada";
  confirmada: boolean;
  created_at: string;
}

/**
 * Registra (o refresca) la sesión del dispositivo actual y avisa
 * si el LUGAR es nuevo para este usuario — eso dispara el
 * "Abriste sesión en [lugar]. ¿Fuiste tú?" en la interfaz.
 */
export async function registrarSesion(datos: {
  huella: string;
  dispositivo: string;
  lugar: string | null;
}): Promise<{ ok: boolean; sesion?: SesionDB; lugarNuevo?: boolean; error?: string }> {
  if (!datos.huella || !datos.dispositivo)
    return { ok: false, error: "Datos del dispositivo incompletos." };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  // ¿El usuario ya había entrado desde este lugar? (cualquier dispositivo)
  const { data: previas, error: errorLectura } = await ctx.supabase
    .from("sesiones_dispositivos")
    .select("id, huella, lugar, confirmada")
    .eq("id_usuario", ctx.userId);

  if (errorLectura)
    return { ok: false, error: errorAmigable(errorLectura.code, "No se pudo registrar la sesión.") };

  const lugarConocido =
    !datos.lugar ||
    (previas ?? []).some(
      (s) => s.lugar && s.lugar.toLowerCase() === datos.lugar!.toLowerCase()
    );
  const yaExistia = (previas ?? []).some((s) => s.huella === datos.huella);

  const { data, error } = await ctx.supabase
    .from("sesiones_dispositivos")
    .upsert(
      {
        id_usuario: ctx.userId,
        huella: datos.huella,
        dispositivo: datos.dispositivo,
        lugar: datos.lugar,
        ultima_actividad: new Date().toISOString(),
        estado: "activa",
        // Un lugar ya conocido no necesita el "¿fuiste tú?"
        ...(lugarConocido && !yaExistia ? { confirmada: true } : {}),
      },
      { onConflict: "id_usuario,huella" }
    )
    .select("*")
    .single();

  if (error)
    return { ok: false, error: errorAmigable(error.code, "No se pudo registrar la sesión.") };

  revalidatePath("/configuracion");
  return {
    ok: true,
    sesion: data as SesionDB,
    lugarNuevo: !lugarConocido && !(data as SesionDB).confirmada,
  };
}

/** Respuesta al "¿Fuiste tú?": Sí → confirmada · No → reportada */
export async function responderConfirmacion(
  id: string,
  fuiYo: boolean
): Promise<Resultado> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("sesiones_dispositivos")
    .update(fuiYo ? { confirmada: true } : { confirmada: true, estado: "reportada" })
    .eq("id", id)
    .eq("id_usuario", ctx.userId);

  if (error) return { ok: false, error: "No se pudo guardar la respuesta." };
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function cerrarSesionDispositivo(id: string): Promise<Resultado> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("sesiones_dispositivos")
    .update({ estado: "cerrada" })
    .eq("id", id)
    .eq("id_usuario", ctx.userId);

  if (error) return { ok: false, error: "No se pudo cerrar esa sesión." };
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function reportarSesion(id: string): Promise<Resultado> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("sesiones_dispositivos")
    .update({ estado: "reportada" })
    .eq("id", id)
    .eq("id_usuario", ctx.userId);

  if (error) return { ok: false, error: "No se pudo reportar la sesión." };
  revalidatePath("/configuracion");
  return { ok: true };
}
