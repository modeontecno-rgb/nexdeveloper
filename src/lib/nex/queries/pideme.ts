import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type {
  ClasificacionPeticion,
  DestinoPeticion,
  EstadoGrabacionPlaud,
  EstadoPeticion,
  PeticionDirectaRow,
  PlaudGrabacionRow,
  TipoPeticion,
} from "../db-types";
import { supabase } from "../supabase";

export const clavesPideme = {
  estado: ["pideme_estado"] as const,
  peticiones: ["pideme_peticiones"] as const,
  grabaciones: ["pideme_grabaciones"] as const,
  grabacion: (id: string) => ["pideme_grabacion", id] as const,
};

/* --------------------------------- Textos --------------------------------- */

export const ETIQUETA_DESTINO: Record<DestinoPeticion, string> = {
  proyecto: "Proyecto",
  personal: "PERSONAL",
};

export const ETIQUETA_TIPO_PETICION: Record<TipoPeticion, string> = {
  consulta: "consulta",
  modificacion: "cambio en el proyecto",
  tareas: "tareas",
  personal: "personal",
};

export const ETIQUETA_ESTADO_PETICION: Record<EstadoPeticion, string> = {
  nueva: "Nueva",
  clasificada: "Clasificada",
  respondida: "Respondida",
  propuesta: "Propuesta pendiente",
  aprobada: "Aprobada",
  descartada: "Descartada",
  error: "Con error",
};

export const TONO_ESTADO_PETICION: Record<EstadoPeticion, string> = {
  nueva: "border-border bg-muted text-muted-foreground",
  clasificada: "border-border bg-muted text-muted-foreground",
  respondida: "border-success/40 bg-success/10 text-success",
  propuesta: "border-warning/40 bg-warning/10 text-warning",
  aprobada: "border-primary/40 bg-primary/10 text-primary",
  descartada: "border-border bg-muted text-muted-foreground",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

export const ETIQUETA_ESTADO_GRABACION: Record<EstadoGrabacionPlaud, string> = {
  importada: "Importada",
  clasificada: "Clasificada",
  procesada: "Procesada",
  descartada: "Descartada",
};

/** Color del veredicto o la recomendación de una propuesta. */
export function tonoVeredicto(texto: string | null | undefined) {
  const t = (texto ?? "").toLowerCase();
  if (/(no|rechaz|bloque|grave|alto)/.test(t)) return "border-destructive/40 bg-destructive/10 text-destructive";
  if (/(reserva|condicion|medio|revisar|duda)/.test(t)) return "border-warning/40 bg-warning/10 text-warning";
  if (/(s[ií]|aprob|adelante|bajo|correcto|recomend)/.test(t)) return "border-success/40 bg-success/10 text-success";
  return "border-border bg-muted text-muted-foreground";
}

/* -------------------------------- Llamadas -------------------------------- */

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("pideme", { body: cuerpo });
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

export type EstadoPlaud = {
  estado?: string;
  cuenta?: string | null;
  ultimo_error?: string | null;
  ultima_comprobacion?: string | null;
};

export type PlaudConfig = {
  importar_automatico?: boolean;
  procesar_automatico?: boolean;
  desde?: string | null;
};

export type EstadoPideme = {
  ok?: boolean;
  plaud?: EstadoPlaud;
  plaud_config?: PlaudConfig;
  peticiones?: PeticionDirectaRow[];
  grabaciones?: PlaudGrabacionRow[];
  ia?: { slug: string; modelo?: string }[];
  propuestas_pendientes?: number;
};

export function useEstadoPideme(habilitado = true) {
  return useQuery({
    queryKey: clavesPideme.estado,
    enabled: habilitado,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("pideme", { body: { accion: "estado" } });
      if (error) throw new Error(error.message);
      return (data ?? {}) as EstadoPideme;
    },
  });
}

export function usePeticiones() {
  return useQuery({
    queryKey: clavesPideme.peticiones,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peticiones_directas")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as PeticionDirectaRow[];
    },
  });
}

export function useGrabacionesPlaud() {
  return useQuery({
    queryKey: clavesPideme.grabaciones,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plaud_grabaciones")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as PlaudGrabacionRow[];
    },
  });
}

/** Mantiene al día peticiones y grabaciones. */
export function useRealtimePideme(activo = true) {
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!activo) return;
    const canal = supabase.channel("nexdeveloper-pideme");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "peticiones_directas" }, () => {
      void queryClient.invalidateQueries({ queryKey: clavesPideme.peticiones });
      void queryClient.invalidateQueries({ queryKey: clavesPideme.estado });
    });
    canal.on("postgres_changes", { event: "*", schema: "public", table: "plaud_grabaciones" }, () => {
      void queryClient.invalidateQueries({ queryKey: clavesPideme.grabaciones });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [activo, queryClient]);
}

function useInvalidar() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: clavesPideme.peticiones });
    void queryClient.invalidateQueries({ queryKey: clavesPideme.grabaciones });
    void queryClient.invalidateQueries({ queryKey: clavesPideme.estado });
  };
}

