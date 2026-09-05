import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { supabase } from "../supabase";
import { claves } from "./claves";

const TABLAS: { tabla: string; clave: readonly string[] }[] = [
  { tabla: "proyectos", clave: claves.proyectos },
  { tabla: "tareas", clave: claves.tareas },
  { tabla: "ordenes", clave: claves.ordenes },
  { tabla: "mensajes", clave: claves.mensajes },
  { tabla: "actividad", clave: claves.actividad },
  { tabla: "alertas", clave: claves.alertas },
];

/** Mantiene la interfaz al día con los cambios que ocurren en la base de datos. */
export function useRealtime(activo: boolean) {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!activo) return;

    const canal = supabase.channel("nexdeveloper-cambios");
    for (const { tabla, clave } of TABLAS) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: tabla }, () => {
        void queryClient.invalidateQueries({ queryKey: clave });
        if (tabla === "tareas" || tabla === "ordenes") {
          void queryClient.invalidateQueries({ queryKey: claves.resumenProyectos });
          void queryClient.invalidateQueries({ queryKey: claves.cargaAgentes });
        }
      });
    }
    void canal.subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [activo, queryClient]);
}
