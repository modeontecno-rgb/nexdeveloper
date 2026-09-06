import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkle, Wand2 } from "lucide-react";
import * as React from "react";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import type { ModoEjecucion, Prioridad } from "@/lib/nex/db-types";
import { estimar } from "@/lib/nex/estimacion";
import { ETIQUETA_MODO, ETIQUETA_PRIORIDAD, formatoDinero } from "@/lib/nex/labels";
import { useAgentes, useAjustes, useChats, useProyectos } from "@/lib/nex/queries/datos";
import { revisarOrden } from "@/lib/nex/queries/calidad";
import { sugerirProyecto, useCrearOrden, type Sugerencia } from "@/lib/nex/queries/ordenes";
import { bloquea, revisarTextoOrden } from "@/lib/nex/revision-orden";
import type { Hallazgo } from "@/lib/nex/db-types";
import { SelectorHabilidad } from "@/routes/habilidades";
import { useActualizarHabilidad } from "@/lib/nex/queries/habilidades";

export const Route = createFileRoute("/nueva-orden")({
  head: () => ({
    meta: [
      { title: "Nueva orden · NexDeveloper" },
      { name: "description", content: "Escribe una orden en lenguaje natural y elige coste, calidad y agentes." },
      { property: "og:title", content: "Nueva orden · NexDeveloper" },
      {
        property: "og:description",
        content: "Escribe una orden en lenguaje natural y elige coste, calidad y agentes.",
      },
    ],
  }),
  component: NuevaOrdenPantalla,
});

const MODOS: ModoEjecucion[] = ["economico", "equilibrado", "maxima_calidad"];

