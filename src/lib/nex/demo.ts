import type { EstadoProyecto, EstadoTarea, NivelAlerta, Prioridad } from "./db-types";
import { supabase } from "./supabase";

const PREFIJO = "demo-";

interface PlantillaProyecto {
  slug: string;
  nombre: string;
  descripcion: string;
  estado: EstadoProyecto;
  prioridad: Prioridad;
  tecnologias: string;
  presupuesto: number;
  consumido: number;
  tareas: { titulo: string; estado: EstadoTarea; horas: number; consumidas: number; coste: number; progreso: number }[];
  previews?: { titulo: string; url: string };
  alerta?: { texto: string; nivel: NivelAlerta };
}

const PLANTILLAS: PlantillaProyecto[] = [
  {
    slug: "nexdeveloper",
    nombre: "NexDeveloper",
    descripcion: "Centro de control multiagente para coordinar todos los proyectos.",
    estado: "ejecutando",
    prioridad: "critica",
    tecnologias: "TypeScript, React, Supabase",
    presupuesto: 4200,
    consumido: 1860,
    tareas: [
      { titulo: "Panel de inicio con métricas", estado: "completada", horas: 12, consumidas: 12, coste: 240, progreso: 100 },
      { titulo: "Cola de trabajo en tiempo real", estado: "ejecutando", horas: 16, consumidas: 7, coste: 320, progreso: 45 },
      { titulo: "Motor de aprobaciones", estado: "en_cola", horas: 10, consumidas: 0, coste: 200, progreso: 0 },
    ],
    previews: { titulo: "Entorno de desarrollo", url: "https://ejemplo.dev/nexdeveloper" },
    alerta: { texto: "Dos agentes al límite de capacidad en NexDeveloper.", nivel: "aviso" },
  },
  {
    slug: "atlas-crm",
    nombre: "Atlas CRM",
    descripcion: "CRM interno con seguimiento de oportunidades y facturación.",
    estado: "esperando_revision",
    prioridad: "alta",
    tecnologias: "TypeScript, PostgreSQL",
    presupuesto: 6500,
    consumido: 4100,
    tareas: [
      { titulo: "Importar cartera de clientes", estado: "completada", horas: 20, consumidas: 22, coste: 440, progreso: 100 },
      { titulo: "Informe de previsión de ventas", estado: "esperando_revision", horas: 14, consumidas: 13, coste: 300, progreso: 90 },
    ],
    alerta: { texto: "Atlas CRM ha consumido el 63% del presupuesto.", nivel: "info" },
  },
  {
    slug: "portal-clientes",
    nombre: "Portal de clientes",
    descripcion: "Área privada con documentos, facturas y soporte.",
    estado: "en_cola",
    prioridad: "media",
    tecnologias: "React, Storage",
    presupuesto: 3800,
    consumido: 900,
    tareas: [
      { titulo: "Acceso con contraseña y recuperación", estado: "en_cola", horas: 9, consumidas: 0, coste: 180, progreso: 0 },
      { titulo: "Descarga de facturas firmadas", estado: "pendiente", horas: 11, consumidas: 0, coste: 220, progreso: 0 },
    ],
  },
  {
    slug: "marca-visual",
    nombre: "Marca visual",
    descripcion: "Identidad, plantillas y piezas gráficas para campañas.",
    estado: "planificando",
    prioridad: "baja",
    tecnologias: "Diseño, Canva",
    presupuesto: 1500,
    consumido: 260,
    tareas: [{ titulo: "Manual de marca en una página", estado: "pendiente", horas: 6, consumidas: 0, coste: 120, progreso: 0 }],
  },
  {
    slug: "motor-informes",
    nombre: "Motor de informes",
    descripcion: "Generación automática de informes mensuales en PDF.",
    estado: "bloqueado",
    prioridad: "alta",
    tecnologias: "Node, PostgreSQL",
    presupuesto: 2900,
    consumido: 1450,
    tareas: [
      { titulo: "Plantilla base del informe", estado: "completada", horas: 8, consumidas: 8, coste: 160, progreso: 100 },
      { titulo: "Conector con la contabilidad", estado: "bloqueada", horas: 12, consumidas: 4, coste: 260, progreso: 30 },
    ],
    alerta: { texto: "El motor de informes está bloqueado por falta de credenciales.", nivel: "critico" },
  },
  {
    slug: "tienda-online",
    nombre: "Tienda online",
    descripcion: "Catálogo, carrito y pasarela de pago.",
    estado: "ejecutando",
    prioridad: "alta",
    tecnologias: "React, Pagos",
    presupuesto: 7200,
    consumido: 3300,
    tareas: [
      { titulo: "Ficha de producto responsive", estado: "ejecutando", horas: 15, consumidas: 6, coste: 300, progreso: 40 },
      { titulo: "Cupones y descuentos", estado: "en_cola", horas: 10, consumidas: 0, coste: 200, progreso: 0 },
    ],
    previews: { titulo: "Tienda de pruebas", url: "https://ejemplo.dev/tienda" },
  },
  {
    slug: "asistente-soporte",
    nombre: "Asistente de soporte",
    descripcion: "Asistente conversacional para primera línea de atención.",
    estado: "pendiente",
    prioridad: "media",
    tecnologias: "Modelos de lenguaje",
    presupuesto: 2400,
    consumido: 120,
    tareas: [{ titulo: "Base de conocimiento inicial", estado: "pendiente", horas: 7, consumidas: 0, coste: 140, progreso: 0 }],
  },
  {
    slug: "web-corporativa",
    nombre: "Web corporativa",
    descripcion: "Sitio público con blog y formulario de contacto.",
    estado: "completado",
    prioridad: "baja",
    tecnologias: "React",
    presupuesto: 1800,
    consumido: 1750,
    tareas: [
      { titulo: "Página de inicio", estado: "completada", horas: 10, consumidas: 10, coste: 200, progreso: 100 },
      { titulo: "Blog con categorías", estado: "completada", horas: 12, consumidas: 11, coste: 240, progreso: 100 },
    ],
    previews: { titulo: "Producción", url: "https://ejemplo.dev/web" },
  },
];

