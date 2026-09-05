// Edge Function «calidad-github».
// Lanza el taller de calidad en GitHub Actions y recoge sus resultados.
//
// Despliegue: supabase functions deploy calidad-github
// Secretos: GITHUB_TOKEN (permiso repo y workflow), SUPABASE_ACCESS_TOKEN (opcional,
// para los avisos de seguridad y rendimiento de la base de datos).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TALLER = "calidad.yml";

type Resultado = "ok" | "aviso" | "fallo" | "omitido";

type FilaResultado = {
  codigo: string;
  resultado: Resultado;
  detalle?: string;
  metrica?: Record<string, unknown>;
  url_detalle?: string;
};

function cabeceras(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "nexdeveloper",
    "Content-Type": "application/json",
  };
}

function normalizar(repositorio: string) {
  return repositorio
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
}

const CONTROLES_BLOQUEANTES = [
  "tipos",
  "compilacion",
  "vitest",
  "advisors_seguridad",
  "secretos_codigo",
  "reglas_fabricante",
];

function calcularEstado(filas: FilaResultado[]) {
  const rojo = filas.some((f) => f.resultado === "fallo" && CONTROLES_BLOQUEANTES.includes(f.codigo));
  if (rojo) return "rojo" as const;
  if (filas.some((f) => f.resultado === "fallo" || f.resultado === "aviso")) return "ambar" as const;
  return "verde" as const;
}

