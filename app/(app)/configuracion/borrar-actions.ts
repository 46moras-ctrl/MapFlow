"use server";

import { createHash, randomInt } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";
import { contextoEmpresa } from "@/lib/supabase/contexto";

// ============================================================
// BORRAR DATOS DE LA CUENTA — proceso en dos pasos:
//   1. solicitarCodigoBorrado: cuenta lo que se va a borrar y
//      envía un código de 6 dígitos al correo del usuario
//      (vence a los 10 minutos; viaja como huella cifrada en
//      una cookie, nunca en texto plano).
//   2. confirmarBorrado: valida código + palabra BORRAR y
//      elimina TODO lo financiero de la empresa: facturas,
//      pendientes, presupuestos, movimientos e historial del
//      bot. Contactos y configuración se conservan.
// Aislamiento: cada borrado filtra por la empresa de la sesión.
// ============================================================

const COOKIE = "mapflow_codigo_borrado";
const VIGENCIA_MIN = 10;

interface Conteos {
  facturas: number;
  pendientes: number;
  presupuestos: number;
  movimientos: number;
  mensajes: number;
}

function huella(codigo: string, userId: string): string {
  return createHash("sha256").update(`${codigo}:${userId}`).digest("hex");
}

export async function solicitarCodigoBorrado(): Promise<{
  ok: boolean;
  conteos?: Conteos;
  correo?: string;
  error?: string;
}> {
  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const {
    data: { user },
  } = await ctx.supabase.auth.getUser();
  if (!user?.email)
    return { ok: false, error: "Tu cuenta no tiene un correo asociado." };

  // Resumen de lo que está a punto de borrarse
  const contar = async (tabla: string) =>
    (
      await ctx.supabase
        .from(tabla)
        .select("id", { count: "exact", head: true })
        .eq("id_empresa", ctx.empresaId)
    ).count ?? 0;

  const [facturas, pendientes, presupuestos, movimientos, mensajes] =
    await Promise.all([
      contar("facturas"),
      contar("planes_pago"),
      contar("presupuestos"),
      contar("movimientos"),
      contar("mensajes_agente"),
    ]);

  // Código de 6 dígitos → correo; solo su huella queda en la cookie
  const codigo = String(randomInt(100000, 999999));
  const vence = Date.now() + VIGENCIA_MIN * 60 * 1000;
  cookies().set(COOKIE, `${huella(codigo, ctx.userId)}.${vence}`, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: VIGENCIA_MIN * 60,
    path: "/",
  });

  try {
    const transporte = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    await transporte.sendMail({
      from: `MapFlow <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject: `${codigo} es tu código para borrar los datos de MapFlow`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px"><p>Pediste <strong>borrar todos los datos financieros</strong> de tu cuenta de MapFlow.</p><p style="font-size:32px;letter-spacing:6px;font-weight:bold;margin:16px 0">${codigo}</p><p>El código vence en ${VIGENCIA_MIN} minutos. Si no fuiste tú, ignora este correo y cambia tu contraseña.</p></div>`,
    });
  } catch {
    cookies().delete(COOKIE);
    return {
      ok: false,
      error:
        "No se pudo enviar el código al correo. Revisa la conexión e intenta de nuevo.",
    };
  }

  return {
    ok: true,
    conteos: { facturas, pendientes, presupuestos, movimientos, mensajes },
    correo: user.email,
  };
}

export async function confirmarBorrado(
  codigo: string,
  palabra: string
): Promise<{ ok: boolean; error?: string }> {
  if (palabra.trim().toUpperCase() !== "BORRAR")
    return { ok: false, error: "Escribe la palabra BORRAR para confirmar." };
  if (!/^\d{6}$/.test(codigo.trim()))
    return { ok: false, error: "El código son los 6 dígitos que te llegaron al correo." };

  const ctx = await contextoEmpresa();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const guardado = cookies().get(COOKIE)?.value;
  if (!guardado)
    return { ok: false, error: "El código venció. Pide uno nuevo." };
  const [hash, vence] = guardado.split(".");
  if (Number(vence) < Date.now()) {
    cookies().delete(COOKIE);
    return { ok: false, error: "El código venció. Pide uno nuevo." };
  }
  if (hash !== huella(codigo.trim(), ctx.userId))
    return { ok: false, error: "Código incorrecto. Revisa el correo." };

  // Orden de borrado: primero lo que depende de facturas
  const { data: facturas } = await ctx.supabase
    .from("facturas")
    .select("id")
    .eq("id_empresa", ctx.empresaId)
    .limit(10000);
  const idsFacturas = (facturas ?? []).map((f) => f.id as string);

  await ctx.supabase.from("planes_pago").delete().eq("id_empresa", ctx.empresaId);
  await ctx.supabase.from("mensajes_agente").delete().eq("id_empresa", ctx.empresaId);
  // recordatorios no tiene id_empresa: hereda la empresa vía su factura
  for (let i = 0; i < idsFacturas.length; i += 100) {
    await ctx.supabase
      .from("recordatorios")
      .delete()
      .in("id_factura", idsFacturas.slice(i, i + 100));
  }
  const { error: errorFacturas } = await ctx.supabase
    .from("facturas")
    .delete()
    .eq("id_empresa", ctx.empresaId);
  const { error: errorMovs } = await ctx.supabase
    .from("movimientos")
    .delete()
    .eq("id_empresa", ctx.empresaId);
  const { error: errorPres } = await ctx.supabase
    .from("presupuestos")
    .delete()
    .eq("id_empresa", ctx.empresaId);

  if (errorFacturas || errorMovs || errorPres)
    return {
      ok: false,
      error:
        "Algo no se pudo borrar por completo. Intenta de nuevo o revisa con soporte.",
    };

  cookies().delete(COOKIE);
  revalidatePath("/", "layout");
  return { ok: true };
}
