import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import * as React from "react";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type {
  AmbitoInfra,
  InfraConfigRow,
  InfraDependenciaRow,
  InfraIncidenciaRow,
  InfraServicioRow,
  InfraSincronizacionRow,
  ProyectoRow,
  Semaforo,
  TipoServicioInfra,
} from "@/lib/nex/db-types";
import { desde, formatoFecha, formatoFechaHora } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  ETIQUETA_AMBITO,
  ETIQUETA_INFRA,
  ETIQUETA_TIPO_SERVICIO,
  EXPLICACION_TIPO_SERVICIO,
  FONDO_INFRA,
  TONO_INFRA,
  diasHasta,
  duracionDesde,
  ordenarServicios,
  peorSemaforo,
  useActualizarIncidenciaInfra,
  useAdoptarVersionRepo,
  useBorrarServicioInfra,
  useComprobarInfra,
  useDescubrirInfra,
  useEstadoInfra,
  useGuardarConfigInfra,
  useGuardarServicioInfra,
  useHistoricoInfra,
  useIdeasInfra,
  useImpactoInfra,
  useRealtimeInfra,
  useSincronizarInfra,
  type DatosServicioInfra,
} from "@/lib/nex/queries/infraestructura";

const DESCRIPCION =
  "Vigila cada diez minutos todo lo que necesitan tus proyectos para funcionar y avisa indicando a qué proyectos afecta.";

type Pestana = "mapa" | "servicios" | "incidencias" | "sincronizacion" | "ideas" | "config";

type BusquedaInfra = { pestana?: Pestana };

const PESTANAS: { valor: Pestana; texto: string }[] = [
  { valor: "mapa", texto: "Mapa" },
  { valor: "servicios", texto: "Servicios" },
  { valor: "incidencias", texto: "Incidencias" },
  { valor: "sincronizacion", texto: "Sincronización" },
  { valor: "ideas", texto: "Ideas" },
  { valor: "config", texto: "Configuración" },
];

