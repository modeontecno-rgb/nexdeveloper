import type {
  AvisoRow,
  InfraIncidenciaRow,
  PeticionDirectaRow,
  ProyectoRow,
  TareaRow,
} from "./db-types";

/** Arreglos que NexDeveloper puede aplicar por su cuenta. */
export type TipoArreglo =
  | "desbloquear_tareas"
  | "marcar_avisos_leidos"
  | "borrar_peticiones_error"
  | "cerrar_mesas_error";

export type Gravedad = "alta" | "media" | "baja";

export type Problema = {
  id: string;
  titulo: string;
  detalle: string;
  gravedad: Gravedad;
  /** Si existe, NexDeveloper puede arreglarlo con un botón. */
  arreglo?: { tipo: TipoArreglo; etiqueta: string; ids: string[] };
  /** Pasos para arreglarlo a mano. */
  instrucciones: string[];
  /** Pantalla donde se resuelve. */
  ruta?: string;
};

export type DatosDiagnostico = {
  tareas: TareaRow[];
  peticiones: PeticionDirectaRow[];
  avisos: AvisoRow[];
  incidencias: InfraIncidenciaRow[];
  proyectos: ProyectoRow[];
  mesasConError: { id: string; pregunta: string }[];
  ahora?: Date;
};

const HORAS = 60 * 60 * 1000;

function horasDesde(fecha: string | null | undefined, ahora: Date): number {
  if (!fecha) return 0;
  const t = new Date(fecha).getTime();
  if (Number.isNaN(t)) return 0;
  return (ahora.getTime() - t) / HORAS;
}

