import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type {
  MesaIntervencionRow,
  MesaRow,
  MesaValoracionRow,
  ModoMesa,
  ParticipanteMesa,
  PasoPlanMesa,
  RecomendacionMesa,
} from "../db-types";
import { supabase } from "../supabase";

export const clavesMesa = {
  ping: ["mesa_ping"] as const,
  mesas: ["mesas"] as const,
  intervenciones: ["mesa_intervenciones"] as const,
  valoraciones: ["mesa_valoraciones"] as const,
};

export const ETIQUETA_MODO_MESA: Record<ModoMesa, string> = {
  economico: "Económico",
  equilibrado: "Equilibrado",
  maxima_calidad: "Máxima calidad",
};

export const EXPLICACION_MODO_MESA: Record<ModoMesa, string> = {
  economico: "Modelos rápidos y baratos. Coste aproximado: 0,05 € – 0,20 €.",
  equilibrado: "Mezcla de modelos buenos y económicos. Coste aproximado: 0,20 € – 0,80 €.",
  maxima_calidad: "Los mejores modelos de cada proveedor. Coste aproximado: 0,80 € – 3,00 €.",
};

export const ETIQUETA_ROL_MESA: Record<string, string> = {
  planificar: "Planifica",
  opinar: "Opina",
  revisar: "Revisa",
  sintesis: "Coordinador",
};

export const COLOR_ROL_MESA: Record<string, string> = {
  planificar: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  opinar: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  revisar: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  sintesis: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("mesa", { body: cuerpo });
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

export type PingMesa = { ok?: boolean; proveedores?: string[]; minimo_ok?: boolean };

/** Proveedores de IA disponibles para la mesa. */
export function usePingMesa(habilitado = true) {
  return useQuery({
    queryKey: clavesMesa.ping,
    enabled: habilitado,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("mesa", { body: {} });
      if (error) throw new Error(error.message);
      return (data ?? {}) as PingMesa;
    },
  });
}

export function useMesas(proyectoId?: string) {
  return useQuery({
    queryKey: [...clavesMesa.mesas, proyectoId ?? "todas"],
    queryFn: async () => {
      let consulta = supabase.from("mesas").select("*").order("creado_el", { ascending: false }).limit(200);
      if (proyectoId) consulta = consulta.eq("proyecto_id", proyectoId);
      const { data, error } = await consulta;
      if (error) throw new Error(error.message);
      return (data ?? []) as MesaRow[];
    },
  });
}

export function useMesa(mesaId: string | null) {
  return useQuery({
    queryKey: [...clavesMesa.mesas, "una", mesaId ?? ""],
    enabled: Boolean(mesaId),
    queryFn: async () => {
      const { data, error } = await supabase.from("mesas").select("*").eq("id", mesaId!).limit(1);
      if (error) throw new Error(error.message);
      return ((data ?? [])[0] ?? null) as MesaRow | null;
    },
  });
}

export function useIntervenciones(mesaId: string | null) {
  return useQuery({
    queryKey: [...clavesMesa.intervenciones, mesaId ?? ""],
    enabled: Boolean(mesaId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mesa_intervenciones")
        .select("*")
        .eq("mesa_id", mesaId!)
        .order("orden");
      if (error) throw new Error(error.message);
      return (data ?? []) as MesaIntervencionRow[];
    },
  });
}

export function useValoraciones() {
  return useQuery({
    queryKey: clavesMesa.valoraciones,
    queryFn: async () => {
      const { data, error } = await supabase.from("mesa_valoraciones").select("*").limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as MesaValoracionRow[];
    },
  });
}

/** Mantiene la sala al día mientras los expertos intervienen. */
export function useRealtimeMesa(activo: boolean) {
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!activo) return;
    const canal = supabase.channel("nexdeveloper-mesa");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "mesa_intervenciones" }, () => {
      void queryClient.invalidateQueries({ queryKey: clavesMesa.intervenciones });
    });
    canal.on("postgres_changes", { event: "*", schema: "public", table: "mesas" }, () => {
      void queryClient.invalidateQueries({ queryKey: clavesMesa.mesas });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [activo, queryClient]);
}

function useInvalidar() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: clavesMesa.mesas });
    void queryClient.invalidateQueries({ queryKey: clavesMesa.intervenciones });
    void queryClient.invalidateQueries({ queryKey: clavesMesa.valoraciones });
  };
}

export type PeticionMesa = {
  pregunta: string;
  proyectoId?: string;
  contexto?: string;
  modo?: ModoMesa;
  ordenId?: string;
  tareaId?: string;
};