export type RespuestaPedir = {
  peticion?: PeticionDirectaRow;
  clasificacion?: ClasificacionPeticion;
  url?: string;
  chat_id?: string;
  conversacion_id?: string;
  respuesta?: string;
  propuesta?: PeticionDirectaRow["propuesta"];
  tareas?: { id?: string; titulo?: string }[];
};

/** Envía lo que pide Javier: NexDeveloper decide a dónde va. Tarda entre 10 y 60 segundos. */
export function usePedir() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { texto: string; origen?: "texto" | "voz" }) =>
      llamar<RespuestaPedir>({ accion: "pedir", texto: v.texto, origen: v.origen ?? "texto" }),
    onSuccess: () => invalidar(),
    onError: (e: Error) => {
      invalidar();
      toast.error(e.message);
    },
  });
}

export function useReclasificar() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: {
      peticionId: string;
      destino: DestinoPeticion;
      proyectoId?: string;
      tipo?: TipoPeticion;
      alias?: string[];
    }) =>
      llamar({
        accion: "reclasificar",
        peticion_id: v.peticionId,
        destino: v.destino,
        ...(v.proyectoId ? { proyecto_id: v.proyectoId } : {}),
        ...(v.tipo ? { tipo: v.tipo } : {}),
        ...(v.alias?.length ? { alias: v.alias } : {}),
      }),
    onSuccess: () => {
      invalidar();
      toast.success("Corregido. La próxima vez lo reconoceré.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAprobarPropuesta() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { peticionId: string; orden?: string; ejecutarCon?: string }) =>
      llamar<{ orden_id?: string }>({
        accion: "aprobar_propuesta",
        peticion_id: v.peticionId,
        ...(v.orden ? { orden: v.orden } : {}),
        ...(v.ejecutarCon ? { ejecutar_con: v.ejecutarCon } : {}),
      }),
    onSuccess: () => {
      invalidar();
      toast.success("Orden creada para la IA.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRechazarPropuesta() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { peticionId: string; motivo?: string }) =>
      llamar({ accion: "rechazar_propuesta", peticion_id: v.peticionId, ...(v.motivo ? { motivo: v.motivo } : {}) }),
    onSuccess: () => {
      invalidar();
      toast.success("Propuesta rechazada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBorrarPeticion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (peticionId: string) => llamar({ accion: "borrar_peticion", peticion_id: peticionId }),
    onSuccess: () => {
      invalidar();
      toast.success("Petición borrada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ---------------------------------- Plaud --------------------------------- */

export function usePlaudConectar() {
  return useMutation({
    mutationFn: () => llamar<{ url?: string }>({ accion: "plaud_conectar" }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePlaudDesconectar() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: () => llamar({ accion: "plaud_desconectar" }),
    onSuccess: () => {
      invalidar();
      toast.success("Plaud desconectado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePlaudProbar() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: () => llamar<{ cuenta?: string; grabaciones_vistas?: number }>({ accion: "plaud_probar" }),
    onSuccess: (r) => {
      invalidar();
      toast.success(`Conexión correcta: ${r.cuenta ?? "cuenta de Plaud"} · ${r.grabaciones_vistas ?? 0} grabaciones.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePlaudConfigurar() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { importar_automatico: boolean; procesar_automatico: boolean; desde: string | null }) =>
      llamar({ accion: "plaud_configurar", ...v }),
    onSuccess: () => {
      invalidar();
      toast.success("Configuración de Plaud guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePlaudImportar() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v?: { maximo?: number }) =>
      llamar<{ nuevas?: number; total_plaud?: number }>({
        accion: "plaud_importar",
        ...(v?.maximo ? { maximo: v.maximo } : {}),
      }),
    onSuccess: (r) => {
      invalidar();
      toast.success(`${r.nuevas ?? 0} grabaciones nuevas de ${r.total_plaud ?? 0} en Plaud.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type ProcesadaPlaud = { id: string; nombre?: string; destino?: string; proyecto?: string; tipo?: string; url?: string };

export function usePlaudProcesar() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v?: { grabacionId?: string }) =>
      llamar<{ procesadas?: ProcesadaPlaud[] }>({
        accion: "plaud_procesar",
        ...(v?.grabacionId ? { grabacion_id: v.grabacionId } : {}),
      }),
    onSuccess: (r) => {
      invalidar();
      toast.success(`${r.procesadas?.length ?? 0} grabaciones procesadas.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGrabacionPlaud(grabacionId: string | null) {
  return useQuery({
    queryKey: clavesPideme.grabacion(grabacionId ?? ""),
    enabled: Boolean(grabacionId),
    queryFn: () => llamar<{ grabacion?: PlaudGrabacionRow }>({ accion: "plaud_grabacion", grabacion_id: grabacionId }),
  });
}

export function usePlaudDescartar() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (grabacionId: string) => llamar({ accion: "plaud_descartar", grabacion_id: grabacionId }),
    onSuccess: () => {
      invalidar();
      toast.success("Grabación descartada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Segundos a texto corto: 1 h 05 min. */
export function duracion(segundos: number | null | undefined) {
  const s = Number(segundos ?? 0);
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}
