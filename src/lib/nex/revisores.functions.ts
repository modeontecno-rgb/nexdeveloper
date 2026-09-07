import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RevisionManual } from "./db-types";

export type RevisorResumen = {
  id: string;
  email: string;
  creado_el: string | null;
  ultimo_acceso: string | null;
  manuales_totales: number;
  manuales_revisados: number;
  correcciones_totales: number;
  ultima_revision: string | null;
};

export type InsigniaRevision = {
  manual_id: string;
  titulo: string;
  proyecto: string | null;
  revisor: string;
  correcciones: number;
  capitulos: number;
  nivel: string | null;
  revisado_el: string;
};

export type PanelRevisores = {
  revisores: RevisorResumen[];
  insignias: InsigniaRevision[];
  totales: {
    cuentas: number;
    han_entrado: number;
    manuales: number;
    revisados: number;
    correcciones: number;
  };
};

/**
 * Panel de revisores: cuentas que han iniciado sesión y actividad de
 * revisión de manuales. Lectura privilegiada de solo lectura; requiere
 * sesión iniciada.
 */
export const obtenerPanelRevisores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PanelRevisores> => {
    const supabase = context.supabase;
    const correoPropio = (context.claims["email"] as string | undefined) ?? "tu cuenta";

    const { data: manualesBrutos, error: errorManuales } = await supabase
      .from("manuales" as never)
      .select("id,user_id,titulo,proyecto_id,revision,revisado_el");
    if (errorManuales) throw new Error(errorManuales.message);
    const manuales = (manualesBrutos ?? []) as unknown as {
      id: string;
      user_id: string;
      titulo: string;
      proyecto_id: string;
      revision: RevisionManual | null;
      revisado_el: string | null;
    }[];

    const { data: proyectosBrutos, error: errorProyectos } = await supabase
      .from("proyectos" as never)
      .select("id,nombre");
    if (errorProyectos) throw new Error(errorProyectos.message);
    const proyectos = (proyectosBrutos ?? []) as unknown as { id: string; nombre: string }[];
    const nombreProyecto = new Map(proyectos.map((p) => [p.id, p.nombre]));

    const porUsuario = new Map<string, RevisorResumen>();
    const asegurar = (id: string): RevisorResumen => {
      const existente = porUsuario.get(id);
      if (existente) return existente;
      const nuevo: RevisorResumen = {
        id,
        email: id === context.userId ? correoPropio : "otra cuenta",
        creado_el: null,
        ultimo_acceso: null,
        manuales_totales: 0,
        manuales_revisados: 0,
        correcciones_totales: 0,
        ultima_revision: null,
      };
      porUsuario.set(id, nuevo);
      return nuevo;
    };
    asegurar(context.userId);

    const insignias: InsigniaRevision[] = [];
    for (const m of manuales) {
      const fila = asegurar(m.user_id);
      fila.manuales_totales += 1;
      const revision = m.revision ?? null;
      const revisadoEl = m.revisado_el ?? null;
      if (!revision || !revisadoEl) continue;
      fila.manuales_revisados += 1;
      fila.correcciones_totales += revision.correcciones ?? 0;
      if (!fila.ultima_revision || revisadoEl > fila.ultima_revision) fila.ultima_revision = revisadoEl;
      insignias.push({
        manual_id: m.id,
        titulo: m.titulo ?? "Manual",
        proyecto: nombreProyecto.get(m.proyecto_id) ?? null,
        revisor: fila.email,
        correcciones: revision.correcciones ?? 0,
        capitulos: revision.capitulos ?? 0,
        nivel: revision.nivel ?? null,
        revisado_el: revisadoEl,
      });
    }
    insignias.sort((a, b) => b.revisado_el.localeCompare(a.revisado_el));

    const revisores = [...porUsuario.values()].sort(
      (a, b) => (b.ultima_revision ?? "").localeCompare(a.ultima_revision ?? ""),
    );

    return {
      revisores,
      insignias,
      totales: {
        cuentas: revisores.length,
        han_entrado: revisores.filter((r) => r.ultima_revision).length,
        manuales: manuales.length,
        revisados: insignias.length,
        correcciones: insignias.reduce((suma, i) => suma + i.correcciones, 0),
      },
    };
  });

