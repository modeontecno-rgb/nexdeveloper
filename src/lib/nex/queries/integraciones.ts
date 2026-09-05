import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { IntegracionRow, TipoIntegracion } from "../db-types";
import { crearSlug } from "../labels";
import { supabase } from "../supabase";
import { claves } from "./claves";

export interface EntradaIntegracion {
  id?: string | undefined;
  nombre: string;
  codigo: string;
  tipo: TipoIntegracion;
  descripcion: string;
  urlPanel: string;
  urlDocs: string;
  capacidades: string[];
  requiereAprobacion: boolean;
  /** Solo el nombre de cada secreto: nunca se guarda su valor. */
  referencias: string[];
}

export function codigoDesdeNombre(nombre: string) {
  return crearSlug(nombre).replace(/-/g, "_");
}

function refrescar(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: claves.integraciones });
  void queryClient.invalidateQueries({ queryKey: claves.credenciales });
}

export function useGuardarIntegracion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: EntradaIntegracion) => {
      const campos = {
        nombre: entrada.nombre,
        codigo: entrada.codigo || codigoDesdeNombre(entrada.nombre),
        tipo: entrada.tipo,
        descripcion: entrada.descripcion || null,
        url_panel: entrada.urlPanel || null,
        url_docs: entrada.urlDocs || null,
        capacidades: entrada.capacidades,
        requiere_aprobacion: entrada.requiereAprobacion,
      };
      const res = entrada.id
        ? await supabase.from("integraciones").update(campos).eq("id", entrada.id).select("*").single()
        : await supabase.from("integraciones").insert(campos).select("*").single();
      if (res.error) throw new Error(res.error.message);
      const integracion = res.data as unknown as IntegracionRow;

      const nuevas = entrada.referencias.map((r) => r.trim()).filter(Boolean);
      if (nuevas.length > 0) {
        const { data: existentes } = await supabase
          .from("credenciales_ref")
          .select("referencia")
          .eq("integracion_id", integracion.id);
        const ya = new Set((existentes ?? []).map((c) => c.referencia));
        const pendientes = nuevas
          .filter((r) => !ya.has(r))
          .map((referencia) => ({
            integracion_id: integracion.id,
            referencia,
            ubicacion: "supabase_secret" as const,
            configurado: false,
          }));
        if (pendientes.length > 0) {
          const ins = await supabase.from("credenciales_ref").insert(pendientes);
          if (ins.error) throw new Error(ins.error.message);
        }
      }
      return integracion;
    },
    onSuccess: () => {
      refrescar(queryClient);
      toast.success("Integración guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBorrarIntegracion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (integracion: IntegracionRow) => {
      if (integracion.es_predefinida) throw new Error("Las integraciones predefinidas no se pueden borrar.");
      const res = await supabase.from("integraciones").delete().eq("id", integracion.id);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      refrescar(queryClient);
      toast.success("Integración eliminada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAsignarIntegracionProyecto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      integracionId,
      proyectoId,
      activar,
    }: {
      integracionId: string;
      proyectoId: string;
      activar: boolean;
    }) => {
      const res = activar
        ? await supabase.from("integracion_proyectos").insert({ integracion_id: integracionId, proyecto_id: proyectoId })
        : await supabase
            .from("integracion_proyectos")
            .delete()
            .eq("integracion_id", integracionId)
            .eq("proyecto_id", proyectoId);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: claves.integracionProyectos });
      toast.success("Asignación actualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
