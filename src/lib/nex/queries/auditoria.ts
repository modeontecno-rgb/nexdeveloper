import { useSeguirTrabajo } from "@/components/nex/indicador-trabajo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type {
  AreaAuditoria,
  AuditoriaConfigRow,
  AuditoriaRow,
  HallazgoAuditoria,
  SeveridadHallazgoAuditoria,
} from "../db-types";
import { supabase } from "../supabase";

export const clavesAuditoria = {
  estado: ["auditoria_estado"] as const,
  lista: ["auditorias"] as const,
  uno: (id: string) => ["auditoria", id] as const,
};

export const AREAS_AUDITORIA: { valor: AreaAuditoria; titulo: string; descripcion: string }[] = [
  { valor: "accesibilidad", titulo: "Accesibilidad", descripcion: "Contrastes, etiquetas y uso con teclado." },
  { valor: "rendimiento", titulo: "Rendimiento", descripcion: "Tiempos de carga y peso de las pantallas." },
  { valor: "seguridad", titulo: "Seguridad", descripcion: "Permisos, claves y protección de los datos." },
  { valor: "textos", titulo: "Textos", descripcion: "Claridad, ortografía y coherencia en español." },
  { valor: "codigo", titulo: "Código", descripcion: "Orden, duplicidades y mantenimiento." },
  { valor: "datos", titulo: "Datos", descripcion: "Integridad, copias y calidad de la información." },
];

export const ETIQUETA_AREA_AUDITORIA: Record<AreaAuditoria, string> = {
  accesibilidad: "Accesibilidad",
  rendimiento: "Rendimiento",
  seguridad: "Seguridad",
  textos: "Textos",
  codigo: "Código",
  datos: "Datos",
};

export const ETIQUETA_ESTADO_AUDITORIA: Record<AuditoriaRow["estado"], string> = {
  pendiente: "En espera",
  analizando: "Analizando",
  terminada: "Terminada",
  error: "Con error",
};

export const SEVERIDADES: SeveridadHallazgoAuditoria[] = ["critica", "alta", "media", "baja"];

export const ETIQUETA_SEVERIDAD: Record<SeveridadHallazgoAuditoria, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const TONO_SEVERIDAD: Record<SeveridadHallazgoAuditoria, string> = {
  critica: "border-destructive/40 bg-destructive/10 text-destructive",
  alta: "border-warning/40 bg-warning/10 text-warning",
  media: "border-primary/40 bg-primary/10 text-primary",
  baja: "border-border bg-muted text-muted-foreground",
};

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("auditar", { body: cuerpo });
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

export type EstadoAuditoria = {
  ok?: boolean;
  config?: AuditoriaConfigRow | null;
  ultimo_lote?: string | null;
  ia?: boolean;
  github?: boolean;
};

export function useEstadoAuditoria(habilitado = true) {
  return useQuery({
    queryKey: clavesAuditoria.estado,
    enabled: habilitado,
    retry: false,
    queryFn: async () => (await llamar<EstadoAuditoria>({ accion: "estado" })) as EstadoAuditoria,
  });
}

/** Todas las auditorías (últimos lotes), para calcular lotes y comparativas. */
export function useAuditorias(lote?: string) {
  return useQuery({
    queryKey: [...clavesAuditoria.lista, lote ?? "todos"],
    queryFn: async () => {
      let consulta = supabase.from("auditorias").select("*").order("creado_el", { ascending: false }).limit(400);
      if (lote) consulta = consulta.eq("lote", lote);
      const { data, error } = await consulta;
      if (error) throw new Error(error.message);
      return (data ?? []) as AuditoriaRow[];
    },
  });
}

export function useAuditoria(id: string | null) {
  return useQuery({
    queryKey: clavesAuditoria.uno(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("auditorias").select("*").eq("id", id!).limit(1);
      if (error) throw new Error(error.message);
      return ((data ?? [])[0] ?? null) as AuditoriaRow | null;
    },
  });
}

