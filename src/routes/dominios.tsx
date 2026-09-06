import { createFileRoute, useSearch } from "@tanstack/react-router";
import { ExternalLink, Globe, History, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, Selector, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type { DominioRow, ResultadoDominio, TipoDominio } from "@/lib/nex/db-types";
import { desde, formatoFecha, formatoFechaHora } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  hostValido,
  useBorrarDominio,
  useComprobarDominio,
  useComprobarTodos,
  useDominios,
  useGuardarDominio,
  useHistorialDominio,
  useRealtimeDominios,
  useResumenDominios,
} from "@/lib/nex/queries/dominios";

type BusquedaDominios = { proyecto?: string };

export const Route = createFileRoute("/dominios")({
  validateSearch: (busqueda: Record<string, unknown>): BusquedaDominios =>
    typeof busqueda["proyecto"] === "string" ? { proyecto: busqueda["proyecto"] } : {},
  head: () => ({
    meta: [
      { title: "Dominios y certificados · NexDeveloper" },
      {
        name: "description",
        content: "Vigila tus dominios, sus certificados y su caducidad, con comprobación diaria automática.",
      },
      { property: "og:title", content: "Dominios y certificados · NexDeveloper" },
      {
        property: "og:description",
        content: "Vigila tus dominios, sus certificados y su caducidad, con comprobación diaria automática.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaDominios,
});

export const ETIQUETA_RESULTADO: Record<ResultadoDominio, string> = {
  ok: "OK",
  aviso: "Aviso",
  error: "Error",
  sin_comprobar: "Sin comprobar",
};

const TONO_RESULTADO: Record<ResultadoDominio, string> = {
  ok: "border-success/40 bg-success/10 text-success",
  aviso: "border-warning/40 bg-warning/10 text-warning",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  sin_comprobar: "border-border bg-muted text-muted-foreground",
};

const ETIQUETA_TIPO: Record<TipoDominio, string> = {
  dominio: "Dominio",
  subdominio: "Subdominio",
  externo: "Externo",
};

function Insignia({ resultado, pendiente }: { resultado: ResultadoDominio; pendiente: boolean }) {
  if (pendiente) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary">
        <RefreshCw className="size-3 animate-spin" /> Comprobando
      </span>
    );
  }
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${TONO_RESULTADO[resultado]}`}>
      {ETIQUETA_RESULTADO[resultado]}
    </span>
  );
}

function colorTiempo(ms: number | null) {
  if (ms === null) return "text-muted-foreground";
  if (ms < 1000) return "text-success";
  if (ms < 3000) return "text-warning";
  return "text-destructive";
}

function colorDias(dias: number | null, avisoDias: number) {
  if (dias === null) return "text-muted-foreground";
  if (dias <= 0) return "text-destructive";
  if (dias <= avisoDias) return "text-warning";
  return "text-success";
}

function PantallaDominios() {
  const busqueda = useSearch({ from: "/dominios" });
  const { data: dominios = [], isPending } = useDominios();
  const { data: resumen } = useResumenDominios();
  const { data: proyectos = [] } = useProyectos();
  useRealtimeDominios();

  const comprobar = useComprobarDominio();
  const comprobarTodos = useComprobarTodos();
  const guardar = useGuardarDominio();
  const borrar = useBorrarDominio();

  const [filtroProyecto, setFiltroProyecto] = React.useState<string>(busqueda.proyecto ?? "todos");
  const [filtroTipo, setFiltroTipo] = React.useState<string>("todos");
  const [filtroResultado, setFiltroResultado] = React.useState<string>("todos");
  const [texto, setTexto] = React.useState("");
  const [orden, setOrden] = React.useState<"dominio" | "resultado" | "cert" | "comprobacion">("dominio");
  const [comprobandoId, setComprobandoId] = React.useState<string | null>(null);
  const [enMarcha, setEnMarcha] = React.useState(false);
  const [editando, setEditando] = React.useState<DominioRow | null>(null);
  const [nuevo, setNuevo] = React.useState(false);
  const [historialId, setHistorialId] = React.useState<string | null>(null);
  const [borrando, setBorrando] = React.useState<DominioRow | null>(null);

  const nombreProyecto = (id: string | null) => proyectos.find((p) => p.id === id)?.nombre ?? null;

  const pendientes = dominios.filter((d) => d.pendiente).length;
  React.useEffect(() => {
    if (enMarcha && pendientes === 0) setEnMarcha(false);
  }, [enMarcha, pendientes]);

  const visibles = dominios
    .filter(
      (d) =>
        (filtroProyecto === "todos" || d.proyecto_id === filtroProyecto) &&
        (filtroTipo === "todos" || d.tipo === filtroTipo) &&
        (filtroResultado === "todos" || d.resultado === filtroResultado) &&
        (texto.trim() === "" || d.dominio.toLowerCase().includes(texto.trim().toLowerCase())),
    )
    .sort((a, b) => {
      if (orden === "resultado") {
        const peso: Record<ResultadoDominio, number> = { error: 0, aviso: 1, sin_comprobar: 2, ok: 3 };
        return peso[a.resultado] - peso[b.resultado] || a.dominio.localeCompare(b.dominio);
      }
      if (orden === "cert") return (a.cert_dias ?? 99999) - (b.cert_dias ?? 99999);
      if (orden === "comprobacion") {
        return (
          new Date(b.ultima_comprobacion ?? 0).getTime() - new Date(a.ultima_comprobacion ?? 0).getTime()
        );
      }
      return a.dominio.localeCompare(b.dominio);
    });

  const lanzarComprobacion = async (dominio: DominioRow) => {
    setComprobandoId(dominio.id);
    try {
      const res = await comprobar.mutateAsync(dominio.id);
      if (!res || res.resultado === "error") {
        toast.error(`${dominio.dominio}: ${res?.error ?? "no responde"}`);
      } else if (res.resultado === "aviso") {
        toast.warning(
          `${dominio.dominio}: aviso · ${res.cert_dias !== null ? `certificado ${res.cert_dias} días` : "revisa el detalle"}`,
        );
      } else {
        toast.success(
          `${dominio.dominio}: conectado · HTTP ${res.http_estado ?? "—"} en ${res.tiempo_ms ?? "—"} ms`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido comprobar.");
    } finally {
      setComprobandoId(null);
    }
  };

  const lanzarTodos = async () => {
    try {
      setEnMarcha(true);
      await comprobarTodos.mutateAsync();
      toast.success("Comprobación en marcha. Verás el progreso aquí mismo.");
    } catch (err) {
      setEnMarcha(false);
      toast.error(err instanceof Error ? err.message : "No se ha podido lanzar la comprobación.");
    }
  };

  const total = Number(resumen?.total ?? dominios.length);
  const comprobados = total - pendientes;

  return (
    <>
      <Encabezado
        titulo="Dominios y certificados"
        descripcion="Estado de tus dominios, sus certificados y su caducidad. Se comprueba solo cada día a las 08:00."
        acciones={
          <>
            <Boton variante="suave" onClick={lanzarTodos} disabled={comprobarTodos.isPending || enMarcha}>
              <RefreshCw className={`size-4 ${enMarcha ? "animate-spin" : ""}`} /> Comprobar todos
            </Boton>
            <Boton onClick={() => setNuevo(true)}>
              <Plus className="size-4" /> Añadir dominio
            </Boton>
          </>
        }
      />

      {enMarcha || pendientes > 0 ? (
        <p className="mb-4 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
          {comprobados} de {total} comprobados…
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metrica titulo="Dominios" valor={String(total)} pie={`${dominios.filter((d) => !d.activo).length} desactivados`} />
        <Metrica titulo="Correctos" valor={String(Number(resumen?.ok ?? 0))} pie="Responden bien" tono="text-success" />
        <Metrica titulo="Avisos" valor={String(Number(resumen?.aviso ?? 0))} pie="Requieren atención" tono="text-warning" />
        <Metrica titulo="Errores" valor={String(Number(resumen?.error ?? 0))} pie="No responden" tono="text-destructive" />
        <Metrica
          titulo="Certificado más próximo"
          valor={resumen?.cert_dias_min !== null && resumen?.cert_dias_min !== undefined ? `${resumen.cert_dias_min} d` : "—"}
          pie="Días hasta caducar"
        />
        <Metrica
          titulo="Dominio más próximo"
          valor={
            resumen?.dominio_dias_min !== null && resumen?.dominio_dias_min !== undefined
              ? `${resumen.dominio_dias_min} d`
              : "—"
          }
          pie={`Última comprobación ${desde(resumen?.ultima_comprobacion)}`}
        />
      </section>

      <div className="panel mt-6 flex flex-wrap items-center gap-3 p-4">
        <label className="flex flex-1 items-center gap-2 text-sm">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar dominio"
            className="w-full min-w-[10rem] bg-transparent text-sm text-foreground outline-none"
          />
        </label>
        <Selector
          etiqueta="Proyecto"
          valor={filtroProyecto}
          onChange={setFiltroProyecto}
          opciones={[
            { valor: "todos", texto: "Todos" },
            ...proyectos.map((p) => ({ valor: p.id, texto: p.nombre })),
          ]}
        />
        <Selector
          etiqueta="Tipo"
          valor={filtroTipo}
          onChange={setFiltroTipo}
          opciones={[
            { valor: "todos", texto: "Todos" },
            ...Object.entries(ETIQUETA_TIPO).map(([valor, txt]) => ({ valor, texto: txt })),
          ]}
        />
        <Selector
          etiqueta="Estado"
          valor={filtroResultado}
          onChange={setFiltroResultado}
          opciones={[
            { valor: "todos", texto: "Todos" },
            ...Object.entries(ETIQUETA_RESULTADO).map(([valor, txt]) => ({ valor, texto: txt })),
          ]}
        />
        <Selector
          etiqueta="Ordenar por"
          valor={orden}
          onChange={(v) => setOrden(v as typeof orden)}
          opciones={[
            { valor: "dominio", texto: "Dominio" },
            { valor: "resultado", texto: "Estado" },
            { valor: "cert", texto: "Certificado" },
            { valor: "comprobacion", texto: "Última comprobación" },
          ]}
        />
      </div>

      <div className="panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[64rem] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Dominio</th>
              <th className="px-4 py-3">Proyecto</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Gestionado por</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">HTTPS</th>
              <th className="px-4 py-3">Certificado</th>
              <th className="px-4 py-3">Dominio</th>
              <th className="px-4 py-3">Comprobado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((d) => (
              <tr key={d.id} className={`border-b border-border/60 ${d.activo ? "" : "opacity-60"}`}>
                <td className="px-4 py-3">
                  <a
                    href={`https://${d.dominio}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary"
                  >
                    {d.dominio} <ExternalLink className="size-3.5 text-muted-foreground" />
                  </a>
                  {d.error ? <p className="mt-1 text-xs text-destructive">{d.error}</p> : null}
                </td>
                <td className="px-4 py-3">
                  {d.proyecto_id ? (
                    <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {nombreProyecto(d.proyecto_id) ?? "Proyecto"}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{ETIQUETA_TIPO[d.tipo]}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{d.gestionado_por ?? "—"}</td>
                <td className="px-4 py-3">
                  <Insignia resultado={d.resultado} pendiente={d.pendiente} />
                </td>
                <td className="px-4 py-3">
                  <span className={colorTiempo(d.tiempo_ms)}>
                    {d.http_estado ?? "—"}
                    {d.tiempo_ms !== null ? ` · ${d.tiempo_ms} ms` : ""}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {d.cert_dias === null ? (
                    <span className="text-muted-foreground">{d.cert_emisor ?? "—"}</span>
                  ) : (
                    <>
                      <span className="block text-muted-foreground">{d.cert_emisor ?? "—"}</span>
                      <span className={colorDias(d.cert_dias, d.aviso_dias)}>caduca en {d.cert_dias} días</span>
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className="block text-muted-foreground">{d.registrador ?? "—"}</span>
                  {d.dominio_dias !== null ? (
                    <span className={colorDias(d.dominio_dias, d.aviso_dias)}>caduca en {d.dominio_dias} días</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground" title={formatoFechaHora(d.ultima_comprobacion)}>
                  {d.ultima_comprobacion ? desde(d.ultima_comprobacion) : "nunca"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => void lanzarComprobacion(d)}
                      disabled={comprobandoId === d.id}
                      title="Comprobar ahora"
                      className="rounded-lg border border-border bg-surface p-2 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                    >
                      <RefreshCw className={`size-3.5 ${comprobandoId === d.id ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditando(d)}
                      title="Editar"
                      className="rounded-lg border border-border bg-surface p-2 text-muted-foreground transition hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistorialId(d.id)}
                      title="Historial"
                      className="rounded-lg border border-border bg-surface p-2 text-muted-foreground transition hover:text-foreground"
                    >
                      <History className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBorrando(d)}
                      title="Borrar"
                      className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-destructive transition hover:bg-destructive/20"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isPending && visibles.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Ningún dominio cumple estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <FormularioDominio
        abierto={nuevo || editando !== null}
        dominio={editando}
        proyectos={proyectos.map((p) => ({ id: p.id, nombre: p.nombre }))}
        onCerrar={() => {
          setNuevo(false);
          setEditando(null);
        }}
        onGuardar={async (datos) => {
          try {
            const id = await guardar.mutateAsync(editando ? { ...datos, id: editando.id } : datos);
            setNuevo(false);
            setEditando(null);
            toast.success("Dominio guardado.");
            if (!editando) {
              const res = await comprobar.mutateAsync(id);
              if (res && res.resultado !== "error") {
                toast.success(`${res.dominio}: conectado · HTTP ${res.http_estado ?? "—"}`);
              } else if (res) {
                toast.error(`${res.dominio}: ${res.error ?? "no responde"}`);
              }
            }
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se ha podido guardar.");
          }
        }}
      />

      <PanelHistorial
        dominio={dominios.find((d) => d.id === historialId) ?? null}
        onCerrar={() => setHistorialId(null)}
      />

      <Dialogo
        abierto={borrando !== null}
        titulo="Borrar dominio"
        descripcion={borrando ? `Se quitará ${borrando.dominio} de la vigilancia.` : undefined}
        ancho="max-w-md"
        onCerrar={() => setBorrando(null)}
      >
        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={() => setBorrando(null)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            onClick={async () => {
              if (!borrando) return;
              try {
                await borrar.mutateAsync(borrando.id);
                toast.success("Dominio borrado.");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "No se ha podido borrar.");
              } finally {
                setBorrando(null);
              }
            }}
          >
            Borrar
          </Boton>
        </div>
      </Dialogo>
    </>
  );
}

function Metrica({ titulo, valor, pie, tono }: { titulo: string; valor: string; pie: string; tono?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${tono ?? ""}`}>{valor}</p>
      <p className="mt-1 text-xs text-muted-foreground">{pie}</p>
    </div>
  );
}

function FormularioDominio({
  abierto,
  dominio,
  proyectos,
  onCerrar,
  onGuardar,
}: {
  abierto: boolean;
  dominio: DominioRow | null;
  proyectos: { id: string; nombre: string }[];
  onCerrar: () => void;
  onGuardar: (datos: {
    dominio: string;
    proyecto_id: string | null;
    tipo: TipoDominio;
    registrador: string | null;
    gestionado_por: string | null;
    aviso_dias: number;
    activo: boolean;
    notas: string | null;
  }) => void | Promise<void>;
}) {
  const [host, setHost] = React.useState("");
  const [proyectoId, setProyectoId] = React.useState("");
  const [tipo, setTipo] = React.useState<TipoDominio>("dominio");
  const [registrador, setRegistrador] = React.useState("");
  const [gestionado, setGestionado] = React.useState("");
  const [avisoDias, setAvisoDias] = React.useState(30);
  const [activo, setActivo] = React.useState(true);
  const [notas, setNotas] = React.useState("");

  React.useEffect(() => {
    if (!abierto) return;
    setHost(dominio?.dominio ?? "");
    setProyectoId(dominio?.proyecto_id ?? "");
    setTipo(dominio?.tipo ?? "dominio");
    setRegistrador(dominio?.registrador ?? "");
    setGestionado(dominio?.gestionado_por ?? "");
    setAvisoDias(dominio?.aviso_dias ?? 30);
    setActivo(dominio?.activo ?? true);
    setNotas(dominio?.notas ?? "");
  }, [abierto, dominio]);

  const valido = hostValido(host);

  return (
    <Dialogo
      abierto={abierto}
      titulo={dominio ? "Editar dominio" : "Añadir dominio"}
      descripcion={
        dominio ? "Cambia los datos de este dominio." : "Al guardar se comprobará automáticamente."
      }
      onCerrar={onCerrar}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo etiqueta="Dominio" pista="Solo el nombre, sin https:// (por ejemplo, almacen.evoluteia.com)">
            <input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              disabled={Boolean(dominio)}
              placeholder="ejemplo.com"
              className={claseCampo}
            />
          </Campo>
          {host && !valido ? (
            <p className="mt-1 text-xs text-destructive">Ese nombre de dominio no parece válido.</p>
          ) : null}
        </div>
        <Campo etiqueta="Proyecto">
          <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={claseCampo}>
            <option value="">Sin proyecto</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDominio)} className={claseCampo}>
            {Object.entries(ETIQUETA_TIPO).map(([valor, txt]) => (
              <option key={valor} value={valor}>
                {txt}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Registrador">
          <input value={registrador} onChange={(e) => setRegistrador(e.target.value)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Gestionado por">
          <input value={gestionado} onChange={(e) => setGestionado(e.target.value)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Avisar con (días)">
          <input
            type="number"
            min={1}
            value={avisoDias}
            onChange={(e) => setAvisoDias(Number(e.target.value) || 30)}
            className={claseCampo}
          />
        </Campo>
        <label className="flex items-center gap-2 self-end text-sm text-muted-foreground">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Vigilar este dominio
        </label>
        <div className="sm:col-span-2">
          <Campo etiqueta="Notas">
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className={claseCampo} />
          </Campo>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Boton variante="suave" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton
          disabled={!valido}
          onClick={() =>
            void onGuardar({
              dominio: host.trim().toLowerCase(),
              proyecto_id: proyectoId || null,
              tipo,
              registrador: registrador.trim() || null,
              gestionado_por: gestionado.trim() || null,
              aviso_dias: avisoDias,
              activo,
              notas: notas.trim() || null,
            })
          }
        >
          Guardar
        </Boton>
      </div>
    </Dialogo>
  );
}

function PanelHistorial({ dominio, onCerrar }: { dominio: DominioRow | null; onCerrar: () => void }) {
  const { data: historial = [] } = useHistorialDominio(dominio?.id ?? null);
  if (!dominio) return null;

  const tiempos = historial.map((h) => h.tiempo_ms ?? 0);
  const maximo = Math.max(1, ...tiempos);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onCerrar}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-background p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">{dominio.dominio}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Últimas 30 comprobaciones</p>
          </div>
          <Boton variante="suave" onClick={onCerrar}>
            Cerrar
          </Boton>
        </div>

        <div className="panel mt-4 p-4">
          <p className="text-xs text-muted-foreground">Tiempo de respuesta</p>
          <div className="mt-3 flex h-24 items-end gap-1">
            {[...historial].reverse().map((h) => (
              <div
                key={h.id}
                title={`${formatoFechaHora(h.comprobado_el)} · ${h.tiempo_ms ?? "—"} ms`}
                style={{ height: `${Math.max(4, ((h.tiempo_ms ?? 0) / maximo) * 100)}%` }}
                className={`flex-1 rounded-sm ${
                  h.resultado === "error"
                    ? "bg-destructive/70"
                    : h.resultado === "aviso"
                      ? "bg-warning/70"
                      : "bg-primary/70"
                }`}
              />
            ))}
            {historial.length === 0 && <p className="text-sm text-muted-foreground">Sin comprobaciones aún.</p>}
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {historial.map((h) => (
            <li key={h.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{formatoFechaHora(h.comprobado_el)}</span>
                <Insignia resultado={h.resultado} pendiente={false} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                HTTP {h.http_estado ?? "—"} · {h.tiempo_ms ?? "—"} ms ·{" "}
                {h.cert_dias !== null ? `certificado ${h.cert_dias} días` : "certificado no aplica"}
              </p>
              {h.error ? <p className="mt-1 text-xs text-destructive">{h.error}</p> : null}
            </li>
          ))}
        </ul>

        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Globe className="size-3.5" /> Caduca el {formatoFecha(dominio.dominio_caduca)} · certificado hasta{" "}
          {formatoFecha(dominio.cert_valido_hasta)}
        </p>
      </aside>
    </div>
  );
}
