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
export type OrigenExperto = "propio" | "red" | "sugerido"
export type MomentoControl = "antes" | "despues" | "continuo"
export type OrigenEjecucionCalidad = "github_actions" | "manual" | "revision_orden"
export type EstadoEjecucionCalidad = "en_cola" | "ejecutando" | "verde" | "ambar" | "rojo" | "error"
export type ResultadoControl = "ok" | "aviso" | "fallo" | "omitido"
export type SemaforoCalidad = "verde" | "ambar" | "rojo" | "sin_datos"
export type GravedadHallazgo = "bloquea" | "aviso"

export type EstadoRepositorio = "pendiente" | "creado" | "con_codigo" | "error"
export type OrigenCodigoRepositorio = "vacio" | "carpeta_subida" | "lovable" | "externo"
export type EstadoSubidaRepositorio = "subiendo" | "ok" | "error"

export type RepositorioRow = {
  id: string
  user_id: string
  proyecto_id: string
  nombre_completo: string
  url: string
  privado: boolean
  rama_por_defecto: string
  estado: EstadoRepositorio
  origen_codigo: OrigenCodigoRepositorio
  ultimo_commit_sha: string | null
  ultimo_push_el: string | null
  error: string | null
  creado_el: string
}

export type RepositorioSubidaRow = {
  id: string
  repositorio_id: string
  archivos: number
  bytes: number
  commit_sha: string | null
  mensaje: string
  estado: EstadoSubidaRepositorio
  detalle: string | null
  creado_el: string
}

export type ControlCalidadRow = {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  herramienta: string
  que_evita: string
  momento: MomentoControl
  bloqueante: boolean
  orden: number
}

export type EjecucionCalidadRow = {
  id: string
  user_id: string
  proyecto_id: string
  version: string
  origen: OrigenEjecucionCalidad
  run_id_github: number | null
  url_run: string | null
  estado: EstadoEjecucionCalidad
  iniciada_el: string
  terminada_el: string | null
  duracion_seg: number | null
  resumen: Json | null
  creado_el: string
}

export type ResultadoCalidadRow = {
  id: string
  ejecucion_id: string
  control_codigo: string
  resultado: ResultadoControl
  detalle: string
  metrica: Json | null
  url_detalle: string | null
}

export type Hallazgo = {
  codigo: string
  gravedad: GravedadHallazgo
  mensaje: string
}

export type RevisionOrdenRow = {
  id: string
  user_id: string
  orden_id: string
  aprobada: boolean
  hallazgos: Hallazgo[]
  revisada_el: string
}
export type EstadoExperto = "propuesto" | "adoptado" | "descartado"

export type ExpertoRow = {
  id: string
  user_id: string
  slug: string
  nombre: string
  origen: OrigenExperto
  papel: string
  cuando_usarlo: string | null
  instrucciones: string | null
  modelo_aconsejado_id: string | null
  tareas: string[]
  muestra_url: string | null
  url_origen: string | null
  url_origen_publicado: string | null
  estado: EstadoExperto
  valoracion: number | null
  usos: number
  created_at: string
  updated_at: string
}

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
  palabras_clave: string[] | null
  version_actual: string | null
  proyectian_slug: string | null
  lovable_project_id: string | null
  semaforo_calidad: SemaforoCalidad
  ultima_ejecucion_calidad_id: string | null
  semaforo_salud: Semaforo
  salud_comprobada_el: string | null
  semaforo_infra: Semaforo | null
  semaforo_sincronizacion: Semaforo | null
  alias: string[] | null
  guia_estilo: string | null

  puntuacion_auditoria: number | null
  auditoria_el: string | null
  sentry_slug: string | null
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
  revision_id: string | null
  bloqueada_por_revision: boolean
  motivo_aprobacion: string | null
  resuelta_el: string | null
  resuelta_por: string | null
  comentario: string | null
  proyecto_origen_id: string | null
  confianza_clasificacion: number | null
  reorganizada_el: string | null
  pendiente_confirmar_proyecto: boolean
  requiere_atencion: boolean
  ejecucion_id: string | null
  ejecutar_con: "lovable" | "manual"
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
  proveedor_id: string | null
  modelo_id: string | null
  experto_id: string | null
  resultado: ResultadoIa | null
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

/* --------------------- Proveedores, modelos y trazabilidad -------------------- */

export type TipoProveedorIa = "texto" | "voz" | "imagen" | "busqueda" | "multi"
export type VelocidadModelo = "baja" | "media" | "alta" | "muy_alta"
export type EstrategiaEnrutado = "barato" | "rapido" | "mejor" | "aprendido"
export type ResultadoIa = "ok" | "aviso" | "error"
export type TareaIa =
  | "codigo"
  | "razonamiento"
  | "resumen"
  | "traduccion"
  | "clasificacion"
  | "busqueda"
  | "imagen"
  | "voz"
  | "vision"

/** Vista pública del proveedor: nunca incluye la clave, solo si la hay. */
export type ProveedorIaRow = {
  id: string
  user_id: string
  nombre: string
  clave_slug: string
  tipo: TipoProveedorIa
  activo: boolean
  tiene_clave: boolean
  url_base: string | null
  notas: string | null
  cuenta: string | null
  created_at: string
  updated_at: string
}

export type ModeloIaRow = {
  id: string
  user_id: string
  proveedor_id: string
  identificador: string
  nombre: string
  activo: boolean
  coste_entrada: number | null
  coste_salida: number | null
  velocidad: VelocidadModelo
  contexto_max: number | null
  calidad: number | null
  tareas_aconsejadas: string[]
  notas: string | null
  created_at: string
}

export type RendimientoModeloRow = {
  user_id: string
  tarea: string
  modelo_id: string
  trabajos: number
  porcentaje_ok: number
  coste_medio: number
  duracion_media_ms: number
  ultimo_uso: string
}

export type PoliticaEnrutadoRow = {
  id: string
  user_id: string
  tarea: string
  estrategia: EstrategiaEnrutado
  modelo_preferido_id: string | null
  modelo_respaldo_id: string | null
  updated_at: string
}

export type ConsumoIaRow = {
  id: string
  user_id: string
  proyecto_id: string | null
  chat_id: string | null
  mensaje_id: string | null
  tarea_id: string | null
  proveedor_id: string | null
  modelo_id: string | null
  experto_id: string | null
  tokens_entrada: number
  tokens_salida: number
  coste: number
  duracion_ms: number
  resultado: ResultadoIa
  created_at: string
}

// ---- Copias de seguridad (0.9.0) ----
export type TipoDestinoCopia = "s3" | "webdav"
export type TipoOrigenCopia = "base_datos" | "repositorio"
export type OrigenCopia = "manual" | "diaria" | "semanal"
export type EstadoCopia = "pendiente" | "en_curso" | "ok" | "error"

export type CopiaDestinoRow = {
  id: string
  user_id: string
  nombre: string
  tipo: TipoDestinoCopia
  url_servidor: string | null
  bucket: string | null
  region: string | null
  ruta_prefijo: string | null
  usuario: string | null
  activo: boolean
  es_predeterminado: boolean
  ultima_prueba: string | null
  resultado_prueba: string | null
  notas: string | null
  usar_para_documentos?: boolean
  tiene_secreto?: boolean
}

export type CopiaConfigRow = {
  id: string
  user_id: string
  destino_id: string | null
  auto_activa: boolean
  diaria: boolean
  hora_diaria: string
  semanal: boolean
  dia_semanal: number
  retener_diarias: number
  retener_semanales: number
  bases_datos_todas: boolean
  bases_datos_seleccion: string[]
  repositorios_todos: boolean
  repositorios_seleccion: string[]
  aviso_dias: number
  ultima_auto: string | null
}

export type CopiaOrigenRow = {
  id: string
  user_id: string
  tipo: TipoOrigenCopia
  objetivo: string
  nombre: string
  detalle: Json
  proyecto_id: string | null
}

export type CopiaRow = {
  id: string
  user_id: string
  lote_id: string
  tipo: TipoOrigenCopia
  origen: OrigenCopia
  objetivo: string
  nombre: string
  estado: EstadoCopia
  ruta_remota: string | null
  bytes: number | null
  num_tablas: number | null
  num_filas: number | null
  error: string | null
  iniciada_el: string | null
  terminada_el: string | null
  creado_el: string
}

