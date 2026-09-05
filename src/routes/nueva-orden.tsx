import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { ETIQUETA_MODO } from "@/lib/nex/labels";
import { formatoEuros } from "@/lib/nex/labels";
import { useConfig } from "@/lib/nex/config";
import { useNex } from "@/lib/nex/store";
import type { ModoEjecucion, Prioridad } from "@/lib/nex/types";

export const Route = createFileRoute("/nueva-orden")({
  head: () => ({
    meta: [
      { title: "Nueva orden · NexDeveloper" },
      { name: "description", content: "Escribe una orden, elige proyecto y recibe la recomendación de agente." },
      { property: "og:title", content: "Nueva orden · NexDeveloper" },
      { property: "og:description", content: "Escribe una orden y recibe la recomendación de agente." },
    ],
  }),
  component: NuevaOrden,
});

const PALABRAS: Record<string, string[]> = {
  claude: ["arquitectura", "código", "refactor", "revisión", "seguridad", "base de datos"],
  chatgpt: ["plan", "texto", "redactar", "análisis", "documentación"],
  gemini: ["informe", "datos", "pdf", "documento", "excel"],
  lovable: ["pantalla", "web", "interfaz", "página", "formulario"],
  canva: ["diseño", "plantilla", "marca", "cartel"],
  "nano-banana": ["imagen", "foto", "ilustración", "banner"],
};

function NuevaOrden() {
  const { proyectos, agentes, crearOrden, solicitarAprobacion } = useNex();
  const { config } = useConfig();
  const navigate = useNavigate();
  const [proyectoId, setProyectoId] = React.useState(proyectos[0]?.id ?? "");
  const [texto, setTexto] = React.useState("");
  const [modo, setModo] = React.useState<ModoEjecucion>("equilibrado");
  const [prioridad, setPrioridad] = React.useState<Prioridad>("media");
  const [mesaExpertos, setMesaExpertos] = React.useState(false);

  const t = texto.toLowerCase();
  const puntuaciones = agentes.map((a) => {
    const coincidencias = (PALABRAS[a.id] ?? []).filter((p) => t.includes(p)).length;
    const pesoCoste = modo === "economico" ? 12 : modo === "maxima_calidad" ? 2 : 6;
    const pesoCalidad = modo === "maxima_calidad" ? 1.4 : 1;
    const carga = a.tareasActivas / a.capacidad;
    return {
      agente: a,
      puntos: coincidencias * 20 + a.calidad * pesoCalidad + a.rapidez * 0.3 - a.costeRelativo * pesoCoste - carga * 15,
    };
  });
  const ordenados = [...puntuaciones].sort((x, y) => y.puntos - x.puntos);
  const recomendado = ordenados[0];
  const equipo = mesaExpertos ? ordenados.slice(0, 3) : ordenados.slice(0, 1);

  const factorModo = modo === "economico" ? 0.6 : modo === "maxima_calidad" ? 1.7 : 1;
  const costeEstimado = Math.round(
    equipo.reduce((s, e) => s + (30 + texto.length * 0.15) * e.agente.costeRelativo, 0) * factorModo,
  );
  const horas = Math.round((1.5 + texto.length / 200) * factorModo * equipo.length * 10) / 10;
  const riesgo: "Bajo" | "Medio" | "Alto" =
    prioridad === "critica" || costeEstimado > 250 ? "Alto" : costeEstimado > 120 ? "Medio" : "Bajo";
  const calidadPrevista = Math.round(
    equipo.reduce((s, e) => s + e.agente.calidad, 0) / equipo.length + (modo === "maxima_calidad" ? 4 : 0),
  );
  const motivos = [
    costeEstimado > config.umbralAprobacion ? `supera el límite de ${formatoEuros(config.umbralAprobacion)}` : null,
    prioridad === "critica" ? "prioridad crítica" : null,
    riesgo === "Alto" ? "riesgo alto" : null,
  ].filter(Boolean) as string[];
  const requiereAprobacion = motivos.length > 0;

  return (
    <>
      <Encabezado titulo="Nueva orden" descripcion="Escribe qué necesitas y NexDeveloper propone quién debe hacerlo." />

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="panel p-4">
          <label className="text-xs text-muted-foreground">Proyecto</label>
          <select
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm"
          >
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-xs text-muted-foreground">Orden en lenguaje natural</label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={7}
            placeholder="Ejemplo: revisa el módulo de facturación y prepara las pruebas antes de publicarlo."
            className="mt-1 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(ETIQUETA_MODO) as ModoEjecucion[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                className={
                  modo === m
                    ? "rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                    : "rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2"
                }
              >
                {ETIQUETA_MODO[m]}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Prioridad
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as Prioridad)}
                className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm text-foreground"
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mesaExpertos}
                onChange={(e) => setMesaExpertos(e.target.checked)}
                className="size-4 accent-primary"
              />
              Mesa de expertos (solo decisiones importantes)
            </label>
          </div>
        </div>

        <aside className="panel h-fit p-4">
          <h2 className="font-display text-sm font-semibold">Propuesta</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {texto.trim()
              ? mesaExpertos
                ? "Equipo propuesto: planifica, ejecuta y revisa."
                : `Agente recomendado: ${recomendado?.agente.nombre}.`
              : "Escribe la orden para ver la recomendación."}
          </p>
          <ul className="mt-3 space-y-2">
            {equipo.map((e, i) => (
              <li key={e.agente.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <span className="font-medium">{e.agente.nombre}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {mesaExpertos ? ["planifica", "ejecuta", "revisa"][i] : "ejecuta"} · calidad {e.agente.calidad}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 text-sm">
            <Fila termino="Coste estimado" valor={formatoEuros(costeEstimado)} />
            <Fila termino="Tiempo estimado" valor={`${horas} h`} />
            <Fila termino="Riesgo" valor={riesgo} />
            <Fila termino="Calidad prevista" valor={`${calidadPrevista}/100`} />
            <Fila termino="Aprobación" valor={requiereAprobacion ? `Necesaria (${motivos.join(", ")})` : "No necesaria"} />
          </dl>

          <button
            type="button"
            disabled={!texto.trim() || !proyectoId}
            onClick={() => {
              if (requiereAprobacion) {
                solicitarAprobacion({
                  proyectoId,
                  texto: texto.trim(),
                  agenteId: recomendado?.agente.id ?? null,
                  equipo: equipo.map((e) => e.agente.id),
                  modo,
                  prioridad,
                  costeEstimado,
                  estimacionHoras: horas,
                  riesgo,
                  calidadPrevista,
                  motivo: motivos.join(", "),
                });
                toast.info("Orden enviada a aprobación", {
                  description: "Revísala en la pantalla de Aprobaciones antes de que se ejecute.",
                });
                navigate({ to: "/aprobaciones" });
                return;
              }
              crearOrden({
                proyectoId,
                texto: texto.trim(),
                agenteId: recomendado?.agente.id ?? null,
                costeEstimado,
                estimacionHoras: horas,
                prioridad,
              });
              toast.success("Orden enviada a la cola", {
                description: "Los agentes reales se conectarán en una fase posterior.",
              });
              navigate({ to: "/proyectos/$proyectoId", params: { proyectoId } });
            }}
            className="mt-4 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {requiereAprobacion ? "Enviar a aprobación" : "Enviar"}
          </button>
        </aside>
      </div>
    </>
  );
}

function Fila({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-1.5">
      <dt className="text-muted-foreground">{termino}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
