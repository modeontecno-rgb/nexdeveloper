import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Play,
  PlugZap,
  RefreshCw,
  RotateCcw,
  ThumbsDown,
  Unplug,
  XCircle,
  Zap,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando } from "@/components/nex/badges";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type {
  EjecucionConfigRow,
  EjecucionOrdenRow,
  EstadoEjecucion,
  ModoTrabajoEjecucion,
  MotorEjecucion,
} from "@/lib/nex/db-types";
import { desde, formatoDinero, formatoFechaHora } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import { useModelosIa, useProveedoresIa } from "@/lib/nex/queries/proveedores";
import { markdownAHtml } from "@/lib/nex/queries/resumenes";
import {
  ETIQUETA_ESTADO_EJECUCION,
  ETIQUETA_MODO_TRABAJO,
  ETIQUETA_MOTOR,
  EXPLICACION_MOTOR,
  PASOS_EJECUCION,
  type PruebaConexiones,
  tonoEstadoEjecucion,
  useAprobarPublicar,
  useCancelarEjecucion,
  useConectarLovable,
  useDesconectarLovable,
  useEjecucionConfig,
  useEjecuciones,
  useEjecutar,
  useEstadoEjecucion,
  useGuardarConfigEjecucion,
  useProbarConexiones,
  useRealtimeEjecuciones,
  useRechazarEjecucion,
  useReintentarEjecucion,
  useSondear,
} from "@/lib/nex/queries/ejecucion";

type BusquedaEjecucion = { ejecucion?: string };

