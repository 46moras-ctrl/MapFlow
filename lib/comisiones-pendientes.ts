import type { SupabaseClient } from "@supabase/supabase-js";

import type { Alerta } from "@/lib/alertas";
import { diasHasta, formatearFecha, hoyISO } from "@/lib/facturas";
import type { CambioComisionPendiente } from "@/lib/nomina";

// ============================================================
// CAMBIO DE MÉTODO DE COMISIÓN PROGRAMADO — se revisa al cargar
// la app (layout), sin necesidad de tareas programadas:
//   · Llegó el cierre y está CONFIRMADO → se aplica.
//   · Llegó el cierre sin confirmar → se descarta (regla: si el
//     usuario no acepta ni revisa, el cambio no se realiza).
//   · Faltan ≤ 3 días → alerta en la campana y correo (una vez)
//     preguntando si aún desea ejecutar el cambio.
// ============================================================

const ETIQUETA_METODO: Record<string, string> = {
  "venta-directa": "comisión directa (% fijo por venta)",
  "venta-escalonada-monto": "comisión escalonada por monto de venta",
  "venta-escalonada-cantidad": "comisión escalonada por cantidad de ventas",
  "metas-directa": "metas con bonificación",
};

function nombreMetodo(c: CambioComisionPendiente["config"]): string {
  const clave =
    c.modalidad === "metas"
      ? "metas-directa"
      : c.tipo_venta === "escalonada"
        ? `venta-escalonada-${c.escala ?? "monto"}`
        : "venta-directa";
  return ETIQUETA_METODO[clave] ?? "el método nuevo";
}

async function enviarAvisoCorreo(
  email: string,
  pendiente: CambioComisionPendiente
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: email,
        subject: "¿Aún deseas cambiar tu método de comisión? Se aplica en el cierre de nómina",
        html: `<div style="font-family:Arial,sans-serif;max-width:520px"><p>Programaste cambiar el método de comisión de tu empresa a <strong>${nombreMetodo(pendiente.config)}</strong>.</p><p>El cambio se aplicará en el cierre de nómina del <strong>${formatearFecha(pendiente.aplica_el)}</strong>, pero necesita tu confirmación: entra a MapFlow → Ajustes → Nómina → Comisiones y elige <strong>Confirmar</strong> o <strong>Descartar</strong>.</p><p>Si no confirmas antes del cierre, el cambio NO se realizará y todo seguirá con el método actual.</p></div>`,
      }),
    });
    return res.ok;
  } catch {
    return false; // mejor esfuerzo: la alerta en la app siempre queda
  }
}

/**
 * Revisa el cambio programado de la empresa: lo aplica o descarta
 * si llegó el cierre, y devuelve la alerta de la campana cuando
 * faltan ≤ 3 días (enviando el correo la primera vez).
 */
export async function gestionarCambioComisiones(
  supabase: SupabaseClient,
  empresaId: string,
  pendiente: CambioComisionPendiente | null | undefined,
  emailUsuario: string | null,
  hoy: string = hoyISO()
): Promise<Alerta | null> {
  if (!pendiente?.aplica_el) return null;

  // ¿Ya pasó el cierre? Confirmado → aplica; sin confirmar → se descarta
  if (hoy > pendiente.aplica_el) {
    await supabase
      .from("empresas")
      .update(
        pendiente.confirmado
          ? { config_comisiones: pendiente.config, config_comisiones_pendiente: null }
          : { config_comisiones_pendiente: null }
      )
      .eq("id", empresaId);
    return null;
  }

  const dias = diasHasta(pendiente.aplica_el, hoy);
  if (dias > 3) return null;

  // Correo de aviso, una sola vez, al entrar en la ventana de 3 días
  if (!pendiente.aviso_enviado && !pendiente.confirmado && emailUsuario) {
    const enviado = await enviarAvisoCorreo(emailUsuario, pendiente);
    if (enviado) {
      await supabase
        .from("empresas")
        .update({
          config_comisiones_pendiente: { ...pendiente, aviso_enviado: true },
        })
        .eq("id", empresaId);
    }
  }

  if (pendiente.confirmado) {
    return {
      id: `comisiones-cambio-${pendiente.aplica_el}`,
      facturaId: "",
      href: "/configuracion",
      nivel: "info",
      titulo: `Cambio de comisión confirmado: se aplica el ${formatearFecha(pendiente.aplica_el)}`,
      detalle: `Pasarás a ${nombreMetodo(pendiente.config)}. Hasta el cierre se sigue usando el método actual.`,
      icono: "event_available",
    };
  }
  return {
    id: `comisiones-cambio-${pendiente.aplica_el}`,
    facturaId: "",
    href: "/configuracion",
    nivel: dias <= 1 ? "media" : "suave",
    titulo: `¿Aún deseas cambiar el método de comisión? Cierre: ${formatearFecha(pendiente.aplica_el)}`,
    detalle: `Confírmalo en Ajustes → Nómina → Comisiones. Si no lo confirmas antes del cierre, el cambio no se realizará.`,
    icono: "pending_actions",
  };
}
