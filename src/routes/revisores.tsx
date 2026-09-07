import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Loader2, RefreshCw, UserCheck, Users } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton } from "@/components/nex/campos";
import { formatoFechaHora } from "@/lib/nex/labels";
import { obtenerPanelRevisores } from "@/lib/nex/revisores.functions";

const DESCRIPCION =
  "Quién ha entrado a revisar, cuántos manuales lleva revisados cada uno y el historial de insignias de redacción.";

export const Route = createFileRoute("/revisores")({
  head: () => ({
    meta: [
      { title: "Revisores de manuales · NexDeveloper" },
      { name: "description", content: DESCRIPCION },
      { property: "og:title", content: "Revisores de manuales · NexDeveloper" },
      { property: "og:description", content: DESCRIPCION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaRevisores,
});

function PantallaRevisores() {
  const obtener = useServerFn(obtenerPanelRevisores);
  const consulta = useQuery({
    queryKey: ["panel-revisores"],
    queryFn: () => obtener(),
    staleTime: 60_000,
  });
  const panel = consulta.data;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16">
      <Encabezado
        titulo="Revisores"
        descripcion={DESCRIPCION}
        acciones={
          <Boton
            variante="suave"
            onClick={() => consulta.refetch()}
            disabled={consulta.isFetching}
          >
            {consulta.isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Actualizar
          </Boton>
        }
      />

      {consulta.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando el panel de revisores…
        </p>
      ) : consulta.isError || !panel ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          No se ha podido cargar el panel.{" "}
          {consulta.error instanceof Error ? consulta.error.message : "Inténtalo de nuevo en unos segundos."}
        </div>
      ) : (
        <>
          {/* Tarjetas de totales */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Tarjeta icono={<Users className="size-4" />} titulo="Revisores" valor={panel.totales.cuentas} />
            <Tarjeta
              icono={<UserCheck className="size-4" />}
              titulo="Con revisiones"
              valor={panel.totales.han_entrado}
            />

            <Tarjeta icono={<BadgeCheck className="size-4" />} titulo="Manuales" valor={panel.totales.manuales} />
            <Tarjeta icono={<BadgeCheck className="size-4" />} titulo="Revisados" valor={panel.totales.revisados} />
            <Tarjeta
              icono={<BadgeCheck className="size-4" />}
              titulo="Correcciones"
              valor={panel.totales.correcciones}
            />
          </div>

          {/* Tabla de revisores */}
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Actividad por revisor</h2>
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Revisor</th>
                    <th className="px-4 py-2.5 font-medium">Primera actividad</th>
                    <th className="px-4 py-2.5 text-right font-medium">Manuales</th>
                    <th className="px-4 py-2.5 text-right font-medium">Revisados</th>
                    <th className="px-4 py-2.5 text-right font-medium">Correcciones</th>
                    <th className="px-4 py-2.5 font-medium">Última revisión</th>
                  </tr>
                </thead>
                <tbody>
                  {panel.revisores.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2.5 font-medium">{r.email}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {r.ultimo_acceso ? formatoFechaHora(r.ultimo_acceso) : "—"}
                      </td>

                      <td className="px-4 py-2.5 text-right">{r.manuales_totales}</td>
                      <td className="px-4 py-2.5 text-right">{r.manuales_revisados}</td>
                      <td className="px-4 py-2.5 text-right">{r.correcciones_totales}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {r.ultima_revision ? formatoFechaHora(r.ultima_revision) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Historial de insignias */}
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Historial de insignias</h2>
            {panel.insignias.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
                Todavía no hay ningún manual con la redacción revisada. Las insignias aparecerán aquí en cuanto un
                revisor pulse «Revisar redacción» en un manual.
              </p>
            ) : (
              <ul className="space-y-2">
                {panel.insignias.map((i) => (
                  <li
                    key={`${i.manual_id}-${i.revisado_el}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-surface px-4 py-3 text-sm"
                  >
                    <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs text-success">
                      Redacción revisada · {i.correcciones} correcciones
                    </span>
                    <Link
                      to="/manuales/$manualId"
                      params={{ manualId: i.manual_id }}
                      className="font-medium hover:underline"
                    >
                      {i.titulo}
                    </Link>
                    {i.proyecto ? <span className="text-muted-foreground">· {i.proyecto}</span> : null}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {i.revisor} · {i.capitulos} capítulos
                      {i.nivel ? ` · revisión ${i.nivel}` : ""} · {formatoFechaHora(i.revisado_el)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Tarjeta({ icono, titulo, valor }: { icono: React.ReactNode; titulo: string; valor: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icono}
        {titulo}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
