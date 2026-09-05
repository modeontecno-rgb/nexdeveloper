import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCopy, ExternalLink, PlayCircle, RefreshCw, ShieldCheck } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import { SemaforoBadge } from "@/components/nex/semaforo";
import type { EstadoEjecucionCalidad, ResultadoControl, SemaforoCalidad } from "@/lib/nex/db-types";
import { TALLER_CALIDAD, RUTA_TALLER } from "@/lib/nex/calidad-workflow";
import { fechaHoraCorta } from "@/lib/nex/labels";
import {
  useControlesCalidad,
  useEjecucionesCalidad,
  useLanzarCalidad,
  useResultadosCalidad,
  useSincronizarCalidad,
} from "@/lib/nex/queries/calidad";
import { useProyectos } from "@/lib/nex/queries/datos";
import { VERSION_APP } from "@/lib/nex/version";

export const Route = createFileRoute("/calidad")({
  head: () => ({
    meta: [
      { title: "Calidad · NexDeveloper" },
      { name: "description", content: "Semáforo de calidad por proyecto y versión con los doce controles automáticos." },
      { property: "og:title", content: "Calidad · NexDeveloper" },
      {
        property: "og:description",
        content: "Semáforo de calidad por proyecto y versión con los doce controles automáticos.",
      },
    ],
  }),
  component: PantallaCalidad,
});

const ETIQUETA_RESULTADO: Record<ResultadoControl, string> = {
  ok: "Correcto",
  aviso: "Aviso",
  fallo: "Fallo",
  omitido: "No aplica",
};

const TONO_RESULTADO: Record<ResultadoControl, string> = {
  ok: "border-success/40 bg-success/10 text-success",
  aviso: "border-warning/40 bg-warning/10 text-warning",
  fallo: "border-destructive/40 bg-destructive/10 text-destructive",
  omitido: "border-border bg-muted text-muted-foreground",
};

const ETIQUETA_EJECUCION: Record<EstadoEjecucionCalidad, string> = {
  en_cola: "En cola",
  ejecutando: "Ejecutando",
  verde: "Verde",
  ambar: "Ámbar",
  rojo: "Rojo",
  error: "Error",
};

