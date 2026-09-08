/** Bloques de datos que se pueden vaciar para «empezar de cero». */

export type BloqueLimpieza = "tareas" | "peticiones" | "mesas" | "avisos";

export type DefinicionBloque = {
  id: BloqueLimpieza;
  titulo: string;
  descripcion: string;
  /** Tablas en el orden correcto de borrado: primero las dependientes. */
  tablas: string[];
};

export const BLOQUES_LIMPIEZA: DefinicionBloque[] = [
  {
    id: "mesas",
    titulo: "Mesas de expertos",
    descripcion: "Mesas convocadas, sus intervenciones y sus valoraciones.",
    tablas: ["mesa_valoraciones", "mesa_intervenciones", "mesas"],
  },
  {
    id: "peticiones",
    titulo: "Peticiones y propuestas de Pídeme",
    descripcion: "Borradores, propuestas pendientes, mensajes y archivos adjuntos.",
    tablas: ["peticiones_mensajes", "peticiones_adjuntos", "peticiones_directas"],
  },
  {
    id: "avisos",
    titulo: "Avisos e incidencias",
    descripcion: "Los avisos de la campana y las incidencias abiertas de infraestructura.",
    tablas: ["avisos", "infra_incidencias"],
  },
  {
    id: "tareas",
    titulo: "Tareas y órdenes",
    descripcion: "Toda la cola de trabajo: tareas, órdenes y sus revisiones.",
    tablas: ["revisiones_orden", "estimaciones", "tareas", "ordenes"],
  },
];

/**
 * Tablas a vaciar, sin repetidos y con las dependientes siempre por delante
 * (las mesas y las peticiones apuntan a tareas, así que van antes).
 */
export function tablasABorrar(bloques: BloqueLimpieza[]): string[] {
  const elegidos = BLOQUES_LIMPIEZA.filter((b) => bloques.includes(b.id));
  const salida: string[] = [];
  for (const bloque of elegidos) {
    for (const tabla of bloque.tablas) {
      if (!salida.includes(tabla)) salida.push(tabla);
    }
  }
  return salida;
}

/** Texto que hay que escribir para confirmar el borrado. */
export const PALABRA_CONFIRMACION = "BORRAR";

export function confirmacionValida(texto: string): boolean {
  return texto.trim().toUpperCase() === PALABRA_CONFIRMACION;
}
