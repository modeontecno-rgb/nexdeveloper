import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Archive,
  Copy,
  ExternalLink,
  Inbox,
  Mail,
  MessageCircle,
  Mic,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, Selector, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type {
  BandejaEntradaRow,
  BandejaFuenteRow,
  EstadoEntradaBandeja,
  OrigenBandeja,
  Prioridad,
  PropuestaTarea,
  ProyectoRow,
} from "@/lib/nex/db-types";
import { ETIQUETA_PRIORIDAD, desde, formatoFechaHora } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  tonoConfianza,
  useActualizarEntrada,
  useAjustesBandeja,
  useAutorizarGmail,
  useCambiarEstadoEntradas,
  useConfigurarWhatsApp,
  useConvertirEnTarea,
  useDesconectarFuente,
  useEntradasBandeja,
  useFuentesBandeja,
  useGuardarConfiguracionFuente,
  useGuardarPalabrasClave,
  useIngestarTexto,
  useRealtimeBandeja,
  useReclasificar,
  useSincronizarGmail,
} from "@/lib/nex/queries/bandeja";

export const Route = createFileRoute("/bandeja")({
  head: () => ({
    meta: [
      { title: "Bandeja única · NexDeveloper" },
      {
        name: "description",
        content: "Correos, mensajes de WhatsApp y notas de voz clasificados por proyecto y convertidos en tareas.",
      },
      { property: "og:title", content: "Bandeja única · NexDeveloper" },
      {
        property: "og:description",
        content: "Correos, mensajes de WhatsApp y notas de voz clasificados por proyecto y convertidos en tareas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaBandeja,
});

export const ETIQUETA_ORIGEN: Record<OrigenBandeja, string> = {
  gmail: "Gmail",
  whatsapp: "WhatsApp",
  plaud: "Plaud",
  manual: "Manual",
};

export const ETIQUETA_ESTADO_ENTRADA: Record<EstadoEntradaBandeja, string> = {
  nueva: "Nueva",
  clasificada: "Clasificada",
  convertida: "Convertida",
  archivada: "Archivada",
  descartada: "Descartada",
};

export function IconoOrigen({ origen, className = "size-4" }: { origen: OrigenBandeja; className?: string }) {
  if (origen === "gmail") return <Mail className={`${className} text-primary`} />;
  if (origen === "whatsapp") return <MessageCircle className={`${className} text-success`} />;
  if (origen === "plaud") return <Mic className={`${className} text-warning`} />;
  return <Inbox className={`${className} text-muted-foreground`} />;
}

function hoy(iso: string | null) {
  if (!iso) return false;
  const f = new Date(iso);
  const n = new Date();
  return f.getFullYear() === n.getFullYear() && f.getMonth() === n.getMonth() && f.getDate() === n.getDate();
}

function PantallaBandeja() {
  const { data: entradas = [], isPending } = useEntradasBandeja();
  const { data: proyectos = [] } = useProyectos();
  const { data: ajustes } = useAjustesBandeja();
  useRealtimeBandeja();

  const sincronizar = useSincronizarGmail();
  const cambiarEstado = useCambiarEstadoEntradas();

  const [filtroOrigen, setFiltroOrigen] = React.useState("todos");
  const [filtroEstado, setFiltroEstado] = React.useState("pendientes");
  const [filtroProyecto, setFiltroProyecto] = React.useState("todos");
  const [texto, setTexto] = React.useState("");
  const [seleccion, setSeleccion] = React.useState<string[]>([]);
  const [abiertaId, setAbiertaId] = React.useState<string | null>(null);
  const [panelFuentes, setPanelFuentes] = React.useState(false);
  const [dialogoTexto, setDialogoTexto] = React.useState(false);
  const [panelPalabras, setPanelPalabras] = React.useState(false);

  const visibles = entradas.filter((e) => {
    const coincideEstado =
      filtroEstado === "todos"
        ? true
        : filtroEstado === "pendientes"
          ? e.estado === "nueva" || e.estado === "clasificada"
          : e.estado === filtroEstado;
    const busca = texto.trim().toLowerCase();
    return (
      coincideEstado &&
      (filtroOrigen === "todos" || e.origen === filtroOrigen) &&
      (filtroProyecto === "todos" || e.proyecto_id === filtroProyecto) &&
      (busca === "" ||
        [e.asunto, e.texto, e.resumen, e.remitente, e.remitente_nombre]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(busca)))
    );
  });

  const pendientesTotal = entradas.filter((e) => e.estado === "nueva" || e.estado === "clasificada").length;
  const porOrigen = (o: OrigenBandeja) =>
    entradas.filter((e) => e.origen === o && (e.estado === "nueva" || e.estado === "clasificada")).length;
  const convertidasHoy = entradas.filter((e) => e.estado === "convertida" && hoy(e.creado_el)).length;

  const alternar = (id: string) =>
    setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const enBloque = async (estado: EstadoEntradaBandeja) => {
    try {
      await cambiarEstado.mutateAsync({ ids: seleccion, estado });
      toast.success(`${seleccion.length} entradas actualizadas.`);
      setSeleccion([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido actualizar.");
    }
  };

  const abierta = entradas.find((e) => e.id === abiertaId) ?? null;

  return (
    <>
      <Encabezado
        titulo="Bandeja única"
        descripcion="Correos, mensajes de WhatsApp y notas de voz, clasificados por proyecto y listos para convertirse en tareas."
        acciones={
          <>
            <Boton
              variante="suave"
              disabled={sincronizar.isPending}
              onClick={async () => {
                try {
                  const res = await sincronizar.mutateAsync();
                  toast.success(`Gmail sincronizado · ${res.nuevas ?? 0} entradas nuevas`);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "No se ha podido sincronizar.");
                }
              }}
            >
              <RefreshCw className={`size-4 ${sincronizar.isPending ? "animate-spin" : ""}`} /> Sincronizar Gmail
            </Boton>
            <Boton variante="suave" onClick={() => setDialogoTexto(true)}>
              <Plus className="size-4" /> Añadir texto
            </Boton>
            <Boton onClick={() => setPanelFuentes(true)}>
              <Settings2 className="size-4" /> Fuentes
            </Boton>
          </>
        }
      />

      {ajustes && ajustes.clasificador_ia === null ? (
        <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          Sin clasificador de inteligencia artificial: las entradas se reparten por palabras clave.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metrica titulo="Pendientes" valor={String(pendientesTotal)} pie="Esperan tu decisión" />
        <Metrica titulo="Gmail" valor={String(porOrigen("gmail"))} pie="Correos por revisar" />
        <Metrica titulo="WhatsApp" valor={String(porOrigen("whatsapp"))} pie="Mensajes por revisar" />
        <Metrica titulo="Notas de voz" valor={String(porOrigen("plaud"))} pie="Plaud por revisar" />
        <Metrica titulo="Convertidas hoy" valor={String(convertidasHoy)} pie="Ya son tareas" tono="text-success" />
      </section>

      <div className="panel mt-6 flex flex-wrap items-center gap-3 p-4">
        <label className="flex flex-1 items-center gap-2 text-sm">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar en la bandeja"
            className="w-full min-w-[10rem] bg-transparent text-sm text-foreground outline-none"
          />
        </label>
        <Selector
          etiqueta="Origen"
          valor={filtroOrigen}
          onChange={setFiltroOrigen}
          opciones={[
            { valor: "todos", texto: "Todos" },
            ...Object.entries(ETIQUETA_ORIGEN).map(([valor, txt]) => ({ valor, texto: txt })),
          ]}
        />
        <Selector
          etiqueta="Estado"
          valor={filtroEstado}
          onChange={setFiltroEstado}
          opciones={[
            { valor: "pendientes", texto: "Nuevas y clasificadas" },
            { valor: "todos", texto: "Todos" },
            ...Object.entries(ETIQUETA_ESTADO_ENTRADA).map(([valor, txt]) => ({ valor, texto: txt })),
          ]}
        />
        <Selector
          etiqueta="Proyecto"
          valor={filtroProyecto}
          onChange={setFiltroProyecto}
          opciones={[
            { valor: "todos", texto: "Todos" },
            ...proyectos.map((p) => ({ valor: p.id, texto: p.nombre })),
          ]}
        />
        <Boton variante="suave" onClick={() => setPanelPalabras(true)}>
          <Wand2 className="size-4" /> Palabras clave
        </Boton>
      </div>

      {seleccion.length > 0 ? (
        <div className="panel mt-4 flex flex-wrap items-center gap-3 p-3">
          <span className="text-sm text-muted-foreground">{seleccion.length} seleccionadas</span>
          <Boton variante="suave" onClick={() => void enBloque("archivada")}>
            <Archive className="size-4" /> Archivar
          </Boton>
          <Boton variante="peligro" onClick={() => void enBloque("descartada")}>
            <Trash2 className="size-4" /> Descartar
          </Boton>
          <Boton variante="suave" onClick={() => setSeleccion([])}>
            Quitar selección
          </Boton>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {visibles.map((entrada) => (
          <TarjetaEntrada
            key={entrada.id}
            entrada={entrada}
            proyectos={proyectos}
            seleccionada={seleccion.includes(entrada.id)}
            onSeleccionar={() => alternar(entrada.id)}
            onAbrir={() => setAbiertaId(entrada.id)}
          />
        ))}
        {!isPending && visibles.length === 0 ? (
          <p className="panel p-6 text-sm text-muted-foreground">Ninguna entrada cumple estos filtros.</p>
        ) : null}
      </div>

      <DialogoTexto abierto={dialogoTexto} onCerrar={() => setDialogoTexto(false)} />
      {panelFuentes ? <PanelFuentes onCerrar={() => setPanelFuentes(false)} /> : null}
      {panelPalabras ? <PanelPalabrasClave onCerrar={() => setPanelPalabras(false)} /> : null}
      {abierta ? <PanelEntrada entrada={abierta} onCerrar={() => setAbiertaId(null)} /> : null}
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

function TarjetaEntrada({
  entrada,
  proyectos,
  seleccionada,
  onSeleccionar,
  onAbrir,
}: {
  entrada: BandejaEntradaRow;
  proyectos: ProyectoRow[];
  seleccionada: boolean;
  onSeleccionar: () => void;
  onAbrir: () => void;
}) {
  const actualizar = useActualizarEntrada();
  const convertir = useConvertirEnTarea();
  const reclasificar = useReclasificar();
  const cambiarEstado = useCambiarEstadoEntradas();

  const propuesta = entrada.propuesta ?? {};
  const [titulo, setTitulo] = React.useState(propuesta.titulo ?? entrada.asunto ?? "");
  const [prioridad, setPrioridad] = React.useState<Prioridad>(propuesta.prioridad ?? "media");
  const [atencion, setAtencion] = React.useState(Boolean(propuesta.requiere_atencion));
  const [instrucciones, setInstrucciones] = React.useState(propuesta.instrucciones ?? "");

  const nombreProyecto = proyectos.find((p) => p.id === entrada.proyecto_id)?.nombre ?? null;
  const confianza = entrada.proyecto_confianza;

  const convertida = entrada.estado === "convertida";

  return (
    <article className={`panel p-4 ${seleccionada ? "border-primary/60" : ""}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={seleccionada}
          onChange={onSeleccionar}
          aria-label="Seleccionar entrada"
          className="mt-1"
        />
        <button type="button" onClick={onAbrir} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <IconoOrigen origen={entrada.origen} />
            <span className="text-sm font-medium text-foreground">
              {entrada.remitente_nombre ?? entrada.remitente ?? ETIQUETA_ORIGEN[entrada.origen]}
            </span>
            <span className="text-xs text-muted-foreground" title={formatoFechaHora(entrada.fecha)}>
              {desde(entrada.fecha ?? entrada.creado_el)}
            </span>
            <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted-foreground">
              {ETIQUETA_ESTADO_ENTRADA[entrada.estado]}
            </span>
          </div>
          <h3 className="mt-2 truncate font-display text-sm font-semibold">
            {entrada.asunto ?? (entrada.texto ?? "").slice(0, 90) ?? "Sin asunto"}
          </h3>
          {entrada.resumen ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entrada.resumen}</p>
          ) : null}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${tonoConfianza(confianza)}`}>
          {nombreProyecto ?? "Sin proyecto"}
          {confianza !== null ? ` · ${Math.round(confianza * 100)}%` : ""}
        </span>
        <select
          value={entrada.proyecto_id ?? ""}
          onChange={(e) => {
            const valor = e.target.value || null;
            void actualizar
              .mutateAsync({
                id: entrada.id,
                cambios: { proyecto_id: valor, proyecto_confirmado: true, proyecto_confianza: valor ? 1 : null },
              })
              .then(() => toast.success("Proyecto confirmado."))
              .catch((err: unknown) =>
                toast.error(err instanceof Error ? err.message : "No se ha podido cambiar el proyecto."),
              );
          }}
          className="rounded-md border border-input bg-surface px-2 py-1 text-xs text-foreground"
        >
          <option value="">Sin proyecto</option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        {entrada.proyecto_confirmado ? (
          <span className="text-xs text-success">confirmado por ti</span>
        ) : null}
        {(entrada.adjuntos ?? []).map((a) => (
          <span
            key={a.nombre}
            className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted-foreground"
          >
            {a.nombre}
          </span>
        ))}
        {entrada.url_original ? (
          <a
            href={entrada.url_original}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Abrir original <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>

      {!convertida ? (
        <div className="mt-4 grid gap-3 rounded-lg border border-border bg-surface/60 p-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo etiqueta="Título de la tarea">
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={claseCampo} />
            </Campo>
          </div>
          <Campo etiqueta="Prioridad">
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as Prioridad)}
              className={claseCampo}
            >
              {Object.entries(ETIQUETA_PRIORIDAD).map(([valor, txt]) => (
                <option key={valor} value={valor}>
                  {txt}
                </option>
              ))}
            </select>
          </Campo>
          <label className="flex items-center gap-2 self-end text-sm text-muted-foreground">
            <input type="checkbox" checked={atencion} onChange={(e) => setAtencion(e.target.checked)} />
            Requiere mi atención
          </label>
          <div className="sm:col-span-2">
            <Campo etiqueta="Instrucciones para el agente">
              <textarea
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                rows={2}
                className={claseCampo}
              />
            </Campo>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {convertida && entrada.tarea_id ? (
          <span className="text-xs text-success">Ya convertida en tarea</span>
        ) : (
          <Boton
            disabled={convertir.isPending || titulo.trim() === ""}
            onClick={async () => {
              try {
                const res = await convertir.mutateAsync({
                  entrada_id: entrada.id,
                  proyecto_id: entrada.proyecto_id,
                  propuesta: {
                    titulo: titulo.trim(),
                    descripcion: entrada.resumen ?? entrada.texto ?? "",
                    prioridad,
                    requiere_atencion: atencion,
                    instrucciones: instrucciones.trim(),
                  } satisfies PropuestaTarea,
                });
                toast.success(res.tarea_id ? "Tarea creada." : "Entrada convertida.");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "No se ha podido crear la tarea.");
              }
            }}
          >
            <Sparkles className="size-4" /> Crear tarea
          </Boton>
        )}
        <Boton
          variante="suave"
          disabled={reclasificar.isPending}
          onClick={async () => {
            try {
              await reclasificar.mutateAsync(entrada.id);
              toast.success("Entrada reclasificada.");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "No se ha podido reclasificar.");
            }
          }}
        >
          <RefreshCw className={`size-4 ${reclasificar.isPending ? "animate-spin" : ""}`} /> Reclasificar
        </Boton>
        <Boton
          variante="suave"
          onClick={() => void cambiarEstado.mutateAsync({ ids: [entrada.id], estado: "archivada" })}
        >
          <Archive className="size-4" /> Archivar
        </Boton>
        <Boton
          variante="peligro"
          onClick={() => void cambiarEstado.mutateAsync({ ids: [entrada.id], estado: "descartada" })}
        >
          <Trash2 className="size-4" /> Descartar
        </Boton>
      </div>
    </article>
  );
}

function Lateral({
  titulo,
  descripcion,
  onCerrar,
  children,
}: {
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onCerrar}>
      <aside
        className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-background p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">{titulo}</h2>
            {descripcion ? <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p> : null}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </aside>
    </div>
  );
}

function PanelEntrada({ entrada, onCerrar }: { entrada: BandejaEntradaRow; onCerrar: () => void }) {
  return (
    <Lateral
      titulo={entrada.asunto ?? "Entrada"}
      descripcion={`${ETIQUETA_ORIGEN[entrada.origen]} · ${formatoFechaHora(entrada.fecha ?? entrada.creado_el)}`}
      onCerrar={onCerrar}
    >
      <p className="text-sm text-muted-foreground">
        {entrada.remitente_nombre ?? ""} {entrada.remitente ? `<${entrada.remitente}>` : ""}
      </p>
      {entrada.resumen ? (
        <div className="panel mt-4 p-4">
          <p className="text-xs text-muted-foreground">Resumen</p>
          <p className="mt-1 text-sm">{entrada.resumen}</p>
        </div>
      ) : null}
      <div className="panel mt-4 whitespace-pre-wrap p-4 text-sm">{entrada.texto ?? "Sin texto."}</div>
    </Lateral>
  );
}

function DialogoTexto({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const ingestar = useIngestarTexto();
  const [asunto, setAsunto] = React.useState("");
  const [texto, setTexto] = React.useState("");

  React.useEffect(() => {
    if (abierto) {
      setAsunto("");
      setTexto("");
    }
  }, [abierto]);

  return (
    <Dialogo
      abierto={abierto}
      titulo="Añadir texto a la bandeja"
      descripcion="Pega un correo, una nota o dicta con el teclado; se clasificará igual que el resto."
      onCerrar={onCerrar}
    >
      <div className="grid gap-4">
        <Campo etiqueta="Asunto">
          <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Texto">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={7} className={claseCampo} />
        </Campo>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Boton variante="suave" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton
          disabled={texto.trim() === "" || ingestar.isPending}
          onClick={async () => {
            try {
              await ingestar.mutateAsync({ asunto: asunto.trim() || undefined, texto: texto.trim() });
              toast.success("Añadido a la bandeja.");
              onCerrar();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "No se ha podido añadir.");
            }
          }}
        >
          Añadir
        </Boton>
      </div>
    </Dialogo>
  );
}

function copiar(valor: string) {
  void navigator.clipboard.writeText(valor).then(
    () => toast.success("Copiado."),
    () => toast.error("No se ha podido copiar."),
  );
}

function PanelFuentes({ onCerrar }: { onCerrar: () => void }) {
  const { data: fuentes = [] } = useFuentesBandeja();
  const { data: ajustes } = useAjustesBandeja();
  const { data: entradas = [] } = useEntradasBandeja();

  const gmail = fuentes.find((f) => f.origen === "gmail") ?? null;
  const whatsapp = fuentes.find((f) => f.origen === "whatsapp") ?? null;
  const plaud = fuentes.find((f) => f.origen === "plaud") ?? null;

  return (
    <Lateral titulo="Fuentes de la bandeja" descripcion="Conecta de dónde llegan los mensajes." onCerrar={onCerrar}>
      <div className="space-y-4">
        <TarjetaGmail fuente={gmail} googleOauth={ajustes?.google_oauth ?? false} />
        <TarjetaWhatsApp fuente={whatsapp} urlWebhook={ajustes?.url_webhook_whatsapp ?? null} />
        <div className="panel p-4">
          <div className="flex items-center gap-2">
            <Mic className="size-4 text-warning" />
            <h3 className="font-display text-sm font-semibold">Notas de voz Plaud</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Comparte tus notas desde la aplicación de Plaud por correo a tu Gmail; llegan aquí clasificadas.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {entradas.filter((e) => e.origen === "plaud").length} notas recibidas
            {plaud?.ultima_sincronizacion ? ` · última hace ${desde(plaud.ultima_sincronizacion)}` : ""}
          </p>
        </div>
      </div>
    </Lateral>
  );
}

function TarjetaGmail({ fuente, googleOauth }: { fuente: BandejaFuenteRow | null; googleOauth: boolean }) {
  const autorizar = useAutorizarGmail();
  const desconectar = useDesconectarFuente();
  const guardar = useGuardarConfiguracionFuente();

  const configuracion = (fuente?.configuracion ?? {}) as {
    consulta?: string;
    etiqueta?: string;
    solo_no_leidos?: boolean;
  };
  const [consulta, setConsulta] = React.useState(configuracion.consulta ?? "");
  const [etiqueta, setEtiqueta] = React.useState(configuracion.etiqueta ?? "");
  const [soloNoLeidos, setSoloNoLeidos] = React.useState(configuracion.solo_no_leidos ?? true);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-primary" />
          <h3 className="font-display text-sm font-semibold">Gmail</h3>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${
            fuente?.conectada
              ? "border-success/40 bg-success/10 text-success"
              : "border-border bg-surface text-muted-foreground"
          }`}
        >
          {fuente?.conectada ? "Conectado" : "Desconectado"}
        </span>
      </div>
      {fuente?.cuenta ? <p className="mt-2 text-sm text-muted-foreground">{fuente.cuenta}</p> : null}

      {!googleOauth ? (
        <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Faltan las credenciales de Google en el servidor. Al pulsar «Conectar con Google» verás qué falta y qué
          dirección de retorno hay que dar de alta en Google Cloud.
        </p>
      ) : null}

      <div className="mt-3 grid gap-3">
        <Campo etiqueta="Consulta de Gmail" pista="Por ejemplo: from:plaud OR label:proyectos">
          <input value={consulta} onChange={(e) => setConsulta(e.target.value)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Etiqueta">
          <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} className={claseCampo} />
        </Campo>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={soloNoLeidos}
            onChange={(e) => setSoloNoLeidos(e.target.checked)}
          />
          Solo correos sin leer
        </label>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Última sincronización {fuente?.ultima_sincronizacion ? desde(fuente.ultima_sincronizacion) : "nunca"}
        {fuente?.resultado ? ` · ${fuente.resultado}` : ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {fuente?.conectada ? (
          <Boton
            variante="peligro"
            onClick={async () => {
              try {
                await desconectar.mutateAsync("gmail");
                toast.success("Gmail desconectado.");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "No se ha podido desconectar.");
              }
            }}
          >
            Desconectar
          </Boton>
        ) : (
          <Boton
            onClick={async () => {
              try {
                const res = await autorizar.mutateAsync();
                if (res.url) window.open(res.url, "_blank", "noopener,width=520,height=680");
                else toast.error("El servidor no ha devuelto la dirección de autorización.");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "No se ha podido iniciar la conexión.");
              }
            }}
          >
            Conectar con Google
          </Boton>
        )}
        {fuente ? (
          <Boton
            variante="suave"
            onClick={async () => {
              try {
                await guardar.mutateAsync({
                  id: fuente.id,
                  configuracion: {
                    consulta: consulta.trim(),
                    etiqueta: etiqueta.trim(),
                    solo_no_leidos: soloNoLeidos,
                  },
                });
                toast.success("Configuración guardada.");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "No se ha podido guardar.");
              }
            }}
          >
            Guardar configuración
          </Boton>
        ) : null}
      </div>
    </div>
  );
}

function TarjetaWhatsApp({
  fuente,
  urlWebhook,
}: {
  fuente: BandejaFuenteRow | null;
  urlWebhook: string | null;
}) {
  const configurar = useConfigurarWhatsApp();
  const configuracion = (fuente?.configuracion ?? {}) as { phone_number_id?: string; verify_token?: string };

  const [phoneId, setPhoneId] = React.useState(configuracion.phone_number_id ?? "");
  const [token, setToken] = React.useState("");
  const [numero, setNumero] = React.useState(fuente?.cuenta ?? "");
  const [webhook, setWebhook] = React.useState<string | null>(urlWebhook);
  const [verify, setVerify] = React.useState<string | null>(configuracion.verify_token ?? null);
  const [ayuda, setAyuda] = React.useState(false);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-success" />
          <h3 className="font-display text-sm font-semibold">WhatsApp Business</h3>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${
            fuente?.conectada
              ? "border-success/40 bg-success/10 text-success"
              : "border-border bg-surface text-muted-foreground"
          }`}
        >
          {fuente?.conectada ? "Conectado" : "Sin configurar"}
        </span>
      </div>

      <div className="mt-3 grid gap-3">
        <Campo etiqueta="Identificador del número (phone number id)">
          <input value={phoneId} onChange={(e) => setPhoneId(e.target.value)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Token de acceso de Meta" pista="Se guarda cifrado; nunca vuelve a mostrarse.">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="••••••••"
            className={claseCampo}
          />
        </Campo>
        <Campo etiqueta="Número de teléfono">
          <input value={numero} onChange={(e) => setNumero(e.target.value)} className={claseCampo} />
        </Campo>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Boton
          disabled={phoneId.trim() === "" || configurar.isPending}
          onClick={async () => {
            try {
              const res = await configurar.mutateAsync({
                phone_number_id: phoneId.trim(),
                ...(token.trim() ? { access_token: token.trim() } : {}),
                ...(numero.trim() ? { numero: numero.trim() } : {}),
              });
              setWebhook(res.url_webhook ?? null);
              setVerify(res.verify_token ?? null);
              setToken("");
              toast.success("WhatsApp configurado.");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "No se ha podido configurar.");
            }
          }}
        >
          Guardar
        </Boton>
        <Boton variante="suave" onClick={() => setAyuda((v) => !v)}>
          {ayuda ? "Ocultar pasos" : "Ver pasos en Meta"}
        </Boton>
      </div>

      {webhook ? (
        <div className="mt-3 space-y-2">
          <FilaCopiar etiqueta="Dirección del webhook" valor={webhook} />
          {verify ? <FilaCopiar etiqueta="Token de verificación" valor={verify} /> : null}
        </div>
      ) : null}

      {ayuda ? (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Entra en Meta for Developers y abre tu aplicación de WhatsApp.</li>
          <li>Ve a WhatsApp → Configuración → Webhooks y pulsa «Editar».</li>
          <li>Pega la dirección del webhook y el token de verificación de arriba.</li>
          <li>Suscríbete al campo «messages» y guarda.</li>
        </ol>
      ) : null}
    </div>
  );
}

function FilaCopiar({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{etiqueta}</p>
        <p className="truncate text-xs text-foreground">{valor}</p>
      </div>
      <button
        type="button"
        onClick={() => copiar(valor)}
        aria-label={`Copiar ${etiqueta}`}
        className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:text-foreground"
      >
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}

function PanelPalabrasClave({ onCerrar }: { onCerrar: () => void }) {
  const { data: proyectos = [] } = useProyectos();
  const guardar = useGuardarPalabrasClave();
  const [nuevas, setNuevas] = React.useState<Record<string, string>>({});

  const cambiar = async (proyectoId: string, palabras: string[]) => {
    try {
      await guardar.mutateAsync({ proyectoId, palabras });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido guardar.");
    }
  };

  return (
    <Lateral
      titulo="Palabras clave por proyecto"
      descripcion="Con estas palabras se reparte automáticamente cada mensaje que llega."
      onCerrar={onCerrar}
    >
      <div className="space-y-3">
        {proyectos.map((p) => {
          const palabras = p.palabras_clave ?? [];
          return (
            <div key={p.id} className="panel p-4">
              <h3 className="font-display text-sm font-semibold">{p.nombre}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {palabras.map((palabra) => (
                  <span
                    key={palabra}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {palabra}
                    <button
                      type="button"
                      aria-label={`Quitar ${palabra}`}
                      onClick={() => void cambiar(p.id, palabras.filter((x) => x !== palabra))}
                      className="text-muted-foreground transition hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {palabras.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Sin palabras clave.</span>
                ) : null}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={nuevas[p.id] ?? ""}
                  onChange={(e) => setNuevas((n) => ({ ...n, [p.id]: e.target.value }))}
                  placeholder="Añadir palabra y pulsar Intro"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const valor = (nuevas[p.id] ?? "").trim().toLowerCase();
                    if (!valor || palabras.includes(valor)) return;
                    setNuevas((n) => ({ ...n, [p.id]: "" }));
                    void cambiar(p.id, [...palabras, valor]);
                  }}
                  className={claseCampo}
                />
              </div>
            </div>
          );
        })}
      </div>
      <Link to="/proyectos" className="mt-4 inline-flex text-xs text-primary hover:underline">
        Ver proyectos
      </Link>
    </Lateral>
  );
}
