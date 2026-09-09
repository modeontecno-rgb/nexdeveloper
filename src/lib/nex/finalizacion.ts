const finales = new Set(["completada", "esperando_aprobacion", "error", "cancelada"]);

/** La primera carga es una referencia: no vuelve a anunciar el historial antiguo. */
export function detectarFinalizados<T extends { id: string; estado: string }>(
  anteriores: Map<string, string>,
  trabajos: T[],
): T[] {
  const nuevos = trabajos.filter((trabajo) => {
    const anterior = anteriores.get(trabajo.id);
    anteriores.set(trabajo.id, trabajo.estado);
    return anterior !== undefined && anterior !== trabajo.estado && finales.has(trabajo.estado);
  });
  return nuevos;
}

export function tituloFinalizacion(estado: string) {
  if (estado === "esperando_aprobacion") return "¡Listo para tu revisión!";
  if (estado === "error") return "El trabajo necesita tu atención";
  if (estado === "cancelada") return "Trabajo cancelado";
  return "¡Trabajo terminado!";
}
