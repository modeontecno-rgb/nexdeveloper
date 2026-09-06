// Edge Function «comprobar-secretos»: dice qué secretos existen y si funcionan. Nunca devuelve valores.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const responder = (c: Record<string, unknown>, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  const servicio = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cron = req.headers.get("x-cron-token");
  let autorizado = false;
  if (cron) { const { data } = await servicio.rpc("comprobar_cron_token", { p_token: cron }); autorizado = Boolean(data); }
  else { const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, ""); const { data } = await servicio.auth.getUser(jwt); autorizado = Boolean(data?.user); }
  if (!autorizado) return responder({ ok: false, error: "Sin sesión." }, 401);
  const existe = (n: string) => Boolean(Deno.env.get(n));
  const resultado: Record<string, unknown> = {
    GITHUB_TOKEN: existe("GITHUB_TOKEN"), CUENTA_SUPABASE_TOKEN: existe("CUENTA_SUPABASE_TOKEN"),
    SENTRY_DSN: existe("SENTRY_DSN"), SENTRY_AUTH_TOKEN: existe("SENTRY_AUTH_TOKEN"),
    CANVA_CLIENT_ID: existe("CANVA_CLIENT_ID"), CANVA_CLIENT_SECRET: existe("CANVA_CLIENT_SECRET"),
  };
  const gh = Deno.env.get("GITHUB_TOKEN");
  if (gh) {
    const r = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${gh}`, "User-Agent": "nexdeveloper", Accept: "application/vnd.github+json" } });
    resultado.github = r.ok ? { ok: true, usuario: ((await r.json()) as { login?: string }).login, permisos: r.headers.get("x-oauth-scopes") } : { ok: false, estado: r.status };
  }
  const sb = Deno.env.get("CUENTA_SUPABASE_TOKEN");
  if (sb) {
    const r = await fetch("https://api.supabase.com/v1/projects", { headers: { Authorization: `Bearer ${sb}` } });
    resultado.supabase = r.ok ? { ok: true, proyectos: ((await r.json()) as unknown[]).length } : { ok: false, estado: r.status };
  }
  return responder({ ok: true, ...resultado });
});
