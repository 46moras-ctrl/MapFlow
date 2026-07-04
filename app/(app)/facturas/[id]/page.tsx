import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/app/icon";
import { StatusBadge } from "@/components/app/status-badge";
import {
  ETIQUETA_MEDIO,
  ICONO_MEDIO,
  diasDeMora,
  estadoVisual,
  fmt,
  formatearFecha,
  type FacturaDB,
} from "@/lib/facturas";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function DetalleFacturaPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nombre")
    .eq("id_usuario", user?.id ?? "")
    .maybeSingle();
  if (!empresa) notFound();

  const { data: factura, error } = await supabase
    .from("facturas")
    .select("*")
    .eq("id", params.id)
    .eq("id_empresa", empresa.id)
    .maybeSingle<FacturaDB>();
  if (error || !factura) notFound();

  const esPagar = factura.tipo === "pagar";
  const visual = estadoVisual(factura);
  const mora = diasDeMora(factura);

  // Enlace de deuda: de dónde viene y qué cuotas generó
  const { data: origen } = factura.id_factura_origen
    ? await supabase
        .from("facturas")
        .select("id, numero_factura, cliente, concepto, monto")
        .eq("id", factura.id_factura_origen)
        .eq("id_empresa", empresa.id)
        .maybeSingle()
    : { data: null };

  const { data: cuotasHijas } = await supabase
    .from("facturas")
    .select("id, numero_factura, monto, fecha_vencimiento, estado")
    .eq("id_factura_origen", factura.id)
    .eq("id_empresa", empresa.id)
    .order("fecha_vencimiento", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/facturas${esPagar ? "?tab=pagar" : ""}`}
        className="flex w-fit items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:text-primary"
      >
        <Icon name="arrow_back" className="text-[18px]" />
        Volver a listado
      </Link>

      {/* Origen de la deuda (pagos con crédito) */}
      {origen && (
        <Link
          href={`/facturas/${origen.id}`}
          className="flex items-center gap-3 rounded-xl border border-tertiary-container bg-tertiary-container/25 px-5 py-4 transition-colors hover:bg-tertiary-container/40"
        >
          <Icon name="link" className="text-[22px] text-on-tertiary-container" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-on-tertiary-container">
              Esta deuda viene de un pago con crédito
            </div>
            <div className="truncate text-sm font-light text-on-tertiary-container">
              Origen: {origen.numero_factura} · {origen.cliente} ·{" "}
              {fmt(Number(origen.monto))} — toca para ver la factura original
            </div>
          </div>
          <Icon
            name="arrow_forward"
            className="text-[20px] text-on-tertiary-container"
          />
        </Link>
      )}

      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-on-surface">
              {factura.numero_factura}
            </h1>
            <StatusBadge estado={visual} />
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                esPagar
                  ? "bg-secondary-container text-on-secondary-container"
                  : "bg-primary-container/50 text-on-primary-container"
              }`}
            >
              {esPagar ? "Por pagar" : "Por cobrar"}
            </span>
          </div>
          <p className="mt-1 text-lg font-light text-on-surface-variant">
            {factura.cliente}
          </p>
        </div>
        <div className="flex gap-3">
          <span className="rounded-xl bg-surface-container-high px-4 py-2 text-xs font-light text-on-surface-variant">
            Gestiona el estado desde el listado de facturas
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Glass Card de información (8 col) */}
        <div className="rounded-xl border border-primary-container bg-white/70 p-6 backdrop-blur-md lg:col-span-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {visual === "pagada"
                  ? esPagar
                    ? "Monto pagado"
                    : "Monto cobrado"
                  : esPagar
                    ? "Monto por pagar"
                    : "Monto adeudado"}
              </div>
              <div className="mt-1 text-4xl font-bold tabular-nums text-on-surface">
                {fmt(Number(factura.monto))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Días de mora
              </div>
              <div
                className={`mt-1 text-4xl font-bold tabular-nums ${
                  mora > 0 ? "text-error" : "text-secondary"
                }`}
              >
                {mora}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Fecha de emisión
              </div>
              <div className="mt-1 text-base text-on-surface">
                {formatearFecha(factura.fecha_emision)}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Fecha de vencimiento
              </div>
              <div className="mt-1 text-base text-on-surface">
                {formatearFecha(factura.fecha_vencimiento)}
              </div>
            </div>

            {/* Medios de pago */}
            {(factura.medio_pago || factura.medio_pago_previsto) && (
              <div className="sm:col-span-2 grid gap-6 sm:grid-cols-2">
                {esPagar && factura.medio_pago_previsto && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Medio de pago previsto
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-base text-on-surface">
                      <Icon
                        name={ICONO_MEDIO[factura.medio_pago_previsto]}
                        className="text-[20px] text-on-surface-variant"
                      />
                      {ETIQUETA_MEDIO[factura.medio_pago_previsto]}
                    </div>
                  </div>
                )}
                {factura.medio_pago && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      {esPagar ? "Se pagó con" : "Te pagaron con"}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-base text-on-surface">
                      <Icon
                        name={ICONO_MEDIO[factura.medio_pago]}
                        className="text-[20px] text-secondary"
                      />
                      {ETIQUETA_MEDIO[factura.medio_pago]}
                    </div>
                  </div>
                )}
              </div>
            )}

            {factura.es_recurrente && factura.dia_recurrencia && (
              <div className="sm:col-span-2">
                <div className="flex items-center gap-2 rounded-lg bg-secondary-container/40 px-4 py-3 text-sm font-light text-on-secondary-container">
                  <Icon name="event_repeat" className="text-[20px]" />
                  Pago recurrente: el día {factura.dia_recurrencia} de cada
                  mes. Al pagarla, MapFlow genera la del mes siguiente.
                </div>
              </div>
            )}

            <div className="sm:col-span-2">
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Concepto
              </div>
              <div className="mt-1 text-base font-light leading-relaxed text-on-surface">
                {factura.concepto ?? "Sin concepto registrado."}
              </div>
            </div>
            <div className="border-t border-outline-variant pt-4 sm:col-span-2">
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Registrada en MapFlow
              </div>
              <div className="mt-1 text-base font-light text-on-surface">
                {formatearFecha(factura.created_at.slice(0, 10))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Assistant Panel (4 col) */}
        <div className="relative overflow-hidden rounded-xl border border-primary-container bg-primary-container/20 p-6 lg:col-span-4">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary-container/50 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-primary-container">
              <Icon name="smart_toy" filled className="text-[20px]" />
              Asistente MapFlow
            </div>

            <div className="mt-4 rounded-lg border border-primary-container/50 bg-surface p-4 text-sm font-light leading-relaxed text-on-surface">
              {visual === "pagada" ? (
                esPagar ? (
                  <>Este pago ya está saldado. ¡Nada pendiente por aquí!</>
                ) : (
                  <>Esta factura ya está cobrada. ¡Nada pendiente por aquí!</>
                )
              ) : esPagar ? (
                mora > 0 ? (
                  <>
                    Este pago lleva{" "}
                    <strong className="font-semibold">
                      {mora} días vencido
                    </strong>
                    . Pagarlo pronto evita recargos y protege tu relación con{" "}
                    {factura.cliente}.
                  </>
                ) : (
                  <>
                    Pago aún a tiempo. Tenlo presente en tu flujo de caja de
                    esta semana.
                  </>
                )
              ) : mora > 0 ? (
                <>
                  Esta factura lleva{" "}
                  <strong className="font-semibold">{mora} días de mora</strong>
                  . Sugiero enviar un recordatorio por WhatsApp con tono amable
                  proponiendo una fecha de pago.
                </>
              ) : (
                <>
                  Esta factura aún está a tiempo. Un recordatorio amable unos
                  días antes del vencimiento aumenta la probabilidad de cobro
                  puntual.
                </>
              )}
            </div>

            {!esPagar && visual !== "pagada" && (
              <>
                <div className="mt-3">
                  <label
                    htmlFor="borrador"
                    className="text-xs font-bold uppercase tracking-wider text-on-primary-container"
                  >
                    Borrador editable
                  </label>
                  <textarea
                    id="borrador"
                    rows={5}
                    className="mt-1 w-full rounded-lg border border-outline-variant bg-surface/50 p-3 text-sm font-light text-on-surface outline-none transition-shadow focus:ring-2 focus:ring-primary"
                    defaultValue={`Hola ${factura.cliente}: te escribimos de ${empresa.nombre}. La factura ${factura.numero_factura} por ${fmt(Number(factura.monto))} ${
                      factura.fecha_vencimiento
                        ? `venció el ${formatearFecha(factura.fecha_vencimiento)}`
                        : "está pendiente de pago"
                    }. ¿Podemos agendar el pago esta semana? ¡Gracias!`}
                  />
                </div>

                <button
                  type="button"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-secondary transition-opacity hover:opacity-90 active:scale-[0.98]"
                >
                  <Icon name="chat" className="text-[18px]" />
                  Enviar por WhatsApp
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Plan de cuotas generado por un pago con crédito */}
      {cuotasHijas && cuotasHijas.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-tertiary-container bg-surface-container-lowest shadow-level-1">
          <div className="flex items-center gap-2 border-b border-tertiary-container bg-tertiary-container/20 px-6 py-4">
            <Icon
              name="credit_score"
              className="text-[22px] text-on-tertiary-container"
            />
            <h3 className="text-xl font-bold text-on-surface">
              Plan de pagos generado (crédito)
            </h3>
          </div>
          <table className="w-full text-left">
            <thead className="border-b border-outline-variant bg-surface-container-low">
              <tr className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                <th className="px-6 py-3">Cuota</th>
                <th className="px-6 py-3 text-right">Monto</th>
                <th className="px-6 py-3">Vence</th>
                <th className="px-6 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {cuotasHijas.map((c) => (
                <tr
                  key={c.id}
                  className="text-sm transition-colors hover:bg-surface-container"
                >
                  <td className="px-6 py-3.5">
                    <Link
                      href={`/facturas/${c.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {c.numero_factura}
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-on-surface">
                    {fmt(Number(c.monto))}
                  </td>
                  <td className="px-6 py-3.5 font-light text-on-surface-variant">
                    {formatearFecha(c.fecha_vencimiento)}
                  </td>
                  <td className="px-6 py-3.5">
                    <StatusBadge
                      estado={estadoVisual({
                        estado: c.estado,
                        fecha_vencimiento: c.fecha_vencimiento,
                      })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
