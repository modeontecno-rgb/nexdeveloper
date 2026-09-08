import {MemoriaPersonal} from '@/components/nex/memoria-personal';
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Pin,
  PinOff,
  Send,
  Trash2,
  User,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type {
  ModoPersonal,
  ModoReescritura,
  NotasTutor,
  PersonalDocumentoRow,
  PersonalMensajeRow,
} from "@/lib/nex/db-types";
import { desde, formatoEuros, marcaTiempo } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import { markdownAHtml } from "@/lib/nex/queries/resumenes";
import { AvisoSinDictado, useDictado } from "@/components/nex/dictado";
import {
  ETIQUETA_MODO_PERSONAL,
  ETIQUETA_MODO_REESCRITURA,
  useAccionConversacionPersonal,
  useBorrarDocumentoPersonal,
  useConfigurarPersonal,
  useConversacionesPersonal,
  useCrearDocumentoPersonal,
  useDocumentosPersonal,
  useEnlaceDocumentoPersonal,
  useEstadoPersonal,
  useGuardarMuestrasEstilo,
  useGuiaEstiloProyecto,
  useMensajesPersonal,
  useNuevaConversacionPersonal,
  usePreguntarPersonal,
  useRealtimePersonal,
  useReescribir,
  useReescrituras,
} from "@/lib/nex/queries/personal";
import { cn } from "@/lib/utils";

type Pestana = "chat" | "documentos" | "estilo" | "config";