/** Revisa los datos y devuelve los problemas encontrados, de más grave a menos. */
export function detectarProblemas(datos: DatosDiagnostico): Problema[] {
  const ahora = datos.ahora ?? new Date();
  const problemas: Problema[] = [];

  const atascadas = datos.tareas.filter(
    (t) => t.estado === "ejecutando" && horasDesde(t.ultima_actividad, ahora) > 24,
  );
  if (atascadas.length > 0) {
    problemas.push({
      id: "tareas-atascadas",
      titulo: `${atascadas.length} tarea${atascadas.length === 1 ? "" : "s"} lleva${atascadas.length === 1 ? "" : "n"} más de un día en marcha`,
      detalle:
        "Están marcadas como «ejecutando» pero no se han movido en las últimas 24 horas. Suele pasar cuando se cortó una ejecución.",
      gravedad: "alta",
      arreglo: {
        tipo: "desbloquear_tareas",
        etiqueta: "Devolverlas a la cola",
        ids: atascadas.map((t) => t.id),
      },
      instrucciones: [
        "Abre Tareas y filtra por estado «ejecutando».",
        "En cada tarea parada, pulsa «Pausar» y después «Reanudar» para volver a ponerla en cola.",
        "Si ya no hace falta, cancélala para que no ocupe sitio.",
      ],
      ruta: "/tareas",
    });
  }

  const bloqueadas = datos.tareas.filter((t) => t.estado === "bloqueada");
  if (bloqueadas.length > 0) {
    problemas.push({
      id: "tareas-bloqueadas",
      titulo: `${bloqueadas.length} tarea${bloqueadas.length === 1 ? " bloqueada" : "s bloqueadas"} esperando una decisión`,
      detalle: bloqueadas
        .slice(0, 3)
        .map((t) => `«${t.titulo}»${t.bloqueada_motivo ? `: ${t.bloqueada_motivo}` : ""}`)
        .join(" · "),
      gravedad: "alta",
      instrucciones: [
        "Abre Tareas y busca las tarjetas con el aviso de bloqueo.",
        "Lee el motivo y responde lo que se pide (un dato, una aprobación o un archivo).",
        "Si el motivo ya no aplica, devuélvela a la cola con «Reanudar».",
      ],
      ruta: "/tareas",
    });
  }

  const conError = datos.peticiones.filter((p) => p.estado === "error");
  if (conError.length > 0) {
    problemas.push({
      id: "peticiones-error",
      titulo: `${conError.length} petición${conError.length === 1 ? "" : "es"} de Pídeme terminó mal`,
      detalle: conError[0]?.error ?? "La IA no pudo completar la petición.",
      gravedad: "media",
      arreglo: {
        tipo: "borrar_peticiones_error",
        etiqueta: "Descartarlas",
        ids: conError.map((p) => p.id),
      },
      instrucciones: [
        "Abre Pídeme y revisa las peticiones marcadas en rojo.",
        "Vuelve a lanzarlas si el fallo fue puntual, o descártalas si ya no valen.",
        "Si siempre falla lo mismo, revisa Conexiones y el gasto de IA.",
      ],
      ruta: "/pideme",
    });
  }

  if (datos.mesasConError.length > 0) {
    problemas.push({
      id: "mesas-error",
      titulo: `${datos.mesasConError.length} mesa${datos.mesasConError.length === 1 ? "" : "s"} de expertos sin terminar`,
      detalle: datos.mesasConError
        .slice(0, 3)
        .map((m) => `«${m.pregunta}»`)
        .join(" · "),
      gravedad: "media",
      arreglo: {
        tipo: "cerrar_mesas_error",
        etiqueta: "Borrar esas mesas",
        ids: datos.mesasConError.map((m) => m.id),
      },
      instrucciones: [
        "Abre Mesa de expertos y localiza las que quedaron a medias.",
        "Vuelve a convocarlas con la misma pregunta si te interesa la respuesta.",
        "Si no, bórralas para no confundirte.",
      ],
      ruta: "/mesa",
    });
  }

  const abiertas = datos.incidencias.filter((i) => i.estado === "abierta");
  if (abiertas.length > 0) {
    problemas.push({
      id: "incidencias-abiertas",
      titulo: `${abiertas.length} incidencia${abiertas.length === 1 ? " abierta" : "s abiertas"} de infraestructura`,
      detalle: abiertas
        .slice(0, 3)
        .map((i) => i.titulo)
        .join(" · "),
      gravedad: "alta",
      instrucciones: [
        "Abre Infraestructura y mira el servicio en rojo.",
        "Comprueba primero si es un servicio de fuera (dominio, copia, proveedor de IA).",
        "Cuando esté resuelto, marca la incidencia como resuelta para que deje de avisar.",
      ],
      ruta: "/infraestructura",
    });
  }

  const sinLeer = datos.avisos.filter((a) => !a.leido);
  if (sinLeer.length >= 15) {
    problemas.push({
      id: "avisos-acumulados",
      titulo: `${sinLeer.length} avisos sin leer`,
      detalle: "Con tantos avisos acumulados es fácil que se te pase uno importante.",
      gravedad: "baja",
      arreglo: {
        tipo: "marcar_avisos_leidos",
        etiqueta: "Marcarlos como leídos",
        ids: sinLeer.map((a) => a.id),
      },
      instrucciones: [
        "Abre Avisos y repasa los de arriba, que son los más recientes.",
        "Marca como leídos los que ya no necesites.",
        "En Ajustes puedes elegir de qué te avisa NexDeveloper.",
      ],
      ruta: "/avisos",
    });
  }

  const huerfanas = datos.tareas.filter(
    (t) => !datos.proyectos.some((p) => p.id === t.proyecto_id) && t.estado !== "completada",
  );
  if (huerfanas.length > 0) {
    problemas.push({
      id: "tareas-sin-proyecto",
      titulo: `${huerfanas.length} tarea${huerfanas.length === 1 ? "" : "s"} sin proyecto visible`,
      detalle: "Apuntan a un proyecto que ya no existe o que no puedes ver.",
      gravedad: "media",
      instrucciones: [
        "Abre Tareas y muévelas al proyecto correcto con el selector de proyecto.",
        "Si ya no sirven, cancélalas.",
      ],
      ruta: "/tareas",
    });
  }

  const orden: Record<Gravedad, number> = { alta: 0, media: 1, baja: 2 };
  return problemas.sort((a, b) => orden[a.gravedad] - orden[b.gravedad]);
}
