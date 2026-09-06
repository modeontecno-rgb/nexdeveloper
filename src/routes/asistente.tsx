import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  Loader2,
  MessageSquarePlus,
  Mic,
  MicOff,
  Pin,
  PinOff,
  Search,
  Send,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, claseCampo } from "@/components/nex/campos";
import type { AccionAsistente, AsistenteConversacionRow, AsistenteMensajeRow } from "@/lib/nex/db-types";
import { desde, formatoEuros, marcaTiempo } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import { markdownAHtml } from "@/lib/nex/queries/resumenes";
import {
  acciones as leerAcciones,
  herramientas as leerHerramientas,
  useBorrarConversacion,
  useConversaciones,
  useEstadoAsistente,
  useMensajesAsistente,
  useNuevaConversacion,
  usePreguntar,
  useRealtimeAsistente,
  useRenombrarConversacion,
} from "@/lib/nex/queries/asistente";
import { cn } from "@/lib/utils";

type BusquedaAsistente = { conversacion?: string; proyecto?: string; q?: string };

export const Route = createFileRoute("/asistente")({
  validateSearch: (busqueda: Record<string, unknown>): BusquedaAsistente => {
    const salida: BusquedaAsistente = {};
    if (typeof busqueda["conversacion"] === "string") salida.conversacion = busqueda["conversacion"];
    if (typeof busqueda["proyecto"] === "string") salida.proyecto = busqueda["proyecto"];
    if (typeof busqueda["q"] === "string") salida.q = busqueda["q"];
    return salida;
  },
  head: () => ({
    meta: [
      { title: "Asistente de cartera · NexDeveloper" },
      {
        name: "description",
        content: "Pregúntale a NexDeveloper por tus proyectos: tareas, gasto de IA, salud, dominios y copias.",
      },
      { property: "og:title", content: "Asistente de cartera · NexDeveloper" },
      {
        property: "og:description",
        content: "Pregúntale a NexDeveloper por tus proyectos: tareas, gasto de IA, salud, dominios y copias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AsistentePantalla,
});

export const SUGERENCIAS = [
  "¿Qué requiere mi atención hoy?",
  "¿Cuánto llevo gastado en IA este mes y en qué proyectos?",
  "¿Qué proyectos están en rojo de salud y por qué?",
  "¿Qué versiones he publicado esta semana?",
  "Crea una tarea en Gericentro para revisar el portal de familias",
  "¿Qué dominios caducan antes de 30 días?",
];

/* ------------------------------- Pantalla -------------------------------- */

function AsistentePantalla() {
  const { conversacion: conversacionUrl, proyecto: proyectoUrl, q } = Route.useSearch();
  const navegar = useNavigate();
  const estado = useEstadoAsistente();
  const { data: conversaciones = [] } = useConversaciones();
  const { data: proyectos = [] } = useProyectos();
  const { data: mensajes = [] } = useMensajesAsistente(conversacionUrl ?? null);
  const preguntar = usePreguntar();
  const nueva = useNuevaConversacion();
  const [texto, setTexto] = React.useState("");
  const [proyectoFoco, setProyectoFoco] = React.useState<string>(proyectoUrl ?? "");
  const [proveedor, setProveedor] = React.useState<string>("");
  const [listaAbierta, setListaAbierta] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState("");
  const finRef = React.useRef<HTMLDivElement | null>(null);
  const enviadoRef = React.useRef<string | null>(null);

  useRealtimeAsistente(true);

  React.useEffect(() => {
    if (proyectoUrl) setProyectoFoco(proyectoUrl);
  }, [proyectoUrl]);

  React.useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes.length, preguntar.isPending]);

  const enviar = React.useCallback(
    (pregunta: string) => {
      const limpio = pregunta.trim();
      if (!limpio || preguntar.isPending) return;
      setTexto("");
      preguntar.mutate(
        {
          texto: limpio,
          ...(conversacionUrl ? { conversacionId: conversacionUrl } : {}),
          ...(proyectoFoco ? { proyectoId: proyectoFoco } : {}),
          ...(proveedor ? { proveedor } : {}),
        },
        {
          onSuccess: (r) => {
            if (r.conversacion_id && r.conversacion_id !== conversacionUrl) {
              void navegar({
                to: "/asistente",
                search: { conversacion: r.conversacion_id, ...(proyectoFoco ? { proyecto: proyectoFoco } : {}) },
                replace: true,
              });
            }
          },
        },
      );
    },
    [conversacionUrl, navegar, preguntar, proveedor, proyectoFoco],
  );

  // Pregunta llegada desde el panel principal o la paleta (?q=...)
  React.useEffect(() => {
    if (!q || enviadoRef.current === q) return;
    enviadoRef.current = q;
    enviar(q);
    void navegar({
      to: "/asistente",
      search: {
        ...(conversacionUrl ? { conversacion: conversacionUrl } : {}),
        ...(proyectoUrl ? { proyecto: proyectoUrl } : {}),
      },
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const abrir = (id: string | null) =>
    void navegar({
      to: "/asistente",
      search: { ...(id ? { conversacion: id } : {}), ...(proyectoFoco ? { proyecto: proyectoFoco } : {}) },
      replace: true,
    });

  const empezar = async () => {
    const r = await nueva.mutateAsync(proyectoFoco ? { proyectoId: proyectoFoco } : {});
    if (r.conversacion?.id) abrir(r.conversacion.id);
    setListaAbierta(false);
  };

  const proveedores = estado.data?.proveedores ?? [];
  const noListo = estado.data ? estado.data.listo === false : false;

  return (
    <>
      <Encabezado
        titulo="Asistente de cartera"
        descripcion="Pregúntale a NexDeveloper por cualquier proyecto: te responde con cifras reales y crea tareas, órdenes y avisos."
        acciones={
          <Boton onClick={() => void empezar()} disabled={nueva.isPending}>
            <MessageSquarePlus className="size-4" /> Nueva conversación
          </Boton>
        }
      />

      {noListo ? (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Falta una clave de proveedor de IA (Anthropic recomendado).{" "}
          <Link to="/ajustes/proveedores" className="underline">
            Ir a Ajustes → Proveedores
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
        {/* Lista de conversaciones */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <button
            type="button"
            onClick={() => setListaAbierta((v) => !v)}
            className="mb-2 flex w-full items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted-foreground lg:hidden"
          >
            Conversaciones ({conversaciones.length})
            <ChevronDown className={cn("size-4 transition", listaAbierta && "rotate-180")} />
          </button>
          <div className={cn("panel p-3", listaAbierta ? "block" : "hidden lg:block")}>
            <label className="mb-2 flex items-center gap-2 rounded-lg border border-input bg-surface px-2.5 py-1.5">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar conversación"
                className="w-full bg-transparent text-sm text-foreground outline-none"
              />
            </label>
            <ListaConversaciones
              conversaciones={conversaciones}
              busqueda={busqueda}
              activa={conversacionUrl ?? null}
              onAbrir={(id) => {
                abrir(id);
                setListaAbierta(false);
              }}
            />
          </div>
        </div>

        {/* Conversación */}
        <div className="panel flex min-h-[60vh] flex-col p-4">
          <div className="flex-1 space-y-4">
            {mensajes.length === 0 && !preguntar.isPending ? (
              <Sugerencias onElegir={enviar} />
            ) : (
              mensajes.map((m) => <Burbuja key={m.id} mensaje={m} />)
            )}
            {preguntar.isPending ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" /> Consultando la cartera…
              </p>
            ) : null}
            <div ref={finRef} />
          </div>

          <Redaccion
            texto={texto}
            onTexto={setTexto}
            onEnviar={enviar}
            ocupado={preguntar.isPending}
            proyectos={proyectos.map((p) => ({ id: p.id, nombre: p.nombre }))}
            proyectoFoco={proyectoFoco}
            onProyectoFoco={setProyectoFoco}
            proveedores={proveedores}
            proveedor={proveedor}
            onProveedor={setProveedor}
          />
        </div>
      </div>
    </>
  );
}

/* ---------------------------- Lista lateral ------------------------------ */

function ListaConversaciones({
  conversaciones,
  busqueda,
  activa,
  onAbrir,
}: {
  conversaciones: AsistenteConversacionRow[];
  busqueda: string;
  activa: string | null;
  onAbrir: (id: string) => void;
}) {
  const renombrar = useRenombrarConversacion();
  const borrar = useBorrarConversacion();
  const filtradas = conversaciones.filter((c) =>
    busqueda.trim() ? (c.titulo ?? "").toLowerCase().includes(busqueda.trim().toLowerCase()) : true,
  );

  if (filtradas.length === 0) {
    return <p className="p-2 text-xs text-muted-foreground">Todavía no hay conversaciones.</p>;
  }

  return (
    <ul className="space-y-1">
      {filtradas.map((c) => (
        <li
          key={c.id}
          className={cn(
            "group rounded-lg border px-2.5 py-2 transition",
            c.id === activa ? "border-primary/40 bg-primary/10" : "border-transparent hover:border-border",
          )}
        >
          <button type="button" onClick={() => onAbrir(c.id)} className="block w-full text-left">
            <span className="line-clamp-1 text-sm text-foreground">{c.titulo || "Conversación sin título"}</span>
            <span className="text-xs text-muted-foreground">{desde(c.actualizado_el)}</span>
          </button>
          <div className="mt-1 flex items-center gap-2 opacity-70">
            <button
              type="button"
              title={c.fijada ? "Quitar de fijadas" : "Fijar arriba"}
              onClick={() => renombrar.mutate({ conversacionId: c.id, fijada: !c.fijada })}
              className="text-muted-foreground transition hover:text-foreground"
            >
              {c.fijada ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </button>
            <button
              type="button"
              title="Renombrar"
              onClick={() => {
                const titulo = window.prompt("Nuevo título de la conversación", c.titulo ?? "");
                if (titulo !== null) renombrar.mutate({ conversacionId: c.id, titulo });
              }}
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              Renombrar
            </button>
            <button
              type="button"
              title="Borrar"
              onClick={() => {
                if (window.confirm("¿Borrar esta conversación?")) borrar.mutate(c.id);
              }}
              className="ml-auto text-muted-foreground transition hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------- Mensajes -------------------------------- */

function Burbuja({ mensaje }: { mensaje: AsistenteMensajeRow }) {
  const esUsuario = mensaje.rol === "usuario";
  const herramientas = leerHerramientas(mensaje);
  const acciones = leerAcciones(mensaje);
  const [verHerramientas, setVerHerramientas] = React.useState(false);

  return (
    <div className={cn("flex gap-3", esUsuario ? "justify-end" : "justify-start")}>
      {!esUsuario ? (
        <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </span>
      ) : null}
      <div className={cn("max-w-[46rem] min-w-0", esUsuario && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-4 py-2.5 text-left text-sm",
            esUsuario
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-surface text-foreground",
          )}
        >
          {esUsuario ? (
            <p className="whitespace-pre-wrap">{mensaje.texto}</p>
          ) : (
            <div
              className="prosa space-y-2 [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: markdownAHtml(mensaje.texto ?? "") }}
            />
          )}
        </div>

        {mensaje.error ? (
          <p className="mt-1 text-xs text-destructive">{mensaje.error}</p>
        ) : null}

        {acciones.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {acciones.map((a, i) => (
              <ChipAccion key={`${a.tipo}-${a.id ?? i}`} accion={a} />
            ))}
          </div>
        ) : null}

        {herramientas.length > 0 ? (
          <div className="mt-2 text-left">
            <button
              type="button"
              onClick={() => setVerHerramientas((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <Wrench className="size-3.5" /> Cómo lo he comprobado ({herramientas.length})
              <ChevronDown className={cn("size-3.5 transition", verHerramientas && "rotate-180")} />
            </button>
            {verHerramientas ? (
              <ul className="mt-1.5 space-y-1 rounded-lg border border-border bg-surface p-2.5 text-xs text-muted-foreground">
                {herramientas.map((h, i) => (
                  <li key={`${h.nombre}-${i}`}>
                    <span className="text-foreground">{h.nombre}</span>
                    {h.salida_resumen ? ` · ${h.salida_resumen}` : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <p className={cn("mt-1 text-[11px] text-muted-foreground", esUsuario ? "text-right" : "text-left")}>
          {marcaTiempo(mensaje.creado_el)}
          {!esUsuario && (mensaje.coste || mensaje.tokens_salida) ? (
            <>
              {" · "}
              {formatoEuros(Number(mensaje.coste ?? 0))}
              {" · "}
              {Number(mensaje.tokens_entrada ?? 0) + Number(mensaje.tokens_salida ?? 0)} tokens
              {mensaje.modelo ? ` · ${mensaje.modelo}` : ""}
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

const RUTA_ACCION: Record<AccionAsistente["tipo"], string> = {
  tarea: "/cola",
  orden: "/aprobaciones",
  aviso: "/avisos",
};

const ETIQUETA_ACCION: Record<AccionAsistente["tipo"], string> = {
  tarea: "Tarea creada",
  orden: "Orden creada",
  aviso: "Aviso creado",
};

function ChipAccion({ accion }: { accion: AccionAsistente }) {
  const texto = `${ETIQUETA_ACCION[accion.tipo] ?? "Creado"}: ${accion.titulo ?? "ver"}`;
  const clase =
    "inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs text-success transition hover:opacity-90";
  if (accion.url && /^https?:\/\//.test(accion.url)) {
    return (
      <a href={accion.url} target="_blank" rel="noreferrer" className={clase}>
        {texto}
      </a>
    );
  }
  const destino = accion.url ?? RUTA_ACCION[accion.tipo] ?? "/";
  return (
    <Link to={destino as "/cola"} className={clase}>
      {texto}
    </Link>
  );
}

/* ------------------------------ Sugerencias ------------------------------ */

function Sugerencias({ onElegir }: { onElegir: (t: string) => void }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Pregúntame lo que quieras sobre tus proyectos. Algunos ejemplos:
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {SUGERENCIAS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onElegir(s)}
            className="rounded-lg border border-border bg-surface p-3 text-left text-sm text-foreground transition hover:border-primary/40"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- Redacción ------------------------------- */

function Redaccion({
  texto,
  onTexto,
  onEnviar,
  ocupado,
  proyectos,
  proyectoFoco,
  onProyectoFoco,
  proveedores,
  proveedor,
  onProveedor,
}: {
  texto: string;
  onTexto: (v: string) => void;
  onEnviar: (t: string) => void;
  ocupado: boolean;
  proyectos: { id: string; nombre: string }[];
  proyectoFoco: string;
  onProyectoFoco: (v: string) => void;
  proveedores: { slug: string; modelo: string }[];
  proveedor: string;
  onProveedor: (v: string) => void;
}) {
  const { escuchando, soportado, alternar } = useDictado((t) => onTexto(texto ? `${texto} ${t}` : t));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar(texto);
      }}
      className="mt-4 border-t border-border pt-3"
    >
      <div className="flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => onTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onEnviar(texto);
            }
          }}
          rows={2}
          placeholder="Pregúntale a NexDeveloper… (Intro para enviar, Mayús+Intro para salto de línea)"
          className={cn(claseCampo, "min-h-[3rem] resize-y")}
        />
        {soportado ? (
          <Boton
            type="button"
            variante="suave"
            aria-label={escuchando ? "Dejar de dictar" : "Dictar la pregunta"}
            onClick={alternar}
            className={cn("shrink-0", escuchando && "border-primary/60 text-primary")}
          >
            {escuchando ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </Boton>
        ) : null}
        <Boton type="submit" disabled={ocupado || !texto.trim()} className="shrink-0">
          {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Enviar
        </Boton>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5">
          Proyecto en foco
          <select
            value={proyectoFoco}
            onChange={(e) => onProyectoFoco(e.target.value)}
            className="rounded-full border border-input bg-surface px-2 py-1 text-xs text-foreground"
          >
            <option value="">Toda la cartera</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        {proveedores.length > 1 ? (
          <label className="flex items-center gap-1.5">
            Proveedor
            <select
              value={proveedor}
              onChange={(e) => onProveedor(e.target.value)}
              className="rounded-full border border-input bg-surface px-2 py-1 text-xs text-foreground"
            >
              <option value="">Automático</option>
              {proveedores.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.slug} · {p.modelo}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </form>
  );
}

/** Dictado por voz del navegador (es-ES), si está disponible. */
function useDictado(alTexto: (t: string) => void) {
  const [escuchando, setEscuchando] = React.useState(false);
  const [soportado, setSoportado] = React.useState(false);
  const refReconocimiento = React.useRef<{ start: () => void; stop: () => void } | null>(null);
  const refTexto = React.useRef(alTexto);
  refTexto.current = alTexto;

  React.useEffect(() => {
    const ventana = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const Constructor = (ventana.SpeechRecognition ?? ventana.webkitSpeechRecognition) as
      | (new () => Record<string, unknown>)
      | undefined;
    if (!Constructor) return;
    setSoportado(true);
    const reconocimiento = new Constructor() as Record<string, unknown> & { start: () => void; stop: () => void };
    reconocimiento["lang"] = "es-ES";
    reconocimiento["interimResults"] = false;
    reconocimiento["continuous"] = false;
    reconocimiento["onresult"] = (evento: unknown) => {
      const resultados = (evento as { results?: Array<Array<{ transcript?: string }>> }).results;
      const dicho = resultados?.[0]?.[0]?.transcript ?? "";
      if (dicho) refTexto.current(dicho);
    };
    reconocimiento["onend"] = () => setEscuchando(false);
    reconocimiento["onerror"] = () => {
      setEscuchando(false);
      toast.error("No se ha podido usar el micrófono.");
    };
    refReconocimiento.current = reconocimiento;
    return () => {
      try {
        reconocimiento.stop();
      } catch {
        /* ya parado */
      }
    };
  }, []);

  const alternar = () => {
    const reconocimiento = refReconocimiento.current;
    if (!reconocimiento) return;
    if (escuchando) {
      reconocimiento.stop();
      setEscuchando(false);
      return;
    }
    try {
      reconocimiento.start();
      setEscuchando(true);
    } catch {
      setEscuchando(false);
    }
  };

  return { escuchando, soportado, alternar };
}

/* --------------------------- Piezas reutilizables ------------------------ */

/** Botón para abrir el asistente con un proyecto en foco (ficha de proyecto). */
export function BotonPreguntarAsistente({ proyectoId, className }: { proyectoId: string; className?: string }) {
  return (
    <Link
      to="/asistente"
      search={{ proyecto: proyectoId }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary transition hover:opacity-90",
        className,
      )}
    >
      <Sparkles className="size-3.5" /> Preguntar al asistente
    </Link>
  );
}

/** Caja rápida del panel principal: lleva a /asistente con la pregunta ya enviada. */
export function CajaRapidaAsistente() {
  const navegar = useNavigate();
  const [texto, setTexto] = React.useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!texto.trim()) return;
        void navegar({ to: "/asistente", search: { q: texto.trim() } });
        setTexto("");
      }}
      className="panel p-4"
    >
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
        <Sparkles className="size-4 text-primary" /> Pregúntale a NexDeveloper…
      </h2>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="¿Qué requiere mi atención hoy?"
        className={cn(claseCampo, "mt-3")}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Atajo: Ctrl/Cmd + K</span>
        <Boton type="submit" className="px-3 py-1.5 text-xs" disabled={!texto.trim()}>
          Preguntar
        </Boton>
      </div>
    </form>
  );
}
