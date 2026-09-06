import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  Copy,
  ExternalLink,
  Github,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Wand2,
  X,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando } from "@/components/nex/badges";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type {
  CategoriaHabilidad,
  EstadoHabilidad,
  HabilidadRow,
  OrigenHabilidad,
  Prioridad,
} from "@/lib/nex/db-types";
import { ETIQUETA_PRIORIDAD, formatoFechaHora } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import { markdownAHtml } from "@/lib/nex/queries/resumenes";
import {
  CATEGORIAS,
  COLOR_CATEGORIA,
  ETIQUETA_CATEGORIA,
  enlaceArchivo,
  useActualizarHabilidad,
  useAdoptarHabilidad,
  useBarrerHabilidades,
  useGuardarConfigHabilidades,
  useGuardarHabilidad,
  useHabilidades,
  useHabilidadesConfig,
  useInvocarHabilidad,
  usePingHabilidades,
  useResumenHabilidades,
  useSincronizarHabilidades,
  useUsosHabilidades,
  type DatosHabilidad,
} from "@/lib/nex/queries/habilidades";

export const Route = createFileRoute("/habilidades")({
  head: () => ({
    meta: [
      { title: "Habilidades · NexDeveloper" },
      {
        name: "description",
        content: "Catálogo de habilidades propias, de expertos y externas, listas para aplicar en cualquier proyecto.",
      },
      { property: "og:title", content: "Habilidades · NexDeveloper" },
      {
        property: "og:description",
        content: "Catálogo de habilidades propias, de expertos y externas, listas para aplicar en cualquier proyecto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Habilidades,
});

type Pestana = "propias" | "expertos" | "externas" | "todas" | "config";
type Orden = "nombre" | "usos" | "valoracion" | "recientes";

const ETIQUETA_ORIGEN: Record<OrigenHabilidad, string> = {
  propia: "Propia",
  experto: "Experto",
  externa: "Externa",
};

const ETIQUETA_ESTADO: Record<EstadoHabilidad, string> = {
  activa: "Activa",
  candidata: "Candidata",
  archivada: "Archivada",
};

function Estrellas({ valor, onChange }: { valor: number | null; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`Valorar con ${n} estrellas`}
          onClick={(e) => {
            e.stopPropagation();
            onChange(n);
          }}
          className="text-muted-foreground transition hover:text-warning"
        >
          <Star className={`size-3.5 ${Number(valor ?? 0) >= n ? "fill-warning text-warning" : ""}`} />
        </button>
      ))}
    </span>
  );
}