// ---- Restauración de copias (0.22.0) ----
export type TipoRestauracion = "base_datos" | "repositorio" | "prueba"
export type OrigenRestauracion = "manual" | "programado"
export type ModoRestauracion = "solo_datos" | "esquema_y_datos" | "simulada" | "rama"
export type EstadoRestauracion =
  | "en_cola"
  | "preparando"
  | "restaurando"
  | "completada"
  | "error"
  | "cancelada"

export type ProgresoRestauracion = {
  tablas_total?: number
  tablas_hechas?: number
  filas_total?: number
  filas_hechas?: number
  archivos_total?: number
  archivos_hechos?: number
  avisos?: string[]
}

export type RestauracionRow = {
  id: string
  user_id: string
  copia_id: string | null
  proyecto_id: string | null
  tipo: TipoRestauracion
  origen: OrigenRestauracion
  ruta_remota: string | null
  destino: string | null
  rama: string | null
  modo: ModoRestauracion
  estado: EstadoRestauracion
  paso: string | null
  progreso: ProgresoRestauracion | null
  resultado: Json
  copia_previa: string | null
  error: string | null
  iniciada_el: string | null
  terminada_el: string | null
  creado_el: string
}

export type RestauracionConfigRow = {
  id: string
  user_id: string
  sandbox_ref: string | null
  prueba_mensual: boolean
  dia_prueba: number
  proyecto_prueba_id: string | null
}

// ---- Avisos push (0.23.0) ----

export type TipoAviso =
  | "tarea_atencion"
  | "aprobacion"
  | "compilacion"
  | "dominio"
  | "presupuesto"
  | "salud"
  | "copias"
  | "ejecucion"
  | "prueba"
  | "otro"

export type AvisoRow = {
  id: string
  user_id: string
  tipo: TipoAviso
  titulo: string
  cuerpo: string | null
  url: string | null
  proyecto_id: string | null
  referencia: string | null
  leido: boolean
  enviado: boolean
  enviado_el: string | null
  enviados: number
  resultado: string | null
  creado_el: string
}

export type AvisoSuscripcionRow = {
  id: string
  user_id: string
  endpoint: string
  dispositivo: string | null
  agente: string | null
  activa: boolean
  ultimo_envio: string | null
  ultimo_error: string | null
  creado_el: string
}

export type AvisosConfigRow = {
  id: string
  user_id: string
  activo: boolean
  tipos: Record<string, boolean> | null
  silencio_desde: string | null
  silencio_hasta: string | null
}

// ---- Asistente de cartera (0.24.0) ----
export type RolMensajeAsistente = "usuario" | "asistente"

export type HerramientaAsistente = {
  nombre: string
  entrada?: unknown
  salida_resumen?: string | null
}

export type AccionAsistente = {
  tipo: "tarea" | "orden" | "aviso"
  id?: string | null
  titulo?: string | null
  url?: string | null
}

export type AsistenteConversacionRow = {
  id: string
  user_id: string
  titulo: string | null
  proyecto_id: string | null
  fijada: boolean
  tokens_entrada: number | null
  tokens_salida: number | null
  coste: number | null
  creado_el: string
  actualizado_el: string
}

export type AsistenteMensajeRow = {
  id: string
  user_id: string
  conversacion_id: string
  rol: RolMensajeAsistente
  texto: string
  herramientas: HerramientaAsistente[] | null
  acciones: AccionAsistente[] | null
  proveedor: string | null
  modelo: string | null
  tokens_entrada: number | null
  tokens_salida: number | null
  coste: number | null
  duracion_ms: number | null
  error: string | null
  creado_el: string
}




// ---- Compilaciones (0.10.0) ----
export type HerramientaCompilacion = "capacitor" | "flutter" | "tauri" | "web"
export type PlataformaCompilacion = "android" | "ios" | "escritorio" | "web"
export type EstadoCompilacion = "pendiente" | "enviada" | "en_curso" | "ok" | "error" | "cancelada"

export type PlantillaCompilacionRow = {
  id: string
  herramienta: HerramientaCompilacion
  plataforma: PlataformaCompilacion
  nombre: string
  descripcion: string | null
  archivo_workflow: string
  yaml: string
  secretos_firma: string[]
  ejecutor: string | null
  minutos_estimados: number | null
  orden: number
}

export type CompilacionRow = {
  id: string
  user_id: string
  proyecto_id: string
  repositorio: string | null
  rama: string
  plantilla_id: string
  plataforma: PlataformaCompilacion
  herramienta: HerramientaCompilacion
  version: string
  firmada: boolean
  estado: EstadoCompilacion
  run_id_github: string | null
  url_run: string | null
  artefacto_nombre: string | null
  artefacto_bytes: number | null
  artefacto_url_github: string | null
  ruta_remota: string | null
  destino_id: string | null
  log_resumen: string | null
  error: string | null
  notas: string | null
  duracion_seg: number | null
  enviada_el: string | null
  iniciada_el: string | null
  terminada_el: string | null
  creado_el: string
  actualizado_el: string
}

export type FirmaCompilacionRow = {
  id: string
  user_id: string
  proyecto_id: string
  plataforma: PlataformaCompilacion
  secretos_puestos: string[]
  actualizado_el: string
}

export type CompilacionUltimaRow = {
  proyecto_id: string
  plataforma: PlataformaCompilacion
  id: string
  version: string
  estado: EstadoCompilacion
  url_run: string | null
  artefacto_nombre: string | null
  terminada_el: string | null
  creado_el: string
}

export type TipoDominio = "dominio" | "subdominio" | "externo"
export type ResultadoDominio = "ok" | "aviso" | "error" | "sin_comprobar"

export type DominioRow = {
  id: string
  user_id: string
  proyecto_id: string | null
  dominio: string
  tipo: TipoDominio
  registrador: string | null
  gestionado_por: string | null
  activo: boolean
  aviso_dias: number
  pendiente: boolean
  ip_resuelta: string | null
  dns_ok: boolean | null
  http_estado: number | null
  https_ok: boolean | null
  tiempo_ms: number | null
  cert_emisor: string | null
  cert_valido_hasta: string | null
  cert_dias: number | null
  dominio_caduca: string | null
  dominio_dias: number | null
  resultado: ResultadoDominio
  error: string | null
  ultima_comprobacion: string | null
  avisado_el: string | null
  tarea_id: string | null
  notas: string | null
  creado_el: string
  actualizado_el: string
}

export type DominioHistorialRow = {
  id: string
  dominio_id: string
  comprobado_el: string
  resultado: ResultadoDominio
  http_estado: number | null
  https_ok: boolean | null
  tiempo_ms: number | null
  cert_dias: number | null
  dominio_dias: number | null
  error: string | null
}

export type DominiosResumenRow = {
  total: number
  ok: number
  aviso: number
  error: number
  cert_dias_min: number | null
  dominio_dias_min: number | null
  ultima_comprobacion: string | null
}

/* ------------------------------ Bandeja única ------------------------------ */

export type OrigenBandeja = "gmail" | "whatsapp" | "plaud" | "manual"
export type EstadoEntradaBandeja = "nueva" | "clasificada" | "convertida" | "archivada" | "descartada"

export type BandejaFuenteRow = {
  id: string
  origen: "gmail" | "whatsapp" | "plaud"
  activa: boolean
  cuenta: string | null
  configuracion: Json
  conectada: boolean
  ultima_sincronizacion: string | null
  resultado: string | null
}

export type PropuestaTarea = {
  titulo?: string
  descripcion?: string
  prioridad?: Prioridad
  requiere_atencion?: boolean
  instrucciones?: string
}

export type AdjuntoBandeja = { nombre: string; tipo?: string; bytes?: number }

export type BandejaEntradaRow = {
  id: string
  user_id: string
  origen: OrigenBandeja
  id_externo: string | null
  remitente: string | null
  remitente_nombre: string | null
  asunto: string | null
  texto: string | null
  resumen: string | null
  fecha: string | null
  proyecto_id: string | null
  proyecto_confianza: number | null
  proyecto_confirmado: boolean
  propuesta: PropuestaTarea | null
  estado: EstadoEntradaBandeja
  tarea_id: string | null
  adjuntos: AdjuntoBandeja[] | null
  url_original: string | null
  datos: Json
  creado_el: string
}

