import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type {
  AjustesRow,
  EstadoTarea,
  NivelAlerta,
  Prioridad,
  ProyectoRow,
  TipoActividad,
} from "../db-types";
import { crearSlug } from "../labels";
import { supabase } from "../supabase";
import { claves } from "./claves";

async function comprobar<T>(res: { data: T | null; error: { message: string } | null }) {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Nombre visible del usuario actual (perfil o correo), para dejar constancia de quién decide. */
export async function nombreDelUsuario(): Promise<string | null> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return null;
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo")
    .eq("id", sesion.user.id)
    .maybeSingle();
  return perfil?.nombre_completo ?? sesion.user.email ?? null;
}

export async function registrarActividad(
  proyectoId: string | null,
  tipo: TipoActividad,
  texto: string,
  extras: { referencia_tabla?: string; referencia_id?: string } = {},
  userId?: string,
) {
  await supabase.from("actividad").insert({ proyecto_id: proyectoId, tipo, texto, ...extras, ...(userId ? { user_id: userId } : {}) });
}

export async function crearAlerta(
  proyectoId: string | null,
  texto: string,
  nivel: NivelAlerta,
  requiereDecision = false,
  userId?: string,
) {
  await supabase.from("alertas").insert({
    proyecto_id: proyectoId,
    texto,
    nivel,
    requiere_decision: requiereDecision,
    ...(userId ? { user_id: userId } : {}),
  });
}

function useAccion<V>(fn: (v: V) => Promise<void>, mensajeOk: string, invalidar: readonly string[][]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const clave of invalidar) void queryClient.invalidateQueries({ queryKey: clave });
      toast.success(mensajeOk);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ---------------------------------- Tareas --------------------------------- */

export function useCambiarEstadoTarea() {
  return useAccion<{ id: string; estado: EstadoTarea; proyectoId: string; titulo: string }>(
    async ({ id, estado, proyectoId, titulo }) => {
      await comprobar(
        await supabase
          .from("tareas")
          .update({ estado, ultima_actividad: new Date().toISOString() })
          .eq("id", id)
          .select("id")
          .maybeSingle(),
      );
      await registrarActividad(proyectoId, "cambio", `«${titulo}» pasa a ${estado.replace("_", " ")}`, {
        referencia_tabla: "tareas",
        referencia_id: id,
      });
    },
    "Tarea actualizada.",
    [[...claves.tareas], [...claves.actividad], [...claves.resumenProyectos]],
  );
}

export function useCambiarPrioridadTarea() {
  return useAccion<{ id: string; prioridad: Prioridad }>(
    async ({ id, prioridad }) => {
      await comprobar(await supabase.from("tareas").update({ prioridad }).eq("id", id).select("id").maybeSingle());
    },
    "Prioridad actualizada.",
    [[...claves.tareas]],
  );
}

export function useMoverTarea() {
  return useAccion<{ id: string; proyectoId: string; origenId: string; titulo: string }>(
    async ({ id, proyectoId, origenId, titulo }) => {
      await comprobar(
        await supabase
          .from("tareas")
          .update({ proyecto_id: proyectoId, proyecto_origen_id: origenId })
          .eq("id", id)
          .select("id")
          .maybeSingle(),
      );
      await registrarActividad(proyectoId, "reorganizacion", `«${titulo}» movida manualmente a otro proyecto`, {
        referencia_tabla: "tareas",
        referencia_id: id,
      });
    },
    "Tarea movida.",
    [[...claves.tareas], [...claves.actividad], [...claves.resumenProyectos]],
  );
}

/* --------------------------------- Proyectos -------------------------------- */

