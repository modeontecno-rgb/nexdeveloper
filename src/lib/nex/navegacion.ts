/**
 * Corrige destinos históricos guardados en avisos.
 * Durante un tiempo convivieron los nombres `/cola` y `/tareas`. La pantalla
 * canónica es ahora `/tareas`, que coincide con los avisos guardados.
 */
export function normalizarDestinoInterno(url: string | null | undefined): string | null {
  const destino = url?.trim();
  if (!destino || !destino.startsWith("/") || destino.startsWith("//")) return null;
  if (destino === "/cola") return "/tareas";
  if (destino.startsWith("/cola?")) return `/tareas?${destino.slice("/cola?".length)}`;
  return destino;
}