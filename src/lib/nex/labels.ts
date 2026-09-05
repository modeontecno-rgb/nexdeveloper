import type { EstadoProyecto, EstadoTarea, ModoEjecucion, Prioridad } from "./types";

export const ETIQUETA_ESTADO_PROYECTO: Record<EstadoProyecto, string> = {
  pendiente: "Pendiente",
  planificando: "Planificando",
  en_cola: "En cola",
  ejecutando: "Ejecutando",
  esperando_revision: "Esperando revisión",
  bloqueado: "Bloqueado",
  completado: "Completado",
};

export const ETIQUETA_ESTADO_TAREA: Record<EstadoTarea, string> = {
  pendiente: "Pendiente",
  en_cola: "En cola",
  ejecutando: "Ejecutando",
  esperando_revision: "Esperando revisión",
  bloqueada: "Bloqueada",
  completada: "Completada",
};

export const ETIQUETA_PRIORIDAD: Record<Prioridad, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};

export const ETIQUETA_MODO: Record<ModoEjecucion, string> = {
  economico: "Económico",
  equilibrado: "Equilibrado",
  maxima_calidad: "Máxima calidad",
};

export function formatoEuros(valor: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function formatoFecha(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "2-digit" }).format(
    new Date(iso),
  );
}

export function formatoFechaHora(iso: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function desde(iso: string) {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 60) return `hace ${minutos} min`;
  const h = Math.round(minutos / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}
