import { useSeguirTrabajo } from "@/components/nex/indicador-trabajo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type { SaludConfigRow, SaludInformeRow, SaludProyectoRow, Semaforo } from "../db-types";
import { supabase } from "../supabase";
import { claves } from "./claves";

export const clavesSalud = {
  estado: ["salud_estado"] as const,
  informes: ["salud_informes"] as const,
  filas: (informeId: string) => ["salud_proyectos", informeId] as const,
};

/* --------------------------------- Textos --------------------------------- */

export const ETIQUETA_SEMAFORO: Record<Semaforo, string> = {
  verde: "Todo correcto",
  ambar: "Revisar",
  rojo: "Problema grave",
  gris: "Sin datos",
};

export const TONO_SEMAFORO: Record<Semaforo, string> = {
  verde: "border-success/40 bg-success/10 text-success",
  ambar: "border-warning/40 bg-warning/10 text-warning",
  rojo: "border-destructive/40 bg-destructive/10 text-destructive",
  gris: "border-border bg-muted text-muted-foreground",
};

export const FONDO_SEMAFORO: Record<Semaforo, string> = {
  verde: "bg-success",
  ambar: "bg-warning",
  rojo: "bg-destructive",
  gris: "bg-muted-foreground/50",
};

const ORDEN_SEMAFORO: Record<Semaforo, number> = { rojo: 0, ambar: 1, verde: 2, gris: 3 };

/** Ordena las filas de un informe: primero lo urgente. */
export function ordenarPorSemaforo(filas: SaludProyectoRow[]) {
  return [...filas].sort(
    (a, b) => ORDEN_SEMAFORO[a.semaforo] - ORDEN_SEMAFORO[b.semaforo] || a.nombre.localeCompare(b.nombre, "es"),
  );
}

/** Texto claro del estado que devuelve Supabase para un proyecto. */
export function etiquetaEstadoSupabase(estado: string | null) {
  if (!estado) return "Sin datos";
  const mapa: Record<string, string> = {
    ACTIVE_HEALTHY: "Activo",
    INACTIVE: "PAUSADO",
    PAUSING: "Pausándose",
    RESTORING: "Restaurándose",
    COMING_UP: "Arrancando",
    GOING_DOWN: "Apagándose",
    INIT_FAILED: "Fallo al iniciar",
    REMOVED: "Eliminado",
    UNKNOWN: "Desconocido",
    ACTIVE_UNHEALTHY: "Activo con problemas",
  };
  return mapa[estado] ?? estado;
}

/** Semáforo de un estado de Supabase, para el chip de la tarjeta. */
export function semaforoEstadoSupabase(estado: string | null): Semaforo {
  if (!estado) return "gris";
  if (estado === "ACTIVE_HEALTHY") return "verde";
  if (estado === "INACTIVE" || estado === "INIT_FAILED" || estado === "REMOVED") return "rojo";
  return "ambar";
}

/** Semáforo de un servicio suelto (auth, db, realtime...). */
export function semaforoServicio(nombre: string, estado: string): Semaforo {
  const activo = /active|healthy|ok|up/i.test(estado);
  if (activo) return "verde";
  if (nombre.toLowerCase() === "realtime") return "gris";
  return "ambar";
}

/** Suma de errores de las últimas 24 horas de un proyecto. */
export function erroresTotales(fila: SaludProyectoRow) {
  return (fila.errores_api_24h ?? 0) + (fila.errores_bd_24h ?? 0) + (fila.errores_funciones_24h ?? 0);
}

/* -------------------------------- Llamadas -------------------------------- */

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("salud", { body: cuerpo });
  const respuesta = (data ?? null) as ({ ok?: boolean; error?: string } & T) | null;
  if (error) {
    let mensaje = (error as Error).message ?? "No se ha podido completar la operación.";
    const http = (error as unknown as { context?: Response }).context;
    if (http && typeof http.json === "function") {
      try {
        const cuerpoError = (await http.clone().json()) as { error?: string };
        if (cuerpoError?.error) mensaje = cuerpoError.error;
      } catch {
        /* sin cuerpo JSON */
      }
    }
    throw new Error(mensaje);
  }
  if (!respuesta || respuesta.ok === false) {
    throw new Error(respuesta?.error ?? "No se ha podido completar la operación.");
  }
  return respuesta;
}

export type EstadoSalud = {
  ok?: boolean;
  config?: SaludConfigRow | null;
  ultimo?: SaludInformeRow | null;
  token_cuenta?: boolean;
  sentry?: boolean;
  sentry_org?: string | null;
};

export type PruebaSalud = {
  ok?: boolean;
  supabase?: { ok?: boolean; proyectos?: number; pausados?: string[]; error?: string | null };
  sentry?: { ok?: boolean; org?: string | null; proyectos?: string[]; error?: string | null };
};

