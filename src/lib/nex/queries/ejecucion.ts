import { useSeguirTrabajo } from "@/components/nex/indicador-trabajo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type {
  EjecucionConfigRow,
  EjecucionOrdenRow,
  EstadoEjecucion,
  ModoTrabajoEjecucion,
  MotorEjecucion,
} from "../db-types";
import { supabase } from "../supabase";
import { claves } from "./claves";

export const clavesEjecucion = {
  estado: ["ejecucion_estado"] as const,
  ejecuciones: ["ejecuciones_orden"] as const,
  config: ["ejecucion_config"] as const,
};

export const ETIQUETA_ESTADO_EJECUCION: Record<EstadoEjecucion, string> = {
  en_cola: "En cola",
  enviando: "Enviando",
  construyendo: "Construyendo",
  comprobando: "Comprobando",
  esperando_aprobacion: "Esperando tu aprobación",
  publicando: "Publicando",
  completada: "Completada",
  error: "Error",
  cancelada: "Cancelada",
};

/** Línea de pasos que se muestra en cada ejecución. */
export const PASOS_EJECUCION: EstadoEjecucion[] = [
  "en_cola",
  "enviando",
  "construyendo",
  "comprobando",
  "esperando_aprobacion",
  "publicando",
  "completada",
];

export const ETIQUETA_MOTOR: Record<MotorEjecucion, string> = {
  auto: "Automático",
  lovable: "Lovable",
  claude: "Claude + GitHub",
};

export const EXPLICACION_MOTOR: Record<MotorEjecucion, string> = {
  auto: "NexDeveloper elige el motor según lo que esté disponible en cada proyecto.",
  lovable: "Usa los créditos de Lovable y publica solo, sin pasar por GitHub.",
  claude: "Usa tu clave de Anthropic, abre una solicitud de cambios en GitHub y Lovable la sincroniza.",
};

export const ETIQUETA_MODO_TRABAJO: Record<ModoTrabajoEjecucion, string> = {
  construir: "Construir",
  planificar: "Solo planificar",
};

export type ConexionLovable = {
  estado?: "desconectada" | "conectada" | "error";
  cuenta?: string | null;
  ultimo_error?: string | null;
  ultima_comprobacion?: string | null;
};

export type EstadoEjecucionGeneral = {
  ok?: boolean;
  conexion?: ConexionLovable | null;
  config?: EjecucionConfigRow | null;
  proyectos_sin_lovable?: number;
  motor_claude_listo?: boolean;
  github_token?: boolean;
  clave_anthropic?: boolean;
  url_callback?: string | null;
  client_id?: string | null;
};

export type PruebaConexiones = {
  ok?: boolean;
  lovable?: { ok?: boolean; cuenta?: string | null; error?: string | null };
  github?: { ok?: boolean; cuenta?: string | null; error?: string | null };
  anthropic?: { ok?: boolean; error?: string | null };
};

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("ordenes-ejecutar", { body: cuerpo });
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

/** Estado de la conexión con Lovable, la configuración y los motores disponibles. */
export function useEstadoEjecucion(habilitado = true) {
  return useQuery({
    queryKey: clavesEjecucion.estado,
    enabled: habilitado,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ordenes-ejecutar", { body: { accion: "estado" } });
      if (error) throw new Error(error.message);
      return (data ?? {}) as EstadoEjecucionGeneral;
    },
  });
}

export function useEjecuciones() {
  return useQuery({
    queryKey: clavesEjecucion.ejecuciones,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ejecuciones_orden")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as EjecucionOrdenRow[];
    },
  });
}

export function useEjecucionConfig() {
  return useQuery({
    queryKey: clavesEjecucion.config,
    queryFn: async () => {
      const { data, error } = await supabase.from("ejecucion_config").select("*").limit(1);
      if (error) throw new Error(error.message);
      return ((data ?? [])[0] ?? null) as EjecucionConfigRow | null;
    },
  });
}

/** Mantiene la lista de ejecuciones al día mientras se construye el trabajo. */
export function useRealtimeEjecuciones(activo: boolean) {
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!activo) return;
    const canal = supabase
      .channel("nexdeveloper-ejecuciones")
      .on("postgres_changes", { event: "*", schema: "public", table: "ejecuciones_orden" }, () => {
        void queryClient.invalidateQueries({ queryKey: clavesEjecucion.ejecuciones });
        void queryClient.invalidateQueries({ queryKey: claves.ordenes });
        void queryClient.invalidateQueries({ queryKey: claves.tareasAtencion });
      });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [activo, queryClient]);
}

function useRefrescar() {
  const queryClient = useQueryClient();
  return React.useCallback(() => {
    for (const clave of [
      clavesEjecucion.ejecuciones,
      clavesEjecucion.estado,
      clavesEjecucion.config,
      claves.ordenes,
      claves.tareas,
      claves.tareasAtencion,
      claves.proyectos,
    ]) {
      void queryClient.invalidateQueries({ queryKey: clave });
    }
  }, [queryClient]);
}