/** Sigue en directo el avance del lote de auditoría. */
export function useRealtimeAuditorias(activo: boolean) {
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!activo) return;
    const canal = supabase.channel("nexdeveloper-auditorias");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "auditorias" }, () => {
      void queryClient.invalidateQueries({ queryKey: clavesAuditoria.lista });
      void queryClient.invalidateQueries({ queryKey: ["auditoria"] });
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
    void queryClient.invalidateQueries({ queryKey: clavesAuditoria.lista });
    void queryClient.invalidateQueries({ queryKey: ["auditoria"] });
    void queryClient.invalidateQueries({ queryKey: clavesAuditoria.estado });
    void queryClient.invalidateQueries({ queryKey: ["proyectos"] });
    void queryClient.invalidateQueries({ queryKey: ["tareas"] });
  };
}

/** Lanza la auditoría: de un proyecto concreto o de toda la cartera. */
export function useAuditar() {
  const invalidar = useInvalidar();
  const seguirTrabajo = useSeguirTrabajo('Auditoría mensual');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: (v: { proyectoId?: string }) =>
      llamar<{ auditoria?: AuditoriaRow; lote?: string; total?: number }>({
        accion: "auditar",
        ...(v.proyectoId ? { proyecto_id: v.proyectoId } : {}),
      }),
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReintentarAuditoria() {
  const invalidar = useInvalidar();
  const seguirTrabajo = useSeguirTrabajo('Reintentando la auditoría');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: (auditoriaId: string) => llamar({ accion: "reintentar", auditoria_id: auditoriaId }),
    onSuccess: () => {
      invalidar();
      toast.success("Se ha reanudado la auditoría.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCrearTareaHallazgo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { auditoriaId: string; indice: number }) =>
      llamar<{ tarea_id?: string }>({ accion: "crear_tarea", auditoria_id: v.auditoriaId, indice: v.indice }),
    onSuccess: () => {
      invalidar();
      toast.success("Tarea creada a partir del hallazgo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type CambiosConfigAuditoria = Partial<Omit<AuditoriaConfigRow, "id" | "user_id">>;

export function useGuardarConfigAuditoria() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (cambios: CambiosConfigAuditoria) => llamar({ accion: "configurar", ...cambios }),
    onSuccess: () => {
      invalidar();
      toast.success("Configuración de la auditoría guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------------------ Utilidades ------------------------------- */

export function hallazgosDe(auditoria: AuditoriaRow | null | undefined): HallazgoAuditoria[] {
  return auditoria?.hallazgos ?? [];
}

export function contarPorSeveridad(auditoria: AuditoriaRow | null | undefined) {
  const conteo: Record<SeveridadHallazgoAuditoria, number> = { critica: 0, alta: 0, media: 0, baja: 0 };
  for (const h of hallazgosDe(auditoria)) {
    if (conteo[h.severidad] !== undefined) conteo[h.severidad] += 1;
  }
  return conteo;
}

/** Lotes disponibles, del más reciente al más antiguo. */
export function lotesDe(auditorias: AuditoriaRow[]) {
  return [...new Set(auditorias.map((a) => a.lote))].sort().reverse();
}

export function etiquetaLote(lote: string) {
  const mes = /^(\d{4})-(\d{2})$/.exec(lote);
  if (!mes) return lote.startsWith("manual-") ? `Manual · ${lote.slice(7)}` : lote;
  const fecha = new Date(Number(mes[1]), Number(mes[2]) - 1, 1);
  const texto = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function mediaPuntuacion(auditorias: AuditoriaRow[]) {
  const notas = auditorias.map((a) => a.puntuacion).filter((n): n is number => typeof n === "number");
  if (notas.length === 0) return null;
  return Math.round(notas.reduce((s, n) => s + n, 0) / notas.length);
}

/** Auditoría anterior del mismo proyecto (para comparar la puntuación). */
export function anteriorDelProyecto(auditorias: AuditoriaRow[], actual: AuditoriaRow | null | undefined) {
  if (!actual) return null;
  return (
    auditorias
      .filter(
        (a) =>
          a.proyecto_id === actual.proyecto_id &&
          a.id !== actual.id &&
          a.estado === "terminada" &&
          a.creado_el < actual.creado_el,
      )
      .sort((a, b) => (a.creado_el < b.creado_el ? 1 : -1))[0] ?? null
  );
}
