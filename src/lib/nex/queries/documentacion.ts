import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CierreVersionRow, DocumentoNexRow, TipoDocumentoNex } from "../db-types";
import { supabase } from "../supabase";

export const clavesDocumentacion = {
  cierres: ["cierres_version"] as const,
  documentos: ["documentos_nex"] as const,
  documentosProyecto: (proyectoId: string) => ["documentos_proyectian", proyectoId] as const,
  ping: ["documentar_ping"] as const,
};

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("documentar", { body: cuerpo });
  const respuesta = (data ?? null) as ({ ok?: boolean; error?: string } & T) | null;
  if (error) {
    let mensaje = (error as Error).message ?? "No se ha podido completar la operación.";
    const http = (error as unknown as { context?: Response }).context;
    if (http && typeof http.json === "function") {
      try {
        const cuerpoError = (await http.clone().json()) as { error?: string };
        if (cuerpoError?.error) mensaje = cuerpoError.error;
      } catch {
        /* sin cuerpo JSON */
      }
    }
    throw new Error(mensaje);
  }
  if (!respuesta || respuesta.ok === false) {
    throw new Error(respuesta?.error ?? "No se ha podido completar la operación.");
  }
  return respuesta;
}

export type PingDocumentar = { ok?: boolean; almacen?: boolean; proyectian?: boolean; github?: boolean };

export function usePingDocumentar(habilitado = true) {
  return useQuery({
    queryKey: clavesDocumentacion.ping,
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("documentar", { body: {} });
      if (error) throw new Error(error.message);
      return (data ?? {}) as PingDocumentar;
    },
  });
}

export function useCierresVersion() {
  return useQuery({
    queryKey: clavesDocumentacion.cierres,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cierres_version")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as CierreVersionRow[];
    },
  });
}

/** Documentos registrados desde NexDeveloper (tabla local). */
export function useDocumentosNex(proyectoId?: string) {
  return useQuery({
    queryKey: [...clavesDocumentacion.documentos, proyectoId ?? "todos"],
    queryFn: async () => {
      let consulta = supabase.from("documentos_nex").select("*").order("creado_el", { ascending: false }).limit(200);
      if (proyectoId) consulta = consulta.eq("proyecto_id", proyectoId);
      const { data, error } = await consulta;
      if (error) throw new Error(error.message);
      return (data ?? []) as DocumentoNexRow[];
    },
  });
}

export type DocumentoProyectian = {
  origen?:string;
  id: string;
  tipo: TipoDocumentoNex | string;
  titulo: string;
  version: string | null;
  fecha: string | null;
  ruta_mac: string | null;
  ruta_remota: string | null;
  archivo_path: string | null;
  bytes: number | null;
};

/** Documentos del proyecto según el almacén y Proyectian. */
export function useDocumentosProyecto(proyectoId: string | null) {
  return useQuery({
    queryKey: clavesDocumentacion.documentosProyecto(proyectoId ?? "-"),
    enabled: Boolean(proyectoId),
    queryFn: async () => {
      const r = await llamar<{ documentos?: DocumentoProyectian[] }>({
        accion: "listar_documentos",
        proyecto_id: proyectoId,
      });
      return r.documentos ?? [];
    },
  });
}

export function usePrepararCierre() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { proyecto_id: string; version?: string; sin_ia?: boolean }) =>
      llamar<{ cierre: CierreVersionRow; material_lineas?: number }>({ accion: "preparar_cierre", ...input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesDocumentacion.cierres });
    },
  });
}

export type DatosCierre = Pick<
  CierreVersionRow,
  "titulo" | "resumen" | "cambios" | "tecnico" | "como_probar" | "pendiente_usuario"
>;

export type ResultadoCierre = {
  ok?: boolean;
  documento_pdf_id?: string;
  avisos?: string[];
  proyectian_ok?: boolean;
  ruta_remota_html?: string | null;
  github_tag?: string | null;
};

export function useCerrarVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cierre_id: string; datos?: DatosCierre; github?: boolean }) =>
      llamar<ResultadoCierre>({ accion: "cerrar_version", ...input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesDocumentacion.cierres });
      void qc.invalidateQueries({ queryKey: clavesDocumentacion.documentos });
      void qc.invalidateQueries({ queryKey: ["proyectos"] });
    },
  });
}

export const LIMITE_SUBIDA_BYTES = 20000000;

export function useSubirDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      proyecto_id: string;
      tipo: TipoDocumentoNex;
      titulo: string;
      version?: string;
      nombre_archivo: string;
      mime: string;
      contenido_base64: string;
    }) => llamar<{ id?: string; ruta_remota?: string; aviso?: string }>({ accion: "subir_documento", ...input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesDocumentacion.documentos });
      void qc.invalidateQueries({ queryKey: ["documentos_proyectian"] });
    },
  });
}

export function useEnlaceDescarga() {
  return useMutation({
    mutationFn: (input: { documento_id?:string; ruta_remota?: string; bucket?: string; inline?: boolean }) =>
      llamar<{ url?: string }>({ accion: "enlace_descarga", ...input }),
  });
}

/** Convierte un archivo del navegador en base64 sin la cabecera de datos. */
export function archivoABase64(archivo: File) {
  return new Promise<string>((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error("No se ha podido leer el archivo."));
    lector.onload = () => {
      const texto = String(lector.result ?? "");
      resolver(texto.slice(texto.indexOf(",") + 1));
    };
    lector.readAsDataURL(archivo);
  });
}

/** Versión siguiente propuesta a partir de la actual (x.y+1.0). */
export function siguienteVersion(actual: string | null | undefined) {
  if (!actual) return "0.1.0";
  const partes = actual.replace(/^v/i, "").split(".").map((n) => Number(n) || 0);
  const mayor = partes[0] ?? 0;
  const menor = partes[1] ?? 0;
  return `${mayor}.${menor + 1}.0`;
}

/** Abre un documento HTML en una ventana nueva y lanza la impresión. */
export function imprimirHoja(html: string) {
  const ventana = window.open("", "_blank");
  if (!ventana) return false;
  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
  window.setTimeout(() => ventana.print(), 400);
  return true;
}

export function tamanoLegible(bytes: number | null | undefined) {
  if (!bytes) return "—";
  const unidades = ["B", "KB", "MB", "GB"];
  let valor = bytes;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i += 1;
  }
  return `${valor.toFixed(valor >= 10 || i === 0 ? 0 : 1)} ${unidades[i]}`;
}
