import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { EntornoPreview, PosicionPanel, PreviewRow, ResultadoVerificacion } from "../db-types";
import { supabase } from "../supabase";
import { claves } from "./claves";

export interface EntradaPreview {
  id?: string | undefined;
  proyectoId: string;
  titulo: string;
  url: string;
  entorno: EntornoPreview;
  esPrincipal: boolean;
}

function refrescar(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: claves.previews });
}

export function useGuardarPreview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: EntradaPreview) => {
      const campos = {
        proyecto_id: entrada.proyectoId,
        titulo: entrada.titulo,
        url: entrada.url,
        entorno: entrada.entorno,
        es_principal: entrada.esPrincipal,
      };
      const res = entrada.id
        ? await supabase.from("previews").update(campos).eq("id", entrada.id).select("*").single()
        : await supabase.from("previews").insert(campos).select("*").single();
      if (res.error) throw new Error(res.error.message);
      const guardada = res.data as unknown as PreviewRow;
      if (entrada.esPrincipal) {
        await supabase
          .from("previews")
          .update({ es_principal: false })
          .eq("proyecto_id", entrada.proyectoId)
          .neq("id", guardada.id);
      }
      return guardada;
    },
    onSuccess: () => {
      refrescar(queryClient);
      toast.success("Vista previa guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBorrarPreview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.from("previews").delete().eq("id", id);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      refrescar(queryClient);
      toast.success("Vista previa eliminada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Guarda dónde y cómo has dejado el panel flotante, sin avisos en pantalla. */
export function useGuardarPosicionPreview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, posicion }: { id: string; posicion: PosicionPanel }) => {
      const res = await supabase.from("previews").update({ posicion }).eq("id", id);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => refrescar(queryClient),
  });
}

export function useGuardarVerificacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      resultado,
      detalle,
    }: {
      id: string;
      resultado: ResultadoVerificacion;
      detalle: string;
    }) => {
      const res = await supabase
        .from("previews")
        .update({
          ultima_verificacion: new Date().toISOString(),
          resultado_verificacion: resultado,
          detalle_verificacion: detalle,
        })
        .eq("id", id);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => refrescar(queryClient),
    onError: (e: Error) => toast.error(e.message),
  });
}
