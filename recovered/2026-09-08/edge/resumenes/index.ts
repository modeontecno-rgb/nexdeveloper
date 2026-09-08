// NexDeveloper · Edge Function «resumenes» (0.14.0)
// Resumen diario (08:00) e informe semanal de cartera: recopila datos reales, redacta (plantilla o IA) y envía por correo (Gmail conectado o Resend) y WhatsApp (Meta).
// Acciones: generar {tipo, fecha?, enviar?, canales?} (usuario) · programado {tipo} (x-cron-token) · enviar {resumen_id, canales?}
// 0.36.0: la intro por IA prueba primero Abacus (RouteLLM), incluido sin coste extra en la suscripción.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const G_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
const G_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const fechaEs = (d: Date) => d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });
const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

async function recopilar(sb: SB, userId: string, desde: Date, hasta: Date) {
  const d = desde.toISOString(), h = hasta.toISOString();
  const [atencion, desatendidas, completadas, compil, vig, dom, copias, bandeja, calidad, consumo, actividad, alertas, proyectos] = await Promise.all([
    sb.from("tareas").select("id, titulo, prioridad, motivo_atencion, instrucciones, proyecto_id, creado_el").eq("user_id", userId).eq("requiere_atencion", true).is("atendida_el", null).neq("estado", "completada").order("prioridad").limit(30),
    sb.from("tareas").select("id, titulo, estado, proyecto_id").eq("user_id", userId).eq("requiere_atencion", false).in("estado", ["pendiente", "en_cola", "ejecutando"]).limit(200),
    sb.from("tareas").select("id, titulo, proyecto_id, completada_el").eq("user_id", userId).gte("completada_el", d).lte("completada_el", h).limit(100),
    sb.from("compilaciones").select("id, plataforma, version, estado, proyecto_id, terminada_el, error").eq("user_id", userId).gte("creado_el", d).limit(50),
    sb.from("vigilancia_hallazgos").select("id, titulo, relevancia, tipo, proyecto_id, por_que_afecta").eq("user_id", userId).eq("estado", "nuevo").order("relevancia").limit(30),
    sb.from("dominios").select("dominio, resultado, cert_dias, dominio_dias, error").eq("user_id", userId).eq("activo", true).in("resultado", ["aviso", "error"]).limit(30),
    sb.from("copias").select("id, tipo, nombre, estado, error, creado_el").eq("user_id", userId).gte("creado_el", d).limit(200),
    sb.from("bandeja_entradas").select("id, origen, remitente_nombre, asunto, proyecto_id").eq("user_id", userId).in("estado", ["nueva", "clasificada"]).limit(50),
    sb.from("proyectos").select("id, nombre, semaforo_calidad").eq("user_id", userId).eq("semaforo_calidad", "rojo").limit(30),
    sb.from("consumos_ia").select("coste, tokens_entrada, tokens_salida, modelo_id").eq("user_id", userId).gte("created_at", d).lte("created_at", h).limit(2000),
    sb.from("actividad").select("tipo, texto, proyecto_id, fecha").eq("user_id", userId).gte("fecha", d).lte("fecha", h).order("fecha", { ascending: false }).limit(60),
    sb.from("alertas").select("texto, nivel, proyecto_id").eq("user_id", userId).eq("resuelta", false).limit(30),
    sb.from("proyectos").select("id, nombre, estado, semaforo_calidad").eq("user_id", userId),
  ]);
  const nombre = new Map((proyectos.data ?? []).map((p) => [p.id, p.nombre]));
  const np = (id: string | null) => (id ? nombre.get(id) ?? "—" : "Sin proyecto");
  const costeIA = (consumo.data ?? []).reduce((s, c) => s + Number(c.coste ?? 0), 0);
  const tokensIA = (consumo.data ?? []).reduce((s, c) => s + Number(c.tokens_entrada ?? 0) + Number(c.tokens_salida ?? 0), 0);
  return {
    np,
    atencion: atencion.data ?? [], desatendidas: desatendidas.data ?? [], completadas: completadas.data ?? [],
    compilaciones: compil.data ?? [], vigilancia: vig.data ?? [], dominios: dom.data ?? [], copias: copias.data ?? [], bandeja: bandeja.data ?? [], calidadRojo: calidad.data ?? [],
    consumo: { coste: costeIA, tokens: tokensIA, llamadas: (consumo.data ?? []).length }, actividad: actividad.data ?? [], alertas: alertas.data ?? [], proyectos: proyectos.data ?? [],
  };
}

