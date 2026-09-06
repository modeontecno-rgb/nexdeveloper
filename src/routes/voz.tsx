import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Download,
  FileText,
  GripVertical,
  Loader2,
  Mic,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Video,
  X,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando } from "@/components/nex/badges";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type { EscenaGuion, GuionDemoRow, LocucionRow } from "@/lib/nex/db-types";
import { formatoFechaHora } from "@/lib/nex/labels";
import { usePreviews, useProyectos } from "@/lib/nex/queries/datos";
import {
  MAX_CARACTERES_LOCUCION,
  escenasOrdenadas,
  segundosEstimados,
  useBorrarGuion,
  useEnlaceLocucion,
  useGenerarGuion,
  useGuardarGuion,
  useGuardarVozConfig,
  useGuionesDemo,
  useLocuciones,
  useLocutar,
  usePingVoz,
  useRealtimeLocuciones,
  useVocesDisponibles,
  useVozConfig,
} from "@/lib/nex/queries/voz";

export const Route = createFileRoute("/voz")({
  head: () => ({
    meta: [
      { title: "Voz y demos · NexDeveloper" },
      {
        name: "description",
        content: "Guiones por escenas con capturas de tus pantallas y locución profesional para tus vídeos de demostración.",
      },
      { property: "og:title", content: "Voz y demos · NexDeveloper" },
      {
        property: "og:description",
        content: "Guiones por escenas con capturas de tus pantallas y locución profesional para tus vídeos de demostración.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VozYDemos,
});

type Pestana = "guiones" | "locuciones" | "config";

const PUBLICOS = [
  { valor: "cliente", texto: "Cliente" },
  { valor: "distribuidor", texto: "Distribuidor" },
  { valor: "formacion", texto: "Formación interna" },
];

const MODELOS = [
  { valor: "eleven_multilingual_v2", texto: "Multilingüe v2 (máxima calidad)" },
  { valor: "eleven_turbo_v2_5", texto: "Turbo v2.5 (rápido)" },
  { valor: "eleven_flash_v2_5", texto: "Flash v2.5 (muy rápido)" },
];

function etiquetaPublico(valor: string | null | undefined) {
  return PUBLICOS.find((p) => p.valor === valor)?.texto ?? valor ?? "Sin definir";
}

function VozYDemos() {
  const [pestana, setPestana] = React.useState<Pestana>("guiones");
  const [nuevoGuion, setNuevoGuion] = React.useState(false);
  const [textoLibre, setTextoLibre] = React.useState(false);
  const [guionAbierto, setGuionAbierto] = React.useState<string | null>(null);
  const [demo, setDemo] = React.useState<GuionDemoRow | null>(null);

  const { data: ping, isPending: pingPendiente } = usePingVoz();
  const { data: guiones = [], isPending } = useGuionesDemo();
  const { data: proyectos = [] } = useProyectos();
  useRealtimeLocuciones(true);

  const nombreProyecto = (id: string) => proyectos.find((p) => p.id === id)?.nombre ?? "Sin proyecto";
  const abierto = guiones.find((g) => g.id === guionAbierto) ?? null;

  return (
    <>
      <Encabezado
        titulo="Voz y demos"
        descripcion="Escribe el guion de la demostración por escenas, con las capturas de cada pantalla, y ponle voz para grabar el vídeo sin salir de aquí."
        acciones={
          <>
            <Boton variante="suave" onClick={() => setTextoLibre(true)}>
              <Mic className="size-4" /> Locutar texto libre
            </Boton>
            <Boton onClick={() => setNuevoGuion(true)}>
              <Plus className="size-4" /> Nuevo guion
            </Boton>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="panel p-4">
          <p className="text-xs text-muted-foreground">Locución (ElevenLabs)</p>
          {pingPendiente ? (
            <p className="mt-1 text-sm text-muted-foreground">Comprobando…</p>
          ) : ping?.elevenlabs ? (
            <EstadoSuscripcion />
          ) : (
            <p className="mt-1 text-sm text-destructive">
              Pon la clave en{" "}
              <Link to="/ajustes" className="underline">
                Ajustes → Proveedores
              </Link>
              .
            </p>
          )}
        </div>
        <div className="panel p-4">
          <p className="text-xs text-muted-foreground">Almacén de audios</p>
          <p className={`mt-1 text-sm ${ping?.almacen ? "text-success" : "text-destructive"}`}>
            {pingPendiente ? "Comprobando…" : ping?.almacen ? "Conectado y listo" : "Sin almacén: no se pueden guardar los mp3"}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["guiones", "Guiones"],
            ["locuciones", "Locuciones"],
            ["config", "Configuración"],
          ] as [Pestana, string][]
        ).map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setPestana(valor)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              pestana === valor
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {pestana === "guiones" ? (
        isPending ? (
          <Cargando />
        ) : abierto ? (
          <EditorGuion
            guion={abierto}
            nombreProyecto={nombreProyecto(abierto.proyecto_id)}
            onCerrar={() => setGuionAbierto(null)}
            onReproducir={() => setDemo(abierto)}
          />
        ) : (
          <div className="grid gap-3">
            {guiones.map((g) => (
              <div key={g.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{g.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {nombreProyecto(g.proyecto_id)} · {etiquetaPublico(g.publico)} · {g.duracion_objetivo_seg ?? 0} s ·{" "}
                    {(g.escenas ?? []).length} escenas · {g.generado_por ?? "manual"} ·{" "}
                    {g.estado === "listo" ? "Listo" : "Borrador"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Boton variante="suave" onClick={() => setDemo(g)}>
                    <Play className="size-4" /> Reproducir demo
                  </Boton>
                  <Boton variante="suave" onClick={() => setGuionAbierto(g.id)}>
                    <FileText className="size-4" /> Abrir
                  </Boton>
                </div>
              </div>
            ))}
            {guiones.length === 0 ? (
              <p className="panel p-6 text-sm text-muted-foreground">
                Todavía no hay guiones. Pulsa «Nuevo guion» y se escribirá uno con las pantallas de tu proyecto.
              </p>
            ) : null}
          </div>
        )
      ) : null}

      {pestana === "locuciones" ? <TablaLocuciones /> : null}
      {pestana === "config" ? <Configuracion /> : null}

      {nuevoGuion ? <DialogoNuevoGuion onCerrar={() => setNuevoGuion(false)} onCreado={(id) => setGuionAbierto(id)} /> : null}
      {textoLibre ? <DialogoTextoLibre onCerrar={() => setTextoLibre(false)} /> : null}
      {demo ? <ReproductorDemo guion={demo} onCerrar={() => setDemo(null)} /> : null}
    </>
  );
}

function EstadoSuscripcion() {
  const { data, isPending, isError } = useVocesDisponibles();
  const s = data?.suscripcion;
  if (isPending) return <p className="mt-1 text-sm text-muted-foreground">Comprobando…</p>;
  if (isError || !s) return <p className="mt-1 text-sm text-success">Clave configurada</p>;
  return (
    <p className="mt-1 text-sm text-success">
      Plan {s.plan ?? "activo"} · {(s.caracteres_usados ?? 0).toLocaleString("es-ES")} /{" "}
      {(s.caracteres_limite ?? 0).toLocaleString("es-ES")} caracteres
      {s.renueva ? ` · renueva el ${formatoFechaHora(s.renueva)}` : ""}
    </p>
  );
}

/* ------------------------------ Nuevo guion ------------------------------ */

function DialogoNuevoGuion({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (id: string) => void }) {
  const { data: proyectos = [] } = useProyectos();
  const generar = useGenerarGuion();
  const [proyectoId, setProyectoId] = React.useState(proyectos[0]?.id ?? "");
  const [publico, setPublico] = React.useState("cliente");
  const [duracion, setDuracion] = React.useState(120);
  const [notas, setNotas] = React.useState("");

  const lanzar = async () => {
    if (!proyectoId) {
      toast.error("Elige un proyecto.");
      return;
    }
    const r = await generar.mutateAsync({
      proyectoId,
      publico,
      duracionObjetivoSeg: duracion,
      ...(notas.trim() ? { notas: notas.trim() } : {}),
    });
    onCerrar();
    if (r.guion?.id) onCreado(r.guion.id);
  };

  return (
    <Dialogo abierto titulo="Nuevo guion de demostración" onCerrar={onCerrar}>
      <div className="space-y-3">
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
        <Campo etiqueta="Público">
          <select value={publico} onChange={(e) => setPublico(e.target.value)} className={claseCampo}>
            {PUBLICOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.texto}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Duración objetivo">
          <select value={String(duracion)} onChange={(e) => setDuracion(Number(e.target.value))} className={claseCampo}>
            <option value="60">60 segundos</option>
            <option value="120">120 segundos</option>
            <option value="180">180 segundos</option>
          </select>
        </Campo>
        <Campo etiqueta="Notas" pista="Qué quieres destacar, tono, nombres propios…">
          <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} className={claseCampo} />
        </Campo>
        <div className="flex justify-end gap-2">
          <Boton variante="suave" type="button" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="button" onClick={() => void lanzar()} disabled={generar.isPending}>
            {generar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
            {generar.isPending ? "Escribiendo el guion…" : "Escribir guion"}
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

/* ------------------------------ Editor guion ----------------------------- */

function EditorGuion({
  guion,
  nombreProyecto,
  onCerrar,
  onReproducir,
}: {
  guion: GuionDemoRow;
  nombreProyecto: string;
  onCerrar: () => void;
  onReproducir: () => void;
}) {
  const { data: previews = [] } = usePreviews();
  const guardar = useGuardarGuion();
  const borrar = useBorrarGuion();
  const locutar = useLocutar();
  const [titulo, setTitulo] = React.useState(guion.titulo);
  const [escenas, setEscenas] = React.useState<EscenaGuion[]>(escenasOrdenadas(guion));
  const [arrastrando, setArrastrando] = React.useState<number | null>(null);
  const [progreso, setProgreso] = React.useState<string | null>(null);

  const previewsProyecto = previews.filter((p) => p.proyecto_id === guion.proyecto_id);
  const totalCaracteres = escenas.reduce((s, e) => s + e.texto.length, 0);

  const cambiar = (indice: number, cambios: Partial<EscenaGuion>) =>
    setEscenas((lista) => lista.map((e, i) => (i === indice ? { ...e, ...cambios } : e)));

  const reordenar = (desde: number, hasta: number) =>
    setEscenas((lista) => {
      const copia = [...lista];
      const [movida] = copia.splice(desde, 1);
      if (!movida) return lista;
      copia.splice(hasta, 0, movida);
      return copia.map((e, i) => ({ ...e, orden: i + 1 }));
    });

  const guardarTodo = () =>
    guardar.mutate({
      id: guion.id,
      cambios: { titulo, escenas: escenas.map((e, i) => ({ ...e, orden: i + 1 })) },
    });

  const locutarEscena = async (orden: number) => {
    const r = await locutar.mutateAsync({ guionId: guion.id, escena: orden });
    if (r.url) toast.success("Escena locutada.");
  };

  const locutarTodo = async () => {
    if (totalCaracteres <= MAX_CARACTERES_LOCUCION) {
      setProgreso("Locutando el guion completo…");
      try {
        await locutar.mutateAsync({ guionId: guion.id });
        toast.success("Guion locutado.");
      } finally {
        setProgreso(null);
      }
      return;
    }
    for (let i = 0; i < escenas.length; i += 1) {
      setProgreso(`Locutando escena ${i + 1} de ${escenas.length}…`);
      try {
        await locutar.mutateAsync({ guionId: guion.id, escena: i + 1 });
      } catch {
        setProgreso(null);
        return;
      }
    }
    setProgreso(null);
    toast.success("Todas las escenas locutadas.");
  };

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={claseCampo} />
          <p className="mt-1 text-xs text-muted-foreground">
            {nombreProyecto} · {etiquetaPublico(guion.publico)} · {escenas.length} escenas · {totalCaracteres} caracteres ·{" "}
            {Math.round(escenas.reduce((s, e) => s + segundosEstimados(e.texto), 0))} s estimados
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton variante="suave" type="button" onClick={onCerrar}>
            Volver
          </Boton>
          <Boton variante="suave" type="button" onClick={onReproducir}>
            <Play className="size-4" /> Reproducir demo
          </Boton>
          <Boton variante="suave" type="button" onClick={() => void locutarTodo()} disabled={locutar.isPending}>
            {locutar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />} Locutar todo
          </Boton>
          <Boton type="button" onClick={guardarTodo} disabled={guardar.isPending}>
            Guardar
          </Boton>
          <Boton
            variante="peligro"
            type="button"
            onClick={() => {
              borrar.mutate(guion.id);
              onCerrar();
            }}
          >
            <Trash2 className="size-4" />
          </Boton>
        </div>
      </div>

      {progreso ? <p className="panel p-3 text-sm text-muted-foreground">{progreso}</p> : null}

      <div className="space-y-3">
        {escenas.map((escena, indice) => (
          <div
            key={indice}
            draggable
            onDragStart={() => setArrastrando(indice)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (arrastrando !== null && arrastrando !== indice) reordenar(arrastrando, indice);
              setArrastrando(null);
            }}
            className="panel grid gap-3 p-4 lg:grid-cols-[1fr_16rem]"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical className="size-4 cursor-grab text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Escena {indice + 1}</span>
                <input
                  value={escena.titulo}
                  onChange={(e) => cambiar(indice, { titulo: e.target.value })}
                  placeholder="Título de la escena"
                  className={`${claseCampo} flex-1`}
                />
              </div>
              <textarea
                rows={4}
                value={escena.texto}
                onChange={(e) => cambiar(indice, { texto: e.target.value })}
                placeholder="Texto que se locuta"
                className={claseCampo}
              />
              <p className="text-xs text-muted-foreground">
                {escena.texto.length} caracteres · {segundosEstimados(escena.texto)} s estimados
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={escena.url_pantalla ?? ""}
                  onChange={(e) => cambiar(indice, { url_pantalla: e.target.value })}
                  placeholder="URL de la pantalla"
                  className={`${claseCampo} flex-1`}
                />
                {previewsProyecto.length > 0 ? (
                  <select
                    value=""
                    onChange={(e) => e.target.value && cambiar(indice, { url_pantalla: e.target.value })}
                    className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
                  >
                    <option value="">Vistas previas…</option>
                    {previewsProyecto.map((p) => (
                      <option key={p.id} value={p.url}>
                        {p.titulo}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Boton variante="suave" type="button" onClick={() => void locutarEscena(indice + 1)} disabled={locutar.isPending}>
                  <Mic className="size-4" /> Locutar escena
                </Boton>
                <Boton
                  variante="peligro"
                  type="button"
                  onClick={() => setEscenas((l) => l.filter((_, i) => i !== indice).map((e, i) => ({ ...e, orden: i + 1 })))}
                >
                  <Trash2 className="size-4" /> Quitar
                </Boton>
              </div>
            </div>
            <Captura url={escena.captura_url} alt={escena.titulo} />
          </div>
        ))}
      </div>

      <Boton
        variante="suave"
        type="button"
        onClick={() =>
          setEscenas((l) => [...l, { orden: l.length + 1, titulo: "Nueva escena", texto: "", url_pantalla: "", captura_url: null }])
        }
      >
        <Plus className="size-4" /> Añadir escena
      </Boton>
    </div>
  );
}

function Captura({ url, alt, className }: { url?: string | null | undefined; alt: string; className?: string | undefined }) {
  const [fallo, setFallo] = React.useState(false);
  React.useEffect(() => setFallo(false), [url]);
  if (!url || fallo) {
    return (
      <div className={`grid place-items-center rounded-lg border border-dashed border-border bg-surface p-4 text-xs text-muted-foreground ${className ?? "min-h-28"}`}>
        Sin captura de esta pantalla
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={`Captura de la pantalla: ${alt}`}
      loading="lazy"
      onError={() => setFallo(true)}
      className={`rounded-lg border border-border object-cover ${className ?? "max-h-40 w-full"}`}
    />
  );
}

/* ----------------------------- Reproductor ------------------------------ */

function ReproductorDemo({ guion, onCerrar }: { guion: GuionDemoRow; onCerrar: () => void }) {
  const escenas = escenasOrdenadas(guion);
  const { data: locuciones = [] } = useLocuciones(guion.id);
  const enlace = useEnlaceLocucion();
  const [indice, setIndice] = React.useState(0);
  const [pausado, setPausado] = React.useState(false);
  const [urlAudio, setUrlAudio] = React.useState<string | null>(null);
  const [ayuda, setAyuda] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const escena = escenas[indice];
  const locucion = locuciones.find((l) => l.escena === indice + 1 && l.estado === "ok");

  React.useEffect(() => {
    let vigente = true;
    setUrlAudio(null);
    if (!locucion) return;
    void enlace
      .mutateAsync({ locucionId: locucion.id })
      .then((r) => {
        if (vigente && r.url) setUrlAudio(r.url);
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locucion?.id]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (pausado) audio.pause();
    else void audio.play().catch(() => undefined);
  }, [pausado, urlAudio]);

  const siguiente = React.useCallback(() => {
    setIndice((i) => (i + 1 < escenas.length ? i + 1 : i));
  }, [escenas.length]);

  React.useEffect(() => {
    if (urlAudio || pausado || !escena) return;
    const espera = window.setTimeout(siguiente, Math.max(3, segundosEstimados(escena.texto)) * 1000);
    return () => window.clearTimeout(espera);
  }, [urlAudio, pausado, escena, siguiente]);

  if (!escena) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 p-4 sm:p-8">
      <div className="flex items-center justify-between gap-3 text-sm text-white/80">
        <span>
          {guion.titulo} · Escena {indice + 1} de {escenas.length}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setAyuda(true)} className="rounded-md border border-white/30 px-2 py-1 text-xs">
            <Video className="mr-1 inline size-3.5" /> Grabar pantalla
          </button>
          <button type="button" aria-label="Cerrar" onClick={onCerrar} className="rounded-md p-1 hover:text-white">
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="relative mt-4 flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-black">
        <Captura url={escena.captura_url} alt={escena.titulo} className="max-h-full max-w-full object-contain" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-6">
          <h2 className="font-display text-2xl font-semibold text-white">{escena.titulo}</h2>
          <p className="mt-1 max-w-3xl text-sm text-white/80">{escena.texto}</p>
        </div>
      </div>

      {urlAudio ? (
        <audio ref={audioRef} src={urlAudio} autoPlay onEnded={siguiente} className="hidden" />
      ) : (
        <p className="mt-2 text-center text-xs text-white/60">Esta escena no tiene locución: avanza sola por tiempo.</p>
      )}

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="Anterior"
          onClick={() => setIndice((i) => Math.max(0, i - 1))}
          className="rounded-lg border border-white/30 p-2 text-white"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          aria-label={pausado ? "Reanudar" : "Pausar"}
          onClick={() => setPausado((p) => !p)}
          className="rounded-lg border border-white/30 p-2 text-white"
        >
          {pausado ? <Play className="size-5" /> : <Pause className="size-5" />}
        </button>
        <button
          type="button"
          aria-label="Siguiente"
          onClick={siguiente}
          className="rounded-lg border border-white/30 p-2 text-white"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {ayuda ? (
        <Dialogo abierto titulo="Grabar la demostración" onCerrar={() => setAyuda(false)}>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              En el Mac: pulsa <span className="text-foreground">Mayúsculas + Command + 5</span>, elige «Grabar pantalla completa»,
              activa el sonido interno si lo tienes disponible y pulsa «Grabar».
            </li>
            <li>
              En el iPad: añade «Grabación de pantalla» en Ajustes → Centro de control y púlsalo desde el Centro de control.
            </li>
            <li>Vuelve aquí, pulsa reproducir y deja que la demostración avance sola hasta el final.</li>
            <li>Detén la grabación y ya tienes el vídeo listo para compartir.</li>
          </ul>
        </Dialogo>
      ) : null}
    </div>
  );
}

/* ------------------------------ Locuciones ------------------------------- */

function TablaLocuciones() {
  const { data: locuciones = [], isPending } = useLocuciones();
  const { data: proyectos = [] } = useProyectos();
  const enlace = useEnlaceLocucion();
  const locutar = useLocutar();
  const [audio, setAudio] = React.useState<{ id: string; url: string } | null>(null);
  const [texto, setTexto] = React.useState<LocucionRow | null>(null);

  const nombreProyecto = (id: string | null) => proyectos.find((p) => p.id === id)?.nombre ?? "—";

  const reproducir = async (l: LocucionRow) => {
    const r = await enlace.mutateAsync({ locucionId: l.id });
    if (r.url) setAudio({ id: l.id, url: r.url });
  };

  const descargar = async (l: LocucionRow) => {
    const r = await enlace.mutateAsync({ locucionId: l.id, descargar: true });
    if (r.url) window.open(r.url, "_blank", "noopener");
  };

  if (isPending) return <Cargando />;

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="p-3">Fecha</th>
            <th className="p-3">Proyecto</th>
            <th className="p-3">Título</th>
            <th className="p-3">Voz</th>
            <th className="p-3">Duración</th>
            <th className="p-3">Caracteres</th>
            <th className="p-3">Estado</th>
            <th className="p-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {locuciones.map((l) => (
            <React.Fragment key={l.id}>
              <tr className="border-b border-border/60">
                <td className="p-3 text-muted-foreground">{formatoFechaHora(l.creado_el)}</td>
                <td className="p-3">{nombreProyecto(l.proyecto_id)}</td>
                <td className="p-3">{l.titulo ?? "Sin título"}</td>
                <td className="p-3 text-muted-foreground">{l.voz_nombre ?? "—"}</td>
                <td className="p-3">{l.duracion_seg ? `${Math.round(l.duracion_seg)} s` : "—"}</td>
                <td className="p-3">{l.caracteres ?? 0}</td>
                <td className="p-3">
                  <span
                    className={
                      l.estado === "ok"
                        ? "text-success"
                        : l.estado === "error"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }
                  >
                    {l.estado === "ok" ? "Correcta" : l.estado === "error" ? l.error ?? "Error" : l.estado === "generando" ? "Generando…" : "Pendiente"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Boton variante="suave" type="button" onClick={() => void reproducir(l)} disabled={l.estado !== "ok"}>
                      <Play className="size-3.5" />
                    </Boton>
                    <Boton variante="suave" type="button" onClick={() => void descargar(l)} disabled={l.estado !== "ok"}>
                      <Download className="size-3.5" />
                    </Boton>
                    <Boton variante="suave" type="button" onClick={() => setTexto(l)}>
                      <FileText className="size-3.5" />
                    </Boton>
                    <Boton
                      variante="suave"
                      type="button"
                      disabled={locutar.isPending || !l.texto}
                      onClick={() =>
                        locutar.mutate({
                          ...(l.texto ? { texto: l.texto } : {}),
                          ...(l.titulo ? { titulo: l.titulo } : {}),
                          ...(l.proyecto_id ? { proyectoId: l.proyecto_id } : {}),
                        })
                      }
                    >
                      <RefreshCw className="size-3.5" />
                    </Boton>
                  </div>
                </td>
              </tr>
              {audio?.id === l.id ? (
                <tr>
                  <td colSpan={8} className="px-3 pb-3">
                    <audio controls autoPlay src={audio.url} className="w-full" />
                  </td>
                </tr>
              ) : null}
            </React.Fragment>
          ))}
          {locuciones.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-6 text-sm text-muted-foreground">
                Todavía no hay locuciones.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {texto ? (
        <Dialogo abierto titulo={texto.titulo ?? "Texto de la locución"} onCerrar={() => setTexto(null)}>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{texto.texto ?? "Sin texto guardado."}</p>
        </Dialogo>
      ) : null}
    </div>
  );
}

/* ---------------------------- Texto libre -------------------------------- */

function DialogoTextoLibre({ onCerrar }: { onCerrar: () => void }) {
  const { data: proyectos = [] } = useProyectos();
  const { data: voces } = useVocesDisponibles();
  const { data: config } = useVozConfig();
  const locutar = useLocutar();
  const [proyectoId, setProyectoId] = React.useState("");
  const [titulo, setTitulo] = React.useState("");
  const [texto, setTexto] = React.useState("");
  const [vozId, setVozId] = React.useState(config?.voz_id ?? "");
  const [url, setUrl] = React.useState<string | null>(null);

  const lanzar = async () => {
    if (!texto.trim()) {
      toast.error("Escribe el texto que quieres locutar.");
      return;
    }
    const r = await locutar.mutateAsync({
      texto: texto.trim().slice(0, MAX_CARACTERES_LOCUCION),
      ...(titulo.trim() ? { titulo: titulo.trim() } : {}),
      ...(proyectoId ? { proyectoId } : {}),
      ...(vozId ? { vozId } : {}),
    });
    if (r.url) setUrl(r.url);
    toast.success("Locución lista.");
  };

  return (
    <Dialogo abierto titulo="Locutar texto libre" onCerrar={onCerrar}>
      <div className="space-y-3">
        <Campo etiqueta="Proyecto (opcional)">
          <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={claseCampo}>
            <option value="">Sin proyecto</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Título">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Voz">
          <select value={vozId} onChange={(e) => setVozId(e.target.value)} className={claseCampo}>
            <option value="">Voz de la configuración</option>
            {(voces?.voces ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Texto" pista={`${texto.length} de ${MAX_CARACTERES_LOCUCION} caracteres`}>
          <textarea
            rows={6}
            value={texto}
            maxLength={MAX_CARACTERES_LOCUCION}
            onChange={(e) => setTexto(e.target.value)}
            className={claseCampo}
          />
        </Campo>
        {url ? <audio controls autoPlay src={url} className="w-full" /> : null}
        <div className="flex justify-end gap-2">
          <Boton variante="suave" type="button" onClick={onCerrar}>
            Cerrar
          </Boton>
          <Boton type="button" onClick={() => void lanzar()} disabled={locutar.isPending}>
            {locutar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />} Locutar
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

/* ---------------------------- Configuración ------------------------------ */

function Configuracion() {
  const { data: config, isPending } = useVozConfig();
  const { data: voces } = useVocesDisponibles();
  const guardar = useGuardarVozConfig();
  const locutar = useLocutar();
  const [idioma, setIdioma] = React.useState("");
  const [genero, setGenero] = React.useState("");
  const [muestra, setMuestra] = React.useState<string | null>(null);
  const [prueba, setPrueba] = React.useState<string | null>(null);

  if (isPending) return <Cargando />;
  if (!config) return <p className="panel p-6 text-sm text-muted-foreground">No hay configuración de voz todavía.</p>;

  const lista = (voces?.voces ?? []).filter(
    (v) => (!idioma || (v.idioma ?? "") === idioma) && (!genero || (v.genero ?? "") === genero),
  );
  const idiomas = [...new Set((voces?.voces ?? []).map((v) => v.idioma).filter(Boolean))] as string[];
  const generos = [...new Set((voces?.voces ?? []).map((v) => v.genero).filter(Boolean))] as string[];

  const cambiar = (cambios: Partial<typeof config>) => guardar.mutate({ id: config.id, cambios });

  const deslizador = (
    etiqueta: string,
    campo: "estabilidad" | "similitud" | "estilo" | "velocidad",
    min: number,
    max: number,
  ) => (
    <Campo etiqueta={`${etiqueta}: ${(config[campo] ?? 0).toFixed(2)}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={config[campo] ?? min}
        onChange={(e) => cambiar({ [campo]: Number(e.target.value) } as Partial<typeof config>)}
        className="w-full accent-primary"
      />
    </Campo>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="panel space-y-3 p-4">
        <h2 className="font-display text-sm font-semibold">Voz</h2>
        <div className="flex flex-wrap gap-2">
          <select value={idioma} onChange={(e) => setIdioma(e.target.value)} className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm">
            <option value="">Todos los idiomas</option>
            {idiomas.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <select value={genero} onChange={(e) => setGenero(e.target.value)} className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm">
            <option value="">Cualquier género</option>
            {generos.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {lista.map((v) => (
            <li
              key={v.id}
              className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 ${
                config.voz_id === v.id ? "border-primary/40 bg-primary/10" : "border-border bg-surface"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{v.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[v.idioma, v.genero, v.acento, v.categoria].filter(Boolean).join(" · ") || v.descripcion || "Voz"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {v.muestra_url ? (
                  <Boton variante="suave" type="button" onClick={() => setMuestra(v.muestra_url ?? null)}>
                    <Play className="size-3.5" />
                  </Boton>
                ) : null}
                <Boton
                  variante="suave"
                  type="button"
                  onClick={() => cambiar({ voz_id: v.id, voz_nombre: v.nombre })}
                >
                  Usar
                </Boton>
              </div>
            </li>
          ))}
          {lista.length === 0 ? <li className="text-sm text-muted-foreground">No hay voces disponibles.</li> : null}
        </ul>
        {muestra ? <audio controls autoPlay src={muestra} className="w-full" /> : null}
      </div>

      <div className="panel space-y-3 p-4">
        <h2 className="font-display text-sm font-semibold">Ajustes de locución</h2>
        <Campo etiqueta="Modelo">
          <select value={config.modelo ?? ""} onChange={(e) => cambiar({ modelo: e.target.value })} className={claseCampo}>
            {MODELOS.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.texto}
              </option>
            ))}
          </select>
        </Campo>
        {deslizador("Estabilidad", "estabilidad", 0, 1)}
        {deslizador("Similitud", "similitud", 0, 1)}
        {deslizador("Estilo", "estilo", 0, 1)}
        {deslizador("Velocidad", "velocidad", 0.7, 1.2)}
        <Campo etiqueta="Servicio de capturas" pista="Dirección base del servicio que hace las capturas de pantalla.">
          <input
            defaultValue={config.servicio_capturas ?? ""}
            onBlur={(e) => cambiar({ servicio_capturas: e.target.value })}
            className={claseCampo}
          />
        </Campo>
        <div className="flex flex-wrap items-center gap-2">
          <Boton
            type="button"
            variante="suave"
            disabled={locutar.isPending}
            onClick={() =>
              void locutar
                .mutateAsync({ texto: "Hola, esta es una prueba de la voz elegida para las demostraciones.", titulo: "Prueba de voz" })
                .then((r) => setPrueba(r.url ?? null))
            }
          >
            {locutar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />} Probar voz
          </Boton>
          {prueba ? <audio controls autoPlay src={prueba} className="flex-1" /> : null}
        </div>
      </div>
    </div>
  );
}

/* --------------------- Bloque para la ficha de proyecto ------------------- */

export function BloqueDemo({ proyectoId }: { proyectoId: string }) {
  const { data: guiones = [] } = useGuionesDemo(proyectoId);
  const [demo, setDemo] = React.useState<GuionDemoRow | null>(null);
  const ultimo = guiones[0];

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Demo</h2>
        <Link to="/voz" className="text-xs text-primary hover:underline">
          Voz y demos
        </Link>
      </div>
      {ultimo ? (
        <>
          <p className="mt-2 text-sm">{ultimo.titulo}</p>
          <p className="text-xs text-muted-foreground">
            {(ultimo.escenas ?? []).length} escenas · {etiquetaPublico(ultimo.publico)} · {formatoFechaHora(ultimo.creado_el)}
          </p>
          <Boton variante="suave" type="button" className="mt-3" onClick={() => setDemo(ultimo)}>
            <Play className="size-4" /> Reproducir demo
          </Boton>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Todavía no hay guion de demostración para este proyecto.</p>
      )}
      {demo ? <ReproductorDemo guion={demo} onCerrar={() => setDemo(null)} /> : null}
    </div>
  );
}
