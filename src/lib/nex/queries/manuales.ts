import { useSeguirTrabajo } from "@/components/nex/indicador-trabajo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type { CapituloManual, ManualRow, ManualesConfigRow, PublicoManual } from "../db-types";
import { supabase } from "../supabase";

export const clavesManuales = {
  estado: ["manuales_estado"] as const,
  lista: ["manuales"] as const,
  uno: (id: string) => ["manual", id] as const,
};

export const PUBLICOS_MANUAL: { valor: PublicoManual; titulo: string; descripcion: string }[] = [
  {
    valor: "usuario",
    titulo: "Usuario final",
    descripcion: "Cómo se usa la aplicación en el día a día, pantalla a pantalla y sin tecnicismos.",
  },
  {
    valor: "administrador",
    titulo: "Administrador",
    descripcion: "Configuración, permisos, mantenimiento y resolución de incidencias.",
  },
  {
    valor: "comercial",
    titulo: "Comercial",
    descripcion: "Qué resuelve el producto, ventajas y argumentos para presentarlo a un cliente.",
  },
];

export const ETIQUETA_PUBLICO_MANUAL: Record<PublicoManual, string> = {
  usuario: "Usuario final",
  administrador: "Administrador",
  comercial: "Comercial",
};

export const ETIQUETA_ESTADO_MANUAL: Record<ManualRow["estado"], string> = {
  borrador: "Borrador",
  preparando: "Leyendo pantallas",
  redactando: "Redactando",
  revisando: "Revisando redacción",
  publicando: "Componiendo",
  listo: "Listo",
  error: "Error",
};

export const PASOS_MANUAL: ManualRow["estado"][] = ["preparando", "redactando", "revisando", "publicando", "listo"];

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("manuales", { body: cuerpo });
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

export type EstadoManuales = {
  ok?: boolean;
  config?: ManualesConfigRow | null;
  ia?: boolean;
  github?: boolean;
  proyectian?: boolean;
  almacen?: boolean;
  perfil_estilo?: boolean;
  revisor?: boolean;
};

export function useEstadoManuales(habilitado = true) {
  return useQuery({
    queryKey: clavesManuales.estado,
    enabled: habilitado,
    retry: false,
    queryFn: async () => {
      const r = await llamar<EstadoManuales>({ accion: "estado" });
      return r as EstadoManuales;
    },
  });
}

export function useManuales(proyectoId?: string, publico?: PublicoManual) {
  return useQuery({
    queryKey: [...clavesManuales.lista, proyectoId ?? "todos", publico ?? "todos"],
    queryFn: async () => {
      let consulta = supabase.from("manuales").select("*").order("creado_el", { ascending: false }).limit(200);
      if (proyectoId) consulta = consulta.eq("proyecto_id", proyectoId);
      if (publico) consulta = consulta.eq("publico", publico);
      const { data, error } = await consulta;
      if (error) throw new Error(error.message);
      return (data ?? []) as ManualRow[];
    },
  });
}

export function useManual(id: string | null) {
  return useQuery({
    queryKey: clavesManuales.uno(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("manuales").select("*").eq("id", id!).limit(1);
      if (error) throw new Error(error.message);
      return ((data ?? [])[0] ?? null) as ManualRow | null;
    },
  });
}

/** Sigue en directo el avance de la generación de los manuales. */
export function useRealtimeManuales(activo: boolean) {
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!activo) return;
    const canal = supabase.channel("nexdeveloper-manuales");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "manuales" }, () => {
      void queryClient.invalidateQueries({ queryKey: clavesManuales.lista });
      void queryClient.invalidateQueries({ queryKey: ["manual"] });
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
    void queryClient.invalidateQueries({ queryKey: clavesManuales.lista });
    void queryClient.invalidateQueries({ queryKey: ["manual"] });
    void queryClient.invalidateQueries({ queryKey: clavesManuales.estado });
    void queryClient.invalidateQueries({ queryKey: ["documentos_nex"] });
  };
}

export type PeticionManual = {
  proyectoId: string;
  publico: PublicoManual;
  titulo?: string;
  version?: string;
};

