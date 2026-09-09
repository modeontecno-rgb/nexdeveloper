/** Catálogo del equipo: describe capacidades, nunca acredita conexión o pruebas. */
export type HerramientaEquipo = {
  slug: string;
  nombre: string;
  papel: string;
  requisito: string;
  url: string;
};
export const CATALOGO_EQUIPO: HerramientaEquipo[] = [
  {
    slug: "anthropic",
    nombre: "Claude · Anthropic",
    papel: "Arquitectura, programación y revisión de código.",
    requisito: "API, modelo compatible y saldo o límite disponible.",
    url: "https://platform.claude.com/settings/limits",
  },
  {
    slug: "openai",
    nombre: "OpenAI",
    papel: "Programación, razonamiento técnico y revisión.",
    requisito: "API con saldo; acceso independiente del chat.",
    url: "https://platform.openai.com/settings/organization/billing/",
  },
  {
    slug: "google",
    nombre: "Gemini · Google",
    papel: "Diseño, referencias visuales, análisis y revisión.",
    requisito: "API, modelo vigente y tarifa verificada.",
    url: "https://aistudio.google.com/",
  },
  {
    slug: "deepseek",
    nombre: "DeepSeek",
    papel: "Programación, backend y razonamiento.",
    requisito: "Validar herramientas, respuestas completas y consumo.",
    url: "https://platform.deepseek.com/",
  },
  {
    slug: "xai",
    nombre: "Grok · xAI",
    papel: "Programación y segunda revisión técnica.",
    requisito: "API y consumo verificado, incluido razonamiento.",
    url: "https://console.x.ai/",
  },
  {
    slug: "mistral",
    nombre: "Mistral",
    papel: "Código, análisis de documentos y revisión.",
    requisito: "Probar el modelo concreto antes de asignar trabajo.",
    url: "https://console.mistral.ai/",
  },
  {
    slug: "abacus",
    nombre: "Abacus",
    papel: "Asistencia técnica y selección de modelos mediante RouteLLM.",
    requisito: "Verificar el modelo utilizado, herramientas y coste real.",
    url: "https://abacus.ai/",
  },
  {
    slug: "openrouter",
    nombre: "OpenRouter",
    papel: "Acceso a modelos alternativos y proveedores de respaldo.",
    requisito: "Elegir modelo concreto y tarifa; evita duplicar una misma IA.",
    url: "https://openrouter.ai/",
  },
  {
    slug: "perplexity",
    nombre: "Perplexity",
    papel: "Investigar documentación y alternativas con fuentes.",
    requisito: "Adaptar citas y coste de búsquedas antes de usarlo automáticamente.",
    url: "https://www.perplexity.ai/",
  },
  {
    slug: "ollama",
    nombre: "Ollama",
    papel: "Modelos locales o cloud para tareas compatibles.",
    requisito:
      "Confirmar servidor, autenticación y modelos; el catálogo público no prueba ejecución.",
    url: "https://ollama.com/",
  },
  {
    slug: "groq",
    nombre: "Groq",
    papel: "Inferencia y tareas breves con modelos compatibles.",
    requisito: "Proveedor distinto de Grok; verificar el modelo y la API.",
    url: "https://console.groq.com/",
  },
  {
    slug: "together",
    nombre: "Together",
    papel: "Modelos alternativos para código y análisis.",
    requisito: "Adaptador, modelo y consumo verificados.",
    url: "https://api.together.ai/",
  },
  {
    slug: "cohere",
    nombre: "Cohere",
    papel: "Búsqueda y organización de documentación del proyecto.",
    requisito: "Adaptar recuperación de información y permisos del contenido.",
    url: "https://dashboard.cohere.com/",
  },
  {
    slug: "lovable",
    nombre: "Lovable",
    papel: "Construcción visual y edición del proyecto compartido.",
    requisito: "Autorización OAuth y coordinación con el mismo GitHub.",
    url: "https://lovable.dev/",
  },
  {
    slug: "canva",
    nombre: "Canva",
    papel: "Diseños de marca, recursos y manuales visuales.",
    requisito: "Autorizar Canva dentro de NexDeveloper; la conexión del chat es independiente.",
    url: "https://www.canva.com/",
  },
  {
    slug: "elevenlabs",
    nombre: "ElevenLabs",
    papel: "Voz, locuciones y transcripción cuando sean necesarias.",
    requisito: "Adaptador por operación y contabilización por audio o caracteres.",
    url: "https://elevenlabs.io/",
  },
  {
    slug: "fal",
    nombre: "fal",
    papel: "Imágenes, ilustraciones y otros recursos multimedia.",
    requisito: "Modelo concreto y límite de coste por generación.",
    url: "https://fal.ai/",
  },
  {
    slug: "sentry",
    nombre: "Sentry",
    papel: "Detectar errores reales y aportar incidencias a las correcciones.",
    requisito: "Proyecto instrumentado, token y permisos; no sustituye la revisión de seguridad.",
    url: "https://sentry.io/",
  },
  {
    slug: "chatly",
    nombre: "Chatly",
    papel: "Apoyo en documentos, presentaciones y revisión de propuestas.",
    requisito:
      "Comprobar suscripción y acceso de integración por cuenta. La sesión del navegador no conecta automáticamente el coordinador.",
    url: "https://chatlyai.app/",
  },
  {
    slug: "rinkel",
    nombre: "Rinkel",
    papel:
      "Telefonía de aplicaciones: registros y eventos de llamadas cuando el proyecto lo requiera.",
    requisito:
      "Comprobar plan y permisos API. Conexión pendiente; no se modifican líneas ni saludos.",
    url: "https://my.rinkel.com/",
  },
  {
    slug: "davinci",
    nombre: "DaVinci AI",
    papel: "Recursos creativos para las aplicaciones: imágenes, vídeos y locuciones.",
    requisito:
      "Producto identificado. Suscripción, acceso API y generación automática pendientes de verificar.",
    url: "https://davinci.ai/app/home",
  },
  {
    slug: "heygen",
    nombre: "HeyGen",
    papel: "Vídeos de presentación, tutoriales y formación de las aplicaciones.",
    requisito: "Acceso API y coste por generación pendientes de verificar.",
    url: "https://www.heygen.com/",
  },
  {
    slug: "grammarly",
    nombre: "Grammarly",
    papel: "Claridad y revisión editorial de manuales y textos.",
    requisito:
      "Desktop disponible según tu cuenta; automatización pendiente de acceso API compatible.",
    url: "https://www.grammarly.com/",
  },
];
