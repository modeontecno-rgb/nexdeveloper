export type EncargoExterno = {
  id?: string;
  texto?: string | null;
  estado?: string;
  rama?: string | null;
  pr_url?: string | null;
  respuesta?: string | null;
  resumen?: string | null;
  error?: string | null;
  cambios?: Record<string, string | null> | null;
  estado_agente?: {
    base?: string;
    base_sha?: string;
    equipo?: { papel: string; resumen?: string }[];
  } | null;
};
/** Exporta solo el encargo y las entregas: nunca mensajes internos, claves o configuración. */
export function textoParaContinuar(e: EncargoExterno, nombre: string, repo: string | null) {
  const fases = (e.estado_agente?.equipo ?? [])
    .filter((f) => f.resumen)
    .map((f) => `${f.papel}: ${f.resumen}`)
    .join("\n\n");
  return `Continúa este proyecto conmigo aprovechando las herramientas de mi cuenta, sin llamar a las API de NexDeveloper. Si no puedes acceder al repositorio o ejecutar el trabajo, indícalo antes de empezar.

PROYECTO: ${nombre}
REPOSITORIO: ${repo || "Pendiente de conectar: pídeme el repositorio antes de modificar código."}
ENCARGO: ${e.id || "Borrador todavía no enviado a NexDeveloper"}
ESTADO REGISTRADO: ${e.estado || "Borrador"}
RAMA DE LA ENTREGA: ${e.rama || "Todavía no creada; comprueba las ramas remotas antes de crear una rama de trabajo."}
BASE OBSERVADA: ${e.estado_agente?.base || "Consultar rama configurada del repositorio"}
COMMIT BASE OBSERVADO: ${e.estado_agente?.base_sha || "Sin registro"}
PR REGISTRADA: ${e.pr_url || "Ninguna"}

PETICIÓN DEL USUARIO:
${e.texto || "Pídeme el objetivo antes de empezar."}

ENTREGA PARCIAL Y CONSEJOS:
${e.respuesta || e.resumen || "Todavía no hay entrega."}
${fases}

INCIDENCIA PENDIENTE:
${e.error || "Ninguna registrada."}

ARCHIVOS PREPARADOS SIN GARANTÍA DE ESTAR EN GITHUB:
${Object.keys(e.cambios ?? {}).join("\n") || "Ninguno registrado."}
Si hay archivos preparados, pídeme el JSON descargado de NexDeveloper. Compáralos con el repositorio; no los sobrescribas a ciegas. Una llamada externa que estuviera en curso podría haber terminado: comprueba GitHub antes de actuar.

FORMA DE TRABAJO:
1. Lee AGENTS.md y comprueba acceso, rama, estado git y cambios remotos recientes. Conserva trabajo ajeno y evita duplicar la PR existente.
2. Resuelve la petición con calidad profesional, diseño legible (texto principal de 18px cuando encaje), contraste alto y adaptación a móvil e iPad. No inventes pruebas ni avances.
3. Haz las comprobaciones necesarias y devuelve archivos cambiados, pruebas ejecutadas, pendientes, rama, SHA y enlace a la PR. No publiques ni integres sin autorización en esta conversación.
4. Para regresar a NexDeveloper, entrega un resumen breve con lo completado y lo pendiente. El usuario podrá pegarlo en Pedir consejo para verificar el estado actual de GitHub antes de encargar más desarrollo. No reactives la ejecución antigua ni repitas llamadas cuyo consumo no esté confirmado.`;
}
