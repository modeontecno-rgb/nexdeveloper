import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import type { DominioHistorialRow, DominioRow, DominiosResumenRow, ResultadoDominio } from "../db-types";
import { supabase } from "../supabase";

export const clavesDominios = {
  dominios: ["dominios"] as const,
  resumen: ["v_dominios_resumen"] as const,
  historial: (dominioId: string) => ["dominios_historial", dominioId] as const,
};

export type ResultadoComprobacion = {
  dominio: string;
  resultado: ResultadoDominio;
  http_estado: number | null;
  tiempo_ms: number | null;
  cert_dias: number | null;
  dominio_dias: number | null;
  error: string | null;
  cert_via?: string | null;
};

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("dominios-comprobar", { body: cuerpo });
  if (error) throw new Error(error.message);
  const respuesta = data as ({ ok?: boolean; error?: string } & T) | null;
  if (!respuesta || respuesta.ok === false) {
    throw new Error(respuesta?.error ?? "No se ha podido comprobar el dominio.");
  }
  return respuesta;
}

export function useDominios() {
  return useQuery({
    queryKey: clavesDominios.dominios,
    queryFn: async () => {
      const { data, error } = await supabase.from("dominios").select("*").order("dominio");
      if (error) throw new Error(error.message);
      return (data ?? []) as DominioRow[];
    },
  });
}

export function useResumenDominios() {
  return useQuery({
    queryKey: clavesDominios.resumen,
    queryFn: async () => {
      const { data, error } = await supabase.from("v_dominios_resumen").select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as DominiosResumenRow | null;
    },
  });
}

export function useHistorialDominio(dominioId: string | null) {
  return useQuery({
    queryKey: clavesDominios.historial(dominioId ?? "ninguno"),
    enabled: Boolean(dominioId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dominios_historial")
        .select("*")
        .eq("dominio_id", dominioId as string)
        .order("comprobado_el", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return (data ?? []) as DominioHistorialRow[];
    },
  });
}

/** Mantiene la tabla al día mientras el backend va comprobando dominios. */
export function useRealtimeDominios() {
  const qc = useQueryClient();
  React.useEffect(() => {
    const canal = supabase.channel("nexdeveloper-dominios");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "dominios" }, () => {
      void qc.invalidateQueries({ queryKey: clavesDominios.dominios });
      void qc.invalidateQueries({ queryKey: clavesDominios.resumen });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [qc]);
}

export function useComprobarDominio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dominioId: string) => {
      const res = await llamar<{ resultados?: ResultadoComprobacion[] }>({
        accion: "comprobar",
        dominio_id: dominioId,
      });
      return (res.resultados ?? [])[0] ?? null;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesDominios.dominios });
      void qc.invalidateQueries({ queryKey: clavesDominios.resumen });
    },
  });
}

export function useComprobarTodos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => llamar<{ comprobados?: number; quedan?: number }>({ accion: "comprobar_todos" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesDominios.dominios });
      void qc.invalidateQueries({ queryKey: clavesDominios.resumen });
    },
  });
}

export type DatosDominio = {
  dominio: string;
  proyecto_id: string | null;
  tipo: DominioRow["tipo"];
  registrador: string | null;
  gestionado_por: string | null;
  aviso_dias: number;
  activo: boolean;
  notas: string | null;
};

export function useGuardarDominio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<DatosDominio> & { id?: string }) => {
      const { id, ...campos } = input;
      if (id) {
        const { error } = await supabase.from("dominios").update(campos).eq("id", id);
        if (error) throw new Error(error.message);
        return id;
      }
      const { data, error } = await supabase
        .from("dominios")
        .insert({ ...campos, pendiente: true, resultado: "sin_comprobar" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesDominios.dominios });
      void qc.invalidateQueries({ queryKey: clavesDominios.resumen });
    },
  });
}

export function useBorrarDominio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dominios").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesDominios.dominios });
      void qc.invalidateQueries({ queryKey: clavesDominios.resumen });
    },
  });
}

/** Comprueba que el texto parece un nombre de dominio (host) válido. */
export function hostValido(valor: string) {
  return /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i.test(valor.trim());
}

/** Peor estado de un conjunto de dominios, para el semáforo. */
export function peorResultado(filas: { resultado: ResultadoDominio; activo: boolean }[]): ResultadoDominio {
  const activos = filas.filter((f) => f.activo);
  if (activos.some((f) => f.resultado === "error")) return "error";
  if (activos.some((f) => f.resultado === "aviso")) return "aviso";
  if (activos.some((f) => f.resultado === "ok")) return "ok";
  return "sin_comprobar";
}
