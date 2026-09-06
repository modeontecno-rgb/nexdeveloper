import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import {
  AlertTriangle,
  BadgeEuro,
  Bug,
  CalendarClock,
  ChevronDown,
  ExternalLink,
  Loader2,
  Newspaper,
  Radar,
  RefreshCw,
  Sparkles,
  Tag,
  Users,
  Wrench,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, Selector, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type {
  CategoriaHallazgoVigilancia,
  CompetidorRow,
  RelevanciaVigilancia,
  EstadoHallazgoVigilancia,
  VigilanciaHallazgoRow,
} from "@/lib/nex/db-types";
import { marcaTiempo } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  useCambiarEstadoHallazgo,
  useCompetidores,
  useConvertirHallazgoEnTarea,
  useEjecutarVigilancia,
  useEjecutarVigilanciaTodos,
  useGuardarCompetidor,
  useGuardarVigilanciaConfig,
  usePingVigilancia,
  useRealtimeVigilancia,
  useVigilanciaConfig,
  useVigilanciaHallazgos,
  useVigilanciaLotes,
  useVigilanciaResumen,
} from "@/lib/nex/queries/vigilancia";

type BusquedaVigilancia = { proyecto?: string };

export const Route = createFileRoute("/vigilancia")({
  validateSearch: (busqueda: Record<string, unknown>): BusquedaVigilancia =>
    typeof busqueda["proyecto"] === "string" ? { proyecto: busqueda["proyecto"] } : {},
  head: () => ({
    meta: [
      { title: "Vigilancia · NexDeveloper" },
      {
        name: "description",
        content: "Vigía semanal de novedades técnicas y radar mensual de competencia para cada proyecto.",
      },
      { property: "og:title", content: "Vigilancia · NexDeveloper" },
      {
        property: "og:description",
        content: "Vigía semanal de novedades técnicas y radar mensual de competencia para cada proyecto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaVigilancia,
});

export const ETIQUETA_CATEGORIA: Record<CategoriaHallazgoVigilancia, string> = {
  version: "Nueva versión",
  seguridad: "Seguridad",
  funcionalidad: "Funcionalidad",
  precio: "Precios",
  fin_de_soporte: "Fin de soporte",
  ia: "Inteligencia artificial",
  otro: "Otro",
  nuevo_competidor: "Nuevo competidor",
  noticia: "Noticia",
};

const ICONO_CATEGORIA: Record<CategoriaHallazgoVigilancia, typeof Tag> = {
  version: Tag,
  seguridad: Bug,
  funcionalidad: Wrench,
  precio: BadgeEuro,
  fin_de_soporte: CalendarClock,
  ia: Sparkles,
  otro: Newspaper,
  nuevo_competidor: Users,
  noticia: Newspaper,
};

const TONO_RELEVANCIA: Record<RelevanciaVigilancia, string> = {
  alta: "border-destructive/40 bg-destructive/10 text-destructive",
  media: "border-warning/40 bg-warning/10 text-warning",
  baja: "border-border bg-muted text-muted-foreground",
};

const ETIQUETA_RELEVANCIA: Record<RelevanciaVigilancia, string> = {
  alta: "Relevancia alta",
  media: "Relevancia media",
  baja: "Relevancia baja",
};

const ETIQUETA_ESTADO_HALLAZGO: Record<EstadoHallazgoVigilancia, string> = {
  nuevo: "Nuevo",
  visto: "Visto",
  descartado: "Descartado",
  convertido: "Convertido en tarea",
};

type Pestana = "novedades" | "competencia" | "config" | "historial";

function PantallaVigilancia() {
  const busqueda = useSearch({ from: "/vigilancia" });
  const { data: proyectos = [] } = useProyectos();
  const { data: hallazgos = [] } = useVigilanciaHallazgos();
  const { data: competidores = [] } = useCompetidores();
  const { data: lotes = [] } = useVigilanciaLotes();
  const { data: configs = [] } = useVigilanciaConfig();
  const { data: resumen = [] } = useVigilanciaResumen();
  const ping = usePingVigilancia();

  const ejecutar = useEjecutarVigilancia();
  const ejecutarTodos = useEjecutarVigilanciaTodos();

  useRealtimeVigilancia((lote) => {
    if (lote.estado === "ok") toast.success(lote.resumen ?? "Vigilancia terminada");
    if (lote.estado === "error") toast.error(lote.error ?? "La vigilancia ha fallado");
  });

  const [pestana, setPestana] = React.useState<Pestana>("novedades");
  const [proyectoFiltro, setProyectoFiltro] = React.useState<string>(busqueda.proyecto ?? "todos");

  const nombreProyecto = (id: string) => proyectos.find((p) => p.id === id)?.nombre ?? "Proyecto";

  const nuevos = hallazgos.filter((h) => h.estado === "nuevo");
  const nuevosAlta = nuevos.filter((h) => h.relevancia === "alta");
  const seguidos = competidores.filter((c) => c.seguir);
  const ultimaEjecucion = lotes[0]?.iniciado_el ?? null;
  const buscador = ping.data?.buscador ?? null;
  const lotesEnCurso = lotes.filter((l) => l.estado === "en_curso");

  return (
    <>
      <Encabezado
        titulo="Vigilancia"
        descripcion="Novedades de tus tecnologías cada semana y radar de competencia cada mes."
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <Boton
              variante="suave"
              disabled={ejecutarTodos.isPending || !buscador}
              onClick={() => {
                ejecutarTodos.mutate("novedades", {
                  onSuccess: () => toast.success("Buscando novedades en todos los proyectos"),
                  onError: (e) => toast.error(e.message),
                });
              }}
            >
              {ejecutarTodos.isPending ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
              Todos los proyectos
            </Boton>
          </div>
        }
      />

      {!buscador && !ping.isPending ? (
        <div className="panel mb-4 flex flex-wrap items-center gap-2 border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          <AlertTriangle className="size-4" />
          Para vigilar hace falta la clave de Anthropic, Google o Perplexity.
          <Link to="/ajustes/proveedores" className="underline">
            Ir a Ajustes → Proveedores
          </Link>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica titulo="Hallazgos nuevos" valor={String(nuevos.length)} pie={`${hallazgos.length} en total`} />
        <Metrica titulo="Relevancia alta" valor={String(nuevosAlta.length)} pie="Conviene mirarlos hoy" />
        <Metrica titulo="Competidores seguidos" valor={String(seguidos.length)} pie={`${competidores.length} conocidos`} />
        <Metrica
          titulo="Última ejecución"
          valor={ultimaEjecucion ? marcaTiempo(ultimaEjecucion) : "—"}
          pie={lotesEnCurso.length ? `${lotesEnCurso.length} en curso` : "Sin trabajos en curso"}
        />
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["novedades", "Novedades"],
            ["competencia", "Competencia"],
            ["config", "Configuración"],
            ["historial", "Historial"],
          ] as [Pestana, string][]
        ).map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setPestana(valor)}
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
              pestana === valor
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {pestana === "novedades" ? (
          <PestanaNovedades
            hallazgos={hallazgos.filter((h) => h.tipo === "novedad")}
            proyectos={proyectos.map((p) => ({ id: p.id, nombre: p.nombre }))}
            proyectoInicial={proyectoFiltro}
            onProyecto={setProyectoFiltro}
            nombreProyecto={nombreProyecto}
            buscador={buscador}
            enCurso={lotesEnCurso.filter((l) => l.tipo === "novedades").map((l) => l.proyecto_id)}
            onEjecutar={(proyectoId) =>
              ejecutar.mutate(
                { proyectoId, tipo: "novedades" },
                {
                  onSuccess: (r) => toast.success(String(r.resumen ?? "Vigilancia terminada")),
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          />
        ) : null}

        {pestana === "competencia" ? (
          <PestanaCompetencia
            hallazgos={hallazgos.filter((h) => h.tipo === "competencia")}
            competidores={competidores}
            proyectos={proyectos.map((p) => ({ id: p.id, nombre: p.nombre }))}
            proyectoInicial={proyectoFiltro}
            onProyecto={setProyectoFiltro}
            nombreProyecto={nombreProyecto}
            buscador={buscador}
            enCurso={lotesEnCurso.filter((l) => l.tipo === "competencia").map((l) => l.proyecto_id)}
            onEjecutar={(proyectoId) =>
              ejecutar.mutate(
                { proyectoId, tipo: "competencia" },
                {
                  onSuccess: (r) => toast.success(String(r.resumen ?? "Radar terminado")),
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          />
        ) : null}

        {pestana === "config" ? (
          <PestanaConfiguracion configs={configs} nombreProyecto={nombreProyecto} />
        ) : null}

        {pestana === "historial" ? (
          <PestanaHistorial lotes={lotes} nombreProyecto={nombreProyecto} resumen={resumen} />
        ) : null}
      </div>
    </>
  );
}

function Metrica({ titulo, valor, pie }: { titulo: string; valor: string; pie: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{valor}</p>
      <p className="mt-1 text-xs text-muted-foreground">{pie}</p>
    </div>
  );
}

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
        className || "border-border bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function TarjetaHallazgo({
  hallazgo,
  nombreProyecto,
}: {
  hallazgo: VigilanciaHallazgoRow;
  nombreProyecto: (id: string) => string;
}) {
  const cambiarEstado = useCambiarEstadoHallazgo();
  const convertir = useConvertirHallazgoEnTarea();
  const [dialogo, setDialogo] = React.useState(false);
  const [requiereAtencion, setRequiereAtencion] = React.useState(true);
  const Icono = ICONO_CATEGORIA[hallazgo.categoria] ?? Newspaper;

  return (
    <article className="panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip className={TONO_RELEVANCIA[hallazgo.relevancia]}>{ETIQUETA_RELEVANCIA[hallazgo.relevancia]}</Chip>
        <Chip>
          <Icono className="size-3.5" /> {ETIQUETA_CATEGORIA[hallazgo.categoria] ?? hallazgo.categoria}
        </Chip>
        <Chip>{ETIQUETA_ESTADO_HALLAZGO[hallazgo.estado]}</Chip>
        <span className="ml-auto text-xs text-muted-foreground">{marcaTiempo(hallazgo.creado_el)}</span>
      </div>

      <h3 className="mt-2 font-display text-sm font-semibold">{hallazgo.titulo}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{nombreProyecto(hallazgo.proyecto_id)}</p>
      {hallazgo.resumen ? <p className="mt-2 text-sm text-foreground">{hallazgo.resumen}</p> : null}

      {hallazgo.por_que_afecta ? (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <p className="text-xs font-medium text-primary">Qué te afecta</p>
          <p className="mt-1 text-foreground">{hallazgo.por_que_afecta}</p>
        </div>
      ) : null}

      {hallazgo.accion_sugerida ? (
        <p className="mt-2 text-sm text-muted-foreground">
          <strong className="text-foreground">Acción sugerida:</strong> {hallazgo.accion_sugerida}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {hallazgo.fuente_url ? (
          <a
            href={hallazgo.fuente_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            {hallazgo.fuente_nombre ?? "Fuente"} <ExternalLink className="size-3.5" />
          </a>
        ) : hallazgo.fuente_nombre ? (
          <span>{hallazgo.fuente_nombre}</span>
        ) : null}
        {hallazgo.fecha_fuente ? <span>{marcaTiempo(hallazgo.fecha_fuente)}</span> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Boton onClick={() => setDialogo(true)} disabled={hallazgo.estado === "convertido"}>
          Convertir en tarea
        </Boton>
        <Boton
          variante="suave"
          disabled={cambiarEstado.isPending}
          onClick={() => cambiarEstado.mutate({ id: hallazgo.id, estado: "visto" })}
        >
          Visto
        </Boton>
        <Boton
          variante="peligro"
          disabled={cambiarEstado.isPending}
          onClick={() => cambiarEstado.mutate({ id: hallazgo.id, estado: "descartado" })}
        >
          Descartar
        </Boton>
      </div>

      <Dialogo
        abierto={dialogo}
        titulo="Convertir en tarea"
        descripcion={hallazgo.titulo}
        onCerrar={() => setDialogo(false)}
        ancho="max-w-lg"
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={requiereAtencion}
            onChange={(e) => setRequiereAtencion(e.target.checked)}
            className="size-4"
          />
          Requiere mi atención
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Boton variante="suave" onClick={() => setDialogo(false)}>
            Cancelar
          </Boton>
          <Boton
            disabled={convertir.isPending}
            onClick={() =>
              convertir.mutate(
                { hallazgoId: hallazgo.id, requiereAtencion },
                {
                  onSuccess: () => {
                    toast.success("Tarea creada");
                    setDialogo(false);
                  },
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            {convertir.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Crear tarea
          </Boton>
        </div>
      </Dialogo>
    </article>
  );
}

function PestanaNovedades({
  hallazgos,
  proyectos,
  proyectoInicial,
  onProyecto,
  nombreProyecto,
  buscador,
  enCurso,
  onEjecutar,
}: {
  hallazgos: VigilanciaHallazgoRow[];
  proyectos: { id: string; nombre: string }[];
  proyectoInicial: string;
  onProyecto: (v: string) => void;
  nombreProyecto: (id: string) => string;
  buscador: string | null;
  enCurso: string[];
  onEjecutar: (proyectoId: string) => void;
}) {
  const [relevancia, setRelevancia] = React.useState<string>("todas");
  const [categoria, setCategoria] = React.useState<string>("todas");
  const [estado, setEstado] = React.useState<string>("nuevo");
  const [texto, setTexto] = React.useState("");
  const [abiertos, setAbiertos] = React.useState<Record<string, boolean>>({});

  const filtrados = hallazgos.filter(
    (h) =>
      (proyectoInicial === "todos" || h.proyecto_id === proyectoInicial) &&
      (relevancia === "todas" || h.relevancia === relevancia) &&
      (categoria === "todas" || h.categoria === categoria) &&
      (estado === "todos" || h.estado === estado) &&
      (texto.trim() === "" ||
        `${h.titulo} ${h.resumen ?? ""} ${h.por_que_afecta ?? ""}`.toLowerCase().includes(texto.toLowerCase())),
  );

  const porProyecto = new Map<string, VigilanciaHallazgoRow[]>();
  for (const h of filtrados) {
    const lista = porProyecto.get(h.proyecto_id) ?? [];
    lista.push(h);
    porProyecto.set(h.proyecto_id, lista);
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <Selector
          etiqueta="Proyecto"
          valor={proyectoInicial}
          onChange={onProyecto}
          opciones={[{ valor: "todos", texto: "Todos" }, ...proyectos.map((p) => ({ valor: p.id, texto: p.nombre }))]}
        />
        <Selector
          etiqueta="Relevancia"
          valor={relevancia}
          onChange={setRelevancia}
          opciones={[
            { valor: "todas", texto: "Todas" },
            { valor: "alta", texto: "Alta" },
            { valor: "media", texto: "Media" },
            { valor: "baja", texto: "Baja" },
          ]}
        />
        <Selector
          etiqueta="Categoría"
          valor={categoria}
          onChange={setCategoria}
          opciones={[
            { valor: "todas", texto: "Todas" },
            ...Object.entries(ETIQUETA_CATEGORIA).map(([valor, texto]) => ({ valor, texto })),
          ]}
        />
        <Selector
          etiqueta="Estado"
          valor={estado}
          onChange={setEstado}
          opciones={[
            { valor: "nuevo", texto: "Nuevos" },
            { valor: "visto", texto: "Vistos" },
            { valor: "descartado", texto: "Descartados" },
            { valor: "convertido", texto: "Convertidos" },
            { valor: "todos", texto: "Todos" },
          ]}
        />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar en los hallazgos"
          className={`${claseCampo} sm:w-64`}
        />
        {proyectoInicial !== "todos" ? (
          <Boton
            variante="suave"
            disabled={!buscador || enCurso.includes(proyectoInicial)}
            onClick={() => onEjecutar(proyectoInicial)}
          >
            {enCurso.includes(proyectoInicial) ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Buscar novedades ahora
          </Boton>
        ) : null}
      </div>

      {[...porProyecto.entries()].map(([proyectoId, lista]) => {
        const abierto = abiertos[proyectoId] ?? true;
        return (
          <div key={proyectoId} className="panel p-4">
            <button
              type="button"
              onClick={() => setAbiertos((a) => ({ ...a, [proyectoId]: !abierto }))}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="font-display text-sm font-semibold">
                {nombreProyecto(proyectoId)}{" "}
                <span className="text-xs font-normal text-muted-foreground">({lista.length})</span>
              </span>
              <span className="flex items-center gap-2">
                {enCurso.includes(proyectoId) ? <Loader2 className="size-4 animate-spin text-primary" /> : null}
                <ChevronDown className={`size-4 text-muted-foreground transition ${abierto ? "rotate-180" : ""}`} />
              </span>
            </button>
            {abierto ? (
              <div className="mt-3 space-y-3">
                {lista.map((h) => (
                  <TarjetaHallazgo key={h.id} hallazgo={h} nombreProyecto={nombreProyecto} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}

      {filtrados.length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">
          No hay novedades con estos filtros. Pulsa «Buscar novedades ahora» para lanzar el vigía.
        </p>
      ) : null}
    </div>
  );
}

function PestanaCompetencia({
  hallazgos,
  competidores,
  proyectos,
  proyectoInicial,
  onProyecto,
  nombreProyecto,
  buscador,
  enCurso,
  onEjecutar,
}: {
  hallazgos: VigilanciaHallazgoRow[];
  competidores: CompetidorRow[];
  proyectos: { id: string; nombre: string }[];
  proyectoInicial: string;
  onProyecto: (v: string) => void;
  nombreProyecto: (id: string) => string;
  buscador: string | null;
  enCurso: string[];
  onEjecutar: (proyectoId: string) => void;
}) {
  const proyectoId = proyectoInicial !== "todos" ? proyectoInicial : (proyectos[0]?.id ?? "");
  const guardar = useGuardarCompetidor();
  const [editando, setEditando] = React.useState<CompetidorRow | "nuevo" | null>(null);

  const lista = competidores.filter((c) => c.proyecto_id === proyectoId);
  const hallazgosProyecto = hallazgos.filter((h) => h.proyecto_id === proyectoId);

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <Selector
          etiqueta="Proyecto"
          valor={proyectoId}
          onChange={onProyecto}
          opciones={proyectos.map((p) => ({ valor: p.id, texto: p.nombre }))}
        />
        <Boton
          variante="suave"
          disabled={!buscador || !proyectoId || enCurso.includes(proyectoId)}
          onClick={() => onEjecutar(proyectoId)}
        >
          {enCurso.includes(proyectoId) ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
          Ejecutar radar ahora
        </Boton>
        <Boton variante="suave" onClick={() => setEditando("nuevo")} disabled={!proyectoId}>
          Añadir competidor
        </Boton>
      </div>

      {lista.length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">
          Aún no seguimos competidores: pulsa «Ejecutar radar» y los descubrirá.
        </p>
      ) : (
        <div className="panel overflow-x-auto p-0">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Competidor</th>
                <th className="px-4 py-3">País</th>
                <th className="px-4 py-3">Precio desde</th>
                <th className="px-4 py-3">Puntos fuertes y débiles</th>
                <th className="px-4 py-3">Último cambio</th>
                <th className="px-4 py-3">Última revisión</th>
                <th className="px-4 py-3">Seguir</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0 align-top">
                  <td className="px-4 py-3">
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {c.nombre}
                      </a>
                    ) : (
                      c.nombre
                    )}
                    {c.planes?.length ? (
                      <details className="mt-1 text-xs text-muted-foreground">
                        <summary className="cursor-pointer">Planes ({c.planes.length})</summary>
                        <ul className="mt-1 space-y-0.5">
                          {c.planes.map((p, i) => (
                            <li key={i}>
                              {p.nombre ?? "Plan"} · {p.precio ?? "—"} {p.periodo ?? ""} {p.notas ? `· ${p.notas}` : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.pais ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.precio_desde ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.puntos_fuertes?.map((p) => (
                        <Chip key={p} className="border-success/40 bg-success/10 text-success">
                          {p}
                        </Chip>
                      ))}
                      {c.puntos_debiles?.map((p) => (
                        <Chip key={p} className="border-destructive/40 bg-destructive/10 text-destructive">
                          {p}
                        </Chip>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{marcaTiempo(c.ultimo_cambio)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{marcaTiempo(c.ultima_revision)}</td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={c.seguir}
                      onChange={(e) =>
                        guardar.mutate({ id: c.id, proyectoId: c.proyecto_id, datos: { seguir: e.target.checked } })
                      }
                      className="size-4"
                      aria-label={`Seguir a ${c.nombre}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Boton variante="suave" onClick={() => setEditando(c)}>
                      Editar
                    </Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-3">
        {hallazgosProyecto.map((h) => (
          <TarjetaHallazgo key={h.id} hallazgo={h} nombreProyecto={nombreProyecto} />
        ))}
        {hallazgosProyecto.length === 0 ? (
          <p className="panel p-6 text-sm text-muted-foreground">Sin hallazgos de competencia para este proyecto.</p>
        ) : null}
      </div>

      <DialogoCompetidor
        valor={editando}
        proyectoId={proyectoId}
        onCerrar={() => setEditando(null)}
      />
    </div>
  );
}

function DialogoCompetidor({
  valor,
  proyectoId,
  onCerrar,
}: {
  valor: CompetidorRow | "nuevo" | null;
  proyectoId: string;
  onCerrar: () => void;
}) {
  const guardar = useGuardarCompetidor();
  const existente = valor && valor !== "nuevo" ? valor : null;
  const [nombre, setNombre] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [pais, setPais] = React.useState("");
  const [precio, setPrecio] = React.useState("");
  const [notas, setNotas] = React.useState("");

  React.useEffect(() => {
    setNombre(existente?.nombre ?? "");
    setUrl(existente?.url ?? "");
    setPais(existente?.pais ?? "");
    setPrecio(existente?.precio_desde ?? "");
    setNotas(existente?.notas ?? "");
  }, [existente]);

  return (
    <Dialogo
      abierto={valor !== null}
      titulo={existente ? "Editar competidor" : "Añadir competidor"}
      onCerrar={onCerrar}
      ancho="max-w-lg"
    >
      <div className="space-y-3">
        <Campo etiqueta="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Web">
          <input value={url} onChange={(e) => setUrl(e.target.value)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="País">
          <input value={pais} onChange={(e) => setPais(e.target.value)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Precio desde">
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Notas">
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className={claseCampo} />
        </Campo>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Boton variante="suave" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton
          disabled={guardar.isPending || !nombre.trim()}
          onClick={() =>
            guardar.mutate(
              {
                ...(existente ? { id: existente.id } : {}),
                proyectoId,
                datos: {
                  nombre: nombre.trim(),
                  url: url.trim() || null,
                  pais: pais.trim() || null,
                  precio_desde: precio.trim() || null,
                  notas: notas.trim() || null,
                  origen: existente?.origen ?? "manual",
                },
              },
              {
                onSuccess: () => {
                  toast.success("Competidor guardado");
                  onCerrar();
                },
                onError: (e) => toast.error(e.message),
              },
            )
          }
        >
          Guardar
        </Boton>
      </div>
    </Dialogo>
  );
}

function ChipsEditables({
  valores,
  onCambiar,
  etiqueta,
}: {
  valores: string[];
  onCambiar: (v: string[]) => void;
  etiqueta: string;
}) {
  const [texto, setTexto] = React.useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {valores.map((v) => (
          <button
            key={v}
            type="button"
            title="Quitar"
            onClick={() => onCambiar(valores.filter((x) => x !== v))}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground hover:border-destructive/40 hover:text-destructive"
          >
            {v} ×
          </button>
        ))}
      </div>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && texto.trim()) {
            e.preventDefault();
            onCambiar([...valores, texto.trim()]);
            setTexto("");
          }
        }}
        placeholder={`Añadir ${etiqueta} y pulsar Intro`}
        className={`${claseCampo} mt-1.5`}
      />
    </div>
  );
}

function PestanaConfiguracion({
  configs,
  nombreProyecto,
}: {
  configs: import("@/lib/nex/db-types").VigilanciaConfigRow[];
  nombreProyecto: (id: string) => string;
}) {
  const guardar = useGuardarVigilanciaConfig();
  const cambiar = (proyectoId: string, cambios: Partial<import("@/lib/nex/db-types").VigilanciaConfigRow>) =>
    guardar.mutate({ proyectoId, cambios }, { onError: (e) => toast.error(e.message) });

  return (
    <div className="space-y-3">
      {configs.map((c) => (
        <div key={c.proyecto_id} className="panel p-4">
          <div className="flex flex-wrap items-center gap-4">
            <h3 className="font-display text-sm font-semibold">{nombreProyecto(c.proyecto_id)}</h3>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={c.activa}
                onChange={(e) => cambiar(c.proyecto_id, { activa: e.target.checked })}
                className="size-4"
              />
              Vigilancia activa
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={c.novedades_activas}
                onChange={(e) => cambiar(c.proyecto_id, { novedades_activas: e.target.checked })}
                className="size-4"
              />
              Novedades
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={c.competencia_activa}
                onChange={(e) => cambiar(c.proyecto_id, { competencia_activa: e.target.checked })}
                className="size-4"
              />
              Competencia
            </label>
            <span className="ml-auto text-xs text-muted-foreground">
              Novedades: {marcaTiempo(c.ultima_novedades)} · Competencia: {marcaTiempo(c.ultima_competencia)}
            </span>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Campo etiqueta="Tecnologías">
              <ChipsEditables
                valores={c.tecnologias ?? []}
                etiqueta="tecnología"
                onCambiar={(v) => cambiar(c.proyecto_id, { tecnologias: v })}
              />
            </Campo>
            <Campo etiqueta="Temas extra">
              <ChipsEditables
                valores={c.temas_extra ?? []}
                etiqueta="tema"
                onCambiar={(v) => cambiar(c.proyecto_id, { temas_extra: v })}
              />
            </Campo>
            <Campo etiqueta="Sector">
              <input
                defaultValue={c.sector ?? ""}
                onBlur={(e) => cambiar(c.proyecto_id, { sector: e.target.value.trim() || null })}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Competidores conocidos">
              <ChipsEditables
                valores={c.competidores_conocidos ?? []}
                etiqueta="competidor"
                onCambiar={(v) => cambiar(c.proyecto_id, { competidores_conocidos: v })}
              />
            </Campo>
          </div>
        </div>
      ))}
      {configs.length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">Todavía no hay configuración de vigilancia.</p>
      ) : null}
    </div>
  );
}

function PestanaHistorial({
  lotes,
  nombreProyecto,
  resumen,
}: {
  lotes: import("@/lib/nex/db-types").VigilanciaLoteRow[];
  nombreProyecto: (id: string) => string;
  resumen: import("@/lib/nex/db-types").VigilanciaResumenRow[];
}) {
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {resumen.length} proyectos vigilados · novedades los lunes a las 07:30 y competencia el día 1 a las 08:00.
      </p>
      <div className="panel overflow-x-auto p-0">
        <table className="w-full min-w-[60rem] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Proyecto</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Origen</th>
              <th className="px-4 py-3">Modelo</th>
              <th className="px-4 py-3">Búsquedas</th>
              <th className="px-4 py-3">Tokens</th>
              <th className="px-4 py-3">Coste</th>
              <th className="px-4 py-3">Hallazgos</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Resumen</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((l) => (
              <tr key={l.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 text-xs text-muted-foreground">{marcaTiempo(l.iniciado_el)}</td>
                <td className="px-4 py-3">{nombreProyecto(l.proyecto_id)}</td>
                <td className="px-4 py-3">{l.tipo === "novedades" ? "Novedades" : "Competencia"}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.origen === "manual" ? "Manual" : "Programado"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {l.proveedor ? `${l.proveedor} · ${l.modelo ?? ""}` : "—"}
                </td>
                <td className="px-4 py-3">{l.busquedas ?? 0}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {(l.tokens_entrada ?? 0) + (l.tokens_salida ?? 0)}
                </td>
                <td className="px-4 py-3">{l.coste != null ? `${Number(l.coste).toFixed(3)} €` : "—"}</td>
                <td className="px-4 py-3">{l.hallazgos ?? 0}</td>
                <td className="px-4 py-3">
                  <Chip
                    className={
                      l.estado === "ok"
                        ? "border-success/40 bg-success/10 text-success"
                        : l.estado === "error"
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : "border-primary/40 bg-primary/10 text-primary"
                    }
                  >
                    {l.estado === "ok" ? "Correcta" : l.estado === "error" ? "Error" : "En curso"}
                  </Chip>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {l.estado === "error" ? (
                    <Boton variante="suave" onClick={() => setError(l.error ?? "Sin detalle")}>
                      Ver error
                    </Boton>
                  ) : (
                    (l.resumen ?? "—")
                  )}
                </td>
              </tr>
            ))}
            {lotes.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-sm text-muted-foreground">
                  Todavía no se ha ejecutado ninguna vigilancia.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialogo abierto={error !== null} titulo="Detalle del error" onCerrar={() => setError(null)} ancho="max-w-xl">
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-xs">
          {error}
        </pre>
      </Dialogo>
    </div>
  );
}
