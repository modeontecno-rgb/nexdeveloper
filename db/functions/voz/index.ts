import {fetchIADeUsuario} from '../_shared/presupuesto.ts';
// NexDeveloper · Edge Function «voz» (0.18.0)
// Voz ElevenLabs para vídeos demo: guion por escenas (IA) a partir del proyecto y sus pantallas, locución con ElevenLabs guardada en el almacén propio.
// Acciones: voces · generar_guion {proyecto_id, duracion_objetivo_seg?, publico?} · locutar {guion_id?, escena?, texto?, titulo?, proyecto_id?, voz_id?} · enlace {locucion_id} · sin acción → estado
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const limpiar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// ---------- S3 ----------
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
  const r = await fetch(`${u.protocol}//${host}${ruta}`, { method: "PUT", headers, body: new Uint8Array(cuerpo).buffer });
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
async function destino(sb: SB, userId: string): Promise<Destino | null> {
  const { data: lista } = await sb.from("copias_destinos").select("id").eq("user_id", userId).eq("activo", true).order("usar_para_documentos", { ascending: false }).order("es_predeterminado", { ascending: false }).limit(1);
  if (!lista?.[0]) return null;
  const { data } = await sb.rpc("leer_destino_copias", { p_destino_id: lista[0].id });
  const f = Array.isArray(data) ? data[0] : data; if (!f?.secreto) return null;
  return { endpoint: f.url_servidor.replace(/\/+$/, ""), region: f.region || "eu-central-1", bucket: "proyectian", access: f.usuario, secret: f.secreto };
}

