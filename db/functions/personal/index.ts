// NexDeveloper · Edge Function «personal» (0.31.0)
// Apartado PERSONAL: conversaciones ajenas a los proyectos. Cada pregunta se envía a la vez a las IA con clave
// (Anthropic, Google, OpenAI, Groq, Mistral, DeepSeek, xAI, OpenRouter) y un «juez» fusiona las respuestas en una sola,
// señalando discrepancias. Documentos personales en la carpeta PERSONAL del almacén (nunca en carpetas de proyectos)
// y nunca en Proyectian. Anota el consumo en consumos_ia sin proyecto.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const ahora = () => new Date().toISOString();
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Prov = { slug: string; nombre: string; clave: string; modelo: string; modelo_id: string | null; ce: number; cs: number; calidad: number };
async function proveedoresDisponibles(sb: SB, userId: string): Promise<Prov[]> {
  const { data: provs } = await sb.from("proveedores_ia").select("id, nombre, clave_slug, clave_cifrada").eq("user_id", userId).eq("activo", true).not("clave_cifrada", "is", null).in("clave_slug", ["anthropic", "openai", "google", "groq", "mistral", "deepseek", "xai", "openrouter"]);
  const out: Prov[] = [];
  for (const p of provs ?? []) {
    const { data: clave } = await sb.rpc("descifrar_clave_proveedor", { p_proveedor_id: p.id }); if (!clave) continue;
    const { data: modelos } = await sb.from("modelos_ia").select("id, identificador, calidad, coste_entrada, coste_salida").eq("proveedor_id", p.id).eq("activo", true).order("calidad", { ascending: false });
    const m = (modelos ?? []).find((x) => !/image|imagen|tts|whisper|embed/i.test(x.identificador)); if (!m) continue;
    out.push({ slug: p.clave_slug, nombre: p.nombre, clave: String(clave), modelo: m.identificador, modelo_id: m.id, ce: Number(m.coste_entrada ?? 0), cs: Number(m.coste_salida ?? 0), calidad: Number(m.calidad ?? 3) });
  }
  return out.sort((a, b) => b.calidad - a.calidad);
}
const coste = (p: Prov, te: number, ts: number) => Number(((te * p.ce + ts * p.cs) / 1_000_000).toFixed(4));
type Turno = { role: "user" | "assistant"; content: string };
async function llamar(p: Prov, sistema: string, turnos: Turno[], maxTokens = 2500) {
  if (p.slug === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": p.clave, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: p.modelo, max_tokens: maxTokens, system: sistema, messages: turnos }) });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 160)}`); const j = await r.json();
    return { texto: (j.content ?? []).map((c: any) => c.text ?? "").join(""), te: j.usage?.input_tokens ?? 0, ts: j.usage?.output_tokens ?? 0 };
  }
  if (p.slug === "google") {
    const contents = turnos.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] }));
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${p.modelo}:generateContent?key=${p.clave}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 } }) });
    if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 160)}`); const j = await r.json();
    return { texto: (j.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text ?? "").join(""), te: j.usageMetadata?.promptTokenCount ?? 0, ts: j.usageMetadata?.candidatesTokenCount ?? 0 };
  }
  const bases: Record<string, string> = { openai: "https://api.openai.com/v1", groq: "https://api.groq.com/openai/v1", mistral: "https://api.mistral.ai/v1", deepseek: "https://api.deepseek.com/v1", xai: "https://api.x.ai/v1", openrouter: "https://openrouter.ai/api/v1" };
  const r = await fetch(`${bases[p.slug]}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${p.clave}`, "content-type": "application/json" }, body: JSON.stringify({ model: p.modelo, max_tokens: maxTokens, temperature: 0.4, messages: [{ role: "system", content: sistema }, ...turnos] }) });
  if (!r.ok) throw new Error(`${p.slug} ${r.status}: ${(await r.text()).slice(0, 160)}`); const j = await r.json();
  return { texto: j.choices?.[0]?.message?.content ?? "", te: j.usage?.prompt_tokens ?? 0, ts: j.usage?.completion_tokens ?? 0 };
}
async function conTiempo<T>(p: Promise<T>, ms = 60_000): Promise<T> {
  let t: number | undefined; const l = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`Sin respuesta en ${ms / 1000} s`)), ms); });
  try { return await Promise.race([p, l]); } finally { clearTimeout(t); }
}

// ---------- Almacén (carpeta PERSONAL) ----------
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string | Uint8Array) => hex(await crypto.subtle.digest("SHA-256", typeof s === "string" ? enc.encode(s) : s));
async function hmac(key: ArrayBuffer | Uint8Array, msg: string) { const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return crypto.subtle.sign("HMAC", k, enc.encode(msg)); }
const codificar = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const codClave = (k: string) => k.split("/").map(codificar).join("/");
const fechaAmz = () => { const iso = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); return { larga: iso, corta: iso.slice(0, 8) }; };
type Destino = { endpoint: string; region: string; bucket: string; access: string; secret: string };
async function claveFirma(d: Destino, corta: string) { const a = await hmac(enc.encode("AWS4" + d.secret), corta); const b = await hmac(a, d.region); const c = await hmac(b, "s3"); return hmac(c, "aws4_request"); }
async function s3put(d: Destino, clave: string, cuerpo: Uint8Array, tipo: string) {
  const u = new URL(d.endpoint); const host = u.host; const { larga, corta } = fechaAmz(); const ruta = `/${d.bucket}/${codClave(clave)}`;
  const hashCuerpo = await sha256(cuerpo);
  const cabs: Record<string, string> = { "content-type": tipo, host, "x-amz-content-sha256": hashCuerpo, "x-amz-date": larga };
  const firmadas = Object.keys(cabs).sort();
  const canon = ["PUT", ruta, "", firmadas.map((k) => `${k}:${cabs[k]}\n`).join(""), firmadas.join(";"), hashCuerpo].join("\n");
  const aFirmar = ["AWS4-HMAC-SHA256", larga, `${corta}/${d.region}/s3/aws4_request`, await sha256(canon)].join("\n");
  const firma = hex(await hmac(await claveFirma(d, corta), aFirmar));
  const headers: Record<string, string> = { ...cabs, Authorization: `AWS4-HMAC-SHA256 Credential=${d.access}/${corta}/${d.region}/s3/aws4_request, SignedHeaders=${firmadas.join(";")}, Signature=${firma}` };
  delete headers.host;
  const r = await fetch(`${u.protocol}//${host}${ruta}`, { method: "PUT", headers, body: cuerpo });
  if (!r.ok) throw new Error(`Almacén ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
async function presignar(d: Destino, clave: string, nombre: string, seg = 3600, inline = true) {
  const u = new URL(d.endpoint); const host = u.host; const { larga, corta } = fechaAmz(); const path = `/${d.bucket}/${codClave(clave)}`;
  const q: Record<string, string> = { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${d.access}/${corta}/${d.region}/s3/aws4_request`, "X-Amz-Date": larga, "X-Amz-Expires": String(seg), "X-Amz-SignedHeaders": "host", "response-content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(nombre)}` };
  const cq = Object.keys(q).sort().map((k) => `${codificar(k)}=${codificar(q[k])}`).join("&");
  const canon = ["GET", path, cq, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const aFirmar = ["AWS4-HMAC-SHA256", larga, `${corta}/${d.region}/s3/aws4_request`, await sha256(canon)].join("\n");
  return `${u.protocol}//${host}${path}?${cq}&X-Amz-Signature=${hex(await hmac(await claveFirma(d, corta), aFirmar))}`;
}
async function destinoDocumentos(sb: SB, userId: string): Promise<Destino | null> {
  const { data: lista } = await sb.from("copias_destinos").select("id").eq("user_id", userId).eq("activo", true).order("usar_para_documentos", { ascending: false }).order("es_predeterminado", { ascending: false }).limit(1);
  const dest = lista?.[0]; if (!dest) return null;
  const { data } = await sb.rpc("leer_destino_copias", { p_destino_id: dest.id });
  const f = Array.isArray(data) ? data[0] : data; if (!f?.secreto) return null;
  return { endpoint: f.url_servidor.replace(/\/+$/, ""), region: f.region || "eu-central-1", bucket: "proyectian", access: f.usuario, secret: f.secreto };
}
function mdAHtml(md: string) {
  const lineas = (md ?? "").split("\n"); const out: string[] = []; let lista = false;
  for (const l of lineas) {
    const t = l.trim();
    if (/^[-*] /.test(t)) { if (!lista) { out.push("<ul>"); lista = true; } out.push(`<li>${inline(t.slice(2))}</li>`); continue; }
    if (lista) { out.push("</ul>"); lista = false; }
    if (/^### /.test(t)) out.push(`<h3>${inline(t.slice(4))}</h3>`); else if (/^## /.test(t)) out.push(`<h2>${inline(t.slice(3))}</h2>`); else if (/^# /.test(t)) out.push(`<h1>${inline(t.slice(2))}</h1>`); else if (t) out.push(`<p>${inline(t)}</p>`);
  }
  if (lista) out.push("</ul>");
  return out.join("\n");
  function inline(s: string) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>"); }
}
const documentoHtml = (titulo: string, md: string, marca: string) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.55}h1{font-size:26px;border-bottom:2px solid #1a1a1a;padding-bottom:8px}h2{font-size:19px;margin-top:28px}code{background:#f3f3f3;padding:1px 4px;border-radius:3px}.pie{margin-top:40px;color:#777;font-size:11px;border-top:1px solid #ddd;padding-top:10px}@media print{body{margin:0}}</style></head><body><h1>${esc(titulo)}</h1>${mdAHtml(md)}<div class="pie">Documento personal · ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })} · ${esc(marca)}</div></body></html>`;

async function config(sb: SB, userId: string) {
  const { data } = await sb.from("personal_config").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data;
  const { data: n } = await sb.from("personal_config").insert({ user_id: userId }).select("*").single();
  return n!;
}
const SISTEMA_BASE = (instr?: string | null) => `Eres el asistente personal de Javier (Soluciones EvoluteIA). Este es su espacio PERSONAL: no tiene nada que ver con sus proyectos de software ni con sus clientes; no menciones proyectos, tareas ni herramientas de la empresa salvo que él lo pida. Responde siempre en español de España, con claridad, sin rodeos, con la mejor información que tengas; si algo depende de datos actuales que no puedes conocer, dilo. Usa Markdown ligero (títulos, listas) cuando ayude.${instr ? `\n\nPreferencias de Javier: ${instr}` : ""}`;

// Pregunta a varias IA a la vez y fusiona
async function responder(sb: SB, userId: string, cfg: any, historial: Turno[], pregunta: string) {
  let provs = await proveedoresDisponibles(sb, userId);
  if (!provs.length) throw new Error("No hay ningún proveedor de IA de texto con clave (Anthropic, Google, OpenAI, Groq…). Ponla en Ajustes → Proveedores.");
  if (Array.isArray(cfg.proveedores) && cfg.proveedores.length) provs = provs.filter((p) => cfg.proveedores.includes(p.slug));
  if (!provs.length) provs = await proveedoresDisponibles(sb, userId);
  const juez = provs.find((p) => p.slug === cfg.juez) ?? provs[0];
  const modo = cfg.modo ?? "fusion";
  const participantes = modo === "rapido" ? [juez] : provs.slice(0, Number(cfg.max_proveedores ?? 4));
  const turnos: Turno[] = [...historial.slice(-12), { role: "user", content: pregunta }];
  const sistema = SISTEMA_BASE(cfg.instrucciones);
  const t0 = Date.now();
  const resultados = await Promise.all(participantes.map(async (p) => {
    const ini = Date.now();
    try { const r = await conTiempo(llamar(p, sistema, turnos, 2200)); return { proveedor: p.slug, nombre: p.nombre, modelo: p.modelo, texto: r.texto, tokens_entrada: r.te, tokens_salida: r.ts, coste: coste(p, r.te, r.ts), ms: Date.now() - ini, error: null as string | null, p }; }
    catch (e) { return { proveedor: p.slug, nombre: p.nombre, modelo: p.modelo, texto: "", tokens_entrada: 0, tokens_salida: 0, coste: 0, ms: Date.now() - ini, error: String(e?.message ?? e).slice(0, 200), p }; }
  }));
  const validas = resultados.filter((r) => !r.error && r.texto.trim());
  if (!validas.length) throw new Error(`Ninguna IA respondió: ${resultados.map((r) => `${r.nombre}: ${r.error}`).join(" · ")}`);
  let texto = validas[0].texto; let discrepancias: string | null = null; let juezUsado: string | null = null; let teJ = 0, tsJ = 0, costeJ = 0;
  if (modo === "fusion" && validas.length > 1) {
    const sistemaJ = `${SISTEMA_BASE(cfg.instrucciones)}\n\nAhora actúas como JUEZ: has recibido la misma pregunta respondida por varias IA. Escribe UNA sola respuesta final para Javier, la mejor posible, tomando lo más correcto, completo y útil de cada una, corrigiendo errores evidentes y sin decir «según la IA X». Al final, si las respuestas discrepan en algo relevante, añade una sección corta «Dónde no coinciden» (2-4 frases); si coinciden, no la añadas.`;
    const preg = `Pregunta de Javier:\n${pregunta}\n\n${validas.map((r, i) => `=== Respuesta ${i + 1} (${r.nombre} · ${r.modelo}) ===\n${r.texto}`).join("\n\n")}`;
    try {
      const rj = await conTiempo(llamar(juez, sistemaJ, [...historial.slice(-6), { role: "user", content: preg }], 3000), 70_000);
      texto = rj.texto; teJ = rj.te; tsJ = rj.ts; costeJ = coste(juez, rj.te, rj.ts); juezUsado = juez.slug;
      const m = texto.match(/(?:^|\n)#{0,3}\s*\**Dónde no coinciden\**:?\s*\n([\s\S]+)$/i); if (m) discrepancias = m[1].trim().slice(0, 800);
    } catch (e) { juezUsado = null; texto = validas[0].texto + `\n\n_(No se pudo fusionar: ${String(e?.message ?? e).slice(0, 100)}; se muestra la respuesta de ${validas[0].nombre}.)_`; }
  }
  // Consumos (sin proyecto)
  for (const r of validas) if (r.p.modelo_id) await sb.from("consumos_ia").insert({ user_id: userId, proyecto_id: null, modelo_id: r.p.modelo_id, tokens_entrada: r.tokens_entrada, tokens_salida: r.tokens_salida, coste: r.coste, duracion_ms: r.ms, resultado: "ok" }).then(() => {}, () => {});
  if (juezUsado && juez.modelo_id) await sb.from("consumos_ia").insert({ user_id: userId, proyecto_id: null, modelo_id: juez.modelo_id, tokens_entrada: teJ, tokens_salida: tsJ, coste: costeJ, resultado: "ok" }).then(() => {}, () => {});
  const te = resultados.reduce((a, r) => a + r.tokens_entrada, 0) + teJ, ts = resultados.reduce((a, r) => a + r.tokens_salida, 0) + tsJ, ct = Number((resultados.reduce((a, r) => a + r.coste, 0) + costeJ).toFixed(4));
  return { texto, respuestas: resultados.map(({ p: _p, ...r }) => r), juez: juezUsado, discrepancias, te, ts, coste: ct, ms: Date.now() - t0 };
}
async function titular(sb: SB, userId: string, pregunta: string) {
  try { const provs = await proveedoresDisponibles(sb, userId); const p = provs.slice().sort((a, b) => a.ce - b.ce)[0] ?? provs[0]; if (!p) return pregunta.slice(0, 60);
    const r = await conTiempo(llamar(p, "Devuelve SOLO un título de 3 a 7 palabras, en español, sin comillas ni punto final, que resuma la consulta.", [{ role: "user", content: pregunta.slice(0, 1500) }], 40), 15_000);
    return r.texto.replace(/["«».]/g, "").trim().slice(0, 80) || pregunta.slice(0, 60);
  } catch { return pregunta.slice(0, 60); }
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
    if (esServicio && cuerpo.user_id) userId = String(cuerpo.user_id);
    if (!userId) return json({ ok: false, error: "Falta el usuario" }, 400);
    switch (accion) {
      case "estado": {
        const cfg = await config(sb, userId);
        const provs = await proveedoresDisponibles(sb, userId);
        const { data: convs } = await sb.from("personal_conversaciones").select("*").eq("user_id", userId).eq("archivada", false).order("fijada", { ascending: false }).order("ultimo_mensaje_el", { ascending: false, nullsFirst: false }).limit(100);
        const { count: docs } = await sb.from("personal_documentos").select("id", { count: "exact", head: true }).eq("user_id", userId);
        return json({ ok: true, config: cfg, proveedores: provs.map((p) => ({ slug: p.slug, nombre: p.nombre, modelo: p.modelo, calidad: p.calidad })), conversaciones: convs ?? [], documentos: docs ?? 0, almacen: !!(await destinoDocumentos(sb, userId)) });
      }
      case "configurar": {
        const permitidos = ["proveedores", "max_proveedores", "juez", "modo", "guardar_en_almacen", "carpeta_almacen", "carpeta_mac", "instrucciones"];
        const cambios: Record<string, unknown> = { user_id: userId, actualizado_el: ahora() };
        for (const k of permitidos) if (k in cuerpo) cambios[k] = cuerpo[k];
        const { data } = await sb.from("personal_config").upsert(cambios).select("*").single();
        return json({ ok: true, config: data });
      }
      case "nueva": {
        const { data } = await sb.from("personal_conversaciones").insert({ user_id: userId, titulo: cuerpo.titulo ?? "Nueva conversación" }).select("*").single();
        return json({ ok: true, conversacion: data });
      }
      case "mensajes": {
        const { data } = await sb.from("personal_mensajes").select("*").eq("user_id", userId).eq("conversacion_id", String(cuerpo.conversacion_id)).order("fecha").limit(400);
        return json({ ok: true, mensajes: data ?? [] });
      }
      case "preguntar": {
        const pregunta = String(cuerpo.texto ?? "").trim(); if (!pregunta) return json({ ok: false, error: "Escribe la pregunta" }, 400);
        const cfg = await config(sb, userId);
        const { data: permitido } = await sb.rpc("gasto_ia_permitido", { p_user_id: userId, p_proveedor: null, p_proyecto_id: null });
        if (permitido === false) return json({ ok: false, error: "Presupuesto de IA superado con acción «bloquear». Revisa Gasto de IA → Presupuestos." }, 400);
        let convId = cuerpo.conversacion_id ? String(cuerpo.conversacion_id) : null;
        let nueva = false;
        if (!convId) { const { data: c } = await sb.from("personal_conversaciones").insert({ user_id: userId, titulo: await titular(sb, userId, pregunta) }).select("id").single(); convId = c!.id; nueva = true; }
        else { const { data: c } = await sb.from("personal_conversaciones").select("id, mensajes").eq("id", convId).eq("user_id", userId).maybeSingle(); if (!c) return json({ ok: false, error: "Conversación no encontrada" }, 404); if (!c.mensajes) { await sb.from("personal_conversaciones").update({ titulo: await titular(sb, userId, pregunta) }).eq("id", convId); } }
        const { data: previos } = await sb.from("personal_mensajes").select("rol, texto").eq("conversacion_id", convId).order("fecha").limit(30);
        const historial: Turno[] = (previos ?? []).map((m) => ({ role: m.rol === "usuario" ? "user" : "assistant", content: m.texto }));
        const { data: mu } = await sb.from("personal_mensajes").insert({ user_id: userId, conversacion_id: convId, rol: "usuario", texto: pregunta, adjuntos: cuerpo.adjuntos ?? [] }).select("*").single();
        const r = await responder(sb, userId, cfg, historial, pregunta);
        const { data: ma } = await sb.from("personal_mensajes").insert({ user_id: userId, conversacion_id: convId, rol: "asistente", texto: r.texto, respuestas: r.respuestas, juez: r.juez, discrepancias: r.discrepancias, tokens_entrada: r.te, tokens_salida: r.ts, coste: r.coste }).select("*").single();
        await sb.rpc("incrementar_conversacion_personal", { p_id: convId, p_coste: r.coste }).then(() => {}, async () => { await sb.from("personal_conversaciones").update({ ultimo_mensaje_el: ahora(), actualizado_el: ahora() }).eq("id", convId); });
        return json({ ok: true, conversacion_id: convId, nueva, pregunta: mu, respuesta: ma, ms: r.ms });
      }
      case "renombrar": { await sb.from("personal_conversaciones").update({ titulo: String(cuerpo.titulo ?? "").slice(0, 120), actualizado_el: ahora() }).eq("id", String(cuerpo.conversacion_id)).eq("user_id", userId); return json({ ok: true }); }
      case "fijar": { await sb.from("personal_conversaciones").update({ fijada: !!cuerpo.fijada }).eq("id", String(cuerpo.conversacion_id)).eq("user_id", userId); return json({ ok: true }); }
      case "archivar": { await sb.from("personal_conversaciones").update({ archivada: cuerpo.archivada ?? true }).eq("id", String(cuerpo.conversacion_id)).eq("user_id", userId); return json({ ok: true }); }
      case "borrar": { await sb.from("personal_conversaciones").delete().eq("id", String(cuerpo.conversacion_id)).eq("user_id", userId); return json({ ok: true }); }
      case "documentos": {
        const { data } = await sb.from("personal_documentos").select("id, conversacion_id, titulo, tipo, ruta_remota, ruta_mac, bytes, etiquetas, creado_el").eq("user_id", userId).order("creado_el", { ascending: false }).limit(300);
        return json({ ok: true, documentos: data ?? [] });
      }
      case "documento": {
        const { data } = await sb.from("personal_documentos").select("*").eq("id", String(cuerpo.id)).eq("user_id", userId).single();
        return json({ ok: !!data, documento: data });
      }
      case "crear_documento": {
        // A partir de una conversación (o de un texto): redacta un documento y lo guarda en PERSONAL
        const cfg = await config(sb, userId);
        let md = String(cuerpo.contenido_md ?? "").trim(); let titulo = String(cuerpo.titulo ?? "").trim();
        if (!md && cuerpo.conversacion_id) {
          const { data: msgs } = await sb.from("personal_mensajes").select("rol, texto").eq("conversacion_id", String(cuerpo.conversacion_id)).eq("user_id", userId).order("fecha").limit(60);
          const provs = await proveedoresDisponibles(sb, userId); const p = provs[0]; if (!p) return json({ ok: false, error: "Sin proveedor de IA" }, 400);
          const tipo = String(cuerpo.tipo ?? "informe");
          const r = await conTiempo(llamar(p, `${SISTEMA_BASE(cfg.instrucciones)}\n\nRedacta un ${tipo} en Markdown, completo y bien estructurado (título con #, secciones con ##), a partir de la conversación. Sin preámbulos.`, [{ role: "user", content: (msgs ?? []).map((m) => `${m.rol === "usuario" ? "Javier" : "Asistente"}: ${m.texto}`).join("\n\n").slice(0, 60000) + (cuerpo.indicaciones ? `\n\nIndicaciones: ${cuerpo.indicaciones}` : "") }], 4000), 90_000);
          md = r.texto; if (!titulo) titulo = (md.match(/^#\s+(.+)$/m)?.[1] ?? "Documento personal").trim();
          if (p.modelo_id) await sb.from("consumos_ia").insert({ user_id: userId, modelo_id: p.modelo_id, tokens_entrada: r.te, tokens_salida: r.ts, coste: coste(p, r.te, r.ts), resultado: "ok" }).then(() => {}, () => {});
        }
        if (!md) return json({ ok: false, error: "No hay contenido" }, 400);
        if (!titulo) titulo = "Documento personal";
        const { data: cfgApp } = await sb.from("configuracion_app").select("valor").eq("clave", "powered_by").maybeSingle();
        const html = documentoHtml(titulo, md, cfgApp?.valor ?? "NexDeveloper");
        const base = `${new Date().toISOString().slice(0, 10)}-${titulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}`;
        let ruta: string | null = null;
        if (cfg.guardar_en_almacen) { try { const d = await destinoDocumentos(sb, userId); if (d) { ruta = `${cfg.carpeta_almacen}/${new Date().getFullYear()}/${base}.html`; await s3put(d, ruta, enc.encode(html), "text/html; charset=utf-8"); } } catch { ruta = null; } }
        const rutaMac = `${cfg.carpeta_mac}/${base}.pdf`;
        const { data: doc } = await sb.from("personal_documentos").insert({ user_id: userId, conversacion_id: cuerpo.conversacion_id ?? null, titulo, tipo: cuerpo.tipo ?? "informe", contenido_md: md, html, ruta_remota: ruta, ruta_mac: rutaMac, bytes: html.length, etiquetas: cuerpo.etiquetas ?? [] }).select("*").single();
        return json({ ok: true, documento: doc, almacen: !!ruta });
      }
      case "enlace_documento": {
        const { data: doc } = await sb.from("personal_documentos").select("titulo, ruta_remota").eq("id", String(cuerpo.id)).eq("user_id", userId).single();
        if (!doc?.ruta_remota) return json({ ok: false, error: "El documento no está en el almacén (usa la vista previa)" }, 404);
        const d = await destinoDocumentos(sb, userId); if (!d) return json({ ok: false, error: "Sin almacén" }, 404);
        return json({ ok: true, url: await presignar(d, doc.ruta_remota, `${doc.titulo}.html`, 3600, true) });
      }
      case "borrar_documento": { await sb.from("personal_documentos").delete().eq("id", String(cuerpo.id)).eq("user_id", userId); return json({ ok: true }); }
      // ----- Editor de estilo propio (tu voz) -----
      case "estilo_muestras": {
        // Guarda textos escritos por Javier (3-6) y aprende su perfil de estilo
        const muestras: string[] = (Array.isArray(cuerpo.muestras) ? cuerpo.muestras : []).map((m: unknown) => String(m ?? "").trim()).filter((m: string) => m.length > 80).slice(0, 8);
        if (muestras.length < 1) return json({ ok: false, error: "Pega al menos un texto tuyo de más de 80 caracteres" }, 400);
        const provs = await proveedoresDisponibles(sb, userId); const p = provs[0]; if (!p) return json({ ok: false, error: "Sin proveedor de IA de texto con clave" }, 400);
        const r = await conTiempo(llamar(p, "Eres un editor literario. Analizas textos escritos por una persona y describes su estilo para que otro redactor pueda escribir como ella. Español de España. Devuelve un perfil en 12-20 líneas: tono, longitud media de frase, vocabulario y expresiones habituales, muletillas, cómo empieza y termina, uso de listas, formalidad, lo que NUNCA haría. Sin preámbulos.", [{ role: "user", content: muestras.map((m, i) => `=== Texto ${i + 1} ===\n${m}`).join("\n\n").slice(0, 30000) }], 1200), 60_000);
        await sb.from("consumos_ia").insert({ user_id: userId, modelo_id: p.modelo_id, tokens_entrada: r.te, tokens_salida: r.ts, coste: coste(p, r.te, r.ts), resultado: "ok" }).then(() => {}, () => {});
        const { data } = await sb.from("personal_config").upsert({ user_id: userId, muestras_estilo: muestras, perfil_estilo: r.texto.trim(), perfil_estilo_el: ahora(), actualizado_el: ahora() }).select("*").single();
        return json({ ok: true, perfil_estilo: data?.perfil_estilo });
      }
      case "reescribir": {
        // modo: mi_voz (reescribe como Javier) | marca (guía de estilo del proyecto) | tutor (no escribe por él: esquema, correcciones y preguntas)
        const texto = String(cuerpo.texto ?? "").trim(); if (texto.length < 20) return json({ ok: false, error: "Pega el texto a trabajar" }, 400);
        const modo = ["mi_voz", "marca", "tutor"].includes(cuerpo.modo) ? cuerpo.modo : "mi_voz";
        const cfg = await config(sb, userId);
        const provs = await proveedoresDisponibles(sb, userId); const p = provs[0]; if (!p) return json({ ok: false, error: "Sin proveedor de IA de texto con clave" }, 400);
        let guia: string | null = null; let proyectoId: string | null = null;
        if (modo === "marca" && cuerpo.proyecto_id) { const { data: pr } = await sb.from("proyectos").select("id, nombre, guia_estilo, descripcion").eq("id", String(cuerpo.proyecto_id)).eq("user_id", userId).maybeSingle(); if (pr) { proyectoId = pr.id; guia = pr.guia_estilo ?? `Tono cercano y claro para los usuarios de ${pr.nombre} (${pr.descripcion ?? ""}).`; } }
        let sistema: string; let salida: any = {};
        if (modo === "tutor") {
          sistema = `Eres un tutor de redacción. NO reescribes el texto del alumno ni lo redactas por él: le ayudas a mejorarlo con honestidad. Español de España. Devuelve SOLO JSON: {"valoracion":"2-3 frases","esquema_sugerido":["…"],"correcciones":[{"fragmento":"texto original","problema":"…","sugerencia":"cómo mejorarlo (explicación, no el texto final)"}],"preguntas_para_profundizar":["…"],"fuentes_sugeridas":["tipo de fuente o dónde buscar"],"siguiente_paso":"qué debería hacer ahora"}`;
        } else {
          const perfil = modo === "marca" ? `GUÍA DE ESTILO DEL PROYECTO:\n${guia}` : `PERFIL DE ESTILO DE JAVIER:\n${cfg.perfil_estilo ?? "(sin perfil aún: escribe claro, directo, cercano, frases cortas, español de España)"}`;
          sistema = `Eres el editor personal de Javier. Reescribes el texto que te dan para que suene como lo escribiría él (o como pide la guía), manteniendo TODO el contenido, los datos y la intención; quitas relleno, repeticiones y frases hechas; no inventas nada. ${perfil}\n${cuerpo.tono ? `Tono pedido: ${cuerpo.tono}.` : ""}\nDevuelve SOLO el texto reescrito, sin comentarios.`;
        }
        const r = await conTiempo(llamar(p, sistema, [{ role: "user", content: texto.slice(0, 40000) }], 4000), 90_000);
        const c = coste(p, r.te, r.ts);
        await sb.from("consumos_ia").insert({ user_id: userId, proyecto_id: proyectoId, modelo_id: p.modelo_id, tokens_entrada: r.te, tokens_salida: r.ts, coste: c, resultado: "ok" }).then(() => {}, () => {});
        if (modo === "tutor") { let j: any = null; try { j = JSON.parse((r.texto.match(/\{[\s\S]*\}/) ?? [r.texto])[0]); } catch { j = { valoracion: r.texto }; } salida = { notas: j }; }
        else salida = { texto_resultado: r.texto.trim() };
        const { data: reg } = await sb.from("estilo_reescrituras").insert({ user_id: userId, proyecto_id: proyectoId, modo, texto_original: texto, texto_resultado: salida.texto_resultado ?? null, notas: salida.notas ?? null, coste: c }).select("id").single();
        return json({ ok: true, id: reg?.id, modo, ...salida, coste: c, perfil_disponible: !!cfg.perfil_estilo });
      }
      case "guia_estilo_proyecto": {
        // Guardar o generar la guía de estilo de un proyecto (para textos de cliente: hojas de cambios, manuales, portal)
        const { data: pr } = await sb.from("proyectos").select("id, nombre, descripcion, objetivo").eq("id", String(cuerpo.proyecto_id)).eq("user_id", userId).maybeSingle();
        if (!pr) return json({ ok: false, error: "Proyecto no encontrado" }, 404);
        let guia = cuerpo.guia_estilo ? String(cuerpo.guia_estilo) : null;
        if (!guia) { const provs = await proveedoresDisponibles(sb, userId); const p = provs[0]; if (!p) return json({ ok: false, error: "Sin proveedor de IA" }, 400); const r = await conTiempo(llamar(p, "Redactas guías de estilo breves (10-15 líneas) para los textos que ve el cliente de una aplicación: tono, tratamiento (tú/usted), vocabulario, lo que evitar, ejemplos de frases. Español de España. Sin preámbulos.", [{ role: "user", content: `Aplicación: ${pr.nombre}. ${pr.descripcion ?? ""} Objetivo: ${pr.objetivo ?? ""}. ${cuerpo.indicaciones ?? ""}` }], 900), 60_000); guia = r.texto.trim(); await sb.from("consumos_ia").insert({ user_id: userId, proyecto_id: pr.id, modelo_id: p.modelo_id, tokens_entrada: r.te, tokens_salida: r.ts, coste: coste(p, r.te, r.ts), resultado: "ok" }).then(() => {}, () => {}); }
        await sb.from("proyectos").update({ guia_estilo: guia }).eq("id", pr.id);
        return json({ ok: true, guia_estilo: guia });
      }
      case "reescrituras": { const { data } = await sb.from("estilo_reescrituras").select("id, proyecto_id, modo, texto_original, creado_el, coste").eq("user_id", userId).order("creado_el", { ascending: false }).limit(50); return json({ ok: true, reescrituras: (data ?? []).map((x) => ({ ...x, extracto: String(x.texto_original).slice(0, 160), texto_original: undefined })) }); }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (err) { return json({ ok: false, error: String(err?.message ?? err) }, 500); }
});
