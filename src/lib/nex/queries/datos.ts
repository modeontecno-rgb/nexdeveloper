import { useQuery } from "@tanstack/react-query";

import type {
  AccionRow,
  ActividadRow,
  AgenteRow,
  AjustesRow,
  AlertaRow,
  CargaAgenteRow,
  ChatRow,
  ConfiguracionAppRow,
  CredencialRefRow,
  IntegracionRow,
  MensajeRow,
  OrdenRow,
  PerfilRow,
  PreviewRow,
  ProyectoRow,
  PlantillaAccionRow,
  ResumenProyectoRow,
  TareaAtencionRow,
  TareaRow,
} from "../db-types";
import { supabase } from "../supabase";
import { claves } from "./claves";

async function pedir<T>(promesa: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { data, error } = await promesa;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export function useProyectos() {
  return useQuery({
    queryKey: claves.proyectos,
    queryFn: () =>
      pedir<ProyectoRow>(
        supabase.from("proyectos").select("*").order("es_favorito", { ascending: false }).order("orden"),
      ),
  });
}

export function useTareas() {
  return useQuery({
    queryKey: claves.tareas,
    queryFn: () => pedir<TareaRow>(supabase.from("tareas").select("*").order("orden")),
  });
}

export function useOrdenes() {
  return useQuery({
    queryKey: claves.ordenes,
    queryFn: () => pedir<OrdenRow>(supabase.from("ordenes").select("*").order("creado_el", { ascending: false })),
  });
}

export function useAgentes() {
  return useQuery({
    queryKey: claves.agentes,
    queryFn: () => pedir<AgenteRow>(supabase.from("agentes").select("*").order("nombre")),
  });
}

export function useCargaAgentes() {
  return useQuery({
    queryKey: claves.cargaAgentes,
    queryFn: () => pedir<CargaAgenteRow>(supabase.from("v_carga_agentes").select("*")),
  });
}

export function useResumenProyectos() {
  return useQuery({
    queryKey: claves.resumenProyectos,
    queryFn: () => pedir<ResumenProyectoRow>(supabase.from("v_resumen_proyecto").select("*")),
  });
}

export function useChats() {
  return useQuery({
    queryKey: claves.chats,
    queryFn: () => pedir<ChatRow>(supabase.from("chats").select("*")),
  });
}

export function useMensajes(chatId: string | null | undefined) {
  return useQuery({
    queryKey: [...claves.mensajes, chatId ?? "sin-chat"],
    enabled: Boolean(chatId),
    queryFn: () =>
      pedir<MensajeRow>(supabase.from("mensajes").select("*").eq("chat_id", chatId!).order("fecha")),
  });
}

export function useActividad(proyectoId?: string) {
  return useQuery({
    queryKey: [...claves.actividad, proyectoId ?? "todos"],
    queryFn: () => {
      const consulta = supabase.from("actividad").select("*").order("fecha", { ascending: false }).limit(120);
      return pedir<ActividadRow>(proyectoId ? consulta.eq("proyecto_id", proyectoId) : consulta);
    },
  });
}

export function useAlertas() {
  return useQuery({
    queryKey: claves.alertas,
    queryFn: () => pedir<AlertaRow>(supabase.from("alertas").select("*").eq("resuelta", false)),
  });
}

export function usePreviews() {
  return useQuery({
    queryKey: claves.previews,
    queryFn: () => pedir<PreviewRow>(supabase.from("previews").select("*")),
  });
}

export function useIntegraciones() {
  return useQuery({
    queryKey: claves.integraciones,
    queryFn: () => pedir<IntegracionRow>(supabase.from("integraciones").select("*").order("nombre")),
  });
}

export function useCredenciales() {
  return useQuery({
    queryKey: claves.credenciales,
    queryFn: () => pedir<CredencialRefRow>(supabase.from("credenciales_ref").select("*").order("referencia")),
  });
}

export function useAjustes() {
  return useQuery({
    queryKey: claves.ajustes,
    queryFn: async () => {
      const { data, error } = await supabase.from("ajustes").select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as AjustesRow | null;
    },
  });
}

export function usePerfil() {
  return useQuery({
    queryKey: claves.perfil,
    queryFn: async () => {
      const { data, error } = await supabase.from("perfiles").select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as PerfilRow | null;
    },
  });
}

export function useConfiguracionApp() {
  return useQuery({
    queryKey: claves.configuracionApp,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const filas = await pedir<ConfiguracionAppRow>(supabase.from("configuracion_app").select("clave,valor"));
      return Object.fromEntries(filas.map((f) => [f.clave, f.valor])) as Record<string, string>;
    },
  });
}

export function useTareasAtencion(proyectoId?: string) {
  return useQuery({
    queryKey: [...claves.tareasAtencion, proyectoId ?? "todos"],
    queryFn: () => {
      const consulta = supabase.from("v_tareas_atencion").select("*");
      return pedir<TareaAtencionRow>(proyectoId ? consulta.eq("proyecto_id", proyectoId) : consulta);
    },
  });
}

export function useAcciones(proyectoId?: string) {
  return useQuery({
    queryKey: [...claves.acciones, proyectoId ?? "todas"],
    queryFn: () => {
      const consulta = supabase.from("acciones").select("*").order("creado_el", { ascending: false });
      return pedir<AccionRow>(proyectoId ? consulta.eq("proyecto_id", proyectoId) : consulta);
    },
  });
}

export function usePlantillasAccion() {
  return useQuery({
    queryKey: claves.plantillasAccion,
    staleTime: 5 * 60 * 1000,
    queryFn: () => pedir<PlantillaAccionRow>(supabase.from("plantillas_accion").select("*").order("orden")),
  });
}

export function useIntegracionProyectos() {
  return useQuery({
    queryKey: claves.integracionProyectos,
    queryFn: () =>
      pedir<{ integracion_id: string; proyecto_id: string; permisos: string[] }>(
        supabase.from("integracion_proyectos").select("integracion_id,proyecto_id,permisos"),
      ),
  });
}
