import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type {
  ClasificacionPeticion,
  CorreccionNombre,
  DestinoPeticion,
  EstadoGrabacionPlaud,
  EstadoPeticion,
  PeticionAdjuntoRow,
  PeticionDirectaRow,
  PeticionMensajeRow,
  PlaudGrabacionRow,
  RolMensajePeticion,
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
  borrador: "Pendiente de revisar",
  lanzada: "Lanzada",
  error: "Con error",
};

export const TONO_ESTADO_PETICION: Record<EstadoPeticion, string> = {
  nueva: "border-border bg-muted text-muted-foreground",
  clasificada: "border-border bg-muted text-muted-foreground",
  respondida: "border-success/40 bg-success/10 text-success",
  propuesta: "border-warning/40 bg-warning/10 text-warning",
  aprobada: "border-primary/40 bg-primary/10 text-primary",
  descartada: "border-border bg-muted text-muted-foreground",
  borrador: "border-warning/40 bg-warning/10 text-warning",
  lanzada: "border-primary/40 bg-primary/10 text-primary",
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

/** Convierte los avisos técnicos del motor en explicaciones con solución. */
export function mensajeAmigable(mensaje: string): string {
  const t = (mensaje ?? "").toLowerCase();
  if (t.includes("contexto demasiado grande") || t.includes("tarifa no verificada"))
    return "El modelo elegido no tiene una tarifa verificada, o tu texto y sus adjuntos superan el máximo de entrada que le has fijado. Ve a Consumo → «Configurar una tarifa documentada», revisa el modelo y sube el «Máximo tokens de entrada»; si ya la tenías, comprueba que la fecha «Válida hasta» no haya caducado.";
  if (t.includes("no se pudo reservar el presupuesto"))
    return "Se ha alcanzado alguno de tus límites de gasto. Ajústalos en Consumo → «Límites y reservas antes de llamar a la IA».";
  if (t.includes("modelo no autorizado") || t.includes("modelo no configurado"))
    return "El modelo que se iba a usar no está dado de alta o está desactivado. Revísalo en Configuración → Proveedores de IA.";
  if (t.includes("proveedor no configurado") || t.includes("proveedor sin"))
    return "Falta configurar ese proveedor de IA o su tarifa. Revísalo en Configuración → Proveedores de IA y en Consumo.";
  if (t.includes("límite explícito de salida"))
    return "Falta fijar el «Máximo tokens de salida» de ese modelo en Consumo → «Configurar una tarifa documentada».";
  return mensaje || "No se ha podido completar la operación.";
}

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
    throw new Error(mensajeAmigable(mensaje));
  }
  if (!respuesta || respuesta.ok === false) {
    throw new Error(mensajeAmigable(respuesta?.error ?? "No se ha podido completar la operación."));
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

/** Cuerpo que se envía a la función `pideme` al pedir algo. */
export function cuerpoPedir(v: {
  texto: string;
  origen?: "texto" | "voz";
  proyecto_id?: string | null;
  adjunto_ids?: string[];
}) {
  return {
    accion: "pedir",
    texto: v.texto,
    origen: v.origen ?? "texto",
    ...(v.proyecto_id ? { proyecto_id: v.proyecto_id } : {}),
    ...(v.adjunto_ids?.length ? { adjunto_ids: v.adjunto_ids } : {}),
  };
}

/** Envía lo que pide Javier: NexDeveloper decide a dónde va. Tarda entre 10 y 60 segundos. */
export function usePedir() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: {
      texto: string;
      origen?: "texto" | "voz";
      proyecto_id?: string | null;
      adjunto_ids?: string[];
    }) => llamar<RespuestaPedir>(cuerpoPedir(v)),
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

/* ------------------------- Borradores conversables ------------------------ */

export const clavesBorradores = {
  lista: ["pideme_borradores"] as const,
  mensajes: (id: string) => ["pideme_mensajes", id] as const,
};

function primera<T>(dato: unknown): T | null {
  if (Array.isArray(dato)) return (dato[0] ?? null) as T | null;
  return (dato ?? null) as T | null;
}

export type BorradorCreado = {
  id: string;
  texto: string;
  texto_original: string | null;
  correcciones: CorreccionNombre[] | null;
};

/** Peticiones que esperan revisión antes de lanzarse. */
export function useBorradores() {
  return useQuery({
    queryKey: clavesBorradores.lista,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peticiones_directas")
        .select("*")
        .eq("estado", "borrador")
        .order("creado_el", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as PeticionDirectaRow[];
    },
  });
}

