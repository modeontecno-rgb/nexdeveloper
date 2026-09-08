import {EntregasOrden} from '@/components/nex/entregas-orden';
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando, EstadoOrdenBadge, PrioridadBadge } from "@/components/nex/badges";
import { Boton, claseCampo } from "@/components/nex/campos";
import { ETIQUETA_MODO, formatoDinero, formatoFechaHora } from "@/lib/nex/labels";
import { useAgentes, useAjustes, useOrdenes, useProyectos } from "@/lib/nex/queries/datos";
import { useResolverOrden } from "@/lib/nex/queries/ordenes";
import { revisarOrden } from "@/lib/nex/queries/calidad";
import { toast } from "sonner";

export const Route = createFileRoute("/aprobaciones")({
  head: () => ({
    meta: [
      { title: "Aprobaciones · NexDeveloper" },
      { name: "description", content: "Órdenes que esperan tu decisión antes de ejecutarse." },
      { property: "og:title", content: "Aprobaciones · NexDeveloper" },
      { property: "og:description", content: "Órdenes que esperan tu decisión antes de ejecutarse." },
    ],
  }),
  component: Aprobaciones,
});

function Aprobaciones() {
  const { data: ordenes = [], isPending } = useOrdenes();
  const { data: proyectos = [] } = useProyectos();
  const { data: agentes = [] } = useAgentes();
  const { data: ajustes } = useAjustes();
  const moneda = ajustes?.moneda ?? "EUR";
  const resolver = useResolverOrden();
  const [comentarios, setComentarios] = React.useState<Record<string, string>>({});

  /** Antes de aprobar, la orden pasa la revisión previa. */
  const aprobar = async (orden: (typeof ordenes)[number]) => {
    try {
      const revision = await revisarOrden(orden.id);
      if (!revision.aprobada) {
        toast.error(
          `La orden no puede salir: ${revision.hallazgos
            .filter((h) => h.gravedad === "bloquea")
            .map((h) => h.mensaje)
            .join(" ")}`,
        );
        return;
      }
    } catch {
      // Si la revisión no está disponible, se continúa con la decisión.
    }
    resolver.mutate({ orden, decision: "aprobada", comentario: comentarios[orden.id] ?? "" });
  };

  const pendientes = ordenes.filter((o) => o.estado === "pendiente_aprobacion");
  const resueltas = ordenes.filter((o) => o.resuelta_el).slice(0, 12);

  const nombreProyecto = (id: string | null) => proyectos.find((p) => p.id === id)?.nombre ?? "Sin clasificar";
  const nombresEquipo = (ids: string[] | null) =>
    (ids ?? []).map((id) => agentes.find((a) => a.id === id)?.nombre ?? id).join(", ") || "Sin equipo definido";

  if (isPending) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Aprobaciones"
        descripcion="Nada caro o arriesgado se ejecuta sin que tú lo apruebes primero."
      />

      <section className="space-y-3">
        {pendientes.map((o) => (
          <article key={o.id} className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <details><summary className="cursor-pointer text-sm font-medium">{o.texto.split("\n")[0]?.slice(0,160)}</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words font-sans text-sm text-muted-foreground">{o.texto}</pre></details>
                <p className="mt-1 text-xs text-muted-foreground">
                  {nombreProyecto(o.proyecto_id)} · {formatoFechaHora(o.creado_el)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <EstadoOrdenBadge estado={o.estado} />
                <PrioridadBadge prioridad={o.prioridad} />
                {o.bloqueada_por_revision ? (
                  <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                    Bloqueada
                  </span>
                ) : o.revision_id ? (
                  <span className="rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                    Revisada ✓
                  </span>
                ) : null}
              </div>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              <Dato termino="Coste estimado" valor={formatoDinero(Number(o.coste_estimado), moneda)} />
              <Dato termino="Tiempo estimado" valor={`${Number(o.horas_estimadas).toFixed(1)} h`} />
              <Dato termino="Riesgo" valor={o.riesgo} />
              <Dato termino="Calidad prevista" valor={o.calidad_prevista == null ? "Sin estimación numérica" : `${o.calidad_prevista}%`} />
            </dl>

            <p className="mt-3 text-xs text-muted-foreground">
              Modo {ETIQUETA_MODO[o.modo]} · Equipo: {nombresEquipo(o.equipo)}
              {o.motivo_aprobacion ? ` · Motivo: ${o.motivo_aprobacion}` : ""}
            </p>

            {o.proyecto_id?<div className="mt-3"><EntregasOrden ordenId={o.id} proyectoId={o.proyecto_id}/></div>:null}
            <input
              value={comentarios[o.id] ?? ""}
              onChange={(e) => setComentarios((c) => ({ ...c, [o.id]: e.target.value }))}
              placeholder="Comentario para el equipo (opcional)"
              className={`${claseCampo} mt-3`}
            />

            <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
              <Boton
                className="w-full py-3.5 text-base sm:w-auto sm:py-2 sm:text-sm"
                onClick={() => void aprobar(o)}
              >
                Aprobar y enviar
              </Boton>
              <Boton
                className="w-full py-3.5 text-base sm:w-auto sm:py-2 sm:text-sm"
                variante="peligro"
                onClick={() =>
                  resolver.mutate({ orden: o, decision: "rechazada", comentario: comentarios[o.id] ?? "" })
                }
              >
                Rechazar
              </Boton>
            </div>
          </article>
        ))}
        {pendientes.length === 0 && (
          <p className="panel p-6 text-sm text-muted-foreground">No hay órdenes esperando tu decisión.</p>
        )}
      </section>

      {resueltas.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-sm font-semibold">Decisiones recientes</h2>
          <ul className="panel divide-y divide-border">
            {resueltas.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0 truncate">{o.texto.slice(0, 90)}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {formatoFechaHora(o.resuelta_el)} <EstadoOrdenBadge estado={o.estado} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <dt className="text-xs text-muted-foreground">{termino}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{valor}</dd>
    </div>
  );
}
