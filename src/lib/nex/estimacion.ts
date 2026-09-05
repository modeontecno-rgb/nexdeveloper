import type { ModoEjecucion, Prioridad, Riesgo } from "./db-types";

export interface Estimacion {
  costeEstimado: number;
  horasEstimadas: number;
  riesgo: Riesgo;
  calidadPrevista: number;
}

const FACTOR: Record<ModoEjecucion, number> = {
  economico: 0.6,
  equilibrado: 1,
  maxima_calidad: 1.7,
};

const CALIDAD: Record<ModoEjecucion, number> = {
  economico: 72,
  equilibrado: 86,
  maxima_calidad: 95,
};

/** Estimación local mientras no haya agentes reales conectados. */
export function estimar(texto: string, modo: ModoEjecucion, prioridad: Prioridad, equipo: number): Estimacion {
  const factor = FACTOR[modo];
  const extraEquipo = 1 + Math.max(0, equipo - 1) * 0.35;
  const horas = Math.round((1.5 + texto.length / 200) * factor * extraEquipo * 10) / 10;
  const coste = Math.round((35 + texto.length * 0.14) * factor * extraEquipo);
  const complejidad = texto.length / 400 + (prioridad === "critica" ? 0.6 : prioridad === "alta" ? 0.3 : 0);
  const riesgo: Riesgo = complejidad > 1.2 ? "Alto" : complejidad > 0.6 ? "Medio" : "Bajo";
  return { costeEstimado: coste, horasEstimadas: horas, riesgo, calidadPrevista: CALIDAD[modo] };
}
