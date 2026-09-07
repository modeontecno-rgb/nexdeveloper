import { Check } from "lucide-react";

import { EstadoTareaBadge, PrioridadBadge } from "@/components/nex/badges";
import { Selector } from "@/components/nex/campos";
import { SelectorExperto } from "@/components/nex/selector-experto";
import type { AgenteRow, EstadoTarea, Prioridad, TareaRow } from "@/lib/nex/db-types";
import { ETIQUETA_ESTADO_TAREA, ETIQUETA_PRIORIDAD, formatoDinero, formatoFecha } from "@/lib/nex/labels";
import { useAsignarExperto } from "@/lib/nex/queries/expertos";
import { useCambiarEstadoTarea, useCambiarPrioridadTarea } from "@/lib/nex/queries/mutaciones";

/** Tabla del plan de trabajo: siempre visible, con totales y previsión real. */
export function PlanTrabajo({
  tareas,
  agentes,
  moneda,
}: {
  tareas: TareaRow[];
  agentes: AgenteRow[];
  moneda: string;
}) {
  const cambiarEstado = useCambiarEstadoTarea();
  const cambiarPrioridad = useCambiarPrioridadTarea();
  const asignarExperto = useAsignarExperto("tareas");
  const nombreAgente = (id: string | null) => agentes.find((a) => a.id === id)?.nombre ?? "Sin asignar";

  const totalHoras = tareas.reduce((s, t) => s + Number(t.estimacion_horas), 0);
  const totalCoste = tareas.reduce((s, t) => s + Number(t.coste_estimado), 0);
  const consumido = tareas.reduce((s, t) => s + Number(t.coste_consumido), 0);
  const restantes = tareas
    .filter((t) => t.estado !== "completada" && t.estado !== "cancelada")
    .map((t) => Math.max(0, Number(t.estimacion_horas) - Number(t.horas_consumidas)) * (t.estado === "bloqueada" ? 2 : 1));
  // Con varias tareas a la vez, la fecha real la marca la más lenta, no la suma.
  const cuelloBotella = restantes.length ? Math.max(...restantes) : 0;
  const finPrevisto = new Date(Date.now() + cuelloBotella * 3 * 3600000).toISOString();

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold">Plan de trabajo</h2>
        <p className="text-xs text-muted-foreground">
          Previsión de finalización: <strong className="text-foreground">{formatoFecha(finPrevisto)}</strong> ·
          cuello de botella {cuelloBotella.toFixed(1)} h
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[62rem] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Tarea</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Agente</th>
              <th className="px-3 py-2 font-medium">Prioridad</th>
              <th className="px-3 py-2 font-medium">Enviada</th>
              <th className="px-3 py-2 text-right font-medium">Horas real / estimada</th>
              <th className="px-3 py-2 text-right font-medium">Coste real / estimado</th>
              <th className="px-3 py-2 text-center font-medium">Hecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tareas.map((t) => (
              <tr key={t.id} className="align-middle">
                <td className="max-w-[22rem] px-4 py-2.5">
                  <p className="truncate font-medium text-foreground">{t.titulo}</p>
                  {t.completada_el ? (
                    <p className="text-xs text-success">
                      Completada por {t.completada_por ?? "el equipo"} · {formatoFecha(t.completada_el)}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5">
                  <Selector
                    etiqueta=""
                    valor={t.estado}
                    onChange={(v) =>
                      cambiarEstado.mutate({
                        id: t.id,
                        estado: v as EstadoTarea,
                        proyectoId: t.proyecto_id,
                        titulo: t.titulo,
                      })
                    }
                    opciones={Object.entries(ETIQUETA_ESTADO_TAREA).map(([valor, texto]) => ({ valor, texto }))}
                  />
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <p>{nombreAgente(t.agente_id)}</p>
                  <SelectorExperto
                    valor={t.experto_id}
                    onChange={(expertoId) => asignarExperto.mutate({ id: t.id, expertoId })}
                    className="mt-1 min-w-[10rem] py-1 text-xs"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Selector
                    etiqueta=""
                    valor={t.prioridad}
                    onChange={(v) => cambiarPrioridad.mutate({ id: t.id, prioridad: v as Prioridad })}
                    opciones={Object.entries(ETIQUETA_PRIORIDAD).map(([valor, texto]) => ({ valor, texto }))}
                  />
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{formatoFecha(t.enviada_el)}</td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">
                  {Number(t.horas_consumidas).toFixed(1)} / {Number(t.estimacion_horas).toFixed(1)}
                </td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">
                  {formatoDinero(Number(t.coste_consumido), moneda)} / {formatoDinero(Number(t.coste_estimado), moneda)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <button
                    type="button"
                    aria-label={`Marcar «${t.titulo}» como completada`}
                    onClick={() =>
                      cambiarEstado.mutate({
                        id: t.id,
                        estado: "completada",
                        proyectoId: t.proyecto_id,
                        titulo: t.titulo,
                      })
                    }
                    className={
                      t.estado === "completada"
                        ? "grid size-6 place-items-center rounded-md border border-success/50 bg-success/15 text-success"
                        : "grid size-6 place-items-center rounded-md border border-border text-muted-foreground transition hover:border-success/50 hover:text-success"
                    }
                  >
                    <Check className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {tareas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Todavía no hay tareas en este plan de trabajo.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-muted/40 text-xs">
            <tr>
              <td className="px-4 py-2.5 font-medium" colSpan={5}>
                Totales ({tareas.length} tareas)
              </td>
              <td className="px-3 py-2.5 text-right font-medium">{totalHoras.toFixed(1)} h</td>
              <td className="px-3 py-2.5 text-right font-medium">
                {formatoDinero(consumido, moneda)} / {formatoDinero(totalCoste, moneda)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
        {tareas.slice(0, 6).map((t) => (
          <span key={t.id} className="flex items-center gap-1.5">
            <EstadoTareaBadge estado={t.estado} />
            <PrioridadBadge prioridad={t.prioridad} />
          </span>
        ))}
      </div>
    </div>
  );
}