function PantallaCalidad() {
  const { data: proyectos = [] } = useProyectos();
  const { data: controles = [] } = useControlesCalidad();
  const { data: ejecuciones = [] } = useEjecucionesCalidad();
  const lanzar = useLanzarCalidad();
  const sincronizar = useSincronizarCalidad();

  const [abierto, setAbierto] = React.useState<string | null>(null);
  const [ejecucionAbierta, setEjecucionAbierta] = React.useState<string | null>(null);
  const [soloProblemas, setSoloProblemas] = React.useState(false);
  const [pidiendoVersion, setPidiendoVersion] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(VERSION_APP);
  const [ayuda, setAyuda] = React.useState(false);

  const { data: resultados = [] } = useResultadosCalidad(ejecucionAbierta);

  const contadores = React.useMemo(() => {
    const inicial: Record<SemaforoCalidad, number> = { verde: 0, ambar: 0, rojo: 0, sin_datos: 0 };
    for (const p of proyectos) inicial[p.semaforo_calidad ?? "sin_datos"] += 1;
    return inicial;
  }, [proyectos]);

  const ultimaDe = (proyectoId: string) => ejecuciones.find((e) => e.proyecto_id === proyectoId);

  const abrirProyecto = (proyectoId: string) => {
    const siguiente = abierto === proyectoId ? null : proyectoId;
    setAbierto(siguiente);
    setEjecucionAbierta(siguiente ? (ultimaDe(proyectoId)?.id ?? null) : null);
  };

  const confirmarLanzamiento = async () => {
    if (!pidiendoVersion) return;
    await lanzar.mutateAsync({ proyectoId: pidiendoVersion, version: version.trim() || "0.0.0" });
    setPidiendoVersion(null);
  };

  const copiarTaller = async () => {
    await navigator.clipboard.writeText(TALLER_CALIDAD);
    toast.success("Taller copiado. Pégalo en " + RUTA_TALLER);
  };

  const historial = abierto ? ejecuciones.filter((e) => e.proyecto_id === abierto) : [];
  const resultadosVisibles = soloProblemas
    ? resultados.filter((r) => r.resultado === "fallo" || r.resultado === "aviso")
    : resultados;

  return (
    <>
      <Encabezado
        titulo="Calidad"
        descripcion="Cada proyecto pasa los mismos doce controles automáticos antes y después de cada tanda."
        acciones={
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" onClick={() => setAyuda(true)}>
              <ShieldCheck className="size-4" /> Cómo instalar el taller
            </Boton>
            <Boton onClick={() => sincronizar.mutate()} disabled={sincronizar.isPending}>
              <RefreshCw className="size-4" /> Actualizar
            </Boton>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Contador titulo="En verde" valor={contadores.verde} tono="text-success" />
        <Contador titulo="En ámbar" valor={contadores.ambar} tono="text-warning" />
        <Contador titulo="En rojo" valor={contadores.rojo} tono="text-destructive" />
        <Contador titulo="Sin datos" valor={contadores.sin_datos} tono="text-muted-foreground" />
      </div>

      <div className="panel mt-6 overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Proyecto</th>
              <th className="px-4 py-3 text-left font-medium">Versión</th>
              <th className="px-4 py-3 text-left font-medium">Semáforo</th>
              <th className="px-4 py-3 text-left font-medium">Última comprobación</th>
              <th className="px-4 py-3 text-left font-medium">Duración</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proyectos.map((p) => {
              const ultima = ultimaDe(p.id);
              return (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => abrirProyecto(p.id)} className="font-medium hover:underline">
                      {p.nombre}
                    </button>
                    {!p.repositorio ? (
                      <p className="text-xs text-warning">Sin repositorio indicado</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{p.repositorio}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ultima?.version ?? "—"}</td>
                  <td className="px-4 py-3">
                    <SemaforoBadge semaforo={p.semaforo_calidad ?? "sin_datos"} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ultima ? fechaHoraCorta(ultima.terminada_el ?? ultima.iniciada_el) : "Nunca"}
                    {ultima && (ultima.estado === "en_cola" || ultima.estado === "ejecutando") ? (
                      <span className="ml-2 text-xs text-info">{ETIQUETA_EJECUCION[ultima.estado]}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ultima?.duracion_seg ? `${Math.round(ultima.duracion_seg / 60)} min` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {ultima?.url_run ? (
                        <a
                          href={ultima.url_run}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Ver detalle <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                      <Boton
                        variante="secundario"
                        onClick={() => {
                          setVersion(ultima?.version ?? VERSION_APP);
                          setPidiendoVersion(p.id);
                        }}
                        className="px-3 py-1.5 text-xs"
                      >
                        <PlayCircle className="size-3.5" /> Comprobar ahora
                      </Boton>
                    </div>
                  </td>
                </tr>
              );
            })}
            {proyectos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Todavía no hay proyectos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {abierto ? (
        <div className="mt-6 grid gap-4 xl:grid-cols-[18rem_1fr]">
          <div className="panel h-fit p-4">
            <h2 className="font-display text-sm font-semibold">Comprobaciones anteriores</h2>
            <ul className="mt-3 space-y-1.5">
              {historial.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setEjecucionAbierta(e.id)}
                    className={
                      ejecucionAbierta === e.id
                        ? "w-full rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-left text-xs text-primary"
                        : "w-full rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-primary/30"
                    }
                  >
                    <span className="font-medium">v{e.version}</span> · {ETIQUETA_EJECUCION[e.estado]}
                    <span className="block">{fechaHoraCorta(e.terminada_el ?? e.iniciada_el)}</span>
                  </button>
                </li>
              ))}
              {historial.length === 0 ? (
                <li className="text-xs text-muted-foreground">Este proyecto todavía no se ha comprobado.</li>
              ) : null}
            </ul>
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-sm font-semibold">Controles de esta comprobación</h2>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={soloProblemas}
                  onChange={(e) => setSoloProblemas(e.target.checked)}
                  className="size-3.5 accent-current"
                />
                Solo fallos y avisos
              </label>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {controles.map((c) => {
                const resultado = resultadosVisibles.find((r) => r.control_codigo === c.codigo);
                if (soloProblemas && !resultado) return null;
                return (
                  <div key={c.codigo} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{c.nombre}</p>
                        <p className="text-xs text-muted-foreground">{c.que_evita}</p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          TONO_RESULTADO[resultado?.resultado ?? "omitido"]
                        }`}
                      >
                        {resultado ? ETIQUETA_RESULTADO[resultado.resultado] : "Sin datos"}
                      </span>
                    </div>
                    {resultado?.detalle ? (
                      <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{resultado.detalle}</p>
                    ) : null}
                    {c.bloqueante ? (
                      <p className="mt-1 text-[11px] text-warning">Bloquea la publicación si falla</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <Dialogo
        abierto={Boolean(pidiendoVersion)}
        titulo="Comprobar la calidad"
        descripcion="Indica la versión que se está comprobando."
        onCerrar={() => setPidiendoVersion(null)}
        ancho="max-w-md"
      >
        <Campo etiqueta="Versión">
          <input value={version} onChange={(e) => setVersion(e.target.value)} className={claseCampo} />
        </Campo>
        <div className="mt-4 flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => setPidiendoVersion(null)}>
            Cancelar
          </Boton>
          <Boton onClick={() => void confirmarLanzamiento()} disabled={lanzar.isPending}>
            Lanzar comprobación
          </Boton>
        </div>
      </Dialogo>

      <Dialogo
        abierto={ayuda}
        titulo="Cómo instalar el taller de calidad"
        descripcion={`Copia este fichero en ${RUTA_TALLER} del repositorio del proyecto.`}
        onCerrar={() => setAyuda(false)}
        ancho="max-w-3xl"
      >
        <Boton variante="secundario" onClick={() => void copiarTaller()}>
          <ClipboardCopy className="size-4" /> Copiar el fichero
        </Boton>
        <pre className="mt-3 max-h-[26rem] overflow-auto rounded-lg border border-border bg-surface p-3 text-[11px] leading-relaxed text-muted-foreground">
          {TALLER_CALIDAD}
        </pre>
      </Dialogo>
    </>
  );
}

function Contador({ titulo, valor, tono }: { titulo: string; valor: number; tono: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${tono}`}>{valor}</p>
    </div>
  );
}