export const Route = createFileRoute("/personal")({
  validateSearch: (busqueda: Record<string, unknown>): { conversacion?: string; tab?: Pestana } => ({
    ...(typeof busqueda["conversacion"] === "string" ? { conversacion: busqueda["conversacion"] } : {}),
    ...(typeof busqueda["tab"] === "string" ? { tab: busqueda["tab"] as Pestana } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Personal · NexDeveloper" },
      {
        name: "description",
        content: "Tu espacio personal, fuera de los proyectos: varias IA a la vez, documentos propios y estilo propio.",
      },
      { property: "og:title", content: "Personal · NexDeveloper" },
      {
        property: "og:description",
        content: "Tu espacio personal, fuera de los proyectos: varias IA a la vez, documentos propios y estilo propio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonalPantalla,
});

function PersonalPantalla() {
  const busqueda = Route.useSearch();
  const [pestana, setPestana] = React.useState<Pestana>(busqueda.tab ?? "chat");
  useRealtimePersonal(true);

  return (
    <>
      <Encabezado
        titulo="Personal · fuera de los proyectos"
        descripcion="Aquí pregunto a varias IA a la vez y me quedo con lo mejor de cada una. Nada de esto se mezcla con tus proyectos."
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["chat", "Conversaciones"],
            ["documentos", "Documentos"],
            ["estilo", "Editor de estilo"],
            ["config", "Configuración"],
          ] as const
        ).map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            aria-pressed={pestana === clave}
            onClick={() => setPestana(clave)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition",
              pestana === clave
                ? "bg-accent text-accent-foreground"
                : "border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {pestana === "chat" ? <PanelChat conversacionInicial={busqueda.conversacion ?? null} /> : null}
        {pestana === "documentos" ? <PanelDocumentos /> : null}
        {pestana === "estilo" ? <PanelEstilo /> : null}
        {pestana === "config" ? <PanelConfiguracion /> : null}
      </div>
    </>
  );
}

/* ---------------------------------- Chat ---------------------------------- */

function PanelChat({ conversacionInicial }: { conversacionInicial: string | null }) {
  const { data: conversaciones = [] } = useConversacionesPersonal();
  const [conversacionId, setConversacionId] = React.useState<string | null>(conversacionInicial);
  const { data: mensajes = [] } = useMensajesPersonal(conversacionId);
  const preguntar = usePreguntarPersonal();
  const nueva = useNuevaConversacionPersonal();
  const accion = useAccionConversacionPersonal();
  const estado = useEstadoPersonal();
  const [texto, setTexto] = React.useState("");
  const [busqueda, setBusqueda] = React.useState("");
  const [creandoDoc, setCreandoDoc] = React.useState(false);
  const finRef = React.useRef<HTMLDivElement | null>(null);
  const { escuchando, alternar, lienzoOnda, parcial, avisoNavegador, ocultarAviso } = useDictado((d) => setTexto((t) => (t ? `${t} ${d}` : d)));

  const numIa = Math.max(1, Number(estado.data?.config?.max_proveedores ?? estado.data?.proveedores?.length ?? 1));

  React.useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes.length, preguntar.isPending]);

  const visibles = conversaciones.filter(
    (c) => !c.archivada && (c.titulo ?? "").toLowerCase().includes(busqueda.toLowerCase()),
  );

  const enviar = () => {
    const limpio = texto.trim();
    if (!limpio || preguntar.isPending) return;
    setTexto("");
    preguntar.mutate(
      { texto: limpio, ...(conversacionId ? { conversacionId } : {}) },
      { onSuccess: (r) => r.conversacion_id && setConversacionId(r.conversacion_id) },
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <aside className="panel h-fit p-3">
        <Boton
          className="w-full"
          onClick={() => nueva.mutate(undefined, { onSuccess: (r) => r.conversacion?.id && setConversacionId(r.conversacion.id) })}
        >
          <User className="size-4" /> Nueva conversación
        </Boton>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar…"
          className={cn(claseCampo, "mt-3")}
        />
        <ul className="mt-3 space-y-1">
          {visibles.map((c) => (
            <li key={c.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => setConversacionId(c.id)}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-lg px-2.5 py-2 text-left text-sm transition",
                  conversacionId === c.id ? "bg-accent/20 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c.fijada ? "📌 " : ""}
                {c.titulo ?? "Sin título"}
              </button>
              <button
                type="button"
                aria-label={c.fijada ? "Dejar de fijar" : "Fijar"}
                onClick={() => accion.mutate({ accion: "fijar", conversacion_id: c.id, fijada: !c.fijada })}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                {c.fijada ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
              </button>
              <button
                type="button"
                aria-label="Renombrar"
                onClick={() => {
                  const titulo = window.prompt("Nuevo nombre", c.titulo ?? "");
                  if (titulo) accion.mutate({ accion: "renombrar", conversacion_id: c.id, titulo });
                }}
                className="p-1 text-xs text-muted-foreground hover:text-foreground"
              >
                ✎
              </button>
              <button
                type="button"
                aria-label="Borrar"
                onClick={() => {
                  if (window.confirm("¿Borrar esta conversación?")) {
                    accion.mutate({ accion: "borrar", conversacion_id: c.id });
                    if (conversacionId === c.id) setConversacionId(null);
                  }
                }}
                className="p-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
          {visibles.length === 0 ? <li className="px-2 py-3 text-sm text-muted-foreground">Sin conversaciones.</li> : null}
        </ul>
      </aside>

      <section className="panel flex min-h-[28rem] flex-col p-4">
        <div className="flex-1 space-y-4 overflow-y-auto">
          {mensajes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Pregúntame lo que quieras. Consultaré a varias IA a la vez y te daré la mejor respuesta.
            </p>
          ) : (
            mensajes.map((m) => <MensajePersonal key={m.id} mensaje={m} />)
          )}
          {preguntar.isPending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Preguntando a {numIa} IA…
            </p>
          ) : null}
          <div ref={finRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          className="mt-4 border-t border-border pt-4"
        >
          {escuchando && <canvas ref={lienzoOnda} aria-label="Onda del micrófono en directo" className="h-12 w-full text-primary" />}
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder="Escribe o dicta lo que quieras preguntar…"
            className={cn(claseCampo, "resize-y")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                enviar();
              }
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Boton type="submit" disabled={!texto.trim() || preguntar.isPending}>
              {preguntar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Preguntar
            </Boton>
            <Boton type="button" variante="suave" onClick={alternar} aria-pressed={escuchando}>
              {escuchando ? <MicOff className="size-4" /> : <Mic className="size-4" />} {escuchando ? "Parar" : "Dictar"}
            </Boton>
            {parcial ? <span className="text-xs italic text-muted-foreground">{parcial}</span> : null}
            {avisoNavegador ? <AvisoSinDictado onCerrar={ocultarAviso} /> : null}
            <Boton type="button" variante="suave" onClick={() => setCreandoDoc(true)} disabled={!conversacionId}>
              <FileText className="size-4" /> Crear documento de esta conversación
            </Boton>
          </div>
        </form>
      </section>

      <DialogoNuevoDocumento
        abierto={creandoDoc}
        conversacionId={conversacionId}
        onCerrar={() => setCreandoDoc(false)}
      />
    </div>
  );
}

function MensajePersonal({ mensaje }: { mensaje: PersonalMensajeRow }) {
  const esUsuario = mensaje.rol === "usuario";
  const respuestas = mensaje.respuestas ?? [];
  return (
    <div className={cn("rounded-xl border p-3", esUsuario ? "border-border bg-surface" : "border-accent/30 bg-accent/5")}>
      <p className="text-xs text-muted-foreground">
        {esUsuario ? "Tú" : "Personal"} · {marcaTiempo(mensaje.fecha)}
      </p>
      {esUsuario ? (
        <p className="mt-2 whitespace-pre-wrap text-sm">{mensaje.texto}</p>
      ) : (
        <div className="prose-nex mt-2 text-sm" dangerouslySetInnerHTML={{ __html: markdownAHtml(mensaje.texto ?? "") }} />
      )}

      {!esUsuario && respuestas.length ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {respuestas.map((r, i) => (
              <span
                key={`${r.proveedor}-${i}`}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs",
                  r.error
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                {r.nombre ?? r.proveedor}
                {r.ms ? ` · ${Math.round(Number(r.ms) / 100) / 10}s` : ""}
                {r.coste ? ` · ${formatoEuros(Number(r.coste))}` : ""}
              </span>
            ))}
            {mensaje.juez ? <span className="text-xs text-muted-foreground">fusionado por {mensaje.juez}</span> : null}
            {mensaje.coste ? (
              <span className="text-xs text-muted-foreground">total {formatoEuros(Number(mensaje.coste))}</span>
            ) : null}
          </div>
          <details className="rounded-lg border border-border p-2">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              <ChevronDown className="mr-1 inline size-3" /> Ver cada respuesta por separado
            </summary>
            <div className="mt-2 space-y-3">
              {respuestas.map((r, i) => (
                <div key={`det-${r.proveedor}-${i}`}>
                  <p className="text-xs font-medium">{r.nombre ?? r.proveedor} · {r.modelo ?? ""}</p>
                  {r.error ? (
                    <p className="text-sm text-destructive">{r.error}</p>
                  ) : (
                    <div
                      className="prose-nex text-sm"
                      dangerouslySetInnerHTML={{ __html: markdownAHtml(r.texto ?? "") }}
                    />
                  )}
                </div>
              ))}
            </div>
          </details>
          {mensaje.discrepancias ? (
            <details className="rounded-lg border border-warning/40 bg-warning/5 p-2">
              <summary className="cursor-pointer text-xs text-warning">Dónde no coinciden</summary>
              <div
                className="prose-nex mt-2 text-sm"
                dangerouslySetInnerHTML={{ __html: markdownAHtml(mensaje.discrepancias) }}
              />
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------- Documentos ------------------------------- */

function DialogoNuevoDocumento({
  abierto,
  conversacionId,
  onCerrar,
}: {
  abierto: boolean;
  conversacionId: string | null;
  onCerrar: () => void;
}) {
  const crear = useCrearDocumentoPersonal();
  const [titulo, setTitulo] = React.useState("");
  const [tipo, setTipo] = React.useState("informe");
  const [indicaciones, setIndicaciones] = React.useState("");

  return (
    <Dialogo
      abierto={abierto}
      titulo="Crear documento"
      descripcion="Lo redacto a partir de la conversación y lo guardo en la carpeta PERSONAL."
      onCerrar={onCerrar}
    >
      <div className="space-y-4">
        <Campo etiqueta="Título">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={claseCampo}>
            <option value="informe">Informe</option>
            <option value="resumen">Resumen</option>
            <option value="carta">Carta</option>
            <option value="lista">Lista</option>
          </select>
        </Campo>
        <Campo etiqueta="Indicaciones" pista="Opcional: qué quieres destacar o el tono.">
          <textarea value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} rows={3} className={claseCampo} />
        </Campo>
        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            onClick={() =>
              crear.mutate(
                {
                  ...(conversacionId ? { conversacionId } : {}),
                  ...(titulo ? { titulo } : {}),
                  tipo,
                  ...(indicaciones ? { indicaciones } : {}),
                },
                { onSuccess: onCerrar },
              )
            }
            disabled={crear.isPending}
          >
            {crear.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Crear documento
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

function PanelDocumentos() {
  const { data: documentos = [] } = useDocumentosPersonal();
  const [verId, setVerId] = React.useState<string | null>(null);

  if (documentos.length === 0) {
    return <p className="panel p-6 text-sm text-muted-foreground">Todavía no hay documentos personales.</p>;
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {documentos.map((d) => (
          <TarjetaDocumento key={d.id} documento={d} onVer={() => setVerId(d.id)} />
        ))}
      </div>
      <DialogoVerDocumento
        documento={documentos.find((d) => d.id === verId) ?? null}
        onCerrar={() => setVerId(null)}
      />
    </>
  );
}

function TarjetaDocumento({ documento, onVer }: { documento: PersonalDocumentoRow; onVer: () => void }) {
  const enlace = useEnlaceDocumentoPersonal();
  const borrar = useBorrarDocumentoPersonal();
  const nombreArchivo = `${(documento.titulo ?? "documento").replace(/[^\w\sáéíóúñ-]/gi, "").trim()}.pdf`;

  return (
    <article className="panel p-4">
      <h3 className="font-display text-sm font-semibold">{documento.titulo ?? "Documento"}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {documento.tipo ?? "documento"} · {desde(documento.creado_el)}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">Guardar en el Mac: PERSONAL/{nombreArchivo}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Boton variante="suave" className="px-2.5 py-1 text-xs" onClick={onVer}>
          Ver
        </Boton>
        <Boton
          variante="suave"
          className="px-2.5 py-1 text-xs"
          onClick={() => {
            const ventana = window.open("", "_blank");
            if (!ventana) return;
            ventana.document.write(documento.html ?? markdownAHtml(documento.contenido_md ?? ""));
            ventana.document.close();
            ventana.print();
          }}
        >
          Descargar PDF
        </Boton>
        <Boton
          variante="suave"
          className="px-2.5 py-1 text-xs"
          onClick={() =>
            enlace.mutate(documento.id, {
              onSuccess: (r) => {
                if (r.url) window.open(r.url, "_blank");
                else toast.error("Este documento no tiene enlace en el almacén.");
              },
            })
          }
        >
          Enlace del almacén
        </Boton>
        <Boton
          variante="peligro"
          className="px-2.5 py-1 text-xs"
          onClick={() => borrar.mutate(documento.id)}
          disabled={borrar.isPending}
        >
          Borrar
        </Boton>
      </div>
    </article>
  );
}

function DialogoVerDocumento({ documento, onCerrar }: { documento: PersonalDocumentoRow | null; onCerrar: () => void }) {
  return (
    <Dialogo abierto={Boolean(documento)} titulo={documento?.titulo ?? "Documento"} onCerrar={onCerrar} ancho="max-w-4xl">
      <iframe
        title={documento?.titulo ?? "Documento"}
        srcDoc={documento?.html ?? markdownAHtml(documento?.contenido_md ?? "")}
        className="h-[70vh] w-full rounded-lg border border-border bg-white"
      />
    </Dialogo>
  );
}

/* ----------------------------- Editor de estilo --------------------------- */

function PanelEstilo() {
  const estado = useEstadoPersonal();
  const guardarMuestras = useGuardarMuestrasEstilo();
  const reescribir = useReescribir();
  const { data: historico = [] } = useReescrituras();
  const { data: proyectos = [] } = useProyectos();

  const [muestras, setMuestras] = React.useState<string[]>(["", "", ""]);
  const [perfil, setPerfil] = React.useState("");
  const [texto, setTexto] = React.useState("");
  const [modo, setModo] = React.useState<ModoReescritura>("desactivado");
  const [proyectoId, setProyectoId] = React.useState("");
  const [tono, setTono] = React.useState("");

  React.useEffect(() => {
    const config = estado.data?.config;
    if (!config) return;
    setPerfil(config.perfil_estilo ?? "");
    if (config.muestras_estilo?.length) setMuestras(config.muestras_estilo);
  }, [estado.data?.config]);

  const resultado = reescribir.data;
  const notas = resultado?.notas as NotasTutor | undefined;

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <h2 className="font-display text-sm font-semibold">Mi voz</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pega entre 3 y 6 textos escritos por ti. Aprenderé cómo escribes para poder imitarlo.
        </p>
        <div className="mt-3 space-y-3">
          {muestras.map((m, i) => (
            <textarea
              key={`muestra-${i}`}
              value={m}
              onChange={(e) => setMuestras((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
              rows={3}
              placeholder={`Texto ${i + 1}`}
              className={claseCampo}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {muestras.length < 6 ? (
            <Boton variante="suave" onClick={() => setMuestras((p) => [...p, ""])}>
              Añadir otro texto
            </Boton>
          ) : null}
          <Boton
            onClick={() => {
              const limpias = muestras.map((m) => m.trim()).filter(Boolean);
              if (limpias.length < 3) {
                toast.error("Necesito al menos 3 textos tuyos.");
                return;
              }
              guardarMuestras.mutate(limpias, { onSuccess: (r) => r.perfil_estilo && setPerfil(r.perfil_estilo) });
            }}
            disabled={guardarMuestras.isPending}
          >
            {guardarMuestras.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Aprender mi estilo
          </Boton>
        </div>
        <Campo etiqueta="Perfil aprendido" pista="Puedes retocarlo a mano si quieres afinarlo.">
          <textarea value={perfil} onChange={(e) => setPerfil(e.target.value)} rows={5} className={claseCampo} />
        </Campo>
      </section>

      <section className="panel p-4">
        <h2 className="font-display text-sm font-semibold">Reescribir</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={12}
              placeholder="Pega aquí tu texto…"
              className={claseCampo}
            />
            <Campo etiqueta="Modo">
              <select value={modo} onChange={(e) => setModo(e.target.value as ModoReescritura)} className={claseCampo}>
                {Object.entries(ETIQUETA_MODO_REESCRITURA).map(([valor, t]) => (
                  <option key={valor} value={valor}>
                    {t}
                  </option>
                ))}
              </select>
            </Campo>
            {modo === "marca" ? (
              <Campo etiqueta="Proyecto">
                <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={claseCampo}>
                  <option value="">Elige un proyecto</option>
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            ) : null}
            <Campo etiqueta="Tono" pista="Opcional: cercano, formal, directo…">
              <input value={tono} onChange={(e) => setTono(e.target.value)} className={claseCampo} />
            </Campo>
            <Boton
              onClick={() =>
                reescribir.mutate({
                  texto,
                  modo,
                  ...(modo === "marca" && proyectoId ? { proyectoId } : {}),
                  ...(tono ? { tono } : {}),
                })
              }
              disabled={!texto.trim() || reescribir.isPending || (modo === "marca" && !proyectoId)}
            >
              {reescribir.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {modo === "desactivado" ? "Conservar original" : modo === "tutor" ? "Ayúdame a mejorarlo" : "Reescribir"}
            </Boton>
            {modo === "tutor" ? (
              <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
                El tutor NO escribe el texto por ti: te dice qué mejorar para que lo escribas tú.
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-surface p-3">
            {reescribir.isPending ? (
              <p className="text-sm text-muted-foreground">Trabajando…</p>
            ) : notas ? (
              <div className="space-y-3 text-sm">
                {notas.valoracion ? <p>{notas.valoracion}</p> : null}
                <ListaSimple titulo="Esquema sugerido" elementos={notas.esquema_sugerido} />
                {notas.correcciones?.length ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Correcciones</p>
                    <ul className="mt-1 space-y-2">
                      {notas.correcciones.map((c, i) => (
                        <li key={`corr-${i}`} className="rounded-lg border border-border p-2">
                          <p className="text-xs italic text-muted-foreground">«{c.fragmento}»</p>
                          <p className="text-sm">{c.problema}</p>
                          <p className="text-sm text-success">{c.sugerencia}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <ListaSimple titulo="Preguntas para profundizar" elementos={notas.preguntas_para_profundizar} />
                <ListaSimple titulo="Fuentes sugeridas" elementos={notas.fuentes_sugeridas} />
                {notas.siguiente_paso ? (
                  <p className="rounded-lg border border-primary/40 bg-primary/10 p-2 text-sm text-primary">
                    Siguiente paso: {notas.siguiente_paso}
                  </p>
                ) : null}
              </div>
            ) : resultado?.texto_resultado ? (
              <div className="space-y-3">
                <p className="whitespace-pre-wrap text-sm">{resultado.texto_resultado}</p>
                <p className="text-xs text-muted-foreground">Revisa el sentido y los hechos. Este editor no garantiza resultados frente a detectores de IA. El original permanece en el editor.</p>
                <Boton variante="suave" onClick={()=>reescribir.reset()}>Volver al original</Boton>
                <Boton
                  variante="suave"
                  className="px-2.5 py-1 text-xs"
                  onClick={() => {
                    void navigator.clipboard.writeText(resultado.texto_resultado ?? "");
                    toast.success("Copiado.");
                  }}
                >
                  Copiar
                </Boton>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aquí verás el resultado.</p>
            )}
          </div>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="font-display text-sm font-semibold">Histórico</h2>
        {historico.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Todavía no has reescrito nada.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {historico.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {ETIQUETA_MODO_REESCRITURA[r.modo]} · {desde(r.creado_el)}
                </p>
                <p className="mt-1 line-clamp-2 text-muted-foreground">{r.texto_original}</p>
                {r.texto_resultado ? <p className="mt-1 line-clamp-2">{r.texto_resultado}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ListaSimple({ titulo, elementos }: { titulo: string; elementos?: string[] | undefined }) {
  if (!elementos?.length) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {elementos.map((t, i) => (
          <li key={`${titulo}-${i}`}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------- Configuración ------------------------------ */

function PanelConfiguracion() {
  const estado = useEstadoPersonal();
  const configurar = useConfigurarPersonal();
  const disponibles = estado.data?.proveedores ?? [];

  const [proveedores, setProveedores] = React.useState<string[]>([]);
  const [maximo, setMaximo] = React.useState(3);
  const [juez, setJuez] = React.useState("");
  const [modo, setModo] = React.useState<ModoPersonal>("rapido");
  const [guardar, setGuardar] = React.useState(true);
  const [carpetaAlmacen, setCarpetaAlmacen] = React.useState("PERSONAL");
  const [carpetaMac, setCarpetaMac] = React.useState("PERSONAL");
  const [instrucciones, setInstrucciones] = React.useState("");

  React.useEffect(() => {
    const c = estado.data?.config;
    if (!c) return;
    setProveedores(c.proveedores ?? []);
    setMaximo(Number(c.max_proveedores ?? 3));
    setJuez(c.juez ?? "");
    setModo(c.modo ?? "rapido");
    setGuardar(Boolean(c.guardar_en_almacen));
    setCarpetaAlmacen(c.carpeta_almacen ?? "PERSONAL");
    setCarpetaMac(c.carpeta_mac ?? "PERSONAL");
    setInstrucciones(c.instrucciones ?? "");
  }, [estado.data?.config]);

  return (
    <div className="panel max-w-3xl space-y-4 p-4">
      <Campo etiqueta="IA a consultar" pista="Marca las que quieras que respondan a la vez.">
        <div className="flex flex-wrap gap-2">
          {disponibles.map((p) => {
            const activo = proveedores.includes(p.slug);
            return (
              <button
                key={p.slug}
                type="button"
                aria-pressed={activo}
                onClick={() =>
                  setProveedores((prev) => (activo ? prev.filter((s) => s !== p.slug) : [...prev, p.slug]))
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition",
                  activo ? "border-accent/50 bg-accent/15 text-foreground" : "border-border text-muted-foreground",
                )}
              >
                {p.nombre ?? p.slug} {p.modelo ? `· ${p.modelo}` : ""}
              </button>
            );
          })}
          {disponibles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay proveedores de IA configurados todavía.</p>
          ) : null}
        </div>
      </Campo>

      <Campo etiqueta="Máximo de IA por pregunta" pista="Cuantas más, mejor respuesta pero más coste.">
        <input
          type="number"
          min={1}
          max={6}
          value={maximo}
          onChange={(e) => setMaximo(Number(e.target.value) || 1)}
          className={claseCampo}
        />
      </Campo>

      <Campo etiqueta="Juez" pista="La IA que compara las respuestas y se queda con lo mejor de cada una.">
        <select value={juez} onChange={(e) => setJuez(e.target.value)} className={claseCampo}>
          <option value="">Automático</option>
          {disponibles.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.nombre ?? p.slug}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Modo">
        <select value={modo} onChange={(e) => setModo(e.target.value as ModoPersonal)} className={claseCampo}>
          {Object.entries(ETIQUETA_MODO_PERSONAL).map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      </Campo>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} />
        Guardar los documentos en el almacén
      </label>

      <Campo etiqueta="Carpeta del almacén">
        <input value={carpetaAlmacen} onChange={(e) => setCarpetaAlmacen(e.target.value)} className={claseCampo} />
      </Campo>
      <Campo etiqueta="Carpeta del Mac">
        <input value={carpetaMac} onChange={(e) => setCarpetaMac(e.target.value)} className={claseCampo} />
      </Campo>
      <Campo etiqueta="Instrucciones de tono" pista="Cómo quieres que te hable en el apartado personal.">
        <textarea value={instrucciones} onChange={(e) => setInstrucciones(e.target.value)} rows={4} className={claseCampo} />
        <MemoriaPersonal/>
      </Campo>

      <Boton
        onClick={() =>
          configurar.mutate({
            proveedores,
            max_proveedores: maximo,
            juez,
            modo,
            guardar_en_almacen: guardar,
            carpeta_almacen: carpetaAlmacen,
            carpeta_mac: carpetaMac,
            instrucciones,
          })
        }
        disabled={configurar.isPending}
      >
        {configurar.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Guardar configuración
      </Boton>
    </div>
  );
}

/* --------------------------- Piezas reutilizables ------------------------- */

/** Campo de guía de estilo para la ficha del proyecto. */
export function CampoGuiaEstiloProyecto({ proyectoId, valor }: { proyectoId: string; valor: string | null }) {
  const guardar = useGuiaEstiloProyecto();
  const [texto, setTexto] = React.useState(valor ?? "");

  React.useEffect(() => setTexto(valor ?? ""), [valor]);

  return (
    <div className="panel p-4">
      <h3 className="font-display text-sm font-semibold">Guía de estilo para textos del cliente</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Cómo se escribe para este cliente: tono, tratamiento, palabras que sí y que no.
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={6}
        className={cn(claseCampo, "mt-3")}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Boton onClick={() => guardar.mutate({ proyectoId, guiaEstilo: texto })} disabled={guardar.isPending}>
          Guardar
        </Boton>
        <Boton
          variante="suave"
          onClick={() =>
            guardar.mutate(
              { proyectoId, indicaciones: texto },
              { onSuccess: (r) => r.guia_estilo && setTexto(r.guia_estilo) },
            )
          }
          disabled={guardar.isPending}
        >
          {guardar.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Generar con IA
        </Boton>
      </div>
    </div>
  );
}

