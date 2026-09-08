import { Download, FileSpreadsheet, FileText, ImageIcon, Paperclip, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Boton } from "@/components/nex/campos";
import { useTrabajo } from "@/components/nex/indicador-trabajo";
import type { PeticionAdjuntoRow } from "@/lib/nex/db-types";
import { supabase } from "@/lib/nex/supabase";
import { cn } from "@/lib/utils";

export const BUCKET_ADJUNTOS = "adjuntos-peticiones";
export const MAXIMO_ADJUNTOS = 5;
export const MAXIMO_BYTES = 20 * 1024 * 1024;

export const TIPOS_ADMITIDOS = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "text/markdown",
  "application/json",
];

export const ACEPTA_ADJUNTOS =
  ".png,.jpg,.jpeg,.webp,.heic,.gif,.pdf,.docx,.xlsx,.csv,.txt,.md,.json,image/*,application/pdf";

/* ------------------------------ Funciones puras ---------------------------- */

/** Nombre sin acentos ni caracteres raros, apto para una ruta de almacenamiento. */
export function sanearNombre(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (limpio || "fichero").slice(-80);
}

export function rutaAdjunto(userId: string, id: string, nombre: string): string {
  return `${userId}/${id}-${sanearNombre(nombre)}`;
}

/** «1,4 MB», «812 kB». */
export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function esImagen(tipo: string): boolean {
  return tipo.startsWith("image/");
}

/** Devuelve el motivo por el que un fichero no se puede adjuntar, o null si vale. */
export function motivoRechazo(fichero: { name: string; size: number; type: string }, yaHay: number): string | null {
  if (yaHay >= MAXIMO_ADJUNTOS) return `Solo puedes adjuntar ${MAXIMO_ADJUNTOS} ficheros.`;
  if (fichero.size > MAXIMO_BYTES) return `«${fichero.name}» pesa más de 20 MB.`;
  const extension = fichero.name.toLowerCase().split(".").pop() ?? "";
  const porExtension = ["png", "jpg", "jpeg", "webp", "heic", "gif", "pdf", "docx", "xlsx", "csv", "txt", "md", "json"];
  if (!TIPOS_ADMITIDOS.includes(fichero.type) && !porExtension.includes(extension))
    return `«${fichero.name}» no es un tipo de fichero admitido.`;
  return null;
}

/** Frase para la IA: qué adjuntos se han tenido en cuenta. */
export function resumenAdjuntos(nombres: string[]): string {
  if (!nombres.length) return "";
  if (nombres.length === 1) return `He revisado el adjunto ${nombres[0]}.`;
  return `He revisado los adjuntos ${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}.`;
}

/* ---------------------------------- Hook ---------------------------------- */

export type ContextoAdjuntos = { conversacionId?: string | null; chatId?: string | null; peticionId?: string | null };

export function useAdjuntos(contexto: ContextoAdjuntos = {}) {
  const [adjuntos, setAdjuntos] = React.useState<PeticionAdjuntoRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [subiendo, setSubiendo] = React.useState(false);
  const { iniciarTrabajo } = useTrabajo();

  const anadir = React.useCallback(
    async (ficheros: File[]) => {
      if (!ficheros.length) return;
      const { data: sesion } = await supabase.auth.getUser();
      const userId = sesion.user?.id;
      if (!userId) {
        setError("Tienes que haber entrado para adjuntar ficheros.");
        return;
      }
      const validos: File[] = [];
      let fallo: string | null = null;
      for (const fichero of ficheros) {
        const motivo = motivoRechazo(fichero, adjuntos.length + validos.length);
        if (motivo) fallo = motivo;
        else validos.push(fichero);
      }
      setError(fallo);
      if (!validos.length) return;

      setSubiendo(true);
      const trabajo = iniciarTrabajo({ titulo: "Subiendo adjuntos", pasos: validos.map((f) => f.name) });
      const nuevos: PeticionAdjuntoRow[] = [];
      try {
        for (let i = 0; i < validos.length; i++) {
          const fichero = validos[i]!;
          trabajo.avanzar(fichero.name, Math.round((i / validos.length) * 100));
          const id = crypto.randomUUID();
          const ruta = rutaAdjunto(userId, id, fichero.name);
          const subida = await supabase.storage.from(BUCKET_ADJUNTOS).upload(ruta, fichero, { upsert: false });
          if (subida.error) throw new Error(subida.error.message);
          const fila = await supabase
            .from("peticiones_adjuntos")
            .insert({
              id,
              ruta,
              nombre: fichero.name,
              tipo_mime: fichero.type || "application/octet-stream",
              tamano_bytes: fichero.size,
              ...(contexto.peticionId ? { peticion_id: contexto.peticionId } : {}),
              ...(contexto.conversacionId ? { conversacion_id: contexto.conversacionId } : {}),
              ...(contexto.chatId ? { chat_id: contexto.chatId } : {}),
            })
            .select("*")
            .single();
          if (fila.error) throw new Error(fila.error.message);
          nuevos.push(fila.data as unknown as PeticionAdjuntoRow);
        }
        trabajo.terminar("Adjuntos subidos.");
      } catch (e) {
        trabajo.fallar(e instanceof Error ? e.message : "No se han podido subir los adjuntos.");
        setError(e instanceof Error ? e.message : "No se han podido subir los adjuntos.");
      } finally {
        setSubiendo(false);
        if (nuevos.length) setAdjuntos((lista) => [...lista, ...nuevos]);
      }
    },
    [adjuntos.length, contexto.chatId, contexto.conversacionId, contexto.peticionId, iniciarTrabajo],
  );

  const quitar = React.useCallback(async (adjunto: PeticionAdjuntoRow) => {
    setAdjuntos((lista) => lista.filter((a) => a.id !== adjunto.id));
    await supabase.storage.from(BUCKET_ADJUNTOS).remove([adjunto.ruta]);
    const { error: fallo } = await supabase.from("peticiones_adjuntos").delete().eq("id", adjunto.id);
    if (fallo) toast.error(fallo.message);
  }, []);

  const limpiar = React.useCallback(() => setAdjuntos([]), []);

  /** Enlaza los adjuntos con la petición o borrador recién creado. */
  const vincular = React.useCallback(
    async (peticionId: string) => {
      const ids = adjuntos.map((a) => a.id);
      if (!ids.length) return;
      await supabase.from("peticiones_adjuntos").update({ peticion_id: peticionId }).in("id", ids);
    },
    [adjuntos],
  );

  return {
    adjuntos,
    ids: adjuntos.map((a) => a.id),
    error,
    subiendo,
    anadir,
    quitar,
    limpiar,
    vincular,
  };
}

