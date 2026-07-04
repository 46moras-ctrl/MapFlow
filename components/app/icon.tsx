import { cn } from "@/lib/utils";

interface IconProps {
  name: string;
  filled?: boolean;
  className?: string;
}

/** Icono Material Symbols Outlined (DESIGN.md §7) */
export function Icon({ name, filled, className }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "material-symbols-outlined select-none text-[24px] leading-none",
        filled && "icon-filled",
        className
      )}
    >
      {name}
    </span>
  );
}
