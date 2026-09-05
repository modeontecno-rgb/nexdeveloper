import { createFileRoute } from "@tanstack/react-router";

import { Encabezado } from "@/components/nex/app-shell";
import { Progreso } from "@/components/nex/badges";
import { ADAPTADORES } from "@/lib/nex/adapters";
import { useNex } from "@/lib/nex/store";

export const Route = createFileRoute("/agentes")({
  head: () => ({
    meta: [
      { title: "Agentes · NexDeveloper" },
      { name: "description", content: "Catálogo de agentes con especialidades, coste, calidad, rapidez y permisos." },
      { property: "og:title", content: "Agentes · NexDeveloper" },
      { property: "og:description", content: "Catálogo de agentes con especialidades, coste, calidad y permisos." },
    ],
  }),
  component: Agentes,
});

function Agentes() {
  const { agentes } = useNex();

  return (
    <>
      <Encabezado
        titulo="Catálogo de agentes"
        descripcion="Ninguna API real está conectada todavía: cada agente tiene su adaptador preparado."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agentes.map((a) => {
          const adaptador = ADAPTADORES[a.id];
          return (
            <article key={a.id} className="panel p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display text-base font-semibold">{a.nombre}</h2>
                  <p className="text-xs text-muted-foreground">{a.proveedor}</p>
                </div>
                <span className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-xs text-warning">
                  Sin conectar
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.especialidades.map((e) => (
                  <span key={e} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                    {e}
                  </span>
                ))}
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <Barra etiqueta="Calidad histórica" valor={a.calidad} />
                <Barra etiqueta="Rapidez" valor={a.rapidez} />
                <Barra etiqueta="Coste relativo" valor={a.costeRelativo * 20} />
                <Barra etiqueta="Ocupación" valor={(a.tareasActivas / a.capacidad) * 100} />
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                Permisos: {a.permisos.join(", ")}
                <br />
                Adaptador: {adaptador ? adaptador.capacidades.join(", ") : "sin definir"}
              </p>
            </article>
          );
        })}
      </div>

      <div className="panel mt-6 p-4 text-sm text-muted-foreground">
        <h2 className="font-display text-sm font-semibold text-foreground">Cómo se elige el agente</h2>
        <p className="mt-2">
          Se pondera calidad histórica, coste, rapidez, permisos y carga actual. Por defecto responde un solo agente; la
          mesa de expertos (planifica, ejecuta y revisa) se activa solo en decisiones importantes desde «Nueva orden».
        </p>
      </div>
    </>
  );
}

function Barra({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div>
      <div className="flex justify-between text-muted-foreground">
        <span>{etiqueta}</span>
        <span>{Math.round(valor)}%</span>
      </div>
      <Progreso className="mt-1" valor={valor} />
    </div>
  );
}
