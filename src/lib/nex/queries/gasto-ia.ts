import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import type {
  GastoIaConfigRow,
  GastoIaDiarioRow,
  GastoIaEstadoRow,
  GastoIaManualRow,
  GastoIaMesRow,
  GastoIaProyectoMesRow,
  PresupuestoIaRow,
  ProveedorGastoIa,
} from "../db-types";
import { supabase } from "../supabase";

export const clavesGastoIa = {
  diario: ["gasto_ia_diario"] as const,
  manuales: ["gastos_ia_manuales"] as const,
  presupuestos: ["presupuestos_ia"] as const,
  config: ["gasto_ia_config"] as const,
  mes: ["v_gasto_ia_mes"] as const,
  proyectoMes: ["v_gasto_ia_proyecto_mes"] as const,
  estado: ["v_gasto_ia_estado"] as const,
  ping: ["gasto_ia_ping"] as const,
};

export const ETIQUETA_PROVEEDOR_GASTO: Record<ProveedorGastoIa, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  groq: "Groq",
  lovable: "Créditos de la plataforma",
  elevenlabs: "ElevenLabs",
  fal: "Fal",
  otro: "Otro",
};

export const PROVEEDORES_GASTO = Object.keys(ETIQUETA_PROVEEDOR_GASTO) as ProveedorGastoIa[];

/** Color estable por proveedor para los gráficos. */
export const COLOR_PROVEEDOR: Record<ProveedorGastoIa, string> = {
  anthropic: "hsl(24 90% 58%)",
  openai: "hsl(158 64% 45%)",
  google: "hsl(217 91% 60%)",
  groq: "hsl(340 75% 60%)",
  lovable: "hsl(270 70% 62%)",
  elevenlabs: "hsl(190 80% 50%)",
  fal: "hsl(45 90% 55%)",
  otro: "hsl(220 9% 60%)",
};

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("gasto-ia", { body: cuerpo });
  const respuesta = (data ?? null) as ({ ok?: boolean; error?: string } & T) | null;
  if (error) {
    let mensaje = (error as Error).message ?? "No se ha podido completar la operación.";
    const respuestaHttp = (error as unknown as { context?: Response }).context;
    if (respuestaHttp && typeof respuestaHttp.json === "function") {
      try {
        const cuerpoError = (await respuestaHttp.clone().json()) as { error?: string };
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

export type PingGastoIa = { ok?: boolean; anthropic_admin?: boolean; openai_admin?: boolean };

/** Comprueba si hay claves de administración para leer el coste real facturado. */
export function usePingGastoIa(habilitado = true) {
  return useQuery({
    queryKey: clavesGastoIa.ping,
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gasto-ia", { body: {} });
      if (error) throw new Error(error.message);
      return (data ?? {}) as PingGastoIa;
    },
  });
}

/** Gasto día a día del mes indicado (AAAA-MM). */
export function useGastoDiario(mes: string) {
  return useQuery({
    queryKey: [...clavesGastoIa.diario, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gasto_ia_diario")
        .select("*")
        .gte("fecha", `${mes}-01`)
        .lte("fecha", finDeMes(mes))
        .order("fecha", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as GastoIaDiarioRow[];
    },
  });
}

export function useGastoPorProveedor(mes: string) {
  return useQuery({
    queryKey: [...clavesGastoIa.mes, mes],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_gasto_ia_mes").select("*").eq("mes", `${mes}-01`);
      if (error) throw new Error(error.message);
      return (data ?? []) as GastoIaMesRow[];
    },
  });
}

export function useGastoPorProyecto(mes: string) {
  return useQuery({
    queryKey: [...clavesGastoIa.proyectoMes, mes],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_gasto_ia_proyecto_mes").select("*").eq("mes", `${mes}-01`);
      if (error) throw new Error(error.message);
      return (data ?? []) as GastoIaProyectoMesRow[];
    },
  });
}

export function useEstadoPresupuestos() {
  return useQuery({
    queryKey: clavesGastoIa.estado,
    queryFn: async () => {
      const { data, error } = await supabase.from("v_gasto_ia_estado").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as GastoIaEstadoRow[];
    },
  });
}

export function usePresupuestosIa() {
  return useQuery({
    queryKey: clavesGastoIa.presupuestos,
    queryFn: async () => {
      const { data, error } = await supabase.from("presupuestos_ia").select("*").order("ambito");
      if (error) throw new Error(error.message);
      return (data ?? []) as PresupuestoIaRow[];
    },
  });
}

export function useGuardarPresupuestoIa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; cambios: Partial<Omit<PresupuestoIaRow, "user_id" | "id">> }) => {
      if (input.id) {
        const { error } = await supabase.from("presupuestos_ia").update(input.cambios).eq("id", input.id);
        if (error) throw new Error(error.message);
        return true;
      }
      const { error } = await supabase.from("presupuestos_ia").insert({
        ambito: input.cambios.ambito ?? "global",
        limite_mensual: input.cambios.limite_mensual ?? 0,
        ...input.cambios,
      });
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesGastoIa.presupuestos });
      void qc.invalidateQueries({ queryKey: clavesGastoIa.estado });
    },
  });
}

