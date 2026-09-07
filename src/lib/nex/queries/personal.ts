import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type {
  EstiloReescrituraRow,
  ModoPersonal,
  ModoReescritura,
  NotasTutor,
  PersonalConfigRow,
  PersonalConversacionRow,
  PersonalDocumentoRow,
  PersonalMensajeRow,
  RespuestaProveedorPersonal,
} from "../db-types";
import { supabase } from "../supabase";

export const clavesPersonal = {
  estado: ["personal_estado"] as const,
  conversaciones: ["personal_conversaciones"] as const,
  mensajes: (id: string) => ["personal_mensajes", id] as const,
  documentos: ["personal_documentos"] as const,
  documento: (id: string) => ["personal_documento", id] as const,
  reescrituras: ["personal_reescrituras"] as const,
};

export const ETIQUETA_MODO_PERSONAL: Record<ModoPersonal, string> = {
  fusion: "Fusión (la mejor respuesta combinando todas)",
  rapido: "Rápido (la primera IA que responda bien)",
  comparar: "Comparar (ver cada respuesta por separado)",
};

export const ETIQUETA_MODO_REESCRITURA: Record<ModoReescritura, string> = {
  mi_voz: "Mi voz",
  marca: "Guía de un proyecto",
  tutor: "Tutor de redacción",
};

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("personal", { body: cuerpo });
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

export type ProveedorPersonal = { slug: string; nombre?: string; modelo?: string; calidad?: string | number | null };

export type EstadoPersonal = {
  ok?: boolean;
  config?: PersonalConfigRow;
  proveedores?: ProveedorPersonal[];
  conversaciones?: PersonalConversacionRow[];
  documentos?: number;
  almacen?: boolean | string | null;
};

export function useEstadoPersonal(habilitado = true) {
  return useQuery({
    queryKey: clavesPersonal.estado,
    enabled: habilitado,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("personal", { body: { accion: "estado" } });
      if (error) throw new Error(error.message);
      return (data ?? {}) as EstadoPersonal;
    },
  });
}

export function useConversacionesPersonal() {
  return useQuery({
    queryKey: clavesPersonal.conversaciones,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_conversaciones")
        .select("*")
        .order("fijada", { ascending: false })
        .order("actualizado_el", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as PersonalConversacionRow[];
    },
  });
}

export function useMensajesPersonal(conversacionId: string | null) {
  return useQuery({
    queryKey: clavesPersonal.mensajes(conversacionId ?? ""),
    enabled: Boolean(conversacionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_mensajes")
        .select("*")
        .eq("conversacion_id", conversacionId!)
        .order("fecha", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as PersonalMensajeRow[];
    },
  });
}

export function useDocumentosPersonal() {
  return useQuery({
    queryKey: clavesPersonal.documentos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_documentos")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as PersonalDocumentoRow[];
    },
  });
}

export function useDocumentoPersonal(id: string | null) {
  return useQuery({
    queryKey: clavesPersonal.documento(id ?? ""),
    enabled: Boolean(id),
    queryFn: () => llamar<{ documento?: PersonalDocumentoRow }>({ accion: "documento", id }),
  });
}

export function useReescrituras() {
  return useQuery({
    queryKey: clavesPersonal.reescrituras,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estilo_reescrituras")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as EstiloReescrituraRow[];
    },
  });
}

export function useRealtimePersonal(activo = true) {
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!activo) return;
    const canal = supabase.channel("nexdeveloper-personal");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "personal_mensajes" }, () => {
      void queryClient.invalidateQueries({ queryKey: ["personal_mensajes"] });
    });
    canal.on("postgres_changes", { event: "*", schema: "public", table: "personal_conversaciones" }, () => {
      void queryClient.invalidateQueries({ queryKey: clavesPersonal.conversaciones });
    });
    canal.on("postgres_changes", { event: "*", schema: "public", table: "personal_documentos" }, () => {
      void queryClient.invalidateQueries({ queryKey: clavesPersonal.documentos });
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
    void queryClient.invalidateQueries({ queryKey: clavesPersonal.conversaciones });
    void queryClient.invalidateQueries({ queryKey: ["personal_mensajes"] });
    void queryClient.invalidateQueries({ queryKey: clavesPersonal.documentos });
    void queryClient.invalidateQueries({ queryKey: clavesPersonal.estado });
  };
}

