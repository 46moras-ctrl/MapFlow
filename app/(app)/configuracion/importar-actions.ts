"use server";

import { revalidatePath } from "next/cache";
import {
  aplicarMapeo,
  claveDuplicado,
  normalizarFila,
  parsearCSV,
  type CampoExtra,
  type FilaCruda,
  type Mapeo,
} from "@/lib/importacion";
import { contextoEmpresa } from "@/lib/supabase/contexto";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// IMPORTAR FACTURAS — acciones de servidor:
//   · Archivo Excel/CSV: vista previa (duplicados) + importación.
//   · Google Sheets: conexión, sincronización manual y automática.
// Todo con el id_empresa de la sesión (RLS + filtro explícito) y
// la regla anti-duplicación contacto+monto+fecha.
// ============================================================

const FALTA_MIGRACION =
  "Falta aplicar la migración supabase/migracion_importacion.sql en Supabase.";

interface ResultadoImportacion {
  ok: boolean;
  importadas?: number;
  omitidas?: number; // duplicados o filas inválidas
  error?: string;
}

/** Claves (contacto|monto|fecha) que YA existen en la empresa */
async function clavesExistentes(
  supabase: SupabaseClient,
  empresaId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("facturas")
    .select("cliente, monto, fecha_emision")
    .eq("id_empresa", empresaId)
    .limit(5000);
  return new Set(
    (data ?? []).map((f) =>
      claveDuplicado(f as { cliente: string; monto: number; fecha_emision: string })
    )
  );
}

/** Traduce el error técnico de la base a un mensaje entendible */
function motivoLegible(codigo: string | undefined, mensaje: string): string {
  if (codigo === "23505") return "número de factura repetido";
  if (codigo === "22008" || codigo === "22007") return "fecha inválida";
  if (codigo === "23514") return "un dato no cumple las reglas de la base";
  return mensaje;
}

/**
 * Núcleo compartido por archivo y Sheets: normaliza, filtra
 * duplicados e inserta con TOLERANCIA — las filas buenas entran
 * siempre; una fila mala solo se omite a sí misma, jamás tumba
 * el resto del archivo.
 */
async function importarFilasCrudas(
  supabase: SupabaseClient,
  empresaId: string,
  crudas: FilaCruda[]
): Promise<{ importadas: number; omitidas: number; error?: string }> {
  const hoy = new Date().toISOString().slice(0, 10);
  const existentes = await clavesExistentes(supabase, empresaId);
  const vistas = new Set<string>(); // duplicados dentro del propio archivo

  const base = Date.now();
  const listas = [];
  let omitidas = 0;
  for (const cruda of crudas) {
    const fila = normalizarFila(cruda, hoy);
    if (!fila) {
      omitidas++;
      continue;
    }
    const clave = claveDuplicado(fila);
    if (existentes.has(clave) || vistas.has(clave)) {
      omitidas++;
      continue;
    }
    vistas.add(clave);
    listas.push({
      id_empresa: empresaId,
      ...fila,
      // Se respeta el número del archivo; sin número, se genera uno
      numero_factura: fila.numero_factura || `IMP-${base}-${listas.length + 1}`,
    });
  }

  if (listas.length === 0) return { importadas: 0, omitidas };

  // Inserción por bloques; si un bloque falla, se reintenta fila
  // por fila para rescatar las buenas y omitir solo las malas.
  let importadas = 0;
  let primerMotivo: string | null = null;
  const seleccion = "id, tipo, estado, fecha_vencimiento, cliente";
  interface FacturaInsertada {
    id: string;
    tipo: string;
    estado: string;
    fecha_vencimiento: string | null;
    cliente: string;
  }
  const insertadas: FacturaInsertada[] = [];
  for (let i = 0; i < listas.length; i += 50) {
    const bloque = listas.slice(i, i + 50);
    const { data, error } = await supabase
      .from("facturas")
      .insert(bloque)
      .select(seleccion);
    if (!error) {
      importadas += bloque.length;
      insertadas.push(...((data ?? []) as FacturaInsertada[]));
      continue;
    }
    for (const fila of bloque) {
      const { data: dataFila, error: errorFila } = await supabase
        .from("facturas")
        .insert(fila)
        .select(seleccion)
        .single();
      if (errorFila) {
        omitidas++;
        primerMotivo ??= motivoLegible(errorFila.code, errorFila.message);
      } else {
        importadas++;
        if (dataFila) insertadas.push(dataFila as FacturaInsertada);
      }
    }
  }

  // Lo que llegó VENCIDO o PENDIENTE entra solo a la lista de
  // Pendientes (se le crea su plan), para que el usuario no tenga
  // que hacer el doble trabajo del triángulo factura por factura.
  const sinPagar = insertadas.filter((f) => f.estado !== "pagado");
  if (sinPagar.length > 0) {
    const hoyISO = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < sinPagar.length; i += 50) {
      await supabase.from("planes_pago").insert(
        sinPagar.slice(i, i + 50).map((f) => ({
          id_empresa: empresaId,
          id_factura: f.id,
          tipo: f.tipo === "pagar" ? "pago" : "cobro",
          cuotas: 1,
          fechas_pago: [f.fecha_vencimiento ?? hoyISO],
          contacto_nombre: f.cliente,
          destino_envio: "contacto",
          estado: "activo",
        }))
      );
    }
  }

  if (importadas === 0)
    return {
      importadas: 0,
      omitidas,
      error: `No se pudo guardar ninguna factura${primerMotivo ? ` (motivo: ${primerMotivo})` : ""}.`,
    };

  revalidatePath("/facturas");
  revalidatePath("/pendientes");
  revalidatePath("/dashboard");
  revalidatePath("/ventas");
  return { importadas, omitidas };
}

