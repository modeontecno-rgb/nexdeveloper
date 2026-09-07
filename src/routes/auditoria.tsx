import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  Stamp,
} from "lucide-react";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type { AreaAuditoria, AuditoriaRow, ProyectoRow, SeveridadHallazgoAuditoria } from "@/lib/nex/db-types";
import { desde, formatoEuros, formatoFechaHora } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import { ETIQUETA_SEMAFORO, FONDO_SEMAFORO, TONO_SEMAFORO } from "@/lib/nex/queries/salud";
import {
  AREAS_AUDITORIA,
  ETIQUETA_AREA_AUDITORIA,
  ETIQUETA_ESTADO_AUDITORIA,
  ETIQUETA_SEVERIDAD,
  SEVERIDADES,
  TONO_SEVERIDAD,
  anteriorDelProyecto,
  contarPorSeveridad,
  etiquetaLote,
  hallazgosDe,
  lotesDe,
  mediaPuntuacion,
  useAuditar,
  useAuditorias,
  useCrearTareaHallazgo,
  useEstadoAuditoria,
  useGuardarConfigAuditoria,
  useRealtimeAuditorias,
  useReintentarAuditoria,
} from "@/lib/nex/queries/auditoria";
import { cn } from "@/lib/utils";

type BusquedaAuditoria = { id?: string; proyecto?: string };

