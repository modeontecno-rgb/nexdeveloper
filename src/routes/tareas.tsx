import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Ban, Inbox, Link2, PauseCircle, PlayCircle } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando, EstadoOrdenBadge, EstadoTareaBadge, PrioridadBadge, Progreso } from "@/components/nex/badges";
import { Boton, Selector, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import { TareasEnBloques } from "@/components/nex/tareas-bloques";
import type { EstadoTarea, TareaRow } from "@/lib/nex/db-types";
import { ETIQUETA_ESTADO_TAREA, desde, formatoDinero, formatoFecha, formatoFechaHora } from "@/lib/nex/labels";
import { useCancelarTarea, usePausarTarea, useReanudarTarea } from "@/lib/nex/queries/proyectian";
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
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  tarea: z.string().optional(),
  proyecto: z.string().optional(),
  mesa: z.string().optional(),
});

export const Route = createFileRoute("/tareas")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Tareas · NexDeveloper" },
      { name: "description", content: "Todas las tareas y órdenes en curso, ordenadas por prioridad." },
      { property: "og:title", content: "Tareas · NexDeveloper" },
      { property: "og:description", content: "Todas las tareas y órdenes en curso, ordenadas por prioridad." },
    ],
  }),
  component: Tareas,
});

const PESO = { critica: 0, alta: 1, media: 2, baja: 3 } as const;

function Tareas() {
  const { tarea: tareaIdFiltro, proyecto: proyectoFiltro, mesa: mesaFiltro } = Route.useSearch();
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

  const tareasDeMesa = mesaFiltro
    ? tareas.filter((t) => t.descripcion?.includes(`Mesa: ${mesaFiltro}`))
    : [];
  const visibles = tareas
    .filter((t) => !proyectoFiltro || t.proyecto_id === proyectoFiltro)
    .filter((t) => !mesaFiltro || t.descripcion?.includes(`Mesa: ${mesaFiltro}`))
    .filter((t) => (estado === "activas" ? t.estado !== "completada" && t.estado !== "cancelada" : t.estado === estado))
    .sort((a, b) => PESO[a.prioridad] - PESO[b.prioridad]);

  const sinClasificar = ordenes.filter((o) => !o.proyecto_id || o.pendiente_confirmar_proyecto);

  return (
    <>
      <Encabezado
        titulo="Tareas"
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

      {tareaIdFiltro || mesaFiltro ? (
        <section className="mb-6 border-l-2 border-primary bg-primary/5 px-4 py-3">
          <p className="font-display text-sm font-semibold">
            {mesaFiltro
              ? `${tareasDeMesa.length} tarea${tareasDeMesa.length === 1 ? "" : "s"} creada${tareasDeMesa.length === 1 ? "" : "s"} por la Mesa`
              : "Tarea abierta desde un aviso"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {mesaFiltro
              ? "Esta vista muestra solo el plan creado por esa Mesa."
              : "La tarea está resaltada debajo para que puedas localizarla."}
          </p>
          {(proyectoFiltro || tareasDeMesa[0]?.proyecto_id) ? (
            <Link
              to="/proyectos/$proyectoId"
              params={{ proyectoId: proyectoFiltro ?? tareasDeMesa[0]?.proyecto_id ?? "" }}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              Ver el plan completo del proyecto <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </section>
      ) : null}

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
            <article
              key={t.id}
              id={`tarea-${t.id}`}
              className={cn(
                "panel p-4 transition-all duration-500",
                t.id === tareaIdFiltro ? "scroll-mt-24 border-primary bg-primary/5 ring-2 ring-primary" : "",
              )}
              ref={(elemento) => {
                if (elemento && t.id === tareaIdFiltro) {
                  window.requestAnimationFrame(() => elemento.scrollIntoView({ behavior: "smooth", block: "center" }));
                }
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{t.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {nombreProyecto(t.proyecto_id)} · {nombreAgente(t.agente_id)} · {desde(t.ultima_actividad)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <InsigniasProyectian tarea={t} />
                  <EstadoTareaBadge estado={t.estado} />
                  <PrioridadBadge prioridad={t.prioridad} />
                </div>
              </div>
              <Progreso className="mt-3" valor={Number(t.progreso)} />
              <EstadoPausaCancelacion tarea={t} />
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
              <AccionesEstadoTarea tarea={t} />
            </article>
          ))}
          {visibles.length === 0 && <p className="panel p-6 text-sm text-muted-foreground">No hay tareas aquí.</p>}
        </div>
      )}
    </>
  );
}

/* ------------------- Pausas, cancelaciones y origen de la tarea ----------- */

/** Insignias de dónde viene la tarea y si está enlazada con Proyectian. */
export function InsigniasProyectian({ tarea }: { tarea: TareaRow }) {
  return (
    <>
      {tarea.origen === "proyectian" ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-info/30 bg-info/10 px-2.5 py-0.5 text-xs font-medium text-info">
          Proyectian
        </span>
      ) : null}
      {tarea.proyectian_pendiente_id ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          title={
            tarea.sincronizado_el
              ? `Sincronizada con Proyectian · ${formatoFechaHora(tarea.sincronizado_el)}`
              : "Sincronizada con Proyectian"
          }
        >
          <Link2 className="size-3.5" /> Sincronizada
        </span>
      ) : null}
    </>
  );
}

