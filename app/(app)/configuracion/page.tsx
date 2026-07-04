import { Icon } from "@/components/app/icon";

const tabs = ["Perfil", "Negocio", "Notificaciones", "Facturación", "Integraciones"];

function Toggle({ defaultChecked, label }: { defaultChecked?: boolean; label: string }) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="peer sr-only"
        aria-label={label}
      />
      <div className="h-6 w-11 rounded-full bg-outline-variant transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-secondary peer-checked:after:translate-x-5" />
    </label>
  );
}

function Campo({
  label,
  valor,
  placeholder,
}: {
  label: string;
  valor?: string;
  placeholder?: string;
}) {
  return (
    <div className="transition-transform duration-200 focus-within:scale-[1.01]">
      <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </label>
      <input
        type="text"
        defaultValue={valor}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-on-surface">
          Configuración
        </h1>
        <p className="mt-1 text-lg font-light text-on-surface-variant">
          Ajusta MapFlow a la medida de tu negocio.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-6 border-b border-outline-variant">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            className={
              t === "Negocio"
                ? "-mb-px border-b-2 border-primary pb-3 text-sm font-bold text-primary"
                : "-mb-px border-b-2 border-transparent pb-3 text-sm font-light text-on-surface-variant transition-colors hover:text-on-surface"
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Detalles del negocio (7 col) */}
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1 lg:col-span-7">
          <h3 className="mb-5 text-xl font-bold text-on-surface">
            Detalles del negocio
          </h3>
          <div className="flex flex-col gap-4">
            <Campo label="Nombre del negocio" valor="Panadería La Espiga" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="NIT / RUT" valor="ESP-840512-XY3" />
              <Campo label="Tipo de negocio" valor="Panadería" />
            </div>
            <Campo
              label="Dirección"
              valor="Av. de los Insurgentes 452, Col. Roma Norte, CDMX"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Teléfono" valor="+52 55 5555 0134" />
              <Campo label="Correo de contacto" valor="hola@laespiga.mx" />
            </div>
          </div>
        </div>

        {/* Canales de alerta (5 col) */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1">
            <h3 className="mb-5 text-xl font-bold text-on-surface">
              Canales de alerta
            </h3>
            <ul className="divide-y divide-outline-variant">
              <li className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-semibold text-on-surface">
                    WhatsApp de cobranza
                  </div>
                  <div className="text-xs font-light text-on-surface-variant">
                    Recordatorios y confirmaciones de pago
                  </div>
                </div>
                <Toggle defaultChecked label="WhatsApp de cobranza" />
              </li>
              <li className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-semibold text-on-surface">
                    Email de facturas
                  </div>
                  <div className="text-xs font-light text-on-surface-variant">
                    Copia de cada factura emitida
                  </div>
                </div>
                <Toggle defaultChecked label="Email de facturas" />
              </li>
              <li className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-semibold text-on-surface">
                    Resumen semanal
                  </div>
                  <div className="text-xs font-light text-on-surface-variant">
                    Estado financiero cada lunes a las 8:00
                  </div>
                </div>
                <Toggle label="Resumen semanal" />
              </li>
            </ul>
          </div>

          {/* Identidad visual */}
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-level-1">
            <h3 className="mb-4 text-xl font-bold text-on-surface">
              Identidad visual
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low">
                <Icon
                  name="storefront"
                  className="text-[32px] text-on-surface-variant"
                />
              </div>
              <div>
                <p className="text-xs font-light text-on-surface-variant">
                  Tu logo aparece en facturas y recordatorios. PNG o SVG, mínimo
                  256×256.
                </p>
                <button
                  type="button"
                  className="mt-2 rounded-xl border border-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider text-secondary transition-colors hover:bg-secondary/5"
                >
                  Cambiar imagen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero card */}
      <div className="group relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-on-primary-container transition-transform duration-500 group-hover:scale-110" />
        <div className="relative flex flex-wrap items-center justify-between gap-4 p-8 text-white">
          <div>
            <h3 className="text-2xl font-bold">Optimiza tu flujo</h3>
            <p className="mt-1 max-w-lg text-sm font-light text-white/85">
              Activa las integraciones bancarias para importar movimientos
              automáticamente y olvidarte de los CSV.
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl bg-white/15 px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-white/25"
          >
            Explorar integraciones
          </button>
        </div>
      </div>

      {/* Footer de guardado */}
      <div className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-low px-6 py-4">
        <div className="flex items-center gap-2 text-xs font-light text-on-surface-variant">
          <Icon name="info" className="text-[18px]" />
          Los cambios se aplican a toda la organización.
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:bg-surface-variant"
          >
            Descartar
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <Icon name="save" className="text-[18px]" />
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
