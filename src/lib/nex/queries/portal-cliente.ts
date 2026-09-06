import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import type {
  EstadoPeticionPortal,
  MarcaPortal,
  PortalClienteRow,
  PortalPeticionRow,
  SeccionesPortal,
  TipoPeticionPortal,
} from "../db-types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "../supabase";

export const clavesPortal = {
  estado: ["portal-cliente", "estado"] as const,
  portales: ["portales_cliente"] as const,
  peticiones: ["portal_peticiones"] as const,
  publico: (token: string) => ["portal-publico", token] as const,
};

export const TIPOS_PETICION: { valor: TipoPeticionPortal; texto: string }[] = [
  { valor: "peticion", texto: "Petición" },
  { valor: "incidencia", texto: "Incidencia" },
  { valor: "pregunta", texto: "Pregunta" },
];

export const ETIQUETA_TIPO_PETICION: Record<TipoPeticionPortal, string> = {
  peticion: "Petición",
  incidencia: "Incidencia",
  pregunta: "Pregunta",
};

export const ESTADOS_PETICION: { valor: EstadoPeticionPortal; texto: string }[] = [
  { valor: "nueva", texto: "Nueva" },
  { valor: "vista", texto: "Vista" },
  { valor: "en_curso", texto: "En curso" },
  { valor: "hecha", texto: "Hecha" },
  { valor: "descartada", texto: "Descartada" },
];

export const ETIQUETA_ESTADO_PETICION: Record<EstadoPeticionPortal, string> = {
  nueva: "Nueva",
  vista: "Vista",
  en_curso: "En curso",
  hecha: "Hecha",
  descartada: "Descartada",
};

export const TONO_ESTADO_PETICION: Record<EstadoPeticionPortal, string> = {
  nueva: "border-destructive/40 bg-destructive/10 text-destructive",
  vista: "border-border bg-muted text-muted-foreground",
  en_curso: "border-warning/40 bg-warning/10 text-warning",
  hecha: "border-success/40 bg-success/10 text-success",
  descartada: "border-border bg-muted text-muted-foreground",
};

export const SECCIONES_PORTAL: { clave: keyof SeccionesPortal; texto: string }[] = [
  { clave: "version", texto: "Versión actual" },
  { clave: "cambios", texto: "Historial de cambios" },
  { clave: "documentos", texto: "Documentos y manuales" },
  { clave: "peticiones", texto: "Peticiones del cliente" },
  { clave: "estado", texto: "Estado del servicio" },
  { clave: "contacto", texto: "Contacto" },
];

/* ------------------------------ Tipos públicos ---------------------------- */

export type DatosPortalPublico = {
  ok?: boolean;
  error?: string;
  marca?: MarcaPortal;
  proyecto?: { nombre?: string; descripcion?: string; version_actual?: string; url_app?: string };
  estado?: { semaforo?: string; comprobado_el?: string; texto?: string };
  versiones?: {
    numero?: string;
    fecha?: string;
    titulo?: string;
    notas?: string;
    cambios?: { titulo?: string; descripcion?: string; tipo?: string; importancia?: string }[];
  }[];
  documentos?: {
    id?: string;
    tipo?: string;
    titulo?: string;
    version?: string;
    mime?: string;
    bytes?: number;
    url?: string;
    creado_el?: string;
  }[];
  peticiones?: PortalPeticionRow[];
  contacto?: { whatsapp_url?: string; email?: string };
};

export type PortalConProyecto = PortalClienteRow & {
  url?: string;
  proyectos?: { nombre?: string; slug?: string } | null;
};

export type EstadoModoCliente = {
  ok?: boolean;
  portales?: PortalConProyecto[];
  peticiones_nuevas?: number;
};

/* --------------------------- Llamadas del propietario --------------------- */

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("portal-cliente", { body: cuerpo });
  if (error) {
    let mensaje = error.message;
    try {
      const cuerpoError = (error as { context?: { body?: string } }).context?.body;
      if (cuerpoError) {
        const json = JSON.parse(cuerpoError) as { error?: string };
        if (json.error) mensaje = json.error;
      }
    } catch {
      /* se queda el mensaje original */
    }
    throw new Error(mensaje);
  }
  const respuesta = data as ({ ok?: boolean; error?: string } & T) | null;
  if (!respuesta || respuesta.ok === false) {
    throw new Error(respuesta?.error ?? "No se ha podido completar la operación.");
  }
  return respuesta;
}

