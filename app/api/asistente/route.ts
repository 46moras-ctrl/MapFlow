import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

// ============================================================
// API DEL ASISTENTE — puente entre el chat de la web y n8n.
//
// El navegador NO habla con n8n directamente: este handler
// resuelve el id_empresa desde la sesión autenticada (cookies)
// y lo envía él mismo al webhook. Así un usuario no puede
// falsificar el id_empresa y leer datos de otra empresa
// (regla de oro: aislamiento por empresa).
// ============================================================

const WEBHOOK_N8N =
  process.env.N8N_AGENTE_WEBHOOK ?? "http://localhost:5678/webhook/mapflow-chat";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    mensaje?: string;
  } | null;
  const mensaje = body?.mensaje?.trim();
  if (!mensaje) {
    return NextResponse.json({ error: "Falta el mensaje." }, { status: 400 });
  }

  // 1. Usuario autenticado → su empresa (nunca la manda el navegador)
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id")
    .eq("id_usuario", user.id)
    .maybeSingle();
  if (!empresa) {
    return NextResponse.json(
      { error: "Tu usuario no tiene una empresa vinculada." },
      { status: 403 }
    );
  }

  // 2. Preguntar al agente (Gemini vía n8n). El agente puede tardar
  //    en razonar con sus herramientas; 60s de margen antes de abortar.
  try {
    const res = await fetch(WEBHOOK_N8N, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_empresa: empresa.id, mensaje }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `El agente respondió con estado ${res.status}.` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { respuesta?: string };
    if (!data?.respuesta) {
      return NextResponse.json(
        { error: "El agente no devolvió respuesta." },
        { status: 502 }
      );
    }
    return NextResponse.json({ respuesta: data.respuesta });
  } catch {
    // n8n apagado, flujo inactivo o timeout
    return NextResponse.json(
      { error: "No se pudo contactar al agente." },
      { status: 502 }
    );
  }
}
