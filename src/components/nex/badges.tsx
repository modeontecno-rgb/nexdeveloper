import { cn } from "@/lib/utils";
import { ETIQUETA_ESTADO_PROYECTO, ETIQUETA_ESTADO_TAREA, ETIQUETA_PRIORIDAD } from "@/lib/nex/labels";
import type { EstadoProyecto, EstadoTarea, Prioridad } from "@/lib/nex/types";

const base =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

const tonos = {
  neutro: "border-border bg-muted text-muted-foreground",
  info: "border-info/30 bg-info/10 text-info",
  activo: "border-primary/40 bg-primary/10 text-primary",
  aviso: "border-warning/30 bg-warning/10 text-warning",
  peligro: "border-destructive/40 bg-destructive/10 text-destructive",
  exito: "border-success/40 bg-success/10 text-success",
} as const;

const tonoEstadoProyecto: Record<EstadoProyecto, keyof typeof tonos> = {
  pendiente: "neutro",
  planificando: "info",
  en_cola: "info",
  ejecutando: "activo",
  esperando_revision: "aviso",
  bloqueado: "peligro",
  completado: "exito",
};

const tonoEstadoTarea: Record<EstadoTarea, keyof typeof tonos> = {
  pendiente: "neutro",
  en_cola: "info",
  ejecutando: "activo",
  esperando_revision: "aviso",
  bloqueada: "peligro",
  completada: "exito",
};

const tonoPrioridad: Record<Prioridad, keyof typeof tonos> = {
  baja: "neutro",
  media: "info",
  alta: "aviso",
  critica: "peligro",
};

export function EstadoProyectoBadge({ estado }: { estado: EstadoProyecto }) {
  return <span className={cn(base, tonos[tonoEstadoProyecto[estado]])}>{ETIQUETA_ESTADO_PROYECTO[estado]}</span>;
}

export function EstadoTareaBadge({ estado }: { estado: EstadoTarea }) {
  return <span className={cn(base, tonos[tonoEstadoTarea[estado]])}>{ETIQUETA_ESTADO_TAREA[estado]}</span>;
}

export function PrioridadBadge({ prioridad }: { prioridad: Prioridad }) {
  return <span className={cn(base, tonos[tonoPrioridad[prioridad]])}>{ETIQUETA_PRIORIDAD[prioridad]}</span>;
}

export function Progreso({ valor, className }: { valor: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, valor))}%` }}
      />
    </div>
  );
}
