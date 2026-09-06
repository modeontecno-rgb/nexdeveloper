import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Copy,
  ExternalLink,
  Eye,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Sparkles,
  Store,
  Trash2,
} from "lucide-react";
import QRCode from "qrcode";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, Selector, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type {
  EstadoPeticionPortal,
  MarcaPortal,
  PortalPeticionRow,
  ProyectoRow,
  SeccionesPortal,
} from "@/lib/nex/db-types";
import { formatoFecha, formatoFechaHora } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  ESTADOS_PETICION,
  ETIQUETA_ESTADO_PETICION,
  ETIQUETA_TIPO_PETICION,
  SECCIONES_PORTAL,
  TONO_ESTADO_PETICION,
  type DatosPortal,
  type PortalConProyecto,
  peticionesNuevas,
  portalCaducado,
  urlPortal,
  useActualizarPortal,
  useBorrarPortal,
  useCrearPortal,
  useEstadoModoCliente,
  usePeticionesPortal,
  useRealtimePortal,
  useRegenerarToken,
  useResponderPeticion,
} from "@/lib/nex/queries/portal-cliente";

const DESCRIPCION =
  "Portales públicos de solo lectura para tus clientes: versión, novedades, documentos y sus peticiones.";

export const Route = createFileRoute("/modo-cliente")({
  head: () => ({
    meta: [
      { title: "Modo cliente · NexDeveloper" },
      { name: "description", content: DESCRIPCION },
      { property: "og:title", content: "Modo cliente · NexDeveloper" },
      { property: "og:description", content: DESCRIPCION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaModoCliente,
});

function copiar(texto: string, aviso = "Copiado al portapapeles.") {
  void navigator.clipboard.writeText(texto).then(
    () => toast.success(aviso),
    () => toast.error("No se ha podido copiar."),
  );
}

function Chip({ children, tono }: { children: React.ReactNode; tono: string }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${tono}`}>{children}</span>;
}

/* ------------------------------- Pantalla -------------------------------- */

function PantallaModoCliente() {
  useRealtimePortal();
  const estado = useEstadoModoCliente();
  const { data: peticiones = [] } = usePeticionesPortal();
  const [pestana, setPestana] = React.useState<"portales" | "peticiones">("portales");
  const [editando, setEditando] = React.useState<PortalConProyecto | null>(null);
  const [nuevo, setNuevo] = React.useState(false);

  const portales = estado.data?.portales ?? [];
  const nuevas = peticionesNuevas(peticiones);

  return (
    <>
      <Encabezado
        titulo="Modo cliente"
        descripcion={DESCRIPCION}
        acciones={
          <Boton onClick={() => setNuevo(true)}>
            <Plus className="size-4" /> Nuevo portal
          </Boton>
        }
      />

      <div className="mb-5 flex gap-2">
        <button
          type="button"
          onClick={() => setPestana("portales")}
          className={`rounded-lg border px-3 py-1.5 text-sm ${pestana === "portales" ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
        >
          <Store className="mr-1.5 inline size-4" /> Portales ({portales.length})
        </button>
        <button
          type="button"
          onClick={() => setPestana("peticiones")}
          className={`rounded-lg border px-3 py-1.5 text-sm ${pestana === "peticiones" ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
        >
          <Inbox className="mr-1.5 inline size-4" /> Peticiones
          {nuevas > 0 ? (
            <span className="ml-1.5 rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">
              {nuevas}
            </span>
          ) : null}
        </button>
      </div>

      {estado.isError ? (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          No se ha podido cargar el modo cliente: {(estado.error as Error).message}
        </p>
      ) : null}

      {pestana === "portales" ? (
        estado.isPending ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : portales.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground">
            Todavía no has creado ningún portal. Crea el primero para que tu cliente pueda ver el estado de su proyecto.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {portales.map((portal) => (
              <TarjetaPortal
                key={portal.id}
                portal={portal}
                nuevas={peticionesNuevas(peticiones, portal.id)}
                onEditar={() => setEditando(portal)}
              />
            ))}
          </div>
        )
      ) : (
        <BandejaPeticiones peticiones={peticiones} portales={portales} />
      )}

      <PanelPortal
        abierto={nuevo || Boolean(editando)}
        portal={editando}
        onCerrar={() => {
          setNuevo(false);
          setEditando(null);
        }}
      />
    </>
  );
}

/* ----------------------------- Tarjeta portal ---------------------------- */

function TarjetaPortal({
  portal,
  nuevas,
  onEditar,
}: {
  portal: PortalConProyecto;
  nuevas: number;
  onEditar: () => void;
}) {
  const regenerar = useRegenerarToken();
  const borrar = useBorrarPortal();
  const actualizar = useActualizarPortal();
  const [verQr, setVerQr] = React.useState(false);
  const url = urlPortal(portal);
  const caducado = portalCaducado(portal);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{portal.nombre_cliente || "Cliente sin nombre"}</p>
          <p className="truncate text-xs text-muted-foreground">{portal.proyectos?.nombre ?? "Proyecto"}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {nuevas > 0 ? (
            <Chip tono="border-destructive/40 bg-destructive/10 text-destructive">{nuevas} nuevas</Chip>
          ) : null}
          {caducado ? (
            <Chip tono="border-warning/40 bg-warning/10 text-warning">Caducado</Chip>
          ) : portal.activo ? (
            <Chip tono="border-success/40 bg-success/10 text-success">Activo</Chip>
          ) : (
            <Chip tono="border-border bg-muted text-muted-foreground">Desactivado</Chip>
          )}
        </div>
      </div>

      <p className="mt-3 truncate rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
        {url}
      </p>

      <p className="mt-2 text-xs text-muted-foreground">
        {portal.visitas ?? 0} visitas
        {portal.ultimo_acceso ? ` · último acceso ${formatoFechaHora(portal.ultimo_acceso)}` : ""}
        {portal.expira_el ? ` · caduca el ${formatoFecha(portal.expira_el)}` : ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Boton variante="suave" onClick={() => copiar(url, "Enlace copiado.")}>
          <Copy className="size-4" /> Copiar
        </Boton>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium hover:border-primary/40"
        >
          <Eye className="size-4" /> Vista previa
        </a>
        <Boton variante="suave" onClick={() => setVerQr(true)}>
          <QrCode className="size-4" /> QR
        </Boton>
        <Boton variante="suave" onClick={onEditar}>
          <Pencil className="size-4" /> Editar
        </Boton>
        <Boton
          variante="suave"
          disabled={regenerar.isPending}
          onClick={() => {
            if (!window.confirm("El enlace anterior dejará de funcionar. ¿Quieres generar uno nuevo?")) return;
            regenerar.mutate(portal.id, {
              onSuccess: () => toast.success("Enlace nuevo generado."),
              onError: (e: Error) => toast.error(e.message),
            });
          }}
        >
          <RefreshCw className="size-4" /> Regenerar enlace
        </Boton>
        <Boton
          variante="suave"
          disabled={actualizar.isPending}
          onClick={() =>
            actualizar.mutate(
              { portal_id: portal.id, activo: !portal.activo },
              { onError: (e: Error) => toast.error(e.message) },
            )
          }
        >
          {portal.activo ? "Desactivar" : "Activar"}
        </Boton>
        <Boton
          variante="peligro"
          disabled={borrar.isPending}
          onClick={() => {
            if (!window.confirm("¿Seguro que quieres borrar este portal?")) return;
            borrar.mutate(portal.id, {
              onSuccess: () => toast.success("Portal borrado."),
              onError: (e: Error) => toast.error(e.message),
            });
          }}
        >
          <Trash2 className="size-4" /> Borrar
        </Boton>
      </div>

      <DialogoQr abierto={verQr} url={url} onCerrar={() => setVerQr(false)} />
    </div>
  );
}

function DialogoQr({ abierto, url, onCerrar }: { abierto: boolean; url: string; onCerrar: () => void }) {
  const [imagen, setImagen] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    void QRCode.toDataURL(url, { width: 320, margin: 1 }).then(
      (dato) => {
        if (vivo) setImagen(dato);
      },
      () => setImagen(null),
    );
    return () => {
      vivo = false;
    };
  }, [abierto, url]);

  return (
    <Dialogo abierto={abierto} titulo="Código QR del portal" descripcion={url} onCerrar={onCerrar} ancho="max-w-sm">
      <div className="flex flex-col items-center gap-3">
        {imagen ? (
          <img src={imagen} alt="Código QR del portal del cliente" className="rounded-lg bg-white p-2" />
        ) : (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        )}
        {imagen ? (
          <a
            href={imagen}
            download="portal-cliente.png"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Descargar imagen
          </a>
        ) : null}
      </div>
    </Dialogo>
  );
}

/* ---------------------------- Panel nuevo/editar -------------------------- */

const MARCA_VACIA: MarcaPortal = {};
const SECCIONES_POR_DEFECTO: SeccionesPortal = {
  version: true,
  cambios: true,
  documentos: true,
  peticiones: true,
  estado: true,
  contacto: true,
};

function PanelPortal({
  abierto,
  portal,
  onCerrar,
}: {
  abierto: boolean;
  portal: PortalConProyecto | null;
  onCerrar: () => void;
}) {
  const { data: proyectos = [] } = useProyectos();
  const crear = useCrearPortal();
  const actualizar = useActualizarPortal();

  const [proyectoId, setProyectoId] = React.useState("");
  const [nombreCliente, setNombreCliente] = React.useState("");
  const [contactoEmail, setContactoEmail] = React.useState("");
  const [marca, setMarca] = React.useState<MarcaPortal>(MARCA_VACIA);
  const [secciones, setSecciones] = React.useState<SeccionesPortal>(SECCIONES_POR_DEFECTO);
  const [expira, setExpira] = React.useState("");

  React.useEffect(() => {
    if (!abierto) return;
    setProyectoId(portal?.proyecto_id ?? proyectos[0]?.id ?? "");
    setNombreCliente(portal?.nombre_cliente ?? "");
    setContactoEmail(portal?.contacto_email ?? "");
    setMarca(portal?.marca ?? MARCA_VACIA);
    setSecciones(portal?.secciones ?? SECCIONES_POR_DEFECTO);
    setExpira(portal?.expira_el ? portal.expira_el.slice(0, 10) : "");
  }, [abierto, portal, proyectos]);

  const guardando = crear.isPending || actualizar.isPending;

  const guardar = () => {
    const comun = {
      nombre_cliente: nombreCliente || undefined,
      contacto_email: contactoEmail || undefined,
      marca,
      secciones,
      expira_el: expira ? new Date(`${expira}T23:59:59`).toISOString() : null,
    };
    if (portal) {
      actualizar.mutate(
        { portal_id: portal.id, ...comun },
        {
          onSuccess: () => {
            toast.success("Portal actualizado.");
            onCerrar();
          },
          onError: (e: Error) => toast.error(e.message),
        },
      );
      return;
    }
    if (!proyectoId) {
      toast.error("Elige un proyecto.");
      return;
    }
    crear.mutate({ proyecto_id: proyectoId, ...comun } as DatosPortal, {
      onSuccess: (res) => {
        const url = (res as { portal?: { url?: string } }).portal?.url;
        toast.success(url ? `Portal creado: ${url}` : "Portal creado.");
        onCerrar();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <Dialogo
      abierto={abierto}
      titulo={portal ? "Editar portal" : "Nuevo portal del cliente"}
      descripcion="Elige qué ve el cliente y con qué marca lo ve."
      onCerrar={onCerrar}
      ancho="max-w-3xl"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {portal ? null : (
          <Campo etiqueta="Proyecto">
            <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={claseCampo}>
              {proyectos.map((p: ProyectoRow) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo etiqueta="Nombre del cliente">
          <input value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Correo de contacto del cliente">
          <input
            type="email"
            value={contactoEmail}
            onChange={(e) => setContactoEmail(e.target.value)}
            className={claseCampo}
          />
        </Campo>
        <Campo etiqueta="Caduca el" pista="Déjalo vacío para que no caduque.">
          <input type="date" value={expira} onChange={(e) => setExpira(e.target.value)} className={claseCampo} />
        </Campo>
      </div>

      <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Marca del portal</p>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre visible">
          <input
            value={marca.nombre ?? ""}
            onChange={(e) => setMarca({ ...marca, nombre: e.target.value })}
            className={claseCampo}
          />
        </Campo>
        <Campo etiqueta="Color principal">
          <input
            type="color"
            value={marca.color ?? "#5b7cfa"}
            onChange={(e) => setMarca({ ...marca, color: e.target.value })}
            className="h-10 w-full rounded-lg border border-input bg-surface px-1"
          />
        </Campo>
        <Campo etiqueta="Dirección del logotipo">
          <input
            value={marca.logo_url ?? ""}
            onChange={(e) => setMarca({ ...marca, logo_url: e.target.value })}
            className={claseCampo}
          />
        </Campo>
        <Campo etiqueta="Powered by">
          <input
            value={marca.powered_by ?? ""}
            onChange={(e) => setMarca({ ...marca, powered_by: e.target.value })}
            className={claseCampo}
          />
        </Campo>
        <Campo etiqueta="Correo de contacto que ve el cliente">
          <input
            value={marca.email_contacto ?? ""}
            onChange={(e) => setMarca({ ...marca, email_contacto: e.target.value })}
            className={claseCampo}
          />
        </Campo>
        <div className="sm:col-span-2">
          <Campo etiqueta="Mensaje de bienvenida">
            <textarea
              rows={3}
              value={marca.mensaje_bienvenida ?? ""}
              onChange={(e) => setMarca({ ...marca, mensaje_bienvenida: e.target.value })}
              className={claseCampo}
            />
          </Campo>
        </div>
      </div>

      <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Secciones visibles</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {SECCIONES_PORTAL.map(({ clave, texto }) => (
          <label key={clave} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={secciones[clave] !== false}
              onChange={(e) => setSecciones({ ...secciones, [clave]: e.target.checked })}
            />
            {texto}
          </label>
        ))}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Boton variante="suave" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 className="size-4 animate-spin" /> : null}
          {portal ? "Guardar cambios" : "Crear portal"}
        </Boton>
      </div>
    </Dialogo>
  );
}

/* ---------------------------- Bandeja peticiones -------------------------- */

function BandejaPeticiones({
  peticiones,
  portales,
}: {
  peticiones: PortalPeticionRow[];
  portales: PortalConProyecto[];
}) {
  if (peticiones.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground">
        Todavía no has recibido peticiones de clientes.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {peticiones.map((peticion) => (
        <FilaPeticion
          key={peticion.id}
          peticion={peticion}
          portal={portales.find((p) => p.id === peticion.portal_id) ?? null}
        />
      ))}
    </div>
  );
}

function FilaPeticion({ peticion, portal }: { peticion: PortalPeticionRow; portal: PortalConProyecto | null }) {
  const responder = useResponderPeticion();
  const [respuesta, setRespuesta] = React.useState(peticion.respuesta ?? "");

  const enviar = (extra: { estado?: EstadoPeticionPortal; crear_orden?: boolean } = {}) => {
    responder.mutate(
      { peticion_id: peticion.id, respuesta: respuesta.trim() || undefined, ...extra },
      {
        onSuccess: () => toast.success("Petición actualizada."),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{portal?.proyectos?.nombre ?? "Proyecto"}</span>
        <span>· {portal?.nombre_cliente ?? "Cliente"}</span>
        <Chip tono="border-border bg-muted text-muted-foreground">{ETIQUETA_TIPO_PETICION[peticion.tipo]}</Chip>
        <Chip tono={TONO_ESTADO_PETICION[peticion.estado]}>{ETIQUETA_ESTADO_PETICION[peticion.estado]}</Chip>
        <span>{formatoFechaHora(peticion.creado_el)}</span>
        {peticion.contacto ? <span>· {peticion.contacto}</span> : null}
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm">{peticion.texto}</p>

      <textarea
        rows={2}
        value={respuesta}
        onChange={(e) => setRespuesta(e.target.value)}
        placeholder="Respuesta para el cliente (la verá en su portal)"
        className={`${claseCampo} mt-3`}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Selector
          etiqueta="Estado"
          valor={peticion.estado}
          onChange={(v) => enviar({ estado: v as EstadoPeticionPortal })}
          opciones={ESTADOS_PETICION.map((e) => ({ valor: e.valor, texto: e.texto }))}
        />
        <Boton variante="suave" disabled={responder.isPending} onClick={() => enviar()}>
          Guardar respuesta
        </Boton>
        <Boton
          variante="suave"
          disabled={responder.isPending}
          onClick={() => enviar({ crear_orden: true, estado: "en_curso" })}
        >
          <Sparkles className="size-4" /> Convertir en orden para la IA
        </Boton>
        {peticion.tarea_id ? (
          <Link to="/cola" className="text-xs text-primary underline-offset-2 hover:underline">
            Ver la tarea
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------- Piezas para otras pantallas ------------------------ */

/** Tarjeta «Portal del cliente» para la ficha del proyecto. */
export function TarjetaPortalProyecto({ proyecto }: { proyecto: ProyectoRow }) {
  const estado = useEstadoModoCliente();
  const portal = (estado.data?.portales ?? []).find((p) => p.proyecto_id === proyecto.id) ?? null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-medium">Portal del cliente</p>
      {portal ? (
        <>
          <p className="mt-2 truncate rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
            {urlPortal(portal)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton variante="suave" onClick={() => copiar(urlPortal(portal), "Enlace copiado.")}>
              <Copy className="size-4" /> Copiar enlace
            </Boton>
            <a
              href={urlPortal(portal)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium hover:border-primary/40"
            >
              <ExternalLink className="size-4" /> Abrir
            </a>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Este proyecto todavía no tiene un portal para su cliente.
          </p>
          <Link
            to="/modo-cliente"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="size-4" /> Crear portal
          </Link>
        </>
      )}
    </div>
  );
}

/** Contador de peticiones nuevas para el Panel principal. */
export function ContadorPeticionesClientes() {
  const { data: peticiones = [] } = usePeticionesPortal();
  const nuevas = peticionesNuevas(peticiones);
  if (nuevas === 0) return null;
  return (
    <Link
      to="/modo-cliente"
      className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
    >
      <span className="flex items-center gap-2">
        <Inbox className="size-4" />
        {nuevas === 1 ? "1 petición nueva de un cliente" : `${nuevas} peticiones nuevas de clientes`}
      </span>
      <span className="text-xs underline-offset-2 hover:underline">Ver</span>
    </Link>
  );
}