async function avisosSupabase(refProyecto: string | null, token: string | null): Promise<FilaResultado[]> {
  if (!refProyecto || !token) {
    return [
      { codigo: "advisors_seguridad", resultado: "omitido", detalle: "Falta el identificador del proyecto o el token de Supabase" },
      { codigo: "advisors_rendimiento", resultado: "omitido", detalle: "Falta el identificador del proyecto o el token de Supabase" },
    ];
  }
  const consultar = async (tipo: "security" | "performance"): Promise<FilaResultado> => {
    const codigo = tipo === "security" ? "advisors_seguridad" : "advisors_rendimiento";
    try {
      const respuesta = await fetch(`https://api.supabase.com/v1/projects/${refProyecto}/advisors/${tipo}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!respuesta.ok) {
        return { codigo, resultado: "omitido", detalle: `La API de Supabase ha respondido ${respuesta.status}` };
      }
      const cuerpo = (await respuesta.json()) as { lints?: { level?: string; title?: string }[] };
      const lints = cuerpo.lints ?? [];
      const errores = lints.filter((l) => l.level === "ERROR").length;
      const avisos = lints.filter((l) => l.level === "WARN").length;
      const metrica = { errores, avisos };
      if (errores > 0) {
        return { codigo, resultado: "fallo", detalle: `${errores} avisos de nivel error`, metrica };
      }
      if (avisos > 0) return { codigo, resultado: "aviso", detalle: `${avisos} advertencias`, metrica };
      return { codigo, resultado: "ok", detalle: "Sin avisos", metrica };
    } catch (err) {
      return { codigo, resultado: "omitido", detalle: String((err as Error)?.message ?? err) };
    }
  };
  return [await consultar("security"), await consultar("performance")];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const responder = (cuerpo: Record<string, unknown>, estado = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status: estado,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const cuerpo = (await req.json().catch(() => ({}))) as {
      accion?: string;
      proyecto_id?: string;
      version?: string;
    };
    const accion = cuerpo.accion ?? "sincronizar";

    if (accion === "sugerir_taller") {
      return responder({ ok: true, taller: TALLER });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const servicio = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = Deno.env.get("GITHUB_TOKEN");
    if (!token) return responder({ ok: false, error: "Falta el secreto GITHUB_TOKEN." }, 400);

    /* ------------------------------- Lanzar -------------------------------- */
    if (accion === "lanzar") {
      if (!cuerpo.proyecto_id) return responder({ ok: false, error: "Falta el proyecto." }, 400);
      const { data: proyecto } = await servicio
        .from("proyectos")
        .select("id, user_id, nombre, repositorio")
        .eq("id", cuerpo.proyecto_id)
        .maybeSingle();
      if (!proyecto) return responder({ ok: false, error: "No se encuentra el proyecto." }, 404);
      if (!proyecto.repositorio) {
        return responder({ ok: false, error: "El proyecto no tiene repositorio indicado." }, 400);
      }
      const repo = normalizar(proyecto.repositorio);
      const version = cuerpo.version ?? "0.0.0";

      const info = await fetch(`https://api.github.com/repos/${repo}`, { headers: cabeceras(token) });
      const rama = info.ok ? ((await info.json()) as { default_branch?: string }).default_branch ?? "main" : "main";

      const lanzada = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/${TALLER}/dispatches`,
        {
          method: "POST",
          headers: cabeceras(token),
          body: JSON.stringify({ ref: rama, inputs: { version } }),
        },
      );

      if (lanzada.status === 404) {
        await servicio.from("tareas").insert({
          user_id: proyecto.user_id,
          proyecto_id: proyecto.id,
          titulo: `Añadir el taller de calidad al repositorio ${proyecto.nombre}`,
          descripcion: `El repositorio ${repo} no tiene el taller ${TALLER}.`,
          requiere_atencion: true,
          motivo_atencion: "Falta el taller de calidad",
          instrucciones:
            "Copia el fichero calidad.yml que aparece en la tarjeta de ayuda de la pantalla Calidad a la carpeta .github/workflows/ del repositorio.",
        });
        return responder({ ok: false, error: "El repositorio no tiene el taller de calidad; se ha dejado la tarea." });
      }
      if (!lanzada.ok) return responder({ ok: false, error: await lanzada.text() }, 502);

      const { data: ejecucion, error } = await servicio
        .from("ejecuciones_calidad")
        .insert({
          user_id: proyecto.user_id,
          proyecto_id: proyecto.id,
          version,
          origen: "github_actions",
          estado: "en_cola",
        })
        .select("id")
        .maybeSingle();
      if (error) return responder({ ok: false, error: error.message }, 500);
      return responder({ ok: true, ejecucion_id: ejecucion?.id ?? null });
    }

    /* ----------------------------- Sincronizar ----------------------------- */
    const { data: abiertas } = await servicio
      .from("ejecuciones_calidad")
      .select("id, user_id, proyecto_id, version, iniciada_el, run_id_github")
      .in("estado", ["en_cola", "ejecutando"]);

    if (!abiertas || abiertas.length === 0) return responder({ ok: true, revisadas: 0 });

    const tokenSupabase = Deno.env.get("SUPABASE_ACCESS_TOKEN") ?? null;
    let cerradas = 0;

    for (const ejecucion of abiertas) {
      const { data: proyecto } = await servicio
        .from("proyectos")
        .select("id, user_id, nombre, repositorio")
        .eq("id", ejecucion.proyecto_id)
        .maybeSingle();
      if (!proyecto?.repositorio) continue;
      const repo = normalizar(proyecto.repositorio);

      const listado = await fetch(
        `https://api.github.com/repos/${repo}/actions/runs?event=workflow_dispatch&per_page=10`,
        { headers: cabeceras(token) },
      );
      if (!listado.ok) continue;
      const runs = ((await listado.json()) as {
        workflow_runs?: { id: number; html_url: string; status: string; conclusion: string | null; created_at: string; path?: string }[];
      }).workflow_runs ?? [];

      const inicio = new Date(ejecucion.iniciada_el as string).getTime() - 120_000;
      const run =
        runs.find((r) => r.id === Number(ejecucion.run_id_github)) ??
        runs
          .filter((r) => (r.path ?? "").includes(TALLER) && new Date(r.created_at).getTime() >= inicio)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      if (!run) continue;

      if (run.status !== "completed") {
        await servicio
          .from("ejecuciones_calidad")
          .update({ estado: "ejecutando", run_id_github: run.id, url_run: run.html_url })
          .eq("id", ejecucion.id);
        continue;
      }

      // Descarga del artefacto con los resultados.
      let filas: FilaResultado[] = [];
      const artefactos = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${run.id}/artifacts`, {
        headers: cabeceras(token),
      });
      if (artefactos.ok) {
        const lista = ((await artefactos.json()) as { artifacts?: { id: number; name: string }[] }).artifacts ?? [];
        const artefacto = lista.find((a) => a.name === "resultado-calidad");
        if (artefacto) {
          const zip = await fetch(
            `https://api.github.com/repos/${repo}/actions/artifacts/${artefacto.id}/zip`,
            { headers: cabeceras(token) },
          );
          if (zip.ok) {
            try {
              const bytes = new Uint8Array(await zip.arrayBuffer());
              filas = await leerZip(bytes);
            } catch {
              filas = [];
            }
          }
        }
      }

      const refSupabase = Deno.env.get("SUPABASE_PROJECT_REF") ?? (url.match(/https:\/\/([^.]+)\./)?.[1] ?? null);
      const avisos = await avisosSupabase(refSupabase, tokenSupabase);
      filas = [...filas.filter((f) => !f.codigo.startsWith("advisors_")), ...avisos];

      await servicio.from("resultados_calidad").delete().eq("ejecucion_id", ejecucion.id);
      if (filas.length > 0) {
        await servicio.from("resultados_calidad").insert(
          filas.map((f) => ({
            ejecucion_id: ejecucion.id,
            control_codigo: f.codigo,
            resultado: f.resultado,
            detalle: f.detalle ?? "",
            metrica: f.metrica ?? {},
            url_detalle: f.url_detalle ?? run.html_url,
          })),
        );
      }

      const estado = run.conclusion === "cancelled" ? "error" : calcularEstado(filas);
      const resumen = {
        ok: filas.filter((f) => f.resultado === "ok").length,
        aviso: filas.filter((f) => f.resultado === "aviso").length,
        fallo: filas.filter((f) => f.resultado === "fallo").length,
        omitido: filas.filter((f) => f.resultado === "omitido").length,
      };
      const terminada = new Date();
      await servicio
        .from("ejecuciones_calidad")
        .update({
          estado,
          run_id_github: run.id,
          url_run: run.html_url,
          terminada_el: terminada.toISOString(),
          duracion_seg: Math.round((terminada.getTime() - new Date(ejecucion.iniciada_el as string).getTime()) / 1000),
          resumen,
        })
        .eq("id", ejecucion.id);
      cerradas += 1;

      if (estado === "rojo" || estado === "error") {
        const fallidos = filas.filter((f) => f.resultado === "fallo").map((f) => f.codigo).join(", ");
        await servicio.from("tareas").insert({
          user_id: ejecucion.user_id,
          proyecto_id: ejecucion.proyecto_id,
          titulo: `Corregir los controles de calidad de ${proyecto.nombre}`,
          descripcion: `Versión ${ejecucion.version}. Controles fallidos: ${fallidos || "sin detalle"}.`,
          requiere_atencion: true,
          motivo_atencion: "Control de calidad en rojo",
          instrucciones: `Revisa el detalle en ${run.html_url} y vuelve a lanzar la comprobación.`,
        });
      }
    }

    return responder({ ok: true, revisadas: abiertas.length, cerradas });
  } catch (err) {
    return responder({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});

/** Lee el fichero JSON que viene dentro del zip del artefacto. */
async function leerZip(bytes: Uint8Array): Promise<FilaResultado[]> {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < bytes.length - 30; i += 1) {
    if (vista.getUint32(i, true) !== 0x04034b50) continue;
    const metodo = vista.getUint16(i + 8, true);
    const comprimido = vista.getUint32(i + 18, true);
    const largoNombre = vista.getUint16(i + 26, true);
    const largoExtra = vista.getUint16(i + 28, true);
    const inicio = i + 30 + largoNombre + largoExtra;
    const datos = bytes.slice(inicio, inicio + comprimido);
    let texto: string;
    if (metodo === 0) {
      texto = new TextDecoder().decode(datos);
    } else {
      const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      texto = await new Response(flujo).text();
    }
    try {
      return JSON.parse(texto) as FilaResultado[];
    } catch {
      return [];
    }
  }
  return [];
}
