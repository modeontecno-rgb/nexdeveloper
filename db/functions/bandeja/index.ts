// NexDeveloper · Edge Function «bandeja» (0.13.0)
// Bandeja única: Gmail (OAuth + sondeo), WhatsApp Business (webhook de Meta Cloud API), notas Plaud/manual (ingesta)
// → clasificación por proyecto (palabras clave + IA) → tarea con un clic.
import { fetchIADeUsuario } from "../_shared/presupuesto.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const G_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
const G_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const html = (t: string, s = 200) => new Response(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px;background:#0f1419;color:#e6edf3"><h2>NexDeveloper</h2><p>${t}</p><p><a style="color:#22d3c5" href="javascript:window.close()">Cerrar esta ventana</a></p></body>`, { status: s, headers: { "Content-Type": "text/html; charset=utf-8" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const URL_FUNCION = `${URL_SUPABASE}/functions/v1/bandeja`;

const norm = (s: string) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
async function clasificarPorPalabras(sb: SB, userId: string, texto: string) {
  const { data: proyectos } = await sb.from("proyectos").select("id, slug, nombre, palabras_clave").eq("user_id", userId);
  const t = norm(texto);
  let mejor: { id: string; puntos: number; nombre: string } | null = null;
  for (const p of proyectos ?? []) {
    let puntos = 0;
    if (t.includes(norm(p.nombre))) puntos += 3;
    if (t.includes(norm(p.slug))) puntos += 3;
    for (const k of (p.palabras_clave ?? []) as string[]) if (k && t.includes(norm(k))) puntos += 1;
    if (puntos > 0 && (!mejor || puntos > mejor.puntos)) mejor = { id: p.id, puntos, nombre: p.nombre };
  }
  if (!mejor) return null;
  return { proyecto_id: mejor.id, confianza: Math.min(0.9, 0.4 + mejor.puntos * 0.15), nombre: mejor.nombre };
}
async function claveProveedor(sb: SB, userId: string, slugs: string[]) {
  for (const slug of slugs) {
    const { data: p } = await sb.from("proveedores_ia").select("id, clave_cifrada").eq("user_id", userId).eq("clave_slug", slug).maybeSingle();
    if (!p?.clave_cifrada) continue;
    const { data: clave } = await sb.rpc("descifrar_clave_proveedor", { p_proveedor_id: p.id });
    if (clave) return { slug, clave: String(clave) };
  }
  return null;
}
async function clasificarConIA(sb: SB, userId: string, e: { remitente?: string; asunto?: string; texto?: string; origen: string }) {
  const prov = await claveProveedor(sb, userId, ["abacus", "groq", "anthropic", "google", "openai"]);
  if (!prov) return null;
  const { data: proyectos } = await sb.from("proyectos").select("slug, nombre, descripcion, palabras_clave").eq("user_id", userId);
  const lista = (proyectos ?? []).map((p) => `- ${p.slug}: ${p.nombre}. ${(p.descripcion ?? "").slice(0, 120)} Claves: ${(p.palabras_clave ?? []).join(", ")}`).join("\n");
  const sistema = `Eres el asistente de organización de Javier (Soluciones EvoluteIA S.L.). Clasificas mensajes entrantes (correo, WhatsApp, notas de voz) en uno de sus proyectos de software y propones una tarea. Respondes en español de España y SOLO con JSON.`;
  const pregunta = `Proyectos:\n${lista}\n\nMensaje (${e.origen}) de ${e.remitente ?? "desconocido"}${e.asunto ? ` · asunto: ${e.asunto}` : ""}:\n\"\"\"\n${(e.texto ?? "").slice(0, 6000)}\n\"\"\"\n\nDevuelve JSON: {"proyecto_slug": "slug o null si no encaja en ninguno", "confianza": 0-1, "resumen": "2 frases", "es_accionable": true|false, "propuesta": {"titulo": "tarea en imperativo, ≤ 90 caracteres", "descripcion": "qué hay que hacer", "prioridad": "baja|media|alta|critica", "requiere_atencion": true si Javier debe decidir o hacer algo personalmente, false si puede hacerlo un agente sin él, "instrucciones": "si requiere atención, pasos claros"}}`;
  let texto = "";
  if (prov.slug === "anthropic") {
    const r = await fetchIADeUsuario(sb, userId, null, "bandeja", "https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": prov.clave, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: "claude-3-5-haiku-latest", max_tokens: 800, system: sistema, messages: [{ role: "user", content: pregunta }] }) });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`); const j = await r.json(); texto = (j.content ?? []).map((c: any) => c.text ?? "").join("");
  } else if (prov.slug === "google") {
    const r = await fetchIADeUsuario(sb, userId, null, "bandeja", `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${prov.clave}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: "user", parts: [{ text: pregunta }] }], generationConfig: { temperature: 0.1, responseMimeType: "application/json" } }) });
    if (!r.ok) throw new Error(`Google ${r.status}`); const j = await r.json(); texto = (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
  } else {
    const base = prov.slug === "groq" ? "https://api.groq.com/openai/v1" : prov.slug === "abacus" ? "https://routellm.abacus.ai/v1" : "https://api.openai.com/v1";
    const modelo = prov.slug === "groq" ? "llama-3.3-70b-versatile" : prov.slug === "abacus" ? "route-llm" : "gpt-4o-mini";
    const r = await fetchIADeUsuario(sb, userId, null, "bandeja", `${base}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${prov.clave}`, "content-type": "application/json" }, body: JSON.stringify({ model: modelo, temperature: 0.1, response_format: { type: "json_object" }, messages: [{ role: "system", content: sistema }, { role: "user", content: pregunta }] }) });
    if (!r.ok) throw new Error(`${prov.slug} ${r.status}`); const j = await r.json(); texto = j.choices?.[0]?.message?.content ?? "";
  }
  const m = texto.match(/\{[\s\S]*\}/); if (!m) return null;
  const j = JSON.parse(m[0]);
  let proyecto_id: string | null = null;
  if (j.proyecto_slug) { const { data: p } = await sb.from("proyectos").select("id").eq("user_id", userId).eq("slug", j.proyecto_slug).maybeSingle(); proyecto_id = p?.id ?? null; }
  return { proyecto_id, confianza: Number(j.confianza ?? 0.5), resumen: j.resumen ?? null, propuesta: j.es_accionable === false ? null : j.propuesta ?? null, ia: prov.slug };
}
async function clasificarEntrada(sb: SB, entradaId: string) {
  const { data: e } = await sb.from("bandeja_entradas").select("*").eq("id", entradaId).maybeSingle();
  if (!e) return;
  const cambios: Record<string, unknown> = { estado: "clasificada", actualizado_el: new Date().toISOString() };
  const texto = `${e.asunto ?? ""}\n${e.texto ?? ""}`;
  try {
    const ia = await clasificarConIA(sb, e.user_id, { remitente: e.remitente_nombre ?? e.remitente, asunto: e.asunto, texto: e.texto, origen: e.origen });
    if (ia) { cambios.proyecto_id = ia.proyecto_id; cambios.proyecto_confianza = ia.confianza; cambios.resumen = ia.resumen; cambios.propuesta = ia.propuesta; cambios.datos = { ...(e.datos ?? {}), clasificado_por: ia.ia }; }
  } catch (err) { cambios.datos = { ...(e.datos ?? {}), error_ia: String(err?.message ?? err).slice(0, 200) }; }
  if (!cambios.proyecto_id) {
    const k = await clasificarPorPalabras(sb, e.user_id, texto);
    if (k) { cambios.proyecto_id = k.proyecto_id; cambios.proyecto_confianza = k.confianza; cambios.datos = { ...(cambios.datos as any ?? e.datos ?? {}), clasificado_por: (cambios.datos as any)?.clasificado_por ?? "palabras_clave" }; }
  }
  if (!cambios.propuesta) cambios.propuesta = { titulo: (e.asunto || (e.texto ?? "").slice(0, 80) || "Revisar mensaje").slice(0, 90), descripcion: (e.texto ?? "").slice(0, 500), prioridad: "media", requiere_atencion: true, instrucciones: "Lee el mensaje original y decide qué hacer." };
  if (!cambios.resumen) cambios.resumen = (e.texto ?? "").slice(0, 200);
  await sb.from("bandeja_entradas").update(cambios).eq("id", entradaId);
}
async function ingestar(sb: SB, userId: string, e: { origen: string; id_externo?: string; remitente?: string; remitente_nombre?: string; asunto?: string; texto?: string; fecha?: string; url_original?: string; adjuntos?: unknown[]; datos?: Record<string, unknown> }) {
  const idExt = e.id_externo ?? crypto.randomUUID();
  const { data: dup } = await sb.from("bandeja_entradas").select("id").eq("user_id", userId).eq("origen", e.origen).eq("id_externo", idExt).maybeSingle();
  if (dup) return { id: dup.id, nueva: false };
  const { data: fila, error } = await sb.from("bandeja_entradas").insert({ user_id: userId, origen: e.origen, id_externo: idExt, remitente: e.remitente ?? null, remitente_nombre: e.remitente_nombre ?? null, asunto: e.asunto ?? null, texto: e.texto ?? null, fecha: e.fecha ?? new Date().toISOString(), url_original: e.url_original ?? null, adjuntos: e.adjuntos ?? [], datos: e.datos ?? {} }).select("id").single();
  if (error) throw new Error(error.message);
  await clasificarEntrada(sb, fila.id);
  return { id: fila.id, nueva: true };
}

