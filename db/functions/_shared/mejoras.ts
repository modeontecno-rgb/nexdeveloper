/** Marcador legible del modo de revisión, siempre ejecutado en solo lectura. */
export const MARCA_MEJORAS = "Revisión integral de mejoras del proyecto\n\n";
export const AREAS_MEJORAS = {
  mejoras_diseno: [
    "Diseño visual",
    "Evalúa jerarquía visual, contraste, tipografía, coherencia y estética. Respeta el diseño aprobado y el carácter del producto.",
  ],
  mejoras_funciones: [
    "Funcionalidades",
    "Detecta funciones útiles, flujos incompletos y oportunidades de automatización. Prioriza problemas reales frente a añadir funciones por añadir.",
  ],
  mejoras_accesibilidad: [
    "Accesibilidad y dispositivos",
    "Evalúa móvil, iPad, escritorio, teclado, lectores de pantalla, tamaños táctiles, zoom, legibilidad y movimiento reducido.",
  ],
  mejoras_comunicacion: [
    "Voz, sonido y textos",
    "Evalúa claridad de textos, mensajes de estado, ayudas, dictado, expresión vocal, sonidos y avisos. No inventes capacidades de voz que no estén implementadas.",
  ],
  mejoras_calidad: [
    "Calidad y confianza",
    "Evalúa rendimiento, fiabilidad, recuperación de errores, privacidad, permisos, seguridad y gasto de IA. No reveles secretos ni propongas debilitar protecciones.",
  ],
  mejoras_sintesis: [
    "Prioridades y experiencia de uso",
    "Consolida las entregas anteriores sin duplicados. Incluye incorporación de usuarios, ayuda y mantenimiento. Entrega una lista final numerada de mejoras con prioridad, beneficio, esfuerzo aproximado, riesgo, dependencias, criterio de comprobación y qué NO cambiar para preservar lo que funciona. Recomienda un primer grupo pequeño de mejoras. No implementes nada.",
  ],
} as const;
export type PapelMejora = keyof typeof AREAS_MEJORAS;
export function esRevisionMejoras(e: { modo?: string; texto?: string | null }) {
  return e.modo === "planificar" && !!e.texto?.startsWith(MARCA_MEJORAS);
}
export function instruccionesMejora(papel: PapelMejora) {
  return `${AREAS_MEJORAS[papel][1]} Lee el código disponible y separa observaciones comprobadas de hipótesis. Propón hasta cinco mejoras concretas indicando beneficio, esfuerzo, riesgo de regresión y cómo comprobarlas. Solo sugerencias: no escribas archivos, no cambies datos ni publiques. Incluye la propuesta completa en entrega de terminar. Respeta los límites de pasos y presupuesto.`;
}