// ---------- Proveedores ----------
async function clave(sb: SB, userId: string, slug: string) {
  const { data: p } = await sb.from("proveedores_ia").select("id, clave_cifrada").eq("user_id", userId).eq("clave_slug", slug).maybeSingle();
  if (!p?.clave_cifrada) return null;
  const { data } = await sb.rpc("descifrar_clave_proveedor", { p_proveedor_id: p.id });
  return data ? String(data) : null;
}
async function redactar(sb: SB, userId: string, sistema: string, pregunta: string, proyectoId:string|null=null) {
  for (const slug of ["anthropic", "groq", "google"]) {
    const k = await clave(sb, userId, slug); if (!k) continue;
    try {
      if (slug === "anthropic") { const r = await fetchIADeUsuario(sb,userId,proyectoId,'voz-guion',"https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": k, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 3000, system: sistema, messages: [{ role: "user", content: pregunta }] }) }); if (r.ok) { const j = await r.json(); return { texto: (j.content ?? []).map((c: any) => c.text ?? "").join(""), por: slug }; } }
      else if (slug === "google") { const r = await fetchIADeUsuario(sb,userId,proyectoId,'voz-guion',`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: "user", parts: [{ text: pregunta }] }], generationConfig: { responseMimeType: "application/json" } }) }); if (r.ok) { const j = await r.json(); return { texto: (j.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text ?? "").join(""), por: slug }; } }
      else { const r = await fetchIADeUsuario(sb,userId,proyectoId,'voz-guion',"https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${k}`, "content-type": "application/json" }, body: JSON.stringify({ model: "llama-3.3-70b-versatile", temperature: 0.4, response_format: { type: "json_object" }, messages: [{ role: "system", content: sistema }, { role: "user", content: pregunta }] }) }); if (r.ok) { const j = await r.json(); return { texto: j.choices?.[0]?.message?.content ?? "", por: slug }; } }
    } catch (error) { throw error; }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = servicio();
    const cuerpo = await req.json().catch(() => ({}));
    const accion = String(cuerpo.accion ?? "");
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = jwt ? await sb.auth.getUser(jwt) : { data: { user: null } };
    const tokenCron = req.headers.get("x-cron-token") ?? "";
    let userId = user?.id ?? null;
    if (!userId && tokenCron) { const { data } = await sb.rpc("comprobar_cron_token", { p_token: tokenCron }); if (data === true && typeof cuerpo.user_id === "string") { userId = cuerpo.user_id; } }
    if (!userId) return json({ ok: false, error: "Sin sesión" }, 401);
    const kEleven = await clave(sb, userId, "elevenlabs");
    if (!accion) { const d = await destino(sb, userId); return json({ ok: true, listo: true, locucion_disponible: false, elevenlabs: !!kEleven, almacen: !!d }); }
    const { data: cfg } = await sb.from("voz_config").select("*").eq("user_id", userId).maybeSingle();

    if (accion === "voces") {
      if (!kEleven) return json({ ok: false, error: "Pon la clave de ElevenLabs en Ajustes → Proveedores de IA." });
      const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": kEleven } });
      if (!r.ok) return json({ ok: false, error: `ElevenLabs ${r.status}: ${(await r.text()).slice(0, 160)}` });
      const j = await r.json();
      const voces = (j.voices ?? []).map((v: any) => ({ id: v.voice_id, nombre: v.name, categoria: v.category, idioma: v.labels?.language ?? v.fine_tuning?.language ?? null, genero: v.labels?.gender ?? null, acento: v.labels?.accent ?? null, descripcion: v.labels?.description ?? null, muestra_url: v.preview_url ?? null }));
      let suscripcion: unknown = null; try { const s = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": kEleven } }); if (s.ok) { const u = await s.json(); suscripcion = { plan: u.tier, caracteres_usados: u.character_count, caracteres_limite: u.character_limit, renueva: u.next_character_count_reset_unix ? new Date(u.next_character_count_reset_unix * 1000).toISOString() : null }; } } catch { /* nada */ }
      return json({ ok: true, voces, suscripcion });
    }
    if (accion === "generar_guion") {
      const { data: p } = await sb.from("proyectos").select("*").eq("id", String(cuerpo.proyecto_id)).eq("user_id", userId).maybeSingle();
      if (!p) return json({ ok: false, error: "Proyecto no encontrado" }, 404);
      const { data: previews } = await sb.from("previews").select("titulo, url").eq("proyecto_id", p.id).limit(10);
      const dur = Number(cuerpo.duracion_objetivo_seg ?? 120); const publico = String(cuerpo.publico ?? "cliente potencial");
      const pantallas = (previews ?? []).map((v) => `- ${v.titulo}: ${v.url}`).join("\n") || "(sin URLs registradas; usa las pantallas típicas de la aplicación)";
      const sistema = "Eres guionista de vídeos de demostración de software para Soluciones EvoluteIA S.L. Escribes en español de España, natural, para ser leído en voz alta por una locutora. Nada de tecnicismos ni de nombres de proveedores de IA. Devuelves SOLO JSON.";
      const pregunta = `Proyecto: «${p.nombre}». ${p.descripcion ?? ""}\nPúblico: ${publico}. Duración objetivo: ${dur} segundos (unas ${Math.round(dur * 2.3)} palabras).\nPantallas disponibles:\n${pantallas}\n${cuerpo.notas ? `Notas de Javier: ${cuerpo.notas}\n` : ""}\nEscribe un guion por escenas para un vídeo demo: apertura con el problema que resuelve, 4-7 escenas con lo que se ve en pantalla y lo que se dice, y cierre con llamada a la acción (contacto por WhatsApp). Formato: {"titulo":"…","escenas":[{"orden":1,"titulo":"…","texto":"lo que dice la voz (2-5 frases)","url_pantalla":"URL de la pantalla que se muestra o null","duracion_seg":15}]}`;
      const r = await redactar(sb, userId, sistema, pregunta, p.id);
      let guion: any = null;
      if (r) { const m = r.texto.match(/\{[\s\S]*\}/); if (m) { try { guion = JSON.parse(m[0]); } catch { /* nada */ } } }
      if (!guion) guion = { titulo: `Demo de ${p.nombre}`, escenas: [{ orden: 1, titulo: "Presentación", texto: `${p.nombre}: ${p.descripcion ?? "la solución de Soluciones EvoluteIA"}.`, url_pantalla: p.espacio_trabajo_url ?? null, duracion_seg: 20 }, { orden: 2, titulo: "Cierre", texto: "Si quieres verlo con tus datos, escríbenos por WhatsApp y te lo enseñamos en una demo.", url_pantalla: null, duracion_seg: 10 }] };
      const base = cfg?.servicio_capturas ?? "https://image.thum.io/get/width/1280/crop/800/noanimate/";
      const escenas = (guion.escenas ?? []).map((e: any, i: number) => ({ orden: e.orden ?? i + 1, titulo: e.titulo ?? `Escena ${i + 1}`, texto: e.texto ?? "", url_pantalla: e.url_pantalla ?? null, captura_url: e.url_pantalla ? `${base}${e.url_pantalla}` : null, duracion_seg: Number(e.duracion_seg ?? 15) }));
      const { data: fila, error } = await sb.from("guiones_demo").insert({ user_id: userId, proyecto_id: p.id, titulo: guion.titulo ?? `Demo de ${p.nombre}`, publico, duracion_objetivo_seg: dur, escenas, generado_por: r?.por ?? "plantilla" }).select("*").single();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, guion: fila });
    }
    if (accion === "locutar") {
      return json({ok:false,error:'Locución de pago desactivada: falta un contador verificado por caracteres. Guiones y audios existentes siguen disponibles.'},409);
    }
    if (accion === "enlace") {
      const { data: l } = await sb.from("locuciones").select("*").eq("id", String(cuerpo.locucion_id)).eq("user_id", userId).maybeSingle();
      if (!l?.ruta_remota) return json({ ok: false, error: "Locución sin archivo" }, 404);
      const d = await destino(sb, userId); if (!d) return json({ ok: false, error: "Sin destino de almacén" });
      return json({ ok: true, url: await presignar(d, l.ruta_remota, l.ruta_remota.split("/").pop()!, 3600, !cuerpo.descargar) });
    }
    return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
  } catch (e) { return json({ ok: false, error: String(e?.message ?? e) }, 500); }
});