/* ------------------------------- Componentes ------------------------------- */

export function BotonAdjuntar({
  onFicheros,
  disabled,
}: {
  onFicheros: (ficheros: File[]) => void;
  disabled?: boolean;
}) {
  const entrada = React.useRef<HTMLInputElement | null>(null);
  return (
    <>
      <Boton
        type="button"
        variante="suave"
        disabled={disabled}
        onClick={() => entrada.current?.click()}
        className="px-3 py-1.5 text-xs"
      >
        <Paperclip className="size-3.5" /> Adjuntar
      </Boton>
      <input
        ref={entrada}
        type="file"
        multiple
        aria-label="Adjuntar ficheros"
        accept={ACEPTA_ADJUNTOS}
        className="hidden"
        onChange={(e) => {
          onFicheros(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </>
  );
}

function IconoTipo({ tipo }: { tipo: string }) {
  if (esImagen(tipo)) return <ImageIcon className="size-4 text-muted-foreground" />;
  if (tipo.includes("sheet") || tipo.includes("csv")) return <FileSpreadsheet className="size-4 text-muted-foreground" />;
  return <FileText className="size-4 text-muted-foreground" />;
}

function useUrlFirmada(ruta: string) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let vivo = true;
    void supabase.storage
      .from(BUCKET_ADJUNTOS)
      .createSignedUrl(ruta, 3600)
      .then(({ data }) => {
        if (vivo) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      vivo = false;
    };
  }, [ruta]);
  return url;
}

function FichaAdjunto({ adjunto, onQuitar }: { adjunto: PeticionAdjuntoRow; onQuitar?: () => void }) {
  const url = useUrlFirmada(adjunto.ruta);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5">
      {esImagen(adjunto.tipo_mime) && url ? (
        <a href={url} target="_blank" rel="noreferrer" title="Vista previa">
          <img src={url} alt={adjunto.nombre} className="size-9 rounded object-cover" />
        </a>
      ) : (
        <IconoTipo tipo={adjunto.tipo_mime} />
      )}
      <span className="min-w-0">
        <span className="block max-w-[12rem] truncate text-xs text-foreground">{adjunto.nombre}</span>
        <span className="block text-[11px] text-muted-foreground">{tamanoLegible(adjunto.tamano_bytes)}</span>
      </span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" aria-label="Descargar" className="text-muted-foreground hover:text-foreground">
          <Download className="size-3.5" />
        </a>
      ) : null}
      {onQuitar ? (
        <button type="button" onClick={onQuitar} aria-label="Quitar" className="text-muted-foreground hover:text-destructive">
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function ListaAdjuntos({
  adjuntos,
  onQuitar,
}: {
  adjuntos: PeticionAdjuntoRow[];
  onQuitar?: (a: PeticionAdjuntoRow) => void;
}) {
  if (!adjuntos.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {adjuntos.map((a) => (
        <FichaAdjunto key={a.id} adjunto={a} {...(onQuitar ? { onQuitar: () => onQuitar(a) } : {})} />
      ))}
    </div>
  );
}

/** Zona para arrastrar y pegar ficheros alrededor de un campo de texto. */
export function ZonaAdjuntos({
  onFicheros,
  children,
  className,
}: {
  onFicheros: (ficheros: File[]) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [encima, setEncima] = React.useState(false);
  return (
    <div
      className={cn("rounded-lg border border-dashed p-2 transition", encima ? "border-primary bg-primary/5" : "border-transparent", className)}
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        onFicheros(Array.from(e.dataTransfer.files ?? []));
      }}
      onPaste={(e) => {
        const ficheros = Array.from(e.clipboardData?.files ?? []);
        if (ficheros.length) {
          e.preventDefault();
          onFicheros(ficheros);
        }
      }}
    >
      {children}
      <p className="mt-1 text-[11px] text-muted-foreground">Pega una captura o arrastra ficheros aquí</p>
    </div>
  );
}
