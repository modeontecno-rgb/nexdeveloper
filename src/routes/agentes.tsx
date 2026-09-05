import { createFileRoute } from "@tanstack/react-router";
import { Cpu } from "lucide-react";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando, Progreso } from "@/components/nex/badges";
import { useAgentes, useCargaAgentes } from "@/lib/nex/queries/datos";

export const Route = createFileRoute("/agentes")({
  head: () => ({
    meta: [
      { title: "Agentes · NexDeveloper" },
      { name: "description", content: "Catálogo de agentes: especialidades, coste, calidad y disponibilidad." },
      { property: "og:title", content: "Agentes · NexDeveloper" },
      { property: "og:description", content: "Catálogo de agentes: especialidades, coste, calidad y disponibilidad." },
    ],
  }),
  component: Agentes,
});

const ETIQUETA_DISPONIBILIDAD = {
  disponible: "Disponible",
  ocupado: "Ocupado",
  sin_configurar: "Sin configurar",
} as const;

function Agentes() {
  const { data: agentes = [], isPending } = useAgentes();
  const { data: carga = [] } = useCargaAgentes();
  const cargaPorAgente = new Map(carga.map((c) => [c.agente_id, c]));

  if (isPending) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Catálogo de agentes"
        descripcion="Quién puede hacer qué, cuánto cuesta y cuánta carga soporta."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {agentes.map((a) => {
          const c = cargaPorAgente.get(a.id);
          const activas = Number(c?.tareas_activas ?? 0);
          return (
            <article key={a.id} className="panel p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Cpu className="size-4" />
                  </span>
                  <div>
                    <h2 className="font-display text-base font-semibold">{a.nombre}</h2>
                    <p className="text-xs text-muted-foreground">{a.proveedor}</p>
                  </div>
                </div>
                <span
                  className={
                    a.conectado
                      ? "rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs text-success"
                      : "rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                  }
                >
                  {a.conectado ? ETIQUETA_DISPONIBILIDAD[a.disponibilidad] : "Sin conectar"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.especialidades.map((e) => (
                  <span key={e} className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-muted-foreground">
                    {e}
                  </span>
                ))}
              </div>

              <dl className="mt-4 space-y-2.5 text-xs">
                <Barra termino="Calidad" valor={a.calidad} />
                <Barra termino="Rapidez" valor={a.rapidez} />
                <Barra termino="Seguridad" valor={a.seguridad} />
                <Barra termino="Coste relativo" valor={a.coste_relativo * 20} />
              </dl>

              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Carga de trabajo</span>
                  <span>
                    {activas}/{a.capacidad}
                  </span>
                </div>
                <Progreso className="mt-1.5" valor={(activas / Math.max(1, a.capacidad)) * 100} />
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Permisos: {a.permisos.length ? a.permisos.join(", ") : "sin permisos concedidos"}
              </p>
            </article>
          );
        })}
        {agentes.length === 0 && (
          <p className="panel p-6 text-sm text-muted-foreground">
            Todavía no hay agentes en el catálogo. Puedes cargar los datos de demostración desde Ajustes.
          </p>
        )}
      </div>
    </>
  );
}

function Barra({ termino, valor }: { termino: string; valor: number }) {
  return (
    <div>
      <div className="flex justify-between text-muted-foreground">
        <dt>{termino}</dt>
        <dd>{Math.round(valor)}</dd>
      </div>
      <Progreso className="mt-1" valor={valor} />
    </div>
  );
}
