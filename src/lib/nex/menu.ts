import type { LinkProps } from "@tanstack/react-router";
import {
  Activity,
  BadgeCheck,
  Bell,
  BookMarked,
  BookOpen,
  BookOpenText,
  Bot,
  Boxes,
  Brain,
  Briefcase,
  CalendarCheck,
  Clapperboard,
  Code2,
  Coins,
  Cpu,
  DatabaseBackup,
  GitBranch,
  Globe,
  HeartPulse,
  Inbox,
  Link2,
  LayoutDashboard,
  ListTodo,
  MessagesSquare,
  Newspaper,
  Package,
  Plug,
  Radar,
  Receipt,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkle,
  Sparkles,
  Stamp,
  Store,
  User,
  Users,
  UsersRound,
  PenLine,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Ruta interna válida de la aplicación. */
export type RutaMenu = Exclude<LinkProps["to"], undefined>;

export type PantallaMenu = {
  to: RutaMenu;
  etiqueta: string;
  icono: LucideIcon;
  /** Sinónimos con los que el buscador también encuentra la pantalla. */
  alias: string[];
  descripcion: string;
};

export type GrupoMenu = {
  id: string;
  titulo: string;
  icono: LucideIcon;
  pantallas: PantallaMenu[];
};

/* -------------------------- Fijos, siempre visibles ----------------------- */

const FIJOS_ORIGINALES: PantallaMenu[] = [
  {
    to: "/",
    etiqueta: "Inicio",
    icono: LayoutDashboard,
    alias: ["panel", "principal", "resumen del día", "portada", "dashboard"],
    descripcion: "Todo lo importante de hoy de un vistazo.",
  },
  {
    to: "/pideme",
    etiqueta: "Pídeme qué quieres",
    icono: Wand2,
    alias: ["grabar", "dictar", "plaud", "voz", "pedir", "hablar", "nota"],
    descripcion: "Escribe o dicta y NexDeveloper decide qué hacer.",
  },
  {
    to: "/bandeja",
    etiqueta: "Bandeja",
    icono: Inbox,
    alias: ["entradas", "pendientes de leer", "correo", "mensajes", "cola de entrada"],
    descripcion: "Todo lo que entra, en un único sitio.",
  },
  {
    to: "/avisos",
    etiqueta: "Avisos",
    icono: Bell,
    alias: ["notificaciones", "alertas", "campana", "push", "móvil"],
    descripcion: "Notificaciones y alertas sin leer.",
  },
];

/* --------------------------------- Grupos --------------------------------- */

const GRUPOS_ORIGINALES: GrupoMenu[] = [
  {
    id: "mi-dia",
    titulo: "Mi día",
    icono: CalendarCheck,
    pantallas: [
      {
        to: "/tareas",
        etiqueta: "Tareas",
        icono: ListTodo,
        alias: ["cola", "pendientes", "trabajo", "to-do", "encargos"],
        descripcion: "Lo que hay que hacer, por orden.",
      },
      {
        to: "/aprobaciones",
        etiqueta: "Aprobaciones",
        icono: ShieldCheck,
        alias: ["autorizar", "visto bueno", "permisos", "confirmar", "riesgo"],
        descripcion: "Lo que espera tu visto bueno.",
      },
      {
        to: "/nueva-orden",
        etiqueta: "Nueva orden",
        icono: Sparkle,
        alias: ["crear encargo", "pedir trabajo", "alta", "nuevo"],
        descripcion: "Encarga un trabajo nuevo a la IA.",
      },
      {
        to: "/ejecucion",
        etiqueta: "Ejecución de la IA",
        icono: Zap,
        alias: ["en marcha", "trabajando", "progreso", "motor", "claude"],
        descripcion: "Lo que la IA está haciendo ahora mismo.",
      },
      {
        to: "/resumenes",
        etiqueta: "Resúmenes",
        icono: Newspaper,
        alias: ["informes", "diario", "semanal", "parte", "qué ha pasado"],
        descripcion: "El parte del día y de la semana.",
      },
      {
        to: "/guia",
        etiqueta: "Cómo hacer un trabajo",
        icono: BookOpen,
        alias: ["guía", "ayuda", "empezar", "instrucciones", "paso a paso"],
        descripcion: "El recorrido completo desde la petición hasta el resultado.",
      },
    ],
  },
  {
    id: "proyectos",
    titulo: "Proyectos y clientes",
    icono: Briefcase,
    pantallas: [
      {
        to: "/proyectos",
        etiqueta: "Proyectos",
        icono: Boxes,
        alias: ["carteras", "apps", "aplicaciones", "fichas", "cartera"],
        descripcion: "La ficha de cada proyecto de la cartera.",
      },
      {
        to: "/facturacion",
        etiqueta: "Facturación",
        icono: Receipt,
        alias: ["facturas", "cobros", "horas", "cronómetro", "evoluteia", "clientes", "dinero"],
        descripcion: "Horas, gasto de IA y facturas en EvoluteIA.",
      },
      {
        to: "/usuarios-clientes",
        etiqueta: "Usuarios de clientes",
        icono: Users,
        alias: ["accesos", "cuentas", "altas", "personas", "invitaciones"],
        descripcion: "Quién entra en cada aplicación de cliente.",
      },
      {
        to: "/modo-cliente",
        etiqueta: "Modo cliente",
        icono: Store,
        alias: ["portal", "escaparate", "vista del cliente", "enlace público"],
        descripcion: "Lo que ve el cliente de su proyecto.",
      },
      {
        to: "/documentacion",
        etiqueta: "Documentación",
        icono: BookMarked,
        alias: ["docs", "documentos", "especificaciones", "notas técnicas"],
        descripcion: "La documentación viva de cada proyecto.",
      },
      {
        to: "/manuales",
        etiqueta: "Manuales",
        icono: BookOpenText,
        alias: ["guías", "ayuda", "instrucciones", "tutoriales", "pdf"],
        descripcion: "Manuales de uso generados automáticamente.",
      },
      {
        to: "/revisores",
        etiqueta: "Revisores",
        icono: UsersRound,
        alias: ["revisión", "insignias", "correcciones", "lectores", "redacción"],
        descripcion: "Quién revisa los manuales, cuántos llevan y su historial de insignias.",
      },
      {
        to: "/voz",
        etiqueta: "Voz y demos",
        icono: Clapperboard,
        alias: ["vídeos", "locución", "demostraciones", "grabaciones", "audio"],
        descripcion: "Vídeos y locuciones de demostración.",
      },
    ],
  },
  {
    id: "ia",
    titulo: "Inteligencia artificial",
    icono: Brain,
    pantallas: [
      {
        to: "/asistente",
        etiqueta: "Asistente",
        icono: Sparkles,
        alias: ["preguntar", "chat", "consulta", "ayuda", "copiloto"],
        descripcion: "Pregúntale cualquier cosa sobre tu cartera.",
      },
      {
        to: "/personal",
        etiqueta: "PERSONAL",
        icono: User,
        alias: ["consultas", "fusión de ias", "estilo", "privado", "javier", "mis documentos"],
        descripcion: "Tu espacio privado, separado de los proyectos.",
      },
      {
        to: "/personal/estilo",
        etiqueta: "Editor de estilo",
        icono: PenLine,
        alias: ["estilo", "glosario", "mi voz", "redacción", "perfil de estilo"],
        descripcion: "Tu perfil de estilo y el glosario que usan los manuales.",
      },
      {
        to: "/mesa",
        etiqueta: "Mesa de expertos",
        icono: MessagesSquare,
        alias: ["debate", "varias ias", "consenso", "opiniones", "junta"],
        descripcion: "Varias IA debaten una decisión importante.",
      },
      {
        to: "/expertos",
        etiqueta: "Expertos",
        icono: UsersRound,
        alias: ["perfiles", "especialistas", "directorio", "roles"],
        descripcion: "El directorio de expertos disponibles.",
      },
      {
        to: "/agentes",
        etiqueta: "Agentes",
        icono: Bot,
        alias: ["robots", "trabajadores", "motores", "bots"],
        descripcion: "Los agentes que ejecutan el trabajo.",
      },
      {
        to: "/habilidades",
        etiqueta: "Habilidades",
        icono: Wand2,
        alias: ["skills", "capacidades", "recetas", "plantillas"],
        descripcion: "Lo que tus agentes saben hacer.",
      },
      {
        to: "/referencia",
        etiqueta: "Referencia de uso",
        icono: BookOpen,
        alias: ["cómo se usa", "chuleta", "ejemplos", "manual interno"],
        descripcion: "Cómo sacarle partido a cada pantalla.",
      },
      {
        to: "/gasto-ia",
        etiqueta: "Gasto de IA",
        icono: Coins,
        alias: ["coste", "tokens", "consumo", "euros", "presupuesto"],
        descripcion: "Cuánto cuesta la IA en cada proyecto.",
      },
    ],
  },
  {
    id: "codigo",
    titulo: "Código y publicación",
    icono: Code2,
    pantallas: [
      {
        to: "/repositorios",
        etiqueta: "Repositorios",
        icono: GitBranch,
        alias: ["github", "git", "ramas", "commits", "código"],
        descripcion: "Los repositorios y su último movimiento.",
      },
      {
        to: "/compilaciones",
        etiqueta: "Compilaciones",
        icono: Package,
        alias: ["builds", "despliegues", "publicar", "versiones"],
        descripcion: "Compilaciones y publicaciones de cada app.",
      },
      {
        to: "/calidad",
        etiqueta: "Calidad",
        icono: BadgeCheck,
        alias: ["revisión", "semáforo", "tests", "errores", "lint"],
        descripcion: "El semáforo de calidad de cada proyecto.",
      },
      {
        to: "/auditoria",
        etiqueta: "Auditoría",
        icono: Stamp,
        alias: ["auditor jefe", "revisión mensual", "informe", "cumplimiento"],
        descripcion: "La revisión mensual del auditor jefe.",
      },
      {
        to: "/dominios",
        etiqueta: "Dominios",
        icono: Globe,
        alias: ["dns", "certificados", "ssl", "webs", "renovación"],
        descripcion: "Dominios, certificados y renovaciones.",
      },
    ],
  },
  {
    id: "vigilancia",
    titulo: "Vigilancia",
    icono: ShieldAlert,
    pantallas: [
      {
        to: "/salud",
        etiqueta: "Salud",
        icono: HeartPulse,
        alias: ["supabase", "sentry", "errores", "caídas", "rendimiento"],
        descripcion: "La salud de toda la cartera.",
      },
      {
        to: "/infraestructura",
        etiqueta: "Infraestructura",
        icono: Server,
        alias: ["servicios", "dns", "caídas", "sincronización", "servidores", "incidencias"],
        descripcion: "Todo lo que tus proyectos necesitan para funcionar.",
      },
      {
        to: "/copias",
        etiqueta: "Copias de seguridad",
        icono: DatabaseBackup,
        alias: ["backup", "restaurar", "respaldo", "recuperar"],
        descripcion: "Copias de seguridad y restauraciones.",
      },
      {
        to: "/vigilancia",
        etiqueta: "Vigilancia y competencia",
        icono: Radar,
        alias: ["competidores", "mercado", "novedades", "radar", "espiar"],
        descripcion: "Qué se mueve fuera y qué te afecta.",
      },
      {
        to: "/estado",
        etiqueta: "Estado del sistema",
        icono: Activity,
        alias: ["semáforos", "diagnóstico", "informe", "comprobaciones"],
        descripcion: "Semáforos de cada pieza de NexDeveloper.",
      },
    ],
  },
];

/* ------------------------------ Pie del menú ------------------------------ */

const PIE_ORIGINAL: PantallaMenu[] = [
  {
    to: "/ajustes",
    etiqueta: "Ajustes",
    icono: Settings,
    alias: ["configuración", "preferencias", "opciones", "umbrales", "moneda"],
    descripcion: "Cómo se comporta NexDeveloper.",
  },
  {
    to: "/ajustes/proveedores",
    etiqueta: "Proveedores de IA",
    icono: Cpu,
    alias: ["claves", "api key", "modelos", "openai", "claude", "precios"],
    descripcion: "Claves, modelos y precios de cada proveedor.",
  },
  {
    to: "/proyectian",
    etiqueta: "Proyectian",
    icono: Link2,
    alias: ["sincronizar", "versiones", "pendientes", "reuniones", "pantallas", "github", "repositorios"],
    descripcion: "Sincronización con Proyectian y con los repositorios.",
  },
  {
    to: "/conexiones",
    etiqueta: "Conexiones",
    icono: Plug,
    alias: [
      "integraciones",
      "conexiones",
      "claves",
      "github",
      "canva",
      "lovable",
      "plaud",
      "servicios externos",
    ],
    descripcion: "Todo lo de fuera, comprobado en verde o rojo.",
  },
];

/** Catalogue remains searchable; the sidebar follows the user's work process. */
const CATALOGO = [...FIJOS_ORIGINALES,...GRUPOS_ORIGINALES.flatMap(g=>g.pantallas),...PIE_ORIGINAL];
const pantallas = (...rutas: RutaMenu[]): PantallaMenu[] => rutas.map(to => {
  const pantalla=CATALOGO.find(p=>p.to===to);
  if (!pantalla) throw new Error(`Ruta de menú sin catálogo: ${to}`);
  return pantalla;
});
export const FIJOS_ARRIBA: PantallaMenu[] = pantallas("/","/pideme","/personal","/gasto-ia").map(p=>({...p,etiqueta:p.to==="/pideme"?"Pedir trabajo":p.to==="/personal"?"Personal":p.to==="/gasto-ia"?"Consumo":p.etiqueta}));
export const GRUPOS_MENU: GrupoMenu[] = [
 {id:"productos",titulo:"Productos y proyectos",icono:Boxes,pantallas:pantallas("/proyectos")},
 {id:"trabajo",titulo:"Trabajo",icono:ListTodo,pantallas:pantallas("/tareas","/aprobaciones","/ejecucion","/bandeja","/avisos","/asistente","/mesa","/resumenes","/vigilancia")},
 {id:"entregas",titulo:"Entregas y documentación",icono:BookMarked,pantallas:pantallas("/documentacion","/manuales","/voz","/compilaciones","/repositorios","/calidad")},
 {id:"operaciones",titulo:"Operaciones",icono:Server,pantallas:pantallas("/salud","/infraestructura","/dominios","/copias","/auditoria","/estado")},
 {id:"clientes",titulo:"Clientes",icono:Users,pantallas:pantallas("/usuarios-clientes","/modo-cliente","/facturacion")},
 {id:"configuracion",titulo:"Configuración",icono:Settings,pantallas:pantallas("/ajustes","/ajustes/proveedores","/conexiones","/proyectian","/expertos","/agentes","/habilidades","/revisores","/personal/estilo")},
];
export const ANCLADOS_PIE: PantallaMenu[] = pantallas("/guia");

/* ------------------------------- Utilidades ------------------------------- */

export const TODAS_LAS_PANTALLAS: PantallaMenu[] = [
  ...FIJOS_ARRIBA,
  ...GRUPOS_MENU.flatMap((g) => g.pantallas),
  ...ANCLADOS_PIE,
  ...CATALOGO.filter(p=>![...FIJOS_ARRIBA,...GRUPOS_MENU.flatMap(g=>g.pantallas),...ANCLADOS_PIE].some(v=>v.to===p.to)),
];

const NOMBRE_GRUPO: Record<string, string> = {
  fijos: "Accesos directos",
  pie: "Configuración",
  ...Object.fromEntries(GRUPOS_MENU.map((g) => [g.id, g.titulo])),
};

/** Grupo (o zona) en la que vive cada ruta. */
export function grupoDePantalla(to: string): { id: string; titulo: string } {
  if (FIJOS_ARRIBA.some((p) => p.to === to)) return { id: "fijos", titulo: NOMBRE_GRUPO["fijos"] ?? "" };
  const grupo = GRUPOS_MENU.find((g) => g.pantallas.some((p) => p.to === to));
  if (grupo) return { id: grupo.id, titulo: grupo.titulo };
  return { id: "pie", titulo: NOMBRE_GRUPO["pie"] ?? "" };
}

/** Grupo que debe abrirse para una ruta del navegador. */
export function grupoDeRuta(ruta: string): string | null {
  const grupo = GRUPOS_MENU.find((g) =>
    g.pantallas.some((p) => (p.to === "/" ? ruta === "/" : ruta.startsWith(p.to))),
  );
  return grupo?.id ?? null;
}

/** ¿Está activa esta pantalla para la ruta actual? */
export function esRutaActiva(to: string, ruta: string) {
  if (to === "/") return ruta === "/";
  if (to === "/ajustes") return ruta === "/ajustes";
  return ruta === to || ruta.startsWith(`${to}/`);
}

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export type ResultadoBusqueda = { pantalla: PantallaMenu; grupo: string };

/** Busca pantallas por etiqueta, sinónimos y descripción (a partir de dos letras). */
export function buscarPantallas(consulta: string): ResultadoBusqueda[] {
  const q = normalizar(consulta.trim());
  if (q.length < 2) return [];
  const puntuar = (p: PantallaMenu) => {
    const etiqueta = normalizar(p.etiqueta);
    if (etiqueta.startsWith(q)) return 100;
    if (etiqueta.includes(q)) return 80;
    if (p.alias.some((a) => normalizar(a).startsWith(q))) return 60;
    if (p.alias.some((a) => normalizar(a).includes(q))) return 45;
    if (normalizar(p.descripcion).includes(q)) return 25;
    return 0;
  };
  return TODAS_LAS_PANTALLAS.map((pantalla) => ({ pantalla, puntos: puntuar(pantalla) }))
    .filter((r) => r.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .map((r) => ({ pantalla: r.pantalla, grupo: grupoDePantalla(r.pantalla.to).titulo }));
}

/* ------------------ Accesos rápidos de la barra del móvil ----------------- */

export const CLAVE_ACCESOS_MOVIL = "nexdeveloper-accesos-movil";

export const ACCESOS_MOVIL_POR_DEFECTO: RutaMenu[] = ["/", "/pideme", "/tareas", "/avisos"];

export function pantallaPorRuta(to: string): PantallaMenu | undefined {
  return TODAS_LAS_PANTALLAS.find((p) => p.to === to);
}

export function leerAccesosMovil(): RutaMenu[] {
  if (typeof window === "undefined") return ACCESOS_MOVIL_POR_DEFECTO;
  try {
    const crudo = window.localStorage.getItem(CLAVE_ACCESOS_MOVIL);
    if (!crudo) return ACCESOS_MOVIL_POR_DEFECTO;
    const lista = JSON.parse(crudo) as string[];
    const validos = lista.filter((r) => pantallaPorRuta(r)) as RutaMenu[];
    return validos.length === 4 ? validos : ACCESOS_MOVIL_POR_DEFECTO;
  } catch {
    return ACCESOS_MOVIL_POR_DEFECTO;
  }
}

export function guardarAccesosMovil(rutas: RutaMenu[]) {
  try {
    window.localStorage.setItem(CLAVE_ACCESOS_MOVIL, JSON.stringify(rutas));
    window.dispatchEvent(new CustomEvent("nexdeveloper:accesos-movil"));
  } catch {
    /* sin almacenamiento */
  }
}

export const CLAVE_GRUPO_ABIERTO = "nexdeveloper-menu-grupo";
export const CLAVE_MENU_CONTRAIDO = "nexdeveloper-menu-contraido";

/** Cuenta del propietario: la única que ve la pantalla «Revisores». */
export const PROPIETARIO_ID = "59e35aca-cf1f-44c1-9693-8a48e11f55cc";

/** Grupos del menú visibles para el usuario; «Revisores» solo la ve el propietario. */
export function gruposVisibles(usuarioId: string | undefined): GrupoMenu[] {
  if (usuarioId === PROPIETARIO_ID) return GRUPOS_MENU;
  return GRUPOS_MENU.map((g) => ({
    ...g,
    pantallas: g.pantallas.filter((p) => p.to !== "/revisores"),
  })).filter((g) => g.pantallas.length > 0);
}
