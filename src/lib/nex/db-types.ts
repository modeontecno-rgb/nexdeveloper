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
  semaforo_calidad: SemaforoCalidad
  ultima_ejecucion_calidad_id: string | null
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
      estado_repositorio: EstadoRepositorio
      origen_codigo_repositorio: OrigenCodigoRepositorio
      estado_subida_repositorio: EstadoSubidaRepositorio
      herramienta_compilacion: HerramientaCompilacion
      plataforma_compilacion: PlataformaCompilacion
      estado_compilacion: EstadoCompilacion

    }
    CompositeTypes: { [_ in never]: never }
  }
}
