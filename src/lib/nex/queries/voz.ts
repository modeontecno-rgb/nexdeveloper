import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type { EscenaGuion, GuionDemoRow, LocucionRow, VozConfigRow } from "../db-types";
import { supabase } from "../supabase";

export const MAX_CARACTERES_LOCUCION = 4800;

export const clavesVoz = {
  ping: ["voz_ping"] as const,
  voces: ["voz_voces"] as const,
  guiones: ["guiones_demo"] as const,
  locuciones: ["locuciones"] as const,
  config: ["voz_config"] as const,
};

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("voz", { body: cuerpo });
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

export type PingVoz = { ok?: boolean; elevenlabs?: boolean; almacen?: boolean };

export function usePingVoz(habilitado = true) {
  return useQuery({
    queryKey: clavesVoz.ping,
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("voz", { body: {} });
      if (error) throw new Error(error.message);
      return (data ?? {}) as PingVoz;
    },
  });
}

export type VozDisponible = {
  id: string;
  nombre: string;
  categoria?: string | null;
  idioma?: string | null;
  genero?: string | null;
  acento?: string | null;
  descripcion?: string | null;
  muestra_url?: string | null;
};

export type SuscripcionVoz = {
  plan?: string | null;
  caracteres_usados?: number | null;
  caracteres_limite?: number | null;
  renueva?: string | null;
};

export function useVocesDisponibles(habilitado = true) {
  return useQuery({
    queryKey: clavesVoz.voces,
    enabled: habilitado,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const r = await llamar<{ voces?: VozDisponible[]; suscripcion?: SuscripcionVoz }>({ accion: "voces" });
      return { voces: r.voces ?? [], suscripcion: r.suscripcion ?? null };
    },
  });
}

export function useGuionesDemo(proyectoId?: string) {
  return useQuery({
    queryKey: [...clavesVoz.guiones, proyectoId ?? "todos"],
    queryFn: async () => {
      let consulta = supabase.from("guiones_demo").select("*").order("creado_el", { ascending: false }).limit(200);
      if (proyectoId) consulta = consulta.eq("proyecto_id", proyectoId);
      const { data, error } = await consulta;
      if (error) throw new Error(error.message);
      return (data ?? []) as GuionDemoRow[];
    },
  });
}

export function useLocuciones(guionId?: string) {
  return useQuery({
    queryKey: [...clavesVoz.locuciones, guionId ?? "todas"],
    queryFn: async () => {
      let consulta = supabase.from("locuciones").select("*").order("creado_el", { ascending: false }).limit(300);
      if (guionId) consulta = consulta.eq("guion_id", guionId);
      const { data, error } = await consulta;
      if (error) throw new Error(error.message);
      return (data ?? []) as LocucionRow[];
    },
  });
}

export function useVozConfig() {
  return useQuery({
    queryKey: clavesVoz.config,
    queryFn: async () => {
      const { data, error } = await supabase.from("voz_config").select("*").limit(1);
      if (error) throw new Error(error.message);
      return ((data ?? [])[0] ?? null) as VozConfigRow | null;
    },
  });
}

/** Mantiene al día la tabla de locuciones mientras se generan los mp3. */
export function useRealtimeLocuciones(activo: boolean) {
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!activo) return;
    const canal = supabase.channel("nexdeveloper-locuciones");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "locuciones" }, () => {
      void queryClient.invalidateQueries({ queryKey: clavesVoz.locuciones });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [activo, queryClient]);
}

function useInvalidar() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: clavesVoz.guiones });
    void queryClient.invalidateQueries({ queryKey: clavesVoz.locuciones });
    void queryClient.invalidateQueries({ queryKey: clavesVoz.config });
  };
}

export type PeticionGuion = {
  proyectoId: string;
  duracionObjetivoSeg?: number;
  publico?: string;
  notas?: string;
};

/** Redacta un guion por escenas con capturas de las pantallas. */
export function useGenerarGuion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: PeticionGuion) =>
      llamar<{ guion?: GuionDemoRow }>({
        accion: "generar_guion",
        proyecto_id: v.proyectoId,
        ...(v.duracionObjetivoSeg ? { duracion_objetivo_seg: v.duracionObjetivoSeg } : {}),
        ...(v.publico ? { publico: v.publico } : {}),
        ...(v.notas ? { notas: v.notas } : {}),
      }),
    onSuccess: () => {
      invalidar();
      toast.success("Guion escrito.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGuardarGuion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({
      id,
      cambios,
    }: {
      id: string;
      cambios: { titulo?: string; publico?: string | null; escenas?: EscenaGuion[]; estado?: GuionDemoRow["estado"] };
    }) => {
      const { error } = await supabase.from("guiones_demo").update(cambios).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidar();
      toast.success("Guion guardado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBorrarGuion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("guiones_demo").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidar();
      toast.success("Guion borrado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type PeticionLocucion = {
  guionId?: string;
  escena?: number;
  texto?: string;
  titulo?: string;
  proyectoId?: string;
  vozId?: string;
};

export type ResultadoLocucion = {
  locucion_id?: string;
  url?: string;
  duracion_seg?: number;
  bytes?: number;
};

/** Genera el mp3 con ElevenLabs y lo guarda en el almacén. */
export function useLocutar() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: PeticionLocucion) =>
      llamar<ResultadoLocucion>({
        accion: "locutar",
        ...(v.guionId ? { guion_id: v.guionId } : {}),
        ...(typeof v.escena === "number" ? { escena: v.escena } : {}),
        ...(v.texto ? { texto: v.texto } : {}),
        ...(v.titulo ? { titulo: v.titulo } : {}),
        ...(v.proyectoId ? { proyecto_id: v.proyectoId } : {}),
        ...(v.vozId ? { voz_id: v.vozId } : {}),
      }),
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Enlace temporal (1 hora) al mp3 de una locución. */
export function useEnlaceLocucion() {
  return useMutation({
    mutationFn: ({ locucionId, descargar }: { locucionId: string; descargar?: boolean }) =>
      llamar<{ url?: string }>({
        accion: "enlace",
        locucion_id: locucionId,
        ...(descargar ? { descargar: true } : {}),
      }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGuardarVozConfig() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ id, cambios }: { id: string; cambios: Partial<Omit<VozConfigRow, "id" | "user_id">> }) => {
      const { error } = await supabase.from("voz_config").update(cambios).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidar();
      toast.success("Configuración de voz guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Segundos estimados de locución a partir del texto (unos 15 caracteres por segundo). */
export function segundosEstimados(texto: string) {
  return Math.max(1, Math.round(texto.trim().length / 15));
}

export function escenasOrdenadas(guion: GuionDemoRow | null | undefined): EscenaGuion[] {
  return [...(guion?.escenas ?? [])].sort((a, b) => a.orden - b.orden);
}
