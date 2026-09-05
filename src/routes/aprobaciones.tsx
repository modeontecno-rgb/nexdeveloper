import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { PrioridadBadge } from "@/components/nex/badges";
import { ETIQUETA_MODO, desde, formatoEuros, formatoFechaHora } from "@/lib/nex/labels";
import { useNex } from "@/lib/nex/store";

export const Route = createFileRoute("/aprobaciones")({
  head: () => ({
    meta: [
      { title: "Aprobaciones · NexDeveloper" },
      {
        name: "description",
        content: "Órdenes que esperan tu visto bueno antes de enviarse a los agentes, con coste, riesgo y motivo.",
      },
      { property: "og:title", content: "Aprobaciones · NexDeveloper" },
      { property: "og:description", content: "Revisa y aprueba las órdenes de mayor coste o riesgo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Aprobaciones,
});

function Aprobaciones() {
  const nex = useNex();
  const [comentarios, setComentarios] = React.useState<Record<string, string>>({});
  const pendientes = nex.aprobaciones.filter((a) => a.estado === "pendiente");
  const resueltas = nex.aprobaciones.filter((a) => a.estado !== "pendiente");
  const nombreProyecto = (id: string) => nex.proyectos.find((p) => p.id === id)?.nombre ?? "Sin clasificar";
  const nombreAgente = (id: string | null) => nex.agentes.find((a) => a.id === id)?.nombre ?? "Sin asignar";

  return (
    <>
      <Encabezado
        titulo="Aprobaciones"
        descripcion="Nada que supere tus límites se ejecuta sin que tú digas que sí."
      />

      {pendientes.length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">
          No hay órdenes esperando decisión. Cuando una orden supere el límite de coste, sea de prioridad crítica o
          tenga riesgo alto, aparecerá aquí antes de enviarse.
        </p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pendientes.map((a) => (
            <article key={a.id} className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {nombreProyecto(a.proyectoId)} · {desde(a.solicitadaEl)}
                </span>
                <PrioridadBadge prioridad={a.prioridad} />
              </div>
              <p className="mt-2 text-sm">{a.texto}</p>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <Fila termino="Coste estimado" valor={formatoEuros(a.costeEstimado)} />
                <Fila termino="Tiempo estimado" valor={`${a.estimacionHoras} h`} />
                <Fila termino="Riesgo" valor={a.riesgo} />
                <Fila termino="Calidad prevista" valor={`${a.calidadPrevista}/100`} />
                <Fila termino="Modo" valor={ETIQUETA_MODO[a.modo]} />
                <Fila
                  termino="Responsables"
                  valor={a.equipo.length > 1 ? a.equipo.map((id) => nombreAgente(id)).join(", ") : nombreAgente(a.agenteId)}
                />
              </dl>

              <p className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
                Motivo de la revisión: {a.motivo}
              </p>

              <input
                value={comentarios[a.id] ?? ""}
                onChange={(e) => setComentarios({ ...comentarios, [a.id]: e.target.value })}
                placeholder="Comentario para el registro (opcional)"
                className="mt-3 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    nex.resolverAprobacion(a.id, "aprobada", comentarios[a.id]);
                    toast.success("Orden aprobada y enviada a la cola");
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Aprobar y enviar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    nex.resolverAprobacion(a.id, "rechazada", comentarios[a.id]);
                    toast.info("Orden rechazada");
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
                >
                  Rechazar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {resueltas.length > 0 && (
        <section className="panel mt-6 overflow-x-auto">
          <h2 className="px-4 pt-4 font-display text-sm font-semibold">Historial de decisiones</h2>
          <table className="mt-3 w-full min-w-[48rem] text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Orden</th>
                <th className="px-4 py-3 font-medium">Proyecto</th>
                <th className="px-4 py-3 font-medium">Coste</th>
                <th className="px-4 py-3 font-medium">Decisión</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {resueltas.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-3">{a.texto.slice(0, 60)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{nombreProyecto(a.proyectoId)}</td>
                  <td className="px-4 py-3">{formatoEuros(a.costeEstimado)}</td>
                  <td className="px-4 py-3">
                    <span className={a.estado === "aprobada" ? "text-success" : "text-destructive"}>
                      {a.estado === "aprobada" ? "Aprobada" : "Rechazada"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {a.resueltaEl ? formatoFechaHora(a.resueltaEl) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

function Fila({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border pb-1">
      <dt className="text-muted-foreground">{termino}</dt>
      <dd className="text-right font-medium">{valor}</dd>
    </div>
  );
}
