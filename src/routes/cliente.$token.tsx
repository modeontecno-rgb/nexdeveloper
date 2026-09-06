import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpenText,
  Check,
  ChevronDown,
  Clapperboard,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  Sparkles,
} from "lucide-react";
import * as React from "react";

import type { TipoPeticionPortal } from "@/lib/nex/db-types";
import { formatoFecha, formatoFechaHora } from "@/lib/nex/labels";
import {
  ETIQUETA_ESTADO_PETICION,
  ETIQUETA_TIPO_PETICION,
  TIPOS_PETICION,
  tamanoLegible,
  useEnviarPeticionPublica,
  usePortalPublico,
} from "@/lib/nex/queries/portal-cliente";

const DESCRIPCION = "Consulta el estado de tu proyecto, sus novedades y tus documentos.";

export const Route = createFileRoute("/cliente/$token")({
  head: () => ({
    meta: [
      { title: "Portal del cliente" },
      { name: "description", content: DESCRIPCION },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Portal del cliente" },
      { property: "og:description", content: DESCRIPCION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalCliente,
});

function PortalCliente() {
  const { token } = Route.useParams();
  const { data, isPending, isError } = usePortalPublico(token);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) return <EnlaceNoDisponible />;

  const color = data.marca?.color || "#5b7cfa";
  const nombreMarca = data.marca?.nombre || data.proyecto?.nombre || "Portal del cliente";

  return (
    <div className="min-h-screen bg-background" style={{ ["--marca" as string]: color }}>
      <header className="border-b border-border" style={{ background: `${color}14` }}>
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6">
          <div className="flex items-center gap-3">
            {data.marca?.logo_url ? (
              <img src={data.marca.logo_url} alt={nombreMarca} className="h-10 w-auto rounded-md object-contain" />
            ) : (
              <span
                className="grid size-10 place-items-center rounded-lg text-white"
                style={{ background: color }}
                aria-hidden
              >
                <Sparkles className="size-5" />
              </span>
            )}
            <div>
              <h1 className="font-display text-xl font-semibold sm:text-2xl">{nombreMarca}</h1>
              {data.proyecto?.nombre ? (
                <p className="text-sm text-muted-foreground">{data.proyecto.nombre}</p>
              ) : null}
            </div>
          </div>
          {data.marca?.mensaje_bienvenida ? (
            <p className="text-sm text-foreground/90">{data.marca.mensaje_bienvenida}</p>
          ) : null}
          {data.proyecto?.descripcion ? (
            <p className="text-sm text-muted-foreground">{data.proyecto.descripcion}</p>
          ) : null}
          {data.proyecto?.url_app ? (
            <a
              href={data.proyecto.url_app}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-white"
              style={{ background: color }}
            >
              <ExternalLink className="size-4" /> Abrir la aplicación
            </a>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        {data.estado ? <BloqueEstado estado={data.estado} /> : null}
        {data.proyecto?.version_actual || (data.versiones && data.versiones.length > 0) ? (
          <BloqueVersiones version={data.proyecto?.version_actual} versiones={data.versiones ?? []} />
        ) : null}
        {data.documentos ? <BloqueDocumentos documentos={data.documentos} /> : null}
        {data.peticiones ? (
          <BloquePeticiones token={token} color={color} peticiones={data.peticiones} />
        ) : null}
        {data.contacto ? <BloqueContacto contacto={data.contacto} color={color} /> : null}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        {data.marca?.powered_by ? <span>Powered by {data.marca.powered_by}</span> : null}
      </footer>
    </div>
  );
}

function EnlaceNoDisponible() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
        <h1 className="font-display text-xl font-semibold">Este enlace no está disponible</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Puede que haya caducado o que se haya sustituido por uno nuevo. Ponte en contacto con la persona que te lo
          envió y te facilitará un enlace actualizado.
        </p>
      </div>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-display text-base font-semibold">{titulo}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const TONO_SEMAFORO: Record<string, string> = {
  verde: "bg-success",
  ambar: "bg-warning",
  rojo: "bg-destructive",
  gris: "bg-muted-foreground",
};

function BloqueEstado({ estado }: { estado: NonNullable<import("@/lib/nex/queries/portal-cliente").DatosPortalPublico["estado"]> }) {
  const tono = TONO_SEMAFORO[estado.semaforo ?? "gris"] ?? "bg-muted-foreground";
  return (
    <Bloque titulo="Estado del servicio">
      <div className="flex items-center gap-3">
        <span className={`size-5 rounded-full ${tono}`} aria-hidden />
        <div>
          <p className="text-sm font-medium">{estado.texto || "Sin información"}</p>
          {estado.comprobado_el ? (
            <p className="text-xs text-muted-foreground">Última comprobación: {formatoFechaHora(estado.comprobado_el)}</p>
          ) : null}
        </div>
      </div>
    </Bloque>
  );
}

function BloqueVersiones({
  version,
  versiones,
}: {
  version?: string | undefined;
  versiones: NonNullable<import("@/lib/nex/queries/portal-cliente").DatosPortalPublico["versiones"]>;
}) {
  const [abierta, setAbierta] = React.useState<string | null>(versiones[0]?.numero ?? null);
  return (
    <Bloque titulo="Versión actual y novedades">
      {version ? (
        <p className="mb-4 text-sm">
          Versión en uso: <span className="font-semibold">{version}</span>
        </p>
      ) : null}
      <div className="space-y-2">
        {versiones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay novedades publicadas.</p>
        ) : null}
        {versiones.map((v, i) => {
          const clave = v.numero ?? String(i);
          const abierto = abierta === clave;
          return (
            <div key={clave} className="rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setAbierta(abierto ? null : clave)}
                aria-expanded={abierto}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="text-sm font-medium">
                  {v.numero ? `Versión ${v.numero}` : "Versión"}
                  {v.titulo ? ` · ${v.titulo}` : ""}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {v.fecha ? formatoFecha(v.fecha) : null}
                  <ChevronDown className={`size-4 transition-transform ${abierto ? "rotate-180" : ""}`} />
                </span>
              </button>
              {abierto ? (
                <div className="space-y-3 border-t border-border px-4 py-3">
                  {v.notas ? <p className="text-sm text-muted-foreground">{v.notas}</p> : null}
                  {(v.cambios ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin cambios detallados.</p>
                  ) : (
                    <ul className="space-y-2">
                      {(v.cambios ?? []).map((c, j) => (
                        <li key={j} className="flex gap-2 text-sm">
                          <Check className="mt-0.5 size-4 shrink-0 text-success" />
                          <span>
                            <span className="font-medium">{c.titulo}</span>
                            {c.descripcion ? (
                              <span className="text-muted-foreground"> — {c.descripcion}</span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Bloque>
  );
}

function iconoDocumento(tipo?: string) {
  if (tipo?.includes("video") || tipo?.includes("demo")) return Clapperboard;
  if (tipo?.includes("manual")) return BookOpenText;
  return FileText;
}

function BloqueDocumentos({
  documentos,
}: {
  documentos: NonNullable<import("@/lib/nex/queries/portal-cliente").DatosPortalPublico["documentos"]>;
}) {
  return (
    <Bloque titulo="Documentos">
      {documentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay documentos disponibles.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {documentos.map((d) => {
            const Icono = iconoDocumento(d.tipo);
            return (
              <div key={d.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                <Icono className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {[d.version ? `v${d.version}` : null, tamanoLegible(d.bytes), formatoFecha(d.creado_el)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {d.url ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      <Download className="size-3.5" /> Ver o descargar
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Bloque>
  );
}

function BloquePeticiones({
  token,
  color,
  peticiones,
}: {
  token: string;
  color: string;
  peticiones: NonNullable<import("@/lib/nex/queries/portal-cliente").DatosPortalPublico["peticiones"]>;
}) {
  const enviar = useEnviarPeticionPublica(token);
  const [tipo, setTipo] = React.useState<TipoPeticionPortal>("peticion");
  const [texto, setTexto] = React.useState("");
  const [contacto, setContacto] = React.useState("");
  const [enviado, setEnviado] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const alEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setError(null);
    enviar.mutate(
      { texto: texto.trim(), tipo, contacto: contacto.trim() || undefined },
      {
        onSuccess: () => {
          setTexto("");
          setEnviado(true);
        },
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  const campo =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

  return (
    <Bloque titulo="¿Necesitas algo?">
      <form onSubmit={alEnviar} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {TIPOS_PETICION.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTipo(t.valor)}
              aria-pressed={tipo === t.valor}
              className="rounded-full border px-3 py-1.5 text-xs font-medium"
              style={
                tipo === t.valor
                  ? { background: color, borderColor: color, color: "#fff" }
                  : undefined
              }
            >
              {t.texto}
            </button>
          ))}
        </div>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          required
          placeholder="Cuéntanos qué necesitas o qué no funciona."
          className={campo}
        />
        <input
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          placeholder="Tu correo o teléfono (opcional)"
          className={campo}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {enviado ? (
          <p className="text-sm text-success">¡Gracias! Hemos recibido tu mensaje y te responderemos pronto.</p>
        ) : null}
        <button
          type="submit"
          disabled={enviar.isPending}
          className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: color }}
        >
          {enviar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Enviar
        </button>
      </form>

      {peticiones.length > 0 ? (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-medium">Lo que nos has enviado</h3>
          {peticiones.map((p) => (
            <div key={p.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border px-2 py-0.5">
                  {ETIQUETA_TIPO_PETICION[p.tipo]}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5">
                  {ETIQUETA_ESTADO_PETICION[p.estado]}
                </span>
                <span>{formatoFecha(p.creado_el)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{p.texto}</p>
              {p.respuesta ? (
                <p className="mt-2 rounded-lg bg-muted p-2 text-sm">
                  <span className="font-medium">Respuesta:</span> {p.respuesta}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </Bloque>
  );
}

function BloqueContacto({
  contacto,
  color,
}: {
  contacto: NonNullable<import("@/lib/nex/queries/portal-cliente").DatosPortalPublico["contacto"]>;
  color: string;
}) {
  if (!contacto.whatsapp_url && !contacto.email) return null;
  return (
    <Bloque titulo="Contacto">
      <div className="flex flex-wrap gap-2">
        {contacto.whatsapp_url ? (
          <a
            href={contacto.whatsapp_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-white"
            style={{ background: color }}
          >
            <MessageCircle className="size-4" /> Escribir por WhatsApp
          </a>
        ) : null}
        {contacto.email ? (
          <a
            href={`mailto:${contacto.email}`}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium"
          >
            <Mail className="size-4" /> {contacto.email}
          </a>
        ) : null}
      </div>
    </Bloque>
  );
}
