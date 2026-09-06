import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type {
  EstadoRestauracion,
  ModoRestauracion,
  RestauracionConfigRow,
  RestauracionRow,
  TipoRestauracion,
} from "../db-types";
import { supabase } from "../supabase";

export const clavesRestauracion = {
  estado: ["restauracion_estado"] as const,
  listado: ["restauraciones"] as const,
  copias: (objetivo: string, tipo: string) => ["restauracion_copias", objetivo, tipo] as const,
};

/* --------------------------------- Textos --------------------------------- */

export const ETIQUETA_ESTADO_RESTAURACION: Record<EstadoRestauracion, string> = {
  en_cola: "En cola",
  preparando: "Preparando",
  restaurando: "Restaurando",
  completada: "Completada",
  error: "Error",
  cancelada: "Cancelada",
};

export const TONO_ESTADO_RESTAURACION: Record<EstadoRestauracion, string> = {
  en_cola: "border-border bg-muted text-muted-foreground",
  preparando: "border-primary/40 bg-primary/10 text-primary",
  restaurando: "border-primary/40 bg-primary/10 text-primary",
  completada: "border-success/40 bg-success/10 text-success",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  cancelada: "border-border bg-muted text-muted-foreground",
};

export const ETIQUETA_MODO_RESTAURACION: Record<ModoRestauracion, string> = {
  solo_datos: "Solo datos",
  esquema_y_datos: "Estructura y datos",
  simulada: "Simulada",
  rama: "Rama nueva",
};

export const ETIQUETA_TIPO_RESTAURACION: Record<TipoRestauracion, string> = {
  base_datos: "Base de datos",
  repositorio: "Repositorio",
  prueba: "Prueba mensual",
};

export function estaEnMarcha(r: RestauracionRow) {
  return r.estado === "en_cola" || r.estado === "preparando" || r.estado === "restaurando";
}

/** Duración legible entre el inicio y el fin de una restauración. */
export function duracionRestauracion(r: RestauracionRow) {
  const inicio = r.iniciada_el ?? r.creado_el;
  const fin = r.terminada_el;
  if (!inicio || !fin) return "—";
  const seg = Math.max(0, Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 1000));
  if (seg < 60) return `${seg} s`;
  const min = Math.floor(seg / 60);
  return min < 60 ? `${min} min ${seg % 60} s` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

/* -------------------------------- Llamadas -------------------------------- */

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("copias-restaurar", { body: cuerpo });
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

export type CopiaRestaurable = {
  id: string;
  tipo: "base_datos" | "repositorio";
  objetivo: string;
  nombre: string;
  ruta_remota: string | null;
  bytes: number | null;
  num_tablas: number | null;
  num_filas: number | null;
  terminada_el: string | null;
};

export type EstadoRestauraciones = {
  ok?: boolean;
  config?: RestauracionConfigRow | null;
  ultima_prueba?: RestauracionRow | null;
  token_cuenta?: boolean;
  github?: boolean;
};

export type ResumenPreparar = {
  ok?: boolean;
  copia?: CopiaRestaurable;
  resumen?: {
    fecha?: string | null;
    tablas?: { tabla: string; filas: number }[];
    filas?: number;
    funciones?: number;
    politicas?: number;
    bytes?: number;
  };
  destino?: { ref?: string; tablas?: number; usuarios?: number; error?: string };
};

/* --------------------------------- Lecturas -------------------------------- */

export function useEstadoRestauraciones() {
  return useQuery({
    queryKey: clavesRestauracion.estado,
    queryFn: () => llamar<EstadoRestauraciones>({ accion: "estado" }),
  });
}

/** Copias que se pueden restaurar (las correctas). */
export function useCopiasRestaurables(objetivo?: string, tipo?: string) {
  return useQuery({
    queryKey: clavesRestauracion.copias(objetivo ?? "todas", tipo ?? "todos"),
    queryFn: async () => {
      const r = await llamar<{ copias?: CopiaRestaurable[] }>({
        accion: "copias",
        ...(objetivo ? { objetivo } : {}),
        ...(tipo ? { tipo } : {}),
      });
      return r.copias ?? [];
    },
  });
}

export function useRestauraciones() {
  return useQuery({
    queryKey: clavesRestauracion.listado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restauraciones")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as RestauracionRow[];
    },
  });
}

/** Mantiene el progreso al día mientras se restaura. */
export function useRealtimeRestauraciones(activo = true) {
  const qc = useQueryClient();
  React.useEffect(() => {
    if (!activo) return;
    const canal = supabase.channel("nexdeveloper-restauraciones");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "restauraciones" }, () => {
      void qc.invalidateQueries({ queryKey: clavesRestauracion.listado });
      void qc.invalidateQueries({ queryKey: clavesRestauracion.estado });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [activo, qc]);
}

/* -------------------------------- Acciones -------------------------------- */

export function useEnlaceCopia() {
  return useMutation({
    mutationFn: (copiaId: string) => llamar<{ url: string; caduca_min?: number }>({ accion: "enlace", copia_id: copiaId }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePrepararRestauracion() {
  return useMutation({
    mutationFn: (entrada: { copiaId: string; destino?: string }) =>
      llamar<ResumenPreparar>({
        accion: "preparar",
        copia_id: entrada.copiaId,
        ...(entrada.destino ? { destino: entrada.destino } : {}),
      }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRestaurar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entrada: { copiaId: string; destino?: string; modo: ModoRestauracion; rama?: string }) =>
      llamar<{ restauracion?: RestauracionRow }>({
        accion: "restaurar",
        copia_id: entrada.copiaId,
        modo: entrada.modo,
        confirmacion: "RESTAURAR",
        ...(entrada.destino ? { destino: entrada.destino } : {}),
        ...(entrada.rama ? { rama: entrada.rama } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesRestauracion.listado });
      toast.success("Restauración en marcha. Verás el avance aquí mismo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelarRestauracion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (restauracionId: string) => llamar({ accion: "cancelar", restauracion_id: restauracionId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesRestauracion.listado });
      toast.success("Restauración cancelada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useProbarRestauracionAhora() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => llamar<{ restauracion?: RestauracionRow }>({ accion: "probar_ahora" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesRestauracion.listado });
      void qc.invalidateQueries({ queryKey: clavesRestauracion.estado });
      toast.success("Prueba lanzada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGuardarConfigRestauracion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (campos: Partial<RestauracionConfigRow>) =>
      llamar<{ config?: RestauracionConfigRow }>({ accion: "configurar", ...campos }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesRestauracion.estado });
      toast.success("Configuración guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
