export type EstadoProyecto =
  | "pendiente"
  | "planificando"
  | "en_cola"
  | "ejecutando"
  | "esperando_revision"
  | "bloqueado"
  | "completado";

export type EstadoTarea =
  | "pendiente"
  | "en_cola"
  | "ejecutando"
  | "esperando_revision"
  | "bloqueada"
  | "completada";

export type Prioridad = "baja" | "media" | "alta" | "critica";

export type ModoEjecucion = "economico" | "equilibrado" | "maxima_calidad";

export interface Agente {
  id: string;
  nombre: string;
  proveedor: string;
  especialidades: string[];
  costeRelativo: 1 | 2 | 3 | 4 | 5;
  calidad: number; // 0-100
  rapidez: number; // 0-100
  disponibilidad: "disponible" | "ocupado" | "sin_configurar";
  tareasActivas: number;
  capacidad: number;
  permisos: string[];
  conectado: boolean;
}

export interface Tarea {
  id: string;
  proyectoId: string;
  titulo: string;
  estado: EstadoTarea;
  agenteId: string | null;
  prioridad: Prioridad;
  enviadaEl: string; // ISO
  estimacionHoras: number;
  horasConsumidas: number;
  costeEstimado: number;
  costeConsumido: number;
  progreso: number; // 0-100
  completadaPor?: string | undefined;
  completadaEl?: string | undefined;
  ultimaActividad: string;
}

export interface Mensaje {
  id: string;
  proyectoId: string;
  autor: "usuario" | "sistema" | "agente";
  agenteId?: string | undefined;
  texto: string;
  fecha: string;
}

export interface EventoActividad {
  id: string;
  proyectoId: string;
  tipo: "orden" | "resultado" | "decision" | "cambio" | "actividad" | "reorganizacion";
  texto: string;
  fecha: string;
}

export interface Preview {
  id: string;
  proyectoId: string;
  titulo: string;
  url: string;
  entorno: "desarrollo" | "pruebas" | "produccion";
}

export interface Proyecto {
  id: string;
  nombre: string;
  descripcion: string;
  estado: EstadoProyecto;
  prioridad: Prioridad;
  presupuesto: number;
  consumido: number;
  repositorio?: string | undefined;
  agentes: string[];
  alertas: string[];
  actualizadoEl: string;
}

export interface Integracion {
  id: string;
  nombre: string;
  tipo: "codigo" | "modelo" | "diseno" | "datos";
  conectada: boolean;
  proyectos: string[];
  secretos: { referencia: string; configurado: boolean }[];
  requiereAprobacion: boolean;
}

export interface Alerta {
  id: string;
  proyectoId: string | null;
  texto: string;
  nivel: "info" | "aviso" | "critico";
  requiereDecision: boolean;
}

export interface Aprobacion {
  id: string;
  proyectoId: string;
  texto: string;
  agenteId: string | null;
  equipo: string[];
  modo: ModoEjecucion;
  prioridad: Prioridad;
  costeEstimado: number;
  estimacionHoras: number;
  riesgo: "Bajo" | "Medio" | "Alto";
  calidadPrevista: number;
  motivo: string;
  estado: "pendiente" | "aprobada" | "rechazada";
  solicitadaEl: string;
  resueltaEl?: string | undefined;
  resueltaPor?: string | undefined;
  comentario?: string | undefined;
}