type SinUsuario<T> = Omit<T, "user_id">



type Tabla<Row, Ins = Partial<SinUsuario<Row>>, Upd = Partial<SinUsuario<Row>>> = {
  Row: Row
  Insert: Ins
  Update: Upd
  Relationships: []
}

// ---- Vigilancia (0.11.0) ----
export type TipoVigilancia = "novedades" | "competencia"
export type OrigenVigilancia = "manual" | "programado"
export type EstadoLoteVigilancia = "en_curso" | "ok" | "error"
export type TipoHallazgoVigilancia = "novedad" | "competencia"
export type CategoriaHallazgoVigilancia =
  | "version"
  | "seguridad"
  | "funcionalidad"
  | "precio"
  | "fin_de_soporte"
  | "ia"
  | "otro"
  | "nuevo_competidor"
  | "noticia"
export type RelevanciaVigilancia = "alta" | "media" | "baja"
export type EstadoHallazgoVigilancia = "nuevo" | "visto" | "descartado" | "convertido"

export type VigilanciaConfigRow = {
  proyecto_id: string
  user_id: string
  activa: boolean
  novedades_activas: boolean
  competencia_activa: boolean
  tecnologias: string[]
  temas_extra: string[]
  sector: string | null
  competidores_conocidos: string[]
  idioma: string | null
  ultima_novedades: string | null
  ultima_competencia: string | null
}

export type VigilanciaLoteRow = {
  id: string
  user_id: string
  proyecto_id: string
  tipo: TipoVigilancia
  origen: OrigenVigilancia
  estado: EstadoLoteVigilancia
  proveedor: string | null
  modelo: string | null
  tokens_entrada: number | null
  tokens_salida: number | null
  coste: number | null
  busquedas: number | null
  resumen: string | null
  error: string | null
  hallazgos: number | null
  iniciado_el: string | null
  terminado_el: string | null
}

export type VigilanciaHallazgoRow = {
  id: string
  user_id: string
  proyecto_id: string
  lote_id: string | null
  tipo: TipoHallazgoVigilancia
  categoria: CategoriaHallazgoVigilancia
  titulo: string
  resumen: string | null
  por_que_afecta: string | null
  accion_sugerida: string | null
  fuente_url: string | null
  fuente_nombre: string | null
  fecha_fuente: string | null
  relevancia: RelevanciaVigilancia
  competidor_id: string | null
  estado: EstadoHallazgoVigilancia
  tarea_id: string | null
  creado_el: string
}

export type PlanCompetidor = { nombre?: string; precio?: string | number; periodo?: string; notas?: string }

export type CompetidorRow = {
  id: string
  user_id: string
  proyecto_id: string
  nombre: string
  url: string | null
  pais: string | null
  descripcion: string | null
  precio_desde: string | null
  planes: PlanCompetidor[] | null
  puntos_fuertes: string[]
  puntos_debiles: string[]
  origen: "radar" | "manual"
  seguir: boolean
  ultima_revision: string | null
  ultimo_cambio: string | null
  notas: string | null
}

export type VigilanciaResumenRow = {
  proyecto_id: string
  nombre: string
  activa: boolean
  ultima_novedades: string | null
  ultima_competencia: string | null
  nuevos: number
  nuevos_alta: number
  competidores: number
}

// ---- Resúmenes (0.14.0) ----
export type TipoResumen = "diario" | "semanal"
export type CanalResumen = "correo" | "whatsapp"

export type IncluirResumen = {
  atencion?: boolean
  desatendidas?: boolean
  compilaciones?: boolean
  vigilancia?: boolean
  dominios?: boolean
  copias?: boolean
  bandeja?: boolean
  calidad?: boolean
  consumo_ia?: boolean
  actividad?: boolean
}

export type ResumenesConfigRow = {
  id: string
  user_id: string
  diario_activo: boolean
  semanal_activo: boolean
  canales: CanalResumen[]
  correo_destino: string | null
  whatsapp_destino: string | null
  incluir: IncluirResumen | null
  usar_ia: boolean
}

export type CifrasResumen = {
  requieren_atencion?: number
  dominios_con_aviso?: number
  copias_error?: number
  hallazgos_vigilancia?: number
  bandeja_pendiente?: number
  proyectos_calidad_rojo?: number
  coste_ia_eur?: number
  llamadas_ia?: number
  completadas?: number
  compilaciones?: number
  [clave: string]: number | undefined
}

export type ResumenRow = {
  id: string
  user_id: string
  tipo: TipoResumen
  fecha: string
  periodo_desde: string | null
  periodo_hasta: string | null
  titulo: string
  contenido_md: string | null
  contenido_html: string | null
  datos: CifrasResumen | null
  redactado_por: string | null
  enviado_por: string[] | null
  enviado_el: string | null
  error_envio: string | null
  leido: boolean
  creado_el: string
}

// ---- Gasto de IA (0.15.0) ----
export type ProveedorGastoIa =
  | "anthropic"
  | "openai"
  | "google"
  | "groq"
  | "lovable"
  | "elevenlabs"
  | "fal"
  | "otro"

export type FuenteGastoIa = "interno" | "anthropic_admin" | "openai_admin" | "manual"

export type GastoIaDiarioRow = {
  id: string
  user_id: string
  fecha: string
  proveedor: ProveedorGastoIa
  fuente: FuenteGastoIa
  proyecto_id: string | null
  modelo: string | null
  tokens_entrada: number
  tokens_salida: number
  llamadas: number
  creditos: number
  coste: number
  detalle: Json | null
}

export type PeriodicidadGastoIa = "unico" | "mensual"

export type GastoIaManualRow = {
  id: string
  user_id: string
  fecha: string
  proveedor: ProveedorGastoIa
  concepto: string
  proyecto_id: string | null
  creditos: number
  importe: number
  periodicidad: PeriodicidadGastoIa
  notas: string | null
}

export type AmbitoPresupuestoIa = "global" | "proveedor" | "proyecto"
export type AccionPresupuestoIa = "avisar" | "bloquear"

export type PresupuestoIaRow = {
  id: string
  user_id: string
  ambito: AmbitoPresupuestoIa
  referencia: string | null
  limite_mensual: number
  aviso_pct: number
  accion: AccionPresupuestoIa
  activo: boolean
  avisado_mes: string | null
  bloqueado: boolean
}

export type GastoIaConfigRow = {
  id: string
  user_id: string
  moneda: string
  tipo_cambio_usd: number
  precio_credito_lovable: number | null
}

export type GastoIaMesRow = {
  mes: string
  proveedor: ProveedorGastoIa
  coste: number
  tokens: number
  llamadas: number
  creditos: number
  real_facturado: boolean
}

export type GastoIaProyectoMesRow = {
  mes: string
  proyecto_id: string | null
  proyecto: string | null
  coste: number
  tokens: number
  llamadas: number
}

export type GastoIaEstadoRow = {
  presupuesto_id: string
  ambito: AmbitoPresupuestoIa
  referencia: string | null
  limite_mensual: number
  aviso_pct: number
  accion: AccionPresupuestoIa
  bloqueado: boolean
  gastado_mes: number
}

// ---- Documentación y cierre de versión (0.16.0) ----
export type TipoCambioVersion =
  | "nueva_funcion"
  | "arreglo"
  | "diseno"
  | "seguridad"
  | "rendimiento"
  | "datos"
  | "documentacion"
  | "despliegue"
  | "otro"

export type ImportanciaCambio = "alta" | "media" | "baja"

export type CambioVersion = {
  tipo: TipoCambioVersion
  titulo: string
  descripcion?: string | null
  motivo?: string | null
  importancia: ImportanciaCambio
}

export type EstadoCierre = "borrador" | "cerrada" | "error"

