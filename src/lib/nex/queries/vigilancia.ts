import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import type {
  CompetidorRow,
  EstadoHallazgoVigilancia,
  TipoVigilancia,
  VigilanciaConfigRow,
  VigilanciaHallazgoRow,
  VigilanciaLoteRow,
  VigilanciaResumenRow,
} from "../db-types";
import { supabase } from "../supabase";

export const clavesVigilancia = {
  config: ["vigilancia_config"] as const,
  lotes: ["vigilancia_lotes"] as const,
  hallazgos: ["vigilancia_hallazgos"] as const,
  competidores: ["competidores"] as const,
  resumen: ["v_vigilancia_resumen"] as const,
  ping: ["vigilar_ping"] as const,
};

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("vigilar", { body: cuerpo });
  const respuesta = (data ?? null) as ({ ok?: boolean; error?: string } & T) | null;
  if (error) {
    let mensaje = (error as Error).message ?? "No se ha podido completar la operación.";
    const respuestaHttp = (error as unknown as { context?: Response }).context;
    if (respuestaHttp && typeof respuestaHttp.json === "function") {
      try {
        const cuerpoError = (await respuestaHttp.clone().json()) as { error?: string };
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

/** Comprueba si hay un proveedor de búsqueda con clave. */
export function usePingVigilancia(habilitado = true) {
  return useQuery({
    queryKey: clavesVigilancia.ping,
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("vigilar", { body: {} });
      if (error) throw new Error(error.message);
      return (data ?? {}) as { ok?: boolean; listo?: boolean; buscador?: string | null };
    },
  });
}

export function useVigilanciaConfig() {
  return useQuery({
    queryKey: clavesVigilancia.config,
    queryFn: async () => {
      const { data, error } = await supabase.from("vigilancia_config").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as VigilanciaConfigRow[];
    },
  });
}

export function useVigilanciaResumen() {
  return useQuery({
    queryKey: clavesVigilancia.resumen,
    queryFn: async () => {
      const { data, error } = await supabase.from("v_vigilancia_resumen").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as VigilanciaResumenRow[];
    },
  });
}

export function useVigilanciaHallazgos() {
  return useQuery({
    queryKey: clavesVigilancia.hallazgos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vigilancia_hallazgos")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as VigilanciaHallazgoRow[];
    },
  });
}

export function useVigilanciaLotes() {
  return useQuery({
    queryKey: clavesVigilancia.lotes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vigilancia_lotes")
        .select("*")
        .order("iniciado_el", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as VigilanciaLoteRow[];
    },
  });
}

export function useCompetidores() {
  return useQuery({
    queryKey: clavesVigilancia.competidores,
    queryFn: async () => {
      const { data, error } = await supabase.from("competidores").select("*").order("nombre");
      if (error) throw new Error(error.message);
      return (data ?? []) as CompetidorRow[];
    },
  });
}

export function useEjecutarVigilancia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { proyectoId: string; tipo: TipoVigilancia }) =>
      llamar<{ lote_id: string; hallazgos: number; resumen: string; proveedor: string; modelo: string; coste: number }>(
        { accion: "ejecutar", proyecto_id: input.proyectoId, tipo: input.tipo },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesVigilancia.hallazgos });
      void qc.invalidateQueries({ queryKey: clavesVigilancia.lotes });
      void qc.invalidateQueries({ queryKey: clavesVigilancia.competidores });
      void qc.invalidateQueries({ queryKey: clavesVigilancia.resumen });
    },
  });
}

export function useEjecutarVigilanciaTodos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tipo: TipoVigilancia) => llamar({ accion: "ejecutar_todos", tipo }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesVigilancia.hallazgos });
      void qc.invalidateQueries({ queryKey: clavesVigilancia.lotes });
      void qc.invalidateQueries({ queryKey: clavesVigilancia.resumen });
    },
  });
}

export function useConvertirHallazgoEnTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { hallazgoId: string; requiereAtencion: boolean }) =>
      llamar<{ tarea_id: string }>({
        accion: "convertir_en_tarea",
        hallazgo_id: input.hallazgoId,
        requiere_atencion: input.requiereAtencion,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesVigilancia.hallazgos });
      void qc.invalidateQueries({ queryKey: clavesVigilancia.resumen });
      void qc.invalidateQueries({ queryKey: ["tareas"] });
    },
  });
}

export function useCambiarEstadoHallazgo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; estado: EstadoHallazgoVigilancia }) => {
      const { error } = await supabase
        .from("vigilancia_hallazgos")
        .update({ estado: input.estado })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesVigilancia.hallazgos });
      void qc.invalidateQueries({ queryKey: clavesVigilancia.resumen });
    },
  });
}

export function useGuardarVigilanciaConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { proyectoId: string; cambios: Partial<VigilanciaConfigRow> }) => {
      const { error } = await supabase
        .from("vigilancia_config")
        .update(input.cambios)
        .eq("proyecto_id", input.proyectoId);
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesVigilancia.config });
      void qc.invalidateQueries({ queryKey: clavesVigilancia.resumen });
    },
  });
}

export function useGuardarCompetidor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; proyectoId: string; datos: Partial<CompetidorRow> }) => {
      if (input.id) {
        const { error } = await supabase.from("competidores").update(input.datos).eq("id", input.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("competidores")
          .insert({ ...input.datos, proyecto_id: input.proyectoId, nombre: input.datos.nombre ?? "Sin nombre" });
        if (error) throw new Error(error.message);
      }
      return true;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesVigilancia.competidores });
      void qc.invalidateQueries({ queryKey: clavesVigilancia.resumen });
    },
  });
}

/** Mantiene la pantalla al día con los lotes en vivo. */
export function useRealtimeVigilancia(alCambiar?: (fila: VigilanciaLoteRow) => void) {
  const qc = useQueryClient();
  const referencia = React.useRef(alCambiar);
  referencia.current = alCambiar;

  React.useEffect(() => {
    const canal = supabase.channel("nexdeveloper-vigilancia");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "vigilancia_lotes" }, (evento) => {
      void qc.invalidateQueries({ queryKey: clavesVigilancia.lotes });
      const fila = evento.new as VigilanciaLoteRow | undefined;
      if (fila?.id) {
        if (fila.estado !== "en_curso") {
          void qc.invalidateQueries({ queryKey: clavesVigilancia.hallazgos });
          void qc.invalidateQueries({ queryKey: clavesVigilancia.competidores });
          void qc.invalidateQueries({ queryKey: clavesVigilancia.resumen });
        }
        referencia.current?.(fila);
      }
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [qc]);
}