/** Propone el equipo de expertos para la pregunta. */
export function useRecomendarMesa() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: PeticionMesa) =>
      llamar<{ mesa?: MesaRow; sin_proveedores?: boolean }>({
        accion: "recomendar",
        pregunta: v.pregunta,
        ...(v.proyectoId ? { proyecto_id: v.proyectoId } : {}),
        ...(v.contexto ? { contexto: v.contexto } : {}),
        ...(v.modo ? { modo: v.modo } : {}),
        ...(v.ordenId ? { orden_id: v.ordenId } : {}),
        ...(v.tareaId ? { tarea_id: v.tareaId } : {}),
      }),
    onSuccess: (r) => {
      invalidar();
      if (r.sin_proveedores) toast.warning("No hay proveedores de IA con clave: la mesa no podrá deliberar.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Guarda cambios en la mesa (participantes, título…). */
export function useActualizarMesa() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({
      id,
      cambios,
    }: {
      id: string;
      cambios: Partial<Omit<MesaRow, "id" | "user_id">>;
    }) => {
      const { error } = await supabase.from("mesas").update(cambios).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Lanza la deliberación (tarda entre 30 y 120 segundos). */
export function useDeliberar() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (mesaId: string) =>
      llamar<{ sintesis?: string; recomendacion?: RecomendacionMesa; coste?: number; tokens?: number }>({
        accion: "deliberar",
        mesa_id: mesaId,
      }),
    onSuccess: () => {
      invalidar();
      toast.success("La mesa ha terminado de deliberar.");
    },
    onError: (e: Error) => {
      invalidar();
      toast.error(e.message);
    },
  });
}

/** Crea en el proyecto las tareas del plan acordado. */
export function useCrearTareasMesa() {
  const queryClient = useQueryClient();
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (mesaId: string) => llamar<{ tareas?: number | unknown[] }>({ accion: "crear_tareas", mesa_id: mesaId }),
    onSuccess: (r) => {
      invalidar();
      void queryClient.invalidateQueries({ queryKey: ["tareas"] });
      void queryClient.invalidateQueries({ queryKey: ["v_tareas_atencion"] });
      const cuantas = Array.isArray(r.tareas) ? r.tareas.length : Number(r.tareas ?? 0);
      toast.success(cuantas ? `Se han creado ${cuantas} tareas del plan.` : "Plan enviado al proyecto.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Guarda tu valoración de la mesa. */
export function useValorarMesa() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({
      mesaId,
      valoracion,
      comentario,
    }: {
      mesaId: string;
      valoracion: number;
      comentario?: string;
    }) => {
      const { error } = await supabase
        .from("mesa_valoraciones")
        .insert({ mesa_id: mesaId, valoracion, comentario: comentario?.trim() || null });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidar();
      toast.success("Gracias por la valoración.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Participantes normalizados de una mesa. */
export function participantes(mesa: MesaRow | null | undefined): ParticipanteMesa[] {
  return Array.isArray(mesa?.participantes) ? (mesa?.participantes as ParticipanteMesa[]) : [];
}

/**
 * Normaliza el campo "plan" para que siempre sea un array de pasos,
 * venga como array, como texto JSON, como objeto suelto o como cualquier
 * otra cosa. Nunca devuelve null: en el peor caso, un array vacío.
 */
export function normalizarPlan(plan: unknown): PasoPlanMesa[] {
  let dato = plan;
  if (typeof dato === "string") {
    try {
      dato = JSON.parse(dato);
    } catch {
      return [];
    }
  }
  if (Array.isArray(dato)) return dato as PasoPlanMesa[];
  if (dato && typeof dato === "object") {
    // Objeto indexado por claves ("0", "1", …) o un paso suelto.
    const objeto = dato as Record<string, unknown>;
    const claves = Object.keys(objeto);
    if (claves.length > 0 && claves.every((k) => /^\d+$/.test(k))) {
      return claves
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => objeto[k] as PasoPlanMesa);
    }
    return [dato as PasoPlanMesa];
  }
  return [];
}

/**
 * Algunos coordinadores devuelven el plan dentro del texto de la conclusión
 * (en un bloque JSON) en lugar de en el campo estructurado. Esto lo rescata.
 */
export function planDeSintesis(sintesis: string | null | undefined): RecomendacionMesa | null {
  const texto = (sintesis ?? "").trim();
  if (!texto) return null;
  const candidatos: string[] = [];
  const bloques = texto.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const b of bloques) candidatos.push(b[1] ?? "");
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio >= 0 && fin > inicio) candidatos.push(texto.slice(inicio, fin + 1));
  for (const bruto of candidatos) {
    try {
      const dato = JSON.parse(bruto.trim()) as RecomendacionMesa;
      const plan = normalizarPlan(dato?.plan);
      if (dato && typeof dato === "object" && plan.length > 0) {
        return { ...dato, plan };
      }
    } catch {
      /* seguimos probando */
    }
  }
  return null;
}

/** Devuelve la conclusión sin el bloque JSON técnico, para mostrarla al usuario. */
export function sintesisLegible(sintesis: string | null | undefined): string {
  const texto = (sintesis ?? "").trim();
  if (!texto) return "";
  let limpio = texto.replace(/```(?:json)?\s*[\s\S]*?```/gi, "").trim();
  const inicio = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (inicio >= 0 && fin > inicio && fin - inicio > 80) {
    limpio = (limpio.slice(0, inicio) + limpio.slice(fin + 1)).trim();
  }
  return limpio || texto;
}

/** La recomendación de la mesa, rescatando el plan del texto si hiciera falta. */
export function recomendacionDeMesa(mesa: MesaRow | null | undefined): RecomendacionMesa | null {
  const guardada = mesa?.recomendacion ?? null;
  const planGuardado = normalizarPlan(guardada?.plan);
  if (guardada && planGuardado.length > 0) return { ...guardada, plan: planGuardado };
  const rescatada = planDeSintesis(mesa?.sintesis);
  if (!rescatada) return guardada ? { ...guardada, plan: planGuardado } : null;
  return { ...(guardada ?? {}), ...rescatada };
}
