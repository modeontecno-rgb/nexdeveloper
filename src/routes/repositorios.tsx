import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink, FolderUp, Github, Link2, RefreshCw } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type { EstadoRepositorio, OrigenCodigoRepositorio, ProyectoRow } from "@/lib/nex/db-types";
import { crearSlug, marcaTiempo } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  DUENO_GITHUB,
  prepararCarpeta,
  trocear,
  useCrearRepositorio,
  useEnlazarRepositorio,
  useMarcarOrigenCodigo,
  useRepositorios,
  useRepositoriosGithub,
  useSubirTanda,
  type ArchivoPreparado,
} from "@/lib/nex/queries/repositorios";
import { VERSION_APP } from "@/lib/nex/version";

export const Route = createFileRoute("/repositorios")({
  head: () => ({
    meta: [
      { title: "Repositorios · NexDeveloper" },
      {
        name: "description",
        content: "Crea repositorios privados de GitHub para cada proyecto y sube su código desde la propia aplicación.",
      },
      { property: "og:title", content: "Repositorios · NexDeveloper" },
      {
        property: "og:description",
        content: "Crea repositorios privados de GitHub para cada proyecto y sube su código desde la propia aplicación.",
      },
    ],
  }),
  component: PantallaRepositorios,
});

const ETIQUETA_ESTADO: Record<EstadoRepositorio, string> = {
  pendiente: "Pendiente",
  creado: "Creado",
  con_codigo: "Con código",
  error: "Error",
};

