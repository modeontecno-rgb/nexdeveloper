import { claseCampo } from "@/components/nex/campos";
import type { ExpertoRow, OrigenExperto } from "@/lib/nex/db-types";
import { sumarUso, useExpertos } from "@/lib/nex/queries/expertos";

export const ETIQUETA_ORIGEN: Record<OrigenExperto, string> = {
  propio: "Propios",
  red: "Encontrados en la red",
  sugerido: "Sugeridos",
};

/** Desplegable de expertos adoptados, agrupados por origen. */
export function SelectorExperto({
  valor,
  onChange,
  className,
}: {
  valor: string | null | undefined;
  onChange: (expertoId: string | null) => void;
  className?: string;
}) {
  const { data: expertos = [] } = useExpertos();
  const adoptados = expertos.filter((e) => e.estado === "adoptado");

  const elegir = (id: string) => {
    const experto = adoptados.find((e) => e.id === id);
    onChange(id || null);
    if (experto) void sumarUso(experto);
  };

  return (
    <select
      aria-label="Experto"
      value={valor ?? ""}
      onChange={(e) => elegir(e.target.value)}
      className={`${claseCampo} ${className ?? ""}`}
    >
      <option value="">Sin experto</option>
      {(Object.keys(ETIQUETA_ORIGEN) as OrigenExperto[]).map((origen) => {
        const grupo = adoptados.filter((e: ExpertoRow) => e.origen === origen);
        if (grupo.length === 0) return null;
        return (
          <optgroup key={origen} label={ETIQUETA_ORIGEN[origen]}>
            {grupo.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
