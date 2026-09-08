// Only explicitly configured owners may deploy an allowed function from an exact commit.
// General cron tokens do not grant deployment authority. Missing configuration fails closed.
import { createClient } from "npm:@supabase/supabase-js@2";

const REPOSITORY = "modeontecno-rgb/nexdeveloper";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
const list = (key: string) => (Deno.env.get(key) ?? "").split(",").map(s => s.trim()).filter(Boolean);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("Authorization") ?? "");
  if (!match) return json({ ok: false, error: "Se requiere sesión de un propietario autorizado" }, 401);
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !serviceKey) return json({ ok: false, error: "Servicio no configurado" }, 503);
    const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.getUser(match[1]);
    if (error || !data?.user) return json({ ok: false, error: "Sesión no válida" }, 401);
    const owners = list("DEPLOY_OWNER_IDS");
    if (!owners.length || owners.some(id => !UUID.test(id))) {
      return json({ ok: false, error: "No hay propietarios de despliegue configurados" }, 503);
    }
    if (!owners.some(id => id.toLowerCase() === data.user.id.toLowerCase())) {
      return json({ ok: false, error: "No tienes permiso para desplegar software" }, 403);
    }
    const allowed = list("DEPLOY_ALLOWED_FUNCTIONS");
    if (!allowed.length || allowed.some(name => !SLUG.test(name))) {
      return json({ ok: false, error: "No hay destinos de despliegue configurados" }, 503);
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "Solicitud no válida" }, 400);
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    if (!SLUG.test(slug) || !allowed.includes(slug)) return json({ ok: false, error: "Función no autorizada" }, 403);
    const commit = typeof body.commit_sha === "string" ? body.commit_sha : "";
    if (!/^[0-9a-f]{40}$/i.test(commit)) return json({ ok: false, error: "Indica el SHA completo del commit revisado" }, 400);
    const path = `db/functions/${slug}/index.ts`;
    if ((body.repo !== undefined && body.repo !== REPOSITORY) ||
        (body.ruta !== undefined && body.ruta !== path) ||
        (body.rama !== undefined && body.rama !== commit)) {
      return json({ ok: false, error: "La fuente no coincide con el repositorio, ruta y commit autorizados" }, 400);
    }
    if (body.verify_jwt !== undefined && typeof body.verify_jwt !== "boolean") {
      return json({ ok: false, error: "verify_jwt debe ser booleano" }, 400);
    }
    // Require an explicit verification setting instead of silently disabling it.
    if (typeof body.verify_jwt !== "boolean") return json({ ok: false, error: "Indica explícitamente verify_jwt" }, 400);
    const accountToken = Deno.env.get("CUENTA_SUPABASE_TOKEN") ?? "";
    const githubToken = Deno.env.get("GITHUB_TOKEN") ?? "";
    if (!accountToken || !githubToken) return json({ ok: false, error: "Falta configurar el acceso de despliegue" }, 503);
    const projectRef = new URL(url).hostname.split(".")[0];
    if (!/^[a-z0-9]{20}$/.test(projectRef)) return json({ ok: false, error: "Destino Supabase no válido" }, 503);

    const source = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${path}?ref=${commit}`, {
      headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github.raw+json", "User-Agent": "NexDeveloper" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!source.ok) return json({ ok: false, error: `No se pudo leer el código (GitHub ${source.status})` }, 502);
    const code = await source.text();
    const bytes = new TextEncoder().encode(code).length;
    if (bytes < 100 || bytes > 1_000_000) return json({ ok: false, error: "Tamaño de código no válido" }, 400);
    const form = new FormData();
    form.append("metadata", JSON.stringify({ name: slug, entrypoint_path: "index.ts", verify_jwt: body.verify_jwt }));
    form.append("file", new Blob([code], { type: "application/typescript" }), "index.ts");
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions/deploy?slug=${slug}`, {
      method: "POST", headers: { Authorization: `Bearer ${accountToken}` }, body: form,
      signal: AbortSignal.timeout(60_000),
    });
    console.info(JSON.stringify({ event: "function_deployment", actor: data.user.id, slug, commit, success: response.ok }));
    if (!response.ok) return json({ ok: false, error: `Despliegue rechazado (Supabase ${response.status})` }, 502);
    const info = await response.json().catch(() => ({}));
    return json({ ok: true, slug, commit_sha: commit, version: info?.version ?? null, bytes });
  } catch {
    return json({ ok: false, error: "No se pudo completar el despliegue" }, 500);
  }
});
