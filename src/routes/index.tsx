import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CircleDot } from "lucide-react";
import * as React from "react";

import { Encabezado } from "@/components/nex/app-shell";
import { EstadoProyectoBadge, PrioridadBadge, Progreso } from "@/components/nex/badges";
import { ETIQUETA_ESTADO_PROYECTO, ETIQUETA_PRIORIDAD, formatoEuros, desde } from "@/lib/nex/labels";
import { useNex } from "@/lib/nex/store";
import type { EstadoProyecto, Prioridad } from "@/lib/nex/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inicio · NexDeveloper" },
      {
        name: "description",
        content: "Resumen de todos tus proyectos de IA: estado, prioridad, alertas, coste y agentes.",
      },
      { property: "og:title", content: "Inicio · NexDeveloper" },
      {
        property: "og:description",
        content: "Resumen de todos tus proyectos de IA: estado, prioridad, alertas, coste y agentes.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { proyectos, tareas, agentes, alertas } = useNex();
  const [estado, setEstado] = React.useState<EstadoProyecto | "todos">("todos");
  const [prioridad, setPrioridad] = React.useState<Prioridad | "todas">("todas");
  const [agente, setAgente] = React.useState<string>("todos");
  const [costeMin, setCosteMin] = React.useState(0);

  const filtrados = proyectos.filter(
    (p) =>
      (estado === "todos" || p.estado === estado) &&
      (prioridad === "todas" || p.prioridad === prioridad) &&
      (agente === "todos" || p.agentes.includes(agente)) &&
      p.consumido >= costeMin,
  );

  const totalPresupuesto = proyectos.reduce((s, p) => s + p.presupuesto, 0);
  const totalConsumido = proyectos.reduce((s, p) => s + p.consumido, 0);
  const activas = tareas.filter((t) => t.estado === "ejecutando").length;

  return (
    <>
      <Encabezado
        titulo="Inicio"
        descripcion="Todo lo que está pasando en tus proyectos, en una sola pantalla."
        acciones={
          <Link
            to="/nueva-orden"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Nueva orden <ArrowRight className="size-4" />
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica titulo="Proyectos" valor={String(proyectos.length)} pie={`${filtrados.length} visibles`} />
        <Metrica titulo="Tareas en ejecución" valor={String(activas)} pie={`${tareas.length} tareas en total`} />
        <Metrica titulo="Presupuesto" valor={formatoEuros(totalPresupuesto)} pie="Suma de todos los proyectos" />
        <Metrica
          titulo="Consumido"
          valor={formatoEuros(totalConsumido)}
          pie={`${Math.round((totalConsumido / Math.max(1, totalPresupuesto)) * 100)}% del presupuesto`}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div>
          <div className="panel mb-4 flex flex-wrap items-center gap-3 p-4">
            <Selector
              etiqueta="Estado"
              valor={estado}
              onChange={(v) => setEstado(v as EstadoProyecto | "todos")}
              opciones={[
                { valor: "todos", texto: "Todos" },
                ...Object.entries(ETIQUETA_ESTADO_PROYECTO).map(([valor, texto]) => ({ valor, texto })),
              ]}
            />
            <Selector
              etiqueta="Prioridad"
              valor={prioridad}
              onChange={(v) => setPrioridad(v as Prioridad | "todas")}
              opciones={[
                { valor: "todas", texto: "Todas" },
                ...Object.entries(ETIQUETA_PRIORIDAD).map(([valor, texto]) => ({ valor, texto })),
              ]}
            />
            <Selector
              etiqueta="Agente"
              valor={agente}
              onChange={setAgente}
              opciones={[
                { valor: "todos", texto: "Todos" },
                ...agentes.map((a) => ({ valor: a.id, texto: a.nombre })),
              ]}
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Coste mínimo
              <input
                type="number"
                min={0}
                step={50}
                value={costeMin}
                onChange={(e) => setCosteMin(Number(e.target.value) || 0)}
                className="w-24 rounded-md border border-input bg-surface px-2 py-1.5 text-sm text-foreground"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {filtrados.map((p) => {
              const tareasP = tareas.filter((t) => t.proyectoId === p.id);
              const completadas = tareasP.filter((t) => t.estado === "completada").length;
              return (
                <Link
                  key={p.id}
                  to="/proyectos/$proyectoId"
                  params={{ proyectoId: p.id }}
                  className="panel block p-4 transition hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-base font-semibold">{p.nombre}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.descripcion}</p>
                    </div>
                    <PrioridadBadge prioridad={p.prioridad} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <EstadoProyectoBadge estado={p.estado} />
                    <span className="text-xs text-muted-foreground">actualizado {desde(p.actualizadoEl)}</span>
                  </div>
                  <div className="mt-4">
                    <Progreso valor={tareasP.length ? (completadas / tareasP.length) * 100 : 0} />
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      <span>
                        {completadas}/{tareasP.length} tareas
                      </span>
                      <span>
                        {formatoEuros(p.consumido)} / {formatoEuros(p.presupuesto)}
                      </span>
                    </div>
                  </div>
                  {p.alertas.length > 0 && (
                    <p className="mt-3 flex items-start gap-2 text-xs text-warning">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      {p.alertas[0]}
                    </p>
                  )}
                </Link>
              );
            })}
            {filtrados.length === 0 && (
              <p className="panel p-6 text-sm text-muted-foreground">Ningún proyecto cumple estos filtros.</p>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="panel p-4">
            <h2 className="font-display text-sm font-semibold">Alertas y decisiones</h2>
            <ul className="mt-3 space-y-3">
              {alertas.map((a) => (
                <li key={a.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
                  <p className="text-foreground">{a.texto}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.requiereDecision ? "Requiere tu decisión" : "Informativo"}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-4">
            <h2 className="font-display text-sm font-semibold">Capacidad de agentes</h2>
            <ul className="mt-3 space-y-3">
              {agentes.map((a) => (
                <li key={a.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <CircleDot
                        className={
                          a.tareasActivas >= a.capacidad ? "size-3.5 text-destructive" : "size-3.5 text-success"
                        }
                      />
                      {a.nombre}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.tareasActivas}/{a.capacidad}
                    </span>
                  </div>
                  <Progreso className="mt-1.5" valor={(a.tareasActivas / a.capacidad) * 100} />
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </>
  );
}

function Metrica({ titulo, valor, pie }: { titulo: string; valor: string; pie: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{valor}</p>
      <p className="mt-1 text-xs text-muted-foreground">{pie}</p>
    </div>
  );
}

export function Selector({
  etiqueta,
  valor,
  onChange,
  opciones,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  opciones: { valor: string; texto: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {etiqueta}
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm text-foreground"
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}
