import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CopiaConfigRow, CopiaDestinoRow, CopiaOrigenRow, CopiaRow } from "../db-types";
import { supabase } from "../supabase";

export const clavesCopias = {
  destinos: ["copias_destinos"] as const,
  config: ["copias_config"] as const,
  origenes: ["copias_origenes"] as const,
  historico: ["copias"] as const,
  lote: (loteId: string) => ["copias", "lote", loteId] as const,
  secretos: ["comprobar_secretos"] as const,
};

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("copias-generar", { body: cuerpo });
  if (error) throw new Error(error.message);
  const respuesta = data as ({ ok?: boolean; error?: string } & T) | null;
  if (!respuesta || respuesta.ok === false) throw new Error(respuesta?.error ?? "No se ha podido completar la operación.");
  return respuesta;
}

export function useDestinosCopias() {
  return useQuery({
    queryKey: clavesCopias.destinos,
    queryFn: async () => {
      const { data, error } = await supabase.from("v_copias_destinos").select("*").order("nombre");
      if (error) throw new Error(error.message);
      return (data ?? []) as CopiaDestinoRow[];
    },
  });
}

export function useConfigCopias() {
  return useQuery({
    queryKey: clavesCopias.config,
    queryFn: async () => {
      const { data, error } = await supabase.from("copias_config").select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as CopiaConfigRow | null;
    },
  });
}

export function useOrigenesCopias() {
  return useQuery({
    queryKey: clavesCopias.origenes,
    queryFn: async () => {
      const { data, error } = await supabase.from("copias_origenes").select("*").order("nombre");
      if (error) throw new Error(error.message);
      return (data ?? []) as CopiaOrigenRow[];
    },
  });
}

export function useHistoricoCopias() {
  return useQuery({
    queryKey: clavesCopias.historico,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("copias")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as CopiaRow[];
    },
  });
}

/** Sigue en vivo las copias de un lote hasta que ninguna queda pendiente. */
export function useLoteCopias(loteId: string | null) {
  return useQuery({
    queryKey: clavesCopias.lote(loteId ?? "ninguno"),
    enabled: Boolean(loteId),
    refetchInterval: (consulta) => {
      const filas = consulta.state.data as CopiaRow[] | undefined;
      if (!filas || filas.length === 0) return 5000;
      return filas.some((f) => f.estado === "pendiente" || f.estado === "en_curso") ? 5000 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("copias")
        .select("*")
        .eq("lote_id", loteId as string)
        .order("creado_el");
      if (error) throw new Error(error.message);
      return (data ?? []) as CopiaRow[];
    },
  });
}

export function useGuardarDestino() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      nombre: string;
      url_servidor: string;
      bucket: string;
      region: string;
      ruta_prefijo: string | null;
      usuario: string;
      secreto?: string;
    }) => {
      const { secreto, id, ...campos } = input;
      let destinoId = id;
      if (destinoId) {
        const { error } = await supabase.from("copias_destinos").update(campos).eq("id", destinoId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from("copias_destinos")
          .insert({ ...campos, tipo: "s3", activo: true })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        destinoId = (data as { id: string }).id;
      }
      if (secreto) {
        const { error } = await supabase.rpc("guardar_secreto_copias", {
          p_destino_id: destinoId,
          p_secreto: secreto,
        });
        if (error) throw new Error(error.message);
      }
      return destinoId as string;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: clavesCopias.destinos }),
  });
}

export function useProbarDestino() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (destinoId: string) => llamar<{ mensaje?: string }>({ accion: "probar_destino", destino_id: destinoId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clavesCopias.destinos }),
  });
}

export function useGuardarConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cambios: Partial<CopiaConfigRow>) => {
      const { data: sesion } = await supabase.auth.getUser();
      const userId = sesion.user?.id;
      if (!userId) throw new Error("No hay sesión activa.");
      const { error } = await supabase
        .from("copias_config")
        .upsert({ ...cambios, user_id: userId } as never, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: clavesCopias.config }),
  });
}

export function useRefrescarOrigenes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => llamar<{ bases_datos: number; repositorios: number }>({ accion: "refrescar_origenes" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clavesCopias.origenes }),
  });
}

export function useImportarProyectos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => llamar<{ creados: number }>({ accion: "importar_proyectos" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["proyectos"] });
      void qc.invalidateQueries({ queryKey: clavesCopias.origenes });
    },
  });
}

export function useFirmarDescarga() {
  return useMutation({
    mutationFn: (copiaId: string) => llamar<{ url: string }>({ accion: "firmar_descarga", copia_id: copiaId }),
  });
}

export function useLanzarCopias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tipos: string[]) => {
      const { data, error } = await supabase.rpc("lanzar_mis_copias", { p_tipos: tipos });
      if (error) throw new Error(error.message);
      return data as unknown as string;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: clavesCopias.historico }),
  });
}

export type ComprobacionSecretos = {
  ok: boolean;
  GITHUB_TOKEN: boolean;
  CUENTA_SUPABASE_TOKEN: boolean;
  SENTRY_DSN: boolean;
  SENTRY_AUTH_TOKEN: boolean;
  CANVA_CLIENT_ID: boolean;
  CANVA_CLIENT_SECRET: boolean;
  github?: { ok: boolean; usuario?: string; permisos?: string[] };
  supabase?: { ok: boolean; proyectos?: number };
};

export function useComprobarSecretos(habilitado: boolean) {
  return useQuery({
    queryKey: clavesCopias.secretos,
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("comprobar-secretos", { body: {} });
      if (error) throw new Error(error.message);
      return data as ComprobacionSecretos;
    },
  });
}

/** Tamaño legible en español. */
export function tamanoLegible(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "—";
  const unidades = ["B", "KB", "MB", "GB", "TB"];
  let valor = bytes;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i += 1;
  }
  return `${valor.toFixed(valor >= 10 || i === 0 ? 0 : 1)} ${unidades[i]}`;
}

/** Días transcurridos desde la última copia correcta. */
export function diasDesdeUltimaCorrecta(copias: CopiaRow[]) {
  const correctas = copias.filter((c) => c.estado === "ok" && c.terminada_el);
  if (correctas.length === 0) return null;
  const masReciente = correctas.reduce((a, b) =>
    (a.terminada_el ?? "") > (b.terminada_el ?? "") ? a : b,
  );
  const ms = Date.now() - new Date(masReciente.terminada_el as string).getTime();
  return Math.floor(ms / 86_400_000);
}
