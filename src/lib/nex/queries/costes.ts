import { useQuery } from "@tanstack/react-query";

import { supabase } from "../supabase";

export type ResumenCostesProyecto = {
  coste: number;
  tokensEntrada: number;
  tokensSalida: number;
  duracionMs: number;
  llamadas: number;
};

/** Suma real de tokens, coste y tiempo de IA consumidos por un proyecto. */
export function useCostesProyecto(proyectoId: string | null | undefined) {
  return useQuery({
    queryKey: ["costes_proyecto", proyectoId] as const,
    enabled: Boolean(proyectoId),
    queryFn: async (): Promise<ResumenCostesProyecto> => {
      const { data, error } = await supabase
        .from("consumos_ia")
        .select("tokens_entrada, tokens_salida, coste, duracion_ms")
        .eq("proyecto_id", proyectoId as string)
        .limit(5000);
      if (error) throw new Error(error.message);
      const filas = data ?? [];
      return filas.reduce<ResumenCostesProyecto>(
        (acc, f) => ({
          coste: acc.coste + Number(f.coste ?? 0),
          tokensEntrada: acc.tokensEntrada + Number(f.tokens_entrada ?? 0),
          tokensSalida: acc.tokensSalida + Number(f.tokens_salida ?? 0),
          duracionMs: acc.duracionMs + Number(f.duracion_ms ?? 0),
          llamadas: acc.llamadas + 1,
        }),
        { coste: 0, tokensEntrada: 0, tokensSalida: 0, duracionMs: 0, llamadas: 0 },
      );
    },
  });
}
