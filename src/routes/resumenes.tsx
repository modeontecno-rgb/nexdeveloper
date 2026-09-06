import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Newspaper,
  RefreshCw,
  Send,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import type { CanalResumen, IncluirResumen, ResumenRow, TipoResumen } from "@/lib/nex/db-types";
import { desde, formatoFechaHora } from "@/lib/nex/labels";
import {
  hoyISO,
  imprimirResumen,
  markdownAHtml,
  useEnviarResumen,
  useGenerarResumen,
  useGuardarResumenesConfig,
  useMarcarResumenLeido,
  usePingResumenes,
  useRealtimeResumenes,
  useResumenes,
  useResumenesConfig,
} from "@/lib/nex/queries/resumenes";
import { useFuentesBandeja } from "@/lib/nex/queries/bandeja";

export const Route = createFileRoute("/resumenes")({
  head: () => ({
    meta: [
      { title: "Resúmenes · NexDeveloper" },
      {
        name: "description",
        content: "Resumen diario a las 08:00 e informe semanal de toda tu cartera de proyectos.",
      },
      { property: "og:title", content: "Resúmenes · NexDeveloper" },
      {
        property: "og:description",
        content: "Resumen diario a las 08:00 e informe semanal de toda tu cartera de proyectos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaResumenes,
});

const ETIQUETA_TIPO: Record<TipoResumen, string> = { diario: "Diario", semanal: "Semanal" };

const ETIQUETAS_INCLUIR: { clave: keyof IncluirResumen; texto: string }[] = [
  { clave: "atencion", texto: "Requiere tu atención" },
  { clave: "desatendidas", texto: "Trabajo desatendido" },
  { clave: "compilaciones", texto: "Compilaciones" },
  { clave: "vigilancia", texto: "Vigilancia" },
  { clave: "dominios", texto: "Dominios y certificados" },
  { clave: "copias", texto: "Copias de seguridad" },
  { clave: "bandeja", texto: "Bandeja" },
  { clave: "calidad", texto: "Calidad" },
  { clave: "consumo_ia", texto: "Gasto de IA" },
  { clave: "actividad", texto: "Actividad" },
];

function PantallaResumenes() {
  const { data: resumenes = [], isPending } = useResumenes();
  const [pestana, setPestana] = React.useState<"resumen" | "config">("resumen");
  const [seleccionado, setSeleccionado] = React.useState<string | null>(null);
  useRealtimeResumenes();

  const diarios = resumenes.filter((r) => r.tipo === "diario");
  const actual = resumenes.find((r) => r.id === seleccionado) ?? diarios[0] ?? resumenes[0] ?? null;

  return (
    <>
      <Encabezado
        titulo="Resúmenes"
        descripcion="Tu resumen diario de las 08:00 y el informe semanal de toda la cartera."
        acciones={
          <div className="flex gap-2">
            <Boton
              variante={pestana === "resumen" ? "principal" : "suave"}
              onClick={() => setPestana("resumen")}
              type="button"
            >
              Resúmenes
            </Boton>
            <Boton
              variante={pestana === "config" ? "principal" : "suave"}
              onClick={() => setPestana("config")}
              type="button"
            >
              Configuración
            </Boton>
          </div>
        }
      />

      {pestana === "config" ? (
        <Configuracion />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-4">
            <Cabecera resumen={actual} />
            <Visor resumen={actual} />
          </div>
          <Historial
            resumenes={resumenes}
            cargando={isPending}
            activo={actual?.id ?? null}
            alElegir={(id) => setSeleccionado(id)}
          />
        </div>
      )}
    </>
  );
}

function Cabecera({ resumen }: { resumen: ResumenRow | null }) {
  const generar = useGenerarResumen();
  const enviar = useEnviarResumen();
  const [enviarTambien, setEnviarTambien] = React.useState(false);

  const lanzar = async (tipo: TipoResumen) => {
    try {
      const r = await generar.mutateAsync({ tipo, enviar: enviarTambien });
      const errores = r.errores ?? [];
      toast.success(errores.length ? `Generado, pero con avisos de envío: ${errores.join(", ")}` : `Generado: ${r.titulo}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const reenviar = async () => {
    if (!resumen) return;
    try {
      const r = await enviar.mutateAsync({ resumenId: resumen.id });
      toast.success(
        (r.errores ?? []).length ? `Con avisos: ${(r.errores ?? []).join(", ")}` : "Resumen enviado de nuevo.",
      );
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const cifras = resumen?.datos ?? {};
  const envio = resumen?.error_envio
    ? { tono: "text-destructive", texto: resumen.error_envio }
    : (resumen?.enviado_por ?? []).length
      ? { tono: "text-success", texto: `Enviado por ${(resumen?.enviado_por ?? []).join(" y ")}` }
      : { tono: "text-muted-foreground", texto: "No enviado" };

  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {resumen ? `${ETIQUETA_TIPO[resumen.tipo]} · ${resumen.fecha}` : "Sin resúmenes todavía"}
          </p>
          <h2 className="font-display text-lg font-semibold">{resumen?.titulo ?? "Genera tu primer resumen"}</h2>
          <p className={`mt-1 text-xs ${envio.tono}`}>{envio.texto}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={enviarTambien}
              onChange={(e) => setEnviarTambien(e.target.checked)}
              className="size-3.5"
            />
            y enviar
          </label>
          <Boton type="button" onClick={() => void lanzar("diario")} disabled={generar.isPending}>
            {generar.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Generar diario
          </Boton>
          <Boton variante="suave" type="button" onClick={() => void lanzar("semanal")} disabled={generar.isPending}>
            Generar semanal
          </Boton>
          <Boton variante="suave" type="button" onClick={() => void reenviar()} disabled={!resumen || enviar.isPending}>
            <Send className="size-4" /> Enviar de nuevo
          </Boton>
          <Boton
            variante="suave"
            type="button"
            onClick={() => {
              if (!resumen) return;
              if (!imprimirResumen(resumen)) toast.error("El navegador ha bloqueado la ventana nueva.");
            }}
            disabled={!resumen}
          >
            <Download className="size-4" /> Descargar PDF
          </Boton>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cifra titulo="Requieren tu atención" valor={cifras.requieren_atencion ?? 0} />
        <Cifra titulo="Avisos técnicos" valor={(cifras.dominios_con_aviso ?? 0) + (cifras.copias_error ?? 0)} />
        <Cifra
          titulo="Novedades y mensajes"
          valor={(cifras.hallazgos_vigilancia ?? 0) + (cifras.bandeja_pendiente ?? 0)}
        />
        <Cifra titulo="Gasto de IA" valor={`${(cifras.coste_ia_eur ?? 0).toFixed(2)} €`} />
      </div>
      {resumen?.redactado_por ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Redactado por {resumen.redactado_por === "plantilla" ? "plantilla" : resumen.redactado_por}
        </p>
      ) : null}
    </section>
  );
}

function Cifra({ titulo, valor }: { titulo: string; valor: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 font-display text-xl font-semibold">{valor}</p>
    </div>
  );
}

function Visor({ resumen }: { resumen: ResumenRow | null }) {
  const [vista, setVista] = React.useState<"html" | "texto">("html");
  const marco = React.useRef<HTMLIFrameElement | null>(null);
  const [alto, setAlto] = React.useState(600);

  const html = resumen?.contenido_html ?? "";

  React.useEffect(() => {
    if (vista !== "html") return;
    const ajustar = () => {
      const doc = marco.current?.contentDocument;
      if (doc?.body) setAlto(Math.max(400, doc.body.scrollHeight + 32));
    };
    const t = window.setInterval(ajustar, 600);
    return () => window.clearInterval(t);
  }, [vista, html]);

  if (!resumen) {
    return <p className="panel p-6 text-sm text-muted-foreground">Aún no hay ningún resumen que mostrar.</p>;
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex gap-2 border-b border-border p-3">
        <Boton variante={vista === "html" ? "principal" : "suave"} type="button" onClick={() => setVista("html")}>
          Informe
        </Boton>
        <Boton variante={vista === "texto" ? "principal" : "suave"} type="button" onClick={() => setVista("texto")}>
          Texto
        </Boton>
      </div>
      {vista === "html" ? (
        html ? (
          <iframe
            ref={marco}
            title={resumen.titulo}
            srcDoc={html}
            sandbox=""
            className="w-full bg-white"
            style={{ height: alto }}
          />
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Este resumen no tiene versión ilustrada.</p>
        )
      ) : (
        <div
          className="prosa p-5 text-sm leading-relaxed text-foreground [&_a]:text-primary [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-medium [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2"
          dangerouslySetInnerHTML={{ __html: markdownAHtml(resumen.contenido_md ?? "") }}
        />
      )}
    </section>
  );
}

function Historial({
  resumenes,
  cargando,
  activo,
  alElegir,
}: {
  resumenes: ResumenRow[];
  cargando: boolean;
  activo: string | null;
  alElegir: (id: string) => void;
}) {
  const marcarLeido = useMarcarResumenLeido();
  return (
    <aside className="panel h-fit p-4">
      <h2 className="font-display text-sm font-semibold">Historial</h2>
      {cargando ? (
        <p className="mt-3 text-sm text-muted-foreground">Cargando resúmenes...</p>
      ) : resumenes.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Todavía no se ha generado ninguno.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {resumenes.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  alElegir(r.id);
                  if (!r.leido) marcarLeido.mutate(r.id);
                }}
                className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                  activo === r.id ? "border-primary/50 bg-primary/5" : "border-border bg-surface hover:border-primary/40"
                }`}
              >
                <span className="flex items-center gap-2">
                  {r.tipo === "semanal" ? (
                    <CalendarDays className="size-3.5 text-muted-foreground" />
                  ) : (
                    <Newspaper className="size-3.5 text-muted-foreground" />
                  )}
                  <span className="truncate text-foreground">{r.titulo}</span>
                  {!r.leido ? <span className="ml-auto size-2 rounded-full bg-primary" /> : null}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {r.fecha} · {r.redactado_por === "plantilla" ? "plantilla" : (r.redactado_por ?? "—")} ·{" "}
                  {r.error_envio ? "envío con error" : (r.enviado_por ?? []).length ? "enviado" : "no enviado"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function Configuracion() {
  const { data: config } = useResumenesConfig();
  const guardar = useGuardarResumenesConfig();
  const enviar = useEnviarResumen();
  const generar = useGenerarResumen();
  const { data: ping } = usePingResumenes();
  const { data: fuentes = [] } = useFuentesBandeja();

  const [correo, setCorreo] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");

  React.useEffect(() => {
    setCorreo(config?.correo_destino ?? "");
    setWhatsapp(config?.whatsapp_destino ?? "");
  }, [config?.correo_destino, config?.whatsapp_destino]);

  if (!config) {
    return <p className="panel p-6 text-sm text-muted-foreground">Cargando la configuración de los resúmenes...</p>;
  }

  const canales = config.canales ?? [];
  const incluir = config.incluir ?? {};
  const fuenteWhatsapp = fuentes.find((f) => f.origen === "whatsapp");
  const whatsappListo = Boolean(fuenteWhatsapp?.conectada);

  const cambiar = (cambios: Partial<Omit<typeof config, "user_id">>) => {
    guardar.mutate(
      { id: config.id, cambios },
      { onError: (error) => toast.error((error as Error).message) },
    );
  };

  const alternarCanal = (canal: CanalResumen, activo: boolean) => {
    const siguiente = activo ? [...new Set([...canales, canal])] : canales.filter((c) => c !== canal);
    cambiar({ canales: siguiente });
  };

  const enviarPrueba = async () => {
    try {
      const generado = await generar.mutateAsync({ tipo: "diario", fecha: hoyISO() });
      const r = await enviar.mutateAsync({
        resumenId: generado.id,
        canales: canales.length ? canales : ["correo"],
        ...(correo ? { correo } : {}),
        ...(whatsapp ? { whatsapp } : {}),
      });
      toast.success((r.errores ?? []).length ? `Con avisos: ${(r.errores ?? []).join(", ")}` : "Prueba enviada.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="panel space-y-4 p-4">
        <h2 className="font-display text-sm font-semibold">Cuándo se envía</h2>
        <Interruptor
          etiqueta="Resumen diario (08:00)"
          activo={config.diario_activo}
          alCambiar={(v) => cambiar({ diario_activo: v })}
        />
        <Interruptor
          etiqueta="Informe semanal (lunes, 08:10)"
          activo={config.semanal_activo}
          alCambiar={(v) => cambiar({ semanal_activo: v })}
        />
        <Interruptor
          etiqueta="Redactar la apertura con IA"
          activo={config.usar_ia}
          alCambiar={(v) => cambiar({ usar_ia: v })}
        />
      </section>

      <section className="panel space-y-4 p-4">
        <h2 className="font-display text-sm font-semibold">Por dónde se envía</h2>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={canales.includes("correo")}
              onChange={(e) => alternarCanal("correo", e.target.checked)}
            />
            Correo electrónico
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={canales.includes("whatsapp")}
              onChange={(e) => alternarCanal("whatsapp", e.target.checked)}
            />
            WhatsApp
          </label>
        </div>

        {ping?.canal_correo === "ninguno" ? (
          <Aviso>
            Conecta Gmail en <Link to="/bandeja" className="underline">Bandeja → Fuentes</Link> (con permiso de envío) o
            configura la clave RESEND_API_KEY.
          </Aviso>
        ) : null}
        {canales.includes("whatsapp") && !whatsappListo ? (
          <Aviso>
            WhatsApp Business aún no está configurado. Hazlo en{" "}
            <Link to="/bandeja" className="underline">Bandeja → Fuentes</Link>.
          </Aviso>
        ) : null}

        <Campo etiqueta="Correo de destino">
          <input
            className={claseCampo}
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            onBlur={() => cambiar({ correo_destino: correo.trim() || null })}
            placeholder="tucorreo@ejemplo.com"
          />
        </Campo>
        <Campo etiqueta="Número de WhatsApp" pista="Con prefijo del país, por ejemplo 34600111222.">
          <input
            className={claseCampo}
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={() => cambiar({ whatsapp_destino: whatsapp.trim() || null })}
            placeholder="34600111222"
          />
        </Campo>
        <Boton type="button" onClick={() => void enviarPrueba()} disabled={enviar.isPending || generar.isPending}>
          {enviar.isPending || generar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Enviar prueba ahora
        </Boton>
      </section>

      <section className="panel p-4 xl:col-span-2">
        <h2 className="font-display text-sm font-semibold">Qué incluir</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ETIQUETAS_INCLUIR.map((item) => (
            <label key={String(item.clave)} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={incluir[item.clave] !== false}
                onChange={(e) => cambiar({ incluir: { ...incluir, [item.clave]: e.target.checked } })}
              />
              {item.texto}
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

function Interruptor({
  etiqueta,
  activo,
  alCambiar,
}: {
  etiqueta: string;
  activo: boolean;
  alCambiar: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
      <span>{etiqueta}</span>
      <input type="checkbox" checked={activo} onChange={(e) => alCambiar(e.target.checked)} className="size-4" />
    </label>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Tarjeta compacta para la pantalla de Inicio. */
export function TarjetaResumenHoy() {
  const { data: resumenes = [] } = useResumenes();
  const generar = useGenerarResumen();
  const hoy = hoyISO();
  const deHoy = resumenes.find((r) => r.tipo === "diario" && r.fecha === hoy) ?? null;
  const cifras = deHoy?.datos ?? {};

  return (
    <div className="panel p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
        <FileText className="size-4 text-muted-foreground" /> Resumen de hoy
      </h2>
      {deHoy ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Mini titulo="Atención" valor={cifras.requieren_atencion ?? 0} />
            <Mini titulo="Avisos" valor={(cifras.dominios_con_aviso ?? 0) + (cifras.copias_error ?? 0)} />
            <Mini
              titulo="Novedades"
              valor={(cifras.hallazgos_vigilancia ?? 0) + (cifras.bandeja_pendiente ?? 0)}
            />
            <Mini titulo="Gasto IA" valor={`${(cifras.coste_ia_eur ?? 0).toFixed(2)} €`} />
          </div>
          <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{intro(deHoy)}</p>
          <Link to="/resumenes" className="mt-3 inline-flex text-xs text-primary hover:underline">
            Ver resumen
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {deHoy.enviado_el ? `Enviado ${desde(deHoy.enviado_el)}` : `Creado ${formatoFechaHora(deHoy.creado_el)}`}
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted-foreground">Aún no hay resumen de hoy.</p>
          <Boton
            className="mt-3"
            type="button"
            onClick={() => {
              generar.mutate(
                { tipo: "diario" },
                {
                  onSuccess: () => toast.success("Resumen de hoy generado."),
                  onError: (error) => toast.error((error as Error).message),
                },
              );
            }}
            disabled={generar.isPending}
          >
            {generar.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Generar
          </Boton>
        </>
      )}
    </div>
  );
}

function Mini({ titulo, valor }: { titulo: string; valor: number | string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-2 py-1.5">
      <p className="text-[0.7rem] text-muted-foreground">{titulo}</p>
      <p className="font-display text-sm font-semibold">{valor}</p>
    </div>
  );
}

function intro(resumen: ResumenRow) {
  const md = resumen.contenido_md ?? "";
  for (const bloque of md.split(/\n\s*\n/)) {
    const limpio = bloque.trim();
    if (!limpio || limpio.startsWith("#") || limpio.startsWith("-")) continue;
    return limpio.replace(/[*`]/g, "");
  }
  return "Resumen disponible.";
}