export type CierreVersionRow = {
  id: string
  user_id: string
  proyecto_id: string
  version: string
  titulo: string | null
  resumen: string | null
  cambios: CambioVersion[] | null
  como_probar: string[] | null
  pendiente_usuario: string[] | null
  tecnico: string[] | null
  estado: EstadoCierre
  hoja_md: string | null
  hoja_html: string | null
  ruta_remota_html: string | null
  ruta_remota_md: string | null
  proyectian_version_id: string | null
  proyectian_ok: boolean
  github_tag: string | null
  github_changelog: boolean
  ruta_mac: string | null
  redactado_por: string | null
  error: string | null
  creado_el: string
  cerrada_el: string | null
}

export type TipoDocumentoNex =
  | "hoja_cambios"
  | "manual"
  | "comercial"
  | "informe"
  | "video"
  | "imagen"
  | "otro"

export type DocumentoNexRow = {
  id: string
  user_id: string
  proyecto_id: string
  tipo: TipoDocumentoNex
  titulo: string
  version: string | null
  nombre_archivo: string
  mime: string | null
  bytes: number | null
  ruta_remota: string | null
  origen: string | null
  ruta_mac: string | null
  creado_el: string
}

/* -------------------------- Manuales (0.25.0) --------------------------- */

export type PublicoManual = "usuario" | "administrador" | "comercial"
export type EstadoManual = "borrador" | "preparando" | "redactando" | "publicando" | "listo" | "error"

export type CapituloManual = {
  orden: number
  titulo: string
  ruta?: string | null
  objetivo?: string | null
  elementos?: string[] | null
  captura_url?: string | null
  texto_md?: string | null
}

export type ManualRow = {
  id: string
  user_id: string
  proyecto_id: string
  titulo: string
  publico: PublicoManual
  version_proyecto: string | null
  estado: EstadoManual
  paso: string | null
  esquema: { titulo?: string; capitulos?: CapituloManual[] } | null
  capitulos: CapituloManual[] | null
  introduccion_md: string | null
  html: string | null
  markdown: string | null
  ruta_remota_html: string | null
  ruta_remota_md: string | null
  documento_id: string | null
  tokens_entrada: number | null
  tokens_salida: number | null
  coste: number | null
  error: string | null
  creado_el: string
  actualizado_el: string
}

export type ManualesConfigRow = {
  id: string
  user_id: string
  regenerar_al_cambiar_version: boolean
  estilo: "claro" | "tecnico"
  incluir_capturas: boolean
  servicio_capturas: string | null
  max_capitulos: number
}

/* ------------------------- Auditoría mensual (0.26.0) -------------------- */

export type EstadoAuditoria = "pendiente" | "analizando" | "terminada" | "error"
export type SeveridadHallazgoAuditoria = "critica" | "alta" | "media" | "baja"
export type AreaAuditoria = "accesibilidad" | "rendimiento" | "seguridad" | "textos" | "codigo" | "datos"

export type PuntuacionesAuditoria = Partial<Record<AreaAuditoria, number>>

export type HallazgoAuditoria = {
  area: AreaAuditoria | string
  severidad: SeveridadHallazgoAuditoria
  titulo: string
  detalle?: string | null
  donde?: string | null
  solucion?: string | null
  tarea_id?: string | null
}

export type AuditoriaRow = {
  id: string
  user_id: string
  lote: string
  proyecto_id: string
  origen: string | null
  estado: EstadoAuditoria
  paso: string | null
  puntuacion: number | null
  semaforo: Semaforo
  resumen: string | null
  puntuaciones: PuntuacionesAuditoria | null
  hallazgos: HallazgoAuditoria[] | null
  material: Record<string, Json> | null
  tareas_creadas: number | null
  tokens_entrada: number | null
  tokens_salida: number | null
  coste: number | null
  error: string | null
  creado_el: string
  terminada_el: string | null
}

export type AuditoriaConfigRow = {
  id: string
  user_id: string
  activa: boolean
  dia_mes: number
  areas: Partial<Record<AreaAuditoria, boolean>> | null
  crear_tareas: boolean
  solo_criticas_y_altas: boolean
  max_hallazgos_por_proyecto: number
  proyectos_excluidos: string[] | null
}

/* ------------------ Usuarios de clientes (0.27.0) ------------------------ */

export type UsuarioClienteRow = {
  id: string
  user_id: string
  proyecto_id: string
  supabase_ref: string | null
  auth_id: string
  email: string
  telefono: string | null
  nombre: string | null
  rol: string | null
  confirmado: boolean
  bloqueado: boolean
  bloqueado_hasta: string | null
  proveedor: string | null
  creado_en_app: string | null
  ultimo_acceso: string | null
  metadatos: Record<string, Json> | null
  sincronizado_el: string | null
}

export type ResultadoAccionUsuario = "ok" | "error"

export type UsuarioAccionRow = {
  id: string
  user_id: string
  proyecto_id: string | null
  accion: string
  email: string | null
  auth_id: string | null
  resultado: ResultadoAccionUsuario
  detalle: string | null
  proyectian: boolean | null
  creado_el: string
}

/* ----------------------- Modo cliente / portales (0.28.0) ---------------- */

export type MarcaPortal = {
  nombre?: string
  color?: string
  logo_url?: string
  powered_by?: string
  mensaje_bienvenida?: string
  email_contacto?: string
}

export type SeccionesPortal = {
  version?: boolean
  cambios?: boolean
  documentos?: boolean
  peticiones?: boolean
  estado?: boolean
  contacto?: boolean
}

export type PortalClienteRow = {
  id: string
  user_id: string
  proyecto_id: string
  token: string
  nombre_cliente: string | null
  contacto_email: string | null
  marca: MarcaPortal | null
  secciones: SeccionesPortal | null
  activo: boolean
  expira_el: string | null
  visitas: number
  ultimo_acceso: string | null
  creado_el: string
  actualizado_el: string | null
}

export type TipoPeticionPortal = "peticion" | "incidencia" | "pregunta"
export type EstadoPeticionPortal = "nueva" | "vista" | "en_curso" | "hecha" | "descartada"

export type PortalPeticionRow = {
  id: string
  user_id: string
  portal_id: string
  proyecto_id: string
  texto: string
  contacto: string | null
  tipo: TipoPeticionPortal
  estado: EstadoPeticionPortal
  respuesta: string | null
  respondida_el: string | null
  tarea_id: string | null
  creado_el: string
}







/* ------------- Facturación con EvoluteIA (0.32.0) ------------- */

export type ContratoCliente = "horas" | "mensual" | "fijo" | "sin_facturar"
export type OrigenHoras = "manual" | "cronometro" | "tarea" | "ejecucion"

/** Estados de los documentos de venta en EvoluteIA. */
export type EstadoFacturaEvoluteia =
  | "borrador"
  | "emitido"
  | "enviado"
  | "cobrado"
  | "vencido"
  | "anulado"

export type LineaFacturaEvoluteia = {
  id?: string
  concepto?: string | null
  descripcion?: string | null
  cantidad?: number | null
  precio?: number | null
  importe?: number | null
  base?: number | null
}

export type FacturacionConfigRow = {
  id: string
  user_id: string
  modo: string | null
  tarifa_hora: number
  refacturar_ia: boolean
  recargo_ia_pct: number
  redondeo_min: number
  generar_borradores_mes: boolean
  evoluteia_ref: string | null
  evoluteia_url: string | null
  evoluteia_tenant_id: string | null
  evoluteia_empresa_id: string | null
  evoluteia_sede_id: string | null
  evoluteia_impuesto_id: string | null
  evoluteia_forma_pago_id: string | null
  evoluteia_usuario: string | null
}

export type FacturacionClienteRow = {
  id: string
  user_id: string
  proyecto_id: string
  tercero_id: string | null
  contrato_id: string | null
  tercero_codigo: string | null
  sincronizado_el: string | null
  nombre_fiscal: string | null
  nif: string | null
  direccion: string | null
  email: string | null
  telefono: string | null
  contrato: ContratoCliente
  cuota_mensual: number | null
  horas_incluidas: number | null
  importe_fijo: number | null
  tarifa_hora: number | null
  refacturar_ia: boolean | null
  notas: string | null
}

