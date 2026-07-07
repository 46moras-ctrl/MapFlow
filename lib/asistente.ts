// ============================================================
// ASISTENTE MAPFLOW — capa de servicio del chat.
//
// La interfaz (components/app/asistente-burbuja.tsx) SOLO habla
// con preguntarAsistente(). Hoy responde un simulador local por
// palabras clave; cuando el cerebro real (Gemini vía n8n) esté
// listo, se conecta aquí y la interfaz no cambia ni una línea.
// ============================================================

export interface RespuestaAsistente {
  mensaje: string;
  // Enlace directo a la sección de la plataforma (opcional)
  enlace?: { href: string; etiqueta: string };
}

/**
 * Punto único de entrada del chat.
 *
 * TODO (n8n + Gemini): cuando el flujo de n8n esté publicado,
 * definir NEXT_PUBLIC_N8N_AGENTE_WEBHOOK en .env.local con la URL
 * del webhook. El POST de abajo ya envía { pregunta } y espera
 * como respuesta un JSON { mensaje, enlace? } con la misma forma
 * de RespuestaAsistente. Mientras la variable no exista (o el
 * webhook falle), se usa el simulador local y el chat funciona.
 */
export async function preguntarAsistente(
  pregunta: string
): Promise<RespuestaAsistente> {
  const webhook = process.env.NEXT_PUBLIC_N8N_AGENTE_WEBHOOK;

  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta }),
      });
      if (res.ok) {
        const data = (await res.json()) as RespuestaAsistente;
        if (data?.mensaje) return data;
      }
      // Respuesta inválida del webhook → caemos al simulador
    } catch {
      // n8n caído o sin red → caemos al simulador
    }
  }

  return respuestaSimulada(pregunta);
}

// ------------------------------------------------------------
// SIMULADOR TEMPORAL por palabras clave. Existe solo para poder
// probar la interfaz YA; el cerebro real lo reemplaza vía webhook.
// Quita acentos y pasa a minúsculas para que "facturas por
// cobrar" y "Facturas por Cobrar" coincidan igual.
// ------------------------------------------------------------
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function respuestaSimulada(pregunta: string): RespuestaAsistente {
  const q = normalizar(pregunta);

  // --- ENCONTRAR: facturas por cobrar ---
  if (q.includes("por cobrar") || (q.includes("cobrar") && q.includes("factura"))) {
    return {
      mensaje:
        "Tus cuentas por cobrar están en la sección Facturas, pestaña " +
        "«Cuentas por cobrar». Ahí ves cuánto te deben, qué está vencido " +
        "y puedes filtrar o buscar por cliente.",
      enlace: { href: "/facturas?tab=cobrar", etiqueta: "Ir a Cuentas por cobrar" },
    };
  }

  // --- ENCONTRAR: facturas por pagar ---
  if (q.includes("por pagar") || q.includes("pagar") || q.includes("proveedor")) {
    return {
      mensaje:
        "Tus cuentas por pagar (proveedores, renta, servicios, créditos) " +
        "están en la sección Facturas, pestaña «Cuentas por pagar».",
      enlace: { href: "/facturas?tab=pagar", etiqueta: "Ir a Cuentas por pagar" },
    };
  }

  // --- ENCONTRAR: un cliente / contacto ---
  if (q.includes("cliente") || q.includes("contacto") || q.includes("buscar")) {
    return {
      mensaje:
        "Para encontrar un cliente o proveedor, abre la libreta de " +
        "Contactos dentro de Facturas (botón «Contactos») y usa la lupa: " +
        "al buscar un nombre verás sus datos y todo su historial de facturas.",
      enlace: { href: "/facturas?tab=cobrar", etiqueta: "Abrir Facturas" },
    };
  }

  // --- EXPLICAR: cómo registrar una factura ---
  if (q.includes("registr") || q.includes("crear") || q.includes("nueva factura")) {
    return {
      mensaje:
        "Para registrar una factura: entra a Facturas, elige la pestaña " +
        "(por cobrar o por pagar) y pulsa el botón verde «Nueva factura». " +
        "Completa cliente, número, monto y vencimiento — MapFlow vigilará " +
        "la fecha por ti y evita duplicados automáticamente.",
      enlace: { href: "/facturas", etiqueta: "Ir a Facturas" },
    };
  }

  // --- EXPLICAR: otras secciones ---
  if (q.includes("presupuesto")) {
    return {
      mensaje: "Los topes de gasto por categoría viven en Presupuestos.",
      enlace: { href: "/presupuestos", etiqueta: "Ir a Presupuestos" },
    };
  }
  if (q.includes("reporte")) {
    return {
      mensaje: "En Reportes tienes el panorama de tu negocio en números.",
      enlace: { href: "/reportes", etiqueta: "Ir a Reportes" },
    };
  }
  if (q.includes("egreso") || q.includes("gasto")) {
    return {
      mensaje: "Tus gastos registrados están en la sección Egresos.",
      enlace: { href: "/egresos", etiqueta: "Ir a Egresos" },
    };
  }

  // --- Fallback: orientación general ---
  return {
    mensaje:
      "Puedo ayudarte a encontrar cosas y a usar MapFlow. Prueba con: " +
      "«facturas por cobrar», «facturas por pagar», «buscar un cliente» " +
      "o «¿cómo registro una factura?».",
  };
}
