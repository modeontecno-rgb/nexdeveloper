import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Copy, ExternalLink, MonitorPlay, Send } from "lucide-react";
import * as React from "react";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando, EstadoProyectoBadge, PrioridadBadge } from "@/components/nex/badges";
import { SemaforoBadge } from "@/components/nex/semaforo";
import { Boton, claseCampo } from "@/components/nex/campos";
import { PanelAcciones } from "@/components/nex/panel-acciones";
import { PanelPreview } from "@/components/nex/panel-preview";
import { PlanTrabajo } from "@/components/nex/plan-trabajo";
import { BandaGeneracion } from "@/components/nex/banda-generacion";
import { SelectorExperto } from "@/components/nex/selector-experto";
import { TareasEnBloques } from "@/components/nex/tareas-bloques";
import {
  ETIQUETA_ENTORNO,
  ETIQUETA_TIPO_ACTIVIDAD,
  formatoDinero,
  formatoFechaHora,
  marcaHora,
  marcaTiempo,
  mismoDia,
} from "@/lib/nex/labels";
import {
  useActividad,
  useAgentes,
  useAjustes,
  useChats,
  useMensajes,
  usePreviews,
  useProyectos,
  useResumenProyectos,
  useTareas,
  useTareasAtencion,
} from "@/lib/nex/queries/datos";
import { useAsignarExperto } from "@/lib/nex/queries/expertos";
import { useEnviarMensaje } from "@/lib/nex/queries/mutaciones";

export const Route = createFileRoute("/proyectos/$proyectoId")({
  head: () => ({
    meta: [
      { title: "Proyecto · NexDeveloper" },
      { name: "description", content: "Chat, plan de trabajo, costes y vistas previas de un proyecto." },
      { property: "og:title", content: "Proyecto · NexDeveloper" },
      { property: "og:description", content: "Chat, plan de trabajo, costes y vistas previas de un proyecto." },
    ],
  }),
  component: DetalleProyecto,
});

