import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/app/icon";
import { StatusBadge } from "@/components/app/status-badge";
import { facturas, fmt, recordatoriosFactura } from "@/lib/mock-data";

export default function DetalleFacturaPage({
  params,
}: {
  params: { id: string };
}) {
  const factura = facturas.find(
    (f) => f.id.toLowerCase() === decodeURIComponent(params.id).toLowerCase()
  );
  if (!factura) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/facturas"
        className="flex w-fit items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:text-primary"
      >
        <Icon name="arrow_back" className="text-[18px]" />
        Volver a listado
      </Link>

      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-on-surface">
              {factura.id}
            </h1>
            <StatusBadge estado={factura.estado} />
          </div>
          <p className="mt-1 text-lg font-light text-on-surface-variant">
            {factura.cliente}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl bg-secondary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-secondary transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <Icon name="check_circle" className="text-[18px]" />
            Marcar pagada
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl border border-secondary px-6 py-3 text-xs font-bold uppercase tracking-wider text-secondary transition-colors hover:bg-secondary/5 active:scale-[0.98]"
          >
            <Icon name="send" className="text-[18px]" />
            Enviar recordatorio
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Glass Card de información (8 col) */}
        <div className="rounded-xl border border-primary-container bg-white/70 p-6 backdrop-blur-md lg:col-span-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Monto adeudado
              </div>
              <div className="mt-1 text-4xl font-bold tabular-nums text-on-surface">
                {fmt(factura.monto)}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Días de mora
              </div>
              <div
                className={`mt-1 text-4xl font-bold tabular-nums ${
                  factura.diasMora ? "text-error" : "text-secondary"
                }`}
              >
                {factura.diasMora ?? 0}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Fecha de emisión
              </div>
              <div className="mt-1 text-base text-on-surface">
                {factura.emision}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Fecha de vencimiento
              </div>
              <div className="mt-1 text-base text-on-surface">
                {factura.vencimiento}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Concepto
              </div>
              <div className="mt-1 text-base font-light leading-relaxed text-on-surface">
                {factura.concepto}
              </div>
            </div>
            <div className="sm:col-span-2 border-t border-outline-variant pt-4">
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Contacto del cliente
              </div>
              <div className="mt-1 flex items-center gap-2 text-base text-on-surface">
                <Icon name="call" className="text-[18px] text-on-surface-variant" />
                {factura.contacto}
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
              Esta factura lleva{" "}
              <strong className="font-semibold">
                {factura.diasMora ?? 0} días de mora
              </strong>{" "}
              y el cliente respondió al último correo. Sugiero un recordatorio
              por WhatsApp con tono amable proponiendo fecha de pago.
            </div>

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
                defaultValue={`Hola ${factura.cliente}: te escribimos de Panadería La Espiga. La factura ${factura.id} por ${fmt(factura.monto)} venció el ${factura.vencimiento}. ¿Podemos agendar el pago esta semana? ¡Gracias!`}
              />
            </div>

            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-secondary transition-opacity hover:opacity-90 active:scale-[0.98]"
            >
              <Icon name="chat" className="text-[18px]" />
              Enviar por WhatsApp
            </button>
          </div>
        </div>
      </div>

      {/* Historial de recordatorios */}
      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-level-1">
        <h3 className="px-6 py-4 text-xl font-bold text-on-surface">
          Historial de recordatorios
        </h3>
        <table className="w-full text-left">
          <thead className="border-b border-outline-variant bg-surface-container-low">
            <tr className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              <th className="px-6 py-3">Fecha</th>
              <th className="px-6 py-3">Canal</th>
              <th className="px-6 py-3">Tono</th>
              <th className="px-6 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {recordatoriosFactura.map((r) => (
              <tr
                key={r.fecha}
                className="text-sm transition-colors hover:bg-surface-container"
              >
                <td className="px-6 py-3.5 font-light text-on-surface-variant">
                  {r.fecha}
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2 text-on-surface">
                    <Icon
                      name={r.canal === "WhatsApp" ? "chat_bubble" : "mail"}
                      className="text-[18px] text-on-surface-variant"
                    />
                    {r.canal}
                  </div>
                </td>
                <td className="px-6 py-3.5">
                  <StatusBadge estado={r.tono} />
                </td>
                <td className="px-6 py-3.5 font-light text-on-surface-variant">
                  {r.estado}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
