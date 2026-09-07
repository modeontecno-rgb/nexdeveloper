import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Inbox, Plus, Search } from "lucide-react";
import * as React from "react";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando, EstadoProyectoBadge, PrioridadBadge, Progreso } from "@/components/nex/badges";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { PuntoSalud } from "@/routes/salud";
import { desde, formatoDinero } from "@/lib/nex/labels";
import { useAjustes, useChats, useOrdenes, useProyectos, useResumenProyectos } from "@/lib/nex/queries/datos";
import { useCrearProyecto } from "@/lib/nex/queries/mutaciones";

export const Route = createFileRoute("/proyectos/")({
  head: () => ({
    meta: [
      { title: "Proyectos · NexDeveloper" },
      { name: "description", content: "Todos tus proyectos de IA con su estado, avance y coste." },
      { property: "og:title", content: "Proyectos · NexDeveloper" },
      { property: "og:description", content: "Todos tus proyectos de IA con su estado, avance y coste." },
    ],
  }),
  component: Proyectos,
});

function Proyectos() {
  const { data: proyectos = [], isPending } = useProyectos();
  const { data: resumenes = [] } = useResumenProyectos();
  const { data: chats = [] } = useChats();
  const { data: ordenes = [] } = useOrdenes();
  const { data: ajustes } = useAjustes();
  const moneda = ajustes?.moneda ?? "EUR";
  const crear = useCrearProyecto();
  const navegar = useNavigate();

  const [busqueda, setBusqueda] = React.useState("");
  const [formulario, setFormulario] = React.useState(false);
  const [nombre, setNombre] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [repositorio, setRepositorio] = React.useState("");

  const porProyecto = new Map(resumenes.map((r) => [r.proyecto_id, r]));
  const sinClasificar =
    chats.filter((c) => !c.proyecto_id).length + ordenes.filter((o) => !o.proyecto_id).length;

  const filtrados = proyectos.filter((p) =>
    `${p.nombre} ${p.descripcion ?? ""}`.toLowerCase().includes(busqueda.toLowerCase()),
  );

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const proyecto = await crear.mutateAsync({ nombre, descripcion, repositorio: repositorio || undefined });
    setFormulario(false);
    setNombre("");
    setDescripcion("");
    setRepositorio("");
    void navegar({ to: "/proyectos/$proyectoId", params: { proyectoId: proyecto.id } });
  };

  return (
    <>
      <Encabezado
        titulo="Proyectos"
        descripcion="Cada proyecto guarda su chat, su plan de trabajo y su presupuesto."
        acciones={
          <Boton onClick={() => setFormulario((v) => !v)}>
            <Plus className="size-4" /> Nuevo proyecto
          </Boton>
        }
      />

      {formulario ? (
        <form onSubmit={enviar} className="panel mb-6 grid gap-4 p-5 md:grid-cols-2">
          <Campo etiqueta="Nombre del proyecto">
            <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Repositorio (opcional)" pista="Por ejemplo: usuario/mi-repositorio">
            <input value={repositorio} onChange={(e) => setRepositorio(e.target.value)} className={claseCampo} />
          </Campo>
          <div className="md:col-span-2">
            <Campo etiqueta="Descripción">
              <textarea
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className={claseCampo}
              />
            </Campo>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Boton type="submit" disabled={crear.isPending}>
              Crear proyecto
            </Boton>
            <Boton type="button" variante="suave" onClick={() => setFormulario(false)}>
              Cancelar
            </Boton>
          </div>
        </form>
      ) : null}

      <div className="panel mb-4 flex items-center gap-2 px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar proyecto"
          className="w-full bg-transparent py-1 text-sm text-foreground outline-none"
        />
      </div>

      {sinClasificar > 0 ? (
        <Link
          to="/tareas"
          className="panel mb-4 flex items-center gap-3 p-4 text-sm transition hover:border-primary/40"
        >
          <Inbox className="size-4 text-warning" />
          <span>
            <strong className="font-medium">Sin clasificar:</strong> {sinClasificar} elemento(s) sin proyecto
            asignado. Revísalos en la cola.
          </span>
        </Link>
      ) : null}

      {isPending ? (
        <Cargando />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((p) => {
            const r = porProyecto.get(p.id);
            const completadas = Number(r?.completadas ?? 0);
            const total = Number(r?.total_tareas ?? 0);
            return (
              <Link
                key={p.id}
                to="/proyectos/$proyectoId"
                params={{ proyectoId: p.id }}
                className="panel block p-4 transition hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                    <PuntoSalud semaforo={p.semaforo_salud ?? "gris"} />
                    {p.nombre}
                  </h2>
                  <PrioridadBadge prioridad={p.prioridad} />
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.descripcion}</p>
                <div className="mt-3 flex items-center gap-2">
                  <EstadoProyectoBadge estado={p.estado} />
                  <span className="text-xs text-muted-foreground">{desde(p.actualizado_el)}</span>
                </div>
                <Progreso className="mt-4" valor={total ? (completadas / total) * 100 : 0} />
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {completadas}/{total} tareas
                  </span>
                  <span>{formatoDinero(Number(r?.coste_consumido ?? 0), moneda)}</span>
                </div>
              </Link>
            );
          })}
          {filtrados.length === 0 && (
            <p className="panel p-6 text-sm text-muted-foreground">No hay proyectos con ese nombre.</p>
          )}
        </div>
      )}
    </>
  );
}