async function tokenGmail(sb: SB, fuente: any) {
  const refresh = await sb.rpc("leer_secreto_bandeja", { p_fuente_id: fuente.id });
  if (!refresh.data) throw new Error("Gmail no está conectado");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: G_ID, client_secret: G_SECRET, refresh_token: String(refresh.data), grant_type: "refresh_token" }) });
  if (!r.ok) throw new Error(`Google no renueva el acceso (${r.status}); vuelve a conectar Gmail`);
  return (await r.json()).access_token as string;
}
const b64url = (s: string) => { try { return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))); } catch { return ""; } };
function cuerpoDe(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return b64url(payload.body.data);
  if (payload.parts) { for (const p of payload.parts) { const t = cuerpoDe(p); if (t) return t; } }
  if (payload.mimeType === "text/html" && payload.body?.data) return b64url(payload.body.data).replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}
async function sincronizarGmail(sb: SB, fuente: any) {
  const token = await tokenGmail(sb, fuente);
  const cfg = fuente.configuracion ?? {};
  const q = [cfg.consulta || "newer_than:2d -category:promotions -category:social", cfg.etiqueta ? `label:${cfg.etiqueta}` : "", cfg.solo_no_leidos ? "is:unread" : ""].filter(Boolean).join(" ");
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Gmail ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const ids = ((await r.json()).messages ?? []) as { id: string }[];
  let nuevas = 0;
  for (const m of ids) {
    const { data: dup } = await sb.from("bandeja_entradas").select("id").eq("user_id", fuente.user_id).eq("origen", "gmail").eq("id_externo", m.id).maybeSingle();
    if (dup) continue;
    const mr = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, { headers: { Authorization: `Bearer ${token}` } });
    if (!mr.ok) continue;
    const msg = await mr.json();
    const h = (n: string) => (msg.payload?.headers ?? []).find((x: any) => x.name.toLowerCase() === n)?.value ?? "";
    const de = h("from"); const nombre = de.replace(/<.*>/, "").replace(/"/g, "").trim(); const correo = (de.match(/<([^>]+)>/)?.[1] ?? de).trim();
    const texto = cuerpoDe(msg.payload) || msg.snippet || "";
    const esPlaud = /plaud/i.test(correo) || /plaud/i.test(h("subject"));
    const adjuntos = (msg.payload?.parts ?? []).filter((p: any) => p.filename).map((p: any) => ({ nombre: p.filename, tipo: p.mimeType, bytes: p.body?.size ?? 0 }));
    await ingestar(sb, fuente.user_id, { origen: esPlaud ? "plaud" : "gmail", id_externo: m.id, remitente: correo, remitente_nombre: nombre || correo, asunto: h("subject"), texto: texto.slice(0, 20000), fecha: new Date(Number(msg.internalDate)).toISOString(), url_original: `https://mail.google.com/mail/u/0/#all/${m.id}`, adjuntos, datos: { hilo: msg.threadId, etiquetas: msg.labelIds ?? [] } });
    nuevas++;
  }
  await sb.from("bandeja_fuentes").update({ ultima_sincronizacion: new Date().toISOString(), resultado: `ok · ${nuevas} nuevas`, actualizado_el: new Date().toISOString() }).eq("id", fuente.id);
  return nuevas;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = servicio();
  const url = new URL(req.url);
  try {
    if (req.method === "GET") {
      const accion = url.searchParams.get("accion") ?? "";
      if (accion === "gmail_callback") {
        const code = url.searchParams.get("code"); const state = url.searchParams.get("state") ?? "";
        if (!code) return html("Google no devolvió el código de autorización.", 400);
        const { data: fuente } = await sb.from("bandeja_fuentes").select("*").eq("origen", "gmail").eq("user_id", state).maybeSingle();
        if (!fuente) return html("No se encontró la fuente de Gmail.", 404);
        const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: G_ID, client_secret: G_SECRET, redirect_uri: `${URL_FUNCION}?accion=gmail_callback`, grant_type: "authorization_code" }) });
        if (!r.ok) return html(`Google rechazó el intercambio: ${(await r.text()).slice(0, 200)}`, 502);
        const tok = await r.json();
        if (!tok.refresh_token) return html("Google no ha devuelto un token permanente. Quita el acceso de NexDeveloper en tu cuenta de Google (Seguridad → Aplicaciones de terceros) y vuelve a conectar.", 400);
        const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` } });
        const cuenta = ui.ok ? (await ui.json()).email : null;
        await sb.rpc("guardar_secreto_bandeja", { p_fuente_id: fuente.id, p_secreto: tok.refresh_token });
        await sb.from("bandeja_fuentes").update({ activa: true, cuenta, resultado: "conectada", actualizado_el: new Date().toISOString() }).eq("id", fuente.id);
        return html(`Gmail conectado (${cuenta ?? "cuenta"}). Ya puedes cerrar esta ventana y volver a NexDeveloper.`);
      }
      if (accion === "whatsapp" || url.searchParams.get("hub.mode")) {
        const modo = url.searchParams.get("hub.mode"); const tokenV = url.searchParams.get("hub.verify_token"); const reto = url.searchParams.get("hub.challenge");
        const { data: fuentes } = await sb.from("bandeja_fuentes").select("configuracion").eq("origen", "whatsapp");
        const ok = (fuentes ?? []).some((f) => f.configuracion?.verify_token && f.configuracion.verify_token === tokenV);
        if (modo === "subscribe" && ok) return new Response(reto ?? "", { status: 200 });
        return new Response("token incorrecto", { status: 403 });
      }
      return json({ ok: true, listo: true });
    }

    const cuerpo = await req.json().catch(() => ({}));
    if (cuerpo.object === "whatsapp_business_account") {
      let n = 0;
      for (const entry of cuerpo.entry ?? []) for (const ch of entry.changes ?? []) {
        const v = ch.value ?? {}; const pnid = v.metadata?.phone_number_id;
        const { data: fuentes } = await sb.from("bandeja_fuentes").select("*").eq("origen", "whatsapp");
        const fuente = (fuentes ?? []).find((f) => f.configuracion?.phone_number_id === pnid) ?? (fuentes ?? [])[0];
        if (!fuente) continue;
        const contactos = new Map<string, string>((v.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name ?? c.wa_id]));
        for (const m of v.messages ?? []) {
          const texto = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? (m.type === "audio" ? "[nota de voz]" : m.type === "image" ? `[imagen] ${m.image?.caption ?? ""}` : m.type === "document" ? `[documento] ${m.document?.filename ?? ""}` : `[${m.type}]`);
          await ingestar(sb, fuente.user_id, { origen: "whatsapp", id_externo: m.id, remitente: m.from, remitente_nombre: contactos.get(m.from) ?? m.from, asunto: null as any, texto, fecha: new Date(Number(m.timestamp) * 1000).toISOString(), datos: { tipo: m.type } });
          n++;
        }
        await sb.from("bandeja_fuentes").update({ ultima_sincronizacion: new Date().toISOString(), resultado: `ok · ${n} mensajes`, activa: true }).eq("id", fuente.id);
      }
      return json({ ok: true, recibidos: n });
    }

    const accion = String(cuerpo.accion ?? "");
    const tokenCron = req.headers.get("x-cron-token") ?? "";
    let esServicio = false;
    if (tokenCron) { const { data } = await sb.rpc("comprobar_cron_token", { p_token: tokenCron }); esServicio = data === true; }
    let userId: string | null = null;
    if (!esServicio) {
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: { user } } = jwt ? await sb.auth.getUser(jwt) : { data: { user: null } };
      if (!user) return json({ ok: false, error: "Sin sesión" }, 401);
      userId = user.id;
    }
    if (!accion) {
      const prov = userId ? await claveProveedor(sb, userId, ["abacus", "groq", "anthropic", "google", "openai"]) : null;
      return json({ ok: true, listo: true, google_oauth: !!(G_ID && G_SECRET), clasificador_ia: prov?.slug ?? null, url_webhook_whatsapp: `${URL_FUNCION}?accion=whatsapp`, url_callback_gmail: `${URL_FUNCION}?accion=gmail_callback` });
    }
    switch (accion) {
      case "programado": {
        if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
        const { data: fuentes } = await sb.from("bandeja_fuentes").select("*").eq("origen", "gmail").eq("activa", true).not("secreto_cifrado", "is", null);
        const res: unknown[] = [];
        for (const f of fuentes ?? []) { try { res.push({ cuenta: f.cuenta, nuevas: await sincronizarGmail(sb, f) }); } catch (e) { await sb.from("bandeja_fuentes").update({ resultado: `error: ${String(e?.message ?? e).slice(0, 200)}` }).eq("id", f.id); res.push({ cuenta: f.cuenta, error: String(e?.message ?? e) }); } }
        return json({ ok: true, resultados: res });
      }
      case "gmail_autorizar": {
        if (!G_ID || !G_SECRET) return json({ ok: false, error: "Faltan los secretos GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET en las Edge Functions (créalos en Google Cloud → APIs y servicios → Credenciales, tipo Aplicación web, con URI de redirección " + `${URL_FUNCION}?accion=gmail_callback` + ")." });
        const p = new URLSearchParams({ client_id: G_ID, redirect_uri: `${URL_FUNCION}?accion=gmail_callback`, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email", state: userId! });
        return json({ ok: true, url: `https://accounts.google.com/o/oauth2/v2/auth?${p}` });
      }
      case "gmail_sincronizar": {
        const { data: f } = await sb.from("bandeja_fuentes").select("*").eq("user_id", userId!).eq("origen", "gmail").maybeSingle();
        if (!f?.secreto_cifrado) return json({ ok: false, error: "Gmail no está conectado" });
        try { const n = await sincronizarGmail(sb, f); return json({ ok: true, nuevas: n }); }
        catch (e) { await sb.from("bandeja_fuentes").update({ resultado: `error: ${String(e?.message ?? e).slice(0, 200)}` }).eq("id", f.id); return json({ ok: false, error: String(e?.message ?? e) }); }
      }
      case "desconectar": {
        const { data: f } = await sb.from("bandeja_fuentes").select("id").eq("user_id", userId!).eq("origen", String(cuerpo.origen)).maybeSingle();
        if (f) { await sb.rpc("guardar_secreto_bandeja", { p_fuente_id: f.id, p_secreto: "" }); await sb.from("bandeja_fuentes").update({ activa: false, cuenta: null, resultado: "desconectada" }).eq("id", f.id); }
        return json({ ok: true });
      }
      case "whatsapp_configurar": {
        const { data: f } = await sb.from("bandeja_fuentes").select("*").eq("user_id", userId!).eq("origen", "whatsapp").maybeSingle();
        if (!f) return json({ ok: false, error: "Fuente no encontrada" }, 404);
        const verify = cuerpo.verify_token || f.configuracion?.verify_token || crypto.randomUUID();
        await sb.from("bandeja_fuentes").update({ configuracion: { ...(f.configuracion ?? {}), phone_number_id: cuerpo.phone_number_id ?? f.configuracion?.phone_number_id ?? null, verify_token: verify }, cuenta: cuerpo.numero ?? f.cuenta, activa: true, actualizado_el: new Date().toISOString() }).eq("id", f.id);
        if (cuerpo.access_token) await sb.rpc("guardar_secreto_bandeja", { p_fuente_id: f.id, p_secreto: String(cuerpo.access_token) });
        return json({ ok: true, url_webhook: `${URL_FUNCION}?accion=whatsapp`, verify_token: verify });
      }
      case "ingestar": {
        const uid = esServicio ? String(cuerpo.user_id ?? "") : userId!;
        let u = uid;
        if (esServicio && !u) { const { data: f } = await sb.from("bandeja_fuentes").select("user_id").limit(1).maybeSingle(); u = f?.user_id ?? ""; }
        if (!u) return json({ ok: false, error: "Sin usuario" }, 400);
        const r = await ingestar(sb, u, { origen: String(cuerpo.origen ?? "manual"), id_externo: cuerpo.id_externo, remitente: cuerpo.remitente, remitente_nombre: cuerpo.remitente_nombre, asunto: cuerpo.asunto, texto: cuerpo.texto, fecha: cuerpo.fecha, url_original: cuerpo.url_original, adjuntos: cuerpo.adjuntos, datos: cuerpo.datos });
        return json({ ok: true, ...r });
      }
      case "reclasificar": { await clasificarEntrada(sb, String(cuerpo.entrada_id)); const { data } = await sb.from("bandeja_entradas").select("*").eq("id", String(cuerpo.entrada_id)).eq("user_id", userId!).maybeSingle(); return json({ ok: true, entrada: data }); }
      case "convertir": {
        const { data: e } = await sb.from("bandeja_entradas").select("*").eq("id", String(cuerpo.entrada_id)).eq("user_id", userId!).maybeSingle();
        if (!e) return json({ ok: false, error: "Entrada no encontrada" }, 404);
        const proyectoId = cuerpo.proyecto_id ?? e.proyecto_id;
        if (!proyectoId) return json({ ok: false, error: "Elige un proyecto" }, 400);
        const p = { ...(e.propuesta ?? {}), ...(cuerpo.propuesta ?? {}) };
        const { data: t, error } = await sb.from("tareas").insert({ user_id: userId, proyecto_id: proyectoId, titulo: String(p.titulo ?? e.asunto ?? "Tarea desde la bandeja").slice(0, 200), descripcion: `${p.descripcion ?? e.resumen ?? ""}\n\n— Origen: ${e.origen} · ${e.remitente_nombre ?? e.remitente ?? ""} · ${new Date(e.fecha).toLocaleString("es-ES")}${e.url_original ? `\n${e.url_original}` : ""}\n\nMensaje original:\n${(e.texto ?? "").slice(0, 3000)}`, estado: "pendiente", prioridad: ["baja", "media", "alta", "critica"].includes(p.prioridad) ? p.prioridad : "media", requiere_atencion: p.requiere_atencion !== false, motivo_atencion: p.requiere_atencion !== false ? `Mensaje de ${e.remitente_nombre ?? e.remitente ?? e.origen}` : null, instrucciones: p.instrucciones ?? null }).select("id").single();
        if (error) return json({ ok: false, error: error.message }, 500);
        await sb.from("bandeja_entradas").update({ estado: "convertida", tarea_id: t.id, proyecto_id: proyectoId, proyecto_confirmado: true, actualizado_el: new Date().toISOString() }).eq("id", e.id);
        await sb.from("actividad").insert({ user_id: userId, proyecto_id: proyectoId, tipo: "bandeja", texto: `Tarea creada desde ${e.origen}: ${p.titulo ?? e.asunto ?? ""}`.slice(0, 300), referencia_tabla: "tareas", referencia_id: t.id });
        return json({ ok: true, tarea_id: t.id });
      }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (e) { return json({ ok: false, error: String(e?.message ?? e) }, 500); }
});
