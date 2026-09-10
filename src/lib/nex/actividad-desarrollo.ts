import { AREAS_MEJORAS } from "../../../db/functions/_shared/mejoras";
export type FaseActividad = {
  papel: string;
  estado: string;
  modelo: { proveedor: string; identificador: string };
};
export type TrabajoActividad = {
  estado: string;
  pasos?: number | null;
  actualizado_el?: string;
  iniciado_el?: string | null;
  creado_el?: string;
  cambios?: Record<string, string | null> | null;
  estado_agente?: { equipo?: FaseActividad[]; fase?: number; mensajes?: unknown[] } | null;
};
export const nombresFases: Record<string, string> = {
  ...Object.fromEntries(Object.entries(AREAS_MEJORAS).map(([k, v]) => [k, v[0]])),
  consejo: "Consejo",
  diseno: "Diseño",
  backend: "Datos y servidor",
  interfaz: "Programación",
  revision: "Revisión",
};
const acciones: Record<string, string> = {
  listar_archivos: "Explorar los archivos",
  leer_archivo: "Leer archivo",
  buscar: "Buscar en el código",
  escribir_archivo: "Preparar cambios",
  borrar_archivo: "Preparar eliminación",
  terminar: "Entregar esta fase",
};
type Registro = Record<string, unknown>;
function objeto(v: unknown): Registro {
  return v && typeof v === "object" ? (v as Registro) : {};
}
export function ultimasAcciones(trabajo: TrabajoActividad) {
  const bloques = (trabajo.estado_agente?.mensajes ?? []).flatMap((m) => {
    const contenido = objeto(m)["content"];
    return Array.isArray(contenido) ? contenido.map(objeto) : [];
  });
  const resultados = new Map(
    bloques.filter((b) => b["type"] === "tool_result").map((b) => [b["tool_use_id"], b]),
  );
  return bloques
    .filter(
      (b) =>
        b["type"] === "tool_use" && typeof b["name"] === "string" && acciones[String(b["name"])],
    )
    .map((b, i) => {
      const resultado = resultados.get(b["id"]);
      const entrada = objeto(b["input"]);
      return {
        id: String(b["id"] ?? i),
        titulo: acciones[String(b["name"])]!,
        ruta: typeof entrada["ruta"] === "string" ? entrada["ruta"] : null,
        estado: !resultado
          ? "solicitado"
          : typeof resultado["content"] === "string" && resultado["content"].startsWith("ERROR:")
            ? "error"
            : "hecho",
      };
    })
    .slice(-15);
}
/** Aproximación por fases completadas y operaciones registradas; nunca avanza por el reloj. */
export function progresoEstimado(trabajo: TrabajoActividad) {
  if (["completada", "esperando_aprobacion"].includes(trabajo.estado)) return 100;
  if (trabajo.estado === "en_cola") return 0;
  if (trabajo.estado === "publicando") return 98;
  if (trabajo.estado === "comprobando") return 95;
  const fases = trabajo.estado_agente?.equipo ?? [];
  const hechas = fases.filter((f) => f.estado === "completada").length;
  const accionesHechas = ultimasAcciones(trabajo).filter((a) => a.estado === "hecho").length;
  if (!fases.length) {
    if (["error", "cancelada"].includes(trabajo.estado) && !trabajo.pasos) return 0;
    return Math.min(85, 5 + Math.max(0, trabajo.pasos ?? 0) * 3);
  }
  // El trabajo de una fase puede crecer: el subtotal nunca se considera una fase terminada.
  const parcial = fases.some((f) => f.estado === "trabajando")
    ? Math.min(0.8, 0.1 + accionesHechas * 0.07)
    : 0;
  return Math.min(92, Math.round(5 + (85 * (hechas + parcial)) / fases.length));
}
export function estadoVisible(trabajo: TrabajoActividad) {
  if (trabajo.estado === "en_cola") return "En cola: todavía no ha empezado";
  if (trabajo.estado === "esperando_aprobacion") return "Preparado para tu revisión";
  if (trabajo.estado === "completada") return "Trabajo terminado";
  if (trabajo.estado === "error") return "Detenido por un error";
  if (trabajo.estado === "cancelada") return "Trabajo cancelado";
  if (trabajo.estado === "publicando") return "Publicando la entrega";
  if (trabajo.estado === "comprobando") return "Comprobando la entrega";
  const fase = trabajo.estado_agente?.equipo?.find((f) => f.estado === "trabajando");
  return fase
    ? `${nombresFases[fase.papel] ?? fase.papel} · ${fase.modelo.identificador}`
    : "Preparando el trabajo";
}
