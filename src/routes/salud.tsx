import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  HeartPulse,
  Loader2,
  RefreshCw,
  Wrench,
  XCircle,
} from "lucide-react";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando } from "@/components/nex/badges";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import { BotonConvocarMesa } from "@/routes/mesa";
import { ChipUsuariosInactivos } from "@/routes/usuarios-clientes";
import type {
  AdvisorSalud,
  SaludConfigRow,
  SaludInformeRow,
  SaludProyectoRow,
  Semaforo,
} from "@/lib/nex/db-types";
import { desde, formatoFechaHora } from "@/lib/nex/labels";
import {
  ETIQUETA_SEMAFORO,
  FONDO_SEMAFORO,
  TONO_SEMAFORO,
  erroresTotales,
  etiquetaEstadoSupabase,
  ordenarPorSemaforo,
  semaforoEstadoSupabase,
  semaforoServicio,
  useAsignarSentry,
  useComprobarSalud,
  useCrearTareaSalud,
  useEstadoSalud,
  useFilasSalud,
  useGuardarConfigSalud,
  useInformesSalud,
  useProbarSalud,
  useRealtimeSalud,
  type PruebaSalud,
} from "@/lib/nex/queries/salud";

type BusquedaSalud = { informe?: string };

export const Route = createFileRoute("/salud")({
  validateSearch: (busqueda: Record<string, unknown>): BusquedaSalud =>
    typeof busqueda["informe"] === "string" ? { informe: busqueda["informe"] as string } : {},
  head: () => ({
    meta: [
      { title: "Salud de la cartera · NexDeveloper" },
      {
        name: "description",
        content: "Revisión diaria de todos tus proyectos: un semáforo por proyecto y aviso solo cuando algo va mal.",
      },
      { property: "og:title", content: "Salud de la cartera · NexDeveloper" },
      {
        property: "og:description",
        content: "Revisión diaria de todos tus proyectos: un semáforo por proyecto y aviso solo cuando algo va mal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaSalud,
});

const SEMAFOROS: Semaforo[] = ["rojo", "ambar", "verde", "gris"];

function PantallaSalud() {
  const { informe: informeElegido } = Route.useSearch();
  const navegar = useNavigate();
  useRealtimeSalud(true);

  const { data: informes = [], isPending: cargandoInformes } = useInformesSalud();
  const informe = informes.find((i) => i.id === informeElegido) ?? informes[0] ?? null;
  const { data: filas = [], isPending: cargandoFilas } = useFilasSalud(informe?.id ?? null);

  const [filtro, setFiltro] = React.useState<Semaforo | "todos">("todos");
  const [detalle, setDetalle] = React.useState<string | null>(null);

  const ordenadas = ordenarPorSemaforo(filas);
  const visibles = filtro === "todos" ? ordenadas : ordenadas.filter((f) => f.semaforo === filtro);
  const filaDetalle = filas.find((f) => f.id === detalle) ?? null;
  const comprobados = filas.filter((f) => !f.pendiente).length;

  return (
    <>
      <Encabezado
        titulo="Salud de la cartera"
        descripcion="Cada mañana se revisan todos los proyectos. Solo hace falta que mires lo que esté en rojo."
      />

      <CabeceraInforme informe={informe} comprobados={comprobados} total={filas.length} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PanelPruebas />
        <PanelConfiguracion />
      </div>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-sm font-semibold">Proyectos</h2>
          <div className="flex flex-wrap gap-1.5">
            <BotonFiltro activo={filtro === "todos"} onClick={() => setFiltro("todos")}>
              Todos ({filas.length})
            </BotonFiltro>
            {SEMAFOROS.map((s) => (
              <BotonFiltro key={s} activo={filtro === s} onClick={() => setFiltro(s)}>
                {ETIQUETA_SEMAFORO[s]} ({filas.filter((f) => f.semaforo === s).length})
              </BotonFiltro>
            ))}
          </div>
        </div>

        {cargandoInformes || cargandoFilas ? (
          <Cargando />
        ) : visibles.length === 0 ? (
          <p className="panel p-6 text-sm text-muted-foreground">
            Todavía no hay ninguna revisión. Pulsa «Comprobar todo ahora» para hacer la primera.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibles.map((f) => (
              <TarjetaProyecto key={f.id} fila={f} onDetalle={() => setDetalle(f.id)} />
            ))}
          </div>
        )}
      </section>

      <Historial informes={informes} activo={informe?.id ?? null} onAbrir={(id) => void navegar({ to: "/salud", search: { informe: id }, replace: true })} />

      <HojaDetalle fila={filaDetalle} onCerrar={() => setDetalle(null)} />
    </>
  );
}

function BotonFiltro({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs transition ${
        activo ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/* -------------------------------- Cabecera -------------------------------- */

function CabeceraInforme({
  informe,
  comprobados,
  total,
}: {
  informe: SaludInformeRow | null;
  comprobados: number;
  total: number;
}) {
  const comprobar = useComprobarSalud();
  const enCurso = informe?.estado === "en_curso";

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold">Última revisión</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {informe
              ? `${formatoFechaHora(informe.iniciado_el)} · ${informe.origen === "programado" ? "automática de las 07:00" : "hecha a mano"}`
              : "Todavía sin revisiones."}
          </p>
        </div>
        <Boton onClick={() => comprobar.mutate(undefined)} disabled={comprobar.isPending}>
          {comprobar.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{" "}
          Comprobar todo ahora
        </Boton>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Contador titulo="Correctos" valor={informe?.verdes ?? 0} semaforo="verde" />
        <Contador titulo="Para revisar" valor={informe?.ambar ?? 0} semaforo="ambar" />
        <Contador titulo="En rojo" valor={informe?.rojos ?? 0} semaforo="rojo" />
        <Contador titulo="Sin datos" valor={informe?.grises ?? 0} semaforo="gris" />
      </div>

      {enCurso ? (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            Comprobando… {comprobados} de {total || informe?.total || 0} comprobados.
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${total ? (comprobados / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      ) : null}

      {informe?.resumen ? <p className="mt-3 text-sm text-muted-foreground">{informe.resumen}</p> : null}
      {informe?.error ? <p className="mt-3 text-sm text-destructive">{informe.error}</p> : null}
    </section>
  );
}

function Contador({ titulo, valor, semaforo }: { titulo: string; valor: number; semaforo: Semaforo }) {
  return (
    <div className={`rounded-lg border p-3 ${TONO_SEMAFORO[semaforo]}`}>
      <p className="text-2xl font-semibold sm:text-3xl">{valor}</p>
      <p className="mt-0.5 text-xs">{titulo}</p>
    </div>
  );
}

/* --------------------------------- Pruebas -------------------------------- */

function PanelPruebas() {
  const probar = useProbarSalud();
  const { data: estado } = useEstadoSalud();
  const [prueba, setPrueba] = React.useState<PruebaSalud | null>(null);

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Conexiones</h2>
        <Boton
          variante="suave"
          className="px-3 py-1.5 text-xs"
          onClick={() => probar.mutateAsync().then(setPrueba).catch(() => setPrueba(null))}
          disabled={probar.isPending}
        >
          {probar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Probar
          conexiones
        </Boton>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Semaf
          nombre="Cuenta de Supabase"
          ok={prueba ? Boolean(prueba.supabase?.ok) : Boolean(estado?.token_cuenta)}
          detalle={
            prueba?.supabase?.ok
              ? `${prueba.supabase.proyectos ?? 0} proyectos${
                  prueba.supabase.pausados?.length ? ` · ${prueba.supabase.pausados.length} pausados` : ""
                }`
              : (prueba?.supabase?.error ?? (estado?.token_cuenta ? "Token configurado" : "Falta el token de cuenta"))
          }
        />
        <Semaf
          nombre="Sentry"
          ok={prueba ? Boolean(prueba.sentry?.ok) : Boolean(estado?.sentry)}
          detalle={
            prueba?.sentry?.ok
              ? `${prueba.sentry.org ?? ""} · ${prueba.sentry.proyectos?.length ?? 0} proyectos`
              : (prueba?.sentry?.error ?? (estado?.sentry ? "Conectado" : "Sin configurar"))
          }
        />
      </div>
    </section>
  );
}

function Semaf({ nombre, ok, detalle }: { nombre: string; ok: boolean; detalle: string | null }) {
  return (
    <div className={`rounded-lg border p-3 text-xs ${ok ? TONO_SEMAFORO.verde : TONO_SEMAFORO.rojo}`}>
      <p className="flex items-center gap-1.5 font-medium">
        {ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />} {nombre}
      </p>
      <p className="mt-0.5">{detalle ?? "Sin datos"}</p>
    </div>
  );
}

/* ------------------------------ Configuración ----------------------------- */

function PanelConfiguracion() {
  const { data: estado } = useEstadoSalud();
  const guardar = useGuardarConfigSalud();
  const [abierto, setAbierto] = React.useState(false);
  const [borrador, setBorrador] = React.useState<Partial<SaludConfigRow>>({});

  React.useEffect(() => {
    if (estado?.config) setBorrador(estado.config);
  }, [estado?.config]);

  const valor = <K extends keyof SaludConfigRow>(campo: K, porDefecto: SaludConfigRow[K]) =>
    (borrador[campo] ?? porDefecto) as SaludConfigRow[K];
  const cambiar = <K extends keyof SaludConfigRow>(campo: K, v: SaludConfigRow[K]) =>
    setBorrador((b) => ({ ...b, [campo]: v }));

  return (
    <section className="panel p-5">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h2 className="font-display text-sm font-semibold">Configuración de la revisión</h2>
        <span className="text-xs text-muted-foreground">{abierto ? "Ocultar" : "Mostrar"}</span>
      </button>

      {abierto ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2">
            <Interruptor
              etiqueta="Revisar todos los días a las 07:00"
              activo={valor("activo", true)}
              onChange={(v) => cambiar("activo", v)}
            />
            <Interruptor
              etiqueta="Avisarme solo cuando algo esté en rojo"
              activo={valor("avisar_solo_rojo", true)}
              onChange={(v) => cambiar("avisar_solo_rojo", v)}
            />
            <Interruptor
              etiqueta="Incluir también los avisos de rendimiento"
              activo={valor("incluir_rendimiento", false)}
              onChange={(v) => cambiar("incluir_rendimiento", v)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Aviso cuando la base de datos pase de (MB)">
              <input
                type="number"
                min={0}
                value={valor("umbral_bd_mb", 400)}
                onChange={(e) => cambiar("umbral_bd_mb", Number(e.target.value))}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Rojo cuando la base de datos pase de (MB)">
              <input
                type="number"
                min={0}
                value={valor("umbral_bd_rojo_mb", 480)}
                onChange={(e) => cambiar("umbral_bd_rojo_mb", Number(e.target.value))}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Aviso a partir de (errores en 24 h)">
              <input
                type="number"
                min={0}
                value={valor("umbral_errores_ambar", 10)}
                onChange={(e) => cambiar("umbral_errores_ambar", Number(e.target.value))}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Rojo a partir de (errores en 24 h)">
              <input
                type="number"
                min={0}
                value={valor("umbral_errores_rojo", 50)}
                onChange={(e) => cambiar("umbral_errores_rojo", Number(e.target.value))}
                className={claseCampo}
              />
            </Campo>
            <div className="sm:col-span-2">
              <Campo etiqueta="Organización de Sentry" pista="El nombre corto que aparece en la dirección de Sentry.">
                <input
                  value={valor("sentry_org", "") ?? ""}
                  onChange={(e) => cambiar("sentry_org", e.target.value)}
                  className={claseCampo}
                />
              </Campo>
            </div>
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

/* ------------------------------ Tarjeta proyecto --------------------------- */

function TarjetaProyecto({ fila, onDetalle }: { fila: SaludProyectoRow; onDetalle: () => void }) {
  const comprobar = useComprobarSalud();

  if (fila.pendiente) {
    return (
      <article className="panel p-4">
        <div className="flex items-center gap-2">
          <span className="size-3 animate-pulse rounded-full bg-muted-foreground/50" />
          <p className="font-medium">{fila.nombre}</p>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Comprobando…</p>
      </article>
    );
  }

  const semEstado = semaforoEstadoSupabase(fila.estado_supabase);

  return (
    <article className="panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`size-3.5 shrink-0 rounded-full ${FONDO_SEMAFORO[fila.semaforo]}`} aria-hidden />
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold">{fila.nombre}</h3>
            <p className="text-xs text-muted-foreground">{ETIQUETA_SEMAFORO[fila.semaforo]}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${TONO_SEMAFORO[semEstado]}`}>
          {etiquetaEstadoSupabase(fila.estado_supabase)}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-5 gap-1 text-center">
        <Cifra titulo="Segur." valor={fila.advisors_seguridad} alerta={fila.advisors_seguridad > 0} />
        <Cifra titulo="Sin RLS" valor={fila.tablas_sin_rls} alerta={fila.tablas_sin_rls > 0} />
        <Cifra titulo="Errores" valor={erroresTotales(fila)} alerta={erroresTotales(fila) > 0} />
        <Cifra titulo="MB" valor={fila.bd_mb === null ? "—" : Math.round(fila.bd_mb)} />
        <Cifra titulo="Usuarios" valor={fila.usuarios ?? "—"} />
      </dl>
      {fila.ultimo_acceso ? (
        <p className="mt-1 text-center text-[11px] text-muted-foreground">
          Último acceso {desde(fila.ultimo_acceso)}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        <ChipUsuariosInactivos proyectoId={fila.proyecto_id} />
      </div>

      {(fila.motivos ?? []).length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {(fila.motivos ?? []).slice(0, 4).map((m, i) => (
            <li key={i} className="flex gap-1.5">
              <span aria-hidden>·</span>
              <span>{m}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {fila.error ? <p className="mt-2 text-xs text-destructive">{fila.error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Boton variante="suave" className="px-2.5 py-1 text-xs" onClick={onDetalle}>
          Ver detalle
        </Boton>
        {fila.proyecto_id ? (
          <Boton
            variante="suave"
            className="px-2.5 py-1 text-xs"
            disabled={comprobar.isPending}
            onClick={() => comprobar.mutate({ proyectoId: fila.proyecto_id as string })}
          >
            <RefreshCw className="size-3.5" /> Comprobar solo este
          </Boton>
        ) : null}
      </div>
    </article>
  );
}

function Cifra({ titulo, valor, alerta }: { titulo: string; valor: number | string; alerta?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface px-1 py-1.5">
      <dd className={`text-sm font-semibold ${alerta ? "text-warning" : "text-foreground"}`}>{valor}</dd>
      <dt className="text-[10px] text-muted-foreground">{titulo}</dt>
    </div>
  );
}

/* --------------------------------- Detalle -------------------------------- */

function HojaDetalle({ fila, onCerrar }: { fila: SaludProyectoRow | null; onCerrar: () => void }) {
  const [tipoAdvisor, setTipoAdvisor] = React.useState<"todos" | "seguridad" | "rendimiento">("todos");
  const [slug, setSlug] = React.useState("");
  const asignar = useAsignarSentry();
  const crearTarea = useCrearTareaSalud();
  const { data: estado } = useEstadoSalud();
  const umbral = estado?.config?.umbral_bd_rojo_mb ?? 500;

  if (!fila) return null;

  const advisors = (fila.advisors ?? []).filter((a) => tipoAdvisor === "todos" || a.tipo === tipoAdvisor);
  const motivos = (fila.motivos ?? []).join("\n");

  return (
    <Dialogo abierto titulo={fila.nombre} descripcion={ETIQUETA_SEMAFORO[fila.semaforo]} onCerrar={onCerrar} ancho="max-w-3xl">
      <div className="space-y-5 text-sm">
        <Bloque titulo="Estado y servicios">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs ${TONO_SEMAFORO[semaforoEstadoSupabase(fila.estado_supabase)]}`}>
              {etiquetaEstadoSupabase(fila.estado_supabase)}
            </span>
            {fila.supabase_ref ? (
              <span className="text-xs text-muted-foreground">Referencia {fila.supabase_ref}</span>
            ) : null}
          </div>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {(fila.servicios ?? []).map((s) => (
              <li key={s.name} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs">
                <span className={`size-2 rounded-full ${FONDO_SEMAFORO[semaforoServicio(s.name, s.status)]}`} aria-hidden />
                <span className="font-medium">{s.name}</span>
                <span className="ml-auto text-muted-foreground">{s.status}</span>
              </li>
            ))}
            {(fila.servicios ?? []).length === 0 ? (
              <li className="text-xs text-muted-foreground">Sin información de servicios.</li>
            ) : null}
          </ul>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Si «realtime» aparece en gris es porque el proyecto no lo usa: es normal.
          </p>
        </Bloque>

        <Bloque titulo={`Avisos (${(fila.advisors ?? []).length})`}>
          <div className="mb-2 flex gap-1.5">
            {(["todos", "seguridad", "rendimiento"] as const).map((t) => (
              <BotonFiltro key={t} activo={tipoAdvisor === t} onClick={() => setTipoAdvisor(t)}>
                {t === "todos" ? "Todos" : t === "seguridad" ? "Seguridad" : "Rendimiento"}
              </BotonFiltro>
            ))}
          </div>
          {advisors.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin avisos.</p>
          ) : (
            <ul className="space-y-2">
              {advisors.map((a: AdvisorSalud, i) => (
                <li key={`${a.nombre}-${i}`} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
                        a.nivel === "ERROR" ? TONO_SEMAFORO.rojo : TONO_SEMAFORO.ambar
                      }`}
                    >
                      {a.nivel === "ERROR" ? "Grave" : "Aviso"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {a.tipo === "seguridad" ? "Seguridad" : "Rendimiento"}
                    </span>
                    <span className="font-medium">{a.titulo}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{a.detalle}</p>
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" /> Cómo arreglarlo
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Bloque>

        <Bloque titulo="Base de datos">
          <p className="text-xs text-muted-foreground">
            {fila.tablas_sin_rls} tablas sin protección de filas · {fila.funciones_sin_search_path} funciones sin
            «search_path».
          </p>
          {(fila.tablas_sin_rls_lista ?? []).length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(fila.tablas_sin_rls_lista ?? []).map((t) => (
                <span key={t} className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Tamaño</span>
              <span>
                {fila.bd_mb === null ? "sin datos" : `${Math.round(fila.bd_mb)} MB de ${umbral} MB`}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${(fila.bd_mb ?? 0) >= umbral ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${Math.min(100, ((fila.bd_mb ?? 0) / Math.max(1, umbral)) * 100)}%` }}
              />
            </div>
          </div>
        </Bloque>

        <Bloque titulo="Errores de las últimas 24 horas">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Cifra titulo="API" valor={fila.errores_api_24h} alerta={fila.errores_api_24h > 0} />
            <Cifra titulo="Base de datos" valor={fila.errores_bd_24h} alerta={fila.errores_bd_24h > 0} />
            <Cifra titulo="Funciones" valor={fila.errores_funciones_24h} alerta={fila.errores_funciones_24h > 0} />
          </div>
        </Bloque>

        <Bloque titulo={`Sentry (${fila.sentry_errores_24h} en 24 h)`}>
          {(fila.sentry_incidencias ?? []).length > 0 ? (
            <ul className="space-y-2">
              {(fila.sentry_incidencias ?? []).map((s, i) => (
                <li key={i} className="rounded-lg border border-border bg-surface p-3 text-xs">
                  <p className="font-medium text-foreground">{s.titulo}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {s.nivel ?? "sin nivel"} · {s.veces ?? 0} veces · {s.usuarios ?? 0} usuarios
                    {s.ultima ? ` · ${desde(s.ultima)}` : ""}
                  </p>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">
                      <ExternalLink className="size-3" /> Ver en Sentry
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Este proyecto no tiene ninguna incidencia asociada.</p>
              {fila.proyecto_id ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-48 flex-1">
                    <Campo etiqueta="Proyecto en Sentry" pista="El nombre corto del proyecto dentro de Sentry.">
                      <input value={slug} onChange={(e) => setSlug(e.target.value)} className={claseCampo} />
                    </Campo>
                  </div>
                  <Boton
                    variante="suave"
                    disabled={!slug.trim() || asignar.isPending}
                    onClick={() =>
                      asignar.mutate({ proyectoId: fila.proyecto_id as string, sentrySlug: slug.trim() })
                    }
                  >
                    Asignar
                  </Boton>
                </div>
              ) : null}
            </div>
          )}
        </Bloque>

        <div className="flex flex-wrap gap-2">
          {fila.proyecto_id ? (
            <>
              <Boton onClick={() => crearTarea.mutate(fila)} disabled={crearTarea.isPending}>
                <Wrench className="size-4" /> Crear tarea para arreglarlo
              </Boton>
              <BotonConvocarMesa
                proyectoId={fila.proyecto_id}
                pregunta="¿Cómo corregir estos avisos de salud?"
                {...(motivos ? { contextoInicial: `Avisos detectados en ${fila.nombre}:\n${motivos}` } : {})}
                etiqueta="Pedir a la mesa de expertos"
              />
              <Link
                to="/proyectos/$proyectoId"
                params={{ proyectoId: fila.proyecto_id }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                Ver el proyecto
              </Link>
            </>
          ) : null}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Comprobado {fila.comprobado_el ? desde(fila.comprobado_el) : "sin fecha"}.
        </p>
      </div>
    </Dialogo>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-display text-sm font-semibold">{titulo}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/* -------------------------------- Historial -------------------------------- */

function Historial({
  informes,
  activo,
  onAbrir,
}: {
  informes: SaludInformeRow[];
  activo: string | null;
  onAbrir: (id: string) => void;
}) {
  const datos = [...informes]
    .reverse()
    .map((i) => ({ dia: formatoFechaHora(i.iniciado_el).slice(0, 5), rojos: i.rojos, ambar: i.ambar }));

  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="panel p-5">
        <h2 className="font-display text-sm font-semibold">Cómo ha ido en las últimas revisiones</h2>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
              <Tooltip
                formatter={(v: number, n: string) => [v, n === "rojos" ? "En rojo" : "Para revisar"]}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend formatter={(n) => (n === "rojos" ? "En rojo" : "Para revisar")} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="rojos" fill="hsl(var(--destructive))" />
              <Bar dataKey="ambar" fill="hsl(var(--warning))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="font-display text-sm font-semibold">Revisiones anteriores</h2>
        <ul className="mt-3 space-y-1.5">
          {informes.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => onAbrir(i.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                  i.id === activo ? "border-primary/40 bg-primary/10" : "border-border bg-surface hover:border-primary/40"
                }`}
              >
                <span>
                  <span className="block text-foreground">{formatoFechaHora(i.iniciado_el)}</span>
                  <span className="text-muted-foreground">
                    {i.origen === "programado" ? "automática" : "a mano"}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-success">{i.verdes}</span>
                  <span className="text-warning">{i.ambar}</span>
                  <span className="text-destructive">{i.rojos}</span>
                </span>
              </button>
            </li>
          ))}
          {informes.length === 0 ? <li className="text-xs text-muted-foreground">Todavía no hay revisiones.</li> : null}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------- Piezas reutilizables ------------------------- */

/** Tarjeta de resumen para el panel principal. */
export function TarjetaSalud() {
  const { data: informes = [] } = useInformesSalud();
  const informe = informes[0] ?? null;

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Salud de la cartera</h2>
        <HeartPulse
          className={`size-4 ${
            (informe?.rojos ?? 0) > 0
              ? "text-destructive"
              : (informe?.ambar ?? 0) > 0
                ? "text-warning"
                : "text-success"
          }`}
        />
      </div>
      {informe ? (
        <>
          <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
            <Mini valor={informe.verdes} tono="text-success" pie="bien" />
            <Mini valor={informe.ambar} tono="text-warning" pie="revisar" />
            <Mini valor={informe.rojos} tono="text-destructive" pie="rojo" />
            <Mini valor={informe.grises} tono="text-muted-foreground" pie="sin datos" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Revisado {desde(informe.iniciado_el)}</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Todavía sin revisiones.</p>
      )}
      <Link to="/salud" className="mt-3 inline-flex text-xs text-primary hover:underline">
        Ver la salud de los proyectos
      </Link>
    </div>
  );
}

function Mini({ valor, tono, pie }: { valor: number; tono: string; pie: string }) {
  return (
    <div className="rounded-md border border-border bg-surface py-1.5">
      <p className={`text-base font-semibold ${tono}`}>{valor}</p>
      <p className="text-[10px] text-muted-foreground">{pie}</p>
    </div>
  );
}

/** Chip de salud para la ficha de un proyecto. */
export function ChipSalud({ semaforo, fecha }: { semaforo: Semaforo; fecha: string | null }) {
  return (
    <Link
      to="/salud"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition ${TONO_SEMAFORO[semaforo]}`}
      title={fecha ? `Revisado ${desde(fecha)}` : "Sin revisar"}
    >
      <Activity className="size-3.5" /> {ETIQUETA_SEMAFORO[semaforo]}
      {fecha ? ` · ${desde(fecha)}` : ""}
    </Link>
  );
}

/** Punto de color para las listas de proyectos. */
export function PuntoSalud({ semaforo }: { semaforo: Semaforo }) {
  return (
    <span
      className={`inline-block size-2.5 shrink-0 rounded-full ${FONDO_SEMAFORO[semaforo]}`}
      title={`Salud: ${ETIQUETA_SEMAFORO[semaforo]}`}
      aria-label={`Salud: ${ETIQUETA_SEMAFORO[semaforo]}`}
    />
  );
}
