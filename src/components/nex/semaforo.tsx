import type { SemaforoCalidad } from "@/lib/nex/db-types";
import { cn } from "@/lib/utils";

const ETIQUETA: Record<SemaforoCalidad, string> = {
  verde: "Calidad verde",
  ambar: "Calidad ámbar",
  rojo: "Calidad roja",
  sin_datos: "Sin comprobar",
};

const TONO: Record<SemaforoCalidad, string> = {
  verde: "border-success/40 bg-success/10 text-success",
  ambar: "border-warning/40 bg-warning/10 text-warning",
  rojo: "border-destructive/40 bg-destructive/10 text-destructive",
  sin_datos: "border-border bg-muted text-muted-foreground",
};

/** Chip con el semáforo de calidad de un proyecto. */
export function SemaforoBadge({ semaforo, className }: { semaforo: SemaforoCalidad; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONO[semaforo],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {ETIQUETA[semaforo]}
    </span>
  );
}
