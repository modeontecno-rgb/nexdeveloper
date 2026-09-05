// Edge Function «github-repos».
// Crea repositorios privados en la cuenta modeontecno-rgb, los rellena con
// README, taller de calidad y CHANGELOG, y sube carpetas del ordenador.
//
// Despliegue: supabase functions deploy github-repos
// Secretos: GITHUB_TOKEN (permiso repo y workflow).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DUENO = "modeontecno-rgb";
const RUTA_TALLER = ".github/workflows/calidad.yml";
const MAX_ARCHIVOS = 500;
const MAX_BYTES = 25 * 1024 * 1024;

const RUTAS_PROHIBIDAS = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.env[^/]*$/,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.keystore$/i,
];

const PATRONES_CLAVE = [/sk-[A-Za-z0-9]{16,}/, /ghp_[A-Za-z0-9]{16,}/, /service_role/, /-----BEGIN /];

function cabeceras(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "nexdeveloper",
    "Content-Type": "application/json",
  };
}

function aTexto(base64: string) {
  try {
    return atob(base64);
  } catch {
    return "";
  }
}

function pareceClave(base64: string) {
  const texto = aTexto(base64).slice(0, 200_000);
  return PATRONES_CLAVE.some((p) => p.test(texto));
}

function enBase64(texto: string) {
  return btoa(unescape(encodeURIComponent(texto)));
}

async function github(token: string, ruta: string, init?: RequestInit) {
  const res = await fetch(`https://api.github.com${ruta}`, { ...init, headers: cabeceras(token) });
  return res;
}

