import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type {
  ControlCalidadRow,
  EjecucionCalidadRow,
  Hallazgo,
  ResultadoCalidadRow,
} from "../db-types";
import { supabase } from "../supabase";
import { claves } from "./claves";

export function useControlesCalidad() {
  return useQuery({
    queryKey: claves.controlesCalidad,
    queryFn: async () => {
      const { data, error } = await supabase.from("controles_calidad").select("*").order("orden");
      if (error) throw new Error(error.message);
      return (data ?? []) as ControlCalidadRow[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useEjecucionesCalidad(proyectoId?: string) {
  return useQuery({
    queryKey: [...claves.ejecucionesCalidad, proyectoId ?? "todas"],
    queryFn: async () => {
      let consulta = supabase
        .from("ejecuciones_calidad")
        .select("*")
        .order("iniciada_el", { ascending: false })
        .limit(proyectoId ? 30 : 200);
      if (proyectoId) consulta = consulta.eq("proyecto_id", proyectoId);
      const { data, error } = await consulta;
      if (error) throw new Error(error.message);
      return (data ?? []) as EjecucionCalidadRow[];
    },
  });
}

export function useResultadosCalidad(ejecucionId: string | null) {
  return useQuery({
    queryKey: [...claves.resultadosCalidad, ejecucionId ?? "ninguna"],
    enabled: Boolean(ejecucionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resultados_calidad")
        .select("*")
        .eq("ejecucion_id", ejecucionId!);
      if (error) throw new Error(error.message);
      return (data ?? []) as ResultadoCalidadRow[];
    },
  });
}

async function llamarFuncion(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("calidad-github", { body: cuerpo });
  if (error) throw new Error(error.message);
  const respuesta = data as { ok?: boolean; error?: string } | null;
  if (respuesta && respuesta.ok === false) throw new Error(respuesta.error ?? "La comprobación no ha podido lanzarse.");
  return respuesta;
}

export function useLanzarCalidad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ proyectoId, version }: { proyectoId: string; version: string }) =>
      llamarFuncion({ accion: "lanzar", proyecto_id: proyectoId, version }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: claves.ejecucionesCalidad });
      toast.success("Comprobación lanzada. En unos minutos verás el resultado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSincronizarCalidad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => llamarFuncion({ accion: "sincronizar" }),
    onSuccess: () => {
      for (const clave of [claves.ejecucionesCalidad, claves.resultadosCalidad, claves.proyectos]) {
        void queryClient.invalidateQueries({ queryKey: clave });
      }
      toast.success("Resultados actualizados.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface RevisionResultado {
  aprobada: boolean;
  hallazgos: Hallazgo[];
  revisionId: string | null;
}

/** Pasa la revisión previa de una orden. Devuelve los hallazgos en español. */
export async function revisarOrden(ordenId: string): Promise<RevisionResultado> {
  const { data, error } = await supabase.rpc("revisar_orden", { p_orden_id: ordenId });
  if (error) throw new Error(error.message);
  const fila = (Array.isArray(data) ? data[0] : data) as
    | { aprobada: boolean; hallazgos: Hallazgo[] | null; revision_id: string }
    | null;
  return {
    aprobada: fila?.aprobada ?? true,
    hallazgos: fila?.hallazgos ?? [],
    revisionId: fila?.revision_id ?? null,
  };
}
