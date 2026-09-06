import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Download,
  FileCode2,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Settings2,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import type { ManualRow, PublicoManual } from "@/lib/nex/db-types";
import { formatoEuros, formatoFechaHora } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  ETIQUETA_ESTADO_MANUAL,
  ETIQUETA_PUBLICO_MANUAL,
  PASOS_MANUAL,
  PUBLICOS_MANUAL,
  abrirHtml,
  descargarMarkdown,
  useBorrarManual,
  useEnlaceManual,
  useEstadoManuales,
  useGenerarManual,
  useGuardarConfigManuales,
  useManuales,
  useRealtimeManuales,
  useReintentarManual,
} from "@/lib/nex/queries/manuales";
import { cn } from "@/lib/utils";

type BusquedaManuales = { proyecto?: string; publico?: string; nuevo?: string };

export const Route = createFileRoute("/manuales")({
  validateSearch: (busqueda: Record<string, unknown>): BusquedaManuales => {
    const salida: BusquedaManuales = {};
    if (typeof busqueda["proyecto"] === "string") salida.proyecto = busqueda["proyecto"];
    if (typeof busqueda["publico"] === "string") salida.publico = busqueda["publico"];
    if (typeof busqueda["nuevo"] === "string") salida.nuevo = busqueda["nuevo"];
    return salida;
  },
  head: () => ({
    meta: [
      { title: "Manuales · NexDeveloper" },
      {
        name: "description",
        content: "Genera manuales de usuario, de administración y comerciales de cada proyecto, listos para imprimir.",
      },
      { property: "og:title", content: "Manuales · NexDeveloper" },
      {
        property: "og:description",
        content: "Genera manuales de usuario, de administración y comerciales de cada proyecto, listos para imprimir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManualesPantalla,
});

/* ------------------------------ Utilidades ------------------------------- */

export function SemaforoRequisito({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        ok ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {texto}
    </span>
  );
}

/** Línea de pasos del manual en curso, alimentada por Realtime. */
export function LineaPasos({ manual }: { manual: ManualRow }) {
  const indice = Math.max(0, PASOS_MANUAL.indexOf(manual.estado));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {PASOS_MANUAL.map((paso, i) => (
          <React.Fragment key={paso}>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs",
                manual.estado === "error"
                  ? "border-destructive/40 text-destructive"
                  : i < indice
                    ? "border-success/40 bg-success/10 text-success"
                    : i === indice
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
              )}
            >
              {ETIQUETA_ESTADO_MANUAL[paso]}
            </span>
            {i < PASOS_MANUAL.length - 1 ? <span className="text-muted-foreground">→</span> : null}
          </React.Fragment>
        ))}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        {manual.estado !== "listo" && manual.estado !== "error" ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {manual.error ?? manual.paso ?? "Preparando…"}
      </p>
    </div>
  );
}

function useAcciones() {
  const enlace = useEnlaceManual();
  const ver = async (manual: ManualRow, imprimir = false) => {
    if (manual.html) {
      if (!abrirHtml(manual.html, imprimir)) toast.error("El navegador ha bloqueado la ventana nueva.");
      if (imprimir) toast.info("En el diálogo de impresión elige «Guardar como PDF».");
      return;
    }
    try {
      const r = await enlace.mutateAsync({ manualId: manual.id, formato: "html" });
      if (r.url) window.open(r.url, "_blank", "noopener");
      else toast.error("Todavía no hay documento que abrir.");
    } catch {
      /* el error ya se avisa */
    }
  };
  const markdown = async (manual: ManualRow) => {
    if (manual.markdown) {
      descargarMarkdown(manual.titulo, manual.markdown);
      return;
    }
    try {
      const r = await enlace.mutateAsync({ manualId: manual.id, formato: "md" });
      if (r.url) window.open(r.url, "_blank", "noopener");
      else toast.error("Todavía no hay Markdown que descargar.");
    } catch {
      /* el error ya se avisa */
    }
  };
  return { ver, markdown, cargando: enlace.isPending };
}

/* ------------------------------- Pantalla -------------------------------- */

function ManualesPantalla() {
  const { proyecto: proyectoUrl, publico: publicoUrl, nuevo } = Route.useSearch();
  const estado = useEstadoManuales();
  const { data: proyectos = [] } = useProyectos();
  const [filtroProyecto, setFiltroProyecto] = React.useState(proyectoUrl ?? "");
  const [filtroPublico, setFiltroPublico] = React.useState(publicoUrl ?? "");
  const { data: manuales = [] } = useManuales(filtroProyecto || undefined, filtroPublico || undefined);
  const [panelAbierto, setPanelAbierto] = React.useState(Boolean(nuevo));
  const [configAbierta, setConfigAbierta] = React.useState(false);

  useRealtimeManuales(true);

  const enCurso = manuales.filter((m) => m.estado !== "listo" && m.estado !== "error");
  const req = estado.data ?? {};

  return (
    <div>
      <Encabezado
        titulo="Manuales"
        descripcion="NexDeveloper recorre las pantallas del proyecto, redacta el manual y lo deja listo para ver, imprimir o descargar."
        acciones={
          <>
            <Boton variante="suave" onClick={() => setConfigAbierta((v) => !v)}>
              <Settings2 className="size-4" />
              Configuración
            </Boton>
            <Boton onClick={() => setPanelAbierto((v) => !v)}>
              <Plus className="size-4" />
              Nuevo manual
            </Boton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <SemaforoRequisito ok={Boolean(req.ia)} texto={req.ia ? "IA lista" : "Falta clave de IA"} />
        <SemaforoRequisito ok={Boolean(req.github)} texto={req.github ? "GitHub conectado" : "GitHub sin conectar"} />
        <SemaforoRequisito ok={Boolean(req.proyectian)} texto={req.proyectian ? "Proyectian" : "Proyectian sin conectar"} />
        <SemaforoRequisito ok={Boolean(req.almacen)} texto={req.almacen ? "Almacén 03-MANUALES" : "Almacén sin configurar"} />
      </div>

      {configAbierta ? <PanelConfiguracion /> : null}
      {panelAbierto ? <PanelNuevoManual onHecho={() => setPanelAbierto(false)} proyectoInicial={proyectoUrl} /> : null}

      {enCurso.length > 0 ? (
        <section className="mb-4 space-y-3">
          {enCurso.map((m) => (
            <div key={m.id} className="panel space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold">{m.titulo}</h2>
                <span className="text-xs text-muted-foreground">{ETIQUETA_PUBLICO_MANUAL[m.publico]}</span>
              </div>
              <LineaPasos manual={m} />
            </div>
          ))}
        </section>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Proyecto">
          <select className={claseCampo} value={filtroProyecto} onChange={(e) => setFiltroProyecto(e.target.value)}>
            <option value="">Todos los proyectos</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Público">
          <select className={claseCampo} value={filtroPublico} onChange={(e) => setFiltroPublico(e.target.value)}>
            <option value="">Todos los públicos</option>
            {PUBLICOS_MANUAL.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.titulo}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <section className="grid gap-3 lg:grid-cols-2">
        {manuales.map((m) => (
          <TarjetaManual key={m.id} manual={m} nombreProyecto={proyectos.find((p) => p.id === m.proyecto_id)?.nombre ?? ""} />
        ))}
        {manuales.length === 0 ? (
          <p className="panel p-6 text-sm text-muted-foreground">
            Todavía no hay manuales. Pulsa «Nuevo manual» y elige el proyecto y el público.
          </p>
        ) : null}
      </section>
    </div>
  );
}

/* ------------------------------ Nuevo manual ----------------------------- */

function PanelNuevoManual({ onHecho, proyectoInicial }: { onHecho: () => void; proyectoInicial?: string | undefined }) {
  const { data: proyectos = [] } = useProyectos();
  const estado = useEstadoManuales();
  const generar = useGenerarManual();
  const [proyectoId, setProyectoId] = React.useState(proyectoInicial ?? "");
  const [publico, setPublico] = React.useState<PublicoManual>("usuario");
  const [titulo, setTitulo] = React.useState("");
  const [version, setVersion] = React.useState("");
  const [conCapturas, setConCapturas] = React.useState(true);
  const [estilo, setEstilo] = React.useState<"claro" | "tecnico">("claro");
  const guardarConfig = useGuardarConfigManuales();

  const proyecto = proyectos.find((p) => p.id === proyectoId) ?? null;

  React.useEffect(() => {
    if (!proyectoId && proyectos.length > 0) setProyectoId(proyectoInicial ?? proyectos[0]!.id);
  }, [proyectos, proyectoId, proyectoInicial]);

  React.useEffect(() => {
    setVersion(proyecto?.version_actual ?? "");
  }, [proyecto?.id, proyecto?.version_actual]);

  React.useEffect(() => {
    const cfg = estado.data?.config;
    if (cfg) {
      setConCapturas(cfg.incluir_capturas);
      setEstilo(cfg.estilo);
    }
  }, [estado.data?.config]);

  const tituloPorDefecto = proyecto
    ? `Manual de ${publico === "usuario" ? "usuario" : publico === "administrador" ? "administración" : "presentación comercial"} de ${proyecto.nombre}`
    : "";

  const lanzar = async () => {
    if (!proyectoId) return;
    try {
      await guardarConfig.mutateAsync({ incluir_capturas: conCapturas, estilo });
    } catch {
      /* la configuración no es imprescindible para generar */
    }
    try {
      await generar.mutateAsync({
        proyectoId,
        publico,
        titulo: titulo.trim() || tituloPorDefecto,
        ...(version ? { version } : {}),
      });
      toast.success("Manual en marcha. Verás el avance aquí mismo.");
      onHecho();
    } catch {
      /* el error ya se avisa */
    }
  };

  return (
    <section className="panel mb-4 space-y-4 p-4">
      <h2 className="font-display text-sm font-semibold">Nuevo manual</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Proyecto">
          <select className={claseCampo} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.version_actual ? ` (${p.version_actual})` : ""}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Versión" pista={proyecto?.version_actual ? `Versión actual: ${proyecto.version_actual}` : "Sin versión previa"}>
          <input className={claseCampo} value={version} onChange={(e) => setVersion(e.target.value)} />
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PUBLICOS_MANUAL.map((p) => (
          <button
            key={p.valor}
            type="button"
            onClick={() => setPublico(p.valor)}
            className={cn(
              "rounded-xl border p-3 text-left transition",
              publico === p.valor ? "border-primary bg-primary/10" : "border-border bg-surface hover:border-primary/40",
            )}
          >
            <p className="text-sm font-medium">{p.titulo}</p>
            <p className="mt-1 text-xs text-muted-foreground">{p.descripcion}</p>
          </button>
        ))}
      </div>

      <Campo etiqueta="Título" pista={tituloPorDefecto ? `Por defecto: ${tituloPorDefecto}` : undefined}>
        <input className={claseCampo} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tituloPorDefecto} />
      </Campo>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={conCapturas} onChange={(e) => setConCapturas(e.target.checked)} />
          Incluir capturas de las pantallas
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Estilo
          <select
            className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm text-foreground"
            value={estilo}
            onChange={(e) => setEstilo(e.target.value as "claro" | "tecnico")}
          >
            <option value="claro">Claro y cercano</option>
            <option value="tecnico">Técnico y preciso</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Boton onClick={() => void lanzar()} disabled={!proyectoId || generar.isPending}>
          {generar.isPending ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
          {generar.isPending ? "Leyendo pantallas…" : "Generar manual"}
        </Boton>
        <Boton variante="suave" onClick={onHecho}>
          Cancelar
        </Boton>
      </div>
    </section>
  );
}

/* ------------------------------ Configuración ---------------------------- */

function PanelConfiguracion() {
  const estado = useEstadoManuales();
  const guardar = useGuardarConfigManuales();
  const cfg = estado.data?.config ?? null;
  const [regenerar, setRegenerar] = React.useState(true);
  const [estilo, setEstilo] = React.useState<"claro" | "tecnico">("claro");
  const [capturas, setCapturas] = React.useState(true);
  const [servicio, setServicio] = React.useState("");
  const [maximo, setMaximo] = React.useState(12);

  React.useEffect(() => {
    if (!cfg) return;
    setRegenerar(cfg.regenerar_al_cambiar_version);
    setEstilo(cfg.estilo);
    setCapturas(cfg.incluir_capturas);
    setServicio(cfg.servicio_capturas ?? "");
    setMaximo(cfg.max_capitulos ?? 12);
  }, [cfg]);

  return (
    <section className="panel mb-4 space-y-3 p-4">
      <h2 className="font-display text-sm font-semibold">Configuración de los manuales</h2>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={regenerar} onChange={(e) => setRegenerar(e.target.checked)} />
        Regenerar cada semana los manuales cuya versión del proyecto haya cambiado
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={capturas} onChange={(e) => setCapturas(e.target.checked)} />
        Incluir capturas de las pantallas
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Estilo de redacción">
          <select className={claseCampo} value={estilo} onChange={(e) => setEstilo(e.target.value as "claro" | "tecnico")}>
            <option value="claro">Claro y cercano</option>
            <option value="tecnico">Técnico y preciso</option>
          </select>
        </Campo>
        <Campo etiqueta="Servicio de capturas" pista="Dirección base opcional del servicio que hace las capturas">
          <input className={claseCampo} value={servicio} onChange={(e) => setServicio(e.target.value)} placeholder="https://…" />
        </Campo>
        <Campo etiqueta="Máximo de capítulos">
          <input
            type="number"
            min={3}
            max={40}
            className={claseCampo}
            value={maximo}
            onChange={(e) => setMaximo(Number(e.target.value) || 12)}
          />
        </Campo>
      </div>
      <Boton
        onClick={() =>
          guardar.mutate({
            regenerar_al_cambiar_version: regenerar,
            estilo,
            incluir_capturas: capturas,
            servicio_capturas: servicio.trim() || null,
            max_capitulos: maximo,
          })
        }
        disabled={guardar.isPending}
      >
        {guardar.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Guardar configuración
      </Boton>
    </section>
  );
}

/* ------------------------------- Tarjetas -------------------------------- */

function TarjetaManual({ manual, nombreProyecto }: { manual: ManualRow; nombreProyecto: string }) {
  const { ver, markdown } = useAcciones();
  const borrar = useBorrarManual();
  const generar = useGenerarManual();
  const reintentar = useReintentarManual();
  const { data: proyectos = [] } = useProyectos();
  const proyecto = proyectos.find((p) => p.id === manual.proyecto_id) ?? null;

  return (
    <article className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold">{manual.titulo}</h3>
          <p className="text-xs text-muted-foreground">
            {nombreProyecto} · {ETIQUETA_PUBLICO_MANUAL[manual.publico]}
            {manual.version_proyecto ? ` · ${manual.version_proyecto}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs",
            manual.estado === "listo"
              ? "border-success/40 bg-success/10 text-success"
              : manual.estado === "error"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-primary/40 bg-primary/10 text-primary",
          )}
        >
          {ETIQUETA_ESTADO_MANUAL[manual.estado]}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        {formatoFechaHora(manual.creado_el)}
        {typeof manual.coste === "number" ? ` · ${formatoEuros(manual.coste)}` : ""}
      </p>

      {manual.estado === "error" ? <p className="text-sm text-destructive">{manual.error ?? "Ha fallado la generación."}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Boton variante="suave" onClick={() => void ver(manual)} disabled={manual.estado !== "listo"}>
          <BookOpen className="size-4" />
          Ver
        </Boton>
        <Boton variante="suave" onClick={() => void ver(manual, true)} disabled={manual.estado !== "listo"}>
          <Printer className="size-4" />
          Descargar PDF
        </Boton>
        <Boton variante="suave" onClick={() => void markdown(manual)} disabled={manual.estado !== "listo"}>
          <Download className="size-4" />
          Markdown
        </Boton>
        <Link
          to="/manuales/$manualId"
          params={{ manualId: manual.id }}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium transition hover:border-primary/40"
        >
          <Pencil className="size-4" />
          Editar
        </Link>
        {manual.estado === "error" ? (
          <Boton variante="suave" onClick={() => reintentar.mutate(manual.id)} disabled={reintentar.isPending}>
            <RefreshCw className="size-4" />
            Reintentar
          </Boton>
        ) : (
          <Boton
            variante="suave"
            onClick={() =>
              generar.mutate({
                proyectoId: manual.proyecto_id,
                publico: manual.publico,
                titulo: manual.titulo,
                ...(proyecto?.version_actual ? { version: proyecto.version_actual } : {}),
              })
            }
            disabled={generar.isPending}
          >
            <RefreshCw className="size-4" />
            Regenerar
          </Boton>
        )}
        <Boton
          variante="peligro"
          onClick={() => {
            if (window.confirm("¿Seguro que quieres borrar este manual?")) borrar.mutate(manual.id);
          }}
          disabled={borrar.isPending}
        >
          <Trash2 className="size-4" />
          Borrar
        </Boton>
      </div>
    </article>
  );
}

/* --------------------- Bloque para la ficha del proyecto ------------------ */

export function BloqueManualProyecto({ proyectoId }: { proyectoId: string }) {
  const { data: manuales = [] } = useManuales(proyectoId);
  const ultimo = manuales[0] ?? null;
  useRealtimeManuales(true);

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Manuales</h2>
        <Link to="/manuales" search={{ proyecto: proyectoId, nuevo: "1" }} className="text-xs text-primary hover:underline">
          Generar manual
        </Link>
      </div>
      {ultimo ? (
        <Link
          to="/manuales/$manualId"
          params={{ manualId: ultimo.id }}
          className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition hover:border-primary/40"
        >
          <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{ultimo.titulo}</span>
          <span className="ml-auto text-xs text-muted-foreground">{ETIQUETA_ESTADO_MANUAL[ultimo.estado]}</span>
        </Link>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Este proyecto todavía no tiene manuales.</p>
      )}
    </div>
  );
}
