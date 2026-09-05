import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import * as React from "react";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando, EstadoOrdenBadge, EstadoTareaBadge, PrioridadBadge, Progreso } from "@/components/nex/badges";
import { Boton, Selector } from "@/components/nex/campos";
import { TareasEnBloques } from "@/components/nex/tareas-bloques";
import type { EstadoTarea } from "@/lib/nex/db-types";
import { ETIQUETA_ESTADO_TAREA, desde, formatoDinero } from "@/lib/nex/labels";
import {
  useAgentes,
  useAjustes,
  useOrdenes,
  useProyectos,
  useTareas,
  useTareasAtencion,
} from "@/lib/nex/queries/datos";
import { useMoverTarea } from "@/lib/nex/queries/mutaciones";
import { useCancelarOrden, useMoverOrden } from "@/lib/nex/queries/ordenes";

export const Route = createFileRoute("/cola")({
  head: () => ({
    meta: [
      { title: "Cola de trabajo · NexDeveloper" },
      { name: "description", content: "Todas las tareas y órdenes en curso, ordenadas por prioridad." },
      { property: "og:title", content: "Cola de trabajo · NexDeveloper" },
      { property: "og:description", content: "Todas las tareas y órdenes en curso, ordenadas por prioridad." },
    ],
  }),
  component: Cola,
});

const PESO = { critica: 0, alta: 1, media: 2, baja: 3 } as const;

function Cola() {
  const { data: tareas = [], isPending } = useTareas();
  const { data: proyectos = [] } = useProyectos();
  const { data: agentes = [] } = useAgentes();
  const { data: ordenes = [] } = useOrdenes();
  const { data: tareasAtencion = [] } = useTareasAtencion();
  const { data: ajustes } = useAjustes();
  const moneda = ajustes?.moneda ?? "EUR";
  const mover = useMoverTarea();
  const moverOrden = useMoverOrden();
  const cancelar = useCancelarOrden();

  const [estado, setEstado] = React.useState<EstadoTarea | "activas">("activas");

  const nombreProyecto = (id: string | null) => proyectos.find((p) => p.id === id)?.nombre ?? "Sin clasificar";
  const nombreAgente = (id: string | null) => agentes.find((a) => a.id === id)?.nombre ?? "Sin asignar";

  const visibles = tareas
    .filter((t) => (estado === "activas" ? t.estado !== "completada" && t.estado !== "cancelada" : t.estado === estado))
    .sort((a, b) => PESO[a.prioridad] - PESO[b.prioridad]);

  const sinClasificar = ordenes.filter((o) => !o.proyecto_id || o.pendiente_confirmar_proyecto);

  return (
    <>
      <Encabezado
        titulo="Cola de trabajo"
        descripcion="Qué se está haciendo ahora mismo en todos los proyectos."
        acciones={
          <Selector
            etiqueta="Ver"
            valor={estado}
            onChange={(v) => setEstado(v as EstadoTarea | "activas")}
            opciones={[
              { valor: "activas", texto: "Activas" },
              ...Object.entries(ETIQUETA_ESTADO_TAREA).map(([valor, texto]) => ({ valor, texto })),
            ]}
          />
        }
      />

      {sinClasificar.length > 0 ? (
        <section className="panel mb-6 p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Inbox className="size-4 text-warning" /> Sin clasificar
          </h2>
          <ul className="mt-3 space-y-2">
            {sinClasificar.map((o) => (
              <li key={o.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-foreground">{o.texto.slice(0, 120)}</p>
                  <EstadoOrdenBadge estado={o.estado} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Selector
                    etiqueta="Asignar a"
                    valor={o.proyecto_id ?? ""}
                    onChange={(v) => moverOrden.mutate({ orden: o, proyectoId: v || null })}
                    opciones={[
                      { valor: "", texto: "Sin clasificar" },
                      ...proyectos.map((p) => ({ valor: p.id, texto: p.nombre })),
                    ]}
                  />
                  <Boton variante="peligro" onClick={() => cancelar.mutate(o.id)} className="px-2.5 py-1 text-xs">
                    Cancelar orden
                  </Boton>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mb-6">
        <TareasEnBloques tareas={tareasAtencion} mostrarProyecto />
      </div>

      {isPending ? (
        <Cargando />
      ) : (
        <div className="space-y-3">
          {visibles.map((t) => (
            <article key={t.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{t.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {nombreProyecto(t.proyecto_id)} · {nombreAgente(t.agente_id)} · {desde(t.ultima_actividad)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <EstadoTareaBadge estado={t.estado} />
                  <PrioridadBadge prioridad={t.prioridad} />
                </div>
              </div>
              <Progreso className="mt-3" valor={Number(t.progreso)} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {Number(t.horas_consumidas).toFixed(1)} / {Number(t.estimacion_horas).toFixed(1)} h ·{" "}
                  {formatoDinero(Number(t.coste_consumido), moneda)} de {formatoDinero(Number(t.coste_estimado), moneda)}
                </span>
                <Selector
                  etiqueta="Mover a"
                  valor={t.proyecto_id}
                  onChange={(v) =>
                    mover.mutate({ id: t.id, proyectoId: v, origenId: t.proyecto_id, titulo: t.titulo })
                  }
                  opciones={proyectos.map((p) => ({ valor: p.id, texto: p.nombre }))}
                />
              </div>
            </article>
          ))}
          {visibles.length === 0 && <p className="panel p-6 text-sm text-muted-foreground">No hay tareas aquí.</p>}
        </div>
      )}
    </>
  );
}