function ChipCategoria({ categoria }: { categoria: CategoriaHabilidad }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${COLOR_CATEGORIA[categoria]}`}>
      {ETIQUETA_CATEGORIA[categoria]}
    </span>
  );
}

function Miniatura({ habilidad, tamano = "size-12" }: { habilidad: HabilidadRow; tamano?: string }) {
  if (habilidad.muestra_url) {
    return (
      <img
        src={habilidad.muestra_url}
        alt={`Muestra de ${habilidad.nombre}`}
        loading="lazy"
        className={`${tamano} rounded-lg object-cover`}
      />
    );
  }
  return (
    <span className={`grid ${tamano} place-items-center rounded-lg bg-primary/15 font-display text-lg text-primary`}>
      {habilidad.nombre.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Habilidades() {
  const { data: habilidades = [], isPending } = useHabilidades();
  const { data: usos = [] } = useUsosHabilidades();
  const { data: resumen } = useResumenHabilidades();
  const { data: config } = useHabilidadesConfig();
  const { data: proyectos = [] } = useProyectos();
  const ping = usePingHabilidades();

  const sincronizar = useSincronizarHabilidades();
  const barrer = useBarrerHabilidades();
  const actualizar = useActualizarHabilidad();
  const adoptar = useAdoptarHabilidad();
  const guardarConfig = useGuardarConfigHabilidades();

  const [pestana, setPestana] = React.useState<Pestana>("propias");
  const [subfiltro, setSubfiltro] = React.useState<EstadoHabilidad>("activa");
  const [busqueda, setBusqueda] = React.useState("");
  const [categoria, setCategoria] = React.useState<CategoriaHabilidad | "todas">("todas");
  const [orden, setOrden] = React.useState<Orden>("nombre");
  const [vista, setVista] = React.useState<"rejilla" | "lista">("rejilla");
  const [fichaId, setFichaId] = React.useState<string | null>(null);
  const [usarId, setUsarId] = React.useState<string | null>(null);
  const [nueva, setNueva] = React.useState(false);
  const [editarId, setEditarId] = React.useState<string | null>(null);

  const ficha = habilidades.find((h) => h.id === fichaId) ?? null;
  const paraUsar = habilidades.find((h) => h.id === usarId) ?? null;
  const paraEditar = habilidades.find((h) => h.id === editarId) ?? null;

  const texto = busqueda.trim().toLowerCase();
  const visibles = habilidades
    .filter((h) => {
      if (pestana === "propias" && h.origen !== "propia") return false;
      if (pestana === "expertos" && h.origen !== "experto") return false;
      if (pestana === "externas" && (h.origen !== "externa" || h.estado !== subfiltro)) return false;
      if (categoria !== "todas" && h.categoria !== categoria) return false;
      if (!texto) return true;
      return `${h.nombre} ${h.descripcion ?? ""} ${h.etiquetas.join(" ")}`.toLowerCase().includes(texto);
    })
    .sort((a, b) => {
      if (orden === "usos") return Number(b.usos ?? 0) - Number(a.usos ?? 0);
      if (orden === "valoracion") return Number(b.valoracion ?? 0) - Number(a.valoracion ?? 0);
      if (orden === "recientes")
        return String(b.sincronizada_el ?? "").localeCompare(String(a.sincronizada_el ?? ""));
      return a.nombre.localeCompare(b.nombre, "es");
    });

  if (isPending) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Habilidades"
        descripcion="Tu catálogo de habilidades propias, de expertos y encontradas en la red, listas para aplicar en cualquier proyecto."
        acciones={
          <>
            <Boton variante="suave" disabled={sincronizar.isPending} onClick={() => sincronizar.mutate()}>
              <RefreshCw className={`size-4 ${sincronizar.isPending ? "animate-spin" : ""}`} /> Sincronizar
            </Boton>
            <Boton variante="suave" disabled={barrer.isPending} onClick={() => barrer.mutate()}>
              <Search className="size-4" /> Buscar en la red
            </Boton>
            <Boton onClick={() => setNueva(true)}>
              <Plus className="size-4" /> Nueva habilidad
            </Boton>
          </>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Marcador titulo="Propias" valor={Number(resumen?.propias ?? 0)} />
        <Marcador titulo="De expertos" valor={Number(resumen?.expertos ?? 0)} />
        <Marcador titulo="Externas activas" valor={Number(resumen?.externas ?? 0)} />
        <Marcador titulo="Candidatas" valor={Number(resumen?.candidatas ?? 0)} />
        <Marcador titulo="Usos" valor={Number(resumen?.usos ?? 0)} />
      </section>

      {ping.data && ping.data.repo_ok === false ? (
        <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          No se puede leer el repositorio de habilidades. Revisa el acceso a GitHub en Integraciones.
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(
          [
            ["propias", "Propias"],
            ["expertos", "Expertos"],
            ["externas", "Externas"],
            ["todas", "Todas"],
            ["config", "Configuración"],
          ] as const
        ).map(([clave, etiqueta]) => (
          <button
            key={clave}
            type="button"
            onClick={() => setPestana(clave)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              pestana === clave ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {pestana === "config" ? (
        <PanelConfiguracion
          config={config ?? null}
          onGuardar={(cambios) => config && guardarConfig.mutate({ id: config.id, cambios })}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, descripción o etiqueta"
              className={`${claseCampo} max-w-xs`}
            />
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaHabilidad | "todas")}
              className={`${claseCampo} max-w-[14rem]`}
            >
              <option value="todas">Cualquier categoría</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETA_CATEGORIA[c]}
                </option>
              ))}
            </select>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              className={`${claseCampo} max-w-[12rem]`}
            >
              <option value="nombre">Por nombre</option>
              <option value="usos">Más usadas</option>
              <option value="valoracion">Mejor valoradas</option>
              <option value="recientes">Más recientes</option>
            </select>
            {pestana === "externas" ? (
              <div className="flex gap-1.5">
                {(Object.keys(ETIQUETA_ESTADO) as EstadoHabilidad[]).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setSubfiltro(e)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      subfiltro === e ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"
                    }`}
                  >
                    {ETIQUETA_ESTADO[e]}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                aria-label="Ver en rejilla"
                onClick={() => setVista("rejilla")}
                className={`rounded-md border p-1.5 ${vista === "rejilla" ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Ver en lista"
                onClick={() => setVista("lista")}
                className={`rounded-md border p-1.5 ${vista === "lista" ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}
              >
                <List className="size-4" />
              </button>
            </div>
          </div>

          {visibles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay habilidades que coincidan con la búsqueda.</p>
          ) : vista === "rejilla" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibles.map((h) => (
                <article key={h.id} className="panel flex flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <Miniatura habilidad={h} />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setFichaId(h.id)}
                        className="text-left font-display text-sm font-semibold hover:text-primary"
                      >
                        {h.nombre}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <ChipCategoria categoria={h.categoria} />
                        <span className="text-[11px] text-muted-foreground">{ETIQUETA_ORIGEN[h.origen]}</span>
                      </div>
                    </div>
                  </div>
                  <p className="line-clamp-3 text-xs text-muted-foreground">{h.descripcion ?? h.cuando_usarla ?? ""}</p>
                  {h.etiquetas.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {h.etiquetas.slice(0, 6).map((t) => (
                        <span key={t} className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Estrellas
                      valor={h.valoracion}
                      onChange={(v) => actualizar.mutate({ id: h.id, cambios: { valoracion: v } })}
                    />
                    <span>{Number(h.usos ?? 0)} usos</span>
                  </div>
                  <div className="mt-auto flex gap-2">
                    <Boton onClick={() => setUsarId(h.id)}>
                      <Wand2 className="size-4" /> Usar
                    </Boton>
                    <Boton variante="suave" onClick={() => setFichaId(h.id)}>
                      Ver
                    </Boton>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="panel divide-y divide-border">
              {visibles.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => setFichaId(h.id)}
                    className="min-w-[12rem] flex-1 text-left text-sm font-medium hover:text-primary"
                  >
                    {h.nombre}
                  </button>
                  <ChipCategoria categoria={h.categoria} />
                  <span className="text-xs text-muted-foreground">{ETIQUETA_ORIGEN[h.origen]}</span>
                  <span className="text-xs text-muted-foreground">{Number(h.usos ?? 0)} usos</span>
                  <Estrellas
                    valor={h.valoracion}
                    onChange={(v) => actualizar.mutate({ id: h.id, cambios: { valoracion: v } })}
                  />
                  <Boton variante="suave" onClick={() => setUsarId(h.id)}>
                    <Wand2 className="size-4" /> Usar
                  </Boton>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <FichaHabilidad
        habilidad={ficha}
        usos={usos.filter((u) => u.habilidad_id === ficha?.id)}
        proyectos={proyectos}
        onCerrar={() => setFichaId(null)}
        onUsar={() => {
          setUsarId(ficha?.id ?? null);
          setFichaId(null);
        }}
        onEditar={() => {
          setEditarId(ficha?.id ?? null);
          setFichaId(null);
        }}
        onAdoptar={(descartar) =>
          ficha && adoptar.mutate({ habilidadId: ficha.id, descartar }, { onSuccess: () => setFichaId(null) })
        }
      />

      <DialogoUsar habilidad={paraUsar} onCerrar={() => setUsarId(null)} />

      <DialogoEditar
        abierto={nueva || Boolean(paraEditar)}
        habilidad={paraEditar}
        onCerrar={() => {
          setNueva(false);
          setEditarId(null);
        }}
      />
    </>
  );
}

function Marcador({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 font-display text-xl font-semibold">{valor}</p>
    </div>
  );
}

/* ------------------------------- Ficha lateral ------------------------------ */

function FichaHabilidad({
  habilidad,
  usos,
  proyectos,
  onCerrar,
  onUsar,
  onEditar,
  onAdoptar,
}: {
  habilidad: HabilidadRow | null;
  usos: { id: string; proyecto_id: string | null; creado_el: string }[];
  proyectos: { id: string; nombre: string }[];
  onCerrar: () => void;
  onUsar: () => void;
  onEditar: () => void;
  onAdoptar: (descartar: boolean) => void;
}) {
  if (!habilidad) return null;
  const h = habilidad;

  return (
    <Dialogo abierto titulo={h.nombre} descripcion={ETIQUETA_ORIGEN[h.origen]} ancho="max-w-4xl" onCerrar={onCerrar}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ChipCategoria categoria={h.categoria} />
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            {ETIQUETA_ESTADO[h.estado]}
          </span>
          <span className="text-xs text-muted-foreground">{Number(h.usos ?? 0)} usos</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Boton onClick={onUsar}>
              <Wand2 className="size-4" /> Usar
            </Boton>
            {h.origen === "propia" ? (
              <Boton variante="suave" onClick={onEditar}>
                <Pencil className="size-4" /> Editar
              </Boton>
            ) : null}
            <Boton
              variante="suave"
              onClick={() => {
                void navigator.clipboard?.writeText(h.contenido_md ?? "");
                toast.success("SKILL.md copiado.");
              }}
            >
              <Copy className="size-4" /> Copiar SKILL.md
            </Boton>
          </div>
        </div>

        {h.cuando_usarla ? (
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-xs font-medium text-muted-foreground">Cuándo usarla</p>
            <p className="mt-1 text-sm">{h.cuando_usarla}</p>
          </div>
        ) : null}

        {h.muestra_url ? (
          <img src={h.muestra_url} alt={`Muestra de ${h.nombre}`} className="max-h-56 w-full rounded-lg object-cover" />
        ) : null}
        {h.muestra_texto ? (
          <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-surface p-3 text-xs">
            {h.muestra_texto}
          </pre>
        ) : null}

        <div
          className="prose-nex max-h-[24rem] overflow-y-auto rounded-lg border border-border bg-surface p-4 text-sm"
          dangerouslySetInnerHTML={{ __html: markdownAHtml(h.contenido_md ?? "Sin contenido.") }}
        />

        {(h.archivos ?? []).length > 0 ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Archivos de la carpeta</p>
            <ul className="mt-1.5 space-y-1">
              {(h.archivos ?? []).map((a) => {
                const url = enlaceArchivo(h, a.ruta);
                return (
                  <li key={a.ruta} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Github className="size-3.5" />
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {a.ruta}
                      </a>
                    ) : (
                      <span>{a.ruta}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {usos.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Historial de usos</p>
            <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
              {usos.slice(0, 10).map((u) => (
                <li key={u.id}>
                  {proyectos.find((p) => p.id === u.proyecto_id)?.nombre ?? "Sin proyecto"} ·{" "}
                  {formatoFechaHora(u.creado_el)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {h.origen === "externa" && h.estado === "candidata" ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Boton onClick={() => onAdoptar(false)}>
              <Check className="size-4" /> Adoptar
            </Boton>
            <Boton variante="suave" onClick={() => onAdoptar(true)}>
              <X className="size-4" /> Descartar
            </Boton>
            {h.url_origen ? (
              <a
                href={h.url_origen}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" /> Ver el origen
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </Dialogo>
  );
}

/* --------------------------------- Usar ---------------------------------- */

const PRIORIDADES: Prioridad[] = ["baja", "media", "alta", "critica"];

export function DialogoUsar({
  habilidad,
  proyectoId,
  onCerrar,
}: {
  habilidad: HabilidadRow | null;
  proyectoId?: string;
  onCerrar: () => void;
}) {
  const { data: proyectos = [] } = useProyectos();
  const invocar = useInvocarHabilidad();
  const [proyecto, setProyecto] = React.useState(proyectoId ?? "");
  const [instrucciones, setInstrucciones] = React.useState("");
  const [atencion, setAtencion] = React.useState(false);
  const [prioridad, setPrioridad] = React.useState<Prioridad>("media");

  React.useEffect(() => {
    if (habilidad) {
      setProyecto(proyectoId ?? "");
      setInstrucciones("");
      setAtencion(false);
      setPrioridad("media");
    }
  }, [habilidad, proyectoId]);

  if (!habilidad) return null;

  const aplicar = async () => {
    const r = await invocar.mutateAsync({
      habilidadId: habilidad.id,
      ...(proyecto ? { proyectoId: proyecto } : {}),
      ...(instrucciones.trim() ? { instrucciones: instrucciones.trim() } : {}),
      requiereAtencion: atencion,
      prioridad,
    });
    const prompt = r.prompt ?? "";
    toast.success("Tarea creada con la habilidad.", {
      description: proyectos.find((p) => p.id === proyecto)?.nombre ?? "",
      action: prompt
        ? {
            label: "Copiar prompt",
            onClick: () => {
              void navigator.clipboard?.writeText(prompt);
            },
          }
        : undefined,
    });
    onCerrar();
  };

  return (
    <Dialogo abierto titulo={`Usar «${habilidad.nombre}»`} onCerrar={onCerrar}>
      <div className="space-y-4">
        <Campo etiqueta="Proyecto">
          <select value={proyecto} onChange={(e) => setProyecto(e.target.value)} className={claseCampo}>
            <option value="">Sin proyecto</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Instrucciones adicionales" pista="Opcional: qué quieres conseguir en concreto.">
          <textarea
            rows={4}
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            className={claseCampo}
          />
        </Campo>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={atencion} onChange={(e) => setAtencion(e.target.checked)} />
            Requiere mi atención
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Prioridad
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as Prioridad)}
              className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm text-foreground"
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {ETIQUETA_PRIORIDAD[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton disabled={invocar.isPending} onClick={() => void aplicar()}>
            <Wand2 className="size-4" /> Crear tarea
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

/* ------------------------------ Alta y edición ----------------------------- */

function DialogoEditar({
  abierto,
  habilidad,
  onCerrar,
}: {
  abierto: boolean;
  habilidad: HabilidadRow | null;
  onCerrar: () => void;
}) {
  const guardar = useGuardarHabilidad();
  const [nombre, setNombre] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [categoria, setCategoria] = React.useState<CategoriaHabilidad>("otro");
  const [etiquetas, setEtiquetas] = React.useState("");
  const [muestraUrl, setMuestraUrl] = React.useState("");
  const [muestraTexto, setMuestraTexto] = React.useState("");
  const [instrucciones, setInstrucciones] = React.useState("");
  const [previa, setPrevia] = React.useState(false);

  React.useEffect(() => {
    if (!abierto) return;
    setNombre(habilidad?.nombre ?? "");
    setDescripcion(habilidad?.descripcion ?? habilidad?.cuando_usarla ?? "");
    setCategoria(habilidad?.categoria ?? "otro");
    setEtiquetas((habilidad?.etiquetas ?? []).join(", "));
    setMuestraUrl(habilidad?.muestra_url ?? "");
    setMuestraTexto(habilidad?.muestra_texto ?? "");
    setInstrucciones(habilidad?.contenido_md ?? "");
    setPrevia(false);
  }, [abierto, habilidad]);

  if (!abierto) return null;

  const enviar = async () => {
    if (!nombre.trim() || !instrucciones.trim()) {
      toast.error("Hacen falta el nombre y las instrucciones.");
      return;
    }
    const datos: DatosHabilidad = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      instrucciones,
      categoria,
      etiquetas: etiquetas
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    if (habilidad?.slug) datos.slug = habilidad.slug;
    if (muestraUrl.trim()) datos.muestra_url = muestraUrl.trim();
    if (muestraTexto.trim()) datos.muestra_texto = muestraTexto.trim();
    await guardar.mutateAsync(datos);
    onCerrar();
  };

  return (
    <Dialogo
      abierto
      titulo={habilidad ? `Editar «${habilidad.nombre}»` : "Nueva habilidad"}
      descripcion="Se guarda en el catálogo y en el repositorio de habilidades propias."
      ancho="max-w-3xl"
      onCerrar={onCerrar}
    >
      <div className="space-y-4">
        <Campo etiqueta="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Cuándo usarla" pista="Una descripción corta que explique para qué sirve.">
          <textarea
            rows={2}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className={claseCampo}
          />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Categoría">
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaHabilidad)}
              className={claseCampo}
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETA_CATEGORIA[c]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Etiquetas" pista="Separadas por comas.">
            <input value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} className={claseCampo} />
          </Campo>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Imagen de muestra (dirección web)">
            <input value={muestraUrl} onChange={(e) => setMuestraUrl(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Muestra en texto">
            <input value={muestraTexto} onChange={(e) => setMuestraTexto(e.target.value)} className={claseCampo} />
          </Campo>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Instrucciones (Markdown)</p>
            <button
              type="button"
              onClick={() => setPrevia((v) => !v)}
              className="text-xs text-primary hover:underline"
            >
              {previa ? "Editar" : "Vista previa"}
            </button>
          </div>
          {previa ? (
            <div
              className="prose-nex mt-1.5 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface p-4 text-sm"
              dangerouslySetInnerHTML={{ __html: markdownAHtml(instrucciones) }}
            />
          ) : (
            <textarea
              rows={12}
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
              className={`${claseCampo} mt-1.5 font-mono text-xs`}
            />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton disabled={guardar.isPending} onClick={() => void enviar()}>
            <Check className="size-4" /> Guardar
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

/* ------------------------------ Configuración ------------------------------ */

function PanelConfiguracion({
  config,
  onGuardar,
}: {
  config: {
    id: string;
    repo_propias: string | null;
    repo_externas: string | null;
    barrido_activo: boolean;
    temas_barrido: string[];
    ultimo_barrido: string | null;
    ultima_sincronizacion: string | null;
  } | null;
  onGuardar: (cambios: { barrido_activo?: boolean; temas_barrido?: string[] }) => void;
}) {
  const [tema, setTema] = React.useState("");
  if (!config) return <p className="text-sm text-muted-foreground">Todavía no hay configuración guardada.</p>;

  return (
    <div className="panel space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Repositorio de habilidades propias">
          {config.repo_propias ? (
            <a
              href={`https://github.com/${config.repo_propias}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Github className="size-4" /> {config.repo_propias}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">Sin configurar</p>
          )}
        </Campo>
        <Campo etiqueta="Repositorio de habilidades externas">
          {config.repo_externas ? (
            <a
              href={`https://github.com/${config.repo_externas}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Github className="size-4" /> {config.repo_externas}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">Sin configurar</p>
          )}
        </Campo>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.barrido_activo}
          onChange={(e) => onGuardar({ barrido_activo: e.target.checked })}
        />
        Buscar habilidades nuevas en la red cada miércoles
      </label>

      <Campo etiqueta="Temas de búsqueda">
        <div className="flex flex-wrap items-center gap-1.5">
          {config.temas_barrido.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs text-muted-foreground"
            >
              {t}
              <button
                type="button"
                aria-label={`Quitar ${t}`}
                onClick={() => onGuardar({ temas_barrido: config.temas_barrido.filter((x) => x !== t) })}
                className="hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !tema.trim()) return;
              e.preventDefault();
              onGuardar({ temas_barrido: [...config.temas_barrido, tema.trim()] });
              setTema("");
            }}
            placeholder="Añadir tema y pulsar Intro"
            className="w-52 rounded-md border border-input bg-surface px-2 py-1 text-xs"
          />
        </div>
      </Campo>

      <p className="text-xs text-muted-foreground">
        Última sincronización: {config.ultima_sincronizacion ? formatoFechaHora(config.ultima_sincronizacion) : "nunca"}{" "}
        · Última búsqueda en la red: {config.ultimo_barrido ? formatoFechaHora(config.ultimo_barrido) : "nunca"}
      </p>
    </div>
  );
}

/* --------------------- Selector reutilizable de habilidades --------------------- */

/** Botón que abre un selector con buscador para aplicar una habilidad. */
export function SelectorHabilidad({
  proyectoId,
  etiqueta = "Aplicar habilidad",
  onElegir,
}: {
  proyectoId?: string;
  etiqueta?: string;
  onElegir?: (habilidad: HabilidadRow) => void;
}) {
  const { data: habilidades = [] } = useHabilidades();
  const [abierto, setAbierto] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState("");
  const [elegida, setElegida] = React.useState<HabilidadRow | null>(null);

  const texto = busqueda.trim().toLowerCase();
  const visibles = habilidades
    .filter((h) => h.estado === "activa")
    .filter((h) => !texto || `${h.nombre} ${h.descripcion ?? ""} ${h.etiquetas.join(" ")}`.toLowerCase().includes(texto))
    .slice(0, 40);

  return (
    <>
      <Boton variante="suave" onClick={() => setAbierto(true)}>
        <Wand2 className="size-4" /> {etiqueta}
      </Boton>

      <Dialogo abierto={abierto} titulo="Elegir habilidad" onCerrar={() => setAbierto(false)}>
        <div className="space-y-3">
          <input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar habilidad"
            className={claseCampo}
          />
          <div className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {visibles.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  setAbierto(false);
                  if (onElegir) onElegir(h);
                  else setElegida(h);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface"
              >
                <Miniatura habilidad={h} tamano="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{h.nombre}</span>
                  <span className="block truncate text-xs text-muted-foreground">{h.descripcion ?? ""}</span>
                </span>
                <ChipCategoria categoria={h.categoria} />
              </button>
            ))}
            {visibles.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">No hay habilidades que coincidan.</p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            ¿Buscas otra?{" "}
            <Link to="/habilidades" className="text-primary hover:underline">
              Ver el catálogo completo
            </Link>
          </p>
        </div>
      </Dialogo>

      <DialogoUsar
        habilidad={elegida}
        {...(proyectoId ? { proyectoId } : {})}
        onCerrar={() => setElegida(null)}
      />
    </>
  );
}
