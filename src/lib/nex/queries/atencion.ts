import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "../supabase";
import { claves } from "./claves";
import { registrarActividad } from "./mutaciones";

function refrescar(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: claves.tareas });
  void queryClient.invalidateQueries({ queryKey: claves.tareasAtencion });
  void queryClient.invalidateQueries({ queryKey: claves.actividad });
}

/** «Ya lo he hecho»: deja constancia de que has resuelto lo que se te pedía. */
export function useMarcarAtendida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, titulo, proyectoId }: { id: string; titulo: string; proyectoId: string }) => {
      const res = await supabase
        .from("tareas")
        .update({
          requiere_atencion: false,
          atendida_el: new Date().toISOString(),
          ultima_actividad: new Date().toISOString(),
        })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (res.error) throw new Error(res.error.message);
      await registrarActividad(proyectoId, "cambio", `Has atendido «${titulo}»`, {
        referencia_tabla: "tareas",
        referencia_id: id,
      });
    },
    onSuccess: () => {
      refrescar(queryClient);
      toast.success("Anotado: ya está atendido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Marca o desmarca una tarea como «necesita mi atención», con instrucciones. */
export function useMarcarAtencion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      requiereAtencion: boolean;
      instrucciones?: string | null;
      motivo?: string | null;
    }) => {
      const res = await supabase
        .from("tareas")
        .update({
          requiere_atencion: input.requiereAtencion,
          instrucciones: input.instrucciones ?? null,
          motivo_atencion: input.motivo ?? null,
          atendida_el: input.requiereAtencion ? null : new Date().toISOString(),
        })
        .eq("id", input.id)
        .select("id")
        .maybeSingle();
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      refrescar(queryClient);
      toast.success("Tarea actualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