/** Aviso visible cuando la tarea está pausada o cancelada. */
export function EstadoPausaCancelacion({ tarea }: { tarea: TareaRow }) {
  if (tarea.estado === "pausada") {
    return (
      <p className="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
        <PauseCircle className="mr-1 inline size-3.5" /> Pausada
        {tarea.pausada_hasta ? ` hasta ${formatoFecha(tarea.pausada_hasta)}` : ""}
        {tarea.motivo_estado ? ` · ${tarea.motivo_estado}` : ""}
      </p>
    );
  }
  if (tarea.estado === "cancelada") {
    return (
      <p className="mt-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        <Ban className="mr-1 inline size-3.5" /> Cancelada
        {tarea.cancelada_el ? ` el ${formatoFecha(tarea.cancelada_el)}` : ""}
        {tarea.motivo_estado ? ` · ${tarea.motivo_estado}` : ""}
      </p>
    );
  }
  return null;
}

/** Botones para pausar, cancelar o reanudar una tarea. */
export function AccionesEstadoTarea({ tarea }: { tarea: TareaRow }) {
  const pausar = usePausarTarea();
  const cancelar = useCancelarTarea();
  const reanudar = useReanudarTarea();
  const [dialogo, setDialogo] = React.useState<"pausar" | "cancelar" | null>(null);
  const [hasta, setHasta] = React.useState("");
  const [motivo, setMotivo] = React.useState("");

  const cerrar = () => {
    setDialogo(null);
    setHasta("");
    setMotivo("");
  };

  const parada = tarea.estado === "pausada" || tarea.estado === "cancelada";

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {parada ? (
        <Boton variante="suave" className="px-2.5 py-1 text-xs" onClick={() => reanudar.mutate({ id: tarea.id })}>
          <PlayCircle className="size-3.5" /> Reanudar
        </Boton>
      ) : (
        <>
          <Boton variante="suave" className="px-2.5 py-1 text-xs" onClick={() => setDialogo("pausar")}>
            <PauseCircle className="size-3.5" /> Pausar
          </Boton>
          <Boton variante="peligro" className="px-2.5 py-1 text-xs" onClick={() => setDialogo("cancelar")}>
            <Ban className="size-3.5" /> Cancelar
          </Boton>
        </>
      )}

      <Dialogo
        abierto={dialogo === "pausar"}
        titulo="Pausar la tarea"
        descripcion="Indica hasta cuándo queda parada y por qué."
        onCerrar={cerrar}
        ancho="max-w-md"
      >
        <div className="space-y-3">
          <label className="block text-xs text-muted-foreground">
            Pausada hasta
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={`${claseCampo} mt-1`} />
          </label>
          <label className="block text-xs text-muted-foreground">
            Motivo
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className={`${claseCampo} mt-1`}
              placeholder="Por ejemplo: esperando respuesta del cliente."
            />
          </label>
          <div className="flex justify-end gap-2">
            <Boton variante="suave" onClick={cerrar}>
              Volver
            </Boton>
            <Boton
              onClick={() => {
                pausar.mutate({ id: tarea.id, hasta, motivo });
                cerrar();
              }}
            >
              Pausar
            </Boton>
          </div>
        </div>
      </Dialogo>

      <Dialogo
        abierto={dialogo === "cancelar"}
        titulo="Cancelar la tarea"
        descripcion="Quedará registrada la fecha y el motivo."
        onCerrar={cerrar}
        ancho="max-w-md"
      >
        <div className="space-y-3">
          <label className="block text-xs text-muted-foreground">
            Motivo
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className={`${claseCampo} mt-1`}
              placeholder="Por ejemplo: el cliente ha descartado esta funcionalidad."
            />
          </label>
          <div className="flex justify-end gap-2">
            <Boton variante="suave" onClick={cerrar}>
              Volver
            </Boton>
            <Boton
              variante="peligro"
              onClick={() => {
                cancelar.mutate({ id: tarea.id, motivo });
                cerrar();
              }}
            >
              Cancelar la tarea
            </Boton>
          </div>
        </div>
      </Dialogo>
    </div>
  );
}
