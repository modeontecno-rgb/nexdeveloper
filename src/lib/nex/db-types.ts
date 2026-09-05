// Tipos del esquema real de la base de datos de NexDeveloper.
// Importante: en los INSERT nunca se incluye `user_id`: lo rellena la base de datos.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type EstadoProyecto =
  | "pendiente"
  | "planificando"
  | "en_cola"
  | "ejecutando"
  | "esperando_revision"
  | "bloqueado"
  | "completado"

export type EstadoTarea =
  | "pendiente"
  | "en_cola"
  | "ejecutando"
  | "esperando_revision"
  | "bloqueada"
  | "completada"
  | "cancelada"
  | "pausada"

export type EstadoOrden =
  | "borrador"
  | "pendiente_aprobacion"
  | "aprobada"
  | "rechazada"
  | "en_cola"
  | "ejecutando"
  | "completada"
  | "cancelada"

export type Prioridad = "baja" | "media" | "alta" | "critica"
export type ModoEjecucion = "economico" | "equilibrado" | "maxima_calidad"
export type RolAgente = "planificar" | "ejecutar" | "revisar"
export type Riesgo = "Bajo" | "Medio" | "Alto"
export type AutorMensaje = "usuario" | "agente" | "sistema"
export type TipoActividad =
  | "orden"
  | "resultado"
  | "decision"
  | "cambio"
  | "actividad"
  | "reorganizacion"
  | "aprobacion"
  | "sistema"
export type NivelAlerta = "info" | "aviso" | "critico"
export type TipoIntegracion = "codigo" | "modelo" | "diseno" | "datos" | "despliegue" | "otro"
export type UbicacionCredencial = "vault" | "supabase_secret" | "externo"
export type EntornoPreview = "desarrollo" | "pruebas" | "produccion"
export type Disponibilidad = "disponible" | "ocupado" | "sin_configurar"
export type TemaPerfil = "claro" | "oscuro" | "sistema"

export type PerfilRow = {
  id: string
  nombre_completo: string | null
  email: string | null
  avatar_url: string | null
  tema: TemaPerfil
}

export type AjustesRow = {
  user_id: string
  umbral_aprobacion_eur: number
  aprobar_si_prioridad_critica: boolean
  aprobar_si_riesgo_alto: boolean
  umbral_confianza_reorganizacion: number
  reorganizacion_automatica: boolean
  mesa_expertos_solo_importantes: boolean
  moneda: string
  actualizado_el: string | null
}

export type AgenteRow = {
  id: string
  user_id: string
  codigo: string
  nombre: string
  proveedor: string
  especialidades: string[]
  coste_relativo: number
  calidad: number
  rapidez: number
  seguridad: number
  disponibilidad: Disponibilidad
  capacidad: number
  permisos: string[]
  roles: RolAgente[]
  conectado: boolean
  activo: boolean
}

export type ProyectoRow = {
  id: string
  user_id: string
  slug: string
  nombre: string
  descripcion: string | null
  objetivo: string | null
  requisitos: string | null
  tecnologias: string | null
  estado: EstadoProyecto
  prioridad: Prioridad
  repositorio: string | null
  espacio_trabajo_url: string | null
  color: string | null
  es_favorito: boolean
  orden: number
  resumen_automatico: string | null
  resumen_actualizado_el: string | null
  creado_el: string
  actualizado_el: string
}

export type PresupuestoRow = {
  id: string
  user_id: string
  proyecto_id: string
  concepto: string
  importe_previsto: number
  importe_consumido: number
  moneda: string
  periodo: string | null
  notas: string | null
}

export type ChatRow = {
  id: string
  user_id: string
  proyecto_id: string | null
  titulo: string
  es_principal: boolean
  proyecto_origen_id: string | null
  reorganizado_el: string | null
  proveedor_id: string | null
  modelo_id: string | null
  experto_id: string | null
  resultado: ResultadoIa | null
}

export type MensajeRow = {
  id: string
  user_id: string
  chat_id: string
  proyecto_id: string | null
  autor: AutorMensaje
  agente_id: string | null
  texto: string
  adjuntos: Json | null
  tokens_entrada: number | null
  tokens_salida: number | null
  coste: number | null
  fecha: string
}

export type OrdenRow = {
  id: string
  user_id: string
  proyecto_id: string | null
  chat_id: string | null
  texto: string
  modo: ModoEjecucion
  prioridad: Prioridad
  agente_id: string | null
  equipo: string[] | null
  estado: EstadoOrden
  coste_estimado: number
  horas_estimadas: number
  riesgo: Riesgo
  calidad_prevista: number
  requiere_aprobacion: boolean
  motivo_aprobacion: string | null
  resuelta_el: string | null
  resuelta_por: string | null
  comentario: string | null
  proyecto_origen_id: string | null
  confianza_clasificacion: number | null
  reorganizada_el: string | null
  pendiente_confirmar_proyecto: boolean
  requiere_atencion: boolean
  creado_el: string
}


