import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, GitCommitHorizontal, Link2, Loader2, RefreshCw, XCircle } from "lucide-react";
import * as React from "react";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando } from "@/components/nex/badges";
import { Boton, Selector } from "@/components/nex/campos";
import type { ProyectoRow, TipoSyncProyectian } from "@/lib/nex/db-types";
import { desde, formatoFechaHora } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  ACCIONES_SINCRONIZACION,
  ETIQUETA_TIPO_SYNC,
  detalleFormateado,
  loginGithub,
  useDiagnosticoRepositorios,
  useHistorialProyectian,
  useProbarProyectian,
  useSincronizarProyectian,
  type AccionProyectian,
} from "@/lib/nex/queries/proyectian";

export const Route = createFileRoute("/proyectian")({
  head: () => ({
    meta: [
      { title: "Sincronización con Proyectian · NexDeveloper" },
      {
        name: "description",
        content: "Trae de Proyectian las versiones, la salud, las pantallas, las reuniones y los pendientes de cada proyecto.",
      },
      { property: "og:title", content: "Sincronización con Proyectian · NexDeveloper" },
      {
        property: "og:description",
        content: "Trae de Proyectian las versiones, la salud, las pantallas, las reuniones y los pendientes de cada proyecto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaProyectian,
});

const DIAS_SIN_COMMIT = 7;

function PantallaProyectian() {
  const { data: prueba, isFetching: probando, refetch: reprobar } = useProbarProyectian();
  const sincronizar = useSincronizarProyectian();
  const [verDiagnostico, setVerDiagnostico] = React.useState(false);

  const conectado = prueba?.ok === true;
  const login = loginGithub(prueba?.github ?? null);

  return (
    <>
      <Encabezado
        titulo="Sincronización con Proyectian"
        descripcion="Todo lo que NexDeveloper trae de Proyectian y de los repositorios, en un único sitio."
        acciones={
          <Boton variante="suave" onClick={() => void reprobar()} disabled={probando}>
            {probando ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Probar conexión
          </Boton>
        }
      />

      <section
        className={
          conectado
            ? "panel mb-6 border-success/40 bg-success/5 p-4"
            : "panel mb-6 border-destructive/40 bg-destructive/5 p-4"
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {probando ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : conectado ? (
            <CheckCircle2 className="size-5 text-success" />
          ) : (
            <XCircle className="size-5 text-destructive" />
          )}
          <p className="text-sm font-medium text-foreground">
            {probando
              ? "Comprobando la conexión…"
              : conectado
                ? `Conectado · GitHub como ${login ?? "cuenta sin nombre"} · ${prueba?.proyectian_proyectos ?? 0} proyectos en Proyectian`
                : `Sin conexión · ${prueba?.error ?? "no se ha podido conectar con Proyectian"}`}
          </p>
        </div>
      </section>

      <section className="panel mb-6 p-4">
        <h2 className="font-display text-sm font-semibold">Sincronizar ahora</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Se hace solo cada hora (versiones, salud y reuniones), cada día (pantallas) y cada cinco minutos (pendientes).
          Aquí puedes lanzarlo cuando quieras.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ACCIONES_SINCRONIZACION.map((a) => (
            <Boton
              key={a.accion}
              variante={a.accion === "todo" ? "principal" : "suave"}
              title={a.descripcion}
              disabled={sincronizar.isPending}
              onClick={() => sincronizar.mutate({ accion: a.accion })}
            >
              {sincronizar.isPending && sincronizar.variables?.accion === a.accion ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {a.etiqueta}
            </Boton>
          ))}
          <Boton variante="suave" onClick={() => setVerDiagnostico((v) => !v)}>
            {verDiagnostico ? "Ocultar diagnóstico" : "Diagnóstico de repositorios"}
          </Boton>
        </div>
      </section>

      {verDiagnostico ? <BloqueDiagnostico /> : null}

      <HistorialSincronizacion />
    </>
  );
}

/* ------------------------ Diagnóstico de repositorios --------------------- */

function BloqueDiagnostico() {
  const { data: filas = [], isPending, isError, error, refetch, isFetching } = useDiagnosticoRepositorios(true);

  const anticuado = (fecha: string | null) => {
    if (!fecha) return true;
    const dias = (Date.now() - new Date(fecha).getTime()) / 86_400_000;
    return dias > DIAS_SIN_COMMIT;
  };

  return (
    <section className="panel mb-6 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold">Diagnóstico de repositorios</h2>
        <Boton variante="suave" className="px-2.5 py-1 text-xs" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Actualizar
        </Boton>
      </header>
      {isPending ? (
        <Cargando texto="Revisando los repositorios…" />
      ) : isError ? (
        <p className="p-4 text-sm text-destructive">{(error as Error).message}</p>
      ) : (
        <div className="tabla-scroll overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Proyecto</th>
                <th className="px-4 py-2 font-medium">Repositorio</th>
                <th className="px-4 py-2 font-medium">Existe</th>
                <th className="px-4 py-2 font-medium">Último cambio</th>
                <th className="px-4 py-2 font-medium">Fichero de versión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map((f) => {
                const alerta = !f.existe || anticuado(f.ultimo_commit) || !f.tiene_version_ts;
                return (
                  <tr key={`${f.proyecto}-${f.repositorio ?? "sin"}`} className={alerta ? "bg-destructive/5" : ""}>
                    <td className="px-4 py-2 text-foreground">{f.proyecto}</td>
                    <td className="px-4 py-2 text-muted-foreground">{f.repositorio ?? "Sin repositorio"}</td>
                    <td className="px-4 py-2">
                      {f.existe ? (
                        <span className="text-success">Sí</span>
                      ) : (
                        <span className="font-medium text-destructive">No</span>
                      )}
                    </td>
                    <td className={anticuado(f.ultimo_commit) ? "px-4 py-2 text-destructive" : "px-4 py-2 text-muted-foreground"}>
                      {f.ultimo_commit ? desde(f.ultimo_commit) : "Nunca"}
                      {f.mensaje ? <span className="block text-xs opacity-70">{f.mensaje}</span> : null}
                    </td>
                    <td className="px-4 py-2">
                      {f.tiene_version_ts ? (
                        <span className="text-success">Sí</span>
                      ) : (
                        <span className="font-medium text-destructive">No</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-muted-foreground">
                    No hay repositorios que revisar.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <AlertTriangle className="mr-1 inline size-3.5 text-destructive" /> En rojo, lo que lleva más de {DIAS_SIN_COMMIT}{" "}
        días sin cambios o no tiene fichero de versión.
      </p>
    </section>
  );
}

/* ---------------------------- Historial completo -------------------------- */

const TIPOS: TipoSyncProyectian[] = ["versiones", "salud", "pantallas", "reuniones", "pendientes"];

function HistorialSincronizacion() {
  const { data: filas = [], isPending } = useHistorialProyectian();
  const { data: proyectos = [] } = useProyectos();
  const [tipo, setTipo] = React.useState<string>("todos");
  const [proyecto, setProyecto] = React.useState<string>("todos");
  const [abierta, setAbierta] = React.useState<string | null>(null);

  const nombreProyecto = (id: string | null) => proyectos.find((p) => p.id === id)?.nombre ?? "Toda la cartera";

  const visibles = filas.filter(
    (f) => (tipo === "todos" || f.tipo === tipo) && (proyecto === "todos" || f.proyecto_id === proyecto),
  );

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold">Historial de sincronización</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Selector
            etiqueta="Tipo"
            valor={tipo}
            onChange={setTipo}
            opciones={[
              { valor: "todos", texto: "Todos" },
              ...TIPOS.map((t) => ({ valor: t, texto: ETIQUETA_TIPO_SYNC[t] })),
            ]}
          />
          <Selector
            etiqueta="Proyecto"
            valor={proyecto}
            onChange={setProyecto}
            opciones={[
              { valor: "todos", texto: "Todos" },
              ...proyectos.map((p) => ({ valor: p.id, texto: p.nombre })),
            ]}
          />
        </div>
      </header>

      {isPending ? (
        <Cargando />
      ) : (
        <ul className="divide-y divide-border">
          {visibles.map((f) => (
            <li key={f.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        f.ok
                          ? "inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
                          : "inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"
                      }
                    >
                      {f.ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                      {f.ok ? "Correcta" : "Con error"}
                    </span>
                    <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                      {ETIQUETA_TIPO_SYNC[f.tipo] ?? f.tipo}
                    </span>
                    <span className="text-xs text-muted-foreground">{nombreProyecto(f.proyecto_id)}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground">{f.resumen ?? "Sin resumen."}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground" title={formatoFechaHora(f.creado_el)}>
                    {desde(f.creado_el)}
                  </span>
                  <Boton
                    variante="suave"
                    className="px-2.5 py-1 text-xs"
                    onClick={() => setAbierta(abierta === f.id ? null : f.id)}
                  >
                    {abierta === f.id ? "Ocultar detalle" : "Ver detalle"}
                  </Boton>
                </div>
              </div>
              {abierta === f.id ? (
                <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
                  {detalleFormateado(f.detalle)}
                </pre>
              ) : null}
            </li>
          ))}
          {visibles.length === 0 ? (
            <li className="p-6 text-sm text-muted-foreground">Todavía no hay sincronizaciones con estos filtros.</li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

/* ------------------- Bloque de versión en la ficha del proyecto ------------ */

export function BloqueVersionProyecto({ proyecto }: { proyecto: ProyectoRow }) {
  const sincronizar = useSincronizarProyectian();
  const comprobando = sincronizar.isPending && sincronizar.variables?.proyectoId === proyecto.id;

  return (
    <section className="panel mb-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Link2 className="size-4 text-primary" /> Versión
          </h2>
          <p className="mt-1 text-2xl font-semibold text-foreground">{proyecto.version_actual ?? "Sin versión"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Origen: {proyecto.version_origen ?? "sin determinar"}
            {proyecto.version_commit_sha ? (
              <>
                {" · "}
                <GitCommitHorizontal className="inline size-3.5" /> {proyecto.version_commit_sha.slice(0, 7)}
                {proyecto.version_commit_el ? ` (${desde(proyecto.version_commit_el)})` : ""}
              </>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {proyecto.version_comprobada_el
              ? `Comprobada ${desde(proyecto.version_comprobada_el)}`
              : "Todavía no se ha comprobado."}
          </p>
        </div>
        <Boton
          variante="suave"
          disabled={sincronizar.isPending}
          onClick={() => sincronizar.mutate({ accion: "versiones" as AccionProyectian, proyectoId: proyecto.id })}
        >
          {comprobando ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Comprobar ahora
        </Boton>
      </div>
    </section>
  );
}
