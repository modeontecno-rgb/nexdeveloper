import * as React from "react";

import {
  ACTIVIDAD,
  AGENTES,
  ALERTAS,
  INTEGRACIONES,
  MENSAJES,
  PREVIEWS,
  PROYECTOS,
  TAREAS,
} from "./demo-data";
import type {
  Agente,
  Alerta,
  Aprobacion,
  EstadoTarea,
  EventoActividad,
  Integracion,
  Mensaje,
  Preview,
  Prioridad,
  Proyecto,
  Tarea,
} from "./types";

const CLAVE = "nexdeveloper-estado-v1";

interface Estado {
  proyectos: Proyecto[];
  tareas: Tarea[];
  agentes: Agente[];
  mensajes: Mensaje[];
  actividad: EventoActividad[];
  previews: Preview[];
  integraciones: Integracion[];
  alertas: Alerta[];
  aprobaciones: Aprobacion[];
  usuario: string;
}

const estadoInicial: Estado = {
  proyectos: PROYECTOS,
  tareas: TAREAS,
  agentes: AGENTES,
  mensajes: MENSAJES,
  actividad: ACTIVIDAD,
  previews: PREVIEWS,
  integraciones: INTEGRACIONES,
  alertas: ALERTAS,
  aprobaciones: [],
  usuario: "Javier Romero",
};

interface Contexto extends Estado {
  origenDatos: "demostracion" | "base_de_datos";
  completarTarea: (id: string) => void;
  cambiarEstadoTarea: (id: string, estado: EstadoTarea) => void;
  cambiarPrioridadTarea: (id: string, prioridad: Prioridad) => void;
  moverTarea: (id: string, proyectoId: string) => void;
  enviarMensaje: (proyectoId: string, texto: string) => void;
  crearOrden: (input: {
    proyectoId: string;
    texto: string;
    agenteId: string | null;
    costeEstimado: number;
    estimacionHoras: number;
    prioridad: Prioridad;
  }) => void;
  solicitarAprobacion: (input: Omit<Aprobacion, "id" | "estado" | "solicitadaEl">) => void;
  resolverAprobacion: (id: string, decision: "aprobada" | "rechazada", comentario?: string) => void;
  crearProyecto: (input: { nombre: string; descripcion: string; repositorio?: string | undefined }) => string;
  reiniciarDemo: () => void;
}

const Ctx = React.createContext<Contexto | null>(null);

function cargar(): Estado {
  if (typeof window === "undefined") return estadoInicial;
  try {
    const bruto = window.localStorage.getItem(CLAVE);
    if (!bruto) return estadoInicial;
    return { ...estadoInicial, ...(JSON.parse(bruto) as Estado) };
  } catch {
    return estadoInicial;
  }
}

