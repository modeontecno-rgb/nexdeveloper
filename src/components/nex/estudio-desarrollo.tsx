import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Code2,
  Loader2,
  MessageSquare,
  Send,
  Square,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/nex/supabase";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  useCancelarEjecucion,
  useAprobarPublicar,
  ETIQUETA_ESTADO_EJECUCION,
} from "@/lib/nex/queries/ejecucion";
import type { EjecucionOrdenRow } from "@/lib/nex/db-types";
import { Boton, claseCampo } from "./campos";
import { CampoTextoConDictado } from "./dictado";
import { BotonAdjuntar, ListaAdjuntos, ZonaAdjuntos, useAdjuntos } from "./adjuntos";
import { Encabezado } from "./app-shell";
import { formatoEuros } from "@/lib/nex/labels";

type Fase = {
  papel: string;
  modelo: { proveedor: string; identificador: string };
  estado: string;
  motivo: string;
  resumen?: string;
  coste?: number;
};
type Encargo = EjecucionOrdenRow & {
  equipo_automatico: boolean;
  estado_agente?: { equipo?: Fase[]; fase?: number } | null;
};
const papeles: Record<string, string> = {
  consejo: "Consejo",
  diseno: "Diseño",
  backend: "Backend",
  interfaz: "Programación",
  revision: "Revisión",
};
const nombres: Record<string, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  google: "Gemini",
  deepseek: "DeepSeek",
  xai: "Grok",
  mistral: "Mistral",
  groq: "Groq",
  openrouter: "OpenRouter",
};
const activos = ["en_cola", "enviando", "construyendo", "comprobando", "publicando"];
function enlaceSeguro(url: string | null) {
  try {
    const u = new URL(url ?? "");
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
export function EstudioDesarrollo() {
  const proyectos = useProyectos(),
    qc = useQueryClient();
  const [proyecto, setProyecto] = React.useState(""),
    [texto, setTexto] = React.useState(""),
    [consejo, setConsejo] = React.useState(false),
    [abierto, setAbierto] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const solicitud = React.useRef<{ firma: string; id: string } | null>(null);
  const adjuntos = useAdjuntos();
  React.useEffect(() => {
    try {
      setProyecto(localStorage.getItem("nex:proyecto-desarrollo") ?? "");
    } catch {}
  }, []);
  React.useEffect(() => {
    if (proyectos.data?.length === 1 && !proyecto) setProyecto(proyectos.data[0]!.id);
  }, [proyectos.data, proyecto]);
  const lista = useQuery({
    queryKey: ["estudio-encargos"],
    queryFn: async () => {
      const r = await supabase
        .from("ejecuciones_orden")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(100);
      if (r.error) throw r.error;
      return r.data as unknown as Encargo[];
    },
    refetchInterval: 5000,
  });
  const enviar = useMutation({
    mutationFn: async () => {
      setError(null);
      const contenido =
        texto.trim() ||
        (adjuntos.ids.length ? "Desarrolla el proyecto descrito en los archivos adjuntos." : "");
      if (!proyecto) throw Error("Selecciona el proyecto para guardar este encargo.");
      if (adjuntos.subiendo) throw Error("Espera a que termine la subida.");
      const firma = JSON.stringify({ contenido, proyecto, consejo, ids: adjuntos.ids });
      if (solicitud.current?.firma !== firma)
        solicitud.current = { firma, id: crypto.randomUUID() };
      const r = await supabase.functions.invoke("pideme", {
        body: {
          accion: "encargar",
          solicitud_id: solicitud.current.id,
          proyecto_id: proyecto,
          texto: contenido,
          consejo,
          adjunto_ids: adjuntos.ids,
        },
      });
      if (r.error || !r.data?.ok) {
        let m = r.data?.error;
        try {
          m ??= (await r.error?.context?.json())?.error;
        } catch {}
        throw Error(m ?? r.error?.message ?? "No se ha podido enviar. Tu petición sigue aquí.");
      }
      return r.data as { ejecucion: Encargo };
    },
    onSuccess: (r) => {
      setAbierto(r.ejecucion.id);
      setTexto("");
      adjuntos.limpiar();
      solicitud.current = null;
      void qc.invalidateQueries({ queryKey: ["estudio-encargos"] });
    },
    onError: (e) => setError(e.message),
  });
  const trabajos = (lista.data ?? []).filter((e) => !proyecto || e.proyecto_id === proyecto);
  const seleccionado = proyectos.data?.find((p) => p.id === proyecto);
  return (
    <div className="mx-auto max-w-5xl pb-12">
      <Encabezado
        titulo="¿Qué desarrollamos?"
        descripcion="Una petición. Tu equipo se ocupa del resto."
        acciones={
          <Link to="/equipo" className="inline-flex items-center gap-2 text-sm text-primary">
            <Users size={16} />
            Mi equipo
          </Link>
        }
      />
      <section className="panel overflow-hidden border-primary/25">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <label className="flex min-w-0 flex-1 items-center gap-3">
            <span className="text-xs text-muted-foreground">PROYECTO</span>
            <select
              aria-label="Proyecto del encargo"
              className={`${claseCampo} max-w-sm`}
              value={proyecto}
              onChange={(e) => {
                setProyecto(e.target.value);
                try {
                  localStorage.setItem("nex:proyecto-desarrollo", e.target.value);
                } catch {}
              }}
            >
              <option value="">Selecciona un proyecto</option>
              {proyectos.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <Link to="/proyectos" className="text-xs text-primary">
            Crear o conectar proyecto ↗
          </Link>
        </div>
        <form
          className="p-5"
          onSubmit={(e) => {
            e.preventDefault();
            enviar.mutate();
          }}
        >
          <div className="mb-4 flex gap-2">
            {[
              { valor: false, texto: "Desarrollar", icono: Code2 },
              { valor: true, texto: "Pedir consejo", icono: MessageSquare },
            ].map((m) => (
              <button
                key={m.texto}
                type="button"
                aria-pressed={consejo === m.valor}
                onClick={() => setConsejo(m.valor)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${consejo === m.valor ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              >
                <m.icono size={15} />
                {m.texto}
              </button>
            ))}
          </div>
          <ZonaAdjuntos onFicheros={(f) => void adjuntos.anadir(f)}>
            <CampoTextoConDictado
              valor={texto}
              onValor={setTexto}
              filas={5}
              placeholder={
                consejo
                  ? "Cuéntame tu idea o tu duda: qué conviene hacer, con qué herramientas y por qué…"
                  : "Describe lo que quieres construir o cambiar. También puedes dictarlo o arrastrar un documento o una captura."
              }
              extras={
                <BotonAdjuntar
                  onFicheros={(f) => void adjuntos.anadir(f)}
                  disabled={adjuntos.subiendo || enviar.isPending}
                />
              }
            />
            <ListaAdjuntos adjuntos={adjuntos.adjuntos} onQuitar={(a) => void adjuntos.quitar(a)} />
          </ZonaAdjuntos>
          <p className="mt-2 text-xs text-muted-foreground">Capturas: PNG, JPEG o WebP de hasta 2 MB. La lectura de imágenes se registra aparte en Consumo.</p>
          {error || adjuntos.error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error || adjuntos.error}
            </p>
          ) : null}
          {seleccionado && !seleccionado.repositorio && !consejo ? (
            <p className="mt-3 text-sm text-warning">
              Este proyecto necesita conectar su repositorio para que el equipo pueda leer y
              modificar su código.
            </p>
          ) : null}
          {proyectos.isError ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              No se pudieron cargar tus proyectos.{" "}
              <button type="button" onClick={() => void proyectos.refetch()} className="underline">
                Reintentar
              </button>
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-lg text-xs text-muted-foreground">
              {consejo
                ? "El equipo estudia tu idea y el código disponible y te aconseja sin modificarlo."
                : "El equipo trabaja en una versión separada. Verás el resultado antes de publicarlo."}
            </p>
            <Boton
              type="submit"
              disabled={
                enviar.isPending ||
                adjuntos.subiendo ||
                (!texto.trim() && !adjuntos.ids.length) ||
                !proyecto
              }
            >
              {enviar.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}{" "}
              {enviar.isPending
                ? "Guardando encargo…"
                : consejo
                  ? "Consultar al equipo"
                  : "Encargar desarrollo"}
            </Boton>
          </div>
        </form>
      </section>
      <div className="mb-4 mt-9 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Tus trabajos</h2>
        <span className="text-xs text-muted-foreground">Estado y consumo registrados</span>
      </div>
      {lista.isError ? (
        <p role="alert" className="panel p-5 text-destructive">
          No se pudo cargar el estado de los trabajos.{" "}
          <button onClick={() => void lista.refetch()} className="underline">
            Reintentar
          </button>
        </p>
      ) : null}
      {!lista.isPending && !lista.isError && !trabajos.length ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          Tu primer encargo aparecerá aquí. Podrás ver quién interviene y abrir su resultado.
        </div>
      ) : null}
      <div className="space-y-3">
        {trabajos.map((e) => (
          <Trabajo
            key={e.id}
            e={e}
            nombre={proyectos.data?.find((p) => p.id === e.proyecto_id)?.nombre ?? "Proyecto"}
            abierto={abierto === e.id}
            cambiar={() => setAbierto(abierto === e.id ? null : e.id)}
          />
        ))}
      </div>
    </div>
  );
}
function Trabajo({
  e,
  nombre,
  abierto,
  cambiar,
}: {
  e: Encargo;
  nombre: string;
  abierto: boolean;
  cambiar: () => void;
}) {
  const cancelar = useCancelarEjecucion(),
    publicar = useAprobarPublicar();
  const fases = e.estado_agente?.equipo ?? [];
  const fase = fases.find((f) => f.estado === "trabajando"),
    activo = activos.includes(e.estado);
  const pr = enlaceSeguro(e.pr_url),
    url = enlaceSeguro(e.publicado_url ?? e.preview_url);
  return (
    <article className="panel overflow-hidden">
      <button
        onClick={cambiar}
        aria-expanded={abierto}
        className="flex w-full items-start gap-3 p-5 text-left"
      >
        {activo ? (
          <Loader2 size={18} className="mt-1 shrink-0 animate-spin text-primary" />
        ) : e.estado === "completada" ? (
          <Check size={18} className="mt-1 shrink-0 text-success" />
        ) : (
          <Code2 size={18} className="mt-1 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium">{e.texto?.split("\n")[0] ?? "Encargo"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {nombre} ·{" "}
            {fase
              ? `${papeles[fase.papel] ?? fase.papel}: ${nombres[fase.modelo.proveedor] ?? fase.modelo.proveedor}`
              : ETIQUETA_ESTADO_EJECUCION[e.estado]}{" "}
            · {formatoEuros(Number(e.coste_ia ?? 0))} registrados
          </p>
        </div>
        <ChevronDown size={16} className={abierto ? "rotate-180" : ""} />
      </button>
      {abierto ? (
        <div className="space-y-4 border-t border-border p-5">
          {e.estado === "en_cola" ? (
            <p className="text-sm text-muted-foreground">
              Guardado. Esperando al coordinador del servidor; puedes cerrar esta pantalla.
            </p>
          ) : null}
          {fases.length ? (
            <ol className="grid gap-3 sm:grid-cols-2">
              {fases.map((f, i) => (
                <li key={i} className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    {i + 1}. {papeles[f.papel] ?? f.papel} ·{" "}
                    {f.estado === "completada"
                      ? "Hecho"
                      : f.estado === "trabajando"
                        ? "Trabajando"
                        : "Pendiente"}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {nombres[f.modelo.proveedor] ?? f.modelo.proveedor}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {f.modelo.identificador}
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{f.motivo}</p>
                  {f.resumen ? (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-primary">Ver entrega</summary>
                      <p className="mt-2 whitespace-pre-wrap">{f.resumen}</p>
                    </details>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
          {e.error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {e.error}
            </p>
          ) : null}
          {e.respuesta || e.resumen ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {e.respuesta || e.resumen}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {pr ? (
              <a
                href={pr}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary"
              >
                Ver cambios <ArrowUpRight size={14} />
              </a>
            ) : null}
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary"
              >
                Abrir resultado ↗
              </a>
            ) : null}
            {activo ? (
              <Boton
                variante="suave"
                disabled={cancelar.isPending}
                onClick={() => cancelar.mutate(e.id)}
              >
                <Square size={14} />
                Detener
              </Boton>
            ) : null}
            {e.estado === "esperando_aprobacion" && pr ? (
              <Boton disabled={publicar.isPending} onClick={() => publicar.mutate(e.id)}>
                Integrar y publicar
              </Boton>
            ) : null}
          </div>
          {e.estado === "error" ? (
            <p className="text-xs text-muted-foreground">
              La entrega parcial se conserva. Revisa el motivo antes de repetir el encargo para
              evitar duplicar consumo.
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
