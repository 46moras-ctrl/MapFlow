// ============================================================
// ASISTENTE MAPFLOW — capa de servicio del chat.
//
// La interfaz (components/app/asistente-burbuja.tsx) SOLO habla
// con preguntarAsistente(). El cerebro real es el agente de
// cobros (Gemini + herramientas) publicado en n8n; se llega a él
// vía /api/asistente, que agrega el id_empresa de la sesión en
// el servidor. Si n8n no responde, esta función lanza error y la
// interfaz muestra su burbuja de fallo.
// ============================================================

export interface RespuestaAsistente {
  mensaje: string;
  // Enlace directo a la sección de la plataforma (opcional)
  enlace?: { href: string; etiqueta: string };
}

/** Punto único de entrada del chat. */
export async function preguntarAsistente(
  pregunta: string
): Promise<RespuestaAsistente> {
  const res = await fetch("/api/asistente", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mensaje: pregunta }),
  });

  const data = (await res.json().catch(() => null)) as {
    respuesta?: string;
    error?: string;
  } | null;

  if (!res.ok || !data?.respuesta) {
    throw new Error(data?.error ?? "El asistente no está disponible.");
  }

  return { mensaje: data.respuesta };
}
