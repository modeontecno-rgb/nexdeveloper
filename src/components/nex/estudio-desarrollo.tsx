import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BellRing,
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
import { prepararSonido, sonidoTrabajoTerminado } from "@/lib/nex/sonidos";
import { textoDesarrolloDesdeConsejo } from "@/lib/nex/continuar-consejo";
import { detectarFinalizados, tituloFinalizacion } from "@/lib/nex/finalizacion";
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
  const formulario = React.useRef<HTMLFormElement>(null);
  const [desdeConsejo, setDesdeConsejo] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [avisos, setAvisos] = React.useState<Encargo[]>([]);
  const aviso = avisos[0];
  const estados = React.useRef(new Map<string, string>());
  const resultado = React.useRef<HTMLDivElement>(null);
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
  React.useEffect(() => {
    if (!lista.data) return;
    const terminados = detectarFinalizados(estados.current, lista.data);
    if (terminados.length) {
      setAvisos((actuales) => [...actuales, ...terminados]);
      sonidoTrabajoTerminado();
    }
  }, [lista.data]);
  React.useEffect(() => {
    if (!aviso) return;
    setAbierto(aviso.id);
    const frame = requestAnimationFrame(() => {
      resultado.current?.scrollIntoView({ behavior: "instant", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [aviso]);
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
      // Registra también encargos que terminan antes de la primera consulta de la lista.
      estados.current.set(r.ejecucion.id, "en_cola");
      setAbierto(r.ejecucion.id);
      setTexto("");
      setDesdeConsejo(false);
      adjuntos.limpiar();
      solicitud.current = null;
      void qc.invalidateQueries({ queryKey: ["estudio-encargos"] });
    },
    onError: (e) => setError(e.message),
  });
  const trabajos = (lista.data ?? []).filter(
    (e) => !proyecto || e.proyecto_id === proyecto || e.id === aviso?.id,
  );
  const seleccionado = proyectos.data?.find((p) => p.id === proyecto);
  const motivoBloqueo = enviar.isPending
    ? "Guardando el encargo…"
    : adjuntos.subiendo
      ? "Espera a que terminen de subir los archivos."
      : !proyecto
        ? "Selecciona arriba el proyecto en el que quieres trabajar."
        : !consejo && !seleccionado?.repositorio
          ? "Conecta el repositorio del proyecto para poder desarrollar."
          : !texto.trim() && !adjuntos.ids.length
            ? "Escribe lo que necesitas o pulsa Desarrollar este consejo en una entrega anterior."
            : null;
  const continuarConsejo = (e: Encargo) => {
    setProyecto(e.proyecto_id ?? "");
    setConsejo(false);
    setDesdeConsejo(true);
    setError(null);
    setTexto(textoDesarrolloDesdeConsejo(e, texto));
    requestAnimationFrame(() => {
      formulario.current?.scrollIntoView({ behavior: "instant", block: "start" });
      formulario.current?.querySelector("textarea")?.focus({ preventScroll: true });
    });
  };
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
        <div className="flex flex-col items-stretch justify-between gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
          <label className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:flex-1 sm:flex-row sm:items-center">
            <span className="text-xs text-muted-foreground">PROYECTO</span>
            <select
              aria-label="Proyecto del encargo"
              className={`${claseCampo} min-w-0 sm:max-w-sm`}
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
          ref={formulario}
          className="scroll-mt-6 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            prepararSonido();
            enviar.mutate();
          }}
        >
          <div className="mb-4 flex flex-wrap gap-2">
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
          {desdeConsejo ? (
            <p
              role="status"
              className="mb-4 rounded-xl border-2 border-primary bg-primary/10 p-4 text-lg font-medium"
            >
              Desarrollo preparado a partir de tu consejo. Revisa el texto y pulsa «Encargar
              desarrollo».
            </p>
          ) : null}
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
          <p className="mt-2 text-xs text-muted-foreground">
            Capturas: PNG, JPEG o WebP de hasta 2 MB. La lectura de imágenes se registra aparte en
            Consumo.
          </p>
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
              disabled={!!motivoBloqueo}
              aria-describedby={motivoBloqueo ? "motivo-envio" : undefined}
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
          {motivoBloqueo ? (
            <p id="motivo-envio" className="mt-3 text-sm font-medium text-foreground">
              {motivoBloqueo}
            </p>
          ) : null}
        </form>
      </section>
      <div ref={resultado} className="scroll-mt-6">
        {aviso ? (
          <section
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="nex-aviso-final mb-6 mt-8 rounded-2xl border-4 border-primary bg-card p-6 shadow-xl sm:p-8"
          >
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <BellRing className="size-10 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-3xl font-bold sm:text-4xl">
                  {tituloFinalizacion(aviso.estado)}
                </h2>
                <p className="mt-3 text-lg font-semibold">
                  {proyectos.data?.find((p) => p.id === aviso.proyecto_id)?.nombre ?? "Tu proyecto"}
                </p>
                <p className="mt-2 break-words text-lg">
                  {aviso.texto?.split("\n")[0] ?? "Tu encargo"}
                </p>
                <p className="mt-3 text-lg">
                  {aviso.estado === "error"
                    ? "Revisa el motivo en el trabajo desplegado debajo."
                    : "Ya tienes el resultado desplegado debajo, en Tus trabajos."}
                </p>
                <Boton
                  variante="suave"
                  className="mt-5 text-lg"
                  onClick={() => setAvisos((actuales) => actuales.slice(1))}
                >
                  Entendido{avisos.length > 1 ? ` · Ver siguiente (${avisos.length - 1})` : ""}
                </Boton>
              </div>
            </div>
          </section>
        ) : null}
        <div className="mb-4 mt-9 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold">Tus trabajos</h2>
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
          {[...trabajos]
            .sort((a, b) => Number(b.id === aviso?.id) - Number(a.id === aviso?.id))
            .map((e) => (
              <Trabajo
                key={e.id}
                e={e}
                nombre={proyectos.data?.find((p) => p.id === e.proyecto_id)?.nombre ?? "Proyecto"}
                abierto={abierto === e.id}
                cambiar={() => setAbierto(abierto === e.id ? null : e.id)}
                continuar={() => continuarConsejo(e)}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
function Trabajo({
  e,
  nombre,
  abierto,
  cambiar,
  continuar,
}: {
  e: Encargo;
  nombre: string;
  abierto: boolean;
  cambiar: () => void;
  continuar: () => void;
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
          <p className="break-words text-lg font-semibold">
            {e.texto?.split("\n")[0] ?? "Encargo"}
          </p>
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
            <div className="whitespace-pre-wrap break-words text-lg leading-relaxed">
              {e.respuesta || e.resumen}
            </div>
          ) : null}
          {e.estado === "completada" && fases.some((f) => f.papel === "consejo") ? (
            <div className="rounded-xl border-2 border-primary bg-primary/10 p-4">
              <p className="mb-3 text-lg font-semibold">
                ¿Quieres que el equipo haga este trabajo?
              </p>
              <Boton onClick={continuar}>
                <Code2 size={20} /> Desarrollar este consejo
              </Boton>
              <p className="mt-3 text-sm">
                Prepararemos el encargo con tu petición y este consejo. Podrás revisarlo antes de
                enviarlo.
              </p>
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
