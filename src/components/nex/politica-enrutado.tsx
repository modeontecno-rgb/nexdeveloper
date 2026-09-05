import { GraduationCap, Wand2 } from "lucide-react";

import { Boton, claseCampo } from "@/components/nex/campos";
import type {
  EstrategiaEnrutado,
  ModeloIaRow,
  PoliticaEnrutadoRow,
  ProveedorIaRow,
  RendimientoModeloRow,
} from "@/lib/nex/db-types";
import {
  ETIQUETA_ESTRATEGIA,
  ETIQUETA_TAREA_IA,
  TAREAS_IA,
  modelosDisponibles,
  ordenarAprendido,
  ordenarPorEstrategia,
  trabajosDeTarea,
} from "@/lib/nex/enrutado";
import { useGuardarPolitica } from "@/lib/nex/queries/proveedores";

export function PoliticaEnrutado({
  politica,
  modelos,
  proveedores,
  rendimiento = [],
}: {
  politica: PoliticaEnrutadoRow[];
  modelos: ModeloIaRow[];
  proveedores: ProveedorIaRow[];
  rendimiento?: RendimientoModeloRow[];
}) {
  const guardar = useGuardarPolitica();

  const recalcular = () => {
    for (const tarea of TAREAS_IA) {
      const fila = politica.find((p) => p.tarea === tarea);
      const estrategia: EstrategiaEnrutado = fila?.estrategia ?? "mejor";
      const candidatos = ordenarPorEstrategia(modelosDisponibles(modelos, proveedores, tarea), estrategia);
      guardar.mutate({
        tarea,
        cambios: {
          estrategia,
          modelo_preferido_id: candidatos[0]?.id ?? null,
          modelo_respaldo_id: candidatos[1]?.id ?? null,
        },
      });
    }
  };

  const aprender = () => {
    for (const tarea of TAREAS_IA) {
      const candidatos = ordenarAprendido(modelosDisponibles(modelos, proveedores, tarea), rendimiento, tarea);
      guardar.mutate({
        tarea,
        cambios: {
          estrategia: "aprendido",
          modelo_preferido_id: candidatos[0]?.id ?? null,
          modelo_respaldo_id: candidatos[1]?.id ?? null,
        },
      });
    }
  };

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-semibold">Política de enrutado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Qué modelo se usa para cada tipo de trabajo. Solo aparecen modelos activos de proveedores activos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton variante="suave" onClick={recalcular}>
            <Wand2 className="size-4" /> Recalcular automáticamente
          </Boton>
          <Boton variante="suave" onClick={aprender}>
            <GraduationCap className="size-4" /> Aprender de mis consumos
          </Boton>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Tipo de trabajo</th>
              <th className="py-2 pr-3 font-medium">Estrategia</th>
              <th className="py-2 pr-3 font-medium">Modelo preferido</th>
              <th className="py-2 font-medium">Modelo de respaldo</th>
            </tr>
          </thead>
          <tbody>
            {TAREAS_IA.map((tarea) => {
              const fila = politica.find((p) => p.tarea === tarea);
              const disponibles = modelosDisponibles(modelos, proveedores);
              const validos = modelosDisponibles(modelos, proveedores, tarea);
              const preferido = disponibles.find((m) => m.id === fila?.modelo_preferido_id);
              const sinModelo = !preferido && validos.length === 0;
              const trabajos = trabajosDeTarea(rendimiento, tarea);

              return (
                <tr
                  key={tarea}
                  className={
                    sinModelo
                      ? "border-t border-warning/40 bg-warning/10 align-top"
                      : "border-t border-border align-top"
                  }
                >
                  <td className="py-2 pr-3">
                    <span className="font-medium text-foreground">{ETIQUETA_TAREA_IA[tarea]}</span>
                    {sinModelo ? (
                      <p className="mt-0.5 text-xs text-warning">Sin modelo activo para esta tarea</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {trabajos > 0 ? `Basado en ${trabajos} trabajos` : "Todavía sin datos de uso"}
                    </p>
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      value={fila?.estrategia ?? "mejor"}
                      onChange={(e) =>
                        guardar.mutate({ tarea, cambios: { estrategia: e.target.value as EstrategiaEnrutado } })
                      }
                      className={claseCampo}
                    >
                      {(Object.keys(ETIQUETA_ESTRATEGIA) as EstrategiaEnrutado[]).map((k) => (
                        <option key={k} value={k}>
                          {ETIQUETA_ESTRATEGIA[k]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <SelectorModelo
                      valor={fila?.modelo_preferido_id ?? ""}
                      modelos={disponibles}
                      onChange={(v) => guardar.mutate({ tarea, cambios: { modelo_preferido_id: v } })}
                    />
                  </td>
                  <td className="py-2">
                    <SelectorModelo
                      valor={fila?.modelo_respaldo_id ?? ""}
                      modelos={disponibles}
                      onChange={(v) => guardar.mutate({ tarea, cambios: { modelo_respaldo_id: v } })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SelectorModelo({
  valor,
  modelos,
  onChange,
}: {
  valor: string;
  modelos: ModeloIaRow[];
  onChange: (v: string | null) => void;
}) {
  return (
    <select value={valor} onChange={(e) => onChange(e.target.value || null)} className={claseCampo}>
      <option value="">Sin asignar</option>
      {modelos.map((m) => (
        <option key={m.id} value={m.id}>
          {m.nombre}
        </option>
      ))}
    </select>
  );
}
