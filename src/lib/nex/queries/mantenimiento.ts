import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AvisoRow,
  InfraIncidenciaRow,
  MesaRow,
  PeticionDirectaRow,
  ProyectoRow,
  TareaRow,
} from "../db-types";
import { detectarProblemas, type Problema, type TipoArreglo } from "../diagnostico";
import { tablasABorrar, type BloqueLimpieza } from "../mantenimiento";
import { supabase } from "../supabase";

export const clavesMantenimiento = {
  diagnostico: ["diagnostico"] as const,
};

async function lista<T>(promesa: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const { data, error } = await promesa;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

/** Busca problemas en toda la cartera y propone cómo arreglarlos. */
export function useDiagnostico(habilitado = true) {
  return useQuery<Problema[]>({
    queryKey: clavesMantenimiento.diagnostico,
    enabled: habilitado,
    queryFn: async () => {
      const [tareas, peticiones, avisos, incidencias, proyectos, mesas] = await Promise.all([
        lista<TareaRow>(supabase.from("tareas").select("*")),
        lista<PeticionDirectaRow>(supabase.from("peticiones_directas").select("*")),
        lista<AvisoRow>(supabase.from("avisos").select("*")),
        lista<InfraIncidenciaRow>(supabase.from("infra_incidencias").select("*")),
        lista<ProyectoRow>(supabase.from("proyectos").select("*")),
        lista<MesaRow>(supabase.from("mesas").select("*")),
      ]);
      const limite = Date.now() - 2 * 60 * 60 * 1000;
      const mesasConError = mesas
        .filter(
          (m) =>
            m.estado === "error" ||
            (m.estado === "deliberando" && new Date(m.creado_el).getTime() < limite),
        )
        .map((m) => ({ id: m.id, pregunta: m.titulo ?? m.pregunta }));
      return detectarProblemas({ tareas, peticiones, avisos, incidencias, proyectos, mesasConError });
    },
  });
}

/** Aplica uno de los arreglos automáticos. */
export function useAplicarArreglo() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({ tipo, ids }: { tipo: TipoArreglo; ids: string[] }) => {
      if (ids.length === 0) return;
      if (tipo === "desbloquear_tareas") {
        const { error } = await supabase
          .from("tareas")
          .update({ estado: "en_cola", progreso: 0 })
          .in("id", ids);
        if (error) throw new Error(error.message);
        return;
      }
      if (tipo === "marcar_avisos_leidos") {
        const { error } = await supabase.from("avisos").update({ leido: true }).in("id", ids);
        if (error) throw new Error(error.message);
        return;
      }
      if (tipo === "borrar_peticiones_error") {
        await supabase.from("peticiones_mensajes").delete().in("peticion_id", ids);
        await supabase.from("peticiones_adjuntos").delete().in("peticion_id", ids);
        const { error } = await supabase.from("peticiones_directas").delete().in("id", ids);
        if (error) throw new Error(error.message);
        return;
      }
      await supabase.from("mesa_valoraciones").delete().in("mesa_id", ids);
      await supabase.from("mesa_intervenciones").delete().in("mesa_id", ids);
      const { error } = await supabase.from("mesas").delete().in("id", ids);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void cliente.invalidateQueries();
    },
  });
}

export type ResultadoLimpieza = { tabla: string; borrados: number | null; error?: string };

/** Vacía los bloques elegidos. Solo afecta a los datos del propietario. */
export function useLimpiarTrabajo() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (bloques: BloqueLimpieza[]): Promise<ResultadoLimpieza[]> => {
      const resultados: ResultadoLimpieza[] = [];
      for (const tabla of tablasABorrar(bloques)) {
        const { error, count } = await supabase
          .from(tabla as "tareas")
          .delete({ count: "exact" })
          .not("id", "is", null);
        resultados.push({ tabla, borrados: count ?? null, ...(error ? { error: error.message } : {}) });
      }
      return resultados;
    },
    onSuccess: () => {
      void cliente.invalidateQueries();
    },
  });
}
