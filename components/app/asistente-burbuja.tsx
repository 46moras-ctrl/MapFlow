"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/app/icon";
import { preguntarAsistente, type RespuestaAsistente } from "@/lib/asistente";
import { cn } from "@/lib/utils";

// ============================================================
// ASISTENTE MAPFLOW — burbuja flotante + ventana de chat.
// Visible en toda la app autenticada (se monta en el layout).
// El cerebro vive en lib/asistente.ts; este componente solo
// pinta la conversación al estilo Serene Navigator.
// ============================================================

interface Burbuja {
  de: "usuaria" | "asistente";
  texto: string;
  enlace?: RespuestaAsistente["enlace"];
}

const SALUDO: Burbuja = {
  de: "asistente",
  texto:
    "¡Hola! 👋 Soy el asistente de MapFlow. Puedo ayudarte a encontrar " +
    "facturas o clientes, y a explicarte cómo usar la plataforma. " +
    "¿Qué necesitas?",
};

export function AsistenteBurbuja() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Burbuja[]>([SALUDO]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  // Autoscroll al último mensaje
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, pensando, abierto]);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pregunta = texto.trim();
    if (!pregunta || pensando) return;

    setMensajes((prev) => [...prev, { de: "usuaria", texto: pregunta }]);
    setTexto("");
    setPensando(true);
    try {
      const respuesta = await preguntarAsistente(pregunta);
      setMensajes((prev) => [
        ...prev,
        { de: "asistente", texto: respuesta.mensaje, enlace: respuesta.enlace },
      ]);
    } catch {
      setMensajes((prev) => [
        ...prev,
        {
          de: "asistente",
          texto: "Uy, algo falló de mi lado. Intenta de nuevo en un momento.",
        },
      ]);
    } finally {
      setPensando(false);
    }
  }

  return (
    <>
      {/* Ventana de chat */}
      {abierto && (
        <div
          role="dialog"
          aria-label="Asistente de MapFlow"
          className="fade-in-up fixed bottom-40 right-4 z-40 flex h-[70vh] max-h-[480px] w-[calc(100vw-2rem)] max-w-[360px] flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-level-2 md:bottom-24 md:right-6"
        >
          {/* Encabezado */}
          <div className="flex items-center gap-3 bg-primary px-4 py-3 text-on-primary">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-on-primary/15">
              <Icon name="smart_toy" filled className="text-[22px]" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold">Asistente MapFlow</div>
              <div className="text-[11px] font-light opacity-80">
                Te ayudo a encontrar y a usar la plataforma
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar chat"
              className="rounded-full p-1.5 transition-colors hover:bg-on-primary/15"
            >
              <Icon name="close" className="text-[20px]" />
            </button>
          </div>

          {/* Conversación */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-surface px-4 py-4">
            {mensajes.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm font-light leading-relaxed",
                  m.de === "usuaria"
                    ? "self-end rounded-br-md bg-primary text-on-primary"
                    : "self-start rounded-bl-md bg-surface-container-high text-on-surface"
                )}
              >
                {m.texto}
                {m.enlace && (
                  <Link
                    href={m.enlace.href}
                    onClick={() => setAbierto(false)}
                    className="mt-2 flex w-fit items-center gap-1.5 rounded-lg bg-primary-container/60 px-3 py-1.5 text-xs font-bold text-on-primary-container transition-opacity hover:opacity-80"
                  >
                    <Icon name="arrow_forward" className="text-[14px]" />
                    {m.enlace.etiqueta}
                  </Link>
                )}
              </div>
            ))}
            {pensando && (
              <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md bg-surface-container-high px-4 py-2.5 text-sm font-light text-on-surface-variant">
                <Icon
                  name="progress_activity"
                  className="animate-spin text-[16px]"
                />
                Pensando…
              </div>
            )}
            <div ref={finRef} />
          </div>

          {/* Entrada */}
          <form
            onSubmit={enviar}
            className="flex items-center gap-2 border-t border-outline-variant bg-surface-container-lowest px-3 py-3"
          >
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe tu pregunta…"
              aria-label="Escribe tu pregunta al asistente"
              className="flex-1 rounded-full bg-surface-container-low px-4 py-2.5 text-sm font-light text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={pensando || !texto.trim()}
              aria-label="Enviar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Icon name="send" className="text-[18px]" />
            </button>
          </form>
        </div>
      )}

      {/* Burbuja flotante (esquina inferior derecha) */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Cerrar asistente" : "Abrir asistente"}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-level-2 transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
      >
        <Icon name={abierto ? "close" : "smart_toy"} filled className="text-[26px]" />
      </button>
    </>
  );
}