export type HoraRegistroRow = {
  id: string
  user_id: string
  proyecto_id: string
  tarea_id: string | null
  ejecucion_id: string | null
  fecha: string
  inicio: string | null
  fin: string | null
  horas: number
  descripcion: string | null
  origen: OrigenHoras
  facturable: boolean
  evoluteia_documento_id: string | null
  evoluteia_numero: string | null
  creado_el: string
}

/** Caché local de las facturas que viven en EvoluteIA. */
export type FacturaEvoluteiaRow = {
  documento_id: string
  user_id: string
  proyecto_id: string | null
  proyectos?: { nombre: string; slug?: string | null; color?: string | null } | null
  tercero_id: string | null
  cliente?: string | null
  numero: string | null
  fecha: string | null
  estado: EstadoFacturaEvoluteia
  base: number
  cuota_iva: number
  total: number
  pendiente: number
  vencido: boolean
  verifactu: boolean
  horas: number
  coste_ia: number
  origen: "nexdeveloper" | "evoluteia"
  url: string | null
}


/* ------------------------------ Habilidades ------------------------------ */

export type OrigenHabilidad = "propia" | "experto" | "externa"
export type CategoriaHabilidad =
  | "diseno"
  | "backend"
  | "datos"
  | "documentos"
  | "comercial"
  | "calidad"
  | "devops"
  | "ia"
  | "gestion"
  | "otro"
export type EstadoHabilidad = "activa" | "candidata" | "archivada"

export type ArchivoHabilidad = { ruta: string; bytes?: number }

export type HabilidadRow = {
  id: string
  user_id: string
  slug: string
  nombre: string
  origen: OrigenHabilidad
  categoria: CategoriaHabilidad
  descripcion: string | null
  cuando_usarla: string | null
  contenido_md: string | null
  archivos: ArchivoHabilidad[] | null
  muestra_url: string | null
  muestra_texto: string | null
  repositorio: string | null
  ruta_repo: string | null
  url_origen: string | null
  etiquetas: string[]
  estado: EstadoHabilidad
  valoracion: number | null
  usos: number
  ultimo_uso: string | null
  sincronizada_el: string | null
}

export type HabilidadUsoRow = {
  id: string
  habilidad_id: string
  proyecto_id: string | null
  tarea_id: string | null
  instrucciones: string | null
  creado_el: string
}

export type HabilidadesConfigRow = {
  id: string
  user_id: string
  repo_propias: string | null
  repo_externas: string | null
  barrido_activo: boolean
  temas_barrido: string[]
  ultimo_barrido: string | null
  ultima_sincronizacion: string | null
}

export type HabilidadesResumenRow = {
  propias: number
  expertos: number
  externas: number
  candidatas: number
  usos: number
  sincronizada_el: string | null
}

/* --------------------------- Voz y vídeos demo --------------------------- */

export type EstadoGuionDemo = "borrador" | "listo"
export type EstadoLocucion = "pendiente" | "generando" | "ok" | "error"

export type EscenaGuion = {
  orden: number
  titulo: string
  texto: string
  url_pantalla?: string | null
  captura_url?: string | null
  duracion_seg?: number | null
}

export type GuionDemoRow = {
  id: string
  user_id: string
  proyecto_id: string
  titulo: string
  publico: string | null
  duracion_objetivo_seg: number | null
  escenas: EscenaGuion[] | null
  generado_por: string | null
  estado: EstadoGuionDemo
  creado_el: string
}

export type LocucionRow = {
  id: string
  user_id: string
  proyecto_id: string | null
  guion_id: string | null
  escena: number | null
  titulo: string | null
  texto: string | null
  voz_id: string | null
  voz_nombre: string | null
  modelo: string | null
  estado: EstadoLocucion
  ruta_remota: string | null
  bytes: number | null
  caracteres: number | null
  duracion_seg: number | null
  error: string | null
  creado_el: string
  terminada_el: string | null
}

export type VozConfigRow = {
  id: string
  user_id: string
  voz_id: string | null
  voz_nombre: string | null
  modelo: string | null
  estabilidad: number | null
  similitud: number | null
  estilo: number | null
  velocidad: number | null
  servicio_capturas: string | null
}

export type ModoMesa = "economico" | "equilibrado" | "maxima_calidad"
export type EstadoMesa = "preparada" | "deliberando" | "concluida" | "error"
export type RolMesa = "planificar" | "opinar" | "revisar"
export type RolIntervencion = RolMesa | "sintesis"

export type ParticipanteMesa = {
  rol: RolMesa
  experto_slug: string
  experto_nombre: string
  proveedor: string
  modelo: string
  motivo?: string | null
}

export type PasoPlanMesa = {
  orden: number
  titulo: string
  descripcion?: string | null
  responsable?: string | null
  horas?: number | null
  requiere_atencion?: boolean | null
}

export type RecomendacionMesa = {
  equipo?: { planificar?: string | null; ejecutar?: string | null; revisar?: string | null } | null
  plan?: PasoPlanMesa[] | null
  riesgos?: string[] | null
  coste_estimado?: number | null
  horas_estimadas?: number | null
  calidad_prevista?: number | null
  riesgo?: string | null
  requiere_aprobacion?: boolean | null
  motivo?: string | null
}

export type MesaRow = {
  id: string
  user_id: string
  proyecto_id: string | null
  orden_id: string | null
  tarea_id: string | null
  titulo: string | null
  pregunta: string
  contexto: string | null
  modo: ModoMesa
  estado: EstadoMesa
  participantes: ParticipanteMesa[] | null
  recomendacion: RecomendacionMesa | null
  sintesis: string | null
  tokens_entrada: number | null
  tokens_salida: number | null
  coste: number | null
  error: string | null
  creado_el: string
  concluida_el: string | null
}

export type MesaIntervencionRow = {
  id: string
  user_id: string
  mesa_id: string
  orden: number
  rol: RolIntervencion
  experto_nombre: string | null
  proveedor: string | null
  modelo: string | null
  texto: string | null
  tokens: number | null
  coste: number | null
  creado_el: string
}

export type MesaValoracionRow = {
  id: string
  user_id: string
  mesa_id: string
  valoracion: number
  comentario: string | null
  creado_el: string
}

// ---- Ejecución real de las órdenes (0.20.0) ----
export type EstadoEjecucion =
  | "en_cola"
  | "enviando"
  | "construyendo"
  | "comprobando"
  | "esperando_aprobacion"
  | "publicando"
  | "completada"
  | "error"
  | "cancelada"
export type MotorEjecucion = "lovable" | "claude" | "auto"
export type ModoTrabajoEjecucion = "construir" | "planificar"
export type EstadoConexionLovable = "desconectada" | "conectada" | "error"

export type EjecucionOrdenRow = {
  id: string
  user_id: string
  orden_id: string | null
  proyecto_id: string | null
  tarea_id: string | null
  estado: EstadoEjecucion
  motor: MotorEjecucion
  modo: ModoTrabajoEjecucion
  texto: string | null
  mensaje_id: string | null
  thread_id: string | null
  commit_sha: string | null
  respuesta: string | null
  resumen: string | null
  coste_creditos: number | null
  coste_ia: number | null
  tokens_entrada: number | null
  tokens_salida: number | null
  pasos: number | null
  rama: string | null
  pr_url: string | null
  pr_numero: number | null
  preview_url: string | null
  preview_ok: boolean | null
  publicado_url: string | null
  error: string | null
  intentos: number | null
  iniciada_el: string | null
  terminada_el: string | null
  aprobada_el: string | null
  creado_el: string
  actualizado_el: string
}

export type EjecucionConfigRow = {
  id: string
  user_id: string
  auto_ejecutar: boolean
  auto_publicar: boolean
  comprobar_preview: boolean
  max_simultaneas: number
  modo_max: boolean
  aviso_creditos: number
  motor_preferido: MotorEjecucion
  modelo_claude: string | null
  max_pasos: number
  max_coste_ia: number
}

export type LovableConexionRow = {
  id: string
  user_id: string
  estado: EstadoConexionLovable
  cuenta: string | null
  ultimo_error: string | null
  ultima_comprobacion: string | null
}



/* ------------------------------ Salud (0.21.0) ----------------------------- */

/** Semáforo de salud de un proyecto. */
export type Semaforo = "verde" | "ambar" | "rojo" | "gris"