// ===== 6A · ARCHIVO EXCEL/CSV =====

/** Vista previa: cuántas filas se importarían y cuántas son duplicados */
export async function previsualizarImportacion(
  crudas: FilaCruda[]
): Promise<{ ok: boolean; validas?: number; duplicadas?: number; invalidas?: number; error?: string }> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (crudas.length === 0) return { ok: false, error: "El archivo no tiene filas." };
  if (crudas.length > 2000)
    return { ok: false, error: "Máximo 2000 filas por importación." };

  const hoy = new Date().toISOString().slice(0, 10);
  const existentes = await clavesExistentes(ctx.supabase, ctx.empresaId);
  const vistas = new Set<string>();

  let validas = 0;
  let duplicadas = 0;
  let invalidas = 0;
  for (const cruda of crudas) {
    const fila = normalizarFila(cruda, hoy);
    if (!fila) {
      invalidas++;
      continue;
    }
    const clave = claveDuplicado(fila);
    if (existentes.has(clave) || vistas.has(clave)) duplicadas++;
    else {
      vistas.add(clave);
      validas++;
    }
  }
  return { ok: true, validas, duplicadas, invalidas };
}

export async function importarFacturas(
  crudas: FilaCruda[]
): Promise<ResultadoImportacion> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (crudas.length > 2000)
    return { ok: false, error: "Máximo 2000 filas por importación." };

  const res = await importarFilasCrudas(ctx.supabase, ctx.empresaId, crudas);
  if (res.error) return { ok: false, error: res.error };
  return { ok: true, importadas: res.importadas, omitidas: res.omitidas };
}

// ===== 6B · GOOGLE SHEETS (en vivo) =====

export interface ConexionSheets {
  url: string;
  mapeo: Mapeo;
  extras?: CampoExtra[];
  ultima_sync: string | null;
}

/** URL de exportación CSV de una hoja compartida "cualquiera con el enlace" */
function urlCSV(url: string): string | null {
  const m = /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(url);
  if (!m) return null;
  return `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv`;
}