const TONO_ESTADO: Record<EstadoRepositorio, string> = {
  pendiente: "border-border bg-muted text-muted-foreground",
  creado: "border-primary/40 bg-primary/10 text-primary",
  con_codigo: "border-success/40 bg-success/10 text-success",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

const ETIQUETA_ORIGEN: Record<OrigenCodigoRepositorio, string> = {
  vacio: "Vacío",
  carpeta_subida: "Carpeta subida",
  lovable: "Hecho con el editor web",
  externo: "Externo",
};

const PASOS = ["Creando repositorio", "README", "Taller de calidad", "CHANGELOG", "Listo"];

function PantallaRepositorios() {
  const { data: proyectos = [] } = useProyectos();
  const { data: repositorios = [], refetch } = useRepositorios();
  const crear = useCrearRepositorio();
  const subir = useSubirTanda();
  const enlazar = useEnlazarRepositorio();
  const marcarOrigen = useMarcarOrigenCodigo();

  const [soloSin, setSoloSin] = React.useState(false);
  const [creando, setCreando] = React.useState<ProyectoRow | null>(null);
  const [nombre, setNombre] = React.useState("");
  const [privado, setPrivado] = React.useState(true);
  const [descripcion, setDescripcion] = React.useState("");
  const [paso, setPaso] = React.useState(-1);
  const [enlaceCreado, setEnlaceCreado] = React.useState<string | null>(null);

  const [enlazando, setEnlazando] = React.useState<ProyectoRow | null>(null);
  const [elegido, setElegido] = React.useState("");
  const { data: repositoriosGithub = [], isFetching: cargandoGithub } = useRepositoriosGithub(Boolean(enlazando));

  const [subiendoDe, setSubiendoDe] = React.useState<string | null>(null);
  const [progreso, setProgreso] = React.useState<{ hechas: number; total: number; omitidos: number } | null>(null);
  const [ultimoCommit, setUltimoCommit] = React.useState<string | null>(null);
  const entradaCarpeta = React.useRef<HTMLInputElement | null>(null);

  const repoDe = (proyectoId: string) => repositorios.find((r) => r.proyecto_id === proyectoId) ?? null;
  const visibles = soloSin ? proyectos.filter((p) => !repoDe(p.id)) : proyectos;

  const abrirCreacion = (proyecto: ProyectoRow) => {
    setCreando(proyecto);
    setNombre(crearSlug(proyecto.nombre));
    setPrivado(true);
    setDescripcion(proyecto.descripcion ?? "");
    setPaso(-1);
    setEnlaceCreado(null);
  };

  const crearYPreparar = async () => {
    if (!creando) return;
    try {
      setPaso(0);
      const respuesta = await crear.mutateAsync({
        proyectoId: creando.id,
        nombre: crearSlug(nombre),
        privado,
        descripcion,
        version: VERSION_APP,
      });
      setPaso(4);
      setEnlaceCreado(respuesta.url);
      toast.success(respuesta.existente ? "El repositorio ya existía; se ha preparado igualmente." : "Repositorio listo.");
    } catch {
      setPaso(-1);
    }
  };

  const elegirCarpeta = (repositorioId: string) => {
    setSubiendoDe(repositorioId);
    setProgreso(null);
    setUltimoCommit(null);
    entradaCarpeta.current?.click();
  };

  const alElegirCarpeta = async (evento: React.ChangeEvent<HTMLInputElement>) => {
    const lista = Array.from(evento.target.files ?? []);
    evento.target.value = "";
    if (!subiendoDe || lista.length === 0) return;
    toast.info("Leyendo la carpeta...");
    const { validos, omitidos } = await prepararCarpeta(lista);
    if (validos.length === 0) {
      setProgreso({ hechas: 0, total: 0, omitidos: omitidos.length });
      toast.error("No queda ningún archivo que subir: todo se ha omitido por seguridad.");
      return;
    }
    const tandas: ArchivoPreparado[][] = trocear(validos);
    setProgreso({ hechas: 0, total: tandas.length, omitidos: omitidos.length });
    try {
      for (let i = 0; i < tandas.length; i += 1) {
        const respuesta = await subir.mutateAsync({
          repositorioId: subiendoDe,
          mensaje: `Subida ${i + 1}/${tandas.length}`,
          archivos: tandas[i]!,
        });
        setProgreso({ hechas: i + 1, total: tandas.length, omitidos: omitidos.length });
        if (respuesta.url_commit) setUltimoCommit(respuesta.url_commit);
      }
      toast.success(`Subida terminada: ${validos.length} archivos, ${omitidos.length} omitidos por seguridad.`);
    } catch (err) {
      toast.error(String((err as Error)?.message ?? err));
    }
  };

  return (
    <>
      <Encabezado
        titulo="Repositorios"
        descripcion={`Crea y rellena repositorios privados en la cuenta ${DUENO_GITHUB} sin salir de aquí.`}
        acciones={
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={soloSin} onChange={(e) => setSoloSin(e.target.checked)} />
              Solo sin repositorio
            </label>
            <Boton variante="suave" onClick={() => void refetch()}>
              <RefreshCw className="size-4" /> Actualizar
            </Boton>
          </div>
        }
      />

      <input
        ref={entradaCarpeta}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void alElegirCarpeta(e)}
        // @ts-expect-error atributo propio de los navegadores para elegir una carpeta
        webkitdirectory=""
        directory=""
      />

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Proyecto</th>
              <th className="px-3 py-2">Repositorio</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Último envío</th>
              <th className="px-3 py-2">Origen del código</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((proyecto) => {
              const repo = repoDe(proyecto.id);
              return (
                <tr key={proyecto.id} className="border-t border-border align-top">
                  <td className="px-3 py-3 font-medium">{proyecto.nombre}</td>
                  <td className="px-3 py-3">
                    {repo ? (
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {repo.nombre_completo} <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Sin repositorio</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                        TONO_ESTADO[repo?.estado ?? "pendiente"]
                      }`}
                    >
                      {ETIQUETA_ESTADO[repo?.estado ?? "pendiente"]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {repo?.ultimo_push_el ? marcaTiempo(repo.ultimo_push_el) : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {repo ? ETIQUETA_ORIGEN[repo.origen_codigo] : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {repo ? (
                        <>
                          <Boton variante="suave" onClick={() => elegirCarpeta(repo.id)} disabled={subir.isPending}>
                            <FolderUp className="size-4" /> Subir carpeta
                          </Boton>
                          {repo.origen_codigo !== "lovable" ? (
                            <Boton
                              variante="suave"
                              onClick={() => marcarOrigen.mutate({ id: repo.id, origen: "lovable" })}
                            >
                              <CheckCircle2 className="size-4" /> Ya está conectado
                            </Boton>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <Boton onClick={() => abrirCreacion(proyecto)}>
                            <Github className="size-4" /> Crear en GitHub
                          </Boton>
                          <Boton
                            variante="suave"
                            onClick={() => {
                              setEnlazando(proyecto);
                              setElegido("");
                            }}
                          >
                            <Link2 className="size-4" /> Enlazar existente
                          </Boton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No hay proyectos que mostrar.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {progreso ? (
        <section className="panel mt-4 p-4">
          <h2 className="font-display text-sm font-semibold">Subida de la carpeta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tanda {progreso.hechas} de {progreso.total}. {progreso.omitidos} archivos omitidos por seguridad.
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progreso.total ? (progreso.hechas / progreso.total) * 100 : 0}%` }}
            />
          </div>
          {ultimoCommit ? (
            <a href={ultimoCommit} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Ver el último envío en GitHub <ExternalLink className="size-3" />
            </a>
          ) : null}
        </section>
      ) : null}

      <Dialogo
        abierto={Boolean(creando)}
        titulo="Crear repositorio en GitHub"
        descripcion={`Se creará dentro de la cuenta ${DUENO_GITHUB}.`}
        onCerrar={() => setCreando(null)}
      >
        <div className="grid gap-3">
          <Campo etiqueta="Nombre del repositorio" pista={`Quedará como ${DUENO_GITHUB}/${crearSlug(nombre) || "..."}`}>
            <input className={claseCampo} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={privado} onChange={(e) => setPrivado(e.target.checked)} /> Privado
          </label>
          <Campo etiqueta="Descripción">
            <textarea
              className={claseCampo}
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </Campo>

          {paso >= 0 ? (
            <ol className="grid gap-1 text-sm">
              {PASOS.map((texto, indice) => (
                <li
                  key={texto}
                  className={indice <= paso ? "text-success" : "text-muted-foreground"}
                >
                  {indice <= paso ? "✓ " : "· "}
                  {texto}
                </li>
              ))}
            </ol>
          ) : null}

          {enlaceCreado ? (
            <>
              <a href={enlaceCreado} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                Abrir {enlaceCreado}
              </a>
              <div className="rounded-lg border border-border bg-surface p-3 text-sm">
                <p className="font-medium">Último paso en el editor web</p>
                <p className="mt-1 text-muted-foreground">
                  Si el proyecto se hizo en el editor web: entra en ese proyecto, abre Configuración → GitHub →
                  Conectar y elige <strong>{`${DUENO_GITHUB}/${crearSlug(nombre)}`}</strong>. Cuando termines, pulsa
                  «Ya está conectado» en la fila del proyecto.
                </p>
              </div>
            </>
          ) : null}

          <div className="flex justify-end gap-2">
            <Boton variante="suave" onClick={() => setCreando(null)}>
              Cerrar
            </Boton>
            <Boton onClick={() => void crearYPreparar()} disabled={crear.isPending || !nombre.trim()}>
              Crear y preparar
            </Boton>
          </div>
        </div>
      </Dialogo>

      <Dialogo
        abierto={Boolean(enlazando)}
        titulo="Enlazar un repositorio existente"
        descripcion="Asocia a este proyecto un repositorio que ya tienes en GitHub."
        onCerrar={() => setEnlazando(null)}
        ancho="max-w-lg"
      >
        <div className="grid gap-3">
          <Campo etiqueta="Repositorio">
            <select className={claseCampo} value={elegido} onChange={(e) => setElegido(e.target.value)}>
              <option value="">{cargandoGithub ? "Cargando..." : "Elige uno"}</option>
              {repositoriosGithub.map((r) => (
                <option key={r.nombre_completo} value={r.nombre_completo}>
                  {r.nombre_completo}
                </option>
              ))}
            </select>
          </Campo>
          <div className="flex justify-end gap-2">
            <Boton variante="suave" onClick={() => setEnlazando(null)}>
              Cancelar
            </Boton>
            <Boton
              disabled={!elegido || !enlazando}
              onClick={async () => {
                const repo = repositoriosGithub.find((r) => r.nombre_completo === elegido);
                if (!repo || !enlazando) return;
                await enlazar.mutateAsync({
                  proyectoId: enlazando.id,
                  nombreCompleto: repo.nombre_completo,
                  url: repo.url,
                  privado: repo.privado,
                });
                setEnlazando(null);
              }}
            >
              Enlazar
            </Boton>
          </div>
        </div>
      </Dialogo>
    </>
  );
}
