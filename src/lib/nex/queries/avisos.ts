import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type { AvisoRow, AvisoSuscripcionRow, AvisosConfigRow, TipoAviso } from "../db-types";
import { supabase } from "../supabase";

export const clavesAvisos = {
  estado: ["avisos_estado"] as const,
  listado: ["avisos"] as const,
  dispositivos: ["avisos_suscripciones"] as const,
};

/* --------------------------------- Textos --------------------------------- */

export const ETIQUETA_TIPO_AVISO: Record<TipoAviso, string> = {
  tarea_atencion: "Tareas que requieren tu atención",
  aprobacion: "Aprobar y publicar",
  compilacion: "Compilaciones",
  dominio: "Dominios y certificados",
  presupuesto: "Presupuestos de IA",
  salud: "Salud en rojo",
  copias: "Copias",
  ejecucion: "Ejecuciones",
  prueba: "Avisos de prueba",
  otro: "Otros",
};

export const TIPOS_AVISO_CONFIGURABLES: TipoAviso[] = [
  "tarea_atencion",
  "aprobacion",
  "compilacion",
  "dominio",
  "presupuesto",
  "salud",
  "copias",
  "ejecucion",
];

/* -------------------------------- Llamadas -------------------------------- */

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>): Promise<T & { ok?: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("avisos", { body: cuerpo });
  const respuesta = data as (T & { ok?: boolean; error?: string }) | null;
  if (error) {
    let mensaje = error.message || "No se ha podido contactar con el servicio de avisos.";
    const contexto = (error as { context?: Response }).context;
    if (contexto && typeof contexto.text === "function") {
      try {
        const texto = await contexto.text();
        const json = JSON.parse(texto) as { error?: string };
        if (json?.error) mensaje = json.error;
      } catch {
        /* respuesta sin cuerpo legible */
      }
    }
    throw new Error(mensaje);
  }
  if (!respuesta || respuesta.ok === false) {
    throw new Error(respuesta?.error ?? "No se ha podido completar la operación.");
  }
  return respuesta;
}

export type EstadoAvisos = {
  ok?: boolean;
  config?: AvisosConfigRow | null;
  clave_publica?: string | null;
  dispositivos?: AvisoSuscripcionRow[];
  sin_leer?: number;
};

/* --------------------------------- Lecturas -------------------------------- */

export function useEstadoAvisos(habilitado = true) {
  return useQuery({
    queryKey: clavesAvisos.estado,
    enabled: habilitado,
    queryFn: () => llamar<EstadoAvisos>({ accion: "estado" }),
  });
}

export function useAvisos(limite = 100) {
  return useQuery({
    queryKey: clavesAvisos.listado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avisos")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(limite);
      if (error) throw new Error(error.message);
      return (data ?? []) as AvisoRow[];
    },
  });
}

/** Cuántos avisos quedan sin leer (para la campana del menú). */
export function useAvisosSinLeer() {
  const { data = [] } = useAvisos();
  return data.filter((a) => !a.leido).length;
}

export function useRealtimeAvisos(activo = true) {
  const qc = useQueryClient();
  React.useEffect(() => {
    if (!activo) return;
    const canal = supabase.channel("nexdeveloper-avisos");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "avisos" }, () => {
      void qc.invalidateQueries({ queryKey: clavesAvisos.listado });
      void qc.invalidateQueries({ queryKey: clavesAvisos.estado });
    });
    canal.on("postgres_changes", { event: "*", schema: "public", table: "avisos_suscripciones" }, () => {
      void qc.invalidateQueries({ queryKey: clavesAvisos.estado });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [activo, qc]);
}

/* -------------------------------- Acciones -------------------------------- */

function useRefrescarAvisos() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: clavesAvisos.estado });
    void qc.invalidateQueries({ queryKey: clavesAvisos.listado });
  };
}

export function useSuscribirDispositivo() {
  const refrescar = useRefrescarAvisos();
  return useMutation({
    mutationFn: (entrada: { suscripcion: unknown; dispositivo: string; agente: string }) =>
      llamar({
        accion: "suscribir",
        suscripcion: entrada.suscripcion,
        dispositivo: entrada.dispositivo,
        agente: entrada.agente,
      }),
    onSuccess: () => {
      refrescar();
      toast.success("Avisos activados en este dispositivo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useQuitarDispositivo() {
  const refrescar = useRefrescarAvisos();
  return useMutation({
    mutationFn: (entrada: { id?: string; endpoint?: string }) => llamar({ accion: "desuscribir", ...entrada }),
    onSuccess: () => {
      refrescar();
      toast.success("Dispositivo retirado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGuardarConfigAvisos() {
  const refrescar = useRefrescarAvisos();
  return useMutation({
    mutationFn: (campos: Partial<Pick<AvisosConfigRow, "activo" | "tipos" | "silencio_desde" | "silencio_hasta">>) =>
      llamar<{ config?: AvisosConfigRow }>({ accion: "configurar", ...campos }),
    onSuccess: () => {
      refrescar();
      toast.success("Preferencias de avisos guardadas.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useProbarAviso() {
  const refrescar = useRefrescarAvisos();
  return useMutation({
    mutationFn: () => llamar<{ enviados?: number }>({ accion: "probar" }),
    onSuccess: (r) => {
      refrescar();
      toast.success(
        r.enviados && r.enviados > 0
          ? `Aviso de prueba enviado a ${r.enviados} dispositivo(s).`
          : "Aviso de prueba creado, pero no hay dispositivos activos.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarcarLeidos() {
  const refrescar = useRefrescarAvisos();
  return useMutation({
    mutationFn: (entrada?: { id?: string }) => llamar({ accion: "marcar_leidos", ...(entrada?.id ? { id: entrada.id } : {}) }),
    onSuccess: () => refrescar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------------- Utilidades del navegador ------------------------ */

export function soportaAvisos() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

export function esIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
}

export function enPantallaInicio() {
  if (typeof window === "undefined") return false;
  const standalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia?.("(display-mode: standalone)").matches || standalone === true;
}

/** Nombre legible del dispositivo a partir del navegador. */
export function nombreDispositivo() {
  if (typeof navigator === "undefined") return "Dispositivo";
  const ua = navigator.userAgent;
  const sistema = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "Dispositivo";
  const navegador = /CriOS|Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Navegador";
  return `${sistema} · ${navegador}`;
}

export function claveVapidABytes(base64url: string) {
  const relleno = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const binario = window.atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** Registra el trabajador de segundo plano y devuelve su registro. */
export async function registrarTrabajador() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}
