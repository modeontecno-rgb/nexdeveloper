import { useSeguirTrabajo } from "@/components/nex/indicador-trabajo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import type {
  CompilacionRow,
  CompilacionUltimaRow,
  FirmaCompilacionRow,
  PlantillaCompilacionRow,
  PlataformaCompilacion,
} from "../db-types";
import { supabase } from "../supabase";

export const clavesCompilaciones = {
  plantillas: ["plantillas_compilacion"] as const,
  compilaciones: ["compilaciones"] as const,
  ultimas: ["v_compilaciones_ultimas"] as const,
  firmas: ["firmas_compilacion"] as const,
  deteccion: (proyectoId: string, rama: string) => ["compilar_detectar", proyectoId, rama] as const,
};

/** Error con el código HTTP de la Edge Function, para distinguir el 409 de «versión repetida». */
export class ErrorCompilacion extends Error {
  estado: number;
  constructor(mensaje: string, estado: number) {
    super(mensaje);
    this.estado = estado;
  }
}

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("compilar-app", { body: cuerpo });
  const respuesta = (data ?? null) as ({ ok?: boolean; error?: string } & T) | null;
  if (error) {
    const contexto = error as unknown as { context?: { status?: number }; message?: string };
    let mensaje = contexto.message ?? "No se ha podido completar la operación.";
    let estado = contexto.context?.status ?? 500;
    const respuestaHttp = (error as unknown as { context?: Response }).context;
    if (respuestaHttp && typeof respuestaHttp.json === "function") {
      estado = respuestaHttp.status ?? estado;
      try {
        const cuerpoError = (await respuestaHttp.clone().json()) as { error?: string };
        if (cuerpoError?.error) mensaje = cuerpoError.error;
      } catch {
        /* sin cuerpo JSON */
      }
    }
    throw new ErrorCompilacion(mensaje, estado);
  }
  if (!respuesta || respuesta.ok === false) {
    throw new ErrorCompilacion(respuesta?.error ?? "No se ha podido completar la operación.", 400);
  }
  return respuesta;
}

export type Deteccion = {
  ok: boolean;
  repositorio?: string;
  rama?: string;
  herramientas?: string[];
  plantillas_sugeridas?: string[];
  talleres_presentes?: string[];
  tiene_android?: boolean;
  tiene_ios?: boolean;
  version_package?: string | null;
  secretos_presentes?: string[];
  error?: string;
};

export function usePlantillasCompilacion() {
  return useQuery({
    queryKey: clavesCompilaciones.plantillas,
    queryFn: async () => {
      const { data, error } = await supabase.from("plantillas_compilacion").select("*").order("orden");
      if (error) throw new Error(error.message);
      return (data ?? []) as PlantillaCompilacionRow[];
    },
  });
}

export function useCompilaciones() {
  return useQuery({
    queryKey: clavesCompilaciones.compilaciones,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compilaciones")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as CompilacionRow[];
    },
  });
}

export function useUltimasCompilaciones() {
  return useQuery({
    queryKey: clavesCompilaciones.ultimas,
    queryFn: async () => {
      const { data, error } = await supabase.from("v_compilaciones_ultimas").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as CompilacionUltimaRow[];
    },
  });
}

export function useFirmasCompilacion() {
  return useQuery({
    queryKey: clavesCompilaciones.firmas,
    queryFn: async () => {
      const { data, error } = await supabase.from("firmas_compilacion").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as FirmaCompilacionRow[];
    },
  });
}

export function useDetectar() {
  return useMutation({
    mutationFn: (input: { proyectoId: string; rama?: string }) =>
      llamar<Deteccion>({ accion: "detectar", proyecto_id: input.proyectoId, rama: input.rama }),
  });
}

export function useLanzarCompilacion() {
  const qc = useQueryClient();
  const seguirTrabajo = useSeguirTrabajo('Lanzando la compilación');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: (input: {
      proyectoId: string;
      plantillaId: string;
      version: string;
      rama?: string;
      notas?: string;
      forzar?: boolean;
    }) =>
      llamar<{ compilacion: CompilacionRow; firmada: boolean; minutos_estimados: number | null }>({
        accion: "lanzar",
        proyecto_id: input.proyectoId,
        plantilla_id: input.plantillaId,
        version: input.version,
        rama: input.rama,
        notas: input.notas,
        forzar: input.forzar ?? false,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesCompilaciones.compilaciones });
      void qc.invalidateQueries({ queryKey: clavesCompilaciones.ultimas });
    },
  });
}

export function useSincronizarCompilaciones() {
  const qc = useQueryClient();
  const seguirTrabajo = useSeguirTrabajo('Sincronizando compilaciones');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: () => llamar({ accion: "sincronizar" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesCompilaciones.compilaciones });
      void qc.invalidateQueries({ queryKey: clavesCompilaciones.ultimas });
    },
  });
}

export function useCancelarCompilacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (compilacionId: string) => llamar({ accion: "cancelar", compilacion_id: compilacionId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clavesCompilaciones.compilaciones }),
  });
}

export function useDescargarCompilacion() {
  return useMutation({
    mutationFn: (compilacionId: string) =>
      llamar<{ url: string; origen: "almacen" | "github"; caduca_en_seg?: number }>({
        accion: "descargar",
        compilacion_id: compilacionId,
      }),
  });
}

export function useGuardarSecretosFirma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      proyectoId: string;
      plataforma: PlataformaCompilacion;
      secretos: Record<string, string>;
    }) =>
      llamar<{ puestos: string[]; presentes: string[] }>({
        accion: "guardar_secretos_repo",
        proyecto_id: input.proyectoId,
        plataforma: input.plataforma,
        secretos: input.secretos,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clavesCompilaciones.firmas }),
  });
}

/** Mantiene la lista al día con los cambios en vivo de la tabla de compilaciones. */
export function useRealtimeCompilaciones(alCambiar: (fila: CompilacionRow) => void) {
  const qc = useQueryClient();
  const referencia = React.useRef(alCambiar);
  referencia.current = alCambiar;

  React.useEffect(() => {
    const canal = supabase.channel("nexdeveloper-compilaciones");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "compilaciones" }, (evento) => {
      void qc.invalidateQueries({ queryKey: clavesCompilaciones.compilaciones });
      void qc.invalidateQueries({ queryKey: clavesCompilaciones.ultimas });
      const fila = evento.new as CompilacionRow | undefined;
      if (fila?.id) referencia.current(fila);
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [qc]);
}

/** Sube en uno el último número de una versión tipo 1.2.3. */
export function siguienteVersion(version: string | null | undefined) {
  const base = version && /^\d+\.\d+\.\d+$/.test(version) ? version : "0.1.0";
  const partes = base.split(".").map((n) => Number(n));
  partes[2] = (partes[2] ?? 0) + 1;
  return partes.join(".");
}

export function versionValida(version: string) {
  return /^\d+\.\d+\.\d+$/.test(version.trim());
}

/** Lee un archivo y devuelve su contenido en base64 (sin la cabecera de tipo). */
export function aBase64(archivo: File) {
  return new Promise<string>((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error("No se ha podido leer el archivo."));
    lector.onload = () => {
      const resultado = String(lector.result ?? "");
      resolver(resultado.slice(resultado.indexOf(",") + 1));
    };
    lector.readAsDataURL(archivo);
  });
}

export function duracionLegible(segundos: number | null | undefined) {
  if (!segundos || segundos <= 0) return "—";
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return minutos > 0 ? `${minutos} min ${resto}s` : `${resto}s`;
}
