import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { EstadoProyectoBadge, PrioridadBadge } from "@/components/nex/badges";
import { plantillaOrdenInicial } from "@/lib/nex/adapters";
import { formatoEuros, desde } from "@/lib/nex/labels";
import { useNex } from "@/lib/nex/store";

export const Route = createFileRoute("/proyectos/")({
  head: () => ({
    meta: [
      { title: "Proyectos · NexDeveloper" },
      { name: "description", content: "Listado de proyectos, búsqueda global y creación de proyecto con agente." },
      { property: "og:title", content: "Proyectos · NexDeveloper" },
      { property: "og:description", content: "Listado de proyectos y creación de proyecto con agente." },
    ],
  }),
  component: Proyectos,
});

function Proyectos() {
  const { proyectos, tareas, mensajes, crearProyecto } = useNex();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [objetivo, setObjetivo] = React.useState("");
  const [requisitos, setRequisitos] = React.useState("");
  const [tecnologias, setTecnologias] = React.useState("TypeScript, base de datos propia");
  const [repositorio, setRepositorio] = React.useState("");

  const q = busqueda.trim().toLowerCase();
  const resultados = q
    ? [
        ...proyectos
          .filter((p) => p.nombre.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q))
          .map((p) => ({ proyectoId: p.id, tipo: "Proyecto", texto: p.nombre })),
        ...tareas
          .filter((t) => t.titulo.toLowerCase().includes(q))
          .map((t) => ({ proyectoId: t.proyectoId, tipo: "Tarea", texto: t.titulo })),
        ...mensajes
          .filter((m) => m.texto.toLowerCase().includes(q))
          .map((m) => ({ proyectoId: m.proyectoId, tipo: "Mensaje", texto: m.texto })),
      ].slice(0, 12)
    : [];

  const orden = plantillaOrdenInicial({ nombre, objetivo, requisitos, tecnologias, repositorio });

  return (
    <>
      <Encabezado titulo="Proyectos" descripcion="Todo el trabajo vive dentro de un proyecto." />

      <div className="panel mb-6 p-4">
        <label className="text-xs text-muted-foreground" htmlFor="busqueda">
          Búsqueda global
        </label>
        <input
          id="busqueda"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en proyectos, tareas y mensajes…"
          className="mt-1 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm"
        />
        {resultados.length > 0 && (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
            {resultados.map((r, i) => (
              <li key={i}>
                <Link
                  to="/proyectos/$proyectoId"
                  params={{ proyectoId: r.proyectoId }}
                  className="flex items-center justify-between gap-3 bg-surface px-3 py-2 text-sm hover:bg-surface-2"
                >
                  <span className="truncate">{r.texto}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {r.tipo} · {proyectos.find((p) => p.id === r.proyectoId)?.nombre ?? "Sin clasificar"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="panel overflow-hidden">
          <table className="w-full min-w-[38rem] text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Proyecto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Prioridad</th>
                <th className="px-4 py-3 font-medium">Coste</th>
                <th className="px-4 py-3 font-medium">Actualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {proyectos.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2/60">
                  <td className="px-4 py-3">
                    <Link to="/proyectos/$proyectoId" params={{ proyectoId: p.id }} className="font-medium hover:text-primary">
                      {p.nombre}
                    </Link>
                    <p className="text-xs text-muted-foreground">{p.repositorio ?? "sin repositorio"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <EstadoProyectoBadge estado={p.estado} />
                  </td>
                  <td className="px-4 py-3">
                    <PrioridadBadge prioridad={p.prioridad} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatoEuros(p.consumido)} / {formatoEuros(p.presupuesto)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{desde(p.actualizadoEl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="panel p-4">
          <h2 className="font-display text-sm font-semibold">Crear proyecto con agente</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            No se crea ningún repositorio ni carpeta sin tu autorización expresa.
          </p>
          <div className="mt-4 space-y-3">
            <Campo etiqueta="Nombre" valor={nombre} onChange={setNombre} />
            <Campo etiqueta="Objetivo" valor={objetivo} onChange={setObjetivo} area />
            <Campo etiqueta="Requisitos" valor={requisitos} onChange={setRequisitos} area />
            <Campo etiqueta="Tecnologías" valor={tecnologias} onChange={setTecnologias} />
            <Campo etiqueta="Repositorio (opcional)" valor={repositorio} onChange={setRepositorio} />
          </div>

          <div className="mt-4 rounded-lg border border-border bg-surface p-3">
            <p className="text-xs font-medium text-muted-foreground">Orden inicial generada</p>
            <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap text-xs text-foreground/90">{orden}</pre>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!nombre.trim()}
              onClick={() => {
                const id = crearProyecto({ nombre: nombre.trim(), descripcion: objetivo.trim(), repositorio: repositorio.trim() || undefined });
                toast.success("Proyecto creado");
                navigate({ to: "/proyectos/$proyectoId", params: { proyectoId: id } });
              }}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              Crear proyecto
            </button>
            <button
              type="button"
              onClick={() =>
                toast.info("Claude aún no está conectado", {
                  description: "La orden queda registrada y lista para enviarse cuando conectes la integración.",
                })
              }
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-2"
            >
              Enviar a Claude
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}

function Campo({
  etiqueta,
  valor,
  onChange,
  area,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  area?: boolean;
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      {etiqueta}
      {area ? (
        <textarea
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground"
        />
      ) : (
        <input
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground"
        />
      )}
    </label>
  );
}
