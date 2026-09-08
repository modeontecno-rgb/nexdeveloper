import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  BookMarked,
  Check,
  Copy,
  Download,
  FileText,
  Github,
  Image as ImagenIcono,
  Loader2,
  Plus,
  Printer,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type {
  CambioVersion,
  CierreVersionRow,
  EstadoCierre,
  ImportanciaCambio,
  TipoCambioVersion,
  TipoDocumentoNex,
} from "@/lib/nex/db-types";
import { formatoFechaHora } from "@/lib/nex/labels";
import { useGenerarManual } from "@/lib/nex/queries/manuales";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  LIMITE_SUBIDA_BYTES,
  archivoABase64,
  imprimirHoja,
  siguienteVersion,
  tamanoLegible,
  useCerrarVersion,
  useCierresVersion,
  useDocumentosProyecto,
  useEnlaceDescarga,
  usePrepararCierre,
  useSubirDocumento,
  type DatosCierre,
  type ResultadoCierre,
} from "@/lib/nex/queries/documentacion";

export const Route = createFileRoute("/documentacion")({
  validateSearch: (search: Record<string, unknown>): {proyecto?:string|undefined;pestana?:"documentos"|undefined} => ({
    pestana: search["pestana"] === "documentos" ? "documentos" as const : undefined,
    proyecto: typeof search["proyecto"] === "string" ? (search["proyecto"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Documentación · NexDeveloper" },
      {
        name: "description",
        content: "Cierra versiones con su hoja de cambios y guarda los documentos de cada proyecto en un solo sitio.",
      },
      { property: "og:title", content: "Documentación · NexDeveloper" },
      {
        property: "og:description",
        content: "Cierra versiones con su hoja de cambios y guarda los documentos de cada proyecto en un solo sitio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaDocumentacion,
});

export const ETIQUETA_TIPO_CAMBIO: Record<TipoCambioVersion, string> = {
  nueva_funcion: "Novedad",
  arreglo: "Arreglo",
  diseno: "Diseño",
  seguridad: "Seguridad",
  rendimiento: "Rendimiento",
  datos: "Datos",
  documentacion: "Documentación",
  despliegue: "Publicación",
  otro: "Otro",
};

const TIPOS_CAMBIO = Object.keys(ETIQUETA_TIPO_CAMBIO) as TipoCambioVersion[];

const ETIQUETA_IMPORTANCIA: Record<ImportanciaCambio, string> = {
  alta: "Importante",
  media: "Normal",
  baja: "Menor",
};

const ETIQUETA_TIPO_DOC: Record<TipoDocumentoNex, string> = {
  hoja_cambios: "Hoja de cambios",
  manual: "Manual",
  comercial: "Comercial",
  informe: "Informe",
  video: "Vídeo",
  imagen: "Imagen",
  otro: "Otro",
};

const TIPOS_DOC = Object.keys(ETIQUETA_TIPO_DOC) as TipoDocumentoNex[];

const ESTADO_CIERRE: Record<EstadoCierre, { texto: string; clase: string }> = {
  borrador: { texto: "Borrador", clase: "border-warning/40 bg-warning/10 text-warning" },
  cerrada: { texto: "Cerrada", clase: "border-success/40 bg-success/10 text-success" },
  error: { texto: "Con error", clase: "border-destructive/40 bg-destructive/10 text-destructive" },
};

function escapar(texto: string) {
  return texto.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

/** Vista previa sencilla de la hoja de cambios antes de cerrarla. */
function hojaPrevia(version: string, proyecto: string, datos: DatosCierre) {
  const lista = (titulo: string, items: string[] | null | undefined) =>
    items && items.length
      ? `<h2>${escapar(titulo)}</h2><ul>${items.map((i) => `<li>${escapar(i)}</li>`).join("")}</ul>`
      : "";
  const cambios = (datos.cambios ?? [])
    .map(
      (c) => `<li><strong>${escapar(c.titulo)}</strong>
        <span class="chip">${escapar(ETIQUETA_TIPO_CAMBIO[c.tipo] ?? c.tipo)}</span>
        <span class="chip">${escapar(ETIQUETA_IMPORTANCIA[c.importancia] ?? c.importancia)}</span>
        ${c.descripcion ? `<p>${escapar(c.descripcion)}</p>` : ""}
        ${c.motivo ? `<p class="motivo">Por qué importa: ${escapar(c.motivo)}</p>` : ""}</li>`,
    )
    .join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapar(proyecto)} ${escapar(version)}</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;color:#16181d;margin:0;padding:32px;line-height:1.55}
h1{font-size:24px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 6px;text-transform:uppercase;letter-spacing:.05em;color:#5b6474}
.version{display:inline-block;border:1px solid #d6dae2;border-radius:999px;padding:2px 10px;font-size:12px;color:#5b6474}
ul{padding-left:18px;margin:6px 0}li{margin-bottom:8px}p{margin:4px 0}
.chip{display:inline-block;border:1px solid #d6dae2;border-radius:999px;padding:0 8px;font-size:11px;color:#5b6474;margin-left:6px}
.motivo{color:#5b6474;font-size:13px}
</style></head><body>
<span class="version">Versión ${escapar(version)}</span>
<h1>${escapar(datos.titulo ?? proyecto)}</h1>
<p>${escapar(datos.resumen ?? "")}</p>
${cambios ? `<h2>Qué cambia</h2><ul>${cambios}</ul>` : ""}
${lista("Cómo probarlo", datos.como_probar)}
${lista("Lo que tienes que hacer tú", datos.pendiente_usuario)}
${lista("Detalle técnico", datos.tecnico)}
</body></html>`;
}

function PantallaDocumentacion() {
  const { proyecto: proyectoBuscado,pestana:pestanaBuscada } = Route.useSearch();
  const [pestana, setPestana] = React.useState<"cerrar" | "historial" | "documentos">(pestanaBuscada??"cerrar");

  return (
    <>
      <Encabezado
        titulo="Documentación"
        descripcion="Cierra cada versión con su hoja de cambios y guarda los documentos de tus proyectos en el almacén propio."

      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["cerrar", "Cerrar versión"],
            ["historial", "Historial de cierres"],
            ["documentos", "Documentos"],
          ] as const
        ).map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            onClick={() => setPestana(clave)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              pestana === clave
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {pestana === "cerrar" ? <PestanaCerrar proyectoInicial={proyectoBuscado} /> : null}
      {pestana === "historial" ? <PestanaHistorial /> : null}
      {pestana === "documentos" ? <PestanaDocumentos proyectoInicial={proyectoBuscado} /> : null}
    </>
  );
}

function PestanaCerrar({ proyectoInicial }: { proyectoInicial?: string | undefined }) {
  const { data: proyectos = [] } = useProyectos();
  const preparar = usePrepararCierre();
  const cerrar = useCerrarVersion();
  const descargarPDF = useEnlaceDescarga();
  const generarManual = useGenerarManual();
  const { data: cierres = [] } = useCierresVersion();

  const [proyectoId, setProyectoId] = React.useState(proyectoInicial ?? "");
  const [version, setVersion] = React.useState("");
  const [borrador, setBorrador] = React.useState<CierreVersionRow | null>(null);
  const [datos, setDatos] = React.useState<DatosCierre>({
    titulo: "",
    resumen: "",
    cambios: [],
    tecnico: [],
    como_probar: [],
    pendiente_usuario: [],
  });
  const conGithub = false;
  const [regenerarManual, setRegenerarManual] = React.useState(false);
  const [confirmando, setConfirmando] = React.useState(false);
  const [resultado, setResultado] = React.useState<ResultadoCierre | null>(null);

  const proyecto = proyectos.find((p) => p.id === proyectoId) ?? null;

  React.useEffect(() => {
    if (!proyectoId && proyectos.length > 0) setProyectoId(proyectoInicial ?? proyectos[0]!.id);
  }, [proyectos, proyectoId, proyectoInicial]);

  React.useEffect(() => {
    setVersion(siguienteVersion(proyecto?.version_actual));
    setBorrador(null);
    setResultado(null);
  }, [proyecto?.id, proyecto?.version_actual]);

  const cargarBorrador = (cierre: CierreVersionRow) => {
    setBorrador(cierre);
    setVersion(cierre.version);
    setDatos({
      titulo: cierre.titulo ?? "",
      resumen: cierre.resumen ?? "",
      cambios: cierre.cambios ?? [],
      tecnico: cierre.tecnico ?? [],
      como_probar: cierre.como_probar ?? [],
      pendiente_usuario: cierre.pendiente_usuario ?? [],
    });
  };

  const borradoresProyecto = cierres.filter((c) => c.proyecto_id === proyectoId && c.estado === "borrador");

  const lanzarPreparar = async () => {
    if (!proyectoId) return;
    setResultado(null);
    try {
      const r = await preparar.mutateAsync({ proyecto_id: proyectoId, ...(version ? { version } : {}) });
      cargarBorrador(r.cierre);
      toast.success(`Borrador preparado con ${r.material_lineas ?? 0} apuntes de material.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const lanzarCierre = async () => {
    if (!borrador) return;
    setConfirmando(false);
    try {
      const r = await cerrar.mutateAsync({ cierre_id: borrador.id, datos, github: conGithub });
      setResultado(r);
      toast.success("Cierre documental guardado.");
      if (regenerarManual && proyectoId) {
        try {
          await generarManual.mutateAsync({
            proyectoId,
            publico: "usuario",
            ...(borrador.version ? { version: borrador.version } : {}),
          });
          toast.success("El manual de usuario se está rehaciendo con la versión nueva.");
        } catch {
          /* el error ya se avisa */
        }
      }
    } catch (err) {
      toast.error((err as Error).message);
      setResultado({ ok: false, avisos: [(err as Error).message] });
    }
  };

  return (
    <section className="space-y-4">
      <div className="panel p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Proyecto">
            <select className={claseCampo} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.version_actual ? ` (${p.version_actual})` : ""}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Versión nueva" pista={proyecto?.version_actual ? `Actual: ${proyecto.version_actual}` : "Sin versión previa"}>
            <input className={claseCampo} value={version} onChange={(e) => setVersion(e.target.value)} />
          </Campo>
          <div className="flex items-end">
            <Boton onClick={() => void lanzarPreparar()} disabled={!proyectoId || preparar.isPending}>
              {preparar.isPending ? <Loader2 className="size-4 animate-spin" /> : <BookMarked className="size-4" />}
              {preparar.isPending ? "Recopilando y redactando…" : "Preparar cierre"}
            </Boton>
          </div>
        </div>
        {borradoresProyecto.length > 0 && !borrador ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Hay {borradoresProyecto.length} borrador(es) sin cerrar de este proyecto.{" "}
            <button type="button" className="text-primary hover:underline" onClick={() => cargarBorrador(borradoresProyecto[0]!)}>
              Retomar el más reciente
            </button>
          </p>
        ) : null}
      </div>

      {borrador ? (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="panel space-y-3 p-4">
              <h2 className="font-display text-sm font-semibold">Borrador de la versión {borrador.version}</h2>
              <Campo etiqueta="Título">
                <input className={claseCampo} value={datos.titulo ?? ""} onChange={(e) => setDatos({ ...datos, titulo: e.target.value })} />
              </Campo>
              <Campo etiqueta="Resumen">
                <textarea
                  className={`${claseCampo} min-h-24`}
                  value={datos.resumen ?? ""}
                  onChange={(e) => setDatos({ ...datos, resumen: e.target.value })}
                />
              </Campo>

              <ListaCambios
                cambios={datos.cambios ?? []}
                onCambiar={(cambios) => setDatos({ ...datos, cambios })}
              />

              <ListaTexto
                titulo="Cómo probarlo"
                valores={datos.como_probar ?? []}
                onCambiar={(v) => setDatos({ ...datos, como_probar: v })}
              />
              <ListaTexto
                titulo="Lo que tienes que hacer tú"
                valores={datos.pendiente_usuario ?? []}
                onCambiar={(v) => setDatos({ ...datos, pendiente_usuario: v })}
              />
              <ListaTexto
                titulo="Detalle técnico"
                valores={datos.tecnico ?? []}
                onCambiar={(v) => setDatos({ ...datos, tecnico: v })}
              />

              <p className="text-sm text-muted-foreground">Este cierre guarda un PDF real. Publicar el producto es un proceso independiente.</p>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={regenerarManual}
                  onChange={(e) => setRegenerarManual(e.target.checked)}
                />
                Regenerar el manual de usuario tras cerrar
              </label>

              <div className="flex flex-wrap gap-2 pt-1">
                <Boton onClick={() => setConfirmando(true)} disabled={cerrar.isPending}>
                  {cerrar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Cerrar versión
                </Boton>
                <Boton
                  variante="suave"
                  onClick={() => {
                    const html = borrador.hoja_html ?? hojaPrevia(borrador.version, proyecto?.nombre ?? "Proyecto", datos);
                    if (!imprimirHoja(html)) toast.error("El navegador ha bloqueado la ventana nueva.");
                  }}
                >
                  <Printer className="size-4" />
                  Imprimir vista previa
                </Boton>
              </div>
            </div>

            <div className="panel p-4">
              <h2 className="font-display text-sm font-semibold">Vista previa de la hoja</h2>
              <iframe
                title="Vista previa de la hoja de cambios"
                className="mt-3 h-[32rem] w-full rounded-lg border border-border bg-white"
                srcDoc={borrador.hoja_html ?? hojaPrevia(borrador.version, proyecto?.nombre ?? "Proyecto", datos)}
              />
            </div>
          </div>

          {resultado ? (
            <div className="panel space-y-2 p-4">
              <h2 className="font-display text-sm font-semibold">Resultado del cierre</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                <Paso ok={Boolean(resultado.documento_pdf_id)} texto="PDF guardado" />
                {resultado.documento_pdf_id?<Boton variante="suave" disabled={descargarPDF.isPending} onClick={async()=>{if(!resultado.documento_pdf_id)return;try{const r=await descargarPDF.mutateAsync({documento_id:resultado.documento_pdf_id});if(r.url)window.open(r.url,'_blank','noopener,noreferrer');}catch(e){toast.error((e as Error).message);}}}>Descargar PDF</Boton>:null}
              </div>
              {(resultado.avisos ?? []).length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-warning">
                  {(resultado.avisos ?? []).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              ) : null}
              {resultado.github_tag && proyecto?.repositorio ? (
                <a
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  href={`${proyecto.repositorio.replace(/\.git$/, "")}/releases/tag/${resultado.github_tag}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Github className="size-4" />
                  Ver en GitHub
                </a>
              ) : null}
            </div>
          ) : null}

          <Dialogo
            abierto={confirmando}
            titulo="Cerrar la versión"
            descripcion="Se guardará un PDF en el almacén privado de NexDeveloper y quedará registrado el cierre documental."
            onCerrar={() => setConfirmando(false)}
            ancho="max-w-md"
          >
            <p className="text-sm text-muted-foreground">
              Se generará la hoja de cambios de la versión {borrador.version}
              y quedará disponible en Documentos.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Boton variante="suave" onClick={() => setConfirmando(false)}>
                Cancelar
              </Boton>
              <Boton onClick={() => void lanzarCierre()}>Sí, cerrar versión</Boton>
            </div>
          </Dialogo>
        </>
      ) : null}
    </section>
  );
}

function Paso({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
        ok ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"
      }`}
    >
      {ok ? <Check className="size-3" /> : <X className="size-3" />}
      {texto}
    </span>
  );
}

function ListaCambios({ cambios, onCambiar }: { cambios: CambioVersion[]; onCambiar: (c: CambioVersion[]) => void }) {
  const actualizar = (i: number, parcial: Partial<CambioVersion>) =>
    onCambiar(cambios.map((c, idx) => (idx === i ? { ...c, ...parcial } : c)));
  const mover = (i: number, delta: number) => {
    const destino = i + delta;
    if (destino < 0 || destino >= cambios.length) return;
    const copia = [...cambios];
    const [fila] = copia.splice(i, 1);
    copia.splice(destino, 0, fila!);
    onCambiar(copia);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Cambios de esta versión</p>
        <Boton
          variante="suave"
          onClick={() => onCambiar([...cambios, { tipo: "nueva_funcion", titulo: "", descripcion: "", motivo: "", importancia: "media" }])}
        >
          <Plus className="size-4" />
          Añadir
        </Boton>
      </div>
      <div className="mt-2 space-y-3">
        {cambios.map((c, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-md border border-input bg-surface px-2 py-1 text-xs"
                value={c.tipo}
                onChange={(e) => actualizar(i, { tipo: e.target.value as TipoCambioVersion })}
              >
                {TIPOS_CAMBIO.map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETA_TIPO_CAMBIO[t]}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-input bg-surface px-2 py-1 text-xs"
                value={c.importancia}
                onChange={(e) => actualizar(i, { importancia: e.target.value as ImportanciaCambio })}
              >
                {(["alta", "media", "baja"] as ImportanciaCambio[]).map((v) => (
                  <option key={v} value={v}>
                    {ETIQUETA_IMPORTANCIA[v]}
                  </option>
                ))}
              </select>
              <div className="ml-auto flex gap-1 text-muted-foreground">
                <button type="button" aria-label="Subir" onClick={() => mover(i, -1)} className="hover:text-foreground">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" aria-label="Bajar" onClick={() => mover(i, 1)} className="hover:text-foreground">
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Quitar"
                  onClick={() => onCambiar(cambios.filter((_, idx) => idx !== i))}
                  className="hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            <input
              className={`${claseCampo} mt-2`}
              placeholder="Título del cambio"
              value={c.titulo}
              onChange={(e) => actualizar(i, { titulo: e.target.value })}
            />
            <textarea
              className={`${claseCampo} mt-2 min-h-16`}
              placeholder="Descripción"
              value={c.descripcion ?? ""}
              onChange={(e) => actualizar(i, { descripcion: e.target.value })}
            />
            <input
              className={`${claseCampo} mt-2`}
              placeholder="Por qué importa"
              value={c.motivo ?? ""}
              onChange={(e) => actualizar(i, { motivo: e.target.value })}
            />
          </div>
        ))}
        {cambios.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay cambios apuntados.</p> : null}
      </div>
    </div>
  );
}

function ListaTexto({
  titulo,
  valores,
  onCambiar,
}: {
  titulo: string;
  valores: string[];
  onCambiar: (v: string[]) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
        <button type="button" className="text-xs text-primary hover:underline" onClick={() => onCambiar([...valores, ""])}>
          Añadir línea
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {valores.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={claseCampo}
              value={v}
              onChange={(e) => onCambiar(valores.map((x, idx) => (idx === i ? e.target.value : x)))}
            />
            <button
              type="button"
              aria-label="Quitar"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onCambiar(valores.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {valores.length === 0 ? <p className="text-sm text-muted-foreground">Sin líneas.</p> : null}
      </div>
    </div>
  );
}

function PestanaHistorial() {
  const { data: cierres = [] } = useCierresVersion();
  const { data: proyectos = [] } = useProyectos();
  const [viendo, setViendo] = React.useState<CierreVersionRow | null>(null);

  const nombre = (id: string) => proyectos.find((p) => p.id === id)?.nombre ?? "Proyecto";

  return (
    <section className="panel overflow-x-auto p-4">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="py-1.5 text-left">Proyecto</th>
            <th className="text-left">Versión</th>
            <th className="text-left">Título</th>
            <th className="text-left">Estado</th>
            <th className="text-left">Proyectian</th>
            <th className="text-left">GitHub</th>
            <th className="text-left">Redactado por</th>
            <th className="text-left">Fecha</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {cierres.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="py-1.5">{nombre(c.proyecto_id)}</td>
              <td>{c.version}</td>
              <td className="max-w-64 truncate">{c.titulo ?? "—"}</td>
              <td>
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${ESTADO_CIERRE[c.estado].clase}`}>
                  {ESTADO_CIERRE[c.estado].texto}
                </span>
              </td>
              <td>{c.proyectian_ok ? <Check className="size-4 text-success" /> : "—"}</td>
              <td>{c.github_tag ?? "—"}</td>
              <td className="text-muted-foreground">{c.redactado_por ?? "—"}</td>
              <td className="text-muted-foreground">{formatoFechaHora(c.cerrada_el ?? c.creado_el)}</td>
              <td className="whitespace-nowrap text-right">
                <button type="button" className="text-primary hover:underline" onClick={() => setViendo(c)} disabled={!c.hoja_html}>
                  Abrir
                </button>
                {c.hoja_html ? (
                  <button
                    type="button"
                    className="ml-3 text-primary hover:underline"
                    onClick={() => {
                      if (!imprimirHoja(c.hoja_html!)) toast.error("El navegador ha bloqueado la ventana nueva.");
                    }}
                  >
                    PDF
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {cierres.length === 0 && (
            <tr>
              <td colSpan={9} className="py-3 text-muted-foreground">
                Todavía no has cerrado ninguna versión.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Dialogo
        abierto={Boolean(viendo)}
        titulo={viendo ? `Hoja de cambios ${viendo.version}` : ""}
        onCerrar={() => setViendo(null)}
        ancho="max-w-4xl"
      >
        <iframe
          title="Hoja de cambios"
          className="h-[32rem] w-full rounded-lg border border-border bg-white"
          srcDoc={viendo?.hoja_html ?? ""}
        />
      </Dialogo>
    </section>
  );
}

function iconoTipo(tipo: string) {
  if (tipo === "video") return Video;
  if (tipo === "imagen") return ImagenIcono;
  return FileText;
}

function PestanaDocumentos({ proyectoInicial }: { proyectoInicial?: string | undefined }) {
  const { data: proyectos = [] } = useProyectos();
  const [proyectoId, setProyectoId] = React.useState(proyectoInicial ?? "");
  React.useEffect(() => {
    if (!proyectoId && proyectos.length > 0) setProyectoId(proyectoInicial ?? proyectos[0]!.id);
  }, [proyectos, proyectoId, proyectoInicial]);

  const { data: documentos = [], isPending,error:errorDocumentos } = useDocumentosProyecto(proyectoId || null);
  const enlace = useEnlaceDescarga();
  const [subiendo, setSubiendo] = React.useState(false);

  const descargar = async (rutaRemota: string) => {
    try {
      const r = await enlace.mutateAsync({ ruta_remota: rutaRemota, bucket: "proyectian" });
      if (r.url) window.open(r.url, "_blank", "noopener");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <section className="space-y-4">
      {errorDocumentos?<p role="alert" className="panel p-4 text-destructive">No se pudieron consultar los documentos. Vuelve a intentarlo.</p>:null}
      <div className="panel flex flex-wrap items-end justify-between gap-3 p-4">
        <Campo etiqueta="Proyecto">
          <select className={claseCampo} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Boton onClick={() => setSubiendo(true)} disabled={!proyectoId}>
          <Upload className="size-4" />
          Subir documento
        </Boton>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {documentos.map((d) => {
          const Icono = iconoTipo(d.tipo);
          return (
            <div key={d.id} className="panel flex gap-3 p-4">
              <Icono className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {d.origen==='proyectian'?'Proyectian · ':'Nex · '}{ETIQUETA_TIPO_DOC[d.tipo as TipoDocumentoNex] ?? d.tipo}
                  {d.version ? ` · ${d.version}` : ""}
                  {d.fecha ? ` · ${formatoFechaHora(d.fecha)}` : ""} · {tamanoLegible(d.bytes)}
                </p>
                {d.ruta_mac ? (
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{d.ruta_mac}</span>
                    <button
                      type="button"
                      aria-label="Copiar ruta"
                      className="shrink-0 hover:text-foreground"
                      onClick={() => {
                        void navigator.clipboard.writeText(d.ruta_mac!);
                        toast.success("Ruta copiada.");
                      }}
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </p>
                ) : null}
                <div className="mt-2">
                  {d.ruta_remota ? (
                    <Boton variante="suave" onClick={() => void descargar(d.ruta_remota!)} disabled={enlace.isPending}>
                      <Download className="size-4" />
                      Descargar
                    </Boton>
                  ) : (
                    <span className="text-xs text-muted-foreground">Solo en el Mac</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!isPending && documentos.length === 0 ? (
          <p className="panel p-6 text-sm text-muted-foreground">Este proyecto todavía no tiene documentos.</p>
        ) : null}
        {isPending ? <p className="panel p-6 text-sm text-muted-foreground">Cargando documentos…</p> : null}
      </div>

      <DialogoSubida abierto={subiendo} proyectoId={proyectoId} onCerrar={() => setSubiendo(false)} />
    </section>
  );
}

function DialogoSubida({
  abierto,
  proyectoId,
  onCerrar,
}: {
  abierto: boolean;
  proyectoId: string;
  onCerrar: () => void;
}) {
  const subir = useSubirDocumento();
  const [tipo, setTipo] = React.useState<TipoDocumentoNex>("manual");
  const [titulo, setTitulo] = React.useState("");
  const [version, setVersion] = React.useState("");
  const [archivo, setArchivo] = React.useState<File | null>(null);
  const [progreso, setProgreso] = React.useState(0);

  React.useEffect(() => {
    if (!abierto) return;
    setTipo("manual");
    setTitulo("");
    setVersion("");
    setArchivo(null);
    setProgreso(0);
  }, [abierto]);

  const lanzar = async () => {
    if (!archivo || !proyectoId) return;
    if (archivo.size > LIMITE_SUBIDA_BYTES) {
      toast.error("El archivo supera el límite de 20 MB.");
      return;
    }
    try {
      setProgreso(20);
      const base64 = await archivoABase64(archivo);
      setProgreso(60);
      const r = await subir.mutateAsync({
        proyecto_id: proyectoId,
        tipo,
        titulo: titulo.trim() || archivo.name,
        ...(version.trim() ? { version: version.trim() } : {}),
        nombre_archivo: archivo.name,
        mime: archivo.type || "application/octet-stream",
        contenido_base64: base64,
      });
      setProgreso(100);
      toast.success(r.aviso ?? "Documento subido.");
      onCerrar();
    } catch (err) {
      setProgreso(0);
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialogo
      abierto={abierto}
      titulo="Subir documento"
      descripcion="Se guarda como archivo privado verificado en Nex. Formatos: PDF, WebM, MP3 y Markdown. El registro se envía a Proyectian mediante el intercambio. Máximo 20 MB."
      onCerrar={onCerrar}
      ancho="max-w-xl"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Tipo">
          <select className={claseCampo} value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumentoNex)}>
            {TIPOS_DOC.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO_DOC[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Versión (opcional)">
          <input className={claseCampo} value={version} onChange={(e) => setVersion(e.target.value)} />
        </Campo>
        <Campo etiqueta="Título">
          <input className={claseCampo} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </Campo>
        <Campo etiqueta="Archivo" pista={archivo ? tamanoLegible(archivo.size) : "Máximo 20 MB"}>
          <input type="file" className={claseCampo} onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
        </Campo>
      </div>
      {progreso > 0 ? (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progreso}%` }} />
        </div>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Boton variante="suave" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton onClick={() => void lanzar()} disabled={!archivo || subir.isPending}>
          {subir.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Subir
        </Boton>
      </div>
    </Dialogo>
  );
}

/** Bloque de la ficha de proyecto: versión actual y últimos documentos. */
export function BloqueVersionDocumentos({ proyectoId, versionActual }: { proyectoId: string; versionActual: string | null }) {
  const { data: documentos = [] } = useDocumentosProyecto(proyectoId);

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Versión y documentos</h2>
        <Link
          to="/documentacion"
          search={{ proyecto: proyectoId }}
          className="text-xs text-primary hover:underline"
        >
          Cerrar versión
        </Link>
      </div>
      <p className="mt-2 text-sm">
        Versión actual: <span className="font-medium">{versionActual ?? "sin versión"}</span>
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {documentos.slice(0, 5).map((d) => (
          <li key={d.id} className="flex items-center gap-2 text-muted-foreground">
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{d.titulo}</span>
            {d.version ? <span className="text-xs">{d.version}</span> : null}
          </li>
        ))}
        {documentos.length === 0 ? <li className="text-muted-foreground">Todavía no hay documentos.</li> : null}
      </ul>
    </div>
  );
}
