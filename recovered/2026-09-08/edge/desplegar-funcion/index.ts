// NexDeveloper · Edge Function «desplegar-funcion» (7/09/2026)
// Despliega otra Edge Function de este proyecto leyendo su código desde el repositorio de GitHub (rama main),
// con el token de cuenta de Supabase y el GITHUB_TOKEN que viven en los secretos. Ningún secreto sale de aquí.
// Autorización: cabecera x-cron-token (RPC comprobar_cron_token) o sesión del propietario (JWT).
// Cuerpo: { slug: "infraestructura", repo?: "modeontecno-rgb/nexdeveloper", rama?: "main", ruta?: "db/functions/<slug>/index.ts", verify_jwt?: false }
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_CUENTA = Deno.env.get("CUENTA_SUPABASE_TOKEN") ?? "";
const TOKEN_GITHUB = Deno.env.get("GITHUB_TOKEN") ?? "";
const REF = URL_SUPABASE.replace("https://", "").split(".")[0];
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
  try {
    const tokenCron = req.headers.get("x-cron-token") ?? "";
    let autorizado = false;
    if (tokenCron) { const { data } = await sb.rpc("comprobar_cron_token", { p_token: tokenCron }); autorizado = data === true; }
    if (!autorizado) { const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, ""); const { data: u } = await sb.auth.getUser(jwt); autorizado = Boolean(u?.user); }
    if (!autorizado) return json({ ok: false, error: "No autorizado" }, 401);
    if (!TOKEN_CUENTA) return json({ ok: false, error: "Falta el secreto CUENTA_SUPABASE_TOKEN" }, 500);
    const c = await req.json().catch(() => ({}));
    const slug = String(c.slug ?? "").trim();
    if (!/^[a-z0-9-]+$/.test(slug)) return json({ ok: false, error: "slug no válido" }, 400);
    const repo = String(c.repo ?? "modeontecno-rgb/nexdeveloper");
    const rama = String(c.rama ?? "main");
    const ruta = String(c.ruta ?? `db/functions/${slug}/index.ts`);
    const verifyJwt = Boolean(c.verify_jwt ?? false);

    // 1) Código fuente desde GitHub (API de contenidos, vale para repositorios privados)
    const rg = await fetch(`https://api.github.com/repos/${repo}/contents/${ruta}?ref=${encodeURIComponent(rama)}`, { headers: { Authorization: TOKEN_GITHUB ? `Bearer ${TOKEN_GITHUB}` : "", Accept: "application/vnd.github.raw+json", "User-Agent": "NexDeveloper" } });
    if (!rg.ok) return json({ ok: false, error: `GitHub ${rg.status}: ${(await rg.text()).slice(0, 200)}` }, 502);
    const codigo = await rg.text();
    if (codigo.length < 100) return json({ ok: false, error: "El archivo de GitHub está vacío o es demasiado corto" }, 400);

    // 2) Despliegue por la API de gestión (multipart: metadata + archivo)
    const form = new FormData();
    form.append("metadata", JSON.stringify({ name: slug, entrypoint_path: "index.ts", verify_jwt: verifyJwt }));
    form.append("file", new Blob([codigo], { type: "application/typescript" }), "index.ts");
    const rd = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/deploy?slug=${encodeURIComponent(slug)}`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN_CUENTA}` }, body: form });
    const td = await rd.text();
    if (!rd.ok) return json({ ok: false, error: `API Supabase ${rd.status}: ${td.slice(0, 400)}` }, 502);
    let info: any = {}; try { info = JSON.parse(td); } catch { /* texto */ }
    return json({ ok: true, slug, version: info?.version ?? null, bytes: codigo.length, sha_github: rg.headers.get("etag") });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e).slice(0, 300) }, 500);
  }
});