export function useBorrarPresupuestoIa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("presupuestos_ia").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesGastoIa.presupuestos });
      void qc.invalidateQueries({ queryKey: clavesGastoIa.estado });
    },
  });
}

export function useGastosManuales() {
  return useQuery({
    queryKey: clavesGastoIa.manuales,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gastos_ia_manuales")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(300);
      if (error) throw new Error(error.message);
      return (data ?? []) as GastoIaManualRow[];
    },
  });
}

export function useGuardarGastoManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      cambios: Partial<Omit<GastoIaManualRow, "user_id" | "id">> & {
        fecha?: string;
        proveedor?: GastoIaManualRow["proveedor"];
        concepto?: string;
      };
    }) => {
      if (input.id) {
        const { error } = await supabase.from("gastos_ia_manuales").update(input.cambios).eq("id", input.id);
        if (error) throw new Error(error.message);
        return true;
      }
      const { error } = await supabase.from("gastos_ia_manuales").insert({
        fecha: input.cambios.fecha ?? new Date().toISOString().slice(0, 10),
        proveedor: input.cambios.proveedor ?? "otro",
        concepto: input.cambios.concepto ?? "Gasto",
        ...input.cambios,
      });
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesGastoIa.manuales });
    },
  });
}

export function useBorrarGastoManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gastos_ia_manuales").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesGastoIa.manuales });
    },
  });
}

export function useGastoIaConfig() {
  return useQuery({
    queryKey: clavesGastoIa.config,
    queryFn: async () => {
      const { data, error } = await supabase.from("gasto_ia_config").select("*").limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as GastoIaConfigRow | null;
    },
  });
}

export function useGuardarGastoIaConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; cambios: Partial<Omit<GastoIaConfigRow, "user_id">> }) => {
      const { error } = await supabase.from("gasto_ia_config").update(input.cambios).eq("id", input.id);
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesGastoIa.config });
    },
  });
}

export function useSincronizarGastoIa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      llamar<{ agregados?: number; reales?: { proveedor: string; estado: string }[]; avisos?: number }>({
        accion: "sincronizar",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesGastoIa.diario });
      void qc.invalidateQueries({ queryKey: clavesGastoIa.mes });
      void qc.invalidateQueries({ queryKey: clavesGastoIa.proyectoMes });
      void qc.invalidateQueries({ queryKey: clavesGastoIa.estado });
    },
  });
}

/** Mantiene las cifras al día cuando el backend agrega gasto nuevo. */
export function useRealtimeGastoIa() {
  const qc = useQueryClient();
  React.useEffect(() => {
    const canal = supabase.channel("nexdeveloper-gasto-ia");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "gasto_ia_diario" }, () => {
      void qc.invalidateQueries({ queryKey: clavesGastoIa.diario });
      void qc.invalidateQueries({ queryKey: clavesGastoIa.mes });
      void qc.invalidateQueries({ queryKey: clavesGastoIa.proyectoMes });
      void qc.invalidateQueries({ queryKey: clavesGastoIa.estado });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [qc]);
}

/** Mes actual en formato AAAA-MM. */
export function mesActual() {
  const ahora = new Date();
  const desplazado = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000);
  return desplazado.toISOString().slice(0, 7);
}

/** Lista de los últimos doce meses, del más reciente al más antiguo. */
export function ultimosMeses(cantidad = 12) {
  const salida: string[] = [];
  const base = new Date();
  for (let i = 0; i < cantidad; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    salida.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return salida;
}

export function nombreMes(mes: string) {
  const [anio, m] = mes.split("-");
  const fecha = new Date(Number(anio), Number(m) - 1, 1);
  const texto = fecha.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function diasDelMes(mes: string) {
  const [anio, m] = mes.split("-");
  return new Date(Number(anio), Number(m), 0).getDate();
}

/** Último día real del mes (AAAA-MM-DD), para no pedir fechas que no existen. */
export function finDeMes(mes: string): string {
  return `${mes}-${String(diasDelMes(mes)).padStart(2, "0")}`;
}

/** Proyección de gasto a fin de mes con lo consumido hasta hoy. */
export function proyeccionMes(mes: string, gastado: number) {
  const total = diasDelMes(mes);
  const hoy = new Date();
  const esMesActual = mesActual() === mes;
  const transcurridos = esMesActual ? Math.max(1, hoy.getDate()) : total;
  return (gastado / transcurridos) * total;
}

/** Verde / ámbar / rojo según el porcentaje consumido del presupuesto. */
export function tonoPresupuesto(pct: number, avisoPct: number) {
  if (pct >= 100) return "error" as const;
  if (pct >= avisoPct) return "aviso" as const;
  return "ok" as const;
}
