// Alias de dominio: la fuente de verdad es el esquema real de la base de datos.
export type {
  AccionRow,
  ActividadRow,
  AgenteRow,
  AjustesRow,
  AlertaRow,
  ArchivoRow,
  AutorMensaje,
  CargaAgenteRow,
  ChatRow,
  ConfiguracionAppRow,
  CredencialRefRow,
  Disponibilidad,
  EntornoPreview,
  EstadoOrden,
  EstadoProyecto,
  EstadoTarea,
  EstimacionRow,
  IntegracionRow,
  Json,
  MensajeRow,
  ModoEjecucion,
  NivelAlerta,
  OrdenRow,
  PerfilRow,
  PresupuestoRow,
  PreviewRow,
  Prioridad,
  PlantillaAccionRow,
  PosicionPanel,
  ResultadoVerificacion,
  ProyectoRow,
  ResumenProyectoRow,
  Riesgo,
  RolAgente,
  TareaAtencionRow,
  TareaRow,
  TemaPerfil,
  TipoAccion,
  EstadoAccion,
  TipoActividad,
  TipoIntegracion,
  UbicacionCredencial,
} from "./db-types";

import type { AgenteRow, AlertaRow, OrdenRow, PreviewRow, ProyectoRow, TareaRow } from "./db-types";

export type Proyecto = ProyectoRow;
export type Tarea = TareaRow;
export type Agente = AgenteRow;
export type Orden = OrdenRow;
export type Alerta = AlertaRow;
export type Preview = PreviewRow;
