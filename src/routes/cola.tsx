import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { EstadoTareaBadge, PrioridadBadge, Progreso } from "@/components/nex/badges";
import { desde, formatoEuros } from "@/lib/nex/labels";
import { useNex } from "@/lib/nex/store";
import type { Prioridad } from "@/lib/nex/types";

export const Route = createFileRoute("/cola")({
  head: () => ({
    meta: [
      { title: "Cola de trabajo · NexDeveloper" },
      { name: "description", content: "Todas las tareas activas de todos los proyectos, con control de prioridad." },
      { property: "og:title", content: "Cola de trabajo · NexDeveloper" },
      { property: "og:description", content: "Tareas activas de todos los proyectos y carga de cada agente." },
    ],
  }),
  component: Cola,
});

function Cola() {
  const nex = useNex();
  const activas = nex.tareas.filter((t) => t.estado !== "completada");
  const nombreProyecto = (id: string) => nex.proyectos.find((p) => p.id === id)?.nombre ?? "Sin clasificar";

  return (
    <>
      <Encabezado titulo="Cola de trabajo" descripcion="Qué se está haciendo ahora mismo y quién lo está haciendo." />

      <section className="panel mb-6 p-4">
        <h2 className="font-display text-sm font-semibold">Carga de agentes</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {nex.agentes.map((a) => (
            <div key={a.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between text-sm">
                <span>{a.nombre}</span>
                <span className="text-xs text-muted-foreground">
                  {a.tareasActivas}/{a.capacidad} tareas
                </span>
              </div>
              <Progreso className="mt-2" valor={(a.tareasActivas / a.capacidad) * 100} />
            </div>
          ))}
        </div>
      </section>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[62rem] text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Tarea</th>
              <th className="px-4 py-3 font-medium">Proyecto</th>
              <th className="px-4 py-3 font-medium">Responsable</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Progreso</th>
              <th className="px-4 py-3 font-medium">Última actividad</th>
              <th className="px-4 py-3 font-medium">Coste</th>
              <th className="px-4 py-3 font-medium">Prioridad</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {activas.map((t) => (
              <tr key={t.id} className="hover:bg-surface-2/60">
                <td className="px-4 py-3">{t.titulo}</td>
                <td className="px-4 py-3">
                  <Link to="/proyectos/$proyectoId" params={{ proyectoId: t.proyectoId }} className="hover:text-primary">
                    {nombreProyecto(t.proyectoId)}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {nex.agentes.find((a) => a.id === t.agenteId)?.nombre ?? "Sin asignar"}
                </td>
                <td className="px-4 py-3">
                  <EstadoTareaBadge estado={t.estado} />
                </td>
                <td className="px-4 py-3 w-32">
                  <Progreso valor={t.progreso} />
                  <span className="text-xs text-muted-foreground">{t.progreso}%</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{desde(t.ultimaActividad)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatoEuros(t.costeConsumido)} / {formatoEuros(t.costeEstimado)}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={t.prioridad}
                    onChange={(e) => nex.cambiarPrioridadTarea(t.id, e.target.value as Prioridad)}
                    className="rounded-md border border-input bg-surface px-2 py-1 text-xs"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Accion texto="Pausar" onClick={() => { nex.cambiarEstadoTarea(t.id, "pendiente"); toast.info("Tarea pausada"); }} />
                    <Accion texto="Revisar" onClick={() => { nex.cambiarEstadoTarea(t.id, "esperando_revision"); toast.info("Enviada a revisión"); }} />
                    <Accion texto="Cancelar" onClick={() => { nex.cambiarEstadoTarea(t.id, "bloqueada"); toast.warning("Tarea cancelada y bloqueada"); }} />
                  </div>
                </td>
              </tr>
            ))}
            {activas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                  No hay tareas activas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        <PrioridadBadge prioridad="critica" /> Las tareas críticas se atienden antes que el resto de la cola.
      </p>
    </>
  );
}

function Accion({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
    >
      {texto}
    </button>
  );
}