/** Origen actual, para que los enlaces del portal apunten al dominio correcto. */
export function baseUrl() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export function useEstadoModoCliente() {
  return useQuery({
    queryKey: clavesPortal.estado,
    queryFn: async () =>
      (await llamar<EstadoModoCliente>({ accion: "estado", base_url: baseUrl() })) as EstadoModoCliente,
    retry: false,
  });
}

export function usePeticionesPortal() {
  return useQuery({
    queryKey: clavesPortal.peticiones,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_peticiones")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(300);
      if (error) throw new Error(error.message);
      return (data ?? []) as PortalPeticionRow[];
    },
  });
}

/** Portal de un proyecto concreto (para la ficha del proyecto). */
export function usePortalDeProyecto(proyectoId: string | undefined) {
  const { data } = useEstadoModoCliente();
  return React.useMemo(
    () => (data?.portales ?? []).find((p) => p.proyecto_id === proyectoId) ?? null,
    [data, proyectoId],
  );
}

export function useRealtimePortal() {
  const qc = useQueryClient();
  React.useEffect(() => {
    const canal = supabase.channel("nexdeveloper-portal-cliente");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "portal_peticiones" }, () => {
      void qc.invalidateQueries({ queryKey: clavesPortal.peticiones });
      void qc.invalidateQueries({ queryKey: clavesPortal.estado });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [qc]);
}

function useInvalidar() {
  const qc = useQueryClient();
  return React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: clavesPortal.estado });
    void qc.invalidateQueries({ queryKey: clavesPortal.peticiones });
  }, [qc]);
}

export type DatosPortal = {
  proyecto_id: string;
  nombre_cliente?: string | undefined;
  contacto_email?: string | undefined;
  marca?: MarcaPortal | undefined;
  secciones?: SeccionesPortal | undefined;
  expira_el?: string | null | undefined;
};

export function useCrearPortal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (datos: DatosPortal) =>
      llamar<{ portal?: PortalConProyecto }>({ accion: "crear", ...datos, base_url: baseUrl() }),
    onSuccess: invalidar,
  });
}

export function useActualizarPortal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (
      datos: { portal_id: string } & Partial<Omit<DatosPortal, "proyecto_id">> & { activo?: boolean | undefined },
    ) => llamar({ accion: "actualizar", ...datos }),
    onSuccess: invalidar,
  });
}

export function useRegenerarToken() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (portalId: string) =>
      llamar<{ portal?: PortalConProyecto }>({ accion: "regenerar_token", portal_id: portalId, base_url: baseUrl() }),
    onSuccess: invalidar,
  });
}

export function useBorrarPortal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (portalId: string) => llamar({ accion: "borrar", portal_id: portalId }),
    onSuccess: invalidar,
  });
}

export function useResponderPeticion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (datos: {
      peticion_id: string;
      estado?: EstadoPeticionPortal | undefined;
      respuesta?: string | undefined;
      crear_orden?: boolean | undefined;
    }) => llamar<{ tarea_id?: string; orden_id?: string }>({ accion: "responder", ...datos }),
    onSuccess: invalidar,
  });
}

/* ----------------------------- Ruta pública ------------------------------ */

/** Llamada anónima a la función: nunca usa la sesión del propietario. */
async function llamarPublico(cuerpo: Record<string, unknown>): Promise<DatosPortalPublico> {
  const respuesta = await fetch(`${SUPABASE_URL}/functions/v1/portal-cliente`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(cuerpo),
  });
  const datos = (await respuesta.json().catch(() => null)) as DatosPortalPublico | null;
  if (!datos || datos.ok === false) {
    throw new Error(datos?.error ?? "Este enlace no está disponible.");
  }
  return datos;
}

export function usePortalPublico(token: string) {
  return useQuery({
    queryKey: clavesPortal.publico(token),
    queryFn: async () => llamarPublico({ accion: "ver", token }),
    retry: false,
  });
}

export function useEnviarPeticionPublica(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (datos: { texto: string; tipo: TipoPeticionPortal; contacto?: string | undefined }) =>
      llamarPublico({ accion: "peticion", token, ...datos }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesPortal.publico(token) });
    },
  });
}

/* -------------------------------- Utilidades ------------------------------ */

export function peticionesNuevas(peticiones: PortalPeticionRow[], portalId?: string) {
  return peticiones.filter((p) => p.estado === "nueva" && (!portalId || p.portal_id === portalId)).length;
}

export function portalCaducado(portal: PortalClienteRow) {
  return Boolean(portal.expira_el && new Date(portal.expira_el).getTime() < Date.now());
}

export function urlPortal(portal: PortalConProyecto) {
  return portal.url ?? `${baseUrl()}/cliente/${portal.token}`;
}

export function tamanoLegible(bytes: number | undefined | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