export const Route = createFileRoute("/infraestructura")({
  validateSearch: (busqueda: Record<string, unknown>): BusquedaInfra => {
    const p = busqueda["pestana"];
    return typeof p === "string" && PESTANAS.some((x) => x.valor === p) ? { pestana: p as Pestana } : {};
  },
  head: () => ({
    meta: [
      { title: "Infraestructura · NexDeveloper" },
      { name: "description", content: DESCRIPCION },
      { property: "og:title", content: "Infraestructura · NexDeveloper" },
      { property: "og:description", content: DESCRIPCION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaInfraestructura,
});

const TIPOS = Object.keys(ETIQUETA_TIPO_SERVICIO) as TipoServicioInfra[];

function PantallaInfraestructura() {
  const { pestana = "mapa" } = Route.useSearch();
  useRealtimeInfra(true);

  const estado = useEstadoInfra(true);
  const { data: proyectos = [] } = useProyectos();
  const [nuevoServicio, setNuevoServicio] = React.useState<Partial<DatosServicioInfra> | null>(null);

  const datos = estado.data;
  const servicios = datos?.servicios ?? [];
  const incidencias = datos?.incidencias ?? [];
  const sincronizacion = datos?.sincronizacion ?? [];
  const dependencias = datos?.dependencias ?? [];

  return (
    <>
      <Encabezado titulo="Infraestructura" descripcion={DESCRIPCION} />

      <Cabecera
        cargando={estado.isPending}
        servicios={servicios}
        incidencias={incidencias}
        global={datos?.global ?? "gris"}
        resumen={datos?.resumen ?? null}
        onAnadir={() => setNuevoServicio({})}
      />

      <BandaCaidas incidencias={incidencias} />

      <nav className="mt-5 flex flex-wrap gap-1.5">
        {PESTANAS.map((p) => (
          <Link
            key={p.valor}
            to="/infraestructura"
            search={{ pestana: p.valor }}
            replace
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              pestana === p.valor
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-surface text-muted-foreground hover:border-primary/40"
            }`}
          >
            {p.texto}
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        {estado.isPending ? (
          <p className="panel p-6 text-sm text-muted-foreground">Cargando el estado de la infraestructura…</p>
        ) : estado.isError ? (
          <p className="panel p-6 text-sm text-destructive">{(estado.error as Error).message}</p>
        ) : pestana === "mapa" ? (
          <Mapa
            servicios={servicios}
            dependencias={dependencias}
            proyectos={proyectos}
            sincronizacion={sincronizacion}
          />
        ) : pestana === "servicios" ? (
          <Servicios servicios={servicios} proyectos={proyectos} dependencias={dependencias} />
        ) : pestana === "incidencias" ? (
          <Incidencias incidencias={incidencias} servicios={servicios} />
        ) : pestana === "sincronizacion" ? (
          <Sincronizacion filas={sincronizacion} proyectos={proyectos} />
        ) : pestana === "ideas" ? (
          <Ideas onAnadir={(datos) => setNuevoServicio(datos)} />
        ) : (
          <Configuracion config={datos?.config ?? null} secretos={datos?.secretos ?? null} />
        )}
      </div>

      {nuevoServicio ? (
        <PanelServicio
          inicial={nuevoServicio}
          proyectos={proyectos}
          dependencias={[]}
          onCerrar={() => setNuevoServicio(null)}
        />
      ) : null}
    </>
  );
}

/* -------------------------------- Cabecera -------------------------------- */

function Cabecera({
  cargando,
  servicios,
  incidencias,
  global: semaforoGlobal,
  resumen,
  onAnadir,
}: {
  cargando: boolean;
  servicios: InfraServicioRow[];
  incidencias: InfraIncidenciaRow[];
  global: Semaforo;
  resumen: { verdes: number; ambar: number; rojos: number; grises: number; incidencias_abiertas: number } | null;
  onAnadir: () => void;
}) {
  const comprobar = useComprobarInfra();
  const descubrir = useDescubrirInfra();

  const rojos = resumen?.rojos ?? servicios.filter((s) => s.estado === "rojo").length;
  const ambar = resumen?.ambar ?? servicios.filter((s) => s.estado === "ambar").length;
  const verdes = resumen?.verdes ?? servicios.filter((s) => s.estado === "verde").length;
  const grises = resumen?.grises ?? servicios.filter((s) => s.estado === "gris").length;
  const abiertas = resumen?.incidencias_abiertas ?? incidencias.filter((i) => i.estado === "abierta").length;
  const ultima = servicios
    .map((s) => s.comprobado_el)
    .filter(Boolean)
    .sort()
    .at(-1);

  const texto =
    rojos > 0
      ? `${rojos} servicio${rojos === 1 ? "" : "s"} caído${rojos === 1 ? "" : "s"}`
      : ambar > 0
        ? `${ambar} servicio${ambar === 1 ? "" : "s"} con avisos`
        : "Todo funciona";

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`size-5 rounded-full ${FONDO_INFRA[semaforoGlobal]}`} aria-hidden />
          <div>
            <h2 className="font-display text-lg font-semibold">{cargando ? "Comprobando…" : texto}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {servicios.length} servicios vigilados · última comprobación {ultima ? desde(ultima) : "sin datos"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton onClick={() => comprobar.mutate(undefined)} disabled={comprobar.isPending}>
            {comprobar.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{" "}
            Comprobar ahora
          </Boton>
          <Boton variante="suave" onClick={() => descubrir.mutate()} disabled={descubrir.isPending}>
            {descubrir.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}{" "}
            Descubrir servicios
          </Boton>
          <Boton variante="suave" onClick={onAnadir}>
            <Plus className="size-4" /> Añadir servicio
          </Boton>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Contador titulo="Funcionan" valor={verdes} semaforo="verde" />
        <Contador titulo="Con avisos" valor={ambar} semaforo="ambar" />
        <Contador titulo="Caídos" valor={rojos} semaforo="rojo" />
        <Contador titulo="Sin comprobar" valor={grises} semaforo="gris" />
        <Contador titulo="Incidencias abiertas" valor={abiertas} semaforo={abiertas > 0 ? "rojo" : "verde"} />
      </div>
    </section>
  );
}

function Contador({ titulo, valor, semaforo }: { titulo: string; valor: number; semaforo: Semaforo }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className={`size-2.5 rounded-full ${FONDO_INFRA[semaforo]}`} aria-hidden />
        <p className="text-xs text-muted-foreground">{titulo}</p>
      </div>
      <p className="mt-1 font-display text-2xl font-semibold">{valor}</p>
    </div>
  );
}

function BandaCaidas({ incidencias }: { incidencias: InfraIncidenciaRow[] }) {
  const abiertas = incidencias.filter((i) => i.estado === "abierta");
  if (abiertas.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      {abiertas.map((i) => (
        <div
          key={i.id}
          className="flex flex-wrap items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">{i.titulo}</p>
            <p className="mt-0.5 text-xs">
              {i.afecta_todo
                ? "Afecta a todos los proyectos."
                : `Afecta a: ${
                    (i.proyectos_afectados ?? [])
                      .map((p) => `${p.nombre}${(p.modulos ?? []).length ? ` (${(p.modulos ?? []).join(", ")})` : ""}`)
                      .join(" · ") || "sin proyectos asociados"
                  }`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- Mapa ---------------------------------- */

function Mapa({
  servicios,
  dependencias,
  proyectos,
  sincronizacion,
}: {
  servicios: InfraServicioRow[];
  dependencias: InfraDependenciaRow[];
  proyectos: ProyectoRow[];
  sincronizacion: InfraSincronizacionRow[];
}) {
  const [elegido, setElegido] = React.useState<string | null>(null);
  const globales = servicios.filter((s) => s.ambito === "global");
  const porId = new Map(servicios.map((s) => [s.id, s]));
  const sincroPorProyecto = new Map(sincronizacion.map((s) => [s.proyecto_id, s]));

  const dependenciasDe = (proyectoId: string) =>
    dependencias
      .filter((d) => d.proyecto_id === proyectoId)
      .map((d) => ({ dependencia: d, servicio: porId.get(d.servicio_id) }))
      .filter((x): x is { dependencia: InfraDependenciaRow; servicio: InfraServicioRow } => Boolean(x.servicio));

  const proyecto = proyectos.find((p) => p.id === elegido) ?? null;

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h2 className="font-display text-sm font-semibold">Servicios comunes a todos los proyectos</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {globales.map((s) => (
            <span
              key={s.id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${TONO_INFRA[s.estado]}`}
              title={s.ultimo_error ?? s.ultimo_detalle ?? ETIQUETA_INFRA[s.estado]}
            >
              <span className={`size-2 rounded-full ${FONDO_INFRA[s.estado]}`} aria-hidden />
              {s.nombre}
            </span>
          ))}
          {globales.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay servicios comunes. Pulsa «Descubrir servicios».
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Proyectos</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {proyectos.map((p) => {
              const deps = dependenciasDe(p.id);
              const infra = p.semaforo_infra ?? peorSemaforo(deps.map((d) => d.servicio.estado));
              const sincro = sincroPorProyecto.get(p.id)?.semaforo ?? p.semaforo_sincronizacion ?? "gris";
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setElegido(p.id)}
                  className={`rounded-lg border p-3 text-left transition ${
                    elegido === p.id ? "border-primary/40 bg-primary/10" : "border-border bg-surface hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: p.color ?? "hsl(var(--primary))" }}
                      aria-hidden
                    />
                    <span className="truncate text-sm font-medium">{p.nombre}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className={`size-2 rounded-full ${FONDO_INFRA[infra]}`} aria-hidden /> servicios
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className={`size-2 rounded-full ${FONDO_INFRA[sincro]}`} aria-hidden /> sincronización
                    </span>
                    <span>{deps.length} servicios</span>
                  </div>
                </button>
              );
            })}
            {proyectos.length === 0 ? <p className="text-sm text-muted-foreground">Sin proyectos.</p> : null}
          </div>
        </div>

        <aside className="panel p-5">
          <h2 className="font-display text-sm font-semibold">
            {proyecto ? `De qué depende ${proyecto.nombre}` : "Elige un proyecto"}
          </h2>
          {!proyecto ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Pulsa un proyecto para ver los servicios de los que depende y qué parte deja de funcionar si uno cae.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {dependenciasDe(proyecto.id).map(({ dependencia, servicio }) => (
                <li key={dependencia.id} className="rounded-lg border border-border bg-surface p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                      <span className={`size-2 rounded-full ${FONDO_INFRA[servicio.estado]}`} aria-hidden />
                      {servicio.nombre}
                    </span>
                    {dependencia.critica ? <span className="text-destructive">imprescindible</span> : null}
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {(dependencia.modulos ?? []).length > 0
                      ? (dependencia.modulos ?? []).join(", ")
                      : "Sin partes indicadas"}
                  </p>
                </li>
              ))}
              {dependenciasDe(proyecto.id).length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  Este proyecto no tiene servicios propios asociados; solo depende de los comunes.
                </li>
              ) : null}
            </ul>
          )}
        </aside>
      </section>
    </div>
  );
}

/* -------------------------------- Servicios ------------------------------- */

function Servicios({
  servicios,
  proyectos,
  dependencias,
}: {
  servicios: InfraServicioRow[];
  proyectos: ProyectoRow[];
  dependencias: InfraDependenciaRow[];
}) {
  const [tipo, setTipo] = React.useState<TipoServicioInfra | "todos">("todos");
  const [estado, setEstado] = React.useState<Semaforo | "todos">("todos");
  const [ambito, setAmbito] = React.useState<AmbitoInfra | "todos">("todos");
  const [proveedor, setProveedor] = React.useState("todos");
  const [texto, setTexto] = React.useState("");
  const [editar, setEditar] = React.useState<InfraServicioRow | null>(null);
  const [impacto, setImpacto] = React.useState<InfraServicioRow | null>(null);

  const proveedores = Array.from(new Set(servicios.map((s) => s.proveedor).filter(Boolean))) as string[];

  const visibles = ordenarServicios(
    servicios.filter(
      (s) =>
        (tipo === "todos" || s.tipo === tipo) &&
        (estado === "todos" || s.estado === estado) &&
        (ambito === "todos" || s.ambito === ambito) &&
        (proveedor === "todos" || s.proveedor === proveedor) &&
        (texto.trim() === "" ||
          `${s.nombre} ${s.url ?? ""} ${s.referencia ?? ""}`.toLowerCase().includes(texto.trim().toLowerCase())),
    ),
  );

  const costeTotal = servicios.reduce((s, x) => s + Number(x.coste_mensual ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-end gap-3 p-4">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Search className="size-3.5" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre o dirección"
            className="w-56 rounded-md border border-input bg-surface px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <Filtro
          etiqueta="Tipo"
          valor={tipo}
          onChange={(v) => setTipo(v as TipoServicioInfra | "todos")}
          opciones={[{ valor: "todos", texto: "Todos" }, ...TIPOS.map((t) => ({ valor: t, texto: ETIQUETA_TIPO_SERVICIO[t] }))]}
        />
        <Filtro
          etiqueta="Estado"
          valor={estado}
          onChange={(v) => setEstado(v as Semaforo | "todos")}
          opciones={[
            { valor: "todos", texto: "Todos" },
            { valor: "rojo", texto: "Caídos" },
            { valor: "ambar", texto: "Con avisos" },
            { valor: "verde", texto: "Funcionan" },
            { valor: "gris", texto: "Sin comprobar" },
          ]}
        />
        <Filtro
          etiqueta="Ámbito"
          valor={ambito}
          onChange={(v) => setAmbito(v as AmbitoInfra | "todos")}
          opciones={[
            { valor: "todos", texto: "Todos" },
            { valor: "global", texto: "Comunes" },
            { valor: "proyecto", texto: "De proyecto" },
          ]}
        />
        <Filtro
          etiqueta="Proveedor"
          valor={proveedor}
          onChange={setProveedor}
          opciones={[{ valor: "todos", texto: "Todos" }, ...proveedores.map((p) => ({ valor: p, texto: p }))]}
        />
      </div>

      <div className="panel divide-y divide-border">
        {visibles.map((s) => (
          <FilaServicio
            key={s.id}
            servicio={s}
            onEditar={() => setEditar(s)}
            onImpacto={() => setImpacto(s)}
          />
        ))}
        {visibles.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Ningún servicio cumple estos filtros.</p>
        ) : null}
        <div className="flex items-center justify-between p-4 text-xs text-muted-foreground">
          <span>{visibles.length} servicios mostrados</span>
          <span>
            Coste mensual total de la infraestructura:{" "}
            <strong className="text-foreground">{costeTotal.toFixed(2)} €</strong>
          </span>
        </div>
      </div>

      {editar ? (
        <PanelServicio
          inicial={editar}
          proyectos={proyectos}
          dependencias={dependencias.filter((d) => d.servicio_id === editar.id)}
          onCerrar={() => setEditar(null)}
        />
      ) : null}
      {impacto ? <DialogoImpacto servicio={impacto} onCerrar={() => setImpacto(null)} /> : null}
    </div>
  );
}

function Filtro({
  etiqueta,
  valor,
  onChange,
  opciones,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  opciones: { valor: string; texto: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {etiqueta}
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm text-foreground"
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilaServicio({
  servicio,
  onEditar,
  onImpacto,
}: {
  servicio: InfraServicioRow;
  onEditar: () => void;
  onImpacto: () => void;
}) {
  const comprobar = useComprobarInfra();
  const guardar = useGuardarServicioInfra();
  const borrar = useBorrarServicioInfra();
  const [confirmar, setConfirmar] = React.useState(false);
  const dias = diasHasta(servicio.renovacion_el);

  return (
    <div className="flex flex-wrap items-start gap-3 p-4">
      <span className={`mt-1 size-2.5 shrink-0 rounded-full ${FONDO_INFRA[servicio.estado]}`} aria-hidden />
      <div className="min-w-56 flex-1">
        <p className="text-sm font-medium text-foreground">
          {servicio.nombre}
          {servicio.critico ? <span className="ml-2 text-[11px] text-destructive">imprescindible</span> : null}
          {!servicio.activo ? <span className="ml-2 text-[11px] text-muted-foreground">desactivado</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {ETIQUETA_TIPO_SERVICIO[servicio.tipo]}
          {servicio.proveedor ? ` · ${servicio.proveedor}` : ""} ·{" "}
          <span className="break-all">{servicio.url ?? servicio.referencia ?? "sin dirección"}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {servicio.ultimo_error ? (
            <span className="text-destructive">{servicio.ultimo_error}</span>
          ) : (
            servicio.ultimo_detalle ?? "Sin detalle"
          )}
          {servicio.ultimo_ms !== null ? ` · ${servicio.ultimo_ms} ms` : ""} ·{" "}
          {servicio.comprobado_el ? `comprobado ${desde(servicio.comprobado_el)}` : "sin comprobar"}
        </p>
        <MiniHistorico servicioId={servicio.id} />
      </div>
      <div className="w-32 text-right text-xs text-muted-foreground">
        {servicio.coste_mensual ? <p>{Number(servicio.coste_mensual).toFixed(2)} €/mes</p> : null}
        {servicio.renovacion_el ? (
          <p className={dias !== null && dias < 30 ? "text-destructive" : ""}>
            renueva {formatoFecha(servicio.renovacion_el)}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Boton variante="suave" className="px-2 py-1 text-xs" onClick={() => comprobar.mutate(servicio.id)}>
          Comprobar
        </Boton>
        <Boton variante="suave" className="px-2 py-1 text-xs" onClick={onImpacto}>
          Ver impacto
        </Boton>
        <Boton variante="suave" className="px-2 py-1 text-xs" onClick={onEditar}>
          Editar
        </Boton>
        <Boton
          variante="suave"
          className="px-2 py-1 text-xs"
          onClick={() => guardar.mutate({ id: servicio.id, nombre: servicio.nombre, tipo: servicio.tipo, activo: !servicio.activo })}
        >
          {servicio.activo ? "Desactivar" : "Activar"}
        </Boton>
        <Boton variante="peligro" className="px-2 py-1 text-xs" onClick={() => setConfirmar(true)}>
          <Trash2 className="size-3.5" />
        </Boton>
      </div>

      <Dialogo
        abierto={confirmar}
        titulo="Borrar el servicio"
        descripcion={`Se dejará de vigilar «${servicio.nombre}» y se perderá su histórico.`}
        onCerrar={() => setConfirmar(false)}
        ancho="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={() => setConfirmar(false)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            disabled={borrar.isPending}
            onClick={() => {
              borrar.mutate(servicio.id);
              setConfirmar(false);
            }}
          >
            Borrar
          </Boton>
        </div>
      </Dialogo>
    </div>
  );
}

function MiniHistorico({ servicioId }: { servicioId: string }) {
  const { data } = useHistoricoInfra(servicioId, 48);
  const historico = (data?.historico ?? []).slice(0, 48).reverse();
  if (historico.length === 0) return null;
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex gap-0.5">
        {historico.map((h) => (
          <span
            key={h.id}
            className={`h-3 w-1 rounded-sm ${FONDO_INFRA[h.estado]}`}
            title={`${formatoFechaHora(h.comprobado_el)} · ${ETIQUETA_INFRA[h.estado]}`}
          />
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground">
        {data?.disponibilidad_pct !== null && data?.disponibilidad_pct !== undefined
          ? `${Math.round(data.disponibilidad_pct)}% disponible`
          : ""}
        {data?.ms_medio ? ` · ${Math.round(data.ms_medio)} ms de media` : ""}
      </span>
    </div>
  );
}

function DialogoImpacto({ servicio, onCerrar }: { servicio: InfraServicioRow; onCerrar: () => void }) {
  const { data, isPending } = useImpactoInfra(servicio.id);
  return (
    <Dialogo
      abierto
      titulo={`Si cae ${servicio.nombre}…`}
      descripcion="Estos son los proyectos y las partes que dejan de funcionar."
      onCerrar={onCerrar}
    >
      {isPending ? (
        <p className="text-sm text-muted-foreground">Calculando…</p>
      ) : data?.afecta_todo ? (
        <p className="text-sm text-destructive">Afecta a todos los proyectos.</p>
      ) : (data?.proyectos ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Ningún proyecto depende de este servicio.</p>
      ) : (
        <ul className="space-y-2">
          {(data?.proyectos ?? []).map((p) => (
            <li key={p.proyecto_id} className="rounded-lg border border-border bg-surface p-3 text-sm">
              <p className="font-medium text-foreground">
                {p.nombre}
                {p.critica ? <span className="ml-2 text-xs text-destructive">imprescindible</span> : null}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {(p.modulos ?? []).length > 0 ? (p.modulos ?? []).join(", ") : "Sin partes indicadas"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Dialogo>
  );
}

/* ---------------------------- Panel de servicio ---------------------------- */

function PanelServicio({
  inicial,
  proyectos,
  dependencias,
  onCerrar,
}: {
  inicial: Partial<InfraServicioRow> & Partial<DatosServicioInfra>;
  proyectos: ProyectoRow[];
  dependencias: InfraDependenciaRow[];
  onCerrar: () => void;
}) {
  const guardar = useGuardarServicioInfra();
  const [nombre, setNombre] = React.useState(inicial.nombre ?? "");
  const [tipo, setTipo] = React.useState<TipoServicioInfra>((inicial.tipo as TipoServicioInfra) ?? "http");
  const [proveedor, setProveedor] = React.useState(inicial.proveedor ?? "");
  const [url, setUrl] = React.useState(inicial.url ?? "");
  const [referencia, setReferencia] = React.useState(inicial.referencia ?? "");
  const [ambito, setAmbito] = React.useState<AmbitoInfra>((inicial.ambito as AmbitoInfra) ?? "proyecto");
  const [critico, setCritico] = React.useState(inicial.critico ?? true);
  const [activo, setActivo] = React.useState(inicial.activo ?? true);
  const [coste, setCoste] = React.useState(String(inicial.coste_mensual ?? ""));
  const [renovacion, setRenovacion] = React.useState((inicial.renovacion_el ?? "").slice(0, 10));
  const [notas, setNotas] = React.useState(inicial.notas ?? "");

  const metodoInicial = (inicial as InfraServicioRow).metodo ?? null;
  const [esperado, setEsperado] = React.useState(String(metodoInicial?.esperado ?? ""));
  const [textoEsperado, setTextoEsperado] = React.useState(metodoInicial?.texto ?? "");
  const [metodoHttp, setMetodoHttp] = React.useState(metodoInicial?.metodo_http ?? "GET");
  const [tipoDns, setTipoDns] = React.useState(metodoInicial?.tipo_dns ?? "A");
  const [puerto, setPuerto] = React.useState(String(metodoInicial?.puerto ?? ""));
  const [bucket, setBucket] = React.useState(metodoInicial?.bucket ?? "");

  const [deps, setDeps] = React.useState<{ proyecto_id: string; modulos: string; critica: boolean }[]>(
    dependencias.map((d) => ({
      proyecto_id: d.proyecto_id,
      modulos: (d.modulos ?? []).join(", "),
      critica: d.critica,
    })),
  );

  const enviar = () => {
    guardar.mutate(
      {
        ...(inicial.id ? { id: inicial.id } : {}),
        nombre: nombre.trim(),
        tipo,
        proveedor: proveedor.trim() || null,
        url: url.trim() || null,
        referencia: referencia.trim() || null,
        metodo: {
          ...(esperado ? { esperado: Number(esperado) } : {}),
          ...(textoEsperado ? { texto: textoEsperado } : {}),
          ...(tipo === "http" ? { metodo_http: metodoHttp } : {}),
          ...(tipo === "dns" ? { tipo_dns: tipoDns } : {}),
          ...(puerto ? { puerto: Number(puerto) } : {}),
          ...(bucket ? { bucket } : {}),
        },
        ambito,
        critico,
        activo,
        coste_mensual: coste ? Number(coste) : null,
        renovacion_el: renovacion || null,
        notas: notas.trim() || null,
        dependencias: deps
          .filter((d) => d.proyecto_id)
          .map((d) => ({
            proyecto_id: d.proyecto_id,
            modulos: d.modulos
              .split(",")
              .map((m) => m.trim())
              .filter(Boolean),
            critica: d.critica,
          })),
      },
      { onSuccess: onCerrar },
    );
  };

  return (
    <Dialogo
      abierto
      titulo={inicial.id ? "Editar el servicio" : "Añadir un servicio"}
      descripcion="Indica cómo se comprueba y qué proyectos dependen de él."
      onCerrar={onCerrar}
      ancho="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Tipo" pista={EXPLICACION_TIPO_SERVICIO[tipo]}>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoServicioInfra)} className={claseCampo}>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO_SERVICIO[t]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Proveedor" pista="Quién presta el servicio (opcional).">
            <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Dirección" pista="La página, la API o el dominio que se comprueba.">
            <input value={url} onChange={(e) => setUrl(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Referencia" pista="Identificador interno: referencia del proyecto, repositorio, cubo…">
            <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Ámbito" pista={ETIQUETA_AMBITO[ambito]}>
            <select value={ambito} onChange={(e) => setAmbito(e.target.value as AmbitoInfra)} className={claseCampo}>
              <option value="proyecto">Solo los proyectos que dependan de él</option>
              <option value="global">Común a todos los proyectos</option>
            </select>
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Código esperado" pista="Código de respuesta que se considera correcto (200 por defecto).">
            <input value={esperado} onChange={(e) => setEsperado(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Texto que debe aparecer" pista="Opcional: palabra que debe verse en la respuesta.">
            <input value={textoEsperado} onChange={(e) => setTextoEsperado(e.target.value)} className={claseCampo} />
          </Campo>
          {tipo === "http" ? (
            <Campo etiqueta="Forma de la llamada">
              <select value={metodoHttp} onChange={(e) => setMetodoHttp(e.target.value)} className={claseCampo}>
                <option value="GET">GET</option>
                <option value="HEAD">HEAD</option>
                <option value="POST">POST</option>
              </select>
            </Campo>
          ) : tipo === "dns" ? (
            <Campo etiqueta="Tipo de registro">
              <select value={tipoDns} onChange={(e) => setTipoDns(e.target.value)} className={claseCampo}>
                {["A", "AAAA", "CNAME", "MX", "TXT", "NS"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Campo>
          ) : tipo === "tcp" || tipo === "servidor" || tipo === "correo" ? (
            <Campo etiqueta="Puerto">
              <input value={puerto} onChange={(e) => setPuerto(e.target.value)} className={claseCampo} />
            </Campo>
          ) : tipo === "s3" ? (
            <Campo etiqueta="Cubo del almacén">
              <input value={bucket} onChange={(e) => setBucket(e.target.value)} className={claseCampo} />
            </Campo>
          ) : (
            <div />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Coste mensual (€)">
            <input value={coste} onChange={(e) => setCoste(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Renovación">
            <input
              type="date"
              value={renovacion}
              onChange={(e) => setRenovacion(e.target.value)}
              className={claseCampo}
            />
          </Campo>
          <div className="flex flex-col justify-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={critico} onChange={(e) => setCritico(e.target.checked)} /> Imprescindible
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Vigilar este
              servicio
            </label>
          </div>
        </div>

        <Campo etiqueta="Notas">
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={claseCampo} />
        </Campo>

        <section>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-semibold">Proyectos que dependen de él</h3>
            <Boton
              variante="suave"
              className="px-2 py-1 text-xs"
              onClick={() => setDeps((d) => [...d, { proyecto_id: proyectos[0]?.id ?? "", modulos: "", critica: true }])}
            >
              <Plus className="size-3.5" /> Añadir
            </Boton>
          </div>
          <ul className="mt-2 space-y-2">
            {deps.map((d, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-2">
                <select
                  value={d.proyecto_id}
                  onChange={(e) =>
                    setDeps((prev) => prev.map((x, j) => (j === i ? { ...x, proyecto_id: e.target.value } : x)))
                  }
                  className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
                >
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <input
                  value={d.modulos}
                  onChange={(e) => setDeps((prev) => prev.map((x, j) => (j === i ? { ...x, modulos: e.target.value } : x)))}
                  placeholder="Partes afectadas, separadas por comas"
                  className="min-w-48 flex-1 rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={d.critica}
                    onChange={(e) => setDeps((prev) => prev.map((x, j) => (j === i ? { ...x, critica: e.target.checked } : x)))}
                  />
                  imprescindible
                </label>
                <Boton
                  variante="peligro"
                  className="px-2 py-1 text-xs"
                  onClick={() => setDeps((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-3.5" />
                </Boton>
              </li>
            ))}
            {deps.length === 0 ? (
              <li className="text-xs text-muted-foreground">Sin proyectos asociados todavía.</li>
            ) : null}
          </ul>
        </section>

        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={enviar} disabled={!nombre.trim() || guardar.isPending}>
            {guardar.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Guardar y comprobar
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

/* ------------------------------- Incidencias ------------------------------- */

function Incidencias({
  incidencias,
  servicios,
}: {
  incidencias: InfraIncidenciaRow[];
  servicios: InfraServicioRow[];
}) {
  const actualizar = useActualizarIncidenciaInfra();
  const porId = new Map(servicios.map((s) => [s.id, s]));
  const abiertas = incidencias.filter((i) => i.estado === "abierta");
  const cerradas = incidencias.filter((i) => i.estado !== "abierta");

  const Tarjeta = ({ i }: { i: InfraIncidenciaRow }) => (
    <li
      className={`rounded-lg border p-4 ${
        i.estado === "abierta" ? "border-destructive/40 bg-destructive/5" : "border-border bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{i.titulo}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {porId.get(i.servicio_id)?.nombre ?? "Servicio desconocido"} · empezó {desde(i.abierta_el)} ·{" "}
            {i.estado === "abierta"
              ? `lleva ${duracionDesde(i.abierta_el)}`
              : `duró ${i.duracion_min ? `${i.duracion_min} min` : duracionDesde(i.abierta_el, i.resuelta_el)}`}
          </p>
        </div>
        {i.estado === "abierta" ? (
          <div className="flex gap-1.5">
            <Boton
              variante="suave"
              className="px-2 py-1 text-xs"
              onClick={() => actualizar.mutate({ id: i.id, estado: "resuelta" })}
            >
              Marcar resuelta
            </Boton>
            <Boton
              variante="suave"
              className="px-2 py-1 text-xs"
              onClick={() => actualizar.mutate({ id: i.id, estado: "ignorada" })}
            >
              Ignorar
            </Boton>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{i.estado === "resuelta" ? "Resuelta" : "Ignorada"}</span>
        )}
      </div>
      {i.detalle ? <p className="mt-2 text-xs text-muted-foreground">{i.detalle}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">
        {i.afecta_todo
          ? "Afecta a todos los proyectos."
          : (i.proyectos_afectados ?? []).length > 0
            ? (i.proyectos_afectados ?? [])
                .map((p) => `${p.nombre}${(p.modulos ?? []).length ? ` (${(p.modulos ?? []).join(", ")})` : ""}`)
                .join(" · ")
            : "Sin proyectos asociados."}
      </p>
      {i.tarea_id ? (
        <Link to="/cola" className="mt-2 inline-flex text-xs text-primary hover:underline">
          Ver la tarea creada
        </Link>
      ) : null}
    </li>
  );

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h2 className="font-display text-sm font-semibold">Incidencias abiertas</h2>
        <ul className="mt-3 space-y-2">
          {abiertas.map((i) => (
            <Tarjeta key={i.id} i={i} />
          ))}
          {abiertas.length === 0 ? (
            <li className="text-sm text-muted-foreground">Ahora mismo no hay ninguna incidencia abierta.</li>
          ) : null}
        </ul>
      </section>

      <section className="panel p-5">
        <h2 className="font-display text-sm font-semibold">Últimos 30 días</h2>
        <ul className="mt-3 space-y-2">
          {cerradas.map((i) => (
            <Tarjeta key={i.id} i={i} />
          ))}
          {cerradas.length === 0 ? (
            <li className="text-sm text-muted-foreground">Sin incidencias anteriores.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

/* ----------------------------- Sincronización ------------------------------ */

const EJEMPLO_MAC = `curl -X POST "https://<tu-proyecto>.supabase.co/functions/v1/infraestructura" \\
  -H "Authorization: Bearer <TU_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"accion":"reportar_mac","proyecto_id":"<ID DEL PROYECTO>","sha":"$(git rev-parse HEAD)","fecha":"'"$(date -u +%FT%TZ)"'"}'`;

function Sincronizacion({ filas, proyectos }: { filas: InfraSincronizacionRow[]; proyectos: ProyectoRow[] }) {
  const sincronizar = useSincronizarInfra();
  const adoptar = useAdoptarVersionRepo();
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const nombre = (id: string) => proyectos.find((p) => p.id === id)?.nombre ?? "Proyecto";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Boton onClick={() => sincronizar.mutate(undefined)} disabled={sincronizar.isPending}>
          {sincronizar.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{" "}
          Sincronizar ahora
        </Boton>
      </div>

      <div className="panel divide-y divide-border">
        {filas.map((f) => {
          const pendientes = (f.migraciones_pendientes ?? []).length;
          const sinRepo = (f.migraciones_sin_repo ?? []).length;
          const distintaVersion = Boolean(f.version_repo && f.version_app && f.version_repo !== f.version_app);
          return (
            <div key={f.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <span className={`mt-1 size-2.5 rounded-full ${FONDO_INFRA[f.semaforo]}`} aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-foreground">{nombre(f.proyecto_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      rama {f.github_rama ?? "sin datos"} ·{" "}
                      {f.github_sha ? `${f.github_sha.slice(0, 7)} · ${desde(f.github_fecha)}` : "sin commits"}
                      {f.github_autor ? ` · ${f.github_autor}` : ""} · {f.commits_7d ?? 0} commits en 7 días
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {distintaVersion ? (
                    <Boton
                      variante="suave"
                      className="px-2 py-1 text-xs"
                      onClick={() => adoptar.mutate(f.proyecto_id)}
                      disabled={adoptar.isPending}
                    >
                      Adoptar versión del repositorio ({f.version_repo})
                    </Boton>
                  ) : null}
                  <Boton
                    variante="suave"
                    className="px-2 py-1 text-xs"
                    onClick={() => sincronizar.mutate(f.proyecto_id)}
                  >
                    Sincronizar
                  </Boton>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
                <Dato titulo="Versión">
                  {f.version_repo ?? "—"} en el repositorio · {f.version_app ?? "—"} aquí
                </Dato>
                <Dato titulo="Migraciones">
                  <span className={pendientes > 0 ? "text-destructive" : ""}>
                    {f.migraciones_aplicadas ?? 0} aplicadas de {f.migraciones_repo ?? 0}
                  </span>
                  {sinRepo > 0 ? <span className="text-warning"> · {sinRepo} sin repositorio</span> : null}
                </Dato>
                <Dato titulo="Funciones">
                  <span className={(f.funciones_sin_desplegar ?? 0) > 0 ? "text-destructive" : ""}>
                    {f.funciones_desplegadas ?? 0} desplegadas de {f.funciones_repo ?? 0}
                  </span>
                  {(f.funciones_sin_repo ?? 0) > 0 ? (
                    <span className="text-warning"> · {f.funciones_sin_repo} sin repositorio</span>
                  ) : null}
                </Dato>
                <Dato titulo="Copia del Mac">
                  {f.mac_sha ? `${f.mac_sha.slice(0, 7)} · ${desde(f.mac_fecha)}` : "sin informe"}
                </Dato>
              </div>

              {pendientes > 0 ? (
                <p className="mt-2 text-xs text-destructive">
                  Migraciones pendientes: {(f.migraciones_pendientes ?? []).join(", ")}
                </p>
              ) : null}
              {f.error ? <p className="mt-2 text-xs text-destructive">{f.error}</p> : null}

              {(f.motivos ?? []).length > 0 ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setAbierto(abierto === f.id ? null : f.id)}
                    className="text-xs text-primary hover:underline"
                  >
                    {abierto === f.id ? "Ocultar los motivos" : `Ver los ${(f.motivos ?? []).length} motivos`}
                  </button>
                  {abierto === f.id ? (
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                      {(f.motivos ?? []).map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {filas.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Todavía no hay comprobaciones de sincronización. Pulsa «Sincronizar ahora».
          </p>
        ) : null}
      </div>

      <section className="panel p-5">
        <h2 className="font-display text-sm font-semibold">Cómo informa el Mac</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Para que aparezca la copia local, el Mac debe enviar su último commit. Añade este comando a un guion que se
          ejecute al terminar de trabajar, sustituyendo el marcador por tu token; aquí no se guarda ninguna clave.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface p-3 text-[11px] text-muted-foreground">
          {EJEMPLO_MAC}
        </pre>
      </section>
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-2.5">
      <p className="text-[11px] text-muted-foreground">{titulo}</p>
      <p className="mt-0.5 text-foreground">{children}</p>
    </div>
  );
}

/* ---------------------------------- Ideas ---------------------------------- */

function Ideas({ onAnadir }: { onAnadir: (datos: Partial<DatosServicioInfra>) => void }) {
  const { data, isPending } = useIdeasInfra(true);
  const ideas = data?.ideas ?? [];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {isPending ? <p className="panel p-6 text-sm text-muted-foreground">Buscando ideas…</p> : null}
      {ideas.map((idea, i) => (
        <div key={i} className="panel p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h3 className="font-display text-sm font-semibold">{idea.titulo}</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{idea.detalle}</p>
          <Boton variante="suave" className="mt-3 px-2 py-1 text-xs" onClick={() => onAnadir({ nombre: idea.titulo })}>
            <Plus className="size-3.5" /> Añadir servicio
          </Boton>
        </div>
      ))}
      {!isPending && ideas.length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">No hay sugerencias nuevas: está todo vigilado.</p>
      ) : null}
    </div>
  );
}

/* ------------------------------ Configuración ------------------------------ */

function Configuracion({
  config,
  secretos,
}: {
  config: InfraConfigRow | null;
  secretos: { supabase?: boolean; github?: boolean; sentry?: boolean } | null;
}) {
  const guardar = useGuardarConfigInfra();
  const [borrador, setBorrador] = React.useState<Partial<InfraConfigRow>>(config ?? {});
  React.useEffect(() => {
    if (config) setBorrador(config);
  }, [config]);

  const num = (clave: keyof InfraConfigRow, etiqueta: string, pista: string) => (
    <Campo etiqueta={etiqueta} pista={pista}>
      <input
        type="number"
        value={String(borrador[clave] ?? "")}
        onChange={(e) => setBorrador((b) => ({ ...b, [clave]: Number(e.target.value) }))}
        className={claseCampo}
      />
    </Campo>
  );

  const check = (clave: keyof InfraConfigRow, etiqueta: string, pista: string) => (
    <label className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={Boolean(borrador[clave])}
        onChange={(e) => setBorrador((b) => ({ ...b, [clave]: e.target.checked }))}
      />
      <span>
        {etiqueta}
        <span className="mt-0.5 block text-xs text-muted-foreground">{pista}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h2 className="font-display text-sm font-semibold">Cómo se vigila</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {num("intervalo_min", "Cada cuántos minutos se comprueba", "Diez minutos es lo habitual.")}
          {num("sincronizar_cada_h", "Cada cuántas horas se comprueba la sincronización", "Una hora por defecto.")}
          {num("umbral_lento_ms", "A partir de cuántos milisegundos se considera lento", "Se marca en ámbar.")}
          {num("fallos_para_rojo", "Fallos seguidos para dar por caído", "Evita avisos por un fallo puntual.")}
          {num("dias_sin_commit_ambar", "Días sin commits para avisar", "Un proyecto parado se marca en ámbar.")}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {check("activo", "Vigilancia activada", "Si lo apagas, no se comprueba nada automáticamente.")}
          {check("avisar_push", "Avisarme en el móvil", "Manda un aviso cuando algo se cae.")}
          {check("crear_tareas", "Crear una tarea al abrir una incidencia", "Para no perder de vista el arreglo.")}
          {check("resolver_dns", "Comprobar también el DNS de los dominios", "Resuelve los nombres de dominio.")}
        </div>
        <div className="mt-4 flex justify-end">
          <Boton onClick={() => guardar.mutate(borrador)} disabled={guardar.isPending}>
            {guardar.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Guardar
          </Boton>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="font-display text-sm font-semibold">Accesos disponibles</h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {[
            { texto: "Cuenta de bases de datos", ok: secretos?.supabase },
            { texto: "GitHub", ok: secretos?.github },
            { texto: "Sentry", ok: secretos?.sentry },
          ].map((s) => (
            <li key={s.texto} className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${s.ok ? "bg-success" : "bg-warning"}`} aria-hidden />
              {s.texto}: {s.ok ? "configurado" : "sin configurar"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------------------------- Piezas reutilizables ------------------------- */

/** Chip para la cabecera de la ficha de proyecto. */
export function ChipInfraestructura({ proyecto }: { proyecto: ProyectoRow }) {
  const infra = proyecto.semaforo_infra ?? "gris";
  return (
    <Link
      to="/infraestructura"
      search={{ pestana: "mapa" }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${TONO_INFRA[infra]}`}
      title="Estado de la infraestructura de este proyecto"
    >
      <Server className="size-3" /> {ETIQUETA_INFRA[infra]}
    </Link>
  );
}

/** Tarjeta de la ficha del proyecto con los dos semáforos y sus servicios. */
export function TarjetaInfraProyecto({ proyectoId }: { proyectoId: string }) {
  const { data } = useEstadoInfra(true);
  const servicios = data?.servicios ?? [];
  const dependencias = (data?.dependencias ?? []).filter((d) => d.proyecto_id === proyectoId);
  const porId = new Map(servicios.map((s) => [s.id, s]));
  const sincro = (data?.sincronizacion ?? []).find((s) => s.proyecto_id === proyectoId) ?? null;
  const propios = dependencias
    .map((d) => ({ d, s: porId.get(d.servicio_id) }))
    .filter((x): x is { d: InfraDependenciaRow; s: InfraServicioRow } => Boolean(x.s));
  const infra = peorSemaforo(propios.map((x) => x.s.estado));

  return (
    <section className="panel mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Infraestructura</h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${FONDO_INFRA[infra]}`} aria-hidden /> servicios
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${FONDO_INFRA[sincro?.semaforo ?? "gris"]}`} aria-hidden />{" "}
            sincronización
          </span>
        </div>
      </div>
      {propios.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Este proyecto solo depende de los servicios comunes a toda la cartera.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {propios.map(({ d, s }) => (
            <li
              key={d.id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${TONO_INFRA[s.estado]}`}
              title={(d.modulos ?? []).join(", ")}
            >
              <span className={`size-2 rounded-full ${FONDO_INFRA[s.estado]}`} aria-hidden />
              {s.nombre}
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/infraestructura"
        search={{ pestana: "mapa" }}
        className="mt-3 inline-flex text-xs text-primary hover:underline"
      >
        Ver toda la infraestructura
      </Link>
    </section>
  );
}

/** Banda del panel principal cuando hay algo caído. */
export function BandaInfraPanel() {
  const { data } = useEstadoInfra(true);
  const abiertas = (data?.incidencias ?? []).filter((i) => i.estado === "abierta");
  if (abiertas.length === 0) return null;
  return (
    <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertTriangle className="size-4" /> {abiertas.length} incidencia
        {abiertas.length === 1 ? "" : "s"} de infraestructura abierta{abiertas.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-2 space-y-1 text-xs text-destructive">
        {abiertas.slice(0, 4).map((i) => (
          <li key={i.id}>
            {i.titulo} ·{" "}
            {i.afecta_todo
              ? "afecta a todos los proyectos"
              : (i.proyectos_afectados ?? []).map((p) => p.nombre).join(", ") || "sin proyectos asociados"}
          </li>
        ))}
      </ul>
      <Link to="/infraestructura" search={{ pestana: "incidencias" }} className="mt-2 inline-flex text-xs underline">
        Ver las incidencias
      </Link>
    </div>
  );
}

/** Chip pequeño para la pantalla de Salud. */
export function ChipInfraGlobal() {
  const { data } = useEstadoInfra(true);
  const semaforo = (data?.global ?? "gris") as Semaforo;
  const rojos = data?.resumen?.rojos ?? 0;
  return (
    <Link
      to="/infraestructura"
      search={{ pestana: "mapa" }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${TONO_INFRA[semaforo]}`}
    >
      <Server className="size-3" /> Infraestructura{rojos > 0 ? `: ${rojos} caídos` : ""}
    </Link>
  );
}
