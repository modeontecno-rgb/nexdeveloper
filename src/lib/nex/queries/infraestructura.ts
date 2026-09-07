import { useSeguirTrabajo } from "@/components/nex/indicador-trabajo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type {
  AmbitoInfra,
  EstadoIncidenciaInfra,
  InfraComprobacionRow,
  InfraConfigRow,
  InfraDependenciaRow,
  InfraIncidenciaRow,
  InfraServicioRow,
  InfraSincronizacionRow,
  Semaforo,
  TipoServicioInfra,
} from "../db-types";
import { supabase } from "../supabase";
import { claves } from "./claves";

export const clavesInfra = {
  estado: ["infra_estado"] as const,
  historico: (servicioId: string) => ["infra_historico", servicioId] as const,
  impacto: (servicioId: string) => ["infra_impacto", servicioId] as const,
  ideas: ["infra_ideas"] as const,
};

/* --------------------------------- Textos --------------------------------- */

export const ETIQUETA_TIPO_SERVICIO: Record<TipoServicioInfra, string> = {
  conexion: "Cuenta o autorización",
  supabase: "Base de datos (Supabase)",
  github: "GitHub",
  http: "Página o API",
  dns: "DNS",
  tcp: "Puerto",
  s3: "Almacén de archivos",
  funcion: "Función de NexDeveloper",
  proveedor_ia: "Proveedor de IA",
  sentry: "Sentry",
  proyectian: "Proyectian",
  servidor: "Servidor",
  correo: "Correo",
  otro: "Otro",
};

export const EXPLICACION_TIPO_SERVICIO: Record<TipoServicioInfra, string> = {
  conexion: "Se comprueba que la cuenta o autorización sigue siendo válida.",
  supabase: "Se consulta el estado del proyecto de Supabase con la referencia indicada.",
  github: "Se comprueba el repositorio en GitHub con el token guardado.",
  http: "Se pide la dirección y se comprueba el código de respuesta y, si lo indicas, un texto que debe aparecer.",
  dns: "Se resuelve el nombre del dominio y se comprueba el tipo de registro indicado.",
  tcp: "Se abre el puerto indicado para ver si el servidor responde.",
  s3: "Se lista el contenido del cubo del almacén para ver si sigue accesible.",
  funcion: "Se llama a la función de NexDeveloper y se espera una respuesta correcta.",
  proveedor_ia: "Se hace una llamada mínima al proveedor de IA con su clave.",
  sentry: "Se consulta la organización de Sentry.",
  proyectian: "Se consulta la API de Proyectian.",
  servidor: "Comprobación genérica del servidor: dirección o puerto.",
  correo: "Se comprueba el servidor de correo saliente.",
  otro: "Comprobación libre según la dirección indicada.",
};

export const ETIQUETA_AMBITO: Record<AmbitoInfra, string> = {
  global: "Afecta a todos los proyectos",
  proyecto: "Solo a los proyectos que dependan de él",
};

export const ETIQUETA_ESTADO_INCIDENCIA: Record<EstadoIncidenciaInfra, string> = {
  abierta: "Abierta",
  resuelta: "Resuelta",
  ignorada: "Ignorada",
};

export const TONO_INFRA: Record<Semaforo, string> = {
  verde: "border-success/40 bg-success/10 text-success",
  ambar: "border-warning/40 bg-warning/10 text-warning",
  rojo: "border-destructive/40 bg-destructive/10 text-destructive",
  gris: "border-border bg-muted text-muted-foreground",
};

export const FONDO_INFRA: Record<Semaforo, string> = {
  verde: "bg-success",
  ambar: "bg-warning",
  rojo: "bg-destructive",
  gris: "bg-muted-foreground/50",
};

export const ETIQUETA_INFRA: Record<Semaforo, string> = {
  verde: "Funciona",
  ambar: "Con avisos",
  rojo: "Caído",
  gris: "Sin comprobar",
};

const ORDEN: Record<Semaforo, number> = { rojo: 0, ambar: 1, gris: 2, verde: 3 };

