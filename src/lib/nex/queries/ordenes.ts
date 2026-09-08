import {useRef} from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AjustesRow, ModoEjecucion, OrdenRow, Prioridad, Riesgo } from "../db-types";
import { supabase } from "../supabase";
import { claves } from "./claves";
import { registrarActividad } from "./mutaciones";

export interface NuevaOrden {
  proyectoId: string | null;
  chatId?: string | null;
  texto: string;
  modo: ModoEjecucion;
  prioridad: Prioridad;
  agenteId: string | null;
  equipo: string[];
  costeEstimado: number;
  horasEstimadas: number;
  riesgo: Riesgo;
  calidadPrevista: number | null;
  origenMesaId?: string;
}

export interface Sugerencia {
  proyecto_id: string;
  nombre: string;
  confianza: number;
}

export async function sugerirProyecto(texto: string): Promise<Sugerencia | null> {
  const { data, error } = await supabase.rpc("sugerir_proyecto", { p_texto: texto });
  if (error || !data || data.length === 0) return null;
  const ordenadas = [...data].sort((a, b) => b.confianza - a.confianza);
  return ordenadas[0] ?? null;
}

export function useCrearOrden() {
  const queryClient = useQueryClient();
  const solicitud=useRef<{contenido:string;id:string}|null>(null);

  return useMutation({
    mutationFn: async ({ entrada, ajustes }: { entrada: NuevaOrden; ajustes: AjustesRow | null }) => {
      const datos={proyecto_id:entrada.proyectoId,chat_id:entrada.chatId??null,texto:entrada.texto,modo:entrada.modo,prioridad:entrada.prioridad,agente_id:entrada.agenteId,equipo:entrada.equipo,coste_estimado:entrada.costeEstimado,horas_estimadas:entrada.horasEstimadas,riesgo:entrada.riesgo,calidad_prevista:entrada.calidadPrevista,origen_mesa_id:entrada.origenMesaId??null};
      const contenido=JSON.stringify(datos);if(solicitud.current?.contenido!==contenido)solicitud.current={contenido,id:crypto.randomUUID()};
      const {data,error}=await supabase.rpc('crear_orden_completa',{p_solicitud:solicitud.current.id,p_datos:datos});
      if(error||!data)throw new Error(error?.message??'No se pudo registrar la orden');
      return data as unknown as OrdenRow;
    },
    onSuccess: (orden) => {
      solicitud.current=null;
      for (const clave of [claves.ordenes, claves.tareas, claves.actividad, claves.alertas, claves.resumenProyectos]) {
        void queryClient.invalidateQueries({ queryKey: clave });
      }
      toast.success(
        orden.requiere_aprobacion ? "Orden creada. Necesita tu aprobación." : "Orden enviada a la cola.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResolverOrden() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orden,
      decision,
      comentario,
    }: {
      orden: OrdenRow;
      decision: "aprobada" | "rechazada";
      comentario?: string;
    }) => {
      const {error}=await supabase.rpc('resolver_orden_completa',{p_orden:orden.id,p_decision:decision,...(comentario!==undefined?{p_comentario:comentario}:{})});if(error)throw new Error(error.message);
    },
    onSuccess: () => {
      for (const clave of [claves.ordenes, claves.tareas, claves.actividad, claves.resumenProyectos]) {
        void queryClient.invalidateQueries({ queryKey: clave });
      }
      toast.success("Decisión registrada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMoverOrden() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orden, proyectoId }: { orden: OrdenRow; proyectoId: string | null }) => {
      const res = await supabase
        .from("ordenes")
        .update({
          proyecto_id: proyectoId,
          proyecto_origen_id: orden.proyecto_id,
          reorganizada_el: new Date().toISOString(),
          pendiente_confirmar_proyecto: false,
        })
        .eq("id", orden.id)
        .select("id")
        .maybeSingle();
      if (res.error) throw new Error(res.error.message);
      await registrarActividad(proyectoId, "reorganizacion", `Orden movida manualmente: ${orden.texto.slice(0, 60)}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: claves.ordenes });
      void queryClient.invalidateQueries({ queryKey: claves.actividad });
      toast.success("Orden movida de proyecto.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelarOrden() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.rpc("cancelar_orden_completa",{p_orden:id});
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: claves.ordenes }),
    onError: (e: Error) => toast.error(e.message),
  });
}