export type OrigenSaludInforme = "programado" | "manual"
export type EstadoSaludInforme = "en_curso" | "terminado" | "error"

export type ServicioSupabase = { name: string; status: string }

export type AdvisorSalud = {
  tipo: "seguridad" | "rendimiento"
  nivel: "ERROR" | "WARN"
  nombre: string
  titulo: string
  detalle: string
  url?: string | null
}

export type IncidenciaSentry = {
  titulo: string
  nivel?: string | null
  veces?: number | null
  usuarios?: number | null
  url?: string | null
  ultima?: string | null
}

export type SaludInformeRow = {
  id: string
  user_id: string
  origen: OrigenSaludInforme
  estado: EstadoSaludInforme
  total: number
  verdes: number
  ambar: number
  rojos: number
  grises: number
  resumen: string | null
  error: string | null
  iniciado_el: string
  terminado_el: string | null
}

export type SaludProyectoRow = {
  id: string
  user_id: string
  informe_id: string
  proyecto_id: string | null
  supabase_ref: string | null
  nombre: string
  semaforo: Semaforo
  pendiente: boolean
  estado_supabase: string | null
  servicios: ServicioSupabase[] | null
  advisors_seguridad: number
  advisors_rendimiento: number
  advisors: AdvisorSalud[] | null
  tablas_sin_rls: number
  tablas_sin_rls_lista: string[] | null
  funciones_sin_search_path: number
  errores_api_24h: number
  errores_bd_24h: number
  errores_funciones_24h: number
  bd_mb: number | null
  usuarios: number | null
  ultimo_acceso: string | null
  sentry_errores_24h: number
  sentry_incidencias: IncidenciaSentry[] | null
  motivos: string[] | null
  error: string | null
  comprobado_el: string | null
}

export type SaludConfigRow = {
  id: string
  user_id: string
  activo: boolean
  avisar_solo_rojo: boolean
  umbral_bd_mb: number
  umbral_bd_rojo_mb: number
  umbral_errores_ambar: number
  umbral_errores_rojo: number
  sentry_org: string | null
  incluir_rendimiento: boolean
}

/* ------------------------- Infraestructura (0.30.0) ------------------------ */

export type TipoServicioInfra =
  | "supabase"
  | "github"
  | "http"
  | "dns"
  | "tcp"
  | "s3"
  | "funcion"
  | "proveedor_ia"
  | "sentry"
  | "proyectian"
  | "servidor"
  | "correo"
  | "otro"

export type AmbitoInfra = "global" | "proyecto"
export type OrigenServicioInfra = "descubierto" | "manual"
export type EstadoIncidenciaInfra = "abierta" | "resuelta" | "ignorada"

export type MetodoInfra = {
  esperado?: number | null
  texto?: string | null
  metodo_http?: string | null
  tipo_dns?: string | null
  puerto?: number | null
  bucket?: string | null
  servicios?: string[] | null
}

export type InfraServicioRow = {
  id: string
  user_id: string
  nombre: string
  tipo: TipoServicioInfra
  proveedor: string | null
  url: string | null
  referencia: string | null
  metodo: MetodoInfra | null
  ambito: AmbitoInfra
  critico: boolean
  activo: boolean
  origen: OrigenServicioInfra
  estado: Semaforo
  fallos_seguidos: number
  ultimo_ms: number | null
  ultimo_detalle: string | null
  ultimo_error: string | null
  comprobado_el: string | null
  ultimo_verde_el: string | null
  coste_mensual: number | null
  renovacion_el: string | null
  notas: string | null
}

export type InfraDependenciaRow = {
  id: string
  user_id: string
  servicio_id: string
  proyecto_id: string
  modulos: string[] | null
  critica: boolean
}

export type InfraComprobacionRow = {
  id: string
  user_id: string
  servicio_id: string
  estado: Semaforo
  ms: number | null
  detalle: string | null
  error: string | null
  comprobado_el: string
}

export type ProyectoAfectadoInfra = {
  proyecto_id: string
  nombre: string
  slug?: string | null
  modulos?: string[] | null
  critica?: boolean
}

export type InfraIncidenciaRow = {
  id: string
  user_id: string
  servicio_id: string
  estado: EstadoIncidenciaInfra
  titulo: string
  detalle: string | null
  proyectos_afectados: ProyectoAfectadoInfra[] | null
  afecta_todo: boolean
  tarea_id: string | null
  abierta_el: string
  resuelta_el: string | null
  duracion_min: number | null
  notas: string | null
}

export type InfraSincronizacionRow = {
  id: string
  user_id: string
  proyecto_id: string
  semaforo: Semaforo
  motivos: string[] | null
  github_rama: string | null
  github_sha: string | null
  github_fecha: string | null
  github_autor: string | null
  commits_7d: number | null
  version_repo: string | null
  version_app: string | null
  migraciones_repo: number | null
  migraciones_aplicadas: number | null
  migraciones_pendientes: string[] | null
  migraciones_sin_repo: string[] | null
  funciones_repo: number | null
  funciones_desplegadas: number | null
  funciones_sin_desplegar: number | null
  funciones_sin_repo: number | null
  mac_sha: string | null
  mac_fecha: string | null
  mac_reportado_el: string | null
  error: string | null
  comprobado_el: string | null
}

export type InfraConfigRow = {
  id: string
  user_id: string
  activo: boolean
  intervalo_min: number
  sincronizar_cada_h: number
  umbral_lento_ms: number
  fallos_para_rojo: number
  avisar_push: boolean
  crear_tareas: boolean
  dias_sin_commit_ambar: number
  resolver_dns: boolean
}

/* ------------------------- Mi IA: peticiones y Plaud ------------------------ */

export type OrigenPeticion = "texto" | "voz"
export type DestinoPeticion = "proyecto" | "personal"
export type TipoPeticion = "consulta" | "modificacion" | "tareas" | "personal"
export type EstadoPeticion =
  | "nueva"
  | "clasificada"
  | "respondida"
  | "propuesta"
  | "aprobada"
  | "descartada"
  | "error"

export type ClasificacionPeticion = {
  destino?: DestinoPeticion
  proyecto_id?: string | null
  proyecto_nombre?: string | null
  confianza?: number | null
  tipo?: TipoPeticion
  titulo?: string | null
  motivo?: string | null
}

export type RevisionPropuesta = {
  area?: string
  experto?: string
  veredicto?: string
  observaciones?: string[]
  riesgos?: string[]
  requisitos?: string[]
  cambios_sugeridos?: string | null
}

export type PropuestaPeticion = {
  sintesis?: string
  plan?: string[]
  requisitos_obligatorios?: string[]
  riesgos?: string[]
  decisiones_para_javier?: string[]
  horas_estimadas?: number | null
  coste_estimado_eur?: number | null
  riesgo?: string | null
  recomendacion?: string | null
  orden_para_la_ia?: string | null
  revisiones?: RevisionPropuesta[]
  areas?: string[]
  coste?: number | null
}

export type PeticionDirectaRow = {
  id: string
  user_id: string
  texto: string
  origen: OrigenPeticion
  clasificacion: ClasificacionPeticion | null
  destino: DestinoPeticion | null
  proyecto_id: string | null
  chat_id: string | null
  conversacion_id: string | null
  estado: EstadoPeticion
  respuesta: string | null
  propuesta: PropuestaPeticion | null
  error: string | null
  creado_el: string
}

export type EstadoGrabacionPlaud = "importada" | "clasificada" | "procesada" | "descartada"

export type PlaudGrabacionRow = {
  id: string
  user_id: string
  plaud_id: string
  nombre: string | null
  fecha: string | null
  duracion_seg: number | null
  transcripcion: string | null
  resumen: string | null
  destacados: Json | null
  estado: EstadoGrabacionPlaud
  destino: DestinoPeticion | null
  proyecto_id: string | null
  tareas_creadas: number | null
  error: string | null
  peticion_id: string | null
  creado_el: string
}

/* ------------------------------- Personal --------------------------------- */

export type ModoPersonal = "fusion" | "rapido" | "comparar"
export type RolMensajePersonal = "usuario" | "asistente"
export type ModoReescritura = "mi_voz" | "marca" | "tutor"

