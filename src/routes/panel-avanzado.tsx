import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CircleDot } from "lucide-react";
import * as React from "react";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando, EstadoProyectoBadge, PrioridadBadge, Progreso } from "@/components/nex/badges";
import { Selector } from "@/components/nex/campos";
import type { BandejaEntradaRow, DominioRow, EstadoProyecto, Prioridad } from "@/lib/nex/db-types";
import { ETIQUETA_ESTADO_PROYECTO, ETIQUETA_PRIORIDAD, desde, formatoDinero } from "@/lib/nex/labels";
import { useDominios } from "@/lib/nex/queries/dominios";
import { useEntradasBandeja } from "@/lib/nex/queries/bandeja";
import { useVigilanciaHallazgos } from "@/lib/nex/queries/vigilancia";
import { TarjetaResumenHoy } from "@/routes/resumenes";
import { TarjetaGastoIa } from "@/routes/gasto-ia";
import { TarjetaSalud } from "@/routes/salud";
import { BandaInfraPanel } from "@/routes/infraestructura";
import { TarjetaAuditoriaMes } from "@/routes/auditoria";
import { TarjetaCobrosPendientes } from "@/routes/facturacion";
import { ContadorPeticionesClientes } from "@/routes/modo-cliente";
import { TarjetaAvisos } from "@/components/nex/tarjeta-avisos";
import { CajaRapidaAsistente } from "@/routes/asistente";
import { BloquePideme } from "@/routes/pideme";
import {
  useAjustes,
  useAlertas,
  useCargaAgentes,
  useProyectos,
  useResumenProyectos,
} from "@/lib/nex/queries/datos";