export const Route = createFileRoute("/ejecucion")({
  validateSearch: (busqueda: Record<string, unknown>): BusquedaEjecucion =>
    typeof busqueda["ejecucion"] === "string" ? { ejecucion: busqueda["ejecucion"] as string } : {},
  head: () => ({
    meta: [
      { title: "Ejecución de órdenes · NexDeveloper" },
      {
        name: "description",
        content: "NexDeveloper ejecuta las órdenes de verdad, comprueba el resultado y solo te pide aprobar y publicar.",
      },
      { property: "og:title", content: "Ejecución de órdenes · NexDeveloper" },
      {
        property: "og:description",
        content: "NexDeveloper ejecuta las órdenes de verdad, comprueba el resultado y solo te pide aprobar y publicar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaEjecucion,
});

const MOTORES: MotorEjecucion[] = ["auto", "lovable", "claude"];

function PantallaEjecucion() {
  const { ejecucion: seleccionada } = Route.useSearch();
  const navegar = useNavigate();
  const { data: ejecuciones = [], isPending } = useEjecuciones();
  const { data: proyectos = [] } = useProyectos();
  useRealtimeEjecuciones(true);

  const [filtroEstado, setFiltroEstado] = React.useState<EstadoEjecucion | "todos">("todos");
  const [filtroProyecto, setFiltroProyecto] = React.useState("");
  const [filtroMotor, setFiltroMotor] = React.useState<MotorEjecucion | "todos">("todos");

  const abrir = (id: string | null) =>
    void navegar({ to: "/ejecucion", search: id ? { ejecucion: id } : {}, replace: true });

  const visibles = ejecuciones.filter(
    (e) =>
      (filtroEstado === "todos" || e.estado === filtroEstado) &&
      (!filtroProyecto || e.proyecto_id === filtroProyecto) &&
      (filtroMotor === "todos" || e.motor === filtroMotor),
  );

  const detalle = ejecuciones.find((e) => e.id === seleccionada) ?? null;
  const nombreProyecto = (id: string | null) => proyectos.find((p) => p.id === id)?.nombre ?? "Sin proyecto";

  return (
    <>
      <Encabezado
        titulo="Ejecución de órdenes"
        descripcion="NexDeveloper hace el trabajo, comprueba el resultado y te deja solo el «Aprobar y publicar»."
      />

      <TarjetaConexion />
      <PanelConfiguracion />
      <PanelEjecutarAhora />

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-sm font-semibold">Ejecuciones</h2>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoEjecucion | "todos")}
            className="rounded-md border border-input bg-surface px-2 py-1.5 text-xs"
          >
            <option value="todos">Todos los estados</option>
            {Object.entries(ETIQUETA_ESTADO_EJECUCION).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={filtroProyecto}
            onChange={(e) => setFiltroProyecto(e.target.value)}
            className="rounded-md border border-input bg-surface px-2 py-1.5 text-xs"
          >
            <option value="">Todos los proyectos</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <select
            value={filtroMotor}
            onChange={(e) => setFiltroMotor(e.target.value as MotorEjecucion | "todos")}
            className="rounded-md border border-input bg-surface px-2 py-1.5 text-xs"
          >
            <option value="todos">Todos los motores</option>
            {MOTORES.map((m) => (
              <option key={m} value={m}>
                {ETIQUETA_MOTOR[m]}
              </option>
            ))}
          </select>
        </div>

        {isPending ? (
          <Cargando />
        ) : visibles.length === 0 ? (
          <p className="panel p-6 text-sm text-muted-foreground">
            Todavía no hay ninguna ejecución. Envía un trabajo desde «Ejecutar ahora» o desde una orden aprobada.
          </p>
        ) : (
          <div className="space-y-3">
            {visibles.map((e) => (
              <TarjetaEjecucion
                key={e.id}
                ejecucion={e}
                proyecto={nombreProyecto(e.proyecto_id)}
                onDetalle={() => abrir(e.id)}
              />
            ))}
          </div>
        )}
      </section>

      <DetalleEjecucion ejecucion={detalle} proyecto={detalle ? nombreProyecto(detalle.proyecto_id) : ""} onCerrar={() => abrir(null)} />
    </>
  );
}

/* ------------------------------- Conexión -------------------------------- */

function TarjetaConexion() {
  const navegar = useNavigate();
  const { data: estado, isPending } = useEstadoEjecucion();
  const conectar = useConectarLovable();
  const desconectar = useDesconectarLovable();
  const probar = useProbarConexiones();
  const [prueba, setPrueba] = React.useState<PruebaConexiones | null>(null);

  const conexion = estado?.conexion ?? null;
  const chip =
    conexion?.estado === "conectada"
      ? { clase: "border-success/40 bg-success/10 text-success", texto: `Conectado (${conexion.cuenta ?? "cuenta"})` }
      : conexion?.estado === "error"
        ? {
            clase: "border-destructive/40 bg-destructive/10 text-destructive",
            texto: conexion.ultimo_error ?? "Error de conexión",
          }
        : { clase: "border-border bg-muted text-muted-foreground", texto: "Sin conectar" };

  const motorClaude = estado?.motor_claude_listo
    ? { clase: "text-success", texto: "Motor Claude + GitHub: listo" }
    : !estado?.clave_anthropic
      ? { clase: "text-destructive", texto: "Motor Claude + GitHub: falta la clave de Anthropic" }
      : { clase: "text-destructive", texto: "Motor Claude + GitHub: falta el GITHUB_TOKEN" };

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-sm font-semibold">Conexión con Lovable</h2>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${chip.clase}`}>
            {isPending ? "Comprobando..." : chip.texto}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton variante="suave" onClick={() => void navegar({ to: "/mesa" })} className="px-3 py-1.5 text-xs">
            <MessagesSquare className="size-3.5" /> Ir a Mesa de expertos
          </Boton>
          <Boton onClick={() => conectar.mutate()} disabled={conectar.isPending} className="px-3 py-1.5 text-xs">
            <PlugZap className="size-3.5" /> Conectar con Lovable
          </Boton>
          <Boton
            variante="suave"
            onClick={() => desconectar.mutate()}
            disabled={desconectar.isPending}
            className="px-3 py-1.5 text-xs"
          >
            <Unplug className="size-3.5" /> Desconectar
          </Boton>
          <Boton
            variante="suave"
            onClick={() => probar.mutateAsync().then((r) => setPrueba(r)).catch(() => setPrueba(null))}
            disabled={probar.isPending}
            className="px-3 py-1.5 text-xs"
          >
            {probar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Probar
            conexiones
          </Boton>
        </div>
      </div>

      {prueba ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <SemaforoPrueba nombre="Lovable" ok={Boolean(prueba.lovable?.ok)} detalle={prueba.lovable?.cuenta ?? prueba.lovable?.error ?? null} />
          <SemaforoPrueba nombre="GitHub" ok={Boolean(prueba.github?.ok)} detalle={prueba.github?.cuenta ?? prueba.github?.error ?? null} />
          <SemaforoPrueba nombre="Anthropic" ok={Boolean(prueba.anthropic?.ok)} detalle={prueba.anthropic?.error ?? null} />
        </div>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        Si Lovable rechaza la conexión, NexDeveloper ejecuta las órdenes con el motor Claude + GitHub; puedes pedir a
        Lovable que autorice la URI de retorno{estado?.url_callback ? ` (${estado.url_callback})` : ""}.
      </p>
      <p className={`mt-1.5 text-xs ${motorClaude.clase}`}>
        {motorClaude.texto} ·{" "}
        <Link to="/ajustes/proveedores" className="underline">
          Ajustes → Proveedores
        </Link>
      </p>
      {typeof estado?.proyectos_sin_lovable === "number" && estado.proyectos_sin_lovable > 0 ? (
        <p className="mt-1.5 text-xs text-warning">
          {estado.proyectos_sin_lovable} proyectos no tienen todavía su proyecto de Lovable asignado.
        </p>
      ) : null}
    </section>
  );
}

function SemaforoPrueba({ nombre, ok, detalle }: { nombre: string; ok: boolean; detalle: string | null }) {
  return (
    <div
      className={`rounded-lg border p-3 text-xs ${
        ok ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"
      }`}
    >
      <p className="flex items-center gap-1.5 font-medium">
        {ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />} {nombre}
      </p>
      <p className="mt-0.5">{ok ? `OK${detalle ? ` · ${detalle}` : ""}` : (detalle ?? "No responde")}</p>
    </div>
  );
}

/* ----------------------------- Configuración ------------------------------ */

function PanelConfiguracion() {
  const { data: config } = useEjecucionConfig();
  const guardar = useGuardarConfigEjecucion();
  const { data: modelos = [] } = useModelosIa();
  const { data: proveedores = [] } = useProveedoresIa();
  const [abierto, setAbierto] = React.useState(false);
  const [borrador, setBorrador] = React.useState<Partial<EjecucionConfigRow>>({});

  React.useEffect(() => {
    if (config) setBorrador(config);
  }, [config]);

  const anthropicIds = proveedores.filter((p) => p.clave_slug.includes("anthropic")).map((p) => p.id);
  const modelosClaude = modelos.filter((m) => m.activo && anthropicIds.includes(m.proveedor_id));

  const valor = <K extends keyof EjecucionConfigRow>(campo: K, porDefecto: EjecucionConfigRow[K]) =>
    (borrador[campo] ?? porDefecto) as EjecucionConfigRow[K];

  const cambiar = <K extends keyof EjecucionConfigRow>(campo: K, v: EjecucionConfigRow[K]) =>
    setBorrador((b) => ({ ...b, [campo]: v }));

  return (
    <section className="panel mt-4 p-5">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h2 className="font-display text-sm font-semibold">Configuración de la ejecución</h2>
        <span className="text-xs text-muted-foreground">{abierto ? "Ocultar" : "Mostrar"}</span>
      </button>

      {abierto ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Interruptor
              etiqueta="Ejecutar las órdenes aprobadas automáticamente"
              activo={valor("auto_ejecutar", false)}
              onChange={(v) => cambiar("auto_ejecutar", v)}
            />
            <Interruptor
              etiqueta="Publicar automáticamente (publica sin revisar)"
              activo={valor("auto_publicar", false)}
              onChange={(v) => cambiar("auto_publicar", v)}
            />
            <Interruptor
              etiqueta="Comprobar la vista previa antes de avisarte"
              activo={valor("comprobar_preview", true)}
              onChange={(v) => cambiar("comprobar_preview", v)}
            />
            <Interruptor
              etiqueta="Modo máximo de Lovable (×2,5 créditos)"
              activo={valor("modo_max", false)}
              onChange={(v) => cambiar("modo_max", v)}
            />
          </div>

          <Campo etiqueta="Motor preferido" pista={EXPLICACION_MOTOR[valor("motor_preferido", "auto")]}>
            <select
              value={valor("motor_preferido", "auto")}
              onChange={(e) => cambiar("motor_preferido", e.target.value as MotorEjecucion)}
              className={claseCampo}
            >
              {MOTORES.map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_MOTOR[m]}
                </option>
              ))}
            </select>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Modelo de Claude">
              <select
                value={valor("modelo_claude", "") ?? ""}
                onChange={(e) => cambiar("modelo_claude", e.target.value)}
                className={claseCampo}
              >
                <option value="">El que decida NexDeveloper</option>
                {modelosClaude.map((m) => (
                  <option key={m.id} value={m.identificador}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Trabajos a la vez (1-5)">
              <input
                type="number"
                min={1}
                max={5}
                value={valor("max_simultaneas", 1)}
                onChange={(e) => cambiar("max_simultaneas", Number(e.target.value))}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Pasos máximos del motor Claude (10-80)">
              <input
                type="number"
                min={10}
                max={80}
                value={valor("max_pasos", 30)}
                onChange={(e) => cambiar("max_pasos", Number(e.target.value))}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Coste máximo de IA por orden (€)">
              <input
                type="number"
                min={0}
                step="0.5"
                value={valor("max_coste_ia", 5)}
                onChange={(e) => cambiar("max_coste_ia", Number(e.target.value))}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Avisarme cuando queden menos créditos de">
              <input
                type="number"
                min={0}
                value={valor("aviso_creditos", 0)}
                onChange={(e) => cambiar("aviso_creditos", Number(e.target.value))}
                className={claseCampo}
              />
            </Campo>
          </div>

          <Boton onClick={() => guardar.mutate(borrador)} disabled={guardar.isPending}>
            Guardar configuración
          </Boton>
        </div>
      ) : null}
    </section>
  );
}

function Interruptor({
  etiqueta,
  activo,
  onChange,
}: {
  etiqueta: string;
  activo: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
      <input type="checkbox" checked={activo} onChange={(e) => onChange(e.target.checked)} className="size-4" />
      {etiqueta}
    </label>
  );
}

/* ----------------------------- Ejecutar ahora ----------------------------- */

function PanelEjecutarAhora() {
  const { data: proyectos = [] } = useProyectos();
  const ejecutar = useEjecutar();
  const [proyectoId, setProyectoId] = React.useState("");
  const [texto, setTexto] = React.useState("");
  const [modo, setModo] = React.useState<ModoTrabajoEjecucion>("construir");
  const [motor, setMotor] = React.useState<MotorEjecucion>("auto");

  const enviar = async () => {
    if (!proyectoId || texto.trim().length < 5) {
      toast.error("Elige un proyecto y escribe qué hay que hacer.");
      return;
    }
    await ejecutar.mutateAsync({ proyectoId, texto: texto.trim(), modo, motor });
    setTexto("");
  };

  return (
    <section className="panel mt-4 p-5">
      <h2 className="font-display text-sm font-semibold">Ejecutar ahora</h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_16rem]">
        <Campo etiqueta="¿Qué hay que hacer?">
          <textarea
            rows={4}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Por ejemplo: añade el buscador a la pantalla de clientes."
            className={claseCampo}
          />
        </Campo>
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
          <Campo etiqueta="Modo">
            <select
              value={modo}
              onChange={(e) => setModo(e.target.value as ModoTrabajoEjecucion)}
              className={claseCampo}
            >
              {(["construir", "planificar"] as ModoTrabajoEjecucion[]).map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_MODO_TRABAJO[m]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Motor" pista={EXPLICACION_MOTOR[motor]}>
            <select value={motor} onChange={(e) => setMotor(e.target.value as MotorEjecucion)} className={claseCampo}>
              {MOTORES.map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_MOTOR[m]}
                </option>
              ))}
            </select>
          </Campo>
          <Boton onClick={() => void enviar()} disabled={ejecutar.isPending} className="w-full">
            {ejecutar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Ejecutar
          </Boton>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Ejecución -------------------------------- */

export function LineaPasos({ estado }: { estado: EstadoEjecucion }) {
  if (estado === "error" || estado === "cancelada") {
    return (
      <p className={`text-xs ${estado === "error" ? "text-destructive" : "text-muted-foreground"}`}>
        {ETIQUETA_ESTADO_EJECUCION[estado]}
      </p>
    );
  }
  const indice = PASOS_EJECUCION.indexOf(estado);
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {PASOS_EJECUCION.map((paso, i) => (
        <li
          key={paso}
          className={`rounded-full border px-2 py-0.5 text-[11px] ${
            i < indice
              ? "border-success/40 bg-success/10 text-success"
              : i === indice
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-muted text-muted-foreground"
          }`}
        >
          {ETIQUETA_ESTADO_EJECUCION[paso]}
        </li>
      ))}
    </ol>
  );
}

function TarjetaEjecucion({
  ejecucion,
  proyecto,
  onDetalle,
}: {
  ejecucion: EjecucionOrdenRow;
  proyecto: string;
  onDetalle: () => void;
}) {
  const sondear = useSondear();
  const aprobar = useAprobarPublicar();
  const rechazar = useRechazarEjecucion();
  const cancelar = useCancelarEjecucion();
  const reintentar = useReintentarEjecucion();
  const [motivo, setMotivo] = React.useState("");
  const [rechazando, setRechazando] = React.useState(false);

  const enCurso = !["completada", "error", "cancelada", "esperando_aprobacion"].includes(ejecucion.estado);

  return (
    <article className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{(ejecucion.texto ?? "Sin texto").split("\n")[0]}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {proyecto} · {desde(ejecucion.creado_el)}
            {ejecucion.pasos ? ` · ${ejecucion.pasos} pasos` : ""}
            {ejecucion.coste_creditos ? ` · ${ejecucion.coste_creditos} créditos` : ""}
            {ejecucion.coste_ia ? ` · ${formatoDinero(Number(ejecucion.coste_ia))}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-muted-foreground">
            {ETIQUETA_MOTOR[ejecucion.motor]}
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${tonoEstadoEjecucion(ejecucion.estado)}`}
          >
            {ETIQUETA_ESTADO_EJECUCION[ejecucion.estado]}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <LineaPasos estado={ejecucion.estado} />
      </div>

      {ejecucion.error ? <p className="mt-2 text-xs text-destructive">{ejecucion.error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Boton variante="suave" onClick={onDetalle} className="px-2.5 py-1 text-xs">
          Ver detalle
        </Boton>
        {enCurso ? (
          <>
            <Boton
              variante="suave"
              onClick={() => sondear.mutate(ejecucion.id)}
              disabled={sondear.isPending}
              className="px-2.5 py-1 text-xs"
            >
              <RefreshCw className="size-3.5" /> Comprobar ahora
            </Boton>
            <Boton
              variante="peligro"
              onClick={() => cancelar.mutate(ejecucion.id)}
              className="px-2.5 py-1 text-xs"
            >
              Cancelar
            </Boton>
          </>
        ) : null}
        {ejecucion.estado === "error" ? (
          <Boton variante="suave" onClick={() => reintentar.mutate(ejecucion.id)} className="px-2.5 py-1 text-xs">
            <RotateCcw className="size-3.5" /> Reintentar
          </Boton>
        ) : null}
      </div>

      {ejecucion.estado === "esperando_aprobacion" ? (
        <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="text-xs text-warning">
            El trabajo está listo. Revísalo en la vista previa y decide si se publica.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Boton
              onClick={() => aprobar.mutate(ejecucion.id)}
              disabled={aprobar.isPending}
              className="bg-success text-white hover:opacity-90"
            >
              <CheckCircle2 className="size-4" /> Aprobar y publicar
            </Boton>
            <Boton variante="peligro" onClick={() => setRechazando(true)}>
              <ThumbsDown className="size-4" /> Rechazar
            </Boton>
            {ejecucion.preview_url ? (
              <a
                href={ejecucion.preview_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <ExternalLink className="size-4" /> Ver la vista previa
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <Dialogo
        abierto={rechazando}
        titulo="Rechazar los cambios"
        descripcion="Puedes explicar por qué, para que quede constancia."
        onCerrar={() => setRechazando(false)}
        ancho="max-w-lg"
      >
        <textarea
          rows={4}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
          className={claseCampo}
        />
        <div className="mt-3 flex justify-end gap-2">
          <Boton variante="suave" type="button" onClick={() => setRechazando(false)}>
            Cerrar
          </Boton>
          <Boton
            variante="peligro"
            type="button"
            onClick={() => {
              rechazar.mutate({ ejecucionId: ejecucion.id, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) });
              setRechazando(false);
            }}
          >
            Rechazar
          </Boton>
        </div>
      </Dialogo>
    </article>
  );
}

function DetalleEjecucion({
  ejecucion,
  proyecto,
  onCerrar,
}: {
  ejecucion: EjecucionOrdenRow | null;
  proyecto: string;
  onCerrar: () => void;
}) {
  const [verRespuesta, setVerRespuesta] = React.useState(false);
  if (!ejecucion) return null;

  return (
    <Dialogo
      abierto={Boolean(ejecucion)}
      titulo={`Ejecución · ${proyecto}`}
      descripcion={ETIQUETA_ESTADO_EJECUCION[ejecucion.estado]}
      onCerrar={onCerrar}
      ancho="max-w-3xl"
    >
      <div className="space-y-4 text-sm">
        <LineaPasos estado={ejecucion.estado} />

        {ejecucion.resumen ? (
          <div
            className="prose-nex text-sm text-foreground [&_a]:text-primary [&_li]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: markdownAHtml(ejecucion.resumen) }}
          />
        ) : null}

        {ejecucion.respuesta ? (
          <div>
            <button
              type="button"
              onClick={() => setVerRespuesta((v) => !v)}
              className="text-xs font-medium text-primary underline"
            >
              {verRespuesta ? "Ocultar la respuesta completa" : "Ver la respuesta completa"}
            </button>
            {verRespuesta ? (
              <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-border bg-surface p-3 text-xs whitespace-pre-wrap">
                {ejecucion.respuesta}
              </pre>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {ejecucion.preview_url ? (
            <a
              href={ejecucion.preview_url}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${
                ejecucion.preview_ok === false
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-success/40 bg-success/10 text-success"
              }`}
            >
              <ExternalLink className="size-3.5" /> Vista previa
              {ejecucion.preview_ok === false ? " (no carga)" : ejecucion.preview_ok ? " (correcta)" : ""}
            </a>
          ) : null}
          {ejecucion.pr_url ? (
            <a
              href={ejecucion.pr_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs"
            >
              <ExternalLink className="size-3.5" /> Solicitud de cambios
              {ejecucion.pr_numero ? ` #${ejecucion.pr_numero}` : ""}
            </a>
          ) : null}
          {ejecucion.publicado_url ? (
            <a
              href={ejecucion.publicado_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs"
            >
              <ExternalLink className="size-3.5" /> Publicado
            </a>
          ) : null}
        </div>

        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <Dato termino="Motor" valor={ETIQUETA_MOTOR[ejecucion.motor]} />
          <Dato termino="Modo" valor={ETIQUETA_MODO_TRABAJO[ejecucion.modo]} />
          <Dato termino="Rama" valor={ejecucion.rama ?? "—"} />
          <Dato termino="Commit" valor={ejecucion.commit_sha?.slice(0, 10) ?? "—"} />
          <Dato termino="Pasos" valor={ejecucion.pasos ? String(ejecucion.pasos) : "—"} />
          <Dato
            termino="Coste"
            valor={
              ejecucion.coste_ia
                ? formatoDinero(Number(ejecucion.coste_ia))
                : ejecucion.coste_creditos
                  ? `${ejecucion.coste_creditos} créditos`
                  : "—"
            }
          />
          <Dato
            termino="Tokens"
            valor={`${ejecucion.tokens_entrada ?? 0} entrada / ${ejecucion.tokens_salida ?? 0} salida`}
          />
          <Dato termino="Intentos" valor={String(ejecucion.intentos ?? 1)} />
          <Dato termino="Creada" valor={formatoFechaHora(ejecucion.creado_el)} />
          <Dato termino="Iniciada" valor={formatoFechaHora(ejecucion.iniciada_el) || "—"} />
          <Dato termino="Aprobada" valor={formatoFechaHora(ejecucion.aprobada_el) || "—"} />
          <Dato termino="Terminada" valor={formatoFechaHora(ejecucion.terminada_el) || "—"} />
        </dl>

        {ejecucion.error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {ejecucion.error}
          </p>
        ) : null}
      </div>
    </Dialogo>
  );
}

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-1.5">
      <dt className="text-muted-foreground">{termino}</dt>
      <dd className="font-medium text-foreground">{valor}</dd>
    </div>
  );
}

/* --------------------------- Piezas reutilizables ------------------------- */

/** Botón «Ejecutar con la IA» para una orden aprobada. */
export function BotonEjecutarOrden({
  ordenId,
  ejecucionId,
  className,
}: {
  ordenId: string;
  ejecucionId?: string | null;
  className?: string;
}) {
  const ejecutar = useEjecutar();
  const { data: ejecuciones = [] } = useEjecuciones();
  const ejecucion = ejecucionId ? ejecuciones.find((e) => e.id === ejecucionId) : undefined;

  if (ejecucion) {
    return (
      <Link
        to="/ejecucion"
        search={{ ejecucion: ejecucion.id }}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${tonoEstadoEjecucion(
          ejecucion.estado,
        )} ${className ?? ""}`}
      >
        <Zap className="size-3.5" /> {ETIQUETA_ESTADO_EJECUCION[ejecucion.estado]}
      </Link>
    );
  }

  return (
    <Boton
      type="button"
      variante="suave"
      onClick={() => ejecutar.mutate({ ordenId })}
      disabled={ejecutar.isPending}
      className={`px-2.5 py-1 text-xs ${className ?? ""}`}
    >
      {ejecutar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />} Ejecutar con la
      IA
    </Boton>
  );
}
