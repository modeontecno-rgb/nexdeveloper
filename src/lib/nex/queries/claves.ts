export const claves = {
  perfil: ["perfil"] as const,
  ajustes: ["ajustes"] as const,
  configuracionApp: ["configuracion_app"] as const,
  proyectos: ["proyectos"] as const,
  tareas: ["tareas"] as const,
  ordenes: ["ordenes"] as const,
  agentes: ["agentes"] as const,
  cargaAgentes: ["v_carga_agentes"] as const,
  resumenProyectos: ["v_resumen_proyecto"] as const,
  chats: ["chats"] as const,
  mensajes: ["mensajes"] as const,
  actividad: ["actividad"] as const,
  alertas: ["alertas"] as const,
  previews: ["previews"] as const,
  integraciones: ["integraciones"] as const,
  credenciales: ["credenciales_ref"] as const,
  presupuestos: ["presupuestos"] as const,
  acciones: ["acciones"] as const,
  plantillasAccion: ["plantillas_accion"] as const,
  tareasAtencion: ["v_tareas_atencion"] as const,
  integracionProyectos: ["integracion_proyectos"] as const,
  proveedoresIa: ["proveedores_ia"] as const,
  modelosIa: ["modelos_ia"] as const,
  politicaEnrutado: ["politica_enrutado"] as const,
  consumosIa: ["consumos_ia"] as const,
  rendimientoModelos: ["v_rendimiento_modelos"] as const,
};

export function errorLegible(error: { message?: string } | null | undefined, contexto: string) {
  if (!error) return contexto;
  return `${contexto}: ${error.message ?? "error desconocido"}`;
}
