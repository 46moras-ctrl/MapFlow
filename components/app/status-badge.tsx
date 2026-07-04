import { cn } from "@/lib/utils";

// Status Badges pill (DESIGN.md §8.4)
const estilos: Record<string, { clase: string; texto: string }> = {
  vencida: { clase: "bg-error text-on-error", texto: "VENCIDA" },
  por_vencer: {
    clase: "bg-tertiary-container text-on-tertiary-container",
    texto: "POR VENCER",
  },
  pendiente: {
    clase: "bg-tertiary-container text-on-tertiary-container",
    texto: "PENDIENTE",
  },
  pagada: { clase: "bg-secondary text-on-secondary", texto: "PAGADA" },
  creciente: {
    clase: "bg-secondary-container text-on-secondary-container",
    texto: "CRECIENTE",
  },
  estable: {
    clase: "bg-secondary-container text-on-secondary-container",
    texto: "ESTABLE",
  },
  optimizar: {
    clase: "bg-error-container text-on-error-container",
    texto: "OPTIMIZAR",
  },
  amable: {
    clase: "bg-secondary-container text-on-secondary-container",
    texto: "AMABLE",
  },
  firme: {
    clase: "bg-tertiary-container text-on-tertiary-container",
    texto: "FIRME",
  },
};

export function StatusBadge({
  estado,
  className,
}: {
  estado: string;
  className?: string;
}) {
  const s = estilos[estado.toLowerCase()] ?? {
    clase: "bg-surface-container-high text-on-surface-variant",
    texto: estado.toUpperCase(),
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
        s.clase,
        className
      )}
    >
      {s.texto}
    </span>
  );
}