export function useCrearProyecto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nombre: string; descripcion: string; repositorio?: string | undefined }) => {
      const fila = await comprobar(
        await supabase
          .from("proyectos")
          .insert({
            nombre: input.nombre,
            slug: `${crearSlug(input.nombre)}-${Math.random().toString(36).slice(2, 6)}`,
            descripcion: input.descripcion,
            repositorio: input.repositorio ?? null,
            estado: "planificando",
            prioridad: "media",
          })
          .select("*")
          .single(),
      );
      const proyecto = fila as unknown as ProyectoRow;
      await supabase.from("chats").insert({
        proyecto_id: proyecto.id,
        titulo: `Chat de ${proyecto.nombre}`,
        es_principal: true,
      });
      await registrarActividad(proyecto.id, "cambio", `Proyecto «${proyecto.nombre}» creado`);
      return proyecto;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: claves.proyectos });
      void queryClient.invalidateQueries({ queryKey: claves.chats });
      toast.success("Proyecto creado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useActualizarProyecto() {
  return useAccion<{ id: string; cambios: Partial<Omit<ProyectoRow, "id" | "user_id">>; confirmado?: boolean }>(
    async ({ id, cambios, confirmado }) => {
      // Nada se da por terminado con el control de calidad en rojo.
      if (cambios.estado === "completado") {
        const { data: proyecto } = await supabase
          .from("proyectos")
          .select("semaforo_calidad")
          .eq("id", id)
          .maybeSingle();
        const semaforo = proyecto?.semaforo_calidad ?? "sin_datos";
        if (semaforo === "rojo") {
          throw new Error("No se puede publicar en rojo: corrige los controles bloqueantes.");
        }
        if (semaforo === "ambar" && !confirmado) {
          throw new Error(
            "El control de calidad está en ámbar. Vuelve a pulsar para publicar de todos modos.",
          );
        }
      }
      await comprobar(await supabase.from("proyectos").update(cambios).eq("id", id).select("id").maybeSingle());
    },
    "Proyecto actualizado.",
    [[...claves.proyectos]],
  );
}

/* ---------------------------------- Chats ---------------------------------- */

export function useEnviarMensaje() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { chatId: string; proyectoId: string | null; texto: string }) => {
      await comprobar(
        await supabase
          .from("mensajes")
          .insert({
            chat_id: input.chatId,
            proyecto_id: input.proyectoId,
            autor: "usuario",
            texto: input.texto,
          })
          .select("id")
          .single(),
      );
      await registrarActividad(input.proyectoId, "actividad", "Nuevo mensaje en el chat del proyecto");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: claves.mensajes });
      void queryClient.invalidateQueries({ queryKey: claves.actividad });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMoverChat() {
  return useAccion<{ id: string; proyectoId: string | null; origenId: string | null }>(
    async ({ id, proyectoId, origenId }) => {
      await comprobar(
        await supabase
          .from("chats")
          .update({
            proyecto_id: proyectoId,
            proyecto_origen_id: origenId,
            reorganizado_el: new Date().toISOString(),
          })
          .eq("id", id)
          .select("id")
          .maybeSingle(),
      );
      await supabase.from("mensajes").update({ proyecto_id: proyectoId }).eq("chat_id", id);
      await registrarActividad(proyectoId, "reorganizacion", "Conversación movida manualmente de proyecto");
    },
    "Conversación movida.",
    [[...claves.chats], [...claves.mensajes], [...claves.actividad]],
  );
}

/* --------------------------------- Ajustes --------------------------------- */

export function useGuardarAjustes() {
  return useAccion<Partial<Omit<AjustesRow, "user_id">>>(
    async (cambios) => {
      const { data: existentes } = await supabase.from("ajustes").select("user_id").maybeSingle();
      if (existentes) {
        await comprobar(
          await supabase.from("ajustes").update(cambios).eq("user_id", existentes.user_id).select("user_id").maybeSingle(),
        );
      } else {
        await comprobar(await supabase.from("ajustes").insert(cambios).select("user_id").single());
      }
    },
    "Ajustes guardados.",
    [[...claves.ajustes]],
  );
}

export function useResolverAlerta() {
  return useAccion<{ id: string }>(
    async ({ id }) => {
      await comprobar(
        await supabase
          .from("alertas")
          .update({ resuelta: true, resuelta_el: new Date().toISOString() })
          .eq("id", id)
          .select("id")
          .maybeSingle(),
      );
    },
    "Alerta resuelta.",
    [[...claves.alertas]],
  );
}
