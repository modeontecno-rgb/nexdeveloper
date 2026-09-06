import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type { AccionAsistente, AsistenteConversacionRow, AsistenteMensajeRow } from "../db-types";
import { supabase } from "../supabase";

export const clavesAsistente = {
  estado: ["asistente_estado"] as const,
  conversaciones: ["asistente_conversaciones"] as const,
  mensajes: ["asistente_mensajes"] as const,
};

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("asistente", { body: cuerpo });
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

export type EstadoAsistente = {
  ok?: boolean;
  proveedores?: { slug: string; modelo: string }[];
  listo?: boolean;
  proyectian?: boolean;
};

/** Proveedores de IA disponibles para el asistente. */
export function useEstadoAsistente(habilitado = true) {
  return useQuery({
    queryKey: clavesAsistente.estado,
    enabled: habilitado,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("asistente", { body: { accion: "estado" } });
      if (error) throw new Error(error.message);
      return (data ?? {}) as EstadoAsistente;
    },
  });
}

export function useConversaciones() {
  return useQuery({
    queryKey: clavesAsistente.conversaciones,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asistente_conversaciones")
        .select("*")
        .order("fijada", { ascending: false })
        .order("actualizado_el", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as AsistenteConversacionRow[];
    },
  });
}

export function useMensajesAsistente(conversacionId: string | null) {
  return useQuery({
    queryKey: [...clavesAsistente.mensajes, conversacionId ?? ""],
    enabled: Boolean(conversacionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asistente_mensajes")
        .select("*")
        .eq("conversacion_id", conversacionId!)
        .order("creado_el", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as AsistenteMensajeRow[];
    },
  });
}

/** Mantiene la conversación al día mientras el asistente responde. */
export function useRealtimeAsistente(activo: boolean) {
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!activo) return;
    const canal = supabase.channel("nexdeveloper-asistente");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "asistente_mensajes" }, () => {
      void queryClient.invalidateQueries({ queryKey: clavesAsistente.mensajes });
    });
    canal.on("postgres_changes", { event: "*", schema: "public", table: "asistente_conversaciones" }, () => {
      void queryClient.invalidateQueries({ queryKey: clavesAsistente.conversaciones });
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
    void queryClient.invalidateQueries({ queryKey: clavesAsistente.conversaciones });
    void queryClient.invalidateQueries({ queryKey: clavesAsistente.mensajes });
  };
}

/** Abre una conversación nueva. */
export function useNuevaConversacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { proyectoId?: string; titulo?: string }) =>
      llamar<{ conversacion?: AsistenteConversacionRow }>({
        accion: "nueva",
        ...(v.proyectoId ? { proyecto_id: v.proyectoId } : {}),
        ...(v.titulo ? { titulo: v.titulo } : {}),
      }),
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export type RespuestaAsistente = {
  conversacion_id?: string;
  mensaje?: AsistenteMensajeRow;
  acciones?: AccionAsistente[];
};

/** Envía la pregunta (tarda entre 5 y 40 segundos). */
export function usePreguntar() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { conversacionId?: string; texto: string; proyectoId?: string; proveedor?: string }) =>
      llamar<RespuestaAsistente>({
        accion: "preguntar",
        texto: v.texto,
        ...(v.conversacionId ? { conversacion_id: v.conversacionId } : {}),
        ...(v.proyectoId ? { proyecto_id: v.proyectoId } : {}),
        ...(v.proveedor ? { proveedor: v.proveedor } : {}),
      }),
    onSuccess: () => invalidar(),
    onError: (e: Error) => {
      invalidar();
      toast.error(e.message);
    },
  });
}

export function useBorrarConversacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (conversacionId: string) => llamar({ accion: "borrar", conversacion_id: conversacionId }),
    onSuccess: () => {
      invalidar();
      toast.success("Conversación borrada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRenombrarConversacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { conversacionId: string; titulo?: string; fijada?: boolean }) =>
      llamar({
        accion: "renombrar",
        conversacion_id: v.conversacionId,
        ...(v.titulo !== undefined ? { titulo: v.titulo } : {}),
        ...(v.fijada !== undefined ? { fijada: v.fijada } : {}),
      }),
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function herramientas(mensaje: AsistenteMensajeRow) {
  return Array.isArray(mensaje.herramientas) ? mensaje.herramientas : [];
}

export function acciones(mensaje: AsistenteMensajeRow) {
  return Array.isArray(mensaje.acciones) ? mensaje.acciones : [];
}
