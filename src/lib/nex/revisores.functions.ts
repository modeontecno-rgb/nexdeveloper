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
  .handler(async (): Promise<PanelRevisores> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cuentas reales (hasta 1000) con su último acceso.
    const usuarios: { id: string; email: string; creado_el: string | null; ultimo_acceso: string | null }[] = [];
    for (let pagina = 1; pagina <= 10; pagina += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: pagina, perPage: 100 });
      if (error) throw new Error(error.message);
      const lista = data?.users ?? [];
      for (const u of lista) {
        usuarios.push({
          id: u.id,
          email: u.email ?? "sin correo",
          creado_el: u.created_at ?? null,
          ultimo_acceso: u.last_sign_in_at ?? null,
        });
      }
      if (lista.length < 100) break;
    }

    const { data: manualesBrutos, error: errorManuales } = await supabaseAdmin
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

    const { data: proyectosBrutos, error: errorProyectos } = await supabaseAdmin.from("proyectos" as never).select("id,nombre");
    if (errorProyectos) throw new Error(errorProyectos.message);
    const proyectos = (proyectosBrutos ?? []) as unknown as { id: string; nombre: string }[];
    const nombreProyecto = new Map(proyectos.map((p) => [p.id, p.nombre]));

    const correoDe = new Map(usuarios.map((u) => [u.id, u.email]));
    const porUsuario = new Map<string, RevisorResumen>();
    for (const u of usuarios) {
      porUsuario.set(u.id, {
        ...u,
        manuales_totales: 0,
        manuales_revisados: 0,
        correcciones_totales: 0,
        ultima_revision: null,
      });
    }

    const insignias: InsigniaRevision[] = [];
    for (const m of manuales ?? []) {
      const fila = porUsuario.get(m.user_id as string);
      if (fila) fila.manuales_totales += 1;
      const revision = (m.revision ?? null) as RevisionManual | null;
      const revisadoEl = (m.revisado_el ?? null) as string | null;
      if (!revision || !revisadoEl) continue;
      if (fila) {
        fila.manuales_revisados += 1;
        fila.correcciones_totales += revision.correcciones ?? 0;
        if (!fila.ultima_revision || revisadoEl > fila.ultima_revision) fila.ultima_revision = revisadoEl;
      }
      insignias.push({
        manual_id: m.id as string,
        titulo: (m.titulo as string) ?? "Manual",
        proyecto: nombreProyecto.get(m.proyecto_id as string) ?? null,
        revisor: correoDe.get(m.user_id as string) ?? "desconocido",
        correcciones: revision.correcciones ?? 0,
        capitulos: revision.capitulos ?? 0,
        nivel: revision.nivel ?? null,
        revisado_el: revisadoEl,
      });
    }
    insignias.sort((a, b) => b.revisado_el.localeCompare(a.revisado_el));

    const revisores = [...porUsuario.values()].sort((a, b) => {
      const accesoA = a.ultimo_acceso ?? "";
      const accesoB = b.ultimo_acceso ?? "";
      return accesoB.localeCompare(accesoA);
    });

    return {
      revisores,
      insignias,
      totales: {
        cuentas: usuarios.length,
        han_entrado: usuarios.filter((u) => u.ultimo_acceso).length,
        manuales: (manuales ?? []).length,
        revisados: insignias.length,
        correcciones: insignias.reduce((suma, i) => suma + i.correcciones, 0),
      },
    };
  });
