import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronDown,
  ClipboardCheck,
  Download,
  Loader2,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { useTrabajo } from "@/components/nex/indicador-trabajo";
import { sonidoTic } from "@/lib/nex/sonidos";
import { RevisarBorrador } from "@/components/nex/revisar-borrador";
import { Boton, Campo, Selector, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type { DestinoPeticion, PeticionDirectaRow, PlaudGrabacionRow, TipoPeticion } from "@/lib/nex/db-types";
import { desde, formatoEuros, marcaTiempo } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import { markdownAHtml } from "@/lib/nex/queries/resumenes";
import {
  ETIQUETA_ESTADO_GRABACION,
  ETIQUETA_ESTADO_PETICION,
  ETIQUETA_TIPO_PETICION,
  TONO_ESTADO_PETICION,
  duracion,
  tonoVeredicto,
  useAprobarPropuesta,
  useBorrarPeticion,
  useEstadoPideme,
  useGrabacionPlaud,
  useGrabacionesPlaud,
  useBorradores,
  useCrearBorrador,
  useLanzarBorrador,
  usePedir,
  usePeticiones,
  useVincularBorrador,
  usePlaudConectar,
  usePlaudConfigurar,
  usePlaudDescartar,
  usePlaudDesconectar,
  usePlaudImportar,
  usePlaudProbar,
  usePlaudProcesar,
  useRealtimePideme,
  useReclasificar,
  useRechazarPropuesta,
} from "@/lib/nex/queries/pideme";
import { cn } from "@/lib/utils";

type Pestana = "peticiones" | "borradores" | "propuestas" | "plaud";

export const Route = createFileRoute("/pideme")({
  validateSearch: (busqueda: Record<string, unknown>): { tab?: Pestana; peticion?: string } => ({
    ...(typeof busqueda["tab"] === "string" ? { tab: busqueda["tab"] as Pestana } : {}),
    ...(typeof busqueda["peticion"] === "string" ? { peticion: busqueda["peticion"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Pídeme qué quieres · NexDeveloper" },
      {
        name: "description",
        content: "Escribe o dicta lo que necesitas y NexDeveloper decide si es de un proyecto o personal y actúa.",
      },
      { property: "og:title", content: "Pídeme qué quieres · NexDeveloper" },
      {
        property: "og:description",
        content: "Escribe o dicta lo que necesitas y NexDeveloper decide si es de un proyecto o personal y actúa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PidemePantalla,
});

/* -------------------------------- Pantalla -------------------------------- */

function PidemePantalla() {
  const busqueda = Route.useSearch();
  const [destello, setDestello] = React.useState(true);

  React.useEffect(() => {
    sonidoTic();
    const t = window.setTimeout(() => setDestello(false), 1000);
    return () => window.clearTimeout(t);
  }, []);

  const [pestana, setPestana] = React.useState<Pestana>(busqueda.tab ?? "peticiones");
  const { data: peticiones = [] } = usePeticiones();
  const estado = useEstadoPideme();
  useRealtimePideme(true);

  const pendientes = peticiones.filter((p) => p.estado === "propuesta");
  const { data: borradores = [] } = useBorradores();

  return (
    <>
      <Encabezado
        titulo={destello ? "Pídeme qué quieres ✨" : "Pídeme qué quieres"}
        descripcion="Tu tecla directa: escribe o dicta y yo decido si es de un proyecto o personal, y actúo."
        acciones={<BotonImportarPlaud />}
      />

      <BloquePideme />

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["peticiones", "Peticiones"],
            ["borradores", `Pendientes de revisar${borradores.length ? ` (${borradores.length})` : ""}`],
            ["propuestas", `Propuestas pendientes${pendientes.length ? ` (${pendientes.length})` : ""}`],
            ["plaud", "Plaud"],
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
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {pestana === "peticiones" ? <PanelPeticiones peticiones={peticiones} /> : null}
        {pestana === "borradores" ? <PanelBorradores /> : null}
        {pestana === "propuestas" ? <PanelPeticiones peticiones={pendientes} soloPropuestas /> : null}
        {pestana === "plaud" ? <PanelPlaud estadoCargando={estado.isPending} /> : null}
      </div>
    </>
  );
}

/* ---------------------------- Caja de peticiones -------------------------- */

/** Bloque grande «Pídeme qué quieres»: se usa en el inicio y en /pideme. */
export function BloquePideme({ compacto = false }: { compacto?: boolean }) {
  const pedir = usePedir();
  const [texto, setTexto] = React.useState("");
  const [paso, setPaso] = React.useState(0);
  const [resultado, setResultado] = React.useState<{ peticionId: string } | null>(null);
  const [borradorId, setBorradorId] = React.useState<string | null>(null);
  const [usoVoz, setUsoVoz] = React.useState(false);
  const crearBorrador = useCrearBorrador();
  const { data: borradores = [] } = useBorradores();
  const { lanzarBorrador, enCurso } = useLanzarBorradorCompleto();
  const areaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const { escuchando, soportado, alternar } = useDictado((dicho) => {
    setUsoVoz(true);
    setTexto((t) => (t ? `${t} ${dicho}` : dicho));
  });
  const borradorAbierto = borradores.find((b) => b.id === borradorId) ?? null;

  React.useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        areaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  React.useEffect(() => {
    if (!pedir.isPending) {
      setPaso(0);
      return;
    }
    setPaso(1);
    const t = window.setTimeout(() => setPaso(2), 6000);
    return () => window.clearTimeout(t);
  }, [pedir.isPending]);

  const revisar = (origen: "texto" | "voz") => {
    const limpio = texto.trim();
    if (!limpio || crearBorrador.isPending) return;
    crearBorrador.mutate(
      { texto: limpio, origen },
      {
        onSuccess: (b) => {
          setTexto("");
          setUsoVoz(false);
          setBorradorId(b.id);
        },
      },
    );
  };

  const enviar = (origen: "texto" | "voz") => {
    const limpio = texto.trim();
    if (!limpio || pedir.isPending) return;
    // Lo dictado se revisa antes de lanzarse.
    if (origen === "voz") {
      revisar("voz");
      return;
    }
    pedir.mutate(
      { texto: limpio, origen },
      {
        onSuccess: (r) => {
          setTexto("");
          if (r.peticion?.id) setResultado({ peticionId: r.peticion.id });
        },
      },
    );
  };

  return (
    <section className="panel border-primary/30 bg-primary/5 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Sparkles className="size-5 text-primary" /> Pídeme qué quieres
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Escríbelo o dícelo con el micrófono. Yo decido si es de un proyecto o personal.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(usoVoz ? "voz" : "texto");
        }}
        className="mt-3"
      >
        <textarea
          ref={areaRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={compacto ? 2 : 3}
          placeholder="Por ejemplo: en Gericentro quiero que el portal de familias avise por correo cuando haya un informe nuevo."
          className={cn(claseCampo, "resize-y")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              enviar(usoVoz ? "voz" : "texto");
            }
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Boton type="submit" disabled={!texto.trim() || pedir.isPending}>
            {pedir.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Pídemelo
          </Boton>
          <Boton
            type="button"
            variante="suave"
            onClick={() => revisar(usoVoz ? "voz" : "texto")}
            disabled={!texto.trim() || crearBorrador.isPending}
          >
            {crearBorrador.isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
            Revisar antes de lanzar
          </Boton>
          {soportado ? (
            <Boton
              type="button"
              variante="suave"
              onClick={alternar}
              aria-pressed={escuchando}
              className={escuchando ? "border-destructive/40 text-destructive" : ""}
            >
              {escuchando ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              {escuchando ? "Parar" : "Dictar"}
            </Boton>
          ) : null}
          <BotonImportarPlaud />
          <span className="text-xs text-muted-foreground">Atajo: Ctrl/Cmd + J</span>
        </div>
      </form>

      {pedir.isPending ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {paso < 2 ? "Entendiendo lo que pides…" : "Preparando la propuesta con los expertos…"}
        </p>
      ) : null}

      {borradorAbierto ? (
        <div className="mt-4">
          <RevisarBorrador
            borrador={borradorAbierto}
            lanzando={enCurso === borradorAbierto.id}
            onCerrar={() => setBorradorId(null)}
            onLanzar={(id) =>
              void lanzarBorrador(id, (peticionId) => {
                setBorradorId(null);
                setResultado({ peticionId });
              })
            }
          />
        </div>
      ) : null}

      {resultado ? <TarjetaResultado peticionId={resultado.peticionId} /> : null}
    </section>
  );
}

/** Muestra la última petición ya guardada, siempre al día por Realtime. */
function TarjetaResultado({ peticionId }: { peticionId: string }) {
  const { data: peticiones = [] } = usePeticiones();
  const peticion = peticiones.find((p) => p.id === peticionId);
  if (!peticion) return null;
  return (
    <div className="mt-4">
      <TarjetaPeticion peticion={peticion} abiertaPorDefecto />
    </div>
  );
}

/* ------------------------------- Peticiones ------------------------------- */

function PanelPeticiones({ peticiones, soloPropuestas }: { peticiones: PeticionDirectaRow[]; soloPropuestas?: boolean }) {
  const [destino, setDestino] = React.useState<string>("todos");
  const [estado, setEstado] = React.useState<string>("todos");

  const lista = peticiones.filter(
    (p) => (destino === "todos" || p.destino === destino) && (estado === "todos" || p.estado === estado),
  );

  return (
    <div className="space-y-3">
      {soloPropuestas ? null : (
        <div className="panel flex flex-wrap items-center gap-3 p-4">
          <Selector
            etiqueta="Destino"
            valor={destino}
            onChange={setDestino}
            opciones={[
              { valor: "todos", texto: "Todos" },
              { valor: "proyecto", texto: "Proyectos" },
              { valor: "personal", texto: "PERSONAL" },
            ]}
          />
          <Selector
            etiqueta="Estado"
            valor={estado}
            onChange={setEstado}
            opciones={[
              { valor: "todos", texto: "Todos" },
              ...Object.entries(ETIQUETA_ESTADO_PETICION).map(([valor, texto]) => ({ valor, texto })),
            ]}
          />
        </div>
      )}

      {lista.length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">
          {soloPropuestas ? "No hay propuestas esperando tu decisión." : "Todavía no me has pedido nada."}
        </p>
      ) : (
        lista.map((p) => <TarjetaPeticion key={p.id} peticion={p} />)
      )}
    </div>
  );
}

export function TarjetaPeticion({
  peticion,
  abiertaPorDefecto = false,
}: {
  peticion: PeticionDirectaRow;
  abiertaPorDefecto?: boolean;
}) {
  const [abierta, setAbierta] = React.useState(abiertaPorDefecto);
  const [reclasificando, setReclasificando] = React.useState(false);
  const borrar = useBorrarPeticion();
  const clasificacion = peticion.clasificacion ?? {};
  const confianza = Math.round(Number(clasificacion.confianza ?? 0) * (Number(clasificacion.confianza ?? 0) <= 1 ? 100 : 1));
  const url = urlPeticion(peticion);

  return (
    <article className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                peticion.destino === "personal"
                  ? "border-accent/40 bg-accent/10 text-accent-foreground"
                  : "border-primary/40 bg-primary/10 text-primary",
              )}
            >
              {peticion.destino === "personal"
                ? "PERSONAL"
                : `Proyecto: ${clasificacion.proyecto_nombre ?? "sin identificar"}`}
              {clasificacion.tipo ? ` · ${ETIQUETA_TIPO_PETICION[clasificacion.tipo]}` : ""}
            </span>
            <span className={cn("rounded-full border px-2.5 py-0.5 text-xs", TONO_ESTADO_PETICION[peticion.estado])}>
              {ETIQUETA_ESTADO_PETICION[peticion.estado]}
            </span>
            {confianza ? <span className="text-xs text-muted-foreground">confianza {confianza}%</span> : null}
          </div>
          <h3 className="mt-2 font-display text-base font-semibold">{clasificacion.titulo ?? peticion.texto.slice(0, 80)}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{peticion.texto}</p>
          <p className="mt-1 text-xs text-muted-foreground">{marcaTiempo(peticion.creado_el)} · {desde(peticion.creado_el)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Boton variante="suave" className="px-2.5 py-1.5 text-xs" onClick={() => setAbierta((v) => !v)}>
            <ChevronDown className={cn("size-3.5 transition", abierta && "rotate-180")} /> {abierta ? "Cerrar" : "Ver"}
          </Boton>
          <Boton
            variante="peligro"
            className="px-2.5 py-1.5 text-xs"
            onClick={() => borrar.mutate(peticion.id)}
            disabled={borrar.isPending}
          >
            <Trash2 className="size-3.5" />
          </Boton>
        </div>
      </div>

      {peticion.error ? (
        <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {peticion.error}
        </p>
      ) : null}

      {abierta ? (
        <div className="mt-4 space-y-4">
          {peticion.respuesta ? (
            <div
              className="prose-nex text-sm"
              dangerouslySetInnerHTML={{ __html: markdownAHtml(peticion.respuesta) }}
            />
          ) : null}

          {url ? (
            <a href={url} className="inline-flex text-xs text-primary hover:underline">
              Abrir el chat
            </a>
          ) : null}

          {peticion.propuesta ? <BloquePropuesta peticion={peticion} /> : null}

          <div>
            <Boton variante="suave" className="px-2.5 py-1.5 text-xs" onClick={() => setReclasificando(true)}>
              No es eso
            </Boton>
          </div>
        </div>
      ) : null}

      <DialogoReclasificar peticion={peticion} abierto={reclasificando} onCerrar={() => setReclasificando(false)} />
    </article>
  );
}

function urlPeticion(peticion: PeticionDirectaRow) {
  if (peticion.destino === "personal" && peticion.conversacion_id) return `/personal?conversacion=${peticion.conversacion_id}`;
  if (peticion.chat_id && peticion.proyecto_id) return `/proyectos/${peticion.proyecto_id}`;
  return null;
}

function BloquePropuesta({ peticion }: { peticion: PeticionDirectaRow }) {
  const propuesta = peticion.propuesta ?? {};
  const aprobar = useAprobarPropuesta();
  const rechazar = useRechazarPropuesta();
  const [editando, setEditando] = React.useState(false);
  const [orden, setOrden] = React.useState(propuesta.orden_para_la_ia ?? "");
  const bloqueada = peticion.estado !== "propuesta";

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full border px-2.5 py-0.5 text-xs", tonoVeredicto(propuesta.recomendacion))}>
          {propuesta.recomendacion ?? "Sin recomendación"}
        </span>
        {propuesta.riesgo ? (
          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs", tonoVeredicto(propuesta.riesgo))}>
            Riesgo {propuesta.riesgo}
          </span>
        ) : null}
        {propuesta.horas_estimadas ? (
          <span className="text-xs text-muted-foreground">{propuesta.horas_estimadas} h estimadas</span>
        ) : null}
        {propuesta.coste_estimado_eur ? (
          <span className="text-xs text-muted-foreground">{formatoEuros(Number(propuesta.coste_estimado_eur))}</span>
        ) : null}
      </div>

      {propuesta.sintesis ? <p className="mt-3 text-sm text-foreground">{propuesta.sintesis}</p> : null}

      <ListaPropuesta titulo="Plan de trabajo" elementos={propuesta.plan} numerada />
      <ListaPropuesta titulo="Requisitos obligatorios" elementos={propuesta.requisitos_obligatorios} />
      <ListaPropuesta titulo="Riesgos" elementos={propuesta.riesgos} />
      <ListaPropuesta titulo="Decisiones para ti" elementos={propuesta.decisiones_para_javier} />

      {propuesta.revisiones?.length ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Revisión por áreas</p>
          {propuesta.revisiones.map((r, i) => (
            <details key={`${r.area}-${i}`} className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm">
                <span className="font-medium">{r.area ?? "Área"}</span>{" "}
                <span className="text-xs text-muted-foreground">{r.experto ?? ""}</span>{" "}
                <span className={cn("ml-2 rounded-full border px-2 py-0.5 text-xs", tonoVeredicto(r.veredicto))}>
                  {r.veredicto ?? "sin veredicto"}
                </span>
              </summary>
              <ListaPropuesta titulo="Observaciones" elementos={r.observaciones} />
              <ListaPropuesta titulo="Riesgos" elementos={r.riesgos} />
              <ListaPropuesta titulo="Requisitos" elementos={r.requisitos} />
              {r.cambios_sugeridos ? <p className="mt-2 text-sm text-muted-foreground">{r.cambios_sugeridos}</p> : null}
            </details>
          ))}
        </div>
      ) : null}

      {editando ? (
        <div className="mt-4">
          <Campo etiqueta="Orden para la IA" pista="Puedes ajustarla antes de aprobarla.">
            <textarea value={orden} onChange={(e) => setOrden(e.target.value)} rows={6} className={claseCampo} />
          </Campo>
        </div>
      ) : null}

      {bloqueada ? (
        <p className="mt-4 text-xs text-muted-foreground">Esta propuesta ya está {ETIQUETA_ESTADO_PETICION[peticion.estado].toLowerCase()}.</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Boton
            onClick={() => aprobar.mutate({ peticionId: peticion.id, ...(editando && orden ? { orden } : {}) })}
            disabled={aprobar.isPending}
          >
            {aprobar.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {editando ? "Aprobar con estos cambios" : "Aprobar (crear orden para la IA)"}
          </Boton>
          {!editando ? (
            <Boton variante="suave" onClick={() => setEditando(true)}>
              Aprobar con cambios
            </Boton>
          ) : null}
          <Boton variante="peligro" onClick={() => rechazar.mutate({ peticionId: peticion.id })} disabled={rechazar.isPending}>
            Rechazar
          </Boton>
        </div>
      )}
    </div>
  );
}

function ListaPropuesta({
  titulo,
  elementos,
  numerada,
}: {
  titulo: string;
  elementos?: string[] | undefined;
  numerada?: boolean;
}) {
  if (!elementos?.length) return null;
  const Lista = numerada ? "ol" : "ul";
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
      <Lista className={cn("mt-1 space-y-1 pl-5 text-sm", numerada ? "list-decimal" : "list-disc")}>
        {elementos.map((t, i) => (
          <li key={`${titulo}-${i}`}>{t}</li>
        ))}
      </Lista>
    </div>
  );
}

function DialogoReclasificar({
  peticion,
  abierto,
  onCerrar,
}: {
  peticion: PeticionDirectaRow;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const { data: proyectos = [] } = useProyectos();
  const reclasificar = useReclasificar();
  const [destino, setDestino] = React.useState<DestinoPeticion>(peticion.destino ?? "proyecto");
  const [proyectoId, setProyectoId] = React.useState(peticion.proyecto_id ?? "");
  const [tipo, setTipo] = React.useState<TipoPeticion>(peticion.clasificacion?.tipo ?? "consulta");
  const [alias, setAlias] = React.useState("");

  return (
    <Dialogo abierto={abierto} titulo="Corregir el destino" descripcion="Dime dónde iba esto y lo recordaré." onCerrar={onCerrar}>
      <div className="space-y-4">
        <Campo etiqueta="Destino">
          <select value={destino} onChange={(e) => setDestino(e.target.value as DestinoPeticion)} className={claseCampo}>
            <option value="proyecto">Un proyecto</option>
            <option value="personal">PERSONAL</option>
          </select>
        </Campo>
        {destino === "proyecto" ? (
          <>
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
            <Campo etiqueta="Tipo">
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPeticion)} className={claseCampo}>
                {Object.entries(ETIQUETA_TIPO_PETICION).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              etiqueta="Guardar la palabra que usaste como nombre alternativo del proyecto"
              pista="Opcional. Así lo reconoceré la próxima vez que lo llames igual."
            >
              <input value={alias} onChange={(e) => setAlias(e.target.value)} className={claseCampo} />
            </Campo>
          </>
        ) : null}
        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            onClick={() =>
              reclasificar.mutate(
                {
                  peticionId: peticion.id,
                  destino,
                  ...(destino === "proyecto" && proyectoId ? { proyectoId } : {}),
                  ...(destino === "proyecto" ? { tipo } : {}),
                  ...(alias.trim() ? { alias: [alias.trim()] } : {}),
                },
                { onSuccess: onCerrar },
              )
            }
            disabled={reclasificar.isPending || (destino === "proyecto" && !proyectoId)}
          >
            Guardar
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}


/* ------------------------------- Borradores ------------------------------- */

/** Lanza un borrador por el mismo camino que una petición escrita. */
export function useLanzarBorradorCompleto() {
  const lanzar = useLanzarBorrador();
  const pedir = usePedir();
  const vincular = useVincularBorrador();
  const { iniciarTrabajo } = useTrabajo();
  const [enCurso, setEnCurso] = React.useState<string | null>(null);

  const lanzarBorrador = async (id: string, alTerminar?: (peticionId: string) => void) => {
    setEnCurso(id);
    const pasos = [
      "Cerrando el borrador",
      "Entendiendo lo que pides",
      "Preparando la propuesta con los expertos",
      "Guardando el resultado",
    ];
    const trabajo = iniciarTrabajo({ titulo: "Lanzando lo que me has pedido", pasos });
    try {
      trabajo.avanzar(pasos[0]!, 10);
      const borrador = await lanzar.mutateAsync(id);
      trabajo.avanzar(pasos[1]!, 30);
      const respuesta = await pedir.mutateAsync({
        texto: borrador.texto_final,
        origen: "texto",
        proyecto_id: borrador.proyecto_id,
      });
      trabajo.avanzar(
        respuesta.clasificacion?.tipo === "consulta" ? "Respondiendo" : pasos[2]!,
        75,
      );
      const peticionId = respuesta.peticion?.id;
      if (peticionId) {
        trabajo.avanzar(pasos[3]!, 92);
        await vincular.mutateAsync({ borradorId: id, peticionId });
        alTerminar?.(peticionId);
      }
      trabajo.terminar("Tarea lanzada.");
      toast.success("Tarea lanzada.");
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se ha podido lanzar la tarea.";
      trabajo.fallar(mensaje);
      toast.error(mensaje);
    } finally {
      setEnCurso(null);
    }
  };

  return { lanzarBorrador, enCurso };
}

function PanelBorradores() {
  const { data: borradores = [] } = useBorradores();
  const [abiertoId, setAbiertoId] = React.useState<string | null>(null);
  const { lanzarBorrador, enCurso } = useLanzarBorradorCompleto();
  const [resultado, setResultado] = React.useState<string | null>(null);

  const abierto = borradores.find((b) => b.id === abiertoId) ?? null;

  if (abierto) {
    return (
      <div className="space-y-4">
        <RevisarBorrador
          borrador={abierto}
          lanzando={enCurso === abierto.id}
          onCerrar={() => setAbiertoId(null)}
          onLanzar={(id) =>
            void lanzarBorrador(id, (peticionId) => {
              setAbiertoId(null);
              setResultado(peticionId);
            })
          }
        />
        {resultado ? <TarjetaResultado peticionId={resultado} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {resultado ? <TarjetaResultado peticionId={resultado} /> : null}
      {borradores.length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">No hay nada pendiente de revisar.</p>
      ) : (
        borradores.map((b) => {
          const correcciones = Array.isArray(b.correcciones) ? b.correcciones.length : 0;
          return (
            <article key={b.id} className="panel flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm text-foreground">{b.texto.slice(0, 160)}{b.texto.length > 160 ? "…" : ""}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {b.grabacion_id ? "De Plaud" : b.origen === "voz" ? "Dictado" : "Escrito"} ·{" "}
                  {marcaTiempo(b.creado_el)} ·{" "}
                  {correcciones ? `${correcciones} ${correcciones === 1 ? "corrección" : "correcciones"}` : "sin correcciones"}
                </p>
              </div>
              <Boton variante="suave" className="px-2.5 py-1.5 text-xs" onClick={() => setAbiertoId(b.id)}>
                <ClipboardCheck className="size-3.5" /> Revisar
              </Boton>
            </article>
          );
        })
      )}
    </div>
  );
}

/** Contador de borradores pendientes para el menú. */
export function useBorradoresPendientesMenu() {
  const { data = [] } = useBorradores();
  return data.length;
}

/* ---------------------------------- Plaud -------------------------------- */

/** Botón para traerse las grabaciones del Plaud. Se usa en varias pantallas. */
export function BotonImportarPlaud({ className }: { className?: string }) {
  const importar = usePlaudImportar();
  const procesar = usePlaudProcesar();
  const estado = useEstadoPideme();
  const { iniciarTrabajo } = useTrabajo();
  const auto = Boolean(estado.data?.plaud_config?.procesar_automatico);

  const traer = async () => {
    const pasos = ["Conectando con Plaud", "Descargando grabaciones", "Guardando transcripciones"];
    const trabajo = iniciarTrabajo({ titulo: "Importar de Plaud", pasos });
    try {
      trabajo.avanzar(pasos[0]!, 15);
      trabajo.avanzar(pasos[1]!, 45);
      const r = await importar.mutateAsync(undefined);
      const resumen =
        typeof r.nuevas === "number"
          ? `${r.nuevas} ${r.nuevas === 1 ? "grabación nueva" : "grabaciones nuevas"} de ${r.total_plaud ?? 0}`
          : "Grabaciones al día.";
      if (auto) {
        trabajo.avanzar(pasos[2]!, 80);
        await procesar.mutateAsync(undefined);
      }
      trabajo.terminar(resumen);
    } catch (e) {
      trabajo.fallar(e instanceof Error ? e.message : "No se ha podido importar de Plaud.");
    }
  };

  return (
    <Boton
      variante="suave"
      className={className ?? ""}
      disabled={importar.isPending || procesar.isPending}
      onClick={() => void traer()}
    >
      {importar.isPending || procesar.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      Importar de Plaud
    </Boton>
  );
}

/** Tarjeta de conexión con Plaud: se usa en /pideme y en Ajustes → Conexiones. */
export function TarjetaPlaudConexion() {
  const estado = useEstadoPideme();
  const conectar = usePlaudConectar();
  const desconectar = usePlaudDesconectar();
  const probar = usePlaudProbar();
  const configurar = usePlaudConfigurar();
  const plaud = estado.data?.plaud;
  const config = estado.data?.plaud_config;

  const [importarAuto, setImportarAuto] = React.useState(false);
  const [procesarAuto, setProcesarAuto] = React.useState(false);
  const [desdeFecha, setDesdeFecha] = React.useState("");

  React.useEffect(() => {
    if (!config) return;
    setImportarAuto(Boolean(config.importar_automatico));
    setProcesarAuto(Boolean(config.procesar_automatico));
    setDesdeFecha((config.desde ?? "").slice(0, 10));
  }, [config]);

  const conectado = plaud?.estado === "conectada" || plaud?.estado === "conectado" || Boolean(plaud?.cuenta);
  const tono = plaud?.ultimo_error
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : conectado
      ? "border-success/40 bg-success/10 text-success"
      : "border-border bg-muted text-muted-foreground";

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Plaud</h2>
        <span className={cn("rounded-full border px-2.5 py-0.5 text-xs", tono)}>
          {plaud?.ultimo_error ? "Con error" : conectado ? `Conectado · ${plaud?.cuenta ?? "cuenta"}` : "Sin conectar"}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Conecta tu grabadora Plaud y trae las grabaciones con un clic. Pasan por el mismo clasificador que todo lo demás.
      </p>
      {plaud?.ultimo_error ? <p className="mt-2 text-sm text-destructive">{plaud.ultimo_error}</p> : null}
      {plaud?.ultima_comprobacion ? (
        <p className="mt-1 text-xs text-muted-foreground">Última comprobación {desde(plaud.ultima_comprobacion)}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Boton
          onClick={() =>
            conectar.mutate(undefined, {
              onSuccess: (r) => {
                if (!r.url) {
                  toast.error("Plaud no ha devuelto la dirección para conectar.");
                  return;
                }
                const ventana = window.open(r.url, "_blank", "width=520,height=720");
                const reloj = window.setInterval(() => {
                  if (ventana?.closed) {
                    window.clearInterval(reloj);
                    void estado.refetch();
                  }
                }, 1000);
              },
            })
          }
          disabled={conectar.isPending}
        >
          {conectar.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Conectar Plaud
        </Boton>
        <Boton variante="suave" onClick={() => probar.mutate()} disabled={probar.isPending}>
          Probar
        </Boton>
        <Boton variante="peligro" onClick={() => desconectar.mutate()} disabled={desconectar.isPending}>
          Desconectar
        </Boton>
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={importarAuto} onChange={(e) => setImportarAuto(e.target.checked)} />
          Importar automáticamente cada 30 minutos
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={procesarAuto} onChange={(e) => setProcesarAuto(e.target.checked)} />
          Procesar automáticamente lo que llegue
        </label>
        <Campo etiqueta="No importar grabaciones anteriores a">
          <input type="date" value={desdeFecha} onChange={(e) => setDesdeFecha(e.target.value)} className={claseCampo} />
        </Campo>
        <Boton
          variante="suave"
          onClick={() =>
            configurar.mutate({
              importar_automatico: importarAuto,
              procesar_automatico: procesarAuto,
              desde: desdeFecha || null,
            })
          }
          disabled={configurar.isPending}
        >
          Guardar configuración
        </Boton>
      </div>
    </div>
  );
}

function PanelPlaud({ estadoCargando }: { estadoCargando: boolean }) {
  const { data: grabaciones = [] } = useGrabacionesPlaud();
  const crearBorrador = useCrearBorrador();
  const procesar = usePlaudProcesar();
  const descartar = usePlaudDescartar();
  const [verId, setVerId] = React.useState<string | null>(null);

  return (
    <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
      <TarjetaPlaudConexion />

      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold">Grabaciones</h2>
          <BotonImportarPlaud />
        </div>
        {estadoCargando && grabaciones.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Cargando…</p>
        ) : grabaciones.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Todavía no hay grabaciones importadas.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {grabaciones.map((g) => (
              <li key={g.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{g.nombre ?? "Grabación sin nombre"}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.fecha ? marcaTiempo(g.fecha) : "sin fecha"} · {duracion(g.duracion_seg)} ·{" "}
                      {ETIQUETA_ESTADO_GRABACION[g.estado]}
                      {g.destino ? ` · ${g.destino === "personal" ? "PERSONAL" : "Proyecto"}` : ""}
                      {g.tareas_creadas ? ` · ${g.tareas_creadas} tareas` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Boton variante="suave" className="px-2.5 py-1 text-xs" onClick={() => setVerId(g.id)}>
                      Ver transcripción
                    </Boton>
                    <Boton
                      variante="suave"
                      className="px-2.5 py-1 text-xs"
                      disabled={crearBorrador.isPending || !g.transcripcion}
                      onClick={() =>
                        crearBorrador.mutate({
                          texto: g.transcripcion ?? "",
                          origen: "voz",
                          grabacionId: g.id,
                        }, { onSuccess: () => toast.success("Borrador creado: revísalo en «Pendientes de revisar».") })
                      }
                    >
                      <ClipboardCheck className="size-3.5" /> Revisar antes de lanzar
                    </Boton>
                    <Boton
                      variante="suave"
                      className="px-2.5 py-1 text-xs"
                      onClick={() => procesar.mutate({ grabacionId: g.id })}
                      disabled={procesar.isPending}
                    >
                      Procesar ahora
                    </Boton>
                    {g.peticion_id ? (
                      <Link to="/pideme" search={{ peticion: g.peticion_id }} className="text-xs text-primary hover:underline">
                        Ver resultado
                      </Link>
                    ) : null}
                    <Boton
                      variante="peligro"
                      className="px-2.5 py-1 text-xs"
                      onClick={() => descartar.mutate(g.id)}
                      disabled={descartar.isPending}
                    >
                      Descartar
                    </Boton>
                  </div>
                </div>
                {g.resumen ? <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{g.resumen}</p> : null}
                {g.error ? <p className="mt-2 text-sm text-destructive">{g.error}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <DialogoTranscripcion grabacionId={verId} onCerrar={() => setVerId(null)} />
    </div>
  );
}

function DialogoTranscripcion({ grabacionId, onCerrar }: { grabacionId: string | null; onCerrar: () => void }) {
  const { data, isPending } = useGrabacionPlaud(grabacionId);
  const grabacion = data?.grabacion as PlaudGrabacionRow | undefined;
  return (
    <Dialogo
      abierto={Boolean(grabacionId)}
      titulo={grabacion?.nombre ?? "Transcripción"}
      onCerrar={onCerrar}
      ancho="max-w-3xl"
    >
      {isPending ? (
        <p className="text-sm text-muted-foreground">Cargando la transcripción…</p>
      ) : (
        <div className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
          {grabacion?.resumen ? <p className="text-muted-foreground">{grabacion.resumen}</p> : null}
          <p className="whitespace-pre-wrap">{grabacion?.transcripcion ?? "Sin transcripción."}</p>
        </div>
      )}
    </Dialogo>
  );
}

/* -------------------------------- Dictado -------------------------------- */

/** Dictado por voz del navegador (es-ES), si está disponible. */
export function useDictado(alTexto: (t: string) => void) {
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

/** Contador de propuestas pendientes para el menú. */
export function usePropuestasPendientes() {
  const { data: peticiones = [] } = usePeticiones();
  return peticiones.filter((p) => p.estado === "propuesta").length;
}
