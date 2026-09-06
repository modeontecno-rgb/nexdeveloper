import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Image as Imagen, Loader2, Printer, RefreshCw, Save, SpellCheck } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando } from "@/components/nex/badges";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import type { CapituloManual, ManualRow } from "@/lib/nex/db-types";
import { formatoEuros } from "@/lib/nex/labels";
import {
  ETIQUETA_ESTADO_MANUAL,
  ETIQUETA_PUBLICO_MANUAL,
  abrirHtml,
  capitulosOrdenados,
  descargarMarkdown,
  useEditarCapitulo,
  useEnlaceManual,
  useManual,
  useRealtimeManuales,
  useRegenerarCapitulo,
  useRevisarManual,
} from "@/lib/nex/queries/manuales";
import { markdownAHtml } from "@/lib/nex/queries/resumenes";
import { InsigniaRevision, LineaPasos } from "@/routes/manuales";

export const Route = createFileRoute("/manuales_/$manualId")({
  head: () => ({
    meta: [
      { title: "Editar manual · NexDeveloper" },
      { name: "description", content: "Revisa y ajusta los capítulos del manual antes de publicarlo o imprimirlo." },
      { property: "og:title", content: "Editar manual · NexDeveloper" },
      { property: "og:description", content: "Revisa y ajusta los capítulos del manual antes de publicarlo o imprimirlo." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditorManual,
});

function EditorManual() {
  const { manualId } = Route.useParams();
  const { data: manual, isPending } = useManual(manualId);
  const enlace = useEnlaceManual();
  const revisar = useRevisarManual();
  useRealtimeManuales(true);

  if (isPending) return <Cargando texto="Cargando el manual..." />;
  if (!manual) {
    return (
      <div className="panel p-6 text-sm text-muted-foreground">
        No se encuentra este manual.{" "}
        <Link to="/manuales" className="text-primary hover:underline">
          Volver a Manuales
        </Link>
      </div>
    );
  }

  const ver = async (imprimir = false) => {
    if (manual.html) {
      if (!abrirHtml(manual.html, imprimir)) toast.error("El navegador ha bloqueado la ventana nueva.");
      if (imprimir) toast.info("En el diálogo de impresión elige «Guardar como PDF».");
      return;
    }
    const r = await enlace.mutateAsync({ manualId: manual.id, formato: "html" });
    if (r.url) window.open(r.url, "_blank", "noopener");
  };

  const bajarMarkdown = async () => {
    if (manual.markdown) {
      descargarMarkdown(manual.titulo, manual.markdown);
      return;
    }
    const r = await enlace.mutateAsync({ manualId: manual.id, formato: "md" });
    if (r.url) window.open(r.url, "_blank", "noopener");
  };

  const capitulos = capitulosOrdenados(manual);

  return (
    <div>
      <Encabezado
        titulo={manual.titulo}
        descripcion={`${ETIQUETA_PUBLICO_MANUAL[manual.publico]}${manual.version_proyecto ? ` · versión ${manual.version_proyecto}` : ""}${
          typeof manual.coste === "number" ? ` · ${formatoEuros(manual.coste)}` : ""
        } · ${ETIQUETA_ESTADO_MANUAL[manual.estado]}`}
        acciones={
          <>
            <Link
              to="/manuales"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium transition hover:border-primary/40"
            >
              <ArrowLeft className="size-4" />
              Manuales
            </Link>
            <Boton variante="suave" onClick={() => revisar.mutate(manual.id)} disabled={revisar.isPending}>
              {revisar.isPending ? <Loader2 className="size-4 animate-spin" /> : <SpellCheck className="size-4" />}
              Revisar redacción
            </Boton>
            <Boton variante="suave" onClick={() => void ver()}>
              Ver
            </Boton>
            <Boton variante="suave" onClick={() => void ver(true)}>
              <Printer className="size-4" />
              PDF
            </Boton>
            <Boton variante="suave" onClick={() => void bajarMarkdown()}>
              <Download className="size-4" />
              Markdown
            </Boton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <InsigniaRevision manual={manual} />
      </div>

      {manual.estado !== "listo" ? (
        <div className="panel mb-4 p-4">
          <LineaPasos manual={manual} />
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-4">
          <h2 className="font-display text-sm font-semibold">Vista previa</h2>
          {manual.html ? (
            <iframe
              title="Vista previa del manual"
              className="mt-3 h-[40rem] w-full rounded-lg border border-border bg-white"
              srcDoc={manual.html}
            />
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Todavía no hay documento compuesto.</p>
          )}
        </div>

        <div className="space-y-3">
          {capitulos.map((c) => (
            <TarjetaCapitulo key={c.orden} manual={manual} capitulo={c} />
          ))}
          {capitulos.length === 0 ? (
            <p className="panel p-6 text-sm text-muted-foreground">Todavía no hay capítulos redactados.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TarjetaCapitulo({ manual, capitulo }: { manual: ManualRow; capitulo: CapituloManual }) {
  const guardar = useEditarCapitulo();
  const regenerar = useRegenerarCapitulo();
  const [titulo, setTitulo] = React.useState(capitulo.titulo ?? "");
  const [texto, setTexto] = React.useState(capitulo.texto_md ?? "");
  const [captura, setCaptura] = React.useState(capitulo.captura_url ?? "");
  const [previa, setPrevia] = React.useState(false);

  React.useEffect(() => {
    setTitulo(capitulo.titulo ?? "");
    setTexto(capitulo.texto_md ?? "");
    setCaptura(capitulo.captura_url ?? "");
  }, [capitulo.titulo, capitulo.texto_md, capitulo.captura_url]);

  return (
    <article className="panel space-y-3 p-4">
      <div className="flex items-start gap-3">
        {capitulo.captura_url ? (
          <img
            src={capitulo.captura_url}
            alt={`Captura del capítulo ${capitulo.titulo}`}
            loading="lazy"
            className="h-16 w-24 shrink-0 rounded-md border border-border object-cover"
          />
        ) : (
          <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
            <Imagen className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Capítulo {capitulo.orden}</p>
          <p className="truncate text-sm font-medium">{capitulo.titulo}</p>
          {capitulo.ruta ? <p className="truncate text-xs text-muted-foreground">{capitulo.ruta}</p> : null}
          <span
            className={
              capitulo.revisado
                ? "mt-1 inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs text-success"
                : "mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            }
          >
            <span className="size-1.5 rounded-full bg-current" />
            {capitulo.revisado ? "Revisado" : "Sin revisar"}
          </span>
        </div>
      </div>

      <Campo etiqueta="Título del capítulo">
        <input className={claseCampo} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </Campo>
      <Campo etiqueta="Dirección de la captura">
        <input className={claseCampo} value={captura} onChange={(e) => setCaptura(e.target.value)} placeholder="https://…" />
      </Campo>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Texto del capítulo</p>
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => setPrevia((v) => !v)}>
            {previa ? "Editar" : "Vista previa"}
          </button>
        </div>
        {previa ? (
          <div
            className="prose-nex mt-1.5 max-h-72 overflow-auto rounded-lg border border-border bg-surface p-3 text-sm"
            dangerouslySetInnerHTML={{ __html: markdownAHtml(texto) }}
          />
        ) : (
          <textarea className={`${claseCampo} mt-1.5 min-h-40`} value={texto} onChange={(e) => setTexto(e.target.value)} />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Boton
          onClick={() =>
            guardar.mutate({
              manualId: manual.id,
              orden: capitulo.orden,
              titulo,
              textoMd: texto,
              capturaUrl: captura,
            })
          }
          disabled={guardar.isPending}
        >
          {guardar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar
        </Boton>
        <Boton
          variante="suave"
          onClick={() =>
            regenerar.mutate({
              manualId: manual.id,
              orden: capitulo.orden,
              titulo,
              ...(capitulo.objetivo ? { objetivo: capitulo.objetivo } : {}),
            })
          }
          disabled={regenerar.isPending}
        >
          {regenerar.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Regenerar este capítulo
        </Boton>
      </div>
    </article>
  );
}
