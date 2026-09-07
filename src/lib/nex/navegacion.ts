/**
 * Corrige destinos históricos guardados en avisos.
 * La antigua pantalla `/tareas` pasó a llamarse `/cola`, pero los avisos ya
 * creados conservan la URL anterior.
 */
export function normalizarDestinoInterno(url: string | null | undefined): string | null {
  const destino = url?.trim();
  if (!destino || !destino.startsWith("/") || destino.startsWith("//")) return null;
  if (destino === "/tareas") return "/cola";
  if (destino.startsWith("/tareas?")) return `/cola?${destino.slice("/tareas?".length)}`;
  return destino;
}