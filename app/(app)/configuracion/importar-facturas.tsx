"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/app/icon";
import {
  CAMPOS_MAPFLOW,
  aplicarMapeo,
  autoMapear,
  parsearCSV,
  type Mapeo,
} from "@/lib/importacion";
import { cn } from "@/lib/utils";
import {
  desconectarSheets,
  guardarConexionSheets,
  importarFacturas,
  leerEncabezadosSheets,
  previsualizarImportacion,
  sincronizarSheets,
  type ConexionSheets,
} from "./importar-actions";

// ============================================================
// IMPORTAR FACTURA — modal de Ajustes → Perfil. Dos caminos:
//   A) Subir un archivo Excel (.xlsx) o CSV, mapear columnas,
//      ver la vista previa (duplicados) y confirmar.
//   B) Conectar un Google Sheets que se sincroniza solo.
// ============================================================

type Camino = "archivo" | "sheets";

function MapeoColumnas({
  encabezados,
  mapeo,
  onCambio,
}: {
  encabezados: string[];
  mapeo: Mapeo;
  onCambio: (m: Mapeo) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-light text-on-surface-variant">
        Empareja las columnas de TU archivo con los campos de MapFlow.
        Los obvios ya vienen detectados.
      </p>
      {CAMPOS_MAPFLOW.map((campo) => (
        <div key={campo.id} className="flex items-center gap-3">
          <span className="w-44 shrink-0 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            {campo.label}
            {campo.requerido && " *"}
          </span>
          <select
            value={mapeo[campo.id] ?? ""}
            onChange={(e) =>
              onCambio({ ...mapeo, [campo.id]: e.target.value || undefined })
            }
            aria-label={`Columna para ${campo.label}`}
            className="w-full rounded-lg border border-primary-container bg-surface-container-low p-2 text-sm font-light text-on-surface outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">— Sin columna —</option>
            {encabezados.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

export function ImportarFacturas({
  hoja,
  onCerrar,
}: {
  hoja: ConexionSheets | null;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [camino, setCamino] = useState<Camino>("archivo");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [ocupado, startTransition] = useTransition();

  // --- Camino A: archivo ---
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [encabezados, setEncabezados] = useState<string[]>([]);
  const [filas, setFilas] = useState<string[][]>([]);
  const [mapeo, setMapeo] = useState<Mapeo>({});
  const [previa, setPrevia] = useState<{
    validas: number;
    duplicadas: number;
    invalidas: number;
  } | null>(null);

  // --- Camino B: sheets ---
  const [urlSheets, setUrlSheets] = useState("");
  const [encabezadosSheets, setEncabezadosSheets] = useState<string[]>([]);
  const [mapeoSheets, setMapeoSheets] = useState<Mapeo>({});

  function cargarMatriz(nombre: string, matriz: string[][]) {
    if (matriz.length < 2) {
      setError("El archivo no tiene filas de datos (solo encabezados o vacío).");
      return;
    }
    const enc = matriz[0].map((e) => String(e).trim());
    setNombreArchivo(nombre);
    setEncabezados(enc);
    setFilas(matriz.slice(1));
    setMapeo(autoMapear(enc));
    setPrevia(null);
    setError(null);
    setExito(null);
  }

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite re-subir el mismo archivo
    if (!archivo) return;
    setError(null);
    try {
      if (/\.csv$/i.test(archivo.name)) {
        cargarMatriz(archivo.name, parsearCSV(await archivo.text()));
      } else if (/\.xlsx?$/i.test(archivo.name)) {
        // SheetJS se carga solo cuando hace falta
        const XLSX = await import("xlsx");
        const libro = XLSX.read(await archivo.arrayBuffer(), {
          cellDates: false,
        });
        const hoja1 = libro.Sheets[libro.SheetNames[0]];
        const matriz = XLSX.utils.sheet_to_json<string[]>(hoja1, {
          header: 1,
          raw: false,
          dateNF: "yyyy-mm-dd",
          defval: "",
        }) as string[][];
        cargarMatriz(archivo.name, matriz.map((f) => f.map((c) => String(c ?? ""))));
      } else {
        setError("Formato no soportado: sube un .xlsx o .csv");
      }
    } catch {
      setError("No se pudo leer el archivo. Verifica que no esté dañado.");
    }
  }

  function verPrevia() {
    setError(null);
    startTransition(async () => {
      const crudas = aplicarMapeo(encabezados, filas, mapeo);
      const res = await previsualizarImportacion(crudas);
      if (!res.ok) return setError(res.error ?? "No se pudo previsualizar.");
      setPrevia({
        validas: res.validas ?? 0,
        duplicadas: res.duplicadas ?? 0,
        invalidas: res.invalidas ?? 0,
      });
    });
  }

  function confirmarImportacion() {
    setError(null);
    startTransition(async () => {
      const crudas = aplicarMapeo(encabezados, filas, mapeo);
      const res = await importarFacturas(crudas);
      if (!res.ok) return setError(res.error ?? "No se pudo importar.");
      setExito(
        `${res.importadas} factura${res.importadas === 1 ? "" : "s"} importada${res.importadas === 1 ? "" : "s"} correctamente` +
          (res.omitidas ? ` (${res.omitidas} omitidas por duplicado o datos incompletos)` : "")
      );
      setPrevia(null);
      setNombreArchivo(null);
      setFilas([]);
      router.refresh();
    });
  }

  function leerHoja() {
    setError(null);
    startTransition(async () => {
      const res = await leerEncabezadosSheets(urlSheets);
      if (!res.ok || !res.encabezados)
        return setError(res.error ?? "No se pudo leer la hoja.");
      setEncabezadosSheets(res.encabezados);
      setMapeoSheets(autoMapear(res.encabezados));
    });
  }

  function conectarSheets() {
    setError(null);
    startTransition(async () => {
      const res = await guardarConexionSheets({ url: urlSheets, mapeo: mapeoSheets });
      if (!res.ok) return setError(res.error ?? "No se pudo conectar.");
      // Primera sincronización inmediata
      const sync = await sincronizarSheets();
      if (!sync.ok) return setError(sync.error ?? "Conectada, pero falló la primera lectura.");
      setExito(
        `Hoja conectada. ${sync.importadas} factura${sync.importadas === 1 ? "" : "s"} importada${sync.importadas === 1 ? "" : "s"} correctamente.`
      );
      router.refresh();
    });
  }

  function sincronizarAhora() {
    setError(null);
    startTransition(async () => {
      const res = await sincronizarSheets();
      if (!res.ok) return setError(res.error ?? "No se pudo sincronizar.");
      setExito(
        `${res.importadas} factura${res.importadas === 1 ? "" : "s"} nueva${res.importadas === 1 ? "" : "s"} importada${res.importadas === 1 ? "" : "s"} correctamente` +
          (res.omitidas ? ` (${res.omitidas} ya existían)` : "")
      );
      router.refresh();
    });
  }

  function desconectar() {
    startTransition(async () => {
      await desconectarSheets();
      setExito("Hoja desconectada.");
      router.refresh();
    });
  }

  const botonPrimario =
    "flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Importar facturas"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-level-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-on-surface">Importar factura</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        {/* Selector de camino */}
        <div className="mt-4 flex rounded-xl bg-surface-container-high p-1">
          {(
            [
              { id: "archivo", label: "Archivo Excel/CSV", icono: "upload_file" },
              { id: "sheets", label: "Google Sheets", icono: "table_chart" },
            ] as const
          ).map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => {
                setCamino(op.id);
                setError(null);
                setExito(null);
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors",
                camino === op.id
                  ? "bg-primary font-bold text-on-primary shadow-sm"
                  : "font-light text-on-surface-variant hover:text-on-surface"
              )}
            >
              <Icon name={op.icono} className="text-[18px]" />
              {op.label}
            </button>
          ))}
        </div>

        {exito && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-secondary-container/60 px-4 py-3 text-sm font-light text-on-secondary-container">
            <Icon name="check_circle" className="text-[18px]" />
            {exito}
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
            <Icon name="error" className="mt-0.5 shrink-0 text-[18px]" />
            {error}
          </div>
        )}

        {/* ============ CAMINO A: ARCHIVO ============ */}
        {camino === "archivo" && (
          <div className="mt-5 flex flex-col gap-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low px-6 py-8 text-center transition-colors hover:border-primary">
              <Icon name="upload_file" className="text-[32px] text-on-surface-variant" />
              <span className="text-sm font-semibold text-on-surface">
                {nombreArchivo ?? "Sube tu archivo .xlsx o .csv"}
              </span>
              <span className="text-xs font-light text-on-surface-variant">
                Las facturas entran como pagadas salvo que el archivo diga otra
                cosa. Sin vencimiento, se usa la fecha de emisión.
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={elegirArchivo}
                className="hidden"
              />
            </label>

            {encabezados.length > 0 && (
              <>
                <MapeoColumnas
                  encabezados={encabezados}
                  mapeo={mapeo}
                  onCambio={(m) => {
                    setMapeo(m);
                    setPrevia(null);
                  }}
                />

                {/* Vista previa antes de confirmar */}
                {previa && (
                  <div className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm">
                    <div className="font-semibold text-on-surface">
                      Vista previa de {filas.length} fila{filas.length === 1 ? "" : "s"}:
                    </div>
                    <ul className="mt-1 flex flex-col gap-0.5 font-light text-on-surface-variant">
                      <li>✅ {previa.validas} se importarán</li>
                      <li>
                        ⚠️ {previa.duplicadas} posibles duplicados (mismo
                        contacto, monto y fecha) — se omitirán
                      </li>
                      {previa.invalidas > 0 && (
                        <li>✖️ {previa.invalidas} sin contacto o monto válidos</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  {!previa ? (
                    <button
                      type="button"
                      onClick={verPrevia}
                      disabled={ocupado || !mapeo.contacto || !mapeo.monto}
                      className={botonPrimario}
                    >
                      {ocupado ? (
                        <Icon name="progress_activity" className="animate-spin text-[16px]" />
                      ) : (
                        <Icon name="preview" className="text-[16px]" />
                      )}
                      Ver vista previa
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={confirmarImportacion}
                      disabled={ocupado || previa.validas === 0}
                      className={botonPrimario}
                    >
                      {ocupado ? (
                        <>
                          <Icon name="progress_activity" className="animate-spin text-[16px]" />
                          Importando…
                        </>
                      ) : (
                        <>
                          <Icon name="download_done" className="text-[16px]" />
                          Importar {previa.validas} factura{previa.validas === 1 ? "" : "s"}
                        </>
                      )}
                    </button>
                  )}
                </div>
                {(!mapeo.contacto || !mapeo.monto) && (
                  <p className="text-right text-[11px] font-light text-on-surface-variant">
                    Mapea al menos Contacto y Monto para continuar.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ============ CAMINO B: GOOGLE SHEETS ============ */}
        {camino === "sheets" && (
          <div className="mt-5 flex flex-col gap-4">
            {hoja?.url ? (
              <div className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                  <Icon name="link" className="text-[18px] text-primary" />
                  Hoja conectada
                </div>
                <div className="mt-1 truncate text-xs font-light text-on-surface-variant">
                  {hoja.url}
                </div>
                <div className="text-xs font-light text-on-surface-variant">
                  Última sincronización:{" "}
                  {hoja.ultima_sync
                    ? `${hoja.ultima_sync.slice(8, 10)}/${hoja.ultima_sync.slice(5, 7)} ${hoja.ultima_sync.slice(11, 16)}`
                    : "aún no"}
                  {" · "}MapFlow también sincroniza solo al usar la app (máx. 1
                  vez por hora).
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={sincronizarAhora}
                    disabled={ocupado}
                    className={botonPrimario}
                  >
                    {ocupado ? (
                      <Icon name="progress_activity" className="animate-spin text-[16px]" />
                    ) : (
                      <Icon name="sync" className="text-[16px]" />
                    )}
                    Sincronizar ahora
                  </button>
                  <button
                    type="button"
                    onClick={desconectar}
                    disabled={ocupado}
                    className="rounded-xl border border-error px-5 py-3 text-xs font-bold uppercase tracking-wider text-error transition-colors hover:bg-error/5 disabled:opacity-50"
                  >
                    Desconectar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm font-light text-on-surface-variant">
                  Conecta una hoja que ya uses y MapFlow traerá las facturas
                  nuevas automáticamente. En Google Sheets: Compartir →{" "}
                  <strong className="font-semibold">
                    «Cualquier persona con el enlace» puede ver
                  </strong>
                  , y pega aquí el enlace.
                </p>
                <div className="flex gap-2">
                  <input
                    value={urlSheets}
                    onChange={(e) => setUrlSheets(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    aria-label="Enlace de Google Sheets"
                    className="w-full rounded-lg border border-primary-container bg-surface-container-low p-3 text-sm font-light text-on-surface outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={leerHoja}
                    disabled={ocupado || !urlSheets.trim()}
                    className={botonPrimario}
                  >
                    {ocupado ? (
                      <Icon name="progress_activity" className="animate-spin text-[16px]" />
                    ) : (
                      "Leer hoja"
                    )}
                  </button>
                </div>

                {encabezadosSheets.length > 0 && (
                  <>
                    <MapeoColumnas
                      encabezados={encabezadosSheets}
                      mapeo={mapeoSheets}
                      onCambio={setMapeoSheets}
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={conectarSheets}
                        disabled={ocupado || !mapeoSheets.contacto || !mapeoSheets.monto}
                        className={botonPrimario}
                      >
                        {ocupado ? (
                          <>
                            <Icon name="progress_activity" className="animate-spin text-[16px]" />
                            Conectando…
                          </>
                        ) : (
                          <>
                            <Icon name="link" className="text-[16px]" />
                            Conectar y sincronizar
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
