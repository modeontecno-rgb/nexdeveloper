import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { TALLER_CALIDAD } from "../calidad-workflow";
import type { OrigenCodigoRepositorio, RepositorioRow, RepositorioSubidaRow } from "../db-types";
import { supabase } from "../supabase";
import { claves } from "./claves";

export const DUENO_GITHUB = "modeontecno-rgb";

/** Archivos que nunca se suben, por seguridad o por ser generados. */
const RUTAS_PROHIBIDAS = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.env[^/]*$/,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.keystore$/i,
];

const PATRONES_CLAVE = [/sk-[A-Za-z0-9]{16,}/, /ghp_[A-Za-z0-9]{16,}/, /service_role/, /-----BEGIN /];

export const MAX_ARCHIVOS_TANDA = 100;
export const MAX_BYTES_TANDA = 20 * 1024 * 1024;

export type ArchivoPreparado = { ruta: string; contenido_base64: string; bytes: number };

export function rutaProhibida(ruta: string) {
  return RUTAS_PROHIBIDAS.some((p) => p.test(ruta));
}

export function contieneClave(texto: string) {
  return PATRONES_CLAVE.some((p) => p.test(texto));
}

function aBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binario = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binario);
}

/** Lee la carpeta elegida y separa lo que se sube de lo que se omite. */
export async function prepararCarpeta(archivos: File[]) {
  const validos: ArchivoPreparado[] = [];
  const omitidos: string[] = [];
  for (const archivo of archivos) {
    const relativa = ((archivo as File & { webkitRelativePath?: string }).webkitRelativePath || archivo.name)
      .split("/")
      .slice(1)
      .join("/");
    const ruta = relativa || archivo.name;
    if (rutaProhibida(ruta)) {
      omitidos.push(ruta);
      continue;
    }
    const buffer = await archivo.arrayBuffer();
    const base64 = aBase64(buffer);
    const texto = archivo.size < 400_000 ? new TextDecoder().decode(buffer) : "";
    if (texto && contieneClave(texto)) {
      omitidos.push(ruta);
      continue;
    }
    validos.push({ ruta, contenido_base64: base64, bytes: archivo.size });
  }
  return { validos, omitidos };
}

/** Trocea en tandas por número de archivos y por tamaño. */
export function trocear(archivos: ArchivoPreparado[]) {
  const tandas: ArchivoPreparado[][] = [];
  let actual: ArchivoPreparado[] = [];
  let bytes = 0;
  for (const a of archivos) {
    if (actual.length >= MAX_ARCHIVOS_TANDA || bytes + a.bytes > MAX_BYTES_TANDA) {
      if (actual.length) tandas.push(actual);
      actual = [];
      bytes = 0;
    }
    actual.push(a);
    bytes += a.bytes;
  }
  if (actual.length) tandas.push(actual);
  return tandas;
}

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("github-repos", { body: cuerpo });
  if (error) throw new Error(error.message);
  const respuesta = data as ({ ok?: boolean; error?: string } & T) | null;
  if (!respuesta || respuesta.ok === false) {
    throw new Error(respuesta?.error ?? "GitHub no ha respondido.");
  }
  return respuesta;
}

export function useRepositorios() {
  return useQuery({
    queryKey: claves.repositorios,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repositorios")
        .select("*")
        .order("creado_el", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as RepositorioRow[];
    },
  });
}

export function useSubidasRepositorio(repositorioId: string | null) {
  return useQuery({
    queryKey: [...claves.repositorioSubidas, repositorioId ?? "ninguno"],
    enabled: Boolean(repositorioId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repositorio_subidas")
        .select("*")
        .eq("repositorio_id", repositorioId!)
        .order("creado_el", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []) as RepositorioSubidaRow[];
    },
  });
}

export function useRepositoriosGithub(habilitado: boolean) {
  return useQuery({
    queryKey: claves.repositoriosGithub,
    enabled: habilitado,
    staleTime: 60_000,
    queryFn: async () => {
      const respuesta = await llamar<{ repositorios: { nombre_completo: string; url: string; privado: boolean }[] }>({
        accion: "listar_github",
      });
      return respuesta.repositorios ?? [];
    },
  });
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: claves.repositorios });
  void queryClient.invalidateQueries({ queryKey: claves.repositorioSubidas });
  void queryClient.invalidateQueries({ queryKey: claves.proyectos });
}

export function useCrearRepositorio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { proyectoId: string; nombre: string; privado: boolean; descripcion: string; version: string }) =>
      llamar<{ url: string; existente: boolean }>({
        accion: "crear",
        proyecto_id: input.proyectoId,
        nombre: input.nombre,
        privado: input.privado,
        descripcion: input.descripcion,
        version: input.version,
        taller: TALLER_CALIDAD,
      }),
    onSuccess: () => invalidar(queryClient),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSubirTanda() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { repositorioId: string; mensaje: string; archivos: ArchivoPreparado[] }) =>
      llamar<{ commit_sha: string | null; url_commit?: string; omitidos: string[] }>({
        accion: "subir_carpeta",
        repositorio_id: input.repositorioId,
        mensaje: input.mensaje,
        archivos: input.archivos.map((a) => ({ ruta: a.ruta, contenido_base64: a.contenido_base64 })),
      }),
    onSuccess: () => invalidar(queryClient),
  });
}

/** Enlaza a un proyecto un repositorio que ya existe en GitHub. */
export function useEnlazarRepositorio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { proyectoId: string; nombreCompleto: string; url: string; privado: boolean }) => {
      const { data: sesion } = await supabase.auth.getUser();
      const userId = sesion.user?.id;
      if (!userId) throw new Error("Debes haber iniciado sesión.");
      const { error } = await supabase.from("repositorios").upsert(
        {
          user_id: userId,
          proyecto_id: input.proyectoId,
          nombre_completo: input.nombreCompleto,
          url: input.url,
          privado: input.privado,
          estado: "creado",
          origen_codigo: "externo",
        },
        { onConflict: "proyecto_id" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidar(queryClient);
      toast.success("Repositorio enlazado al proyecto.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarcarOrigenCodigo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; origen: OrigenCodigoRepositorio }) => {
      const { error } = await supabase
        .from("repositorios")
        .update({ origen_codigo: input.origen })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidar(queryClient);
      toast.success("Origen del código actualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
