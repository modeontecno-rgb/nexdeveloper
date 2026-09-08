// NexDeveloper · Edge Function «avisos» (0.23.0)
// Avisos push para la app instalable (PWA): claves VAPID propias (se generan una vez y se guardan en private.claves_sistema),
// suscripciones por dispositivo, envío de los avisos pendientes (creados por triggers: tareas que requieren atención,
// aprobaciones, compilaciones, dominios, presupuestos, salud, copias) con silencio nocturno y tipos configurables.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const ahora = () => new Date().toISOString();
const CONTACTO = "mailto:modeontecno@gmail.com";

async function clavesVapid(sb: SB) {
  const { data, error } = await sb.rpc("leer_claves_vapid");
  if (error) throw new Error(`No se pudieron leer las claves VAPID: ${error.message}`);
  const f = (Array.isArray(data) ? data[0] : data) ?? {};
  if (f.publica && f.privada) return { publica: String(f.publica), privada: String(f.privada) };
  const k = webpush.generateVAPIDKeys();
  const { error: e2 } = await sb.rpc("guardar_claves_vapid", { p_publica: k.publicKey, p_privada: k.privateKey });
  if (e2) throw new Error(`No se pudieron guardar las claves VAPID: ${e2.message}`);
  return { publica: k.publicKey, privada: k.privateKey };
}
async function config(sb: SB, userId: string) {
  const { data } = await sb.from("avisos_config").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data;
  const { data: n } = await sb.from("avisos_config").insert({ user_id: userId }).select("*").single();
  return n!;
}
function horaMadrid() {
  const s = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(new Date());
  return Number(s.replace(/\D/g, "")) % 24;
}
function enSilencio(cfg: any) {
  const h = horaMadrid(); const d = Number(cfg.silencio_desde ?? 23); const u = Number(cfg.silencio_hasta ?? 7);
  if (d === u) return false;
  return d < u ? (h >= d && h < u) : (h >= d || h < u);
}
async function enviarA(sb: SB, claves: { publica: string; privada: string }, sus: any, carga: Record<string, unknown>) {
  try {
    await webpush.sendNotification({ endpoint: sus.endpoint, keys: { p256dh: sus.p256dh, auth: sus.auth } }, JSON.stringify(carga), { vapidDetails: { subject: CONTACTO, publicKey: claves.publica, privateKey: claves.privada }, TTL: 3600 * 12 });
    await sb.from("avisos_suscripciones").update({ ultimo_envio: ahora(), ultimo_error: null }).eq("id", sus.id);
    return true;
  } catch (e: any) {
    const code = Number(e?.statusCode ?? 0);
    const msg = String(e?.body ?? e?.message ?? e).slice(0, 200);
    await sb.from("avisos_suscripciones").update({ ultimo_error: `${code} ${msg}`, ...(code === 404 || code === 410 ? { activa: false } : {}) }).eq("id", sus.id);
    return false;
  }
}
async function enviarPendientes(sb: SB) {
  const { data: pendientes } = await sb.from("avisos").select("*").eq("enviado", false).order("creado_el").limit(50);
  if (!pendientes?.length) return { enviados: 0 };
  const claves = await clavesVapid(sb);
  let total = 0;
  const porUsuario: Record<string, any> = {};
  for (const a of pendientes) {
    const cfg = porUsuario[a.user_id] ??= await config(sb, a.user_id);
    const tipos = cfg.tipos ?? {};
    if (!cfg.activo || tipos[a.tipo] === false) { await sb.from("avisos").update({ enviado: true, resultado: "omitido (configuración)" }).eq("id", a.id); continue; }
    if (enSilencio(cfg) && !["aprobacion", "salud"].includes(a.tipo)) continue;
    const { data: subs } = await sb.from("avisos_suscripciones").select("*").eq("user_id", a.user_id).eq("activa", true);
    if (!subs?.length) { await sb.from("avisos").update({ enviado: true, resultado: "sin dispositivos" }).eq("id", a.id); continue; }
    let ok = 0;
    for (const s of subs) if (await enviarA(sb, claves, s, { titulo: a.titulo, cuerpo: a.cuerpo ?? "", url: a.url ?? "/", tipo: a.tipo, id: a.id })) ok++;
    total += ok;
    await sb.from("avisos").update({ enviado: true, enviado_el: ahora(), enviados: ok, resultado: ok ? `enviado a ${ok} dispositivo(s)` : "fallo en todos los dispositivos" }).eq("id", a.id);
  }
  return { enviados: total };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = servicio();
  try {
    const tokenCron = req.headers.get("x-cron-token") ?? "";
    let esServicio = false; let userId: string | null = null;
    if (tokenCron) { const { data } = await sb.rpc("comprobar_cron_token", { p_token: tokenCron }); esServicio = data === true; }
    if (!esServicio) {
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: u } = await sb.auth.getUser(jwt);
      if (!u?.user) return json({ ok: false, error: "No autorizado" }, 401);
      userId = u.user.id;
    }
    const cuerpo = await req.json().catch(() => ({}));
    const accion = String(cuerpo.accion ?? "estado");
    switch (accion) {
      case "enviar_pendientes": {
        if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
        return json({ ok: true, ...(await enviarPendientes(sb)) });
      }
      case "estado": {
        const cfg = await config(sb, userId!);
        const claves = await clavesVapid(sb);
        const { data: subs } = await sb.from("avisos_suscripciones").select("id, dispositivo, agente, activa, ultimo_envio, ultimo_error, creado_el").eq("user_id", userId!).order("creado_el");
        const { count } = await sb.from("avisos").select("id", { count: "exact", head: true }).eq("user_id", userId!).eq("leido", false);
        return json({ ok: true, config: cfg, clave_publica: claves.publica, dispositivos: subs ?? [], sin_leer: count ?? 0 });
      }
      case "suscribir": {
        const s = cuerpo.suscripcion ?? {};
        if (!s.endpoint || !s.keys?.p256dh || !s.keys?.auth) return json({ ok: false, error: "Suscripción incompleta" });
        await sb.from("avisos_suscripciones").upsert({ user_id: userId!, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, dispositivo: cuerpo.dispositivo ?? null, agente: (cuerpo.agente ?? "").slice(0, 200), activa: true, ultimo_error: null }, { onConflict: "endpoint" });
        return json({ ok: true });
      }
      case "desuscribir": {
        if (cuerpo.endpoint) await sb.from("avisos_suscripciones").delete().eq("user_id", userId!).eq("endpoint", String(cuerpo.endpoint));
        if (cuerpo.id) await sb.from("avisos_suscripciones").delete().eq("user_id", userId!).eq("id", String(cuerpo.id));
        return json({ ok: true });
      }
      case "configurar": {
        const permitidos = ["activo", "tipos", "silencio_desde", "silencio_hasta"];
        const cambios: Record<string, unknown> = { user_id: userId!, actualizado_el: ahora() };
        for (const k of permitidos) if (k in cuerpo) cambios[k] = cuerpo[k];
        const { data } = await sb.from("avisos_config").upsert(cambios).select("*").single();
        return json({ ok: true, config: data });
      }
      case "probar": {
        const claves = await clavesVapid(sb);
        const { data: subs } = await sb.from("avisos_suscripciones").select("*").eq("user_id", userId!).eq("activa", true);
        if (!subs?.length) return json({ ok: false, error: "No hay ningún dispositivo suscrito. Activa los avisos en este dispositivo primero." });
        let ok = 0; const fallos: string[] = [];
        for (const s of subs) { if (await enviarA(sb, claves, s, { titulo: "NexDeveloper · prueba de avisos", cuerpo: "Si ves esto, los avisos push funcionan en este dispositivo.", url: "/avisos", tipo: "prueba" })) ok++; else fallos.push(s.dispositivo ?? s.endpoint.slice(0, 40)); }
        return json({ ok: ok > 0, enviados: ok, fallos });
      }
      case "marcar_leidos": {
        const q1 = sb.from("avisos").update({ leido: true }).eq("user_id", userId!);
        if (cuerpo.id) await q1.eq("id", String(cuerpo.id)); else await q1.eq("leido", false);
        return json({ ok: true });
      }
      case "crear": {
        await sb.rpc("crear_aviso", { p_user: userId!, p_tipo: String(cuerpo.tipo ?? "otro"), p_titulo: String(cuerpo.titulo ?? "NexDeveloper"), p_cuerpo: String(cuerpo.cuerpo ?? ""), p_url: cuerpo.url ?? null, p_proyecto: cuerpo.proyecto_id ?? null, p_referencia: cuerpo.referencia ?? null });
        return json({ ok: true });
      }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (err) { return json({ ok: false, error: String(err?.message ?? err) }, 500); }
});