async function leerHoja(url: string): Promise<string[][] | null> {
  const csv = urlCSV(url);
  if (!csv) return null;
  try {
    const r = await fetch(csv, {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!r.ok) return null;
    return parsearCSV(await r.text());
  } catch {
    return null;
  }
}

/** Lee los encabezados de la hoja para la pantalla de mapeo */
export async function leerEncabezadosSheets(
  url: string
): Promise<{ ok: boolean; encabezados?: string[]; error?: string }> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const matriz = await leerHoja(url);
  if (!matriz || matriz.length === 0)
    return {
      ok: false,
      error:
        "No se pudo leer la hoja. Verifica el enlace y que esté compartida como «cualquiera con el enlace puede ver».",
    };
  return { ok: true, encabezados: matriz[0].map((e) => e.trim()) };
}

export async function guardarConexionSheets(datos: {
  url: string;
  mapeo: Mapeo;
  extras?: CampoExtra[];
}): Promise<ResultadoImportacion> {
  if (!urlCSV(datos.url))
    return { ok: false, error: "Ese enlace no parece de Google Sheets." };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("empresas")
    .update({
      hoja_calculo: {
        url: datos.url,
        mapeo: datos.mapeo,
        extras: datos.extras ?? [],
        ultima_sync: null,
      },
    })
    .eq("id", ctx.empresaId);
  if (error) {
    if (error.code === "42703") return { ok: false, error: FALTA_MIGRACION };
    return { ok: false, error: "No se pudo guardar la conexión." };
  }
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function desconectarSheets(): Promise<ResultadoImportacion> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  await ctx.supabase
    .from("empresas")
    .update({ hoja_calculo: null })
    .eq("id", ctx.empresaId);
  revalidatePath("/configuracion");
  return { ok: true };
}

/** Sincronización manual: trae lo nuevo de la hoja conectada */
export async function sincronizarSheets(): Promise<ResultadoImportacion> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: empresa } = await ctx.supabase
    .from("empresas")
    .select("hoja_calculo")
    .eq("id", ctx.empresaId)
    .maybeSingle();
  const conexion = empresa?.hoja_calculo as ConexionSheets | null;
  if (!conexion?.url)
    return { ok: false, error: "No hay una hoja de Google Sheets conectada." };

  const matriz = await leerHoja(conexion.url);
  if (!matriz || matriz.length < 2)
    return {
      ok: false,
      error: "No se pudo leer la hoja o no tiene filas de datos.",
    };

  const encabezados = matriz[0].map((e) => e.trim());
  const crudas = aplicarMapeo(
    encabezados,
    matriz.slice(1),
    conexion.mapeo,
    conexion.extras ?? []
  );
  const res = await importarFilasCrudas(ctx.supabase, ctx.empresaId, crudas);
  if (res.error) return { ok: false, error: res.error };

  await ctx.supabase
    .from("empresas")
    .update({
      hoja_calculo: { ...conexion, ultima_sync: new Date().toISOString() },
    })
    .eq("id", ctx.empresaId);
  revalidatePath("/configuracion");
  return { ok: true, importadas: res.importadas, omitidas: res.omitidas };
}

/**
 * Sincronización AUTOMÁTICA (máx. una vez por hora): la llama la
 * página de Facturas al cargar. Nunca lanza error: si la hoja no
 * responde, la app sigue normal.
 */
export async function sincronizarSheetsSiToca(): Promise<void> {
  try {
    const ctx = await contextoEmpresa();
    if ("error" in ctx) return;
    const { data: empresa } = await ctx.supabase
      .from("empresas")
      .select("hoja_calculo")
      .eq("id", ctx.empresaId)
      .maybeSingle();
    const conexion = empresa?.hoja_calculo as ConexionSheets | null;
    if (!conexion?.url) return;
    const haceUnaHora = Date.now() - 60 * 60 * 1000;
    if (conexion.ultima_sync && Date.parse(conexion.ultima_sync) > haceUnaHora)
      return;
    await sincronizarSheets();
  } catch {
    /* mejor esfuerzo */
  }
}