/* --------------------------------- Lecturas -------------------------------- */

export function useEstadoSalud(habilitado = true) {
  return useQuery({
    queryKey: clavesSalud.estado,
    enabled: habilitado,
    queryFn: () => llamar<EstadoSalud>({ accion: "estado" }),
  });
}

/** Los últimos 30 informes, del más reciente al más antiguo. */
export function useInformesSalud() {
  return useQuery({
    queryKey: clavesSalud.informes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salud_informes")
        .select("*")
        .order("iniciado_el", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return (data ?? []) as SaludInformeRow[];
    },
  });
}

/** Filas de proyecto de un informe concreto. */
export function useFilasSalud(informeId: string | null) {
  return useQuery({
    queryKey: clavesSalud.filas(informeId ?? "ninguno"),
    enabled: Boolean(informeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salud_proyectos")
        .select("*")
        .eq("informe_id", informeId as string);
      if (error) throw new Error(error.message);
      return (data ?? []) as SaludProyectoRow[];
    },
  });
}

/** Mantiene la pantalla al día mientras el backend comprueba los proyectos. */
export function useRealtimeSalud(activo = true) {
  const qc = useQueryClient();
  React.useEffect(() => {
    if (!activo) return;
    const canal = supabase.channel("nexdeveloper-salud");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "salud_informes" }, () => {
      void qc.invalidateQueries({ queryKey: clavesSalud.informes });
      void qc.invalidateQueries({ queryKey: clavesSalud.estado });
    });
    canal.on("postgres_changes", { event: "*", schema: "public", table: "salud_proyectos" }, () => {
      void qc.invalidateQueries({ queryKey: ["salud_proyectos"] });
      void qc.invalidateQueries({ queryKey: claves.proyectos });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [activo, qc]);
}

/* -------------------------------- Acciones -------------------------------- */

function useRefrescarSalud() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: clavesSalud.estado });
    void qc.invalidateQueries({ queryKey: clavesSalud.informes });
    void qc.invalidateQueries({ queryKey: ["salud_proyectos"] });
    void qc.invalidateQueries({ queryKey: claves.proyectos });
  };
}

export function useComprobarSalud() {
  const refrescar = useRefrescarSalud();
  const seguirTrabajo = useSeguirTrabajo('Comprobando la salud de la cartera');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: (entrada?: { proyectoId?: string }) =>
      llamar<{ informe?: SaludInformeRow; hecho?: number; hechos?: number; quedan?: number }>({
        accion: "comprobar",
        ...(entrada?.proyectoId ? { proyecto_id: entrada.proyectoId } : {}),
      }),
    onSuccess: (r) => {
      refrescar();
      toast.success(
        r.quedan && r.quedan > 0
          ? `Comprobando… quedan ${r.quedan} proyectos.`
          : "Comprobación en marcha. Verás el resultado aquí mismo.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useProbarSalud() {
  const seguirTrabajo = useSeguirTrabajo('Probando la salud');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: () => llamar<PruebaSalud>({ accion: "probar" }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGuardarConfigSalud() {
  const refrescar = useRefrescarSalud();
  return useMutation({
    mutationFn: (campos: Partial<SaludConfigRow>) =>
      llamar<{ config?: SaludConfigRow }>({ accion: "configurar", ...campos }),
    onSuccess: () => {
      refrescar();
      toast.success("Configuración guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAsignarSentry() {
  const refrescar = useRefrescarSalud();
  return useMutation({
    mutationFn: (entrada: { proyectoId: string; sentrySlug: string }) =>
      llamar({ accion: "asignar_sentry", proyecto_id: entrada.proyectoId, sentry_slug: entrada.sentrySlug }),
    onSuccess: () => {
      refrescar();
      toast.success("Proyecto de Sentry guardado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Crea una tarea de arreglo en el proyecto, con los motivos como descripción. */
export function useCrearTareaSalud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fila: SaludProyectoRow) => {
      if (!fila.proyecto_id) throw new Error("Este informe no está asociado a ningún proyecto de NexDeveloper.");
      const motivos = (fila.motivos ?? []).map((m) => `- ${m}`).join("\n");
      const { error } = await supabase.from("tareas").insert({
        proyecto_id: fila.proyecto_id,
        titulo: `Arreglar la salud de ${fila.nombre}`.slice(0, 120),
        descripcion: `Avisos detectados en la revisión de salud:\n${motivos || "- Sin motivos registrados"}`,
        estado: "en_cola",
        prioridad: fila.semaforo === "rojo" ? "critica" : "alta",
        requiere_atencion: false,
        enviada_el: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: claves.tareas });
      void qc.invalidateQueries({ queryKey: claves.resumenProyectos });
      toast.success("Tarea creada en el proyecto.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
