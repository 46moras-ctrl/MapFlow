import type { SupabaseClient } from "@supabase/supabase-js";
import {
  diasDeMora,
  diasHasta,
  fmt,
  formatearFecha,
  hoyISO,
  type FacturaDB,
} from "@/lib/facturas";

// ============================================================
// AGENTE DE COBROS Y PAGOS — versión 2: ciclo completo.
// Decide a quién escribir, cuándo, con qué tono y por qué canal,
// y redacta cada mensaje con su botón. NO envía nada: devuelve
// borradores estructurados para que el dueño los apruebe.
//
// CICLO DE COBROS (facturas 'cobrar' → al CLIENTE, siempre activo):
//   1 día antes de vencer → preventivo, amable
//   2 días de mora        → recordatorio, amable
//   5 días de mora        → recordatorio, firme
//   (todos llevan botón "Pagar" con los datos de cobro del dueño)
//
// ALERTA INTERNA (facturas 'cobrar' → al DUEÑO):
//   6+ días de mora → "haz contacto directo", botón "Llamar"
//
// CICLO DE PAGOS (facturas 'pagar' → al DUEÑO, configurable):
//   vence mañana u hoy → preventivo, amable
//   en mora            → recordatorio, urgente
//   Solo si empresas.recordatorios_pagos_activo = true, y por
//   el canal que el dueño eligió.
// ============================================================

export type TonoCobro = "amable" | "firme" | "urgente";
export type CanalMensaje = "whatsapp" | "email";
export type TipoMensaje =
  | "preventivo"          // al cliente: "vence mañana"
  | "recordatorio_cobro"  // al cliente: ya está en mora
  | "alerta_interna"      // al dueño: 6+ días, llamar al cliente
  | "recordatorio_pago";  // al dueño: pago a proveedor por vencer/vencido

// Botones que la interfaz pintará junto al mensaje. El agente solo
// arma la estructura; el "click" real se conecta en la fase de envío.
export type BotonMensaje =
  | { etiqueta: "Pagar"; accion: "mostrar_datos_cobro"; datos_cobro: Record<string, unknown> }
  | { etiqueta: "Llamar"; accion: "llamar"; telefono: string };

export interface DestinatarioMensaje {
  quien: "cliente" | "dueño";
  nombre: string;               // nombre del cliente/proveedor, o de la empresa si es el dueño
  telefono: string | null;      // para WhatsApp / botón Llamar
  email: string | null;         // para el canal email
}

export interface MensajeAgente {
  id_factura: string;
  destinatario: DestinatarioMensaje;
  tipo_mensaje: TipoMensaje;
  canal: CanalMensaje;
  tono: TonoCobro;
  mensaje: string;
  boton: BotonMensaje | null;
}

// Lo que el agente necesita de la empresa (dueño)
export interface EmpresaAgente {
  nombre: string;
  datos_cobro: Record<string, unknown>;
  recordatorios_pagos_activo: boolean;
  recordatorios_pagos_canal: "whatsapp" | "email" | "ambos";
}

// Contacto vinculado a la factura (tabla contactos, vía facturas.id_contacto)
export interface ContactoAgente {
  nombre: string;
  telefono: string | null;
  email: string | null;
}

// Campos de la factura que el agente necesita (subconjunto de FacturaDB
// + su contacto de la libreta; null si la factura aún no tiene uno)
type FacturaAgente = Pick<
  FacturaDB,
  | "id"
  | "numero_factura"
  | "cliente"
  | "concepto"
  | "monto"
  | "fecha_vencimiento"
  | "estado"
  | "tipo"
> & {
  contacto: ContactoAgente | null;
};

// ------------------------------------------------------------
// Utilidades internas de redacción
// ------------------------------------------------------------

/** "la factura FAC-001 (diseño de logo)" o solo "la factura FAC-001" */
function describirFactura(f: FacturaAgente): string {
  return f.concepto?.trim()
    ? `la factura ${f.numero_factura} (${f.concepto.trim()})`
    : `la factura ${f.numero_factura}`;
}

function pluralDias(n: number): string {
  return n === 1 ? "1 día" : `${n} días`;
}

/** Duplica un mensaje en los canales pedidos (mismo texto, mismo botón) */
function enCanales(
  base: Omit<MensajeAgente, "canal">,
  canales: CanalMensaje[]
): MensajeAgente[] {
  return canales.map((canal) => ({ ...base, canal }));
}

/** Canales según la preferencia del dueño para PAGOS */
function canalesDePagos(canal: EmpresaAgente["recordatorios_pagos_canal"]): CanalMensaje[] {
  return canal === "ambos" ? ["whatsapp", "email"] : [canal];
}