function DetalleProyecto() {
  const { proyectoId } = Route.useParams();
  const { data: proyectos = [], isPending } = useProyectos();
  const { data: tareas = [] } = useTareas();
  const { data: agentes = [] } = useAgentes();
  const { data: chats = [] } = useChats();
  const { data: previews = [] } = usePreviews();
  const { data: resumenes = [] } = useResumenProyectos();
  const { data: actividad = [] } = useActividad(proyectoId);
  const { data: tareasAtencion = [] } = useTareasAtencion(proyectoId);
  const { data: ajustes } = useAjustes();
  const moneda = ajustes?.moneda ?? "EUR";

  const proyecto = proyectos.find((p) => p.id === proyectoId);
  const asignarExperto = useAsignarExperto("chats");
  const chat = chats.find((c) => c.proyecto_id === proyectoId && c.es_principal) ?? chats.find((c) => c.proyecto_id === proyectoId);
  const { data: mensajes = [] } = useMensajes(chat?.id);
  const enviar = useEnviarMensaje();
  const [texto, setTexto] = React.useState("");
  const [previewAbierta, setPreviewAbierta] = React.useState<string | null>(null);

  const tareasProyecto = tareas.filter((t) => t.proyecto_id === proyectoId);
  const resumen = resumenes.find((r) => r.proyecto_id === proyectoId);
  const previewsProyecto = previews.filter((p) => p.proyecto_id === proyectoId);

  if (isPending) return <Cargando />;
  if (!proyecto) {
    return (
      <div className="panel p-6 text-sm text-muted-foreground">
        Este proyecto ya no existe.{" "}
        <Link to="/proyectos" className="text-primary underline">
          Volver a proyectos
        </Link>
        .
      </div>
    );
  }

  const copiarConversacion = () => {
    const texto = mensajes
      .map((m) => `[${marcaTiempo(m.fecha)}] ${m.autor === "usuario" ? "Yo" : "IA"}: ${m.texto}`)
      .join("\n");
    void navigator.clipboard?.writeText(texto);
  };

  const mandar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chat || !texto.trim()) return;
    enviar.mutate({ chatId: chat.id, proyectoId, texto: texto.trim() });
    setTexto("");
  };

  return (
    <>
      <Link to="/proyectos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Proyectos
      </Link>

      <Encabezado
        titulo={proyecto.nombre}
        {...(proyecto.descripcion ? { descripcion: proyecto.descripcion } : {})}
        acciones={
          <div className="flex items-center gap-2">
            <SemaforoBadge semaforo={proyecto.semaforo_calidad ?? "sin_datos"} />
            <EstadoProyectoBadge estado={proyecto.estado} />
            <PrioridadBadge prioridad={proyecto.prioridad} />
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-4">
        <Dato titulo="Tareas" valor={`${Number(resumen?.completadas ?? 0)}/${Number(resumen?.total_tareas ?? 0)}`} />
        <Dato titulo="Esfuerzo restante" valor={`${Number(resumen?.esfuerzo_restante ?? 0).toFixed(1)} h`} />
        <Dato titulo="Coste estimado" valor={formatoDinero(Number(resumen?.coste_estimado ?? 0), moneda)} />
        <Dato titulo="Consumido" valor={formatoDinero(Number(resumen?.coste_consumido ?? 0), moneda)} />
      </section>

      <div className="mt-6">
        <TareasEnBloques tareas={tareasAtencion} />
      </div>

      <div className="mt-6">
        <PlanTrabajo tareas={tareasProyecto} agentes={agentes} moneda={moneda} />
      </div>

      <div className="mt-6">
        <PanelAcciones proyectoId={proyectoId} />
      </div>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="panel flex max-h-[34rem] flex-col">
          <div className="space-y-2 border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold">Conversación del proyecto</h2>
              <button
                type="button"
                onClick={copiarConversacion}
                disabled={mensajes.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
              >
                <Copy className="size-3.5" /> Copiar conversación
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Experto</span>
              <SelectorExperto
                valor={chat?.experto_id}
                onChange={(expertoId) => chat && asignarExperto.mutate({ id: chat.id, expertoId })}
                className="max-w-[16rem]"
              />
            </div>
            <BandaGeneracion
              proveedorId={chat?.proveedor_id}
              modeloId={chat?.modelo_id}
              expertoId={chat?.experto_id}
              chatId={chat?.id}
              moneda={moneda}
            />
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {mensajes.map((m, i) => {
              const previo = i > 0 ? mensajes[i - 1] : undefined;
              const soloHora = mismoDia(previo?.fecha, m.fecha);
              return (
                <div
                  key={m.id}
                  className={
                    m.autor === "usuario"
                      ? "ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-primary/15 px-3 py-2 text-sm"
                      : "max-w-[85%] rounded-xl rounded-bl-sm border border-border bg-surface px-3 py-2 text-sm"
                  }
                >
                  <p className="whitespace-pre-wrap text-foreground">{m.texto}</p>
                  <time
                    dateTime={m.fecha}
                    title={marcaTiempo(m.fecha)}
                    className="mt-1 block text-[11px] text-muted-foreground"
                  >
                    {soloHora ? marcaHora(m.fecha) : marcaTiempo(m.fecha)}
                  </time>
                </div>
              );
            })}
            {mensajes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aún no hay mensajes. Escribe aquí para dejar contexto permanente del proyecto.
              </p>
            )}
          </div>
          <form onSubmit={mandar} className="flex gap-2 border-t border-border p-3">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={chat ? "Escribe un mensaje" : "Este proyecto no tiene conversación"}
              disabled={!chat}
              className={claseCampo}
            />
            <Boton type="submit" disabled={!chat || !texto.trim()}>
              <Send className="size-4" />
            </Boton>
          </form>
        </div>

        <aside className="space-y-4">
          <div className="panel p-4">
            <h2 className="font-display text-sm font-semibold">Vistas previas</h2>
            <ul className="mt-3 space-y-2">
              {previewsProyecto.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewAbierta(p.id)}
                    className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm transition hover:border-primary/40"
                  >
                    <span>
                      {p.titulo}
                      <span className="ml-2 text-xs text-muted-foreground">{ETIQUETA_ENTORNO[p.entorno]}</span>
                    </span>
                    <MonitorPlay className="size-3.5 text-muted-foreground" />
                  </button>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Abrir ${p.titulo} en una pestaña nueva`}
                    className="rounded-lg border border-border bg-surface p-2 text-muted-foreground transition hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </li>
              ))}
              {previewsProyecto.length === 0 && (
                <li className="text-sm text-muted-foreground">Sin vistas previas publicadas.</li>
              )}
            </ul>
          </div>

          <div className="panel p-4">
            <h2 className="font-display text-sm font-semibold">Línea temporal</h2>
            <ol className="mt-3 space-y-3 border-l border-border pl-4">
              {actividad.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[1.32rem] top-1.5 size-2 rounded-full bg-primary" />
                  <p className="text-sm text-foreground">{a.texto}</p>
                  <p className="text-xs text-muted-foreground">
                    {ETIQUETA_TIPO_ACTIVIDAD[a.tipo]} · {formatoFechaHora(a.fecha)}
                  </p>
                </li>
              ))}
              {actividad.length === 0 && <li className="text-sm text-muted-foreground">Sin actividad registrada.</li>}
            </ol>
          </div>
        </aside>
      </section>

      {previewAbierta ? (
        (() => {
          const activa = previewsProyecto.find((p) => p.id === previewAbierta);
          return activa ? <PanelPreview preview={activa} onCerrar={() => setPreviewAbierta(null)} /> : null;
        })()
      ) : null}
    </>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 font-display text-xl font-semibold">{valor}</p>
    </div>
  );
}
