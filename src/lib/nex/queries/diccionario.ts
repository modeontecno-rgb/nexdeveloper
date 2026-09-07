import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { DiccionarioNombreRow } from "../db-types";
import { supabase } from "../supabase";

export const clavesDiccionario = { lista: ["diccionario_nombres"] as const };

/** Nombres propios que Plaud suele transcribir mal y sus variantes. */
export function useDiccionarioNombres() {
  return useQuery({
    queryKey: clavesDiccionario.lista,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diccionario_nombres")
        .select("*")
        .order("termino");
      if (error) throw new Error(error.message);
      return (data ?? []) as DiccionarioNombreRow[];
    },
  });
}

function useInvalidar() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: clavesDiccionario.lista });
}

export function useCrearTerminoDiccionario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (v: { termino: string; variantes: string[]; proyectoId?: string | null }) => {
      const { error } = await supabase.from("diccionario_nombres").insert({
        termino: v.termino,
        variantes: v.variantes,
        proyecto_id: v.proyectoId ?? null,
        origen: "manual",
        activo: true,
      });
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Nombre añadido al diccionario.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useActualizarTerminoDiccionario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (v: { id: string; variantes?: string[]; activo?: boolean; termino?: string }) => {
      const cambios: Record<string, unknown> = {};
      if (v.variantes) cambios["variantes"] = v.variantes;
      if (typeof v.activo === "boolean") cambios["activo"] = v.activo;
      if (v.termino) cambios["termino"] = v.termino;
      const { error } = await supabase.from("diccionario_nombres").update(cambios).eq("id", v.id);
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBorrarTerminoDiccionario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("diccionario_nombres").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Nombre quitado del diccionario.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Recarga el diccionario con los nombres de los proyectos. */
export function useSembrarDiccionario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc("nex_sembrar_diccionario", { p_user_id: userId });
      if (error) throw new Error(error.message);
      return Number(data ?? 0);
    },
    onSuccess: (n) => {
      invalidar();
      toast.success(`Diccionario recargado con ${n} nombres de tus proyectos.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