export const Route = createFileRoute("/auditoria")({
  validateSearch: (busqueda: Record<string, unknown>): BusquedaAuditoria => {
    const salida: BusquedaAuditoria = {};
    if (typeof busqueda["id"] === "string") salida.id = busqueda["id"];
    if (typeof busqueda["proyecto"] === "string") salida.proyecto = busqueda["proyecto"];
    return salida;
  },
  head: () => ({
    meta: [
      { title: "Auditoría · NexDeveloper" },
      {
        name: "description",
        content:
          "Auditoría mensual de todos los proyectos: puntuación de 0 a 100, hallazgos con su solución y tareas para lo urgente.",
      },
      { property: "og:title", content: "Auditoría · NexDeveloper" },
      {
        property: "og:description",
        content:
          "Auditoría mensual de todos los proyectos: puntuación de 0 a 100, hallazgos con su solución y tareas para lo urgente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditoriaPantalla,
});

/* ------------------------------ Utilidades ------------------------------- */

function Requisito({ ok, texto }: { ok: boolean; texto: string }) {
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

function nota(auditoria: AuditoriaRow) {
  return typeof auditoria.puntuacion === "number" ? auditoria.puntuacion : null;
}

/* ------------------------------- Pantalla -------------------------------- */

function AuditoriaPantalla() {
  const { id: idUrl, proyecto: proyectoUrl } = Route.useSearch();
  const estado = useEstadoAuditoria();
  const { data: proyectos = [] } = useProyectos();
  const { data: todas = [] } = useAuditorias();
  const auditar = useAuditar();
  const [loteElegido, setLoteElegido] = React.useState("");
  const [configAbierta, setConfigAbierta] = React.useState(false);
  const [detalle, setDetalle] = React.useState<string | null>(idUrl ?? null);
  const [confirmar, setConfirmar] = React.useState(false);

  useRealtimeAuditorias(true);

  const lotes = lotesDe(todas);
  const lote = loteElegido || lotes[0] || "";
  const delLote = todas.filter((a) => a.lote === lote);
  const filtradas = proyectoUrl ? delLote.filter((a) => a.proyecto_id === proyectoUrl) : delLote;
  const enCurso = delLote.filter((a) => a.estado === "pendiente" || a.estado === "analizando").length;
  const req = estado.data ?? {};
  const auditoriaDetalle = todas.find((a) => a.id === detalle) ?? null;

  return (
    <div>
      <Encabezado
        titulo="Auditoría"
        descripcion="El día 2 de cada mes se revisan todos los proyectos: accesibilidad, rendimiento, seguridad, textos, código y datos."
        acciones={
          <>
            <Boton variante="suave" onClick={() => setConfigAbierta((v) => !v)}>
              <Settings2 className="size-4" />
              Configuración
            </Boton>
            <Boton onClick={() => setConfirmar(true)} disabled={auditar.isPending}>
              {auditar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Stamp className="size-4" />}
              Auditar todo ahora
            </Boton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Requisito ok={Boolean(req.ia)} texto={req.ia ? "IA lista" : "Falta clave de IA"} />
        <Requisito ok={Boolean(req.github)} texto={req.github ? "GitHub conectado" : "GitHub sin conectar"} />
        {lotes.length > 0 ? (
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            Lote
            <select
              className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm text-foreground"
              value={lote}
              onChange={(e) => setLoteElegido(e.target.value)}
            >
              {lotes.map((l) => (
                <option key={l} value={l}>
                  {etiquetaLote(l)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {enCurso > 0 ? (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
          <Loader2 className="size-4 animate-spin" />
          Auditando: {delLote.length - enCurso} de {delLote.length} proyectos terminados.
        </p>
      ) : null}

      {configAbierta ? <PanelConfiguracion proyectos={proyectos} /> : null}

      {delLote.length > 0 ? <ResumenLote auditorias={delLote} proyectos={proyectos} /> : null}

      <section className="mt-4 grid gap-3 lg:grid-cols-2">
        {filtradas.map((a) => (
          <TarjetaAuditoria
            key={a.id}
            auditoria={a}
            proyecto={proyectos.find((p) => p.id === a.proyecto_id) ?? null}
            onDetalle={() => setDetalle(a.id)}
          />
        ))}
        {filtradas.length === 0 ? (
          <p className="panel p-6 text-sm text-muted-foreground">
            Todavía no hay auditorías. Pulsa «Auditar todo ahora» para revisar la cartera entera.
          </p>
        ) : null}
      </section>

      {auditoriaDetalle ? (
        <DetalleAuditoria
          auditoria={auditoriaDetalle}
          todas={todas}
          proyecto={proyectos.find((p) => p.id === auditoriaDetalle.proyecto_id) ?? null}
          onCerrar={() => setDetalle(null)}
        />
      ) : null}

      <Dialogo
        abierto={confirmar}
        titulo="Auditar toda la cartera"
        descripcion={`Se revisarán ${proyectos.length} proyectos con seis áreas cada uno. Coste aproximado: ${formatoEuros(proyectos.length * 0.12)}.`}
        onCerrar={() => setConfirmar(false)}
      >
        <p className="text-sm text-muted-foreground">
          El lote se procesa solo: puedes cerrar esta pantalla y volver más tarde, verás el avance en directo.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Boton
            onClick={async () => {
              try {
                await auditar.mutateAsync({});
                setConfirmar(false);
                setLoteElegido("");
              } catch {
                /* el error ya se avisa */
              }
            }}
            disabled={auditar.isPending}
          >
            {auditar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Stamp className="size-4" />}
            Empezar la auditoría
          </Boton>
          <Boton variante="suave" onClick={() => setConfirmar(false)}>
            Cancelar
          </Boton>
        </div>
      </Dialogo>
    </div>
  );
}

/* ------------------------------ Resumen lote ----------------------------- */

function ResumenLote({ auditorias, proyectos }: { auditorias: AuditoriaRow[]; proyectos: ProyectoRow[] }) {
  const media = mediaPuntuacion(auditorias);
  const verdes = auditorias.filter((a) => a.semaforo === "verde").length;
  const ambar = auditorias.filter((a) => a.semaforo === "ambar").length;
  const rojos = auditorias.filter((a) => a.semaforo === "rojo").length;
  const coste = auditorias.reduce((s, a) => s + Number(a.coste ?? 0), 0);

  const conteo: Record<SeveridadHallazgoAuditoria, number> = { critica: 0, alta: 0, media: 0, baja: 0 };
  for (const a of auditorias) {
    const c = contarPorSeveridad(a);
    for (const s of SEVERIDADES) conteo[s] += c[s];
  }

  const datos = auditorias
    .filter((a) => typeof a.puntuacion === "number")
    .map((a) => ({
      nombre: proyectos.find((p) => p.id === a.proyecto_id)?.nombre ?? "Proyecto",
      puntuacion: a.puntuacion ?? 0,
    }))
    .sort((x, y) => x.puntuacion - y.puntuacion);

  return (
    <section className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <Metrica titulo="Nota media" valor={media === null ? "—" : `${media}/100`} pie={`${auditorias.length} proyectos`} />
        <Metrica titulo="Reparto" valor={`${verdes} · ${ambar} · ${rojos}`} pie="verdes · ámbar · rojos" />
        <Metrica
          titulo="Hallazgos"
          valor={`${conteo.critica + conteo.alta + conteo.media + conteo.baja}`}
          pie={`${conteo.critica} críticos · ${conteo.alta} altos`}
        />
        <Metrica titulo="Coste del lote" valor={formatoEuros(coste)} pie="Consumo de IA" />
      </div>

      {datos.length > 0 ? (
        <div className="panel p-4">
          <h2 className="font-display text-sm font-semibold">Puntuación por proyecto</h2>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis type="category" dataKey="nombre" width={140} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  formatter={(v: number) => [`${v}/100`, "Puntuación"]}
                />
                <Bar dataKey="puntuacion" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </section>
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

/* -------------------------------- Tarjetas ------------------------------- */

function TarjetaAuditoria({
  auditoria,
  proyecto,
  onDetalle,
}: {
  auditoria: AuditoriaRow;
  proyecto: ProyectoRow | null;
  onDetalle: () => void;
}) {
  const auditar = useAuditar();
  const reintentar = useReintentarAuditoria();
  const conteo = contarPorSeveridad(auditoria);
  const puntos = nota(auditoria);

  return (
    <article className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={proyecto?.color ? { backgroundColor: proyecto.color } : undefined}
            aria-hidden
          />
          <div>
            <h3 className="font-display text-sm font-semibold">{proyecto?.nombre ?? "Proyecto"}</h3>
            <p className="text-xs text-muted-foreground">
              {ETIQUETA_ESTADO_AUDITORIA[auditoria.estado]} · {desde(auditoria.terminada_el ?? auditoria.creado_el)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full border px-2 py-0.5 text-xs", TONO_SEMAFORO[auditoria.semaforo ?? "gris"])}>
            {ETIQUETA_SEMAFORO[auditoria.semaforo ?? "gris"]}
          </span>
          <span className="font-display text-2xl font-semibold">{puntos === null ? "—" : puntos}</span>
        </div>
      </div>

      {auditoria.estado === "analizando" || auditoria.estado === "pendiente" ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {auditoria.paso ?? "En espera de turno…"}
        </p>
      ) : null}

      {auditoria.estado === "error" ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{auditoria.error ?? "Ha fallado la auditoría."}</p>
          <Boton variante="suave" onClick={() => reintentar.mutate(auditoria.id)} disabled={reintentar.isPending}>
            <RefreshCw className="size-4" /> Reintentar
          </Boton>
        </div>
      ) : null}

      {auditoria.resumen ? <p className="line-clamp-3 text-sm text-muted-foreground">{auditoria.resumen}</p> : null}

      <div className="flex flex-wrap gap-1.5">
        {AREAS_AUDITORIA.map((a) => (
          <ChipArea key={a.valor} area={a.valor} valor={auditoria.puntuaciones?.[a.valor] ?? null} />
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SEVERIDADES.filter((s) => conteo[s] > 0).map((s) => (
          <span key={s} className={cn("rounded-full border px-2 py-0.5 text-xs", TONO_SEVERIDAD[s])}>
            {conteo[s]} {ETIQUETA_SEVERIDAD[s].toLowerCase()}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Boton variante="suave" onClick={onDetalle}>
          <Search className="size-4" /> Ver detalle
        </Boton>
        <Boton
          variante="suave"
          onClick={() => auditar.mutate({ proyectoId: auditoria.proyecto_id })}
          disabled={auditar.isPending}
        >
          {auditar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Stamp className="size-4" />}
          Auditar solo este
        </Boton>
      </div>
    </article>
  );
}

function ChipArea({ area, valor }: { area: AreaAuditoria; valor: number | null }) {
  const tono =
    valor === null
      ? "border-border bg-muted text-muted-foreground"
      : valor >= 80
        ? "border-success/40 bg-success/10 text-success"
        : valor >= 60
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-destructive/40 bg-destructive/10 text-destructive";
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-xs", tono)}>
      {ETIQUETA_AREA_AUDITORIA[area]} {valor === null ? "—" : valor}
    </span>
  );
}

/* -------------------------------- Detalle -------------------------------- */

function DetalleAuditoria({
  auditoria,
  todas,
  proyecto,
  onCerrar,
}: {
  auditoria: AuditoriaRow;
  todas: AuditoriaRow[];
  proyecto: ProyectoRow | null;
  onCerrar: () => void;
}) {
  const crearTarea = useCrearTareaHallazgo();
  const [materialAbierto, setMaterialAbierto] = React.useState(false);
  const hallazgos = hallazgosDe(auditoria).map((h, indice) => ({ ...h, indice }));
  const anterior = anteriorDelProyecto(todas, auditoria);
  const diferencia =
    anterior && typeof anterior.puntuacion === "number" && typeof auditoria.puntuacion === "number"
      ? auditoria.puntuacion - anterior.puntuacion
      : null;

  return (
    <Dialogo
      abierto
      titulo={proyecto?.nombre ?? "Auditoría"}
      descripcion={`${etiquetaLote(auditoria.lote)} · ${formatoFechaHora(auditoria.terminada_el ?? auditoria.creado_el)}`}
      onCerrar={onCerrar}
      ancho="max-w-4xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-3xl font-semibold">
            {typeof auditoria.puntuacion === "number" ? `${auditoria.puntuacion}/100` : "—"}
          </span>
          <span className={cn("rounded-full border px-2 py-0.5 text-xs", TONO_SEMAFORO[auditoria.semaforo ?? "gris"])}>
            {ETIQUETA_SEMAFORO[auditoria.semaforo ?? "gris"]}
          </span>
          {diferencia !== null ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                diferencia >= 0
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              {diferencia >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {diferencia >= 0 ? `+${diferencia}` : diferencia} desde la anterior
            </span>
          ) : null}
        </div>

        {auditoria.resumen ? <p className="text-sm text-muted-foreground">{auditoria.resumen}</p> : null}

        <div className="flex flex-wrap gap-1.5">
          {AREAS_AUDITORIA.map((a) => (
            <ChipArea key={a.valor} area={a.valor} valor={auditoria.puntuaciones?.[a.valor] ?? null} />
          ))}
        </div>

        <div className="space-y-4">
          {SEVERIDADES.map((severidad) => {
            const grupo = hallazgos.filter((h) => h.severidad === severidad);
            if (grupo.length === 0) return null;
            return (
              <section key={severidad} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {ETIQUETA_SEVERIDAD[severidad]} ({grupo.length})
                </h3>
                {grupo.map((h) => (
                  <article key={h.indice} className={cn("space-y-2 rounded-lg border p-3", TONO_SEVERIDAD[severidad])}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{h.titulo}</p>
                      <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted-foreground">
                        {ETIQUETA_AREA_AUDITORIA[h.area as AreaAuditoria] ?? h.area}
                      </span>
                    </div>
                    {h.detalle ? <p className="text-sm text-foreground/90">{h.detalle}</p> : null}
                    {h.donde ? <p className="text-xs text-muted-foreground">Dónde: {h.donde}</p> : null}
                    {h.solucion ? (
                      <p className="text-sm text-foreground/90">
                        <span className="font-medium">Solución: </span>
                        {h.solucion}
                      </p>
                    ) : null}
                    {h.tarea_id ? (
                      <Link
                        to="/tareas"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-primary hover:underline"
                      >
                        <ClipboardCheck className="size-3.5" /> Tarea creada
                      </Link>
                    ) : (
                      <Boton
                        variante="suave"
                        onClick={() => crearTarea.mutate({ auditoriaId: auditoria.id, indice: h.indice })}
                        disabled={crearTarea.isPending}
                      >
                        {crearTarea.isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
                        Crear tarea
                      </Boton>
                    )}
                  </article>
                ))}
              </section>
            );
          })}
          {hallazgos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No se han encontrado hallazgos en esta auditoría.</p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border p-3">
          <button
            type="button"
            onClick={() => setMaterialAbierto((v) => !v)}
            className="text-sm font-medium text-foreground"
          >
            {materialAbierto ? "▾" : "▸"} Qué se ha analizado
          </button>
          {materialAbierto ? (
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
              {JSON.stringify(auditoria.material ?? {}, null, 2)}
            </pre>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {formatoEuros(Number(auditoria.coste ?? 0))} · {Number(auditoria.tokens_entrada ?? 0)} tokens de entrada ·{" "}
          {Number(auditoria.tokens_salida ?? 0)} de salida · {Number(auditoria.tareas_creadas ?? 0)} tareas creadas
        </p>
      </div>
    </Dialogo>
  );
}

/* ----------------------------- Configuración ----------------------------- */

function PanelConfiguracion({ proyectos }: { proyectos: ProyectoRow[] }) {
  const estado = useEstadoAuditoria();
  const guardar = useGuardarConfigAuditoria();
  const cfg = estado.data?.config ?? null;
  const [activa, setActiva] = React.useState(true);
  const [dia, setDia] = React.useState(2);
  const [areas, setAreas] = React.useState<Partial<Record<AreaAuditoria, boolean>>>({});
  const [crearTareas, setCrearTareas] = React.useState(true);
  const [soloGraves, setSoloGraves] = React.useState(true);
  const [maximo, setMaximo] = React.useState(20);
  const [excluidos, setExcluidos] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!cfg) return;
    setActiva(cfg.activa);
    setDia(cfg.dia_mes ?? 2);
    setAreas(cfg.areas ?? {});
    setCrearTareas(cfg.crear_tareas);
    setSoloGraves(cfg.solo_criticas_y_altas);
    setMaximo(cfg.max_hallazgos_por_proyecto ?? 20);
    setExcluidos(cfg.proyectos_excluidos ?? []);
  }, [cfg]);

  return (
    <section className="panel mb-4 space-y-3 p-4">
      <h2 className="font-display text-sm font-semibold">Configuración de la auditoría</h2>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
        Auditar la cartera todos los meses
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Día del mes">
          <input
            type="number"
            min={1}
            max={28}
            className={claseCampo}
            value={dia}
            onChange={(e) => setDia(Number(e.target.value) || 2)}
          />
        </Campo>
        <Campo etiqueta="Máximo de hallazgos por proyecto">
          <input
            type="number"
            min={3}
            max={100}
            className={claseCampo}
            value={maximo}
            onChange={(e) => setMaximo(Number(e.target.value) || 20)}
          />
        </Campo>
        <Campo etiqueta="Proyectos excluidos" pista="Mantén pulsada Ctrl para elegir varios">
          <select
            multiple
            className={cn(claseCampo, "h-28")}
            value={excluidos}
            onChange={(e) => setExcluidos(Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {AREAS_AUDITORIA.map((a) => (
          <label key={a.valor} className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={areas[a.valor] !== false}
              onChange={(e) => setAreas((prev) => ({ ...prev, [a.valor]: e.target.checked }))}
            />
            <span>
              <span className="font-medium">{a.titulo}</span>
              <span className="block text-xs text-muted-foreground">{a.descripcion}</span>
            </span>
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={crearTareas} onChange={(e) => setCrearTareas(e.target.checked)} />
        Crear tareas automáticamente con los hallazgos
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={soloGraves} onChange={(e) => setSoloGraves(e.target.checked)} />
        Solo crear tareas de los hallazgos críticos y altos
      </label>

      <Boton
        onClick={() =>
          guardar.mutate({
            activa,
            dia_mes: dia,
            areas,
            crear_tareas: crearTareas,
            solo_criticas_y_altas: soloGraves,
            max_hallazgos_por_proyecto: maximo,
            proyectos_excluidos: excluidos,
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

/* --------------------------- Piezas reutilizables ------------------------- */

/** Chip de la ficha del proyecto: «Auditoría: 82/100». */
export function ChipAuditoriaProyecto({ proyecto }: { proyecto: ProyectoRow }) {
  const puntos = proyecto.puntuacion_auditoria;
  const tono =
    typeof puntos !== "number"
      ? "border-border bg-muted text-muted-foreground"
      : puntos >= 80
        ? "border-success/40 bg-success/10 text-success"
        : puntos >= 60
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-destructive/40 bg-destructive/10 text-destructive";
  return (
    <Link
      to="/auditoria"
      search={{ proyecto: proyecto.id }}
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition", tono)}
      title={proyecto.auditoria_el ? `Auditado ${desde(proyecto.auditoria_el)}` : "Sin auditar todavía"}
    >
      <Stamp className="size-3.5" />
      {typeof puntos === "number" ? `Auditoría: ${puntos}/100` : "Sin auditar"}
      {proyecto.auditoria_el ? ` · ${desde(proyecto.auditoria_el)}` : ""}
    </Link>
  );
}

/** Tarjeta del Panel principal con la nota media del mes y los proyectos en rojo. */
export function TarjetaAuditoriaMes() {
  const { data: todas = [] } = useAuditorias();
  const { data: proyectos = [] } = useProyectos();
  const lote = lotesDe(todas)[0] ?? "";
  const delLote = todas.filter((a) => a.lote === lote);
  const media = mediaPuntuacion(delLote);
  const rojos = delLote.filter((a) => a.semaforo === "rojo");

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Auditoría del mes</h2>
        <span
          className={cn("size-2.5 rounded-full", FONDO_SEMAFORO[rojos.length > 0 ? "rojo" : media === null ? "gris" : "verde"])}
          aria-hidden
        />
      </div>
      {delLote.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Todavía no se ha auditado ningún proyecto.</p>
      ) : (
        <>
          <p className="mt-2 font-display text-2xl font-semibold">{media === null ? "—" : `${media}/100`}</p>
          <p className="text-xs text-muted-foreground">
            {etiquetaLote(lote)} · {delLote.length} proyectos
          </p>
          {rojos.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {rojos.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{proyectos.find((p) => p.id === a.proyecto_id)?.nombre ?? "Proyecto"}</span>
                  <span className="text-xs text-destructive">{a.puntuacion ?? "—"}/100</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Ningún proyecto en rojo.</p>
          )}
        </>
      )}
      <Link to="/auditoria" className="mt-3 inline-flex text-xs text-primary hover:underline">
        Ver la auditoría
      </Link>
    </div>
  );
}
