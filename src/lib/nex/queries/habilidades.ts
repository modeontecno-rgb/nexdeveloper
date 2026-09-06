import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type {
  CategoriaHabilidad,
  HabilidadRow,
  HabilidadUsoRow,
  HabilidadesConfigRow,
  HabilidadesResumenRow,
  Prioridad,
} from "../db-types";
import { supabase } from "../supabase";

export const clavesHabilidades = {
  lista: ["habilidades"] as const,
  usos: ["habilidades_usos"] as const,
  config: ["habilidades_config"] as const,
  resumen: ["v_habilidades_resumen"] as const,
  ping: ["habilidades_ping"] as const,
};

export const ETIQUETA_CATEGORIA: Record<CategoriaHabilidad, string> = {
  diseno: "Diseño",
  backend: "Backend",
  datos: "Datos",
  documentos: "Documentos",
  comercial: "Comercial",
  calidad: "Calidad",
  devops: "Infraestructura",
  ia: "Inteligencia artificial",
  gestion: "Gestión",
  otro: "Otras",
};

export const COLOR_CATEGORIA: Record<CategoriaHabilidad, string> = {
  diseno: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
  backend: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  datos: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  documentos: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  comercial: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  calidad: "border-teal-500/40 bg-teal-500/10 text-teal-300",
  devops: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
  ia: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  gestion: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  otro: "border-border bg-surface text-muted-foreground",
};

export const CATEGORIAS = Object.keys(ETIQUETA_CATEGORIA) as CategoriaHabilidad[];

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("habilidades", { body: cuerpo });
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

/** Comprueba el acceso al repositorio de habilidades. */
export function usePingHabilidades(habilitado = true) {
  return useQuery({
    queryKey: clavesHabilidades.ping,
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("habilidades", { body: {} });
      if (error) throw new Error(error.message);
      return (data ?? {}) as {
        ok?: boolean;
        github?: boolean;
        repo_propias?: string | null;
        repo_externas?: string | null;
        repo_ok?: boolean;
      };
    },
  });
}

export function useHabilidades() {
  return useQuery({
    queryKey: clavesHabilidades.lista,
    queryFn: async () => {
      const { data, error } = await supabase.from("habilidades").select("*").order("nombre");
      if (error) throw new Error(error.message);
      return (data ?? []) as HabilidadRow[];
    },
  });
}

export function useUsosHabilidades() {
  return useQuery({
    queryKey: clavesHabilidades.usos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habilidades_usos")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as HabilidadUsoRow[];
    },
  });
}

export function useHabilidadesConfig() {
  return useQuery({
    queryKey: clavesHabilidades.config,
    queryFn: async () => {
      const { data, error } = await supabase.from("habilidades_config").select("*").limit(1);
      if (error) throw new Error(error.message);
      return ((data ?? [])[0] ?? null) as HabilidadesConfigRow | null;
    },
  });
}

export function useResumenHabilidades() {
  return useQuery({
    queryKey: clavesHabilidades.resumen,
    queryFn: async () => {
      const { data, error } = await supabase.from("v_habilidades_resumen").select("*").limit(1);
      if (error) throw new Error(error.message);
      return ((data ?? [])[0] ?? null) as HabilidadesResumenRow | null;
    },
  });
}

function useInvalidar() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: clavesHabilidades.lista });
    void queryClient.invalidateQueries({ queryKey: clavesHabilidades.resumen });
    void queryClient.invalidateQueries({ queryKey: clavesHabilidades.usos });
    void queryClient.invalidateQueries({ queryKey: clavesHabilidades.config });
  };
}

/** Relee el repositorio de habilidades propias. */
export function useSincronizarHabilidades() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: () => llamar<{ total?: number; actualizadas?: number }>({ accion: "sincronizar" }),
    onSuccess: (r) => {
      invalidar();
      toast.success(`Sincronizadas ${r.total ?? 0} habilidades (${r.actualizadas ?? 0} actualizadas).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Busca habilidades nuevas en la red. */
export function useBarrerHabilidades() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: () => llamar<{ nuevas?: number }>({ accion: "barrer" }),
    onSuccess: (r) => {
      invalidar();
      if ((r.nuevas ?? 0) > 0) toast.success(`Se han encontrado ${r.nuevas} habilidades nuevas.`);
      else toast.info("No hay novedades esta vez.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type DatosHabilidad = {
  slug?: string;
  nombre: string;
  descripcion: string;
  instrucciones: string;
  categoria?: CategoriaHabilidad;
  etiquetas?: string[];
  muestra_url?: string;
  muestra_texto?: string;
};

/** Crea o edita una habilidad propia (base de datos y GitHub). */
export function useGuardarHabilidad() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (datos: DatosHabilidad) =>
      llamar<{ habilidad?: HabilidadRow; aviso?: string }>({ accion: "guardar", ...datos }),
    onSuccess: (r) => {
      invalidar();
      if (r.aviso) toast.warning(r.aviso);
      else toast.success("Habilidad guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Adopta (o descarta) una habilidad externa. */
export function useAdoptarHabilidad() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ habilidadId, descartar }: { habilidadId: string; descartar?: boolean }) =>
      llamar({ accion: "adoptar", habilidad_id: habilidadId, descartar: Boolean(descartar) }),
    onSuccess: (_r, v) => {
      invalidar();
      toast.success(v.descartar ? "Habilidad descartada." : "Habilidad adoptada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Cambios directos sobre una habilidad (valoración, estado…). */
export function useActualizarHabilidad() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ id, cambios }: { id: string; cambios: Partial<HabilidadRow> }) => {
      const { error } = await supabase.from("habilidades").update(cambios).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export type InvocacionHabilidad = {
  habilidadId: string;
  proyectoId?: string;
  instrucciones?: string;
  requiereAtencion?: boolean;
  prioridad?: Prioridad;
};

/** Crea una tarea en el proyecto aplicando la habilidad. */
export function useInvocarHabilidad() {
  const queryClient = useQueryClient();
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: InvocacionHabilidad) =>
      llamar<{ tarea_id?: string; prompt?: string }>({
        accion: "invocar",
        habilidad_id: v.habilidadId,
        ...(v.proyectoId ? { proyecto_id: v.proyectoId } : {}),
        ...(v.instrucciones ? { instrucciones: v.instrucciones } : {}),
        ...(v.requiereAtencion ? { requiere_atencion: true } : {}),
        ...(v.prioridad ? { prioridad: v.prioridad } : {}),
      }),
    onSuccess: () => {
      invalidar();
      void queryClient.invalidateQueries({ queryKey: ["tareas"] });
      void queryClient.invalidateQueries({ queryKey: ["v_tareas_atencion"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Guarda la configuración del barrido. */
export function useGuardarConfigHabilidades() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ id, cambios }: { id: string; cambios: Partial<HabilidadesConfigRow> }) => {
      const { error } = await supabase.from("habilidades_config").update(cambios).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidar();
      toast.success("Configuración guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Enlace al archivo dentro del repositorio de GitHub. */
export function enlaceArchivo(habilidad: HabilidadRow, ruta: string) {
  if (!habilidad.repositorio) return null;
  const base = `https://github.com/${habilidad.repositorio}/blob/main`;
  const carpeta = habilidad.ruta_repo ? `/${habilidad.ruta_repo.replace(/^\/+|\/+$/g, "")}` : "";
  return `${base}${carpeta}/${ruta.replace(/^\/+/, "")}`;
}