export const Route = createFileRoute("/panel-avanzado")({
  head: () => ({
    meta: [
      { title: "Inicio · NexDeveloper" },
      {
        name: "description",
        content: "Resumen de todos tus proyectos de IA: estado, prioridad, alertas, coste y agentes.",
      },
      { property: "og:title", content: "Inicio · NexDeveloper" },
      {
        property: "og:description",
        content: "Resumen de todos tus proyectos de IA: estado, prioridad, alertas, coste y agentes.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { data: proyectos = [], isPending } = useProyectos();
  const { data: resumenes = [] } = useResumenProyectos();
  const { data: alertas = [] } = useAlertas();
  const { data: carga = [] } = useCargaAgentes();
  const { data: ajustes } = useAjustes();
  const { data: dominios = [] } = useDominios();
  const { data: entradasBandeja = [] } = useEntradasBandeja();
  const moneda = ajustes?.moneda ?? "EUR";

  const [estado, setEstado] = React.useState<EstadoProyecto | "todos">("todos");
  const [prioridad, setPrioridad] = React.useState<Prioridad | "todas">("todas");
  const [costeMin, setCosteMin] = React.useState(0);

  const porProyecto = new Map(resumenes.map((r) => [r.proyecto_id, r]));

  const filtrados = proyectos.filter((p) => {
    const r = porProyecto.get(p.id);
    return (
      (estado === "todos" || p.estado === estado) &&
      (prioridad === "todas" || p.prioridad === prioridad) &&
      (r?.coste_consumido ?? 0) >= costeMin
    );
  });

  const totalEstimado = resumenes.reduce((s, r) => s + Number(r.coste_estimado ?? 0), 0);
  const totalConsumido = resumenes.reduce((s, r) => s + Number(r.coste_consumido ?? 0), 0);
  const ejecutando = resumenes.reduce((s, r) => s + Number(r.ejecutando ?? 0), 0);
  const totalTareas = resumenes.reduce((s, r) => s + Number(r.total_tareas ?? 0), 0);

  return (
    <>
      <Encabezado
        titulo="Inicio"
        descripcion="Todo lo que está pasando en tus proyectos, en una sola pantalla."
        acciones={
          <Link
            to="/nueva-orden"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Nueva orden <ArrowRight className="size-4" />
          </Link>
        }
      />

      <BloquePideme />

      <BandaInfraPanel />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica titulo="Proyectos" valor={String(proyectos.length)} pie={`${filtrados.length} visibles`} />
        <Metrica titulo="Tareas en ejecución" valor={String(ejecutando)} pie={`${totalTareas} tareas en total`} />
        <Metrica titulo="Coste estimado" valor={formatoDinero(totalEstimado, moneda)} pie="Suma de los planes de trabajo" />
        <Metrica
          titulo="Consumido"
          valor={formatoDinero(totalConsumido, moneda)}
          pie={`${Math.round((totalConsumido / Math.max(1, totalEstimado)) * 100)}% de lo estimado`}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div>
          <div className="panel mb-4 grid grid-cols-1 items-center gap-3 p-4 sm:grid-cols-3">
            <Selector
              className="w-full min-w-0"
              etiqueta="Estado"
              valor={estado}
              onChange={(v) => setEstado(v as EstadoProyecto | "todos")}
              opciones={[
                { valor: "todos", texto: "Todos" },
                ...Object.entries(ETIQUETA_ESTADO_PROYECTO).map(([valor, texto]) => ({ valor, texto })),
              ]}
            />
            <Selector
              className="w-full min-w-0"
              etiqueta="Prioridad"
              valor={prioridad}
              onChange={(v) => setPrioridad(v as Prioridad | "todas")}
              opciones={[
                { valor: "todas", texto: "Todas" },
                ...Object.entries(ETIQUETA_PRIORIDAD).map(([valor, texto]) => ({ valor, texto })),
              ]}
            />
            <label className="flex w-full min-w-0 items-center gap-2 text-xs text-muted-foreground">
              Coste mínimo
              <input
                type="number"
                min={0}
                step={50}
                value={costeMin}
                onChange={(e) => setCosteMin(Number(e.target.value) || 0)}
                className="w-full min-w-0 flex-1 rounded-md border border-input bg-surface px-2 py-1.5 text-sm text-foreground"
              />
            </label>
          </div>

          {isPending ? (
            <Cargando />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtrados.map((p) => {
                const r = porProyecto.get(p.id);
                const completadas = Number(r?.completadas ?? 0);
                const total = Number(r?.total_tareas ?? 0);
                return (
                  <Link
                    key={p.id}
                    to="/proyectos/$proyectoId"
                    params={{ proyectoId: p.id }}
                    className="panel block p-4 transition hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-base font-semibold">{p.nombre}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.descripcion}</p>
                      </div>
                      <PrioridadBadge prioridad={p.prioridad} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <EstadoProyectoBadge estado={p.estado} />
                      <span className="text-xs text-muted-foreground">actualizado {desde(p.actualizado_el)}</span>
                    </div>
                    <div className="mt-4">
                      <Progreso valor={total ? (completadas / total) * 100 : 0} />
                      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                        <span>
                          {completadas}/{total} tareas
                        </span>
                        <span>
                          {formatoDinero(Number(r?.coste_consumido ?? 0), moneda)} /{" "}
                          {formatoDinero(Number(r?.coste_estimado ?? 0), moneda)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {filtrados.length === 0 && (
                <p className="panel p-6 text-sm text-muted-foreground">Ningún proyecto cumple estos filtros.</p>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <CajaRapidaAsistente />

          <div className="panel p-4">
            <h2 className="font-display text-sm font-semibold">Alertas y decisiones</h2>
            <ul className="mt-3 space-y-3">
              {alertas.map((a) => (
                <li key={a.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
                  <p className="flex items-start gap-2 text-foreground">
                    {a.nivel === "critico" ? (
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    ) : null}
                    {a.texto}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.requiere_decision ? "Requiere tu decisión" : "Informativo"}
                  </p>
                </li>
              ))}
              {alertas.length === 0 && <li className="text-sm text-muted-foreground">Sin alertas abiertas.</li>}
            </ul>
          </div>

          <TarjetaResumenHoy />

          <TarjetaBandeja entradas={entradasBandeja} />

          <TarjetaGastoIa />

          <TarjetaVigilancia />

          <TarjetaAvisos />

          <TarjetaSalud />

          <TarjetaAuditoriaMes />
          <TarjetaCobrosPendientes />

          <ContadorPeticionesClientes />

          <TarjetaDominios dominios={dominios} />

          <div className="panel p-4">
            <h2 className="font-display text-sm font-semibold">Capacidad de agentes</h2>
            <ul className="mt-3 space-y-3">
              {carga.map((a) => (
                <li key={a.agente_id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <CircleDot
                        className={
                          a.tareas_activas >= a.capacidad ? "size-3.5 text-destructive" : "size-3.5 text-success"
                        }
                      />
                      {a.nombre}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.tareas_activas}/{a.capacidad}
                    </span>
                  </div>
                  <Progreso className="mt-1.5" valor={(a.tareas_activas / Math.max(1, a.capacidad)) * 100} />
                </li>
              ))}
              {carga.length === 0 && <li className="text-sm text-muted-foreground">Sin agentes cargados.</li>}
            </ul>
          </div>
        </aside>
      </section>
    </>
  );
}

function TarjetaVigilancia() {
  const { data: hallazgos = [] } = useVigilanciaHallazgos();
  const nuevos = hallazgos.filter((h) => h.estado === "nuevo" && h.relevancia === "alta").slice(0, 5);
  return (
    <div className="panel p-4">
      <h2 className="font-display text-sm font-semibold">Vigilancia</h2>
      {nuevos.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Sin novedades importantes.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {nuevos.map((h) => (
            <li key={h.id} className="text-sm">
              <p className="line-clamp-2 text-foreground">{h.titulo}</p>
              <p className="text-xs text-muted-foreground">
                {h.fuente_nombre ?? "Fuente desconocida"} · {desde(h.creado_el)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Link to="/vigilancia" className="mt-3 inline-flex text-xs text-primary hover:underline">
        Ver la vigilancia
      </Link>
    </div>
  );
}

function TarjetaBandeja({ entradas }: { entradas: BandejaEntradaRow[] }) {
  const nuevas = entradas.filter((e) => e.estado === "nueva").slice(0, 5);
  return (
    <div className="panel p-4">
      <h2 className="font-display text-sm font-semibold">Bandeja</h2>
      {nuevas.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nada nuevo por revisar.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {nuevas.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="truncate text-foreground">{e.asunto ?? (e.texto ?? "").slice(0, 60)}</p>
              <p className="text-xs text-muted-foreground">
                {e.remitente_nombre ?? e.remitente ?? "Sin remitente"} · {desde(e.fecha ?? e.creado_el)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Link to="/bandeja" className="mt-3 inline-flex text-xs text-primary hover:underline">
        Ver la bandeja
      </Link>
    </div>
  );
}

function TarjetaDominios({ dominios }: { dominios: DominioRow[] }) {
  const activos = dominios.filter((d) => d.activo);
  const problemas = activos.filter((d) => d.resultado === "aviso" || d.resultado === "error");
  const nivel = problemas.some((d) => d.resultado === "error")
    ? "error"
    : problemas.length > 0
      ? "aviso"
      : "ok";
  const tono =
    nivel === "error" ? "bg-destructive" : nivel === "aviso" ? "bg-warning" : "bg-success";
  const ultima = activos
    .map((d) => d.ultima_comprobacion)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Dominios y certificados</h2>
        <span className={`size-2.5 rounded-full ${tono}`} aria-hidden />
      </div>
      {problemas.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Todo en orden · última comprobación {desde(ultima ?? null)}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {problemas.slice(0, 6).map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{d.dominio}</span>
              <span
                className={
                  d.resultado === "error" ? "text-xs text-destructive" : "text-xs text-warning"
                }
              >
                {d.resultado === "error" ? "no responde" : "revisar"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link to="/dominios" className="mt-3 inline-flex text-xs text-primary hover:underline">
        Ver todos los dominios
      </Link>
    </div>
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
