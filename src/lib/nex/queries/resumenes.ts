import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import type { CanalResumen, ResumenRow, ResumenesConfigRow, TipoResumen } from "../db-types";
import { supabase } from "../supabase";

export const clavesResumenes = {
  lista: ["resumenes"] as const,
  config: ["resumenes_config"] as const,
  ping: ["resumenes_ping"] as const,
};

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("resumenes", { body: cuerpo });
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

export type PingResumenes = {
  ok?: boolean;
  canal_correo?: "gmail" | "resend" | "ninguno";
  resend?: boolean;
};

/** Comprueba por dónde puede salir el correo de los resúmenes. */
export function usePingResumenes(habilitado = true) {
  return useQuery({
    queryKey: clavesResumenes.ping,
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("resumenes", { body: {} });
      if (error) throw new Error(error.message);
      return (data ?? {}) as PingResumenes;
    },
  });
}

export function useResumenes() {
  return useQuery({
    queryKey: clavesResumenes.lista,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumenes")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as ResumenRow[];
    },
  });
}

export function useResumenesConfig() {
  return useQuery({
    queryKey: clavesResumenes.config,
    queryFn: async () => {
      const { data, error } = await supabase.from("resumenes_config").select("*").limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as ResumenesConfigRow | null;
    },
  });
}

export function useGuardarResumenesConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; cambios: Partial<Omit<ResumenesConfigRow, "user_id">> }) => {
      const { error } = await supabase.from("resumenes_config").update(input.cambios).eq("id", input.id);
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesResumenes.config });
    },
  });
}

export function useGenerarResumen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { tipo: TipoResumen; fecha?: string; enviar?: boolean; canales?: CanalResumen[] }) =>
      llamar<{
        id: string;
        titulo: string;
        redactado_por: string;
        enviados?: string[];
        errores?: string[];
      }>({
        accion: "generar",
        tipo: input.tipo,
        ...(input.fecha ? { fecha: input.fecha } : {}),
        ...(input.enviar ? { enviar: true } : {}),
        ...(input.canales ? { canales: input.canales } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesResumenes.lista });
    },
  });
}

export function useEnviarResumen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { resumenId: string; canales?: CanalResumen[]; correo?: string; whatsapp?: string }) =>
      llamar<{ enviados?: string[]; errores?: string[] }>({
        accion: "enviar",
        resumen_id: input.resumenId,
        ...(input.canales ? { canales: input.canales } : {}),
        ...(input.correo ? { correo: input.correo } : {}),
        ...(input.whatsapp ? { whatsapp: input.whatsapp } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesResumenes.lista });
    },
  });
}

export function useMarcarResumenLeido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resumenes").update({ leido: true }).eq("id", id);
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesResumenes.lista });
    },
  });
}

/** Mantiene la lista de resúmenes al día. */
export function useRealtimeResumenes() {
  const qc = useQueryClient();
  React.useEffect(() => {
    const canal = supabase.channel("nexdeveloper-resumenes");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "resumenes" }, () => {
      void qc.invalidateQueries({ queryKey: clavesResumenes.lista });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [qc]);
}

/** Fecha de hoy en formato AAAA-MM-DD. */
export function hoyISO() {
  const ahora = new Date();
  const desplazado = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000);
  return desplazado.toISOString().slice(0, 10);
}

/** Abre el resumen en una ventana nueva y lanza la impresión / guardado en PDF. */
export function imprimirResumen(resumen: ResumenRow) {
  const html = resumen.contenido_html ?? `<pre>${resumen.contenido_md ?? ""}</pre>`;
  const titulo = `NexDeveloper-${resumen.tipo}-${resumen.fecha}`;
  const ventana = window.open("", "_blank");
  if (!ventana) return false;
  const script = `<script>document.title=${JSON.stringify(titulo)};window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>`;
  ventana.document.open();
  ventana.document.write(html.includes("</body>") ? html.replace("</body>", `${script}</body>`) : html + script);
  ventana.document.close();
  return true;
}

/** Convierte un Markdown sencillo en HTML seguro para mostrar. */
export function markdownAHtml(texto: string) {
  const escapar = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const enLinea = (t: string) =>
    escapar(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

  const salida: string[] = [];
  let lista = false;
  for (const linea of texto.split(/\r?\n/)) {
    const l = linea.trim();
    const viñeta = /^[-*]\s+(.*)$/.exec(l);
    if (viñeta) {
      if (!lista) {
        salida.push("<ul>");
        lista = true;
      }
      salida.push(`<li>${enLinea(viñeta[1] ?? "")}</li>`);
      continue;
    }
    if (lista) {
      salida.push("</ul>");
      lista = false;
    }
    const titulo = /^(#{1,4})\s+(.*)$/.exec(l);
    if (titulo) {
      const nivel = Math.min(6, (titulo[1] ?? "#").length + 1);
      salida.push(`<h${nivel}>${enLinea(titulo[2] ?? "")}</h${nivel}>`);
      continue;
    }
    if (!l) continue;
    salida.push(`<p>${enLinea(l)}</p>`);
  }
  if (lista) salida.push("</ul>");
  return salida.join("\n");
}

/** Primer párrafo del resumen, útil para la tarjeta de Inicio. */
export function primeraIntro(resumen: ResumenRow | null | undefined) {
  if (!resumen?.contenido_md) return "";
  for (const bloque of resumen.contenido_md.split(/\n\s*\n/)) {
    const limpio = bloque.trim();
    if (!limpio || limpio.startsWith("#") || limpio.startsWith("-")) continue;
    return limpio.replace(/[*`]/g, "");
  }
  return "";
}