function hace(horas: number) {
  return new Date(Date.now() - horas * 3600000).toISOString();
}

export async function cargarDatosDemostracion() {
  for (const [indice, plantilla] of PLANTILLAS.entries()) {
    const { data: proyecto, error } = await supabase
      .from("proyectos")
      .insert({
        slug: `${PREFIJO}${plantilla.slug}`,
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion,
        estado: plantilla.estado,
        prioridad: plantilla.prioridad,
        tecnologias: plantilla.tecnologias,
        orden: indice,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const proyectoId = proyecto.id;

    await supabase.from("presupuestos").insert({
      proyecto_id: proyectoId,
      concepto: "Presupuesto general",
      importe_previsto: plantilla.presupuesto,
      importe_consumido: plantilla.consumido,
    });

    const { data: chat } = await supabase
      .from("chats")
      .insert({ proyecto_id: proyectoId, titulo: `Chat de ${plantilla.nombre}`, es_principal: true })
      .select("id")
      .single();

    if (chat) {
      await supabase.from("mensajes").insert([
        {
          chat_id: chat.id,
          proyecto_id: proyectoId,
          autor: "usuario",
          texto: `Necesito avanzar con ${plantilla.nombre.toLowerCase()} esta semana.`,
          fecha: hace(30),
        },
        {
          chat_id: chat.id,
          proyecto_id: proyectoId,
          autor: "sistema",
          texto: "Plan de trabajo generado y repartido entre los agentes disponibles.",
          fecha: hace(29),
        },
      ]);
    }

    await supabase.from("tareas").insert(
      plantilla.tareas.map((t, i) => ({
        proyecto_id: proyectoId,
        titulo: t.titulo,
        estado: t.estado,
        prioridad: plantilla.prioridad,
        enviada_el: hace(48 - i * 3),
        estimacion_horas: t.horas,
        horas_consumidas: t.consumidas,
        coste_estimado: t.coste,
        coste_consumido: Math.round(t.coste * (t.progreso / 100)),
        progreso: t.progreso,
        ultima_actividad: hace(i + 1),
        orden: i,
      })),
    );

    await supabase.from("actividad").insert([
      { proyecto_id: proyectoId, tipo: "cambio", texto: `Proyecto «${plantilla.nombre}» actualizado`, fecha: hace(6) },
      { proyecto_id: proyectoId, tipo: "actividad", texto: "Los agentes han sincronizado el plan de trabajo", fecha: hace(12) },
    ]);

    if (plantilla.previews) {
      await supabase.from("previews").insert({
        proyecto_id: proyectoId,
        titulo: plantilla.previews.titulo,
        url: plantilla.previews.url,
        entorno: plantilla.estado === "completado" ? "produccion" : "desarrollo",
      });
    }

    if (plantilla.alerta) {
      await supabase.from("alertas").insert({
        proyecto_id: proyectoId,
        texto: plantilla.alerta.texto,
        nivel: plantilla.alerta.nivel,
        requiere_decision: plantilla.alerta.nivel === "critico",
      });
    }
  }
}

export async function borrarDatosDemostracion() {
  const { data: proyectos, error } = await supabase.from("proyectos").select("id,slug").like("slug", `${PREFIJO}%`);
  if (error) throw new Error(error.message);
  const ids = (proyectos ?? []).map((p) => p.id);
  if (ids.length === 0) return 0;

  await supabase.from("mensajes").delete().in("proyecto_id", ids);
  await supabase.from("chats").delete().in("proyecto_id", ids);
  await supabase.from("tareas").delete().in("proyecto_id", ids);
  await supabase.from("estimaciones").delete().in("proyecto_id", ids);
  await supabase.from("ordenes").delete().in("proyecto_id", ids);
  await supabase.from("previews").delete().in("proyecto_id", ids);
  await supabase.from("alertas").delete().in("proyecto_id", ids);
  await supabase.from("actividad").delete().in("proyecto_id", ids);
  await supabase.from("presupuestos").delete().in("proyecto_id", ids);
  await supabase.from("proyectos").delete().in("id", ids);
  return ids.length;
}