export type RespuestaProveedorPersonal = {
  proveedor?: string
  nombre?: string
  modelo?: string
  texto?: string
  coste?: number | null
  ms?: number | null
  error?: string | null
}

export type PersonalConversacionRow = {
  id: string
  user_id: string
  titulo: string | null
  fijada: boolean
  archivada: boolean
  creado_el: string
  actualizado_el: string
}

export type PersonalMensajeRow = {
  id: string
  user_id: string
  conversacion_id: string
  rol: RolMensajePersonal
  texto: string | null
  respuestas: RespuestaProveedorPersonal[] | null
  juez: string | null
  discrepancias: string | null
  coste: number | null
  fecha: string
}

export type PersonalDocumentoRow = {
  id: string
  user_id: string
  conversacion_id: string | null
  titulo: string | null
  tipo: string | null
  contenido_md: string | null
  html: string | null
  ruta_mac: string | null
  url: string | null
  etiquetas: string[] | null
  creado_el: string
}

export type PersonalConfigRow = {
  id: string
  user_id: string
  proveedores: string[] | null
  max_proveedores: number
  juez: string | null
  modo: ModoPersonal
  guardar_en_almacen: boolean
  carpeta_almacen: string | null
  carpeta_mac: string | null
  instrucciones: string | null
  muestras_estilo: string[] | null
  perfil_estilo: string | null
  actualizado_el: string
}

export type EstiloReescrituraRow = {
  id: string
  user_id: string
  modo: ModoReescritura
  proyecto_id: string | null
  tono: string | null
  texto_original: string | null
  texto_resultado: string | null
  notas: Json | null
  creado_el: string
}

