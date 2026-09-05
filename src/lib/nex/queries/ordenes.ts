import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AjustesRow, ModoEjecucion, OrdenRow, Prioridad, Riesgo } from "../db-types";
import { supabase } from "../supabase";
import { claves } from "./claves";
import { crearAlerta, registrarActividad } from "./mutaciones";

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
  calidadPrevista: number;
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

function necesitaAprobacion(orden: NuevaOrden, ajustes: AjustesRow | null) {
  if (!ajustes) return orden.costeEstimado > 150;
  if (orden.costeEstimado > ajustes.umbral_aprobacion_eur) return true;
  if (ajustes.aprobar_si_prioridad_critica && orden.prioridad === "critica") return true;
  if (ajustes.aprobar_si_riesgo_alto && orden.riesgo === "Alto") return true;
  return false;
}

async function crearTareaDesdeOrden(orden: OrdenRow) {
  if (!orden.proyecto_id) return;
  await supabase.from("tareas").insert({
    proyecto_id: orden.proyecto_id,
    orden_id: orden.id,
    titulo: orden.texto.slice(0, 120),
    descripcion: orden.texto,
    estado: "en_cola",
    prioridad: orden.prioridad,
    agente_id: orden.agente_id,
    enviada_el: new Date().toISOString(),
    estimacion_horas: orden.horas_estimadas,
    coste_estimado: orden.coste_estimado,
  });
}

export function useCrearOrden() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entrada, ajustes }: { entrada: NuevaOrden; ajustes: AjustesRow | null }) => {
      const sugerencia = await sugerirProyecto(entrada.texto);
      const umbralConfianza = ajustes?.umbral_confianza_reorganizacion ?? 0.85;
      const automatica = ajustes?.reorganizacion_automatica ?? true;

      let proyectoFinal = entrada.proyectoId;
      let proyectoOrigen: string | null = null;
      let confianza: number | null = sugerencia?.confianza ?? null;
      let reorganizada: string | null = null;
      let pendienteConfirmar = false;

      if (sugerencia && sugerencia.proyecto_id !== entrada.proyectoId) {
        if (automatica && sugerencia.confianza >= umbralConfianza) {
          proyectoOrigen = entrada.proyectoId;
          proyectoFinal = sugerencia.proyecto_id;
          reorganizada = new Date().toISOString();
        } else {
          pendienteConfirmar = true;
        }
      }

      const requiere = necesitaAprobacion(entrada, ajustes);
      const fila = await supabase
        .from("ordenes")
        .insert({
          proyecto_id: proyectoFinal,
          chat_id: entrada.chatId ?? null,
          texto: entrada.texto,
          modo: entrada.modo,
          prioridad: entrada.prioridad,
          agente_id: entrada.agenteId,
          equipo: entrada.equipo,
          estado: requiere ? "pendiente_aprobacion" : "en_cola",
          coste_estimado: entrada.costeEstimado,
          horas_estimadas: entrada.horasEstimadas,
          riesgo: entrada.riesgo,
          calidad_prevista: entrada.calidadPrevista,
          requiere_aprobacion: requiere,
          motivo_aprobacion: requiere ? motivo(entrada, ajustes) : null,
          proyecto_origen_id: proyectoOrigen,
          confianza_clasificacion: confianza,
          reorganizada_el: reorganizada,
          pendiente_confirmar_proyecto: pendienteConfirmar,
        })
        .select("*")
        .single();

      if (fila.error) throw new Error(fila.error.message);
      const orden = fila.data as OrdenRow;

      await supabase.from("estimaciones").insert({
        proyecto_id: orden.proyecto_id,
        orden_id: orden.id,
        agente_id: orden.agente_id,
        modo: orden.modo,
        horas_estimadas: orden.horas_estimadas,
        coste_estimado: orden.coste_estimado,
        calidad_prevista: orden.calidad_prevista,
        riesgo: orden.riesgo,
      });

      if (reorganizada && sugerencia) {
        await registrarActividad(
          proyectoFinal,
          "reorganizacion",
          `Orden reasignada automáticamente a «${sugerencia.nombre}» con ${Math.round(sugerencia.confianza * 100)}% de confianza`,
          { referencia_tabla: "ordenes", referencia_id: orden.id },
        );
      }

      if (pendienteConfirmar && sugerencia) {
        await crearAlerta(
          proyectoFinal,
          `Una orden podría pertenecer a «${sugerencia.nombre}» (${Math.round(sugerencia.confianza * 100)}% de confianza). Confirma el proyecto.`,
          "aviso",
          true,
        );
      }

      if (requiere) {
        await registrarActividad(orden.proyecto_id, "aprobacion", `Orden pendiente de aprobación: ${orden.texto.slice(0, 60)}`, {
          referencia_tabla: "ordenes",
          referencia_id: orden.id,
        });
      } else {
        await crearTareaDesdeOrden(orden);
        await registrarActividad(orden.proyecto_id, "orden", `Orden enviada a la cola: ${orden.texto.slice(0, 60)}`, {
          referencia_tabla: "ordenes",
          referencia_id: orden.id,
        });
      }

      return orden;
    },
    onSuccess: (orden) => {
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

function motivo(entrada: NuevaOrden, ajustes: AjustesRow | null) {
  const razones: string[] = [];
  if (entrada.costeEstimado > (ajustes?.umbral_aprobacion_eur ?? 150)) razones.push("supera el umbral de coste");
  if (ajustes?.aprobar_si_prioridad_critica && entrada.prioridad === "critica") razones.push("prioridad crítica");
  if (ajustes?.aprobar_si_riesgo_alto && entrada.riesgo === "Alto") razones.push("riesgo alto");
  return razones.join(", ") || "requiere revisión manual";
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
      const { data: sesion } = await supabase.auth.getUser();
      let resueltaPor: string | null = sesion.user?.email ?? null;
      if (sesion.user?.id) {
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("nombre_completo")
          .eq("id", sesion.user.id)
          .maybeSingle();
        resueltaPor = perfil?.nombre_completo ?? sesion.user.email ?? null;
      }
      const actualizada = await supabase
        .from("ordenes")
        .update({
          estado: decision === "aprobada" ? "en_cola" : "rechazada",
          resuelta_el: new Date().toISOString(),
          resuelta_por: resueltaPor,
          comentario: comentario ?? null,
        })
        .eq("id", orden.id)
        .select("*")
        .single();
      if (actualizada.error) throw new Error(actualizada.error.message);

      if (decision === "aprobada") {
        await crearTareaDesdeOrden(actualizada.data as OrdenRow);
        await registrarActividad(orden.proyecto_id, "orden", `Orden aprobada y enviada a la cola: ${orden.texto.slice(0, 60)}`);
      } else {
        await registrarActividad(orden.proyecto_id, "decision", `Orden rechazada: ${orden.texto.slice(0, 60)}`);
      }
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
      const res = await supabase.from("ordenes").update({ estado: "cancelada" }).eq("id", id).select("id").maybeSingle();
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: claves.ordenes }),
    onError: (e: Error) => toast.error(e.message),
  });
}