export function useConectarLovable() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: () => llamar<{ url?: string; aviso?: string; registro_dinamico?: boolean }>({ accion: "conectar" }),
    onSuccess: (r) => {
      if (r.url) window.open(r.url, "_blank", "noopener,noreferrer");
      if (r.aviso) toast.warning(r.aviso);
      else toast.success("Abre la ventana de Lovable y autoriza la conexión.");
      window.setTimeout(refrescar, 4000);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDesconectarLovable() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: () => llamar({ accion: "desconectar" }),
    onSuccess: () => {
      refrescar();
      toast.success("Lovable desconectado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useProbarConexiones() {
  const seguirTrabajo = useSeguirTrabajo('Probando las conexiones de ejecución');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: () => llamar<PruebaConexiones>({ accion: "probar" }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGuardarConfigEjecucion() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (cambios: Partial<Omit<EjecucionConfigRow, "id" | "user_id">>) =>
      llamar<{ config?: EjecucionConfigRow }>({ accion: "configurar", ...cambios }),
    onSuccess: () => {
      refrescar();
      toast.success("Configuración guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAsignarLovable() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (input: { proyectoId: string; lovable: string }) =>
      llamar<{ lovable_project_id?: string }>({
        accion: "asignar_lovable",
        proyecto_id: input.proyectoId,
        lovable: input.lovable,
      }),
    onSuccess: () => {
      refrescar();
      toast.success("Proyecto de Lovable guardado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type EntradaEjecutar = {
  ordenId?: string;
  proyectoId?: string;
  texto?: string;
  prioridad?: string;
  modo?: ModoTrabajoEjecucion;
  motor?: MotorEjecucion;
};

export function useEjecutar() {
  const refrescar = useRefrescar();
  const seguirTrabajo = useSeguirTrabajo('Ejecutando la orden');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: (entrada: EntradaEjecutar) => {
      const cuerpo: Record<string, unknown> = { accion: "ejecutar" };
      if (entrada.ordenId) cuerpo["orden_id"] = entrada.ordenId;
      if (entrada.proyectoId) cuerpo["proyecto_id"] = entrada.proyectoId;
      if (entrada.texto) cuerpo["texto"] = entrada.texto;
      if (entrada.prioridad) cuerpo["prioridad"] = entrada.prioridad;
      if (entrada.modo) cuerpo["modo"] = entrada.modo;
      if (entrada.motor) cuerpo["motor"] = entrada.motor;
      return llamar<{ ejecucion?: EjecucionOrdenRow }>(cuerpo);
    },
    onSuccess: () => {
      refrescar();
      toast.success("Trabajo enviado. Puedes seguir el avance aquí mismo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSondear() {
  const refrescar = useRefrescar();
  const seguirTrabajo = useSeguirTrabajo('Consultando el estado de la ejecución');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: (ejecucionId: string) =>
      llamar<{ ejecucion?: EjecucionOrdenRow }>({ accion: "sondear", ejecucion_id: ejecucionId }),
    onSuccess: () => refrescar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAprobarPublicar() {
  const refrescar = useRefrescar();
  const seguirTrabajo = useSeguirTrabajo('Aprobando y publicando');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: (ejecucionId: string) =>
      llamar<{ ejecucion?: EjecucionOrdenRow }>({ accion: "aprobar_publicar", ejecucion_id: ejecucionId }),
    onSuccess: (r) => {
      refrescar();
      if (r.error) toast.warning(r.error);
      else toast.success("Aprobado. Publicando los cambios.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRechazarEjecucion() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (input: { ejecucionId: string; motivo?: string }) =>
      llamar({
        accion: "rechazar",
        ejecucion_id: input.ejecucionId,
        ...(input.motivo ? { motivo: input.motivo } : {}),
      }),
    onSuccess: () => {
      refrescar();
      toast.success("Cambios rechazados.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelarEjecucion() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (ejecucionId: string) => llamar({ accion: "cancelar", ejecucion_id: ejecucionId }),
    onSuccess: () => {
      refrescar();
      toast.success("No se iniciarán más pasos. Comprueba las operaciones externas que ya estaban en curso.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReintentarEjecucion() {
  const refrescar = useRefrescar();
  const seguirTrabajo = useSeguirTrabajo('Reintentando la ejecución');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: (ejecucionId: string) => llamar<{ejecucion:EjecucionOrdenRow}>({ accion: "reintentar", ejecucion_id: ejecucionId }),
    onSuccess: () => {
      refrescar();
      toast.success("Volviendo a intentarlo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Cuántas ejecuciones esperan la aprobación de Javier. */
export function esperandoAprobacion(ejecuciones: EjecucionOrdenRow[]) {
  return ejecuciones.filter((e) => e.estado === "esperando_aprobacion").length;
}

export function tonoEstadoEjecucion(estado: EstadoEjecucion) {
  if (estado === "completada") return "border-success/40 bg-success/10 text-success";
  if (estado === "error") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (estado === "cancelada") return "border-border bg-muted text-muted-foreground";
  if (estado === "esperando_aprobacion") return "border-warning/40 bg-warning/10 text-warning";
  return "border-primary/40 bg-primary/10 text-primary";
}
