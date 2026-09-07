import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type { InfraServicioRow, Semaforo, TipoServicioInfra } from "../db-types";
import { supabase } from "../supabase";

export const clavesConexiones = {
  lista: ["conexiones"] as const,
};

/** Tipos de servicio que se pintan en la pantalla «Conexiones». */
export const TIPOS_CONEXION: TipoServicioInfra[] = [
  "conexion",
  "proveedor_ia",
  "s3",
  "sentry",
  "proyectian",
];

export const TEXTO_ESTADO: Record<Semaforo, string> = {
  verde: "Conectada",
  ambar: "Atención",
  rojo: "Caída",
  gris: "Sin configurar",
};

export const TONO_ESTADO: Record<Semaforo, string> = {
  verde: "text-success",
  ambar: "text-warning",
  rojo: "text-destructive",
  gris: "text-muted-foreground",
};

export const PUNTO_ESTADO: Record<Semaforo, string> = {
  verde: "bg-success",
  ambar: "bg-warning",
  rojo: "bg-destructive",
  gris: "bg-muted-foreground/50",
};

/** Dónde se configura cada tipo cuando la fila no lo indica. */
export const CONFIGURACION_POR_TIPO: Partial<Record<TipoServicioInfra, { donde: string; ruta?: string }>> = {
  proveedor_ia: { donde: "Ajustes → Proveedores de IA", ruta: "/ajustes/proveedores" },
  s3: { donde: "Copias de seguridad → Destinos", ruta: "/copias" },
  sentry: { donde: "Supabase → Edge Functions → Secrets → SENTRY_AUTH_TOKEN" },
  proyectian: { donde: "Proyectian", ruta: "/proyectian" },
};

export function textoEstado(estado: Semaforo): string {
  return TEXTO_ESTADO[estado] ?? TEXTO_ESTADO.gris;
}

/** Deja solo las filas que pertenecen a esta pantalla. */
export function filasVisibles(filas: InfraServicioRow[]): InfraServicioRow[] {
  return filas.filter((f) => f.activo !== false && TIPOS_CONEXION.includes(f.tipo));
}

export type ResumenConexiones = { verdes: number; ambar: number; rojos: number; grises: number };

export function resumenConexiones(filas: InfraServicioRow[]): ResumenConexiones {
  const r: ResumenConexiones = { verdes: 0, ambar: 0, rojos: 0, grises: 0 };
  for (const f of filas) {
    if (f.estado === "verde") r.verdes += 1;
    else if (f.estado === "ambar") r.ambar += 1;
    else if (f.estado === "rojo") r.rojos += 1;
    else r.grises += 1;
  }
  return r;
}

const ORDEN: Record<Semaforo, number> = { verde: 0, ambar: 1, rojo: 2, gris: 3 };

export function ordenarPorEstado(filas: InfraServicioRow[]): InfraServicioRow[] {
  return [...filas].sort(
    (a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.nombre.localeCompare(b.nombre, "es"),
  );
}

export function useConexiones() {
  return useQuery({
    queryKey: clavesConexiones.lista,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("infra_servicios")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      if (error) throw new Error(error.message);
      return filasVisibles((data ?? []) as unknown as InfraServicioRow[]);
    },
  });
}

/** Mantiene los semáforos al día mientras el vigilante comprueba. */
export function useRealtimeConexiones(activo = true) {
  const qc = useQueryClient();
  React.useEffect(() => {
    if (!activo) return;
    const canal = supabase.channel("nexdeveloper-conexiones");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "infra_servicios" }, () => {
      void qc.invalidateQueries({ queryKey: clavesConexiones.lista });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [activo, qc]);
}

export function useComprobarConexion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (servicioId?: string) => {
      const { data, error } = await supabase.functions.invoke("infraestructura", {
        body: { accion: "comprobar", ...(servicioId ? { servicio_id: servicioId } : {}) },
      });
      const respuesta = (data ?? null) as { ok?: boolean; error?: string } | null;
      if (error) throw new Error((error as Error).message);
      if (!respuesta || respuesta.ok === false) {
        throw new Error(respuesta?.error ?? "No se ha podido comprobar.");
      }
      return respuesta;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesConexiones.lista });
      void qc.invalidateQueries({ queryKey: ["infra_estado"] });
      toast.success("Comprobación terminada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
