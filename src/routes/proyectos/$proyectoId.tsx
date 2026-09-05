import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink, Send } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { EstadoProyectoBadge, EstadoTareaBadge, PrioridadBadge, Progreso } from "@/components/nex/badges";
import { desde, formatoEuros, formatoFecha, formatoFechaHora } from "@/lib/nex/labels";
import { resumenPlan, useNex } from "@/lib/nex/store";

export const Route = createFileRoute("/proyectos/$proyectoId")({
  head: () => ({
    meta: [
      { title: "Proyecto · NexDeveloper" },
      { name: "description", content: "Chat, plan de trabajo, tareas, costes y vistas previas del proyecto." },
      { property: "og:title", content: "Proyecto · NexDeveloper" },
      { property: "og:description", content: "Chat, plan de trabajo, tareas, costes y vistas previas del proyecto." },
    ],
  }),
  component: DetalleProyecto,
});

function DetalleProyecto() {
  const { proyectoId } = Route.useParams();
  const nex = useNex();
  const proyecto = nex.proyectos.find((p) => p.id === proyectoId);
  const [texto, setTexto] = React.useState("");

  if (!proyecto) {
    return (
      <div className="panel p-6">
        <p className="text-sm text-muted-foreground">Este proyecto ya no existe.</p>
        <Link to="/proyectos" className="mt-3 inline-block text-sm text-primary">
          Volver a proyectos
        </Link>
      </div>
    );
  }

  const tareas = nex.tareas.filter((t) => t.proyectoId === proyecto.id);
  const mensajes = nex.mensajes.filter((m) => m.proyectoId === proyecto.id);
  const actividad = nex.actividad.filter((a) => a.proyectoId === proyecto.id);
  const previews = nex.previews.filter((p) => p.proyectoId === proyecto.id);
  const resumen = resumenPlan(tareas);
  const nombreAgente = (id: string | null) => nex.agentes.find((a) => a.id === id)?.nombre ?? "Sin asignar";

  return (
    <>
      <Encabezado
        titulo={proyecto.nombre}
        descripcion={proyecto.descripcion}
        acciones={
          <>
            <EstadoProyectoBadge estado={proyecto.estado} />
            <PrioridadBadge prioridad={proyecto.prioridad} />
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Dato titulo="Progreso" valor={`${resumen.total ? Math.round((resumen.completadas / resumen.total) * 100) : 0}%`} />
        <Dato titulo="Coste consumido" valor={formatoEuros(proyecto.consumido)} pie={`de ${formatoEuros(proyecto.presupuesto)}`} />
        <Dato titulo="Agentes asignados" valor={proyecto.agentes.map(nombreAgente).join(", ") || "Ninguno"} />
        <Dato titulo="Fin previsto" valor={formatoFecha(resumen.finPrevisto)} pie={`${resumen.esfuerzoRestante} h restantes`} />
      </section>

      {/* PLAN DE TRABAJO — siempre visible */}
      <section className="panel mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-semibold">Plan de trabajo · {proyecto.nombre}</h2>
          <span className="text-xs text-muted-foreground">Se actualiza al avanzar, bloquear o completar tareas</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Tarea</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Agente</th>
                <th className="px-4 py-3 font-medium">Prioridad</th>
                <th className="px-4 py-3 font-medium">Enviada</th>
                <th className="px-4 py-3 font-medium">Estimación</th>
                <th className="px-4 py-3 font-medium">Restante</th>
                <th className="px-4 py-3 font-medium">Coste est.</th>
                <th className="px-4 py-3 font-medium">Coste real</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tareas.map((t) => {
                const restante = Math.max(0, t.estimacionHoras - t.horasConsumidas);
                return (
                  <tr key={t.id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        {t.estado === "completada" && <CheckCircle2 className="size-4 shrink-0 text-success" />}
                        {t.titulo}
                      </span>
                      {t.completadaEl && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Completada por {t.completadaPor} · {formatoFechaHora(t.completadaEl)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoTareaBadge estado={t.estado} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{nombreAgente(t.agenteId)}</td>
                    <td className="px-4 py-3">
                      <PrioridadBadge prioridad={t.prioridad} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatoFecha(t.enviadaEl)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{t.estimacionHoras} h</td>
                    <td className="px-4 py-3 whitespace-nowrap">{restante} h</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatoEuros(t.costeEstimado)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatoEuros(t.costeConsumido)}</td>
                    <td className="px-4 py-3 text-right">
                      {t.estado !== "completada" && (
                        <button
                          type="button"
                          onClick={() => {
                            nex.completarTarea(t.id);
                            toast.success("Tarea marcada como completada");
                          }}
                          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
                        >
                          Completar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {tareas.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Este proyecto todavía no tiene tareas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 border-t border-border bg-surface p-4 sm:grid-cols-3 xl:grid-cols-6">
          <Mini titulo="Total" valor={String(resumen.total)} />
          <Mini titulo="Completadas" valor={String(resumen.completadas)} />
          <Mini titulo="Pendientes" valor={String(resumen.pendientes)} />
          <Mini titulo="En ejecución" valor={String(resumen.ejecutando)} />
          <Mini titulo="Esfuerzo acumulado" valor={`${resumen.esfuerzoTotal} h`} />
          <Mini
            titulo="Previsión real"
            valor={formatoFecha(resumen.finPrevisto)}
            pie={`tarea más larga: ${resumen.cuelloBotella} h`}
          />
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="panel flex min-h-[26rem] flex-col p-4">
          <h2 className="font-display text-sm font-semibold">Chat del proyecto</h2>
          <div className="mt-3 flex-1 space-y-3 overflow-y-auto">
            {mensajes.map((m) => (
              <div
                key={m.id}
                className={
                  m.autor === "usuario"
                    ? "ml-auto max-w-[85%] rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "max-w-[85%] rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                }
              >
                {m.autor !== "usuario" && (
                  <p className="mb-1 text-xs text-muted-foreground">
                    {m.agenteId ? nombreAgente(m.agenteId) : "Sistema"}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{m.texto}</p>
                <p
                  className={
                    m.autor === "usuario"
                      ? "mt-1 text-[11px] text-primary-foreground/70"
                      : "mt-1 text-[11px] text-muted-foreground"
                  }
                >
                  {desde(m.fecha)}
                </p>
              </div>
            ))}
            {mensajes.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay mensajes.</p>}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!texto.trim()) return;
              nex.enviarMensaje(proyecto.id, texto.trim());
              setTexto("");
            }}
          >
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe un mensaje u orden…"
              className="flex-1 rounded-lg border border-input bg-surface px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              <Send className="size-4" /> Enviar
            </button>
          </form>
        </div>

        <aside className="space-y-4">
          <div className="panel p-4">
            <h2 className="font-display text-sm font-semibold">Línea temporal</h2>
            <ul className="mt-3 space-y-3">
              {actividad.map((a) => (
                <li key={a.id} className="border-l-2 border-border pl-3">
                  <p className="text-sm">{a.texto}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.tipo} · {desde(a.fecha)}
                  </p>
                </li>
              ))}
              {actividad.length === 0 && <li className="text-sm text-muted-foreground">Sin actividad todavía.</li>}
            </ul>
          </div>

          <div className="panel p-4">
            <h2 className="font-display text-sm font-semibold">Vistas previas y despliegues</h2>
            <ul className="mt-3 space-y-2">
              {previews.map((p) => (
                <li key={p.id}>
                  <a
                    href={p.url}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-primary/40"
                  >
                    <span>{p.titulo}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {p.entorno} <ExternalLink className="size-3" />
                    </span>
                  </a>
                </li>
              ))}
              {previews.length === 0 && <li className="text-sm text-muted-foreground">Sin vistas previas.</li>}
            </ul>
          </div>

          <div className="panel p-4">
            <h2 className="font-display text-sm font-semibold">Resumen automático</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {resumen.completadas} de {resumen.total} tareas completadas, {resumen.ejecutando} en marcha. Coste
              consumido {formatoEuros(resumen.costeConsumido)} sobre {formatoEuros(resumen.costeEstimado)} estimados.
            </p>
            <Progreso className="mt-3" valor={resumen.total ? (resumen.completadas / resumen.total) * 100 : 0} />
          </div>
        </aside>
      </section>
    </>
  );
}

function Dato({ titulo, valor, pie }: { titulo: string; valor: string; pie?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 font-display text-lg font-semibold">{valor}</p>
      {pie ? <p className="text-xs text-muted-foreground">{pie}</p> : null}
    </div>
  );
}

function Mini({ titulo, valor, pie }: { titulo: string; valor: string; pie?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="font-display text-base font-semibold">{valor}</p>
      {pie ? <p className="text-[11px] text-muted-foreground">{pie}</p> : null}
    </div>
  );
}