export function ProveedorNex({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = React.useState<Estado>(estadoInicial);
  const [hidratado, setHidratado] = React.useState(false);

  React.useEffect(() => {
    setEstado(cargar());
    setHidratado(true);
  }, []);

  React.useEffect(() => {
    if (!hidratado) return;
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [estado, hidratado]);

  const registrar = (proyectoId: string, tipo: EventoActividad["tipo"], texto: string) => ({
    id: `ev-${Math.random().toString(36).slice(2, 10)}`,
    proyectoId,
    tipo,
    texto,
    fecha: new Date().toISOString(),
  });

  const valor: Contexto = {
    ...estado,
    origenDatos: "demostracion",
    completarTarea: (id) =>
      setEstado((e) => {
        const tarea = e.tareas.find((t) => t.id === id);
        return {
          ...e,
          tareas: e.tareas.map((t) =>
            t.id === id
              ? {
                  ...t,
                  estado: "completada" as EstadoTarea,
                  progreso: 100,
                  horasConsumidas: Math.max(t.horasConsumidas, t.estimacionHoras),
                  completadaPor: e.usuario,
                  completadaEl: new Date().toISOString(),
                  ultimaActividad: new Date().toISOString(),
                }
              : t,
          ),
          actividad: tarea
            ? [
                registrar(tarea.proyectoId, "cambio", `«${tarea.titulo}» marcada como completada por ${e.usuario}`),
                ...e.actividad,
              ]
            : e.actividad,
        };
      }),
    cambiarEstadoTarea: (id, nuevo) =>
      setEstado((e) => {
        const tarea = e.tareas.find((t) => t.id === id);
        return {
          ...e,
          tareas: e.tareas.map((t) =>
            t.id === id ? { ...t, estado: nuevo, ultimaActividad: new Date().toISOString() } : t,
          ),
          actividad: tarea
            ? [registrar(tarea.proyectoId, "cambio", `«${tarea.titulo}» pasa a ${nuevo}`), ...e.actividad]
            : e.actividad,
        };
      }),
    cambiarPrioridadTarea: (id, prioridad) =>
      setEstado((e) => ({
        ...e,
        tareas: e.tareas.map((t) => (t.id === id ? { ...t, prioridad } : t)),
      })),
    moverTarea: (id, proyectoId) =>
      setEstado((e) => {
        const tarea = e.tareas.find((t) => t.id === id);
        if (!tarea) return e;
        const destino = e.proyectos.find((p) => p.id === proyectoId);
        return {
          ...e,
          tareas: e.tareas.map((t) => (t.id === id ? { ...t, proyectoId } : t)),
          actividad: [
            registrar(
              proyectoId,
              "reorganizacion",
              `«${tarea.titulo}» movida manualmente a ${destino?.nombre ?? proyectoId} (origen: ${tarea.proyectoId})`,
            ),
            ...e.actividad,
          ],
        };
      }),
    enviarMensaje: (proyectoId, texto) =>
      setEstado((e) => ({
        ...e,
        mensajes: [
          ...e.mensajes,
          {
            id: `m-${Math.random().toString(36).slice(2, 10)}`,
            proyectoId,
            autor: "usuario",
            texto,
            fecha: new Date().toISOString(),
          },
        ],
        actividad: [registrar(proyectoId, "actividad", "Nuevo mensaje en el chat del proyecto"), ...e.actividad],
      })),
    crearOrden: ({ proyectoId, texto, agenteId, costeEstimado, estimacionHoras, prioridad }) =>
      setEstado((e) => ({
        ...e,
        tareas: [
          {
            id: `t-${Math.random().toString(36).slice(2, 10)}`,
            proyectoId,
            titulo: texto.slice(0, 80),
            estado: "en_cola",
            agenteId,
            prioridad,
            enviadaEl: new Date().toISOString(),
            estimacionHoras,
            horasConsumidas: 0,
            costeEstimado,
            costeConsumido: 0,
            progreso: 0,
            ultimaActividad: new Date().toISOString(),
          },
          ...e.tareas,
        ],
        mensajes: [
          ...e.mensajes,
          {
            id: `m-${Math.random().toString(36).slice(2, 10)}`,
            proyectoId,
            autor: "usuario",
            texto,
            fecha: new Date().toISOString(),
          },
        ],
        actividad: [registrar(proyectoId, "orden", `Orden aprobada y enviada a la cola: ${texto.slice(0, 60)}`), ...e.actividad],
      })),
    solicitarAprobacion: (input) =>
      setEstado((e) => ({
        ...e,
        aprobaciones: [
          { ...input, id: `ap-${Math.random().toString(36).slice(2, 10)}`, estado: "pendiente", solicitadaEl: new Date().toISOString() },
          ...e.aprobaciones,
        ],
        actividad: [
          registrar(input.proyectoId, "decision", `Orden pendiente de aprobación: ${input.texto.slice(0, 60)}`),
          ...e.actividad,
        ],
      })),
    resolverAprobacion: (id, decision, comentario) =>
      setEstado((e) => {
        const ap = e.aprobaciones.find((a) => a.id === id);
        if (!ap) return e;
        const aprobaciones = e.aprobaciones.map((a) =>
          a.id === id
            ? { ...a, estado: decision, resueltaEl: new Date().toISOString(), resueltaPor: e.usuario, comentario }
            : a,
        );
        if (decision === "rechazada") {
          return {
            ...e,
            aprobaciones,
            actividad: [
              registrar(ap.proyectoId, "decision", `Orden rechazada por ${e.usuario}: ${ap.texto.slice(0, 60)}`),
              ...e.actividad,
            ],
          };
        }
        return {
          ...e,
          aprobaciones,
          tareas: [
            {
              id: `t-${Math.random().toString(36).slice(2, 10)}`,
              proyectoId: ap.proyectoId,
              titulo: ap.texto.slice(0, 80),
              estado: "en_cola" as EstadoTarea,
              agenteId: ap.agenteId,
              prioridad: ap.prioridad,
              enviadaEl: new Date().toISOString(),
              estimacionHoras: ap.estimacionHoras,
              horasConsumidas: 0,
              costeEstimado: ap.costeEstimado,
              costeConsumido: 0,
              progreso: 0,
              ultimaActividad: new Date().toISOString(),
            },
            ...e.tareas,
          ],
          actividad: [
            registrar(ap.proyectoId, "orden", `Orden aprobada por ${e.usuario} y enviada a la cola: ${ap.texto.slice(0, 60)}`),
            ...e.actividad,
          ],
        };
      }),
    crearProyecto: ({ nombre, descripcion, repositorio }) => {
      const id = `${nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      setEstado((e) => ({
        ...e,
        proyectos: [
          {
            id,
            nombre,
            descripcion,
            estado: "planificando",
            prioridad: "media",
            presupuesto: 0,
            consumido: 0,
            repositorio,
            agentes: [],
            alertas: [],
            actualizadoEl: new Date().toISOString(),
          },
          ...e.proyectos,
        ],
        actividad: [registrar(id, "cambio", `Proyecto «${nombre}» creado`), ...e.actividad],
      }));
      return id;
    },
    reiniciarDemo: () => setEstado(estadoInicial),
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useNex() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useNex debe usarse dentro de ProveedorNex");
  return ctx;
}

export function resumenPlan(tareas: Tarea[]) {
  const total = tareas.length;
  const completadas = tareas.filter((t) => t.estado === "completada").length;
  const ejecutando = tareas.filter((t) => t.estado === "ejecutando").length;
  const pendientes = total - completadas - ejecutando;
  const esfuerzoTotal = tareas.reduce((s, t) => s + t.estimacionHoras, 0);
  const esfuerzoRestante = tareas
    .filter((t) => t.estado !== "completada")
    .reduce((s, t) => s + Math.max(0, t.estimacionHoras - t.horasConsumidas), 0);
  // Con ejecución en paralelo, la fecha real la marca la tarea que termina más tarde.
  const restantePorTarea = tareas
    .filter((t) => t.estado !== "completada")
    .map((t) => Math.max(0, t.estimacionHoras - t.horasConsumidas) * (t.estado === "bloqueada" ? 2 : 1));
  const cuelloBotella = restantePorTarea.length ? Math.max(...restantePorTarea) : 0;
  const finPrevisto = new Date(Date.now() + cuelloBotella * 3600000 * 3).toISOString();
  const costeEstimado = tareas.reduce((s, t) => s + t.costeEstimado, 0);
  const costeConsumido = tareas.reduce((s, t) => s + t.costeConsumido, 0);
  return {
    total,
    completadas,
    pendientes,
    ejecutando,
    esfuerzoTotal,
    esfuerzoRestante,
    cuelloBotella,
    finPrevisto,
    costeEstimado,
    costeConsumido,
  };
}