/** Arranca la generación del manual (sigue sola: se ve por Realtime). */
export function useGenerarManual() {
  const invalidar = useInvalidar();
  const seguirTrabajo = useSeguirTrabajo('Generando el manual');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: (v: PeticionManual) =>
      llamar<{ manual?: ManualRow; manual_id?: string }>({
        accion: "generar",
        proyecto_id: v.proyectoId,
        publico: v.publico,
        ...(v.titulo ? { titulo: v.titulo } : {}),
        ...(v.version ? { version: v.version } : {}),
      }),
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReintentarManual() {
  const invalidar = useInvalidar();
  const seguirTrabajo = useSeguirTrabajo('Reintentando el manual');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: (manualId: string) => llamar({ accion: "reintentar", manual_id: manualId }),
    onSuccess: () => {
      invalidar();
      toast.success("Se ha reanudado el manual.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Lanza la revisión de redacción de un manual ya generado. */
export function useRevisarManual() {
  const invalidar = useInvalidar();
  const seguirTrabajo = useSeguirTrabajo('Revisando la redacción');
  return useMutation({
    onMutate: seguirTrabajo.empezar,
    onSettled: seguirTrabajo.acabar,
    mutationFn: (manualId: string) => llamar({ accion: "revisar", manual_id: manualId }),
    onSuccess: () => {
      invalidar();
      toast.success("Revisión de redacción en marcha.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRegenerarCapitulo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { manualId: string; orden: number; titulo?: string; objetivo?: string }) =>
      llamar({
        accion: "regenerar_capitulo",
        manual_id: v.manualId,
        orden: v.orden,
        ...(v.titulo ? { titulo: v.titulo } : {}),
        ...(v.objetivo ? { objetivo: v.objetivo } : {}),
      }),
    onSuccess: () => {
      invalidar();
      toast.success("Capítulo vuelto a redactar.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEditarCapitulo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { manualId: string; orden: number; titulo?: string; textoMd?: string; capturaUrl?: string }) =>
      llamar({
        accion: "editar_capitulo",
        manual_id: v.manualId,
        orden: v.orden,
        ...(v.titulo !== undefined ? { titulo: v.titulo } : {}),
        ...(v.textoMd !== undefined ? { texto_md: v.textoMd } : {}),
        ...(v.capturaUrl !== undefined ? { captura_url: v.capturaUrl } : {}),
      }),
    onSuccess: () => {
      invalidar();
      toast.success("Capítulo guardado y manual recompuesto.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEnlaceManual() {
  return useMutation({
    mutationFn: (v: { manualId: string; formato?: "html" | "md" | "pdf" }) =>
      llamar<{ url?: string }>({
        accion: "enlace",
        manual_id: v.manualId,
        ...(v.formato ? { formato: v.formato } : {}),
      }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBorrarManual() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (manualId: string) => llamar({ accion: "borrar", manual_id: manualId }),
    onSuccess: () => {
      invalidar();
      toast.success("Manual borrado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type CambiosConfigManuales = Partial<Omit<ManualesConfigRow, "id" | "user_id">>;

export function useGuardarConfigManuales() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (cambios: CambiosConfigManuales) => llamar({ accion: "configurar", ...cambios }),
    onSuccess: () => {
      invalidar();
      toast.success("Configuración de manuales guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function capitulosOrdenados(manual: ManualRow | null | undefined): CapituloManual[] {
  return [...(manual?.capitulos ?? [])].sort((a, b) => a.orden - b.orden);
}

/** Abre el HTML del manual en una pestaña nueva; opcionalmente lanza la impresión. */
export function abrirHtml(html: string, imprimir = false) {
  const ventana = window.open("", "_blank");
  if (!ventana) return false;
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
  if (imprimir) {
    ventana.onload = () => ventana.print();
    window.setTimeout(() => {
      try {
        ventana.print();
      } catch {
        /* el usuario puede imprimir a mano */
      }
    }, 800);
  }
  return true;
}

/** Descarga el Markdown del manual como archivo. */
export function descargarMarkdown(nombre: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `${nombre.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.md`;
  enlace.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