export type NotasTutor = {
  valoracion?: string
  esquema_sugerido?: string[]
  correcciones?: { fragmento?: string; problema?: string; sugerencia?: string }[]
  preguntas_para_profundizar?: string[]
  fuentes_sugeridas?: string[]
  siguiente_paso?: string
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
      proveedores_ia: Tabla<
        Omit<ProveedorIaRow, "tiene_clave">,
        Partial<SinUsuario<Omit<ProveedorIaRow, "tiene_clave">>> & { nombre: string; clave_slug: string }
      >
      modelos_ia: Tabla<
        ModeloIaRow,
        Partial<SinUsuario<ModeloIaRow>> & { proveedor_id: string; identificador: string; nombre: string }
      >
      politica_enrutado: Tabla<PoliticaEnrutadoRow, Partial<SinUsuario<PoliticaEnrutadoRow>> & { tarea: string }>
      consumos_ia: Tabla<ConsumoIaRow>
      expertos: Tabla<ExpertoRow, Partial<SinUsuario<ExpertoRow>> & { slug: string; nombre: string }>
      controles_calidad: Tabla<ControlCalidadRow, Partial<ControlCalidadRow> & { codigo: string; nombre: string }>
      ejecuciones_calidad: Tabla<
        EjecucionCalidadRow,
        Partial<SinUsuario<EjecucionCalidadRow>> & { proyecto_id: string }
      >
      resultados_calidad: Tabla<
        ResultadoCalidadRow,
        Partial<ResultadoCalidadRow> & { ejecucion_id: string; control_codigo: string }
      >
      revisiones_orden: Tabla<RevisionOrdenRow, Partial<SinUsuario<RevisionOrdenRow>> & { orden_id: string }>
      repositorios: Tabla<
        RepositorioRow,
        Partial<SinUsuario<RepositorioRow>> & { proyecto_id: string; nombre_completo: string }
      >
      repositorio_subidas: Tabla<
        RepositorioSubidaRow,
        Partial<RepositorioSubidaRow> & { repositorio_id: string }
      >
      copias_destinos: Tabla<
        Omit<CopiaDestinoRow, "tiene_secreto">,
        Partial<SinUsuario<Omit<CopiaDestinoRow, "tiene_secreto">>> & { nombre: string }
      >
      copias_config: Tabla<CopiaConfigRow, Partial<SinUsuario<CopiaConfigRow>>>
      copias_origenes: Tabla<CopiaOrigenRow>
      copias: Tabla<CopiaRow>
      restauraciones: Tabla<RestauracionRow>
      restauracion_config: Tabla<
        RestauracionConfigRow,
        Partial<SinUsuario<RestauracionConfigRow>>,
        Partial<SinUsuario<RestauracionConfigRow>>
      >
      avisos: Tabla<AvisoRow, Partial<SinUsuario<AvisoRow>>, Partial<AvisoRow>>
      avisos_suscripciones: Tabla<AvisoSuscripcionRow, Partial<SinUsuario<AvisoSuscripcionRow>>, Partial<AvisoSuscripcionRow>>
      avisos_config: Tabla<AvisosConfigRow, Partial<SinUsuario<AvisosConfigRow>>, Partial<SinUsuario<AvisosConfigRow>>>
      asistente_conversaciones: Tabla<
        AsistenteConversacionRow,
        Partial<SinUsuario<AsistenteConversacionRow>>,
        Partial<SinUsuario<AsistenteConversacionRow>>
      >
      asistente_mensajes: Tabla<AsistenteMensajeRow, Partial<SinUsuario<AsistenteMensajeRow>>, Partial<AsistenteMensajeRow>>


      plantillas_compilacion: Tabla<PlantillaCompilacionRow, Partial<PlantillaCompilacionRow>, Partial<PlantillaCompilacionRow>>
      compilaciones: Tabla<CompilacionRow>
      firmas_compilacion: Tabla<FirmaCompilacionRow>
      dominios: Tabla<DominioRow>
      dominios_historial: Tabla<DominioHistorialRow>
      bandeja_fuentes: Tabla<BandejaFuenteRow, Partial<BandejaFuenteRow>, Partial<BandejaFuenteRow>>
      bandeja_entradas: Tabla<BandejaEntradaRow>
      vigilancia_config: Tabla<VigilanciaConfigRow, Partial<SinUsuario<VigilanciaConfigRow>>>
      vigilancia_lotes: Tabla<VigilanciaLoteRow>
      vigilancia_hallazgos: Tabla<VigilanciaHallazgoRow>
      competidores: Tabla<CompetidorRow, Partial<SinUsuario<CompetidorRow>> & { nombre: string }>
      resumenes: Tabla<ResumenRow>
      resumenes_config: Tabla<ResumenesConfigRow, Partial<SinUsuario<ResumenesConfigRow>>>
      gasto_ia_diario: Tabla<GastoIaDiarioRow>
      gastos_ia_manuales: Tabla<
        GastoIaManualRow,
        Partial<SinUsuario<GastoIaManualRow>> & { fecha: string; proveedor: ProveedorGastoIa; concepto: string }
      >
      presupuestos_ia: Tabla<
        PresupuestoIaRow,
        Partial<SinUsuario<PresupuestoIaRow>> & { ambito: AmbitoPresupuestoIa; limite_mensual: number }
      >
      gasto_ia_config: Tabla<GastoIaConfigRow, Partial<SinUsuario<GastoIaConfigRow>>>
      cierres_version: Tabla<
        CierreVersionRow,
        Partial<SinUsuario<CierreVersionRow>> & { proyecto_id: string; version: string },
        Partial<SinUsuario<CierreVersionRow>>
      >
      documentos_nex: Tabla<DocumentoNexRow>
      manuales: Tabla<ManualRow, Partial<SinUsuario<ManualRow>> & { proyecto_id: string; titulo: string }, Partial<SinUsuario<ManualRow>>>
      manuales_config: Tabla<ManualesConfigRow, Partial<SinUsuario<ManualesConfigRow>>, Partial<SinUsuario<ManualesConfigRow>>>
      auditorias: Tabla<AuditoriaRow, Partial<SinUsuario<AuditoriaRow>> & { proyecto_id: string; lote: string }, Partial<SinUsuario<AuditoriaRow>>>
      auditoria_config: Tabla<AuditoriaConfigRow, Partial<SinUsuario<AuditoriaConfigRow>>, Partial<SinUsuario<AuditoriaConfigRow>>>
      usuarios_clientes: Tabla<
        UsuarioClienteRow,
        Partial<SinUsuario<UsuarioClienteRow>> & { proyecto_id: string; auth_id: string; email: string },
        Partial<SinUsuario<UsuarioClienteRow>>
      >
      usuarios_acciones: Tabla<UsuarioAccionRow, Partial<SinUsuario<UsuarioAccionRow>> & { accion: string }>
      portales_cliente: Tabla<
        PortalClienteRow,
        Partial<SinUsuario<PortalClienteRow>> & { proyecto_id: string; token: string },
        Partial<SinUsuario<PortalClienteRow>>
      >
      portal_peticiones: Tabla<
        PortalPeticionRow,
        Partial<SinUsuario<PortalPeticionRow>> & { portal_id: string; proyecto_id: string; texto: string },
        Partial<SinUsuario<PortalPeticionRow>>
      >
      facturacion_config: Tabla<FacturacionConfigRow, Partial<SinUsuario<FacturacionConfigRow>>, Partial<SinUsuario<FacturacionConfigRow>>>
      facturacion_clientes: Tabla<
        FacturacionClienteRow,
        Partial<SinUsuario<FacturacionClienteRow>> & { proyecto_id: string },
        Partial<SinUsuario<FacturacionClienteRow>>
      >
      horas_registro: Tabla<
        HoraRegistroRow,
        Partial<SinUsuario<HoraRegistroRow>> & { proyecto_id: string; horas: number },
        Partial<SinUsuario<HoraRegistroRow>>
      >
      facturas: Tabla<FacturaRow, Partial<SinUsuario<FacturaRow>>, Partial<SinUsuario<FacturaRow>>>
      habilidades: Tabla<
        HabilidadRow,
        Partial<SinUsuario<HabilidadRow>> & { nombre: string; slug: string },
        Partial<SinUsuario<HabilidadRow>>
      >
      habilidades_usos: Tabla<HabilidadUsoRow>
      habilidades_config: Tabla<HabilidadesConfigRow, Partial<SinUsuario<HabilidadesConfigRow>>>
      guiones_demo: Tabla<
        GuionDemoRow,
        Partial<SinUsuario<GuionDemoRow>> & { proyecto_id: string; titulo: string },
        Partial<SinUsuario<GuionDemoRow>>
      >
      locuciones: Tabla<LocucionRow>
      voz_config: Tabla<VozConfigRow, Partial<SinUsuario<VozConfigRow>>>
      mesas: Tabla<
        MesaRow,
        Partial<SinUsuario<MesaRow>> & { pregunta: string },
        Partial<SinUsuario<MesaRow>>
      >
      mesa_intervenciones: Tabla<MesaIntervencionRow>
      mesa_valoraciones: Tabla<
        MesaValoracionRow,
        Partial<SinUsuario<MesaValoracionRow>> & { mesa_id: string; valoracion: number },
        Partial<SinUsuario<MesaValoracionRow>>
      >
      ejecuciones_orden: Tabla<
        EjecucionOrdenRow,
        Partial<SinUsuario<EjecucionOrdenRow>>,
        Partial<SinUsuario<EjecucionOrdenRow>>
      >
      ejecucion_config: Tabla<
        EjecucionConfigRow,
        Partial<SinUsuario<EjecucionConfigRow>>,
        Partial<SinUsuario<EjecucionConfigRow>>
      >
      lovable_conexion: Tabla<LovableConexionRow>
      salud_informes: Tabla<SaludInformeRow>
      salud_proyectos: Tabla<SaludProyectoRow>
      salud_config: Tabla<SaludConfigRow, Partial<SinUsuario<SaludConfigRow>>, Partial<SinUsuario<SaludConfigRow>>>
      infra_servicios: Tabla<
        InfraServicioRow,
        Partial<SinUsuario<InfraServicioRow>> & { nombre: string; tipo: TipoServicioInfra },
        Partial<SinUsuario<InfraServicioRow>>
      >
      infra_dependencias: Tabla<InfraDependenciaRow>
      infra_comprobaciones: Tabla<InfraComprobacionRow>
      infra_incidencias: Tabla<InfraIncidenciaRow>
      infra_sincronizacion: Tabla<InfraSincronizacionRow>
      infra_config: Tabla<InfraConfigRow, Partial<SinUsuario<InfraConfigRow>>, Partial<SinUsuario<InfraConfigRow>>>
      peticiones_directas: Tabla<PeticionDirectaRow>
      plaud_grabaciones: Tabla<PlaudGrabacionRow>
      personal_conversaciones: Tabla<PersonalConversacionRow>
      personal_mensajes: Tabla<PersonalMensajeRow>
      personal_documentos: Tabla<PersonalDocumentoRow>
      personal_config: Tabla<PersonalConfigRow, Partial<SinUsuario<PersonalConfigRow>>, Partial<SinUsuario<PersonalConfigRow>>>
      estilo_reescrituras: Tabla<EstiloReescrituraRow>






    }
    Views: {
      v_resumen_proyecto: { Row: ResumenProyectoRow; Relationships: [] }
      v_carga_agentes: { Row: CargaAgenteRow; Relationships: [] }
      v_tareas_atencion: { Row: TareaAtencionRow; Relationships: [] }
      v_proveedores_ia: { Row: ProveedorIaRow; Relationships: [] }
      v_rendimiento_modelos: { Row: RendimientoModeloRow; Relationships: [] }
      v_copias_destinos: { Row: CopiaDestinoRow; Relationships: [] }
      v_compilaciones_ultimas: { Row: CompilacionUltimaRow; Relationships: [] }
      v_dominios_resumen: { Row: DominiosResumenRow; Relationships: [] }
      v_bandeja_fuentes: { Row: BandejaFuenteRow; Relationships: [] }
      v_vigilancia_resumen: { Row: VigilanciaResumenRow; Relationships: [] }
      v_gasto_ia_mes: { Row: GastoIaMesRow; Relationships: [] }
      v_gasto_ia_proyecto_mes: { Row: GastoIaProyectoMesRow; Relationships: [] }
      v_gasto_ia_estado: { Row: GastoIaEstadoRow; Relationships: [] }
      v_habilidades_resumen: { Row: HabilidadesResumenRow; Relationships: [] }



    }

    Functions: {
      guardar_secreto_copias: {
        Args: { p_destino_id: string; p_secreto: string }
        Returns: boolean
      }
      lanzar_mis_copias: {
        Args: { p_tipos: string[] }
        Returns: string
      }

      sugerir_proyecto: {
        Args: { p_texto: string }
        Returns: { proyecto_id: string; nombre: string; confianza: number }[]
      }
      guardar_clave_proveedor: {
        Args: { p_proveedor_id: string; p_clave: string }
        Returns: boolean
      }
      probar_proveedor: {
        Args: { p_proveedor_id: string }
        Returns: { clave_slug: string; url_base: string | null; tiene_clave: boolean }[]
      }
      sembrar_proveedores_ia: {
        Args: Record<string, never>
        Returns: number
      }
      sembrar_expertos: {
        Args: Record<string, never>
        Returns: number
      }
      revisar_orden: {
        Args: { p_orden_id: string }
        Returns: { aprobada: boolean; hallazgos: Hallazgo[]; revision_id: string }
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
      origen_experto: OrigenExperto
      estado_experto: EstadoExperto
      estado_accion: EstadoAccion
      momento_control: MomentoControl
      origen_ejecucion_calidad: OrigenEjecucionCalidad
      estado_ejecucion_calidad: EstadoEjecucionCalidad
      resultado_control: ResultadoControl
      semaforo_calidad: SemaforoCalidad
      estado_ejecucion: EstadoEjecucion
      estado_repositorio: EstadoRepositorio
      origen_codigo_repositorio: OrigenCodigoRepositorio
      estado_subida_repositorio: EstadoSubidaRepositorio
      herramienta_compilacion: HerramientaCompilacion
      plataforma_compilacion: PlataformaCompilacion
      estado_compilacion: EstadoCompilacion
      origen_habilidad: OrigenHabilidad
      categoria_habilidad: CategoriaHabilidad
      estado_habilidad: EstadoHabilidad

    }
    CompositeTypes: { [_ in never]: never }
  }
}