async function introIA(sb: SB, userId: string, tipo: string, cifras: Record<string, unknown>, detalle: string) {
  for (const slug of ["abacus", "groq", "anthropic", "google"]) {
    const { data: p } = await sb.from("proveedores_ia").select("id, clave_cifrada").eq("user_id", userId).eq("clave_slug", slug).maybeSingle();
    if (!p?.clave_cifrada) continue;
    const { data: clave } = await sb.rpc("descifrar_clave_proveedor", { p_proveedor_id: p.id });
    if (!clave) continue;
    const sistema = "Eres el asistente de Javier (Soluciones EvoluteIA). Escribes en español de España, directo, sin adornos, en segunda persona. Máximo 5 frases.";
    const pregunta = `Redacta el párrafo de apertura del ${tipo === "diario" ? "resumen de esta mañana" : "informe semanal de la cartera"} a partir de estas cifras y detalles. Empieza por lo más urgente. No inventes nada.\nCifras: ${JSON.stringify(cifras)}\nDetalle:\n${detalle.slice(0, 5000)}`;
    try {
      if (slug === "anthropic") {
        const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": String(clave), "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: "claude-3-5-haiku-latest", max_tokens: 400, system: sistema, messages: [{ role: "user", content: pregunta }] }) });
        if (r.ok) { const j = await r.json(); return { texto: (j.content ?? []).map((c: any) => c.text ?? "").join("").trim(), por: slug }; }
      } else if (slug === "google") {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${clave}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: "user", parts: [{ text: pregunta }] }] }) });
        if (r.ok) { const j = await r.json(); return { texto: (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("").trim(), por: slug }; }
      } else if (slug === "abacus") {
        const r = await fetch("https://routellm.abacus.ai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${clave}`, "content-type": "application/json" }, body: JSON.stringify({ model: "route-llm", temperature: 0.3, messages: [{ role: "system", content: sistema }, { role: "user", content: pregunta }] }) });
        if (r.ok) { const j = await r.json(); return { texto: (j.choices?.[0]?.message?.content ?? "").trim(), por: slug }; }
      } else {
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${clave}`, "content-type": "application/json" }, body: JSON.stringify({ model: "llama-3.3-70b-versatile", temperature: 0.3, messages: [{ role: "system", content: sistema }, { role: "user", content: pregunta }] }) });
        if (r.ok) { const j = await r.json(); return { texto: (j.choices?.[0]?.message?.content ?? "").trim(), por: slug }; }
      }
    } catch (_) { /* siguiente */ }
  }
  return null;
}

function redactar(tipo: "diario" | "semanal", fecha: Date, desde: Date, hasta: Date, D: Awaited<ReturnType<typeof recopilar>>, inc: Record<string, boolean>, intro: string | null) {
  const md: string[] = []; const secciones: { titulo: string; html: string; n: number; tono: string }[] = [];
  const titulo = tipo === "diario" ? `Resumen del ${fechaEs(fecha)}` : `Informe semanal de la cartera · ${desde.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${hasta.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`;
  const cifras = { requieren_atencion: D.atencion.length, desatendidas_en_curso: D.desatendidas.length, completadas: D.completadas.length, compilaciones: D.compilaciones.length, hallazgos_vigilancia: D.vigilancia.length, dominios_con_aviso: D.dominios.length, copias: D.copias.length, copias_error: D.copias.filter((c) => c.estado === "error").length, bandeja_pendiente: D.bandeja.length, proyectos_calidad_rojo: D.calidadRojo.length, coste_ia_eur: Number(D.consumo.coste.toFixed(2)), llamadas_ia: D.consumo.llamadas, alertas_abiertas: D.alertas.length };
  md.push(`# ${titulo}`, "");
  if (intro) md.push(intro, "");
  const bloque = (t: string, lineas: string[], tono = "neutro") => { if (!lineas.length) return; md.push(`## ${t}`, "", ...lineas, ""); secciones.push({ titulo: t, n: lineas.length, tono, html: `<ul>${lineas.map((l) => `<li>${esc(l.replace(/^- /, ""))}</li>`).join("")}</ul>` }); };
  if (inc.atencion !== false) bloque("Requiere tu atención", D.atencion.map((t) => `- [${t.prioridad}] ${D.np(t.proyecto_id)} · ${t.titulo}${t.motivo_atencion ? ` — ${t.motivo_atencion}` : ""}`), D.atencion.length ? "rojo" : "verde");
  if (inc.dominios !== false) bloque("Dominios y certificados", D.dominios.map((x) => `- ${x.dominio}: ${x.resultado === "error" ? `ERROR (${x.error ?? ""})` : `aviso — certificado ${x.cert_dias ?? "—"} días, dominio ${x.dominio_dias ?? "—"} días`}`), D.dominios.some((x) => x.resultado === "error") ? "rojo" : "ambar");
  if (inc.compilaciones !== false) bloque("Compilaciones", D.compilaciones.map((c) => `- ${D.np(c.proyecto_id)} · ${c.plataforma} v${c.version}: ${c.estado}${c.error ? ` (${c.error.slice(0, 80)})` : ""}`), D.compilaciones.some((c) => c.estado === "error") ? "rojo" : "verde");
  if (inc.copias !== false && D.copias.length) { const ok = D.copias.filter((c) => c.estado === "ok").length; const err = D.copias.filter((c) => c.estado === "error"); bloque("Copias de seguridad", [`- ${ok} correctas de ${D.copias.length}`, ...err.map((c) => `- ERROR ${c.tipo} ${c.nombre}: ${(c.error ?? "").slice(0, 80)}`)], err.length ? "rojo" : "verde"); }
  if (inc.vigilancia !== false) bloque("Vigilancia (hallazgos nuevos)", D.vigilancia.map((h) => `- [${h.relevancia}] ${D.np(h.proyecto_id)} · ${h.titulo}${h.por_que_afecta ? ` — ${h.por_que_afecta.slice(0, 120)}` : ""}`), D.vigilancia.some((h) => h.relevancia === "alta") ? "ambar" : "neutro");
  if (inc.bandeja !== false) bloque("Bandeja pendiente", D.bandeja.map((b) => `- ${b.origen} · ${b.remitente_nombre ?? ""}: ${b.asunto ?? "(sin asunto)"} → ${D.np(b.proyecto_id)}`), D.bandeja.length ? "ambar" : "verde");
  if (inc.calidad !== false) bloque("Calidad en rojo", D.calidadRojo.map((p) => `- ${p.nombre}`), D.calidadRojo.length ? "rojo" : "verde");
  if (inc.desatendidas !== false) { const porEstado = D.desatendidas.reduce((a: Record<string, number>, t) => { a[t.estado] = (a[t.estado] ?? 0) + 1; return a; }, {}); bloque("Trabajo desatendido en curso", Object.entries(porEstado).map(([e, n]) => `- ${n} tarea(s) ${e}`), "neutro"); }
  if (D.completadas.length) bloque("Completado en el periodo", D.completadas.slice(0, 20).map((t) => `- ${D.np(t.proyecto_id)} · ${t.titulo}`), "verde");
  if (inc.consumo_ia !== false) bloque("Consumo de IA", [`- ${D.consumo.llamadas} llamadas · ${D.consumo.tokens.toLocaleString("es-ES")} tokens · ${eur(D.consumo.coste)}`], "neutro");
  if (inc.actividad !== false && tipo === "semanal") bloque("Actividad destacada", D.actividad.slice(0, 25).map((a) => `- ${new Date(a.fecha).toLocaleDateString("es-ES")} · ${D.np(a.proyecto_id)} · ${a.texto.slice(0, 120)}`), "neutro");
  if (D.alertas.length) bloque("Alertas abiertas", D.alertas.map((a) => `- [${a.nivel}] ${D.np(a.proyecto_id)} · ${a.texto.slice(0, 120)}`), "rojo");
  if (tipo === "semanal") bloque("Cartera", D.proyectos.map((p) => `- ${p.nombre}: ${p.estado}${p.semaforo_calidad ? ` · calidad ${p.semaforo_calidad}` : ""}`), "neutro");
  md.push("---", "", "Generado por NexDeveloper · Soluciones EvoluteIA S.L.");
  const color = (t: string) => ({ rojo: "#dc2626", ambar: "#d97706", verde: "#059669", neutro: "#0f766e" }[t] ?? "#0f766e");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
  body{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1b2430;margin:0;padding:24px;background:#f6f9fb}
  .doc{max-width:820px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)}
  .portada{background:linear-gradient(135deg,#0f2a3a,#12706f);color:#fff;padding:28px 32px}
  .portada .emb{display:inline-block;width:40px;height:40px;border-radius:10px;background:#22d3c5;color:#0f2a3a;font-weight:800;font-size:20px;text-align:center;line-height:40px;margin-bottom:10px}
  .portada h1{margin:0 0 4px;font-size:22px}.portada .sub{opacity:.9;font-size:13px}
  .cifras{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:18px 32px 0}
  .cifra{border:1px solid #d9e2ea;border-radius:10px;padding:10px 12px;background:#f6f9fb}.cifra b{display:block;font-size:20px;color:#12706f}.cifra span{font-size:10px;color:#5b6b7a;text-transform:uppercase;letter-spacing:.5px}
  .intro{padding:18px 32px 0;font-size:14px;line-height:1.55}
  .sec{padding:14px 32px}.sec h2{font-size:15px;margin:0 0 8px;padding-left:10px;border-left:4px solid var(--c)}
  .sec ul{margin:0;padding-left:20px;font-size:13px;line-height:1.5}.sec li{margin:3px 0}
  .pie{padding:16px 32px 24px;font-size:11px;color:#7a8794;border-top:1px solid #e6edf3;margin-top:8px}
  @media print{body{background:#fff;padding:0}.doc{box-shadow:none;border-radius:0}}
  </style></head><body><div class="doc">
  <div class="portada"><div class="emb">N</div><h1>${esc(titulo)}</h1><div class="sub">NexDeveloper · Soluciones EvoluteIA S.L. · ${esc(fechaEs(fecha))}</div></div>
  <div class="cifras"><div class="cifra"><b>${cifras.requieren_atencion}</b><span>Requieren tu atención</span></div><div class="cifra"><b>${cifras.dominios_con_aviso + cifras.copias_error + cifras.proyectos_calidad_rojo}</b><span>Avisos técnicos</span></div><div class="cifra"><b>${cifras.hallazgos_vigilancia + cifras.bandeja_pendiente}</b><span>Novedades y mensajes</span></div><div class="cifra"><b>${eur(cifras.coste_ia_eur)}</b><span>Gasto de IA</span></div></div>
  ${intro ? `<div class="intro">${esc(intro).replace(/\n/g, "<br>")}</div>` : ""}
  ${secciones.map((s) => `<div class="sec" style="--c:${color(s.tono)}"><h2>${esc(s.titulo)} <small style="color:#7a8794;font-weight:400">(${s.n})</small></h2>${s.html}</div>`).join("")}
  <div class="pie">Generado automáticamente por NexDeveloper · ${esc(new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" }))}</div></div></body></html>`;
  return { titulo, md: md.join("\n"), html, cifras };
}

async function enviarCorreo(sb: SB, userId: string, destino: string, asunto: string, html: string, texto: string) {
  const { data: f } = await sb.from("bandeja_fuentes").select("*").eq("user_id", userId).eq("origen", "gmail").maybeSingle();
  if (f?.secreto_cifrado && G_ID && G_SECRET) {
    const { data: refresh } = await sb.rpc("leer_secreto_bandeja", { p_fuente_id: f.id });
    const t = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: G_ID, client_secret: G_SECRET, refresh_token: String(refresh), grant_type: "refresh_token" }) });
    if (t.ok) {
      const token = (await t.json()).access_token;
      const raw = [`To: ${destino}`, `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(asunto)))}?=`, "MIME-Version: 1.0", "Content-Type: text/html; charset=UTF-8", "", html].join("\r\n");
      const b64 = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ raw: b64 }) });
      if (r.ok) return "correo (Gmail)";
      const err = await r.text();
      if (!/insufficient|scope|403/i.test(err) || !RESEND) throw new Error(`Gmail no envía: ${err.slice(0, 160)} (reconecta Gmail para conceder permiso de envío)`);
    }
  }
  if (RESEND) {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND}`, "content-type": "application/json" }, body: JSON.stringify({ from: "NexDeveloper <nexdeveloper@evoluteia.com>", to: [destino], subject: asunto, html, text: texto }) });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 160)}`);
    return "correo (Resend)";
  }
  throw new Error("No hay forma de enviar correo: conecta Gmail en Bandeja → Fuentes (con permiso de envío) o pon RESEND_API_KEY en los secretos.");
}
async function enviarWhatsapp(sb: SB, userId: string, destino: string, texto: string) {
  const { data: f } = await sb.from("bandeja_fuentes").select("*").eq("user_id", userId).eq("origen", "whatsapp").maybeSingle();
  if (!f?.secreto_cifrado || !f.configuracion?.phone_number_id) throw new Error("WhatsApp Business no está configurado en Bandeja → Fuentes.");
  const { data: token } = await sb.rpc("leer_secreto_bandeja", { p_fuente_id: f.id });
  const r = await fetch(`https://graph.facebook.com/v20.0/${f.configuracion.phone_number_id}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: destino.replace(/\D/g, ""), type: "text", text: { body: texto.slice(0, 4000) } }) });
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${(await r.text()).slice(0, 200)} (fuera de la ventana de 24 h Meta exige una plantilla aprobada)`);
  return "whatsapp";
}
function textoWhatsapp(titulo: string, md: string) { return `*${titulo}*\n\n` + md.split("\n").filter((l) => !l.startsWith("# ") && l !== "---").map((l) => l.replace(/^## (.*)/, "*$1*").replace(/^- /, "• ")).join("\n").slice(0, 3800); }

async function generar(sb: SB, userId: string, tipo: "diario" | "semanal", fecha: Date, enviar: boolean, canalesForzados?: string[]) {
  const { data: cfg } = await sb.from("resumenes_config").select("*").eq("user_id", userId).maybeSingle();
  const hasta = new Date(fecha); hasta.setHours(23, 59, 59, 999);
  const desde = new Date(fecha); desde.setDate(desde.getDate() - (tipo === "diario" ? 1 : 7)); desde.setHours(0, 0, 0, 0);
  const D = await recopilar(sb, userId, desde, hasta);
  let intro: string | null = null; let por = "plantilla";
  const borrador = redactar(tipo, fecha, desde, hasta, D, cfg?.incluir ?? {}, null);
  if (cfg?.usar_ia !== false) { const r = await introIA(sb, userId, tipo, borrador.cifras, borrador.md); if (r?.texto) { intro = r.texto; por = r.por; } }
  const final = intro ? redactar(tipo, fecha, desde, hasta, D, cfg?.incluir ?? {}, intro) : borrador;
  const fechaStr = fecha.toISOString().slice(0, 10);
  const { data: fila, error } = await sb.from("resumenes").upsert({ user_id: userId, tipo, fecha: fechaStr, periodo_desde: desde.toISOString(), periodo_hasta: hasta.toISOString(), titulo: final.titulo, contenido_md: final.md, contenido_html: final.html, datos: final.cifras, redactado_por: por, creado_el: new Date().toISOString() }, { onConflict: "user_id,tipo,fecha" }).select("*").single();
  if (error) throw new Error(error.message);
  const enviados: string[] = []; const errores: string[] = [];
  if (enviar) {
    const canales = canalesForzados ?? (cfg?.canales ?? ["correo"]);
    for (const c of canales) {
      try {
        if (c === "correo") { if (!cfg?.correo_destino) throw new Error("Sin correo de destino"); enviados.push(await enviarCorreo(sb, userId, cfg.correo_destino, `[NexDeveloper] ${final.titulo}`, final.html, final.md)); }
        else if (c === "whatsapp") { if (!cfg?.whatsapp_destino) throw new Error("Sin número de WhatsApp"); enviados.push(await enviarWhatsapp(sb, userId, cfg.whatsapp_destino, textoWhatsapp(final.titulo, final.md))); }
      } catch (e) { errores.push(`${c}: ${String(e?.message ?? e)}`); }
    }
    await sb.from("resumenes").update({ enviado_por: enviados, enviado_el: enviados.length ? new Date().toISOString() : null, error_envio: errores.length ? errores.join(" · ") : null }).eq("id", fila.id);
  }
  return { id: fila.id, titulo: final.titulo, cifras: final.cifras, redactado_por: por, enviados, errores };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = servicio();
    const cuerpo = await req.json().catch(() => ({}));
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
      let correo = "ninguno";
      if (userId) { const { data: f } = await sb.from("bandeja_fuentes").select("secreto_cifrado").eq("user_id", userId).eq("origen", "gmail").maybeSingle(); if (f?.secreto_cifrado && G_ID) correo = "gmail"; else if (RESEND) correo = "resend"; }
      return json({ ok: true, listo: true, canal_correo: correo, resend: !!RESEND });
    }
    const tipo = cuerpo.tipo === "semanal" ? "semanal" : "diario";
    if (accion === "programado") {
      if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
      const { data: cfgs } = await sb.from("resumenes_config").select("user_id, diario_activo, semanal_activo");
      const res: unknown[] = [];
      for (const c of cfgs ?? []) { if ((tipo === "diario" && !c.diario_activo) || (tipo === "semanal" && !c.semanal_activo)) continue; try { res.push(await generar(sb, c.user_id, tipo, new Date(), true)); } catch (e) { res.push({ user_id: c.user_id, error: String(e?.message ?? e) }); } }
      return json({ ok: true, resultados: res });
    }
    if (accion === "generar") { const fecha = cuerpo.fecha ? new Date(cuerpo.fecha) : new Date(); return json({ ok: true, ...(await generar(sb, userId!, tipo, fecha, !!cuerpo.enviar, cuerpo.canales)) }); }
    if (accion === "enviar") {
      const { data: r } = await sb.from("resumenes").select("*").eq("id", String(cuerpo.resumen_id)).eq("user_id", userId!).maybeSingle();
      if (!r) return json({ ok: false, error: "Resumen no encontrado" }, 404);
      const { data: cfg } = await sb.from("resumenes_config").select("*").eq("user_id", userId!).maybeSingle();
      const canales: string[] = cuerpo.canales ?? cfg?.canales ?? ["correo"];
      const enviados: string[] = []; const errores: string[] = [];
      for (const c of canales) { try { if (c === "correo") enviados.push(await enviarCorreo(sb, userId!, cuerpo.correo ?? cfg?.correo_destino, `[NexDeveloper] ${r.titulo}`, r.contenido_html, r.contenido_md)); else if (c === "whatsapp") enviados.push(await enviarWhatsapp(sb, userId!, cuerpo.whatsapp ?? cfg?.whatsapp_destino, textoWhatsapp(r.titulo, r.contenido_md))); } catch (e) { errores.push(`${c}: ${String(e?.message ?? e)}`); } }
      await sb.from("resumenes").update({ enviado_por: [...new Set([...(r.enviado_por ?? []), ...enviados])], enviado_el: enviados.length ? new Date().toISOString() : r.enviado_el, error_envio: errores.length ? errores.join(" · ") : null }).eq("id", r.id);
      return json({ ok: errores.length === 0, enviados, errores });
    }
    return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
  } catch (e) { return json({ ok: false, error: String(e?.message ?? e) }, 500); }
});
