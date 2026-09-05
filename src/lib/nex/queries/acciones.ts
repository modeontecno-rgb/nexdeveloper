import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AccionRow, Json, TipoAccion } from "../db-types";
import { supabase } from "../supabase";
import { claves } from "./claves";
import { nombreDelUsuario, registrarActividad } from "./mutaciones";

export interface EntradaAccion {
  proyectoId: string | null;
  tareaId?: string | null;
  integracionId?: string | null;
  tipo: TipoAccion;
  titulo: string;
  parametros: Record<string, Json>;
  requiereAprobacion: boolean;
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: claves.acciones });
  void queryClient.invalidateQueries({ queryKey: claves.actividad });
}

export function useCrearAccion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: EntradaAccion) => {
      const res = await supabase
        .from("acciones")
        .insert({
          proyecto_id: entrada.proyectoId,
          tarea_id: entrada.tareaId ?? null,
          integracion_id: entrada.integracionId ?? null,
          tipo: entrada.tipo,
          titulo: entrada.titulo,
          parametros: entrada.parametros,
          requiere_aprobacion: entrada.requiereAprobacion,
          estado: entrada.requiereAprobacion ? "pendiente_aprobacion" : "aprobada",
        })
        .select("*")
        .single();
      if (res.error) throw new Error(res.error.message);
      const accion = res.data as unknown as AccionRow;
      await registrarActividad(entrada.proyectoId, "cambio", `Acción creada: ${entrada.titulo}`, {
        referencia_tabla: "acciones",
        referencia_id: accion.id,
      });
      return accion;
    },
    onSuccess: (accion) => {
      invalidar(queryClient);
      toast.success(
        accion.requiere_aprobacion ? "Acción creada. Necesita tu aprobación." : "Acción creada y lista para ejecutar.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResolverAccion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ accion, decision }: { accion: AccionRow; decision: "aprobada" | "cancelada" }) => {
      const quien = await nombreDelUsuario();
      const res = await supabase
        .from("acciones")
        .update({
          estado: decision,
          aprobada_el: decision === "aprobada" ? new Date().toISOString() : null,
          aprobada_por: decision === "aprobada" ? quien : null,
        })
        .eq("id", accion.id)
        .select("id")
        .maybeSingle();
      if (res.error) throw new Error(res.error.message);
      await registrarActividad(
        accion.proyecto_id,
        decision === "aprobada" ? "aprobacion" : "decision",
        decision === "aprobada" ? `Acción aprobada: ${accion.titulo}` : `Acción rechazada: ${accion.titulo}`,
        { referencia_tabla: "acciones", referencia_id: accion.id },
      );
    },
    onSuccess: () => {
      invalidar(queryClient);
      toast.success("Decisión registrada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEjecutarAccion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ accionId, valorSecreto }: { accionId: string; valorSecreto?: string }) => {
      const cuerpo: Record<string, string> = { accion_id: accionId };
      if (valorSecreto) cuerpo["valor_secreto"] = valorSecreto;
      const { data, error } = await supabase.functions.invoke("ejecutar-accion", { body: cuerpo });
      if (error) throw new Error(mensajeAmable(error.message));
      const respuesta = data as { ok?: boolean; error?: string } | null;
      if (!respuesta?.ok) throw new Error(mensajeAmable(respuesta?.error ?? "La acción no se ha podido ejecutar."));
      return respuesta;
    },
    onSuccess: () => {
      invalidar(queryClient);
      toast.success("Acción ejecutada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Traduce los fallos técnicos más comunes a algo que se entienda. */
function mensajeAmable(mensaje: string) {
  const texto = mensaje.toLowerCase();
  if (texto.includes("not found") && texto.includes("function")) {
    return "El servicio que ejecuta las acciones no está disponible ahora mismo.";
  }
  if (texto.includes("token") || texto.includes("unauthorized") || texto.includes("401")) {
    return "Falta la credencial del servicio o ha caducado. Revísala en los secretos del servidor.";
  }
  if (texto.includes("network") || texto.includes("failed to fetch")) {
    return "No se ha podido contactar con el servicio. Inténtalo de nuevo en unos segundos.";
  }
  return mensaje;
}
