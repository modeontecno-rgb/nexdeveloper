import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ConsumoIaRow, ModeloIaRow, PoliticaEnrutadoRow, ProveedorIaRow } from "../db-types";
import { supabase } from "../supabase";
import { claves } from "./claves";

async function pedir<T>(promesa: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { data, error } = await promesa;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export function useProveedoresIa() {
  return useQuery({
    queryKey: claves.proveedoresIa,
    queryFn: () => pedir<ProveedorIaRow>(supabase.from("v_proveedores_ia").select("*").order("nombre")),
  });
}

export function useModelosIa() {
  return useQuery({
    queryKey: claves.modelosIa,
    queryFn: () => pedir<ModeloIaRow>(supabase.from("modelos_ia").select("*").order("nombre")),
  });
}

export function usePoliticaEnrutado() {
  return useQuery({
    queryKey: claves.politicaEnrutado,
    queryFn: () => pedir<PoliticaEnrutadoRow>(supabase.from("politica_enrutado").select("*").order("tarea")),
  });
}

export function useConsumosIa() {
  return useQuery({
    queryKey: claves.consumosIa,
    queryFn: () =>
      pedir<ConsumoIaRow>(supabase.from("consumos_ia").select("*").order("created_at", { ascending: false }).limit(2000)),
  });
}

/** Carga los proveedores y modelos de referencia la primera vez. */
export function useSembrarProveedores(habilitado: boolean) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["sembrar_proveedores_ia"],
    enabled: habilitado,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { error } = await supabase.rpc("sembrar_proveedores_ia");
      if (error) throw new Error(error.message);
      void queryClient.invalidateQueries({ queryKey: claves.proveedoresIa });
      void queryClient.invalidateQueries({ queryKey: claves.modelosIa });
      void queryClient.invalidateQueries({ queryKey: claves.politicaEnrutado });
      return true;
    },
  });
}

function useMut<V>(fn: (v: V) => Promise<void>, mensaje: string, invalidar: readonly (readonly string[])[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const clave of invalidar) void queryClient.invalidateQueries({ queryKey: clave });
      if (mensaje) toast.success(mensaje);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGuardarProveedor() {
  return useMut<{ id: string; cambios: { activo?: boolean; url_base?: string | null; notas?: string | null } }>(
    async ({ id, cambios }) => {
      const { error } = await supabase.from("proveedores_ia").update(cambios).eq("id", id);
      if (error) throw new Error(error.message);
    },
    "Proveedor actualizado.",
    [claves.proveedoresIa],
  );
}

export function useGuardarModelo() {
  return useMut<{
    id: string;
    cambios: {
      activo?: boolean;
      coste_entrada?: number | null;
      coste_salida?: number | null;
      tareas_aconsejadas?: string[];
    };
  }>(
    async ({ id, cambios }) => {
      const { error } = await supabase.from("modelos_ia").update(cambios).eq("id", id);
      if (error) throw new Error(error.message);
    },
    "Modelo actualizado.",
    [claves.modelosIa],
  );
}

export function useGuardarClaveProveedor() {
  return useMut<{ id: string; clave: string }>(
    async ({ id, clave }) => {
      const { error } = await supabase.rpc("guardar_clave_proveedor", { p_proveedor_id: id, p_clave: clave });
      if (error) throw new Error(error.message);
    },
    "Clave guardada y cifrada en el servidor.",
    [claves.proveedoresIa],
  );
}

export function useProbarProveedor() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("probar-proveedor", {
        body: { proveedor_id: id },
      });
      if (error) throw new Error(error.message);
      return data as { ok: boolean; error?: string };
    },
    onSuccess: (r) => (r.ok ? toast.success("Conexión correcta.") : toast.error(r.error ?? "No ha respondido.")),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGuardarPolitica() {
  return useMut<{
    tarea: string;
    cambios: {
      estrategia?: PoliticaEnrutadoRow["estrategia"];
      modelo_preferido_id?: string | null;
      modelo_respaldo_id?: string | null;
    };
  }>(
    async ({ tarea, cambios }) => {
      const { data: existente } = await supabase.from("politica_enrutado").select("id").eq("tarea", tarea).maybeSingle();
      if (existente) {
        const { error } = await supabase
          .from("politica_enrutado")
          .update({ ...cambios, updated_at: new Date().toISOString() })
          .eq("id", existente.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("politica_enrutado").insert({ tarea, ...cambios });
        if (error) throw new Error(error.message);
      }
    },
    "",
    [claves.politicaEnrutado],
  );
}
