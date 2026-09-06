import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Json, ProyectianSyncRow, TareaRow, TipoSyncProyectian } from "../db-types";
import { supabase } from "../supabase";
import { claves } from "./claves";

/* --------------------------------- Claves --------------------------------- */

export const clavesProyectian = {
  prueba: ["proyectian_prueba"] as const,
  historial: ["proyectian_sync"] as const,
  diagnostico: ["proyectian_diagnostico"] as const,
};

/* --------------------------------- Textos --------------------------------- */

export type AccionProyectian =
  | "todo"
  | "versiones"
  | "salud"
  | "pantallas"
  | "reuniones"
  | "pendientes"
  | "versiones_salud"
  | "diagnostico"
  | "probar";

export const ETIQUETA_TIPO_SYNC: Record<TipoSyncProyectian, string> = {
  versiones: "Versiones",
  salud: "Salud",
  pantallas: "Pantallas",
  reuniones: "Reuniones",
  pendientes: "Pendientes",
};

export const ACCIONES_SINCRONIZACION: { accion: AccionProyectian; etiqueta: string; descripcion: string }[] = [
  { accion: "todo", etiqueta: "Sincronizar todo ahora", descripcion: "Trae de golpe versiones, salud, pantallas, reuniones y pendientes." },
  { accion: "versiones", etiqueta: "Versiones", descripcion: "Lee la versión publicada de cada repositorio." },
  { accion: "salud", etiqueta: "Salud", descripcion: "Actualiza el semáforo de salud de cada proyecto." },
  { accion: "pantallas", etiqueta: "Pantallas", descripcion: "Recoge el inventario de pantallas de cada aplicación." },
  { accion: "reuniones", etiqueta: "Reuniones", descripcion: "Trae las reuniones registradas en Proyectian." },
  { accion: "pendientes", etiqueta: "Pendientes", descripcion: "Convierte en tareas los pendientes de Proyectian." },
];

/* ------------------------------- Resultados ------------------------------- */

export type PruebaProyectian = {
  ok: boolean;
  github?: { login?: string; error?: string } | string | null;
  proyectian_proyectos?: number | null;
  error?: string;
};

export type RepositorioDiagnostico = {
  proyecto: string;
  repositorio: string | null;
  existe: boolean;
  ultimo_commit: string | null;
  mensaje: string | null;
  tiene_version_ts: boolean;
};

export type ResultadoSincronizacion = { ok: boolean; [clave: string]: unknown };

async function invocar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("sincronizar-proyectian", { body });
  if (error) throw new Error(error.message);
  const res = data as T & { ok?: boolean; error?: string };
  if (res && res.ok === false && res.error) throw new Error(res.error);
  return res;
}

/** Nombre de la cuenta de GitHub con la que se conecta, venga como texto u objeto. */
export function loginGithub(github: PruebaProyectian["github"]): string | null {
  if (!github) return null;
  if (typeof github === "string") return github;
  return github.login ?? null;
}

/** Resumen corto y amable de lo que ha devuelto una sincronización. */
export function resumirResultado(resultado: ResultadoSincronizacion): string {
  const partes: string[] = [];
  for (const [clave, valor] of Object.entries(resultado)) {
    if (clave === "ok" || valor === null || valor === undefined) continue;
    if (typeof valor === "number") partes.push(`${ETIQUETA_TIPO_SYNC[clave as TipoSyncProyectian] ?? clave}: ${valor}`);
    else if (typeof valor === "string") partes.push(`${clave}: ${valor}`);
    else if (valor && typeof valor === "object") {
      const dentro = valor as Record<string, unknown>;
      const numeros = Object.entries(dentro)
        .filter(([, v]) => typeof v === "number" || typeof v === "string")
        .map(([k, v]) => `${k} ${String(v)}`);
      if (numeros.length > 0) partes.push(`${ETIQUETA_TIPO_SYNC[clave as TipoSyncProyectian] ?? clave} (${numeros.join(", ")})`);
    }
  }
  return partes.length > 0 ? partes.join(" · ") : "Sincronización terminada.";
}

/** Texto legible de un JSON de detalle. */
export function detalleFormateado(detalle: Json | null) {
  if (detalle === null || detalle === undefined) return "Sin detalle.";
  try {
    return JSON.stringify(detalle, null, 2);
  } catch {
    return String(detalle);
  }
}

/* -------------------------------- Consultas ------------------------------- */

export function useProbarProyectian() {
  return useQuery({
    queryKey: clavesProyectian.prueba,
    queryFn: () => invocar<PruebaProyectian>({ accion: "probar" }),
    retry: false,
    staleTime: 60_000,
  });
}

export function useDiagnosticoRepositorios(activo: boolean) {
  return useQuery({
    queryKey: clavesProyectian.diagnostico,
    enabled: activo,
    retry: false,
    queryFn: async () => {
      const r = await invocar<{ repositorios?: RepositorioDiagnostico[] }>({ accion: "diagnostico" });
      return r.repositorios ?? [];
    },
  });
}

export function useHistorialProyectian() {
  return useQuery({
    queryKey: clavesProyectian.historial,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proyectian_sync")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as ProyectianSyncRow[];
    },
  });
}

/* -------------------------------- Acciones -------------------------------- */

export function useSincronizarProyectian() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ accion, proyectoId }: { accion: AccionProyectian; proyectoId?: string | undefined }) =>
      invocar<ResultadoSincronizacion>({ accion, ...(proyectoId ? { proyecto_id: proyectoId } : {}) }),
    onSuccess: (resultado) => {
      void queryClient.invalidateQueries({ queryKey: clavesProyectian.historial });
      void queryClient.invalidateQueries({ queryKey: claves.proyectos });
      void queryClient.invalidateQueries({ queryKey: claves.tareas });
      toast.success(resumirResultado(resultado));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------------- Estados de las tareas -------------------------- */

type CambioEstado = { id: string; hasta?: string | undefined; motivo?: string | undefined };

function useCambioTarea(fn: (v: CambioEstado) => Promise<void>, mensaje: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: claves.tareas });
      void queryClient.invalidateQueries({ queryKey: claves.tareasAtencion });
      toast.success(mensaje);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

async function actualizarTarea(id: string, campos: Partial<TareaRow>) {
  const { error } = await supabase.from("tareas").update(campos).eq("id", id);
  if (error) throw new Error(error.message);
}

export function usePausarTarea() {
  return useCambioTarea(
    ({ id, hasta, motivo }) =>
      actualizarTarea(id, {
        estado: "pausada",
        pausada_hasta: hasta || null,
        motivo_estado: motivo || null,
        cancelada_el: null,
      }),
    "Tarea pausada.",
  );
}

export function useCancelarTarea() {
  return useCambioTarea(
    ({ id, motivo }) =>
      actualizarTarea(id, {
        estado: "cancelada",
        cancelada_el: new Date().toISOString(),
        motivo_estado: motivo || null,
        pausada_hasta: null,
      }),
    "Tarea cancelada.",
  );
}

export function useReanudarTarea() {
  return useCambioTarea(
    ({ id }) =>
      actualizarTarea(id, {
        estado: "pendiente",
        pausada_hasta: null,
        cancelada_el: null,
        motivo_estado: null,
      }),
    "Tarea reanudada.",
  );
}
