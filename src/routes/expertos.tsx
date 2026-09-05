import { createFileRoute } from "@tanstack/react-router";
import { Check, RefreshCw, Star, X } from "lucide-react";
import * as React from "react";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando } from "@/components/nex/badges";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import { ETIQUETA_ORIGEN } from "@/components/nex/selector-experto";
import type { EstadoExperto, ExpertoRow, OrigenExperto } from "@/lib/nex/db-types";
import { ETIQUETA_TAREA_IA, modelosDisponibles, resolverModelo } from "@/lib/nex/enrutado";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  useAdoptarExperto,
  useBarrerExpertos,
  useDescartarExperto,
  useExpertos,
  useGuardarExperto,
  useSembrarExpertos,
  useUsarExpertoEnProyecto,
} from "@/lib/nex/queries/expertos";
import { useModelosIa, usePoliticaEnrutado, useProveedoresIa } from "@/lib/nex/queries/proveedores";

export const Route = createFileRoute("/expertos")({
  head: () => ({
    meta: [
      { title: "Expertos · NexDeveloper" },
      {
        name: "description",
        content: "Directorio de expertos: los tuyos, los encontrados en la red y los sugeridos, listos para usar en cada trabajo.",
      },
      { property: "og:title", content: "Expertos · NexDeveloper" },
      {
        property: "og:description",
        content: "Directorio de expertos: los tuyos, los encontrados en la red y los sugeridos, listos para usar en cada trabajo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Expertos,
});

const ETIQUETA_ESTADO: Record<EstadoExperto, string> = {
  propuesto: "Propuesto",
  adoptado: "Adoptado",
  descartado: "Descartado",
};

function Expertos() {
  const { data: expertos = [], isPending } = useExpertos();
  const { data: modelos = [] } = useModelosIa();
  const { data: proveedores = [] } = useProveedoresIa();
  const { data: politica = [] } = usePoliticaEnrutado();
  const { data: proyectos = [] } = useProyectos();

  const adoptar = useAdoptarExperto();
  const descartar = useDescartarExperto();
  const guardar = useGuardarExperto();
  const barrer = useBarrerExpertos();
  const usarEnProyecto = useUsarExpertoEnProyecto();

  useSembrarExpertos(!isPending && expertos.length === 0);

  const [busqueda, setBusqueda] = React.useState("");
  const [origen, setOrigen] = React.useState<OrigenExperto | "todos">("todos");
  const [estado, setEstado] = React.useState<EstadoExperto | "todos">("todos");
  const [papel, setPapel] = React.useState("todos");
  const [fichaId, setFichaId] = React.useState<string | null>(null);
  const [proyectoElegido, setProyectoElegido] = React.useState("");

  const papeles = [...new Set(expertos.map((e) => e.papel).filter(Boolean))].sort();

  const visibles = expertos.filter(
    (e) =>
      (origen === "todos" || e.origen === origen) &&
      (estado === "todos" || e.estado === estado) &&
      (papel === "todos" || e.papel === papel) &&
      `${e.nombre} ${e.papel} ${e.cuando_usarlo ?? ""}`.toLowerCase().includes(busqueda.trim().toLowerCase()),
  );

  const ficha = expertos.find((e) => e.id === fichaId) ?? null;

  if (isPending) return <Cargando />;

  const usar = (experto: ExpertoRow) => {
    if (!proyectoElegido) return;
    const tarea = experto.tareas[0] ?? "razonamiento";
    const elegido = resolverModelo(tarea, politica, modelos, proveedores);
    usarEnProyecto.mutate({
      experto,
      proyectoId: proyectoElegido,
      modeloId: experto.modelo_aconsejado_id ?? elegido?.modelo_id ?? null,
      proveedorId: elegido?.proveedor_id ?? null,
    });
  };

  return (
    <>
      <Encabezado
        titulo="Expertos"
        descripcion="Tu caja de expertos, los que aparecen en la red y los que te sugerimos. Adopta los que te sirvan y úsalos en cualquier proyecto."
        acciones={
          <Boton variante="suave" disabled={barrer.isPending} onClick={() => barrer.mutate()}>
            <RefreshCw className={`size-4 ${barrer.isPending ? "animate-spin" : ""}`} /> Barrer ahora
          </Boton>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar experto"
          className={`${claseCampo} max-w-xs`}
        />
        <div className="flex flex-wrap gap-1.5">
          {(["todos", "propio", "red", "sugerido"] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrigen(o)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                origen === o ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"
              }`}
            >
              {o === "todos" ? "Todos" : ETIQUETA_ORIGEN[o]}
            </button>
          ))}
        </div>
        <select value={papel} onChange={(e) => setPapel(e.target.value)} className={`${claseCampo} max-w-[16rem]`}>
          <option value="todos">Cualquier papel</option>
          {papeles.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoExperto | "todos")}
          className={`${claseCampo} max-w-[12rem]`}
        >
          <option value="todos">Cualquier estado</option>
          {(Object.keys(ETIQUETA_ESTADO) as EstadoExperto[]).map((k) => (
            <option key={k} value={k}>
              {ETIQUETA_ESTADO[k]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibles.map((e) => (
          <article key={e.id} className="panel flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              {e.muestra_url ? (
                <img src={e.muestra_url} alt={`Muestra de ${e.nombre}`} loading="lazy" className="size-12 rounded-lg object-cover" />
              ) : (
                <span className="grid size-12 place-items-center rounded-lg bg-primary/15 font-display text-lg text-primary">
                  {e.nombre.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setFichaId(e.id)}
                  className="text-left font-display text-sm font-semibold hover:text-primary"
                >
                  {e.nombre}
                </button>
                <p className="truncate text-xs text-muted-foreground">{e.papel}</p>
              </div>
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {ETIQUETA_ESTADO[e.estado]}
              </span>
            </div>

            {e.tareas.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {e.tareas.map((t) => (
                  <span key={t} className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
                    {ETIQUETA_TAREA_IA[t] ?? t}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <Estrellas valor={e.valoracion} onChange={(v) => guardar.mutate({ id: e.id, cambios: { valoracion: v } })} />
              <span>{e.usos} usos</span>
            </div>

            {e.estado === "propuesto" ? (
              <div className="flex gap-2">
                <Boton onClick={() => adoptar.mutate(e)} disabled={adoptar.isPending}>
                  <Check className="size-4" /> Adoptar
                </Boton>
                <Boton variante="suave" onClick={() => descartar.mutate(e.id)}>
                  <X className="size-4" /> Descartar
                </Boton>
              </div>
            ) : null}
          </article>
        ))}
        {visibles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay expertos que coincidan con la búsqueda.</p>
        ) : null}
      </div>

      <Dialogo
        abierto={Boolean(ficha)}
        titulo={ficha?.nombre ?? "Experto"}
        {...(ficha ? { descripcion: ETIQUETA_ORIGEN[ficha.origen] } : {})}
        onCerrar={() => setFichaId(null)}
      >
        {ficha ? (
          <div className="space-y-4">
            {ficha.muestra_url ? (
              <img
                src={ficha.muestra_url}
                alt={`Muestra de ${ficha.nombre}`}
                className="max-h-48 w-full rounded-lg object-cover"
              />
            ) : null}

            <Campo etiqueta="Nombre">
              <input
                defaultValue={ficha.nombre}
                onBlur={(ev) => guardar.mutate({ id: ficha.id, cambios: { nombre: ev.target.value } })}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Papel">
              <input
                defaultValue={ficha.papel}
                onBlur={(ev) => guardar.mutate({ id: ficha.id, cambios: { papel: ev.target.value } })}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Cuándo usarlo">
              <textarea
                defaultValue={ficha.cuando_usarlo ?? ""}
                onBlur={(ev) => guardar.mutate({ id: ficha.id, cambios: { cuando_usarlo: ev.target.value } })}
                rows={2}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Instrucciones">
              <textarea
                defaultValue={ficha.instrucciones ?? ""}
                onBlur={(ev) => guardar.mutate({ id: ficha.id, cambios: { instrucciones: ev.target.value } })}
                rows={6}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Imagen de muestra (dirección)">
              <input
                defaultValue={ficha.muestra_url ?? ""}
                onBlur={(ev) => guardar.mutate({ id: ficha.id, cambios: { muestra_url: ev.target.value || null } })}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Modelo aconsejado">
              <select
                value={ficha.modelo_aconsejado_id ?? ""}
                onChange={(ev) =>
                  guardar.mutate({ id: ficha.id, cambios: { modelo_aconsejado_id: ev.target.value || null } })
                }
                className={claseCampo}
              >
                <option value="">Sin asignar</option>
                {modelosDisponibles(modelos, proveedores).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            {ficha.url_origen ? (
              <p className="text-xs text-muted-foreground">
                Origen:{" "}
                <a href={ficha.url_origen} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {ficha.url_origen}
                </a>
              </p>
            ) : null}
            {ficha.url_origen_publicado ? (
              <p className="text-xs text-muted-foreground">
                Publicado en:{" "}
                <a
                  href={ficha.url_origen_publicado}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {ficha.url_origen_publicado}
                </a>
              </p>
            ) : null}

            <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
              <label className="flex-1 text-xs text-muted-foreground">
                Proyecto
                <select
                  value={proyectoElegido}
                  onChange={(ev) => setProyectoElegido(ev.target.value)}
                  className={`${claseCampo} mt-1`}
                >
                  <option value="">Elige un proyecto</option>
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <Boton disabled={!proyectoElegido || usarEnProyecto.isPending} onClick={() => usar(ficha)}>
                Usar en este proyecto
              </Boton>
            </div>
          </div>
        ) : null}
      </Dialogo>
    </>
  );
}

function Estrellas({ valor, onChange }: { valor: number | null; onChange: (v: number) => void }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`Valorar con ${n} estrellas`}
          onClick={() => onChange(n)}
          className="text-muted-foreground transition hover:text-warning"
        >
          <Star className={`size-3.5 ${valor && n <= valor ? "fill-warning text-warning" : ""}`} />
        </button>
      ))}
    </span>
  );
}