// ------------------------------------------------------------
// EL CEREBRO (función pura, sin tocar la base de datos):
// recibe las facturas y la empresa, devuelve TODOS los mensajes
// del día listos para aprobar. Ordena: alertas internas primero,
// luego cobros, luego pagos.
// ------------------------------------------------------------
export function generarMensajesAgente(
  facturas: FacturaAgente[],
  empresa: EmpresaAgente,
  hoy: string = hoyISO()
): MensajeAgente[] {
  const mensajes: MensajeAgente[] = [];

  // Botón "Pagar" compartido por todos los mensajes de cobro:
  // entrega los datos de cobro configurados por el dueño.
  const botonPagar: BotonMensaje = {
    etiqueta: "Pagar",
    accion: "mostrar_datos_cobro",
    datos_cobro: empresa.datos_cobro ?? {},
  };

  for (const f of facturas) {
    if (f.estado === "pagado" || !f.fecha_vencimiento) continue;

    const tipo = f.tipo ?? "cobrar";
    const mora = diasDeMora(f, hoy);                    // 0 si aún no vence
    const diasParaVencer = diasHasta(f.fecha_vencimiento, hoy); // 1 = vence mañana
    const queCosa = describirFactura(f);
    const monto = fmt(f.monto);
    const vencimiento = formatearFecha(f.fecha_vencimiento);

    // El teléfono y el email salen de la LIBRETA DE CONTACTOS
    // (no de la factura): un solo lugar por cliente, sin repetir.
    const cliente: DestinatarioMensaje = {
      quien: "cliente",
      nombre: f.cliente,
      telefono: f.contacto?.telefono ?? null,
      email: f.contacto?.email ?? null,
    };
    const dueño: DestinatarioMensaje = {
      quien: "dueño",
      nombre: empresa.nombre,
      telefono: null, // el dueño recibe dentro de la app / su propio canal
      email: null,
    };

    if (tipo === "cobrar") {
      // ===== CICLO DE COBROS: siempre activo, ambos canales =====

      if (diasParaVencer === 1) {
        // --- 1 día ANTES de vencer: preventivo amable ---
        mensajes.push(
          ...enCanales(
            {
              id_factura: f.id,
              destinatario: cliente,
              tipo_mensaje: "preventivo",
              tono: "amable",
              mensaje:
                `Hola ${f.cliente} 👋 Te recuerdo que ${queCosa} por ${monto} ` +
                `vence mañana (${vencimiento}). Puedes pagarla con el botón de abajo. ` +
                `¡Gracias por tu puntualidad!`,
              boton: botonPagar,
            },
            ["whatsapp", "email"]
          )
        );
      } else if (mora === 2) {
        // --- 2 días de mora: recordatorio amable ---
        mensajes.push(
          ...enCanales(
            {
              id_factura: f.id,
              destinatario: cliente,
              tipo_mensaje: "recordatorio_cobro",
              tono: "amable",
              mensaje:
                `Hola ${f.cliente} 👋 Espero que estés muy bien. ` +
                `Te escribo porque ${queCosa} por ${monto} venció el ${vencimiento} ` +
                `(hace ${pluralDias(mora)}). Seguro fue un descuido — puedes ponerte ` +
                `al día con el botón de abajo. ¡Saludos!`,
              boton: botonPagar,
            },
            ["whatsapp", "email"]
          )
        );
      } else if (mora === 5) {
        // --- 5 días de mora: recordatorio firme ---
        mensajes.push(
          ...enCanales(
            {
              id_factura: f.id,
              destinatario: cliente,
              tipo_mensaje: "recordatorio_cobro",
              tono: "firme",
              mensaje:
                `Hola ${f.cliente}, ¿cómo estás? ` +
                `${queCosa.charAt(0).toUpperCase() + queCosa.slice(1)} por ${monto} ` +
                `venció el ${vencimiento} y lleva ${pluralDias(mora)} de retraso. ` +
                `¿Me confirmas para cuándo podrías realizar el pago? ` +
                `Abajo tienes el botón con los datos para pagar. Quedo pendiente, gracias.`,
              boton: botonPagar,
            },
            ["whatsapp", "email"]
          )
        );
      } else if (mora >= 6) {
        // --- ALERTA INTERNA: al dueño, con botón "Llamar" ---
        // El teléfono viene del contacto de la factura; si no hay
        // contacto (o no tiene teléfono), la alerta va sin botón
        // (la interfaz puede sugerir completar la libreta).
        const telefono = f.contacto?.telefono ?? null;
        const botonLlamar: BotonMensaje | null = telefono
          ? { etiqueta: "Llamar", accion: "llamar", telefono }
          : null;

        mensajes.push(
          ...enCanales(
            {
              id_factura: f.id,
              destinatario: dueño,
              tipo_mensaje: "alerta_interna",
              tono: "urgente",
              mensaje:
                `⚠️ La factura ${f.numero_factura} del cliente ${f.cliente} ` +
                `por ${monto} lleva ${pluralDias(mora)} de mora sin pago. ` +
                `Los recordatorios automáticos no funcionaron: haz contacto directo.`,
              boton: botonLlamar,
            },
            ["whatsapp", "email"]
          )
        );
      }
    } else {
      // ===== CICLO DE PAGOS: al dueño, solo si lo tiene activado =====
      if (!empresa.recordatorios_pagos_activo) continue;
      const canales = canalesDePagos(empresa.recordatorios_pagos_canal);

      if (diasParaVencer === 1 || diasParaVencer === 0) {
        // --- Por vencer (hoy o mañana): preventivo ---
        const cuando = diasParaVencer === 0 ? "vence HOY" : "vence mañana";
        mensajes.push(
          ...enCanales(
            {
              id_factura: f.id,
              destinatario: dueño,
              tipo_mensaje: "recordatorio_pago",
              tono: "amable",
              mensaje:
                `📅 Recordatorio: tu pago a ${f.cliente} — ${queCosa} por ${monto} — ` +
                `${cuando} (${vencimiento}). Prográmalo para no caer en mora.`,
              boton: null,
            },
            canales
          )
        );
      } else if (mora >= 1) {
        // --- En mora: aviso urgente cada día hasta que se pague ---
        mensajes.push(
          ...enCanales(
            {
              id_factura: f.id,
              destinatario: dueño,
              tipo_mensaje: "recordatorio_pago",
              tono: "urgente",
              mensaje:
                `🔴 Tu pago a ${f.cliente} — ${queCosa} por ${monto} — ` +
                `venció el ${vencimiento} y lleva ${pluralDias(mora)} de atraso. ` +
                `Gestiónalo hoy para evitar recargos o cortes.`,
              boton: null,
            },
            canales
          )
        );
      }
    }
  }

  // Orden de urgencia: alertas internas → cobros → pagos,
  // y dentro de cada grupo, la mora más alta primero.
  const PESO: Record<TipoMensaje, number> = {
    alerta_interna: 0,
    recordatorio_cobro: 1,
    preventivo: 2,
    recordatorio_pago: 3,
  };
  return mensajes.sort((a, b) => PESO[a.tipo_mensaje] - PESO[b.tipo_mensaje]);
}