function NuevaOrdenPantalla() {
  const { data: proyectos = [] } = useProyectos();
  const { data: agentes = [] } = useAgentes();
  const { data: chats = [] } = useChats();
  const { data: ajustes } = useAjustes();
  const moneda = ajustes?.moneda ?? "EUR";
  const crear = useCrearOrden();
  const navegar = useNavigate();

  const [texto, setTexto] = React.useState("");
  const [proyectoId, setProyectoId] = React.useState<string>("");
  const [modo, setModo] = React.useState<ModoEjecucion>("equilibrado");
  const [prioridad, setPrioridad] = React.useState<Prioridad>("media");
  const [equipo, setEquipo] = React.useState<string[]>([]);
  const [sugerencia, setSugerencia] = React.useState<Sugerencia | null>(null);
  const [hallazgos, setHallazgos] = React.useState<Hallazgo[] | null>(null);
  const actualizarHabilidad = useActualizarHabilidad();

  React.useEffect(() => {
    if (!proyectoId && proyectos[0]) setProyectoId(proyectos[0].id);
  }, [proyectos, proyectoId]);

  React.useEffect(() => {
    if (texto.trim().length < 12) {
      setSugerencia(null);
      return;
    }
    const t = setTimeout(() => {
      void sugerirProyecto(texto).then(setSugerencia);
    }, 600);
    return () => clearTimeout(t);
  }, [texto]);

  const estimacion = estimar(texto, modo, prioridad, Math.max(1, equipo.length));
  const umbral = ajustes?.umbral_aprobacion_eur ?? 150;
  const necesitaAprobacion =
    estimacion.costeEstimado > umbral ||
    (ajustes?.aprobar_si_prioridad_critica !== false && prioridad === "critica") ||
    (ajustes?.aprobar_si_riesgo_alto !== false && estimacion.riesgo === "Alto");

  const alternar = (id: string) =>
    setEquipo((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  const enviar = async (e: React.FormEvent, forzar = false) => {
    e.preventDefault();
    const proyecto = proyectos.find((p) => p.id === proyectoId);
    const encontrados = revisarTextoOrden(texto, proyecto?.repositorio);
    if (!forzar && encontrados.length > 0) {
      setHallazgos(encontrados);
      if (bloquea(encontrados)) return;
      return;
    }
    const chat = chats.find((c) => c.proyecto_id === proyectoId && c.es_principal);
    const creada = await crear.mutateAsync({
      entrada: {
        proyectoId: proyectoId || null,
        chatId: chat?.id ?? null,
        texto: texto.trim(),
        modo,
        prioridad,
        agenteId: equipo[0] ?? null,
        equipo,
        costeEstimado: estimacion.costeEstimado,
        horasEstimadas: estimacion.horasEstimadas,
        riesgo: estimacion.riesgo,
        calidadPrevista: estimacion.calidadPrevista,
      },
      ajustes: ajustes ?? null,
    });
    if (creada?.id) await revisarOrden(creada.id).catch(() => undefined);
    setHallazgos(null);
    setTexto("");
    void navegar({ to: necesitaAprobacion ? "/aprobaciones" : "/cola" });
  };

  return (
    <>
      <Encabezado
        titulo="Nueva orden"
        descripcion="Escribe lo que quieres conseguir. NexDeveloper propone proyecto, equipo, coste y riesgo."
      />

      <form onSubmit={enviar} className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <div className="panel p-5">
            <Campo etiqueta="¿Qué quieres que se haga?">
              <textarea
                required
                rows={7}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Por ejemplo: prepara la pantalla de facturación con descarga en PDF y avisos por correo."
                className={claseCampo}
              />
            </Campo>

            <div className="mt-3">
              <SelectorHabilidad
                {...(proyectoId ? { proyectoId } : {})}
                etiqueta="Añadir habilidad"
                onElegir={(h) => {
                  setTexto((t) => `${t.trim()}${t.trim() ? "\n\n" : ""}Aplica la habilidad «${h.nombre}».`);
                  actualizarHabilidad.mutate({
                    id: h.id,
                    cambios: { usos: Number(h.usos ?? 0) + 1, ultimo_uso: new Date().toISOString() },
                  });
                }}
              />
            </div>

            {sugerencia && sugerencia.proyecto_id !== proyectoId ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                <Wand2 className="size-3.5 text-warning" />
                Esto encaja mejor en «{sugerencia.nombre}» ({Math.round(sugerencia.confianza)}% de confianza).
                <button
                  type="button"
                  onClick={() => setProyectoId(sugerencia.proyecto_id)}
                  className="font-medium text-primary underline"
                >
                  Cambiar a ese proyecto
                </button>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Proyecto">
                <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={claseCampo}>
                  <option value="">Sin clasificar</option>
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Prioridad">
                <select
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value as Prioridad)}
                  className={claseCampo}
                >
                  {Object.entries(ETIQUETA_PRIORIDAD).map(([valor, texto]) => (
                    <option key={valor} value={valor}>
                      {texto}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
          </div>

          <div className="panel p-5">
            <p className="text-xs font-medium text-muted-foreground">Modo de ejecución</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {MODOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModo(m)}
                  aria-pressed={modo === m}
                  className={
                    modo === m
                      ? "rounded-lg border border-primary/50 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary"
                      : "rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-muted-foreground transition hover:border-primary/30"
                  }
                >
                  {ETIQUETA_MODO[m]}
                </button>
              ))}
            </div>

            <p className="mt-5 text-xs font-medium text-muted-foreground">Equipo de agentes</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {agentes.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => alternar(a.id)}
                  aria-pressed={equipo.includes(a.id)}
                  className={
                    equipo.includes(a.id)
                      ? "rounded-full border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                      : "rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/30"
                  }
                >
                  {a.nombre}
                  {!a.conectado ? " · sin conectar" : ""}
                </button>
              ))}
              {agentes.length === 0 && <span className="text-xs text-muted-foreground">Sin agentes en el catálogo.</span>}
            </div>
          </div>
        </div>

        <aside className="panel h-fit p-5">
          <h2 className="font-display text-sm font-semibold">Previsión de esta orden</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Fila termino="Coste estimado" valor={formatoDinero(estimacion.costeEstimado, moneda)} />
            <Fila termino="Tiempo estimado" valor={`${estimacion.horasEstimadas.toFixed(1)} h`} />
            <Fila termino="Riesgo" valor={estimacion.riesgo} />
            <Fila termino="Calidad prevista" valor={`${estimacion.calidadPrevista}%`} />
            <Fila termino="Agentes" valor={equipo.length ? String(equipo.length) : "Se asignará solo"} />
          </dl>

          <p
            className={
              necesitaAprobacion
                ? "mt-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
                : "mt-4 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs text-success"
            }
          >
            {necesitaAprobacion
              ? `Esta orden pasará por tu aprobación (umbral ${formatoDinero(umbral, moneda)}).`
              : "Esta orden se enviará directamente a la cola de trabajo."}
          </p>

          {hallazgos && hallazgos.length > 0 ? (
            <div
              className={
                bloquea(hallazgos)
                  ? "mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
                  : "mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning"
              }
            >
              <p className="font-medium">
                {bloquea(hallazgos) ? "La orden no puede salir" : "Revisa estos avisos"}
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                {hallazgos.map((h) => (
                  <li key={h.codigo}>{h.mensaje}</li>
                ))}
              </ul>
              {!bloquea(hallazgos) ? (
                <button
                  type="button"
                  onClick={(ev) => void enviar(ev, true)}
                  className="mt-2 font-medium underline"
                >
                  Enviar de todos modos
                </button>
              ) : null}
            </div>
          ) : null}

          <Boton type="submit" className="mt-4 w-full" disabled={crear.isPending || texto.trim().length < 5}>
            <Sparkle className="size-4" /> {necesitaAprobacion ? "Enviar a aprobación" : "Enviar a la cola"}
          </Boton>
        </aside>
      </form>
    </>
  );
}

function Fila({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{termino}</dt>
      <dd className="font-medium text-foreground">{valor}</dd>
    </div>
  );
}