export type TareaRow = {
  id: string
  user_id: string
  proyecto_id: string
  orden_id: string | null
  tarea_padre_id: string | null
  titulo: string
  descripcion: string | null
  estado: EstadoTarea
  prioridad: Prioridad
  agente_id: string | null
  enviada_el: string | null
  estimacion_horas: number
  horas_consumidas: number
  coste_estimado: number
  coste_consumido: number
  progreso: number
  completada_por: string | null
  completada_el: string | null
  bloqueada_motivo: string | null
  ultima_actividad: string
  proyecto_origen_id: string | null
  orden: number
  requiere_atencion: boolean
  instrucciones: string | null
  motivo_atencion: string | null
  atendida_el: string | null
}


export type EstimacionRow = {
  id: string
  user_id: string
  proyecto_id: string | null
  tarea_id: string | null
  orden_id: string | null
  agente_id: string | null
  modo: ModoEjecucion
  horas_estimadas: number
  coste_estimado: number
  calidad_prevista: number
  riesgo: Riesgo
  horas_reales: number | null
  coste_real: number | null
  calidad_real: number | null
}

export type ActividadRow = {
  id: string
  user_id: string
  proyecto_id: string | null
  tipo: TipoActividad
  texto: string
  referencia_tabla: string | null
  referencia_id: string | null
  agente_id: string | null
  datos: Json | null
  fecha: string
}

export type AlertaRow = {
  id: string
  user_id: string
  proyecto_id: string | null
  texto: string
  nivel: NivelAlerta
  requiere_decision: boolean
  resuelta: boolean
  resuelta_el: string | null
  referencia_tabla: string | null
  referencia_id: string | null
}

export type IntegracionRow = {
  id: string
  user_id: string
  codigo: string
  nombre: string
  tipo: TipoIntegracion
  conectada: boolean
  requiere_aprobacion: boolean
  cuenta: string | null
  configuracion: Json | null
  ultima_comprobacion: string | null
  url_panel: string | null
  url_docs: string | null
  descripcion: string | null
  icono: string | null
  es_predefinida: boolean
  capacidades: string[] | null
}


export type CredencialRefRow = {
  id: string
  user_id: string
  integracion_id: string
  referencia: string
  ubicacion: UbicacionCredencial
  configurado: boolean
  pista: string | null
  ultima_rotacion: string | null
  caduca_el: string | null
  notas: string | null
}

export type ResultadoVerificacion = "correcto" | "error" | "sin_verificar"

export type PosicionPanel = {
  x: number
  y: number
  ancho: number
  alto: number
  anclado: boolean
}

export type PreviewRow = {
  id: string
  user_id: string
  proyecto_id: string
  titulo: string
  url: string
  entorno: EntornoPreview
  es_principal: boolean
  ultima_verificacion: string | null
  resultado_verificacion: ResultadoVerificacion
  detalle_verificacion: string | null
  captura_path: string | null
  posicion: Json | null
}

export type TipoAccion =
  | "supabase_sql"
  | "supabase_migracion"
  | "supabase_listar_tablas"
  | "supabase_secreto"
  | "github_crear_repo"
  | "github_subir_archivo"
  | "github_crear_issue"
  | "github_listar_ramas"
  | "http_generica"

export type EstadoAccion =
  | "borrador"
  | "pendiente_aprobacion"
  | "aprobada"
  | "ejecutando"
  | "completada"
  | "error"
  | "cancelada"

export type AccionRow = {
  id: string
  user_id: string
  proyecto_id: string | null
  tarea_id: string | null
  integracion_id: string | null
  tipo: TipoAccion
  titulo: string
  parametros: Json | null
  requiere_aprobacion: boolean
  estado: EstadoAccion
  resultado: Json | null
  error: string | null
  aprobada_el: string | null
  aprobada_por: string | null
  ejecutada_el: string | null
  creado_el: string
}

export type PlantillaAccionRow = {
  id: string
  user_id: string
  tipo: TipoAccion
  nombre: string
  descripcion: string | null
  parametros_por_defecto: Json | null
  requiere_aprobacion: boolean
  orden: number
}

export type TareaAtencionRow = {
  id: string
  proyecto_id: string
  proyecto_nombre: string | null
  agente_nombre: string | null
  titulo: string
  descripcion: string | null
  estado: EstadoTarea
  prioridad: Prioridad
  agente_id: string | null
  requiere_atencion: boolean
  instrucciones: string | null
  motivo_atencion: string | null
  atendida_el: string | null
  bloque: "requiere_atencion" | "desatendida"
  estimacion_horas: number
  horas_consumidas: number
  coste_estimado: number
  coste_consumido: number
  progreso: number
  ultima_actividad: string
}