// ------------------------------------------------------------
// CONSULTA + CEREBRO en un solo paso, para usar desde la app.
// Solo LEE. El filtro por empresa lo garantiza RLS: el cliente
// de Supabase viaja con la sesión del usuario, la base devuelve
// únicamente SU empresa y SUS facturas (no se pasa id_empresa
// a mano, y es imposible ver datos de otro).
// ------------------------------------------------------------
export async function obtenerMensajesAgente(
  supabase: SupabaseClient,
  hoy: string = hoyISO()
): Promise<MensajeAgente[]> {
  // 1. La empresa del usuario (RLS: single = la única que puede ver)
  const { data: empresa, error: errorEmpresa } = await supabase
    .from("empresas")
    .select("nombre, datos_cobro, recordatorios_pagos_activo, recordatorios_pagos_canal")
    .single();

  if (errorEmpresa || !empresa) {
    throw new Error(
      `No se pudo leer la configuración de la empresa: ${errorEmpresa?.message ?? "sin datos"}`
    );
  }

  // 2. Facturas vivas con fecha de vencimiento (cobrar Y pagar),
  //    con su contacto de la libreta embebido en la misma consulta
  //    (via facturas.id_contacto → contactos; null si no tiene).
  //    RLS también protege contactos: solo se embeben los míos.
  const { data: facturas, error: errorFacturas } = await supabase
    .from("facturas")
    .select(
      "id, numero_factura, cliente, concepto, monto, fecha_vencimiento, estado, tipo, " +
        "contacto:contactos ( nombre, telefono, email )"
    )
    .neq("estado", "pagado")
    .not("fecha_vencimiento", "is", null);

  if (errorFacturas) {
    throw new Error(`No se pudieron leer las facturas: ${errorFacturas.message}`);
  }

  // El cast pasa por "unknown" porque el cliente de Supabase no
  // sabe inferir el tipo del contacto embebido en el select.
  return generarMensajesAgente(
    (facturas ?? []) as unknown as FacturaAgente[],
    empresa as EmpresaAgente,
    hoy
  );
}