async function subirFichero(token: string, repo: string, ruta: string, mensaje: string, contenido: string) {
  const api = `/repos/${repo}/contents/${ruta}`;
  let sha: string | undefined;
  const actual = await github(token, api);
  if (actual.ok) sha = ((await actual.json()) as { sha?: string }).sha;
  const res = await github(token, api, {
    method: "PUT",
    body: JSON.stringify({ message: mensaje, content: enBase64(contenido), branch: "main", ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) throw new Error(`No se ha podido subir ${ruta}: ${await res.text()}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const responder = (cuerpo: Record<string, unknown>, estado = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status: estado,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const servicio = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const autorizacion = req.headers.get("Authorization") ?? "";
    const jwt = autorizacion.replace(/^Bearer\s+/i, "");
    const { data: datosUsuario } = await servicio.auth.getUser(jwt);
    const usuario = datosUsuario?.user;
    if (!usuario) return responder({ ok: false, error: "Debes haber iniciado sesión." }, 401);

    const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const accion = String(cuerpo["accion"] ?? "");
    if (!accion) return responder({ ok: true, listo: true });

    const token = Deno.env.get("GITHUB_TOKEN");
    if (!token) {
      const { data: proyecto } = await servicio
        .from("proyectos")
        .select("id")
        .eq("user_id", usuario.id)
        .limit(1)
        .maybeSingle();
      if (proyecto) {
        await servicio.from("tareas").insert({
          user_id: usuario.id,
          proyecto_id: proyecto.id,
          titulo: "Poner GITHUB_TOKEN",
          descripcion: "Sin el token de GitHub no se pueden crear ni rellenar repositorios.",
          requiere_atencion: true,
          motivo_atencion: "Falta GITHUB_TOKEN",
          instrucciones:
            "Añade el secreto GITHUB_TOKEN (permiso repo y workflow) a las Edge Functions de Supabase y repite la operación.",
        });
      }
      return responder({ ok: false, error: "Falta GITHUB_TOKEN; se ha dejado la tarea pendiente." });
    }

    /* ------------------------------ listar_github --------------------------- */
    if (accion === "listar_github") {
      const res = await github(token, "/user/repos?per_page=100&sort=updated");
      if (!res.ok) return responder({ ok: false, error: await res.text() }, 502);
      const lista = (await res.json()) as { full_name: string; html_url: string; private: boolean }[];
      return responder({
        ok: true,
        repositorios: lista
          .filter((r) => r.full_name.startsWith(`${DUENO}/`))
          .map((r) => ({ nombre_completo: r.full_name, url: r.html_url, privado: r.private })),
      });
    }

    /* ---------------------------------- crear -------------------------------- */
    if (accion === "crear") {
      const proyectoId = String(cuerpo["proyecto_id"] ?? "");
      const nombre = String(cuerpo["nombre"] ?? "").trim();
      const privado = cuerpo["privado"] !== false;
      const descripcion = String(cuerpo["descripcion"] ?? "");
      const taller = String(cuerpo["taller"] ?? "");
      const version = String(cuerpo["version"] ?? "0.1.0");
      if (!proyectoId || !nombre) return responder({ ok: false, error: "Faltan datos." }, 400);

      const { data: proyecto } = await servicio
        .from("proyectos")
        .select("id, user_id, nombre")
        .eq("id", proyectoId)
        .maybeSingle();
      if (!proyecto || proyecto.user_id !== usuario.id) {
        return responder({ ok: false, error: "El proyecto no es tuyo." }, 403);
      }

      const repo = `${DUENO}/${nombre}`;
      let existente = false;

      const creado = await github(token, "/user/repos", {
        method: "POST",
        body: JSON.stringify({
          name: nombre,
          private: privado,
          description: descripcion.slice(0, 300),
          auto_init: true,
          gitignore_template: "Node",
        }),
      });
      if (!creado.ok) {
        if (creado.status === 422) existente = true;
        else return responder({ ok: false, error: await creado.text() }, 502);
      }

      const readme = [
        `# ${proyecto.nombre}`,
        "",
        descripcion || "Proyecto gestionado desde NexDeveloper.",
        "",
        "---",
        "",
        "Powered by Soluciones EvoluteIA S.L.",
        "",
      ].join("\n");

      const changelog = [
        "# Historial de cambios",
        "",
        `## ${version} — ${new Date().toLocaleDateString("es-ES")}`,
        "",
        "- Repositorio creado desde NexDeveloper.",
        "",
      ].join("\n");

      const pasos: string[] = [];
      await subirFichero(token, repo, "README.md", "README inicial", readme);
      pasos.push("README");
      if (taller) {
        await subirFichero(token, repo, RUTA_TALLER, "Taller de calidad", taller);
        pasos.push("Taller de calidad");
      }
      await subirFichero(token, repo, "CHANGELOG.md", "CHANGELOG inicial", changelog);
      pasos.push("CHANGELOG");

      const enlace = `https://github.com/${repo}`;
      const { data: fila, error } = await servicio
        .from("repositorios")
        .upsert(
          {
            user_id: usuario.id,
            proyecto_id: proyectoId,
            nombre_completo: repo,
            url: enlace,
            privado,
            rama_por_defecto: "main",
            estado: "creado",
            origen_codigo: "vacio",
            error: null,
          },
          { onConflict: "proyecto_id" },
        )
        .select("*")
        .maybeSingle();
      if (error) return responder({ ok: false, error: error.message }, 500);

      return responder({ ok: true, existente, pasos, url: enlace, repositorio: fila });
    }

    /* ------------------------------ subir_carpeta ---------------------------- */
    if (accion === "subir_carpeta") {
      const repositorioId = String(cuerpo["repositorio_id"] ?? "");
      const mensaje = String(cuerpo["mensaje"] ?? "Subida desde NexDeveloper");
      const archivos = (cuerpo["archivos"] ?? []) as { ruta: string; contenido_base64: string }[];
      if (!repositorioId || !Array.isArray(archivos)) return responder({ ok: false, error: "Faltan datos." }, 400);
      if (archivos.length > MAX_ARCHIVOS) {
        return responder({ ok: false, error: `Máximo ${MAX_ARCHIVOS} archivos por tanda.` }, 400);
      }

      const { data: repositorio } = await servicio
        .from("repositorios")
        .select("*")
        .eq("id", repositorioId)
        .maybeSingle();
      if (!repositorio || repositorio.user_id !== usuario.id) {
        return responder({ ok: false, error: "El repositorio no es tuyo." }, 403);
      }

      const omitidos: string[] = [];
      const validos: { ruta: string; contenido_base64: string }[] = [];
      let bytes = 0;
      for (const a of archivos) {
        const ruta = String(a?.ruta ?? "").replace(/^\/+/, "");
        if (!ruta) continue;
        if (RUTAS_PROHIBIDAS.some((p) => p.test(ruta)) || pareceClave(a.contenido_base64)) {
          omitidos.push(ruta);
          continue;
        }
        bytes += Math.floor((a.contenido_base64.length * 3) / 4);
        validos.push({ ruta, contenido_base64: a.contenido_base64 });
      }
      if (bytes > MAX_BYTES) return responder({ ok: false, error: "La tanda supera los 25 MB." }, 400);

      const { data: subida } = await servicio
        .from("repositorio_subidas")
        .insert({
          repositorio_id: repositorioId,
          archivos: validos.length,
          bytes,
          mensaje,
          estado: "subiendo",
        })
        .select("id")
        .maybeSingle();

      const fallar = async (detalle: string) => {
        if (subida) {
          await servicio.from("repositorio_subidas").update({ estado: "error", detalle }).eq("id", subida.id);
        }
        await servicio.from("repositorios").update({ estado: "error", error: detalle }).eq("id", repositorioId);
        return responder({ ok: false, error: detalle }, 502);
      };

      const repo = repositorio.nombre_completo as string;
      const rama = (repositorio.rama_por_defecto as string) || "main";

      if (validos.length === 0) {
        if (subida) {
          await servicio
            .from("repositorio_subidas")
            .update({ estado: "ok", detalle: "Nada que subir: todo omitido por seguridad." })
            .eq("id", subida.id);
        }
        return responder({ ok: true, omitidos, commit_sha: null, sin_cambios: true });
      }

      const refRes = await github(token, `/repos/${repo}/git/ref/heads/${rama}`);
      if (!refRes.ok) return await fallar(`No se encuentra la rama ${rama}: ${await refRes.text()}`);
      const ref = (await refRes.json()) as { object: { sha: string } };
      const commitBase = ref.object.sha;

      const commitRes = await github(token, `/repos/${repo}/git/commits/${commitBase}`);
      if (!commitRes.ok) return await fallar(await commitRes.text());
      const commitPrevio = (await commitRes.json()) as { tree: { sha: string } };

      const arbol: { path: string; mode: string; type: string; sha: string }[] = [];
      for (const a of validos) {
        const blob = await github(token, `/repos/${repo}/git/blobs`, {
          method: "POST",
          body: JSON.stringify({ content: a.contenido_base64, encoding: "base64" }),
        });
        if (!blob.ok) return await fallar(`Error al subir ${a.ruta}: ${await blob.text()}`);
        const { sha } = (await blob.json()) as { sha: string };
        arbol.push({ path: a.ruta, mode: "100644", type: "blob", sha });
      }

      const arbolRes = await github(token, `/repos/${repo}/git/trees`, {
        method: "POST",
        body: JSON.stringify({ base_tree: commitPrevio.tree.sha, tree: arbol }),
      });
      if (!arbolRes.ok) return await fallar(await arbolRes.text());
      const { sha: arbolSha } = (await arbolRes.json()) as { sha: string };

      const nuevoCommit = await github(token, `/repos/${repo}/git/commits`, {
        method: "POST",
        body: JSON.stringify({ message: mensaje, tree: arbolSha, parents: [commitBase] }),
      });
      if (!nuevoCommit.ok) return await fallar(await nuevoCommit.text());
      const { sha: commitSha } = (await nuevoCommit.json()) as { sha: string };

      const mover = await github(token, `/repos/${repo}/git/refs/heads/${rama}`, {
        method: "PATCH",
        body: JSON.stringify({ sha: commitSha, force: false }),
      });
      if (!mover.ok) return await fallar(await mover.text());

      if (subida) {
        await servicio
          .from("repositorio_subidas")
          .update({
            estado: "ok",
            commit_sha: commitSha,
            detalle: omitidos.length ? `${omitidos.length} archivos omitidos por seguridad.` : null,
          })
          .eq("id", subida.id);
      }
      await servicio
        .from("repositorios")
        .update({
          estado: "con_codigo",
          origen_codigo: "carpeta_subida",
          ultimo_commit_sha: commitSha,
          ultimo_push_el: new Date().toISOString(),
          error: null,
        })
        .eq("id", repositorioId);

      return responder({
        ok: true,
        omitidos,
        commit_sha: commitSha,
        url_commit: `https://github.com/${repo}/commit/${commitSha}`,
      });
    }

    /* --------------------------------- estado -------------------------------- */
    if (accion === "estado") {
      const repositorioId = String(cuerpo["repositorio_id"] ?? "");
      const { data: repositorio } = await servicio
        .from("repositorios")
        .select("*")
        .eq("id", repositorioId)
        .maybeSingle();
      if (!repositorio || repositorio.user_id !== usuario.id) {
        return responder({ ok: false, error: "El repositorio no es tuyo." }, 403);
      }
      const repo = repositorio.nombre_completo as string;
      const rama = (repositorio.rama_por_defecto as string) || "main";

      const commitRes = await github(token, `/repos/${repo}/commits/${rama}`);
      const commit = commitRes.ok
        ? ((await commitRes.json()) as { sha: string; commit: { message: string; author: { date: string } } })
        : null;
      const tallerRes = await github(token, `/repos/${repo}/contents/${RUTA_TALLER}`);

      if (commit) {
        await servicio
          .from("repositorios")
          .update({ ultimo_commit_sha: commit.sha, ultimo_push_el: commit.commit.author.date })
          .eq("id", repositorioId);
      }

      return responder({
        ok: true,
        rama,
        commit_sha: commit?.sha ?? null,
        mensaje: commit?.commit.message ?? null,
        fecha: commit?.commit.author.date ?? null,
        tiene_taller: tallerRes.ok,
        // Desde aquí no se puede saber si el repositorio está conectado a otra
        // herramienta: el origen del código lo indica la persona usuaria.
        origen_codigo: repositorio.origen_codigo,
      });
    }

    return responder({ ok: false, error: "Acción desconocida." }, 400);
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String((err as Error)?.message ?? err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