export function ordenarServicios(servicios: InfraServicioRow[]) {
  return [...servicios].sort(
    (a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.nombre.localeCompare(b.nombre, "es"),
  );
}

/** Días que faltan para la renovación (negativo si ya ha pasado). */
export function diasHasta(fecha: string | null | undefined) {
  if (!fecha) return null;
  const ms = new Date(fecha).getTime() - Date.now();
  return Math.round(ms / 86400000);
}

/* -------------------------------- Llamadas -------------------------------- */

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("infraestructura", { body: cuerpo });
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

export type ResumenInfra = {
  verdes: number;
  ambar: number;
  rojos: number;
  grises: number;
  incidencias_abiertas: number;
  sincronizacion_roja: number;
};

export type EstadoInfraestructura = {
  ok?: boolean;
  config?: InfraConfigRow | null;
  global?: Semaforo | null;
  resumen?: ResumenInfra | null;
  servicios?: InfraServicioRow[];
  incidencias?: InfraIncidenciaRow[];
  sincronizacion?: InfraSincronizacionRow[];
  dependencias?: InfraDependenciaRow[];
  secretos?: { supabase?: boolean; github?: boolean; sentry?: boolean } | null;
};

export type HistoricoInfra = {
  historico?: InfraComprobacionRow[];
  disponibilidad_pct?: number | null;
  ms_medio?: number | null;
};

export type ImpactoInfra = {
  afecta_todo?: boolean;
  proyectos?: { proyecto_id: string; nombre: string; modulos?: string[] | null; critica?: boolean }[];
};

export type IdeaInfra = { titulo: string; detalle: string };

/* -------------------------------- Lecturas -------------------------------- */

export function useEstadoInfra(habilitado = true) {
  return useQuery({
    queryKey: clavesInfra.estado,
    enabled: habilitado,
    queryFn: () => llamar<EstadoInfraestructura>({ accion: "estado" }),
  });
}

export function useHistoricoInfra(servicioId: string | null, limite = 144) {
  return useQuery({
    queryKey: clavesInfra.historico(servicioId ?? "ninguno"),
    enabled: Boolean(servicioId),
    queryFn: () => llamar<HistoricoInfra>({ accion: "historico", servicio_id: servicioId, limite }),
  });
}

export function useImpactoInfra(servicioId: string | null) {
  return useQuery({
    queryKey: clavesInfra.impacto(servicioId ?? "ninguno"),
    enabled: Boolean(servicioId),
    queryFn: () => llamar<ImpactoInfra>({ accion: "impacto", servicio_id: servicioId }),
  });
}

export function useIdeasInfra(habilitado = true) {
  return useQuery({
    queryKey: clavesInfra.ideas,
    enabled: habilitado,
    queryFn: () => llamar<{ ideas?: IdeaInfra[] }>({ accion: "ideas" }),
  });
}

/** Mantiene la pantalla al día mientras el vigilante comprueba los servicios. */
export function useRealtimeInfra(activo = true) {
  const qc = useQueryClient();
  React.useEffect(() => {
    if (!activo) return;
    const refrescar = () => {
      void qc.invalidateQueries({ queryKey: clavesInfra.estado });
    };
    const canal = supabase.channel("nexdeveloper-infraestructura");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "infra_servicios" }, refrescar);
    canal.on("postgres_changes", { event: "*", schema: "public", table: "infra_incidencias" }, refrescar);
    canal.on("postgres_changes", { event: "*", schema: "public", table: "infra_sincronizacion" }, () => {
      refrescar();
      void qc.invalidateQueries({ queryKey: claves.proyectos });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [activo, qc]);
}

/* -------------------------------- Acciones -------------------------------- */

function useRefrescarInfra() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: clavesInfra.estado });
    void qc.invalidateQueries({ queryKey: ["infra_historico"] });
    void qc.invalidateQueries({ queryKey: ["infra_impacto"] });
    void qc.invalidateQueries({ queryKey: claves.proyectos });
  };
}