export function useNuevaConversacionPersonal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v?: { titulo?: string }) =>
      llamar<{ conversacion?: PersonalConversacionRow }>({ accion: "nueva", ...(v?.titulo ? { titulo: v.titulo } : {}) }),
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export type RespuestaPersonal = {
  conversacion_id?: string;
  nueva?: boolean;
  pregunta?: PersonalMensajeRow;
  respuesta?: {
    texto?: string;
    respuestas?: RespuestaProveedorPersonal[];
    juez?: string | null;
    discrepancias?: string | null;
    coste?: number | null;
  };
  ms?: number;
};

/** Pregunta a varias IA a la vez y devuelve la respuesta fusionada (10-60 s). */
export function usePreguntarPersonal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { texto: string; conversacionId?: string }) =>
      llamar<RespuestaPersonal>({
        accion: "preguntar",
        texto: v.texto,
        ...(v.conversacionId ? { conversacion_id: v.conversacionId } : {}),
      }),
    onSuccess: () => invalidar(),
    onError: (e: Error) => {
      invalidar();
      toast.error(e.message);
    },
  });
}

export function useAccionConversacionPersonal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { accion: "renombrar" | "fijar" | "archivar" | "borrar"; conversacion_id: string; titulo?: string; fijada?: boolean; archivada?: boolean }) =>
      llamar({ ...v }),
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCrearDocumentoPersonal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: {
      conversacionId?: string;
      contenidoMd?: string;
      titulo?: string;
      tipo?: string;
      indicaciones?: string;
      etiquetas?: string[];
    }) =>
      llamar<{ documento?: PersonalDocumentoRow }>({
        accion: "crear_documento",
        ...(v.conversacionId ? { conversacion_id: v.conversacionId } : {}),
        ...(v.contenidoMd ? { contenido_md: v.contenidoMd } : {}),
        ...(v.titulo ? { titulo: v.titulo } : {}),
        ...(v.tipo ? { tipo: v.tipo } : {}),
        ...(v.indicaciones ? { indicaciones: v.indicaciones } : {}),
        ...(v.etiquetas?.length ? { etiquetas: v.etiquetas } : {}),
      }),
    onSuccess: () => {
      invalidar();
      toast.success("Documento creado en la carpeta PERSONAL.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEnlaceDocumentoPersonal() {
  return useMutation({
    mutationFn: (id: string) => llamar<{ url?: string }>({ accion: "enlace_documento", id }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBorrarDocumentoPersonal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => llamar({ accion: "borrar_documento", id }),
    onSuccess: () => {
      invalidar();
      toast.success("Documento borrado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useConfigurarPersonal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: {
      proveedores?: string[];
      max_proveedores: number;
      juez: string;
      modo: ModoPersonal;
      guardar_en_almacen: boolean;
      carpeta_almacen: string;
      carpeta_mac: string;
      instrucciones: string;
    }) => llamar({ accion: "configurar", ...v }),
    onSuccess: () => {
      invalidar();
      toast.success("Configuración guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ----------------------------- Estilo propio ------------------------------ */

export function useGuardarMuestrasEstilo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (muestras: string[]) => llamar<{ perfil_estilo?: string }>({ accion: "estilo_muestras", muestras }),
    onSuccess: () => {
      invalidar();
      toast.success("He aprendido tu forma de escribir.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Guarda a mano el perfil de estilo aprendido (texto libre). */
export function useGuardarPerfilEstilo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (perfil: string) => {
      const { data: sesion } = await supabase.auth.getUser();
      const usuario = sesion.user?.id;
      if (!usuario) throw new Error("Necesitas iniciar sesión.");
      const { error } = await supabase
        .from("personal_config")
        .update({ perfil_estilo: perfil.trim() || null })
        .eq("user_id", usuario);
      if (error) throw new Error(error.message);
      return { perfil_estilo: perfil.trim() };
    },
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}



export type ResultadoReescritura = {
  texto_resultado?: string;
  notas?: NotasTutor;
};

export function useReescribir() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { texto: string; modo: ModoReescritura; proyectoId?: string; tono?: string }) =>
      llamar<ResultadoReescritura>({
        accion: "reescribir",
        texto: v.texto,
        modo: v.modo,
        ...(v.proyectoId ? { proyecto_id: v.proyectoId } : {}),
        ...(v.tono ? { tono: v.tono } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavesPersonal.reescrituras });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGuiaEstiloProyecto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { proyectoId: string; guiaEstilo?: string; indicaciones?: string }) =>
      llamar<{ guia_estilo?: string }>({
        accion: "guia_estilo_proyecto",
        proyecto_id: v.proyectoId,
        ...(v.guiaEstilo !== undefined ? { guia_estilo: v.guiaEstilo } : {}),
        ...(v.indicaciones ? { indicaciones: v.indicaciones } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["proyectos"] });
      toast.success("Guía de estilo guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
