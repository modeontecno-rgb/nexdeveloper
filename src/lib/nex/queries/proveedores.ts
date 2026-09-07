import { useSeguirTrabajo } from "@/components/nex/indicador-trabajo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type {
  ConsumoIaRow,
  ModeloIaRow,
  PoliticaEnrutadoRow,
  ProveedorIaRow,
  RendimientoModeloRow,
} from "../db-types";
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

export function useRendimientoModelos() {
  return useQuery({
    queryKey: claves.rendimientoModelos,
    queryFn: () => pedir<RendimientoModeloRow>(supabase.from("v_rendimiento_modelos").select("*")),
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
  return useMut<{
    id: string;
    cambios: { activo?: boolean; url_base?: string | null; notas?: string | null; cuenta?: string | null };
  }>(
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
  const seguirTrabajo = useSeguirTrabajo('Probando el proveedor de IA');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
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

/** Pide a Canva la dirección de autorización (PKCE) y lleva allí al usuario. */
export function useConectarCanva() {
  return useMutation({
    mutationFn: async (proveedorId: string) => {
      const verificador = crearVerificador();
      const reto = await retoDesdeVerificador(verificador);
      const redireccion = `${window.location.origin}/ajustes/proveedores/canva/retorno`;
      sessionStorage.setItem("canva_pkce", verificador);
      sessionStorage.setItem("canva_proveedor", proveedorId);

      const { data, error } = await supabase.functions.invoke("canva-oauth", {
        body: { accion: "autorizar", code_challenge: reto, redirect_uri: redireccion, state: proveedorId },
      });
      if (error) throw new Error(error.message);
      const r = data as { ok: boolean; url?: string; error?: string };
      if (!r.ok || !r.url) throw new Error(r.error ?? "No se ha podido iniciar la conexión con Canva.");
      window.location.href = r.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Cambia el código de Canva por los tokens, que se guardan cifrados. */
export function useFinalizarCanva() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (codigo: string) => {
      const verificador = sessionStorage.getItem("canva_pkce");
      const proveedorId = sessionStorage.getItem("canva_proveedor");
      if (!verificador || !proveedorId) throw new Error("La conexión ha caducado. Vuelve a intentarlo desde la tarjeta de Canva.");

      const { data, error } = await supabase.functions.invoke("canva-oauth", {
        body: {
          accion: "intercambiar",
          code: codigo,
          code_verifier: verificador,
          proveedor_id: proveedorId,
          redirect_uri: `${window.location.origin}/ajustes/proveedores/canva/retorno`,
        },
      });
      if (error) throw new Error(error.message);
      const r = data as { ok: boolean; cuenta?: string; error?: string };
      if (!r.ok) throw new Error(r.error ?? "Canva no ha completado la conexión.");
      sessionStorage.removeItem("canva_pkce");
      sessionStorage.removeItem("canva_proveedor");
      void queryClient.invalidateQueries({ queryKey: claves.proveedoresIa });
      return r.cuenta ?? "Canva";
    },
  });
}

function crearVerificador() {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return base64Url(bytes.buffer);
}

async function retoDesdeVerificador(verificador: string) {
  const resumen = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verificador));
  return base64Url(resumen);
}

function base64Url(datos: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(datos)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