export function useComprobarInfra() {
  const refrescar = useRefrescarInfra();
  const seguirTrabajo = useSeguirTrabajo('Comprobando la infraestructura');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: (servicioId?: string) =>
      llamar({ accion: "comprobar", ...(servicioId ? { servicio_id: servicioId } : {}) }),
    onSuccess: () => {
      refrescar();
      toast.success("Comprobación terminada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDescubrirInfra() {
  const refrescar = useRefrescarInfra();
  return useMutation({
    mutationFn: () => llamar<{ creados?: unknown[] }>({ accion: "descubrir" }),
    onSuccess: (r) => {
      refrescar();
      const n = (r.creados ?? []).length;
      toast.success(n > 0 ? `${n} servicio(s) nuevos añadidos.` : "No hay servicios nuevos que añadir.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSincronizarInfra() {
  const refrescar = useRefrescarInfra();
  const seguirTrabajo = useSeguirTrabajo('Comprobando la sincronización');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: (proyectoId?: string) =>
      llamar({ accion: "sincronizar", ...(proyectoId ? { proyecto_id: proyectoId } : {}) }),
    onSuccess: () => {
      refrescar();
      toast.success("Sincronización comprobada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type DatosServicioInfra = {
  id?: string;
  nombre: string;
  tipo: TipoServicioInfra;
  proveedor?: string | null;
  url?: string | null;
  referencia?: string | null;
  metodo?: Record<string, unknown> | null;
  ambito?: AmbitoInfra;
  critico?: boolean;
  activo?: boolean;
  coste_mensual?: number | null;
  renovacion_el?: string | null;
  notas?: string | null;
  dependencias?: { proyecto_id: string; modulos: string[]; critica: boolean }[];
};

export function useGuardarServicioInfra() {
  const refrescar = useRefrescarInfra();
  return useMutation({
    mutationFn: (datos: DatosServicioInfra) => llamar({ accion: "servicio_guardar", ...datos }),
    onSuccess: () => {
      refrescar();
      toast.success("Servicio guardado y comprobado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBorrarServicioInfra() {
  const refrescar = useRefrescarInfra();
  return useMutation({
    mutationFn: (id: string) => llamar({ accion: "servicio_borrar", id }),
    onSuccess: () => {
      refrescar();
      toast.success("Servicio borrado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGuardarConfigInfra() {
  const refrescar = useRefrescarInfra();
  return useMutation({
    mutationFn: (datos: Partial<InfraConfigRow>) => llamar({ accion: "configurar", ...datos }),
    onSuccess: () => {
      refrescar();
      toast.success("Configuración guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useActualizarIncidenciaInfra() {
  const refrescar = useRefrescarInfra();
  return useMutation({
    mutationFn: (datos: { id: string; estado?: EstadoIncidenciaInfra; notas?: string }) =>
      llamar({ accion: "incidencia", ...datos }),
    onSuccess: () => {
      refrescar();
      toast.success("Incidencia actualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAdoptarVersionRepo() {
  const refrescar = useRefrescarInfra();
  return useMutation({
    mutationFn: (proyectoId: string) => llamar({ accion: "adoptar_version", proyecto_id: proyectoId }),
    onSuccess: () => {
      refrescar();
      toast.success("La versión del repositorio ya es la del proyecto.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------------------- Utilidades ------------------------------- */

/** Duración en texto entre dos momentos (o hasta ahora). */
export function duracionDesde(inicio: string, fin?: string | null) {
  const ms = (fin ? new Date(fin).getTime() : Date.now()) - new Date(inicio).getTime();
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  if (h < 24) return `${h} h ${resto} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

/** Peor semáforo de una lista. */
export function peorSemaforo(estados: Semaforo[]): Semaforo {
  if (estados.includes("rojo")) return "rojo";
  if (estados.includes("ambar")) return "ambar";
  if (estados.includes("verde")) return "verde";
  return "gris";
}
