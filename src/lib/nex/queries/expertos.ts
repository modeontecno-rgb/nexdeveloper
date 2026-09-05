import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ExpertoRow } from "../db-types";
import { supabase } from "../supabase";
import { claves } from "./claves";

async function pedir<T>(promesa: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { data, error } = await promesa;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export function useExpertos() {
  return useQuery({
    queryKey: claves.expertos,
    queryFn: () => pedir<ExpertoRow>(supabase.from("expertos").select("*").order("nombre")),
  });
}

/** Carga la caja de expertos propios y sugeridos la primera vez. */
export function useSembrarExpertos(habilitado: boolean) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["sembrar_expertos"],
    enabled: habilitado,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { error } = await supabase.rpc("sembrar_expertos");
      if (error) throw new Error(error.message);
      void queryClient.invalidateQueries({ queryKey: claves.expertos });
      return true;
    },
  });
}

function useMut<V, R = void>(fn: (v: V) => Promise<R>, mensaje: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: claves.expertos });
      if (mensaje) toast.success(mensaje);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type CambiosExperto = Partial<
  Pick<
    ExpertoRow,
    | "nombre"
    | "papel"
    | "cuando_usarlo"
    | "instrucciones"
    | "modelo_aconsejado_id"
    | "tareas"
    | "muestra_url"
    | "url_origen"
    | "estado"
    | "valoracion"
  >
>;

export function useGuardarExperto() {
  return useMut<{ id: string; cambios: CambiosExperto }>(async ({ id, cambios }) => {
    const { error } = await supabase
      .from("expertos")
      .update({ ...cambios, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }, "Experto guardado.");
}

/** Adopta un experto; si venía de la red, lo publica en el repositorio de GitHub. */
export function useAdoptarExperto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (experto: ExpertoRow) => {
      const { error } = await supabase
        .from("expertos")
        .update({ estado: "adoptado", updated_at: new Date().toISOString() })
        .eq("id", experto.id);
      if (error) throw new Error(error.message);

      if (experto.origen !== "red") return { publicado: true as boolean, aviso: "" };

      const { data, error: errorFuncion } = await supabase.functions.invoke("publicar-experto", {
        body: { experto_id: experto.id },
      });
      if (errorFuncion) return { publicado: false, aviso: errorFuncion.message };
      const respuesta = data as { ok: boolean; error?: string };
      return { publicado: respuesta.ok, aviso: respuesta.error ?? "" };
    },
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: claves.expertos });
      void queryClient.invalidateQueries({ queryKey: claves.tareasAtencion });
      if (r.publicado) toast.success("Experto adoptado.");
      else toast.warning(r.aviso || "Adoptado, pero no se ha podido publicar en GitHub.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDescartarExperto() {
  return useMut<string>(async (id) => {
    const { error } = await supabase
      .from("expertos")
      .update({ estado: "descartado", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }, "Experto descartado.");
}

/** Suma un uso al experto elegido. */
export async function sumarUso(experto: ExpertoRow) {
  await supabase
    .from("expertos")
    .update({ usos: Number(experto.usos ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq("id", experto.id);
}

/** Lanza el barrido de la red ahora mismo. */
export function useBarrerExpertos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("barrer-expertos", { body: {} });
      if (error) throw new Error(error.message);
      return data as { ok: boolean; nuevos?: number; error?: string };
    },
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: claves.expertos });
      void queryClient.invalidateQueries({ queryKey: claves.tareasAtencion });
      if (!r.ok) toast.error(r.error ?? "El barrido no ha podido completarse.");
      else if ((r.nuevos ?? 0) > 0) toast.success(`Se han encontrado ${r.nuevos} expertos nuevos.`);
      else toast.info("No hay novedades esta vez.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Crea un chat en un proyecto con el experto y el modelo aconsejado. */
export function useUsarExpertoEnProyecto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      experto,
      proyectoId,
      modeloId,
      proveedorId,
    }: {
      experto: ExpertoRow;
      proyectoId: string;
      modeloId: string | null;
      proveedorId: string | null;
    }) => {
      const { data, error } = await supabase
        .from("chats")
        .insert({
          proyecto_id: proyectoId,
          titulo: `Sesión con ${experto.nombre}`,
          experto_id: experto.id,
          modelo_id: modeloId,
          proveedor_id: proveedorId,
        })
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      await sumarUso(experto);
      return data?.id ?? null;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: claves.chats });
      void queryClient.invalidateQueries({ queryKey: claves.expertos });
      toast.success("Conversación creada con ese experto.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