export type ArchivoRow = {
  id: string
  user_id: string
  proyecto_id: string | null
  tarea_id: string | null
  mensaje_id: string | null
  nombre: string
  ruta_storage: string | null
  url_externa: string | null
  tipo_mime: string | null
  bytes: number | null
}

export type ConfiguracionAppRow = {
  clave: string
  valor: string
}

export type ResumenProyectoRow = {
  proyecto_id: string
  total_tareas: number
  completadas: number
  ejecutando: number
  pendientes: number
  esfuerzo_total: number
  esfuerzo_restante: number
  cuello_botella_horas: number
  coste_estimado: number
  coste_consumido: number
}

export type CargaAgenteRow = {
  agente_id: string
  nombre: string
  capacidad: number
  tareas_activas: number
  capacidad_libre: number
}

type SinUsuario<T> = Omit<T, "user_id">
type Tabla<Row, Ins = Partial<SinUsuario<Row>>, Upd = Partial<SinUsuario<Row>>> = {
  Row: Row
  Insert: Ins
  Update: Upd
  Relationships: []
}

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" }
  public: {
    Tables: {
      perfiles: Tabla<PerfilRow, Partial<PerfilRow> & { id: string }, Partial<PerfilRow>>
      ajustes: Tabla<AjustesRow>
      agentes: Tabla<AgenteRow>
      proyectos: Tabla<ProyectoRow, Partial<SinUsuario<ProyectoRow>> & { nombre: string; slug: string }>
      proyecto_agentes: Tabla<
        { user_id: string; proyecto_id: string; agente_id: string; rol: RolAgente },
        { proyecto_id: string; agente_id: string; rol?: RolAgente },
        { rol?: RolAgente }
      >
      presupuestos: Tabla<PresupuestoRow, Partial<SinUsuario<PresupuestoRow>> & { proyecto_id: string; concepto: string }>
      chats: Tabla<ChatRow, Partial<SinUsuario<ChatRow>> & { titulo: string }>
      mensajes: Tabla<MensajeRow, Partial<SinUsuario<MensajeRow>> & { chat_id: string; texto: string }>
      ordenes: Tabla<OrdenRow, Partial<SinUsuario<OrdenRow>> & { texto: string }>
      tareas: Tabla<TareaRow, Partial<SinUsuario<TareaRow>> & { proyecto_id: string; titulo: string }>
      estimaciones: Tabla<EstimacionRow>
      actividad: Tabla<ActividadRow, Partial<SinUsuario<ActividadRow>> & { tipo: TipoActividad; texto: string }>
      alertas: Tabla<AlertaRow, Partial<SinUsuario<AlertaRow>> & { texto: string }>
      integraciones: Tabla<IntegracionRow, Partial<SinUsuario<IntegracionRow>> & { codigo: string; nombre: string }>
      integracion_proyectos: Tabla<
        { user_id: string; integracion_id: string; proyecto_id: string; permisos: string[] },
        { integracion_id: string; proyecto_id: string; permisos?: string[] },
        { permisos?: string[] }
      >
      credenciales_ref: Tabla<
        CredencialRefRow,
        Partial<SinUsuario<CredencialRefRow>> & { integracion_id: string; referencia: string }
      >
      previews: Tabla<PreviewRow, Partial<SinUsuario<PreviewRow>> & { proyecto_id: string; titulo: string; url: string }>
      archivos: Tabla<ArchivoRow, Partial<SinUsuario<ArchivoRow>> & { nombre: string }>
      configuracion_app: Tabla<ConfiguracionAppRow>
      acciones: Tabla<AccionRow, Partial<SinUsuario<AccionRow>> & { tipo: TipoAccion; titulo: string }>

      plantillas_accion: Tabla<
        PlantillaAccionRow,
        Partial<SinUsuario<PlantillaAccionRow>> & { tipo: TipoAccion; nombre: string }
      >
    }
    Views: {
      v_resumen_proyecto: { Row: ResumenProyectoRow; Relationships: [] }
      v_carga_agentes: { Row: CargaAgenteRow; Relationships: [] }
      v_tareas_atencion: { Row: TareaAtencionRow; Relationships: [] }
    }

    Functions: {
      sugerir_proyecto: {
        Args: { p_texto: string }
        Returns: { proyecto_id: string; nombre: string; confianza: number }[]
      }
    }
    Enums: {
      estado_proyecto: EstadoProyecto
      estado_tarea: EstadoTarea
      estado_orden: EstadoOrden
      prioridad: Prioridad
      modo_ejecucion: ModoEjecucion
      rol_agente: RolAgente
      tipo_accion: TipoAccion
      estado_accion: EstadoAccion
    }
    CompositeTypes: { [_ in never]: never }
  }
}
