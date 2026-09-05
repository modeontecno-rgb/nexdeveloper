/**
 * Arquitectura de adaptadores de agentes.
 *
 * Ninguna API real está conectada todavía. Cada adaptador declara sus
 * capacidades y devuelve un resultado simulado, de modo que las pantallas y los
 * estados ya funcionan. Cuando se conecte una integración oficial, basta con
 * sustituir el método `ejecutar` de ese adaptador.
 */
import type { ModoEjecucion } from "./types";

export interface PeticionAgente {
  proyectoId: string;
  orden: string;
  modo: ModoEjecucion;
}

export interface RespuestaAgente {
  agenteId: string;
  estado: "simulado" | "completado" | "error";
  mensaje: string;
  costeEstimado: number;
  horasEstimadas: number;
}

export interface AdaptadorAgente {
  id: string;
  nombre: string;
  conectado: boolean;
  capacidades: string[];
  ejecutar: (peticion: PeticionAgente) => Promise<RespuestaAgente>;
}

function adaptadorNoConectado(id: string, nombre: string, capacidades: string[]): AdaptadorAgente {
  return {
    id,
    nombre,
    conectado: false,
    capacidades,
    async ejecutar({ orden, modo }) {
      const factor = modo === "economico" ? 0.6 : modo === "maxima_calidad" ? 1.6 : 1;
      return {
        agenteId: id,
        estado: "simulado",
        mensaje: `${nombre} aún no está conectado. Orden registrada: «${orden.slice(0, 60)}».`,
        costeEstimado: Math.round(40 * factor + orden.length * 0.12),
        horasEstimadas: Math.round((2 + orden.length / 220) * factor * 10) / 10,
      };
    },
  };
}

export const ADAPTADORES: Record<string, AdaptadorAgente> = {
  claude: adaptadorNoConectado("claude", "Claude", ["arquitectura", "código", "revisión"]),
  chatgpt: adaptadorNoConectado("chatgpt", "ChatGPT", ["planificación", "redacción"]),
  gemini: adaptadorNoConectado("gemini", "Gemini", ["datos", "documentos"]),
  lovable: adaptadorNoConectado("lovable", "Lovable", ["interfaz", "prototipo"]),
  canva: adaptadorNoConectado("canva", "Canva", ["diseño"]),
  "nano-banana": adaptadorNoConectado("nano-banana", "Nano Banana", ["imágenes"]),
};

export function plantillaOrdenInicial(input: {
  nombre: string;
  objetivo: string;
  requisitos: string;
  tecnologias: string;
  repositorio: string;
}) {
  return [
    `Proyecto: ${input.nombre}`,
    "",
    `Objetivo: ${input.objetivo || "(por definir)"}`,
    "",
    `Requisitos:\n${input.requisitos || "(por definir)"}`,
    "",
    `Tecnologías: ${input.tecnologias || "(por definir)"}`,
    `Repositorio: ${input.repositorio || "(sin repositorio asociado)"}`,
    "",
    "Entrega esperada: plan de trabajo con tareas, estimación de tiempo y coste por tarea.",
  ].join("\n");
}
