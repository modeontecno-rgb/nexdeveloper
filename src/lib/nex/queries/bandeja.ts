import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import type {
  BandejaEntradaRow,
  BandejaFuenteRow,
  EstadoEntradaBandeja,
  Json,
  PropuestaTarea,
} from "../db-types";
import { supabase } from "../supabase";

export const clavesBandeja = {
  entradas: ["bandeja_entradas"] as const,
  fuentes: ["v_bandeja_fuentes"] as const,
  ajustes: ["bandeja_ajustes"] as const,
};

export type AjustesBandeja = {
  ok: boolean;
  google_oauth: boolean;
  clasificador_ia: string | null;
  url_webhook_whatsapp: string | null;
  url_callback_gmail: string | null;
};

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("bandeja", { body: cuerpo });
  if (error) throw new Error(error.message);
  const respuesta = data as ({ ok?: boolean; error?: string } & T) | null;
  if (!respuesta || respuesta.ok === false) {
    throw new Error(respuesta?.error ?? "La bandeja no ha respondido.");
  }
  return respuesta;
}

export function useEntradasBandeja() {
  return useQuery({
    queryKey: clavesBandeja.entradas,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bandeja_entradas")
        .select("*")
        .order("fecha", { ascending: false, nullsFirst: false })
        .limit(300);
      if (error) throw new Error(error.message);
      return (data ?? []) as BandejaEntradaRow[];
    },
  });
}

export function useFuentesBandeja() {
  return useQuery({
    queryKey: clavesBandeja.fuentes,
    queryFn: async () => {
      const { data, error } = await supabase.from("v_bandeja_fuentes").select("*").order("origen");
      if (error) throw new Error(error.message);
      return (data ?? []) as BandejaFuenteRow[];
    },
  });
}

/** Datos del servidor: si hay credenciales de Google, clasificador de IA y URLs. */
export function useAjustesBandeja(habilitado = true) {
  return useQuery({
    queryKey: clavesBandeja.ajustes,
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("bandeja", { body: {} });
      if (error) throw new Error(error.message);
      return (data ?? null) as AjustesBandeja | null;
    },
  });
}

export function useRealtimeBandeja() {
  const qc = useQueryClient();
  React.useEffect(() => {
    const canal = supabase.channel("nexdeveloper-bandeja");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "bandeja_entradas" }, () => {
      void qc.invalidateQueries({ queryKey: clavesBandeja.entradas });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [qc]);
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: clavesBandeja.entradas });
  void qc.invalidateQueries({ queryKey: clavesBandeja.fuentes });
}

export function useSincronizarGmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => llamar<{ nuevas?: number }>({ accion: "gmail_sincronizar" }),
    onSuccess: () => invalidar(qc),
  });
}

export function useAutorizarGmail() {
  return useMutation({
    mutationFn: async () => llamar<{ url?: string }>({ accion: "gmail_autorizar" }),
  });
}

export function useDesconectarFuente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (origen: string) => llamar({ accion: "desconectar", origen }),
    onSuccess: () => invalidar(qc),
  });
}

export type DatosWhatsApp = {
  phone_number_id: string;
  access_token?: string;
  numero?: string;
  verify_token?: string;
};

export function useConfigurarWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (datos: DatosWhatsApp) =>
      llamar<{ url_webhook?: string; verify_token?: string }>({ accion: "whatsapp_configurar", ...datos }),
    onSuccess: () => invalidar(qc),
  });
}

export function useGuardarConfiguracionFuente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, configuracion }: { id: string; configuracion: Json }) => {
      const { error } = await supabase.from("bandeja_fuentes").update({ configuracion }).eq("id", id);
      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useIngestarTexto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (datos: { asunto?: string; texto: string; remitente_nombre?: string }) =>
      llamar<{ id?: string }>({ accion: "ingestar", origen: "manual", ...datos }),
    onSuccess: () => invalidar(qc),
  });
}

export function useReclasificar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entradaId: string) =>
      llamar<{ entrada?: BandejaEntradaRow }>({ accion: "reclasificar", entrada_id: entradaId }),
    onSuccess: () => invalidar(qc),
  });
}

export function useConvertirEnTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (datos: { entrada_id: string; proyecto_id?: string | null; propuesta?: PropuestaTarea }) =>
      llamar<{ tarea_id?: string }>({ accion: "convertir", ...datos }),
    onSuccess: () => {
      invalidar(qc);
      void qc.invalidateQueries({ queryKey: ["tareas"] });
    },
  });
}

export function useActualizarEntrada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      cambios,
    }: {
      id: string;
      cambios: Partial<Omit<BandejaEntradaRow, "user_id" | "id">>;
    }) => {
      const { error } = await supabase.from("bandeja_entradas").update(cambios).eq("id", id);
      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useCambiarEstadoEntradas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, estado }: { ids: string[]; estado: EstadoEntradaBandeja }) => {
      const { error } = await supabase.from("bandeja_entradas").update({ estado }).in("id", ids);
      if (error) throw new Error(error.message);
      return ids;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useGuardarPalabrasClave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ proyectoId, palabras }: { proyectoId: string; palabras: string[] }) => {
      const { error } = await supabase
        .from("proyectos")
        .update({ palabras_clave: palabras })
        .eq("id", proyectoId);
      if (error) throw new Error(error.message);
      return proyectoId;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["proyectos"] });
    },
  });
}

/** Entradas que aún esperan una decisión del usuario. */
export function pendientes(entradas: { estado: EstadoEntradaBandeja }[]) {
  return entradas.filter((e) => e.estado === "nueva" || e.estado === "clasificada").length;
}

export function tonoConfianza(confianza: number | null) {
  if (confianza !== null && confianza >= 0.7) return "border-success/40 bg-success/10 text-success";
  if (confianza !== null && confianza >= 0.4) return "border-warning/40 bg-warning/10 text-warning";
  return "border-destructive/40 bg-destructive/10 text-destructive";
}
