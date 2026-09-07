import type {
  EntornoPreview,
  EstadoAccion,
  EstadoOrden,
  EstadoProyecto,
  EstadoTarea,
  ModoEjecucion,
  NivelAlerta,
  Prioridad,
  TipoAccion,
  TipoActividad,
  TipoIntegracion,
} from "./db-types";

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
  cancelada: "Cancelada",
  pausada: "Pausada",
};

export const ETIQUETA_ESTADO_ORDEN: Record<EstadoOrden, string> = {
  borrador: "Borrador",
  pendiente_aprobacion: "Pendiente de aprobación",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  en_cola: "En cola",
  ejecutando: "Ejecutando",
  completada: "Completada",
  cancelada: "Cancelada",
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

export const ETIQUETA_TIPO_ACTIVIDAD: Record<TipoActividad, string> = {
  orden: "Orden",
  resultado: "Resultado",
  decision: "Decisión",
  cambio: "Cambio",
  actividad: "Actividad",
  reorganizacion: "Reorganización",
  aprobacion: "Aprobación",
  sistema: "Sistema",
};

export const ETIQUETA_NIVEL_ALERTA: Record<NivelAlerta, string> = {
  info: "Informativa",
  aviso: "Aviso",
  critico: "Crítica",
};

export const ETIQUETA_TIPO_INTEGRACION: Record<TipoIntegracion, string> = {
  codigo: "Código",
  modelo: "Modelo",
  diseno: "Diseño",
  datos: "Datos",
  despliegue: "Despliegue",
  otro: "Otro",
};

export function formatoDinero(valor: number, moneda = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(valor || 0);
}

export const formatoEuros = (valor: number) => formatoDinero(valor, "EUR");

/** Convierte a fecha válida o devuelve null (evita que la pantalla se caiga con datos raros). */
function aFecha(iso: string | number | Date | null | undefined): Date | null {
  if (iso === null || iso === undefined || iso === "") return null;
  const fecha = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function formatoFecha(iso: string | null | undefined) {
  const fecha = aFecha(iso);
  if (!fecha) return "—";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "2-digit" }).format(fecha);
}

export function formatoFechaHora(iso: string | null | undefined) {
  const fecha = aFecha(iso);
  if (!fecha) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

export function desde(iso: string | null | undefined) {
  const fecha = aFecha(iso);
  if (!fecha) return "sin actividad";
  const minutos = Math.round((Date.now() - fecha.getTime()) / 60000);
  if (minutos < 1) return "ahora mismo";
  if (minutos < 60) return `hace ${minutos} min`;
  const h = Math.round(minutos / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}


export function crearSlug(nombre: string) {
  return (
    nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "proyecto"
  );
}

export const ETIQUETA_TIPO_ACCION: Record<TipoAccion, string> = {
  supabase_sql: "Consulta SQL",
  supabase_migracion: "Migración de base de datos",
  supabase_listar_tablas: "Listar tablas",
  supabase_secreto: "Guardar un secreto",
  github_crear_repo: "Crear repositorio",
  github_subir_archivo: "Subir archivo",
  github_crear_issue: "Crear incidencia",
  github_listar_ramas: "Listar ramas",
  http_generica: "Llamada web genérica",
};

export const ETIQUETA_ESTADO_ACCION: Record<EstadoAccion, string> = {
  borrador: "Borrador",
  pendiente_aprobacion: "Pendiente de aprobación",
  aprobada: "Aprobada",
  ejecutando: "Ejecutando",
  completada: "Completada",
  error: "Con error",
  cancelada: "Cancelada",
};

export const ETIQUETA_ENTORNO: Record<EntornoPreview, string> = {
  desarrollo: "Desarrollo",
  pruebas: "Pruebas",
  produccion: "Producción",
};

/** Fecha y hora exactas en el huso del navegador: 05/09/2026 22:41 */
export function marcaTiempo(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Solo la hora: 22:41 */
export function marcaHora(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function mismoDia(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
  );
}