export function useBorradoresPendientes() {
  const { data = [] } = useBorradores();
  return data.length;
}

function useInvalidarBorradores() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: clavesBorradores.lista });
    void queryClient.invalidateQueries({ queryKey: clavesPideme.peticiones });
  };
}

/** Crea un borrador con los nombres ya corregidos. */
export function useCrearBorrador() {
  const invalidar = useInvalidarBorradores();
  return useMutation({
    mutationFn: async (v: {
      texto: string;
      origen?: string;
      grabacionId?: string | null;
      proyectoId?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("nex_pideme_borrador", {
        p_texto: v.texto,
        p_origen: v.origen ?? "texto",
        p_grabacion_id: v.grabacionId ?? null,
        p_proyecto_id: v.proyectoId ?? null,
      });
      if (error) throw new Error(error.message);
      const fila = primera<BorradorCreado>(data);
      if (!fila?.id) throw new Error("No se ha podido crear el borrador.");
      return fila;
    },
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGuardarBorrador() {
  const invalidar = useInvalidarBorradores();
  return useMutation({
    mutationFn: async (v: { id: string; texto: string; aclaraciones?: string | null; proyectoId?: string | null }) => {
      const { error } = await supabase.rpc("nex_pideme_guardar_borrador", {
        p_id: v.id,
        p_texto: v.texto,
        p_aclaraciones: v.aclaraciones ?? null,
        p_proyecto_id: v.proyectoId ?? null,
      });
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => invalidar(),
  });
}

export function useMensajesBorrador(peticionId: string | null) {
  return useQuery({
    queryKey: clavesBorradores.mensajes(peticionId ?? ""),
    enabled: Boolean(peticionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peticiones_mensajes")
        .select("*")
        .eq("peticion_id", peticionId!)
        .order("creado_el");
      if (error) throw new Error(error.message);
      return (data ?? []) as PeticionMensajeRow[];
    },
  });
}

export function useAnadirMensaje(peticionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { texto: string; rol?: RolMensajePeticion }) => {
      const { error } = await supabase.rpc("nex_pideme_mensaje", {
        p_id: peticionId,
        p_texto: v.texto,
        p_rol: v.rol ?? "usuario",
      });
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clavesBorradores.mensajes(peticionId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Aplica una corrección sugerida y la memoriza en el diccionario. */
export function useAprenderCorreccion() {
  const invalidar = useInvalidarBorradores();
  return useMutation({
    mutationFn: async (v: { id: string; de: string; a: string }) => {
      const { data, error } = await supabase.rpc("nex_pideme_aprender", { p_id: v.id, p_de: v.de, p_a: v.a });
      if (error) throw new Error(error.message);
      const texto = typeof data === "string" ? data : ((primera<{ texto?: string }>(data)?.texto ?? "") as string);
      return texto;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Nombre corregido y memorizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type BorradorLanzado = { id: string; texto_final: string; proyecto_id: string | null };

export function useLanzarBorrador() {
  const invalidar = useInvalidarBorradores();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("nex_pideme_lanzar", { p_id: id });
      if (error) throw new Error(error.message);
      const fila = primera<BorradorLanzado>(data);
      if (!fila?.texto_final) throw new Error("El borrador no tiene texto que lanzar.");
      return fila;
    },
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useVincularBorrador() {
  const invalidar = useInvalidarBorradores();
  return useMutation({
    mutationFn: async (v: { borradorId: string; peticionId: string }) => {
      const { error } = await supabase.rpc("nex_pideme_vincular", {
        p_borrador_id: v.borradorId,
        p_peticion_id: v.peticionId,
      });
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => invalidar(),
  });
}

export function useDescartarBorrador() {
  const invalidar = useInvalidarBorradores();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("nex_pideme_descartar", { p_id: id });
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Borrador descartado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}


/* --------------------------------- Adjuntos -------------------------------- */

/** Ficheros adjuntos vinculados a una petición o borrador. */
export function useAdjuntosDePeticion(peticionId: string | null) {
  return useQuery({
    queryKey: ["pideme_adjuntos", peticionId ?? ""],
    enabled: Boolean(peticionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peticiones_adjuntos")
        .select("*")
        .eq("peticion_id", peticionId!)
        .order("creado_el");
      if (error) throw new Error(error.message);
      return (data ?? []) as PeticionAdjuntoRow[];
    },
  });
}
