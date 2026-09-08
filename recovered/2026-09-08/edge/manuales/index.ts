// NexDeveloper · Edge Function «manuales» (0.35.0)
// Generador de manuales de usuario: recorre las pantallas del proyecto (rutas del repositorio en GitHub), captura cada una,
// redacta el manual con IA por capítulos (público: usuario, administrador o comercial), pasa el REVISOR DE REDACCIÓN
// (ortografía, gramática, tono usted/tú, frases cortas, nombres de producto y perfil de estilo propio), lo compone en HTML
// imprimible y Markdown, lo guarda en el almacén propio (proyectos/<slug>/03-MANUALES) y lo registra en Proyectian.
// Barrido semanal: regenera el manual cuando cambia la versión del proyecto. Trabajo por tandas reanudable.
// 0.35.0: estado «revisando» entre «redactando» y «publicando»; acción «revisar» para repasar un manual ya publicado.
// 0.36.0: el selector de proveedor prueba primero Abacus (RouteLLM), incluido sin coste extra en la suscripción, antes que Anthropic.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_CUENTA = Deno.env.get("CUENTA_SUPABASE_TOKEN") ?? "";
const TOKEN_GITHUB = Deno.env.get("GITHUB_TOKEN") ?? "";
const REF_PROYECTIAN = "hjtweberlereyfhagkvx";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const ahora = () => new Date().toISOString();
const INICIO = Date.now();
const PRESUPUESTO_MS = 95_000;
const sqlLit = (s: unknown) => s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`;
const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- Proyectian, S3 ----------
async function proyectianSql(sql: string, readOnly = false) {
  if (!TOKEN_CUENTA) throw new Error("Falta CUENTA_SUPABASE_TOKEN");
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF_PROYECTIAN}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN_CUENTA}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql, read_only: readOnly }) });
  if (!r.ok) throw new Error(`Proyectian ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return await r.json();
}
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string | Uint8Array) => hex(await crypto.subtle.digest("SHA-256", typeof s === "string" ? enc.encode(s) : s));
async function hmac(key: ArrayBuffer | Uint8Array, msg: string) { const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return crypto.subtle.sign("HMAC", k, enc.encode(msg)); }
const codificar = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const codClave = (k: string) => k.split("/").map(codificar).join("/");
const fechaAmz = () => { const iso = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); return { larga: iso, corta: iso.slice(0, 8) }; };
type Destino = { endpoint: string; region: string; bucket: string; prefijo: string; access: string; secret: string; id: string };
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
async function presignar(d: Destino, clave: string, nombre: string, seg = 3600, inline = false) {
  const u = new URL(d.endpoint); const host = u.host; const { larga, corta } = fechaAmz(); const path = `/${d.bucket}/${codClave(clave)}`;
  const q: Record<string, string> = { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${d.access}/${corta}/${d.region}/s3/aws4_request`, "X-Amz-Date": larga, "X-Amz-Expires": String(seg), "X-Amz-SignedHeaders": "host", "response-content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(nombre)}` };
  const cq = Object.keys(q).sort().map((k) => `${codificar(k)}=${codificar(q[k])}`).join("&");
  const canon = ["GET", path, cq, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const aFirmar = ["AWS4-HMAC-SHA256", larga, `${corta}/${d.region}/s3/aws4_request`, await sha256(canon)].join("\n");
  return `${u.protocol}//${host}${path}?${cq}&X-Amz-Signature=${hex(await hmac(await claveFirma(d, corta), aFirmar))}`;
}
async function destinoDocumentos(sb: SB, userId: string): Promise<Destino | null> {
  const { data: lista } = await sb.from("copias_destinos").select("id, usar_para_documentos, es_predeterminado").eq("user_id", userId).eq("activo", true).order("usar_para_documentos", { ascending: false }).order("es_predeterminado", { ascending: false }).limit(1);
  const dest = lista?.[0]; if (!dest) return null;
  const { data } = await sb.rpc("leer_destino_copias", { p_destino_id: dest.id });
  const f = Array.isArray(data) ? data[0] : data; if (!f?.secreto) return null;
  return { id: dest.id, endpoint: f.url_servidor.replace(/\/+$/, ""), region: f.region || "eu-central-1", bucket: "proyectian", prefijo: "", access: f.usuario, secret: f.secreto };
}

// ---------- GitHub: pantallas del proyecto ----------
async function gh(ruta: string) {
  const r = await fetch(`https://api.github.com${ruta}`, { headers: { Authorization: `Bearer ${TOKEN_GITHUB}`, Accept: "application/vnd.github+json", "User-Agent": "NexDeveloper" } });
  if (!r.ok) throw new Error(`GitHub ${r.status} ${ruta}`); return await r.json();
}
function rutaDesdeArchivo(f: string) {
  let p = f.replace(/^src\/(routes|pages)\//, "").replace(/\.(tsx|jsx|ts)$/, "").replace(/\/index$/, "").replace(/^index$/, "");
  if (/^__/.test(p) || p.includes("/_")) return null;
  p = p.split("/").map((seg) => seg.startsWith("$") ? `:${seg.slice(1)}` : seg.replace(/^_/, "")).filter(Boolean).join("/");
  return "/" + p.replace(/^[A-Z]/, (c) => c.toLowerCase());
}
async function pantallasDelRepo(repo: string, max: number) {
  const info = await gh(`/repos/${repo}`); const rama = info.default_branch ?? "main";
  const arbol = await gh(`/repos/${repo}/git/trees/${rama}?recursive=1`);
  const archivos: string[] = (arbol.tree ?? []).filter((n: any) => n.type === "blob" && /^src\/(routes|pages)\/.*\.(tsx|jsx)$/.test(n.path) && !/\.(test|spec)\./.test(n.path) && !/__root|\/_layout|\/-|\/components\//.test(n.path)).map((n: any) => n.path);
  const pantallas: { archivo: string; ruta: string; extracto: string }[] = [];
  for (const f of archivos.slice(0, max)) {
    const ruta = rutaDesdeArchivo(f); if (!ruta || /\/api\//.test(ruta)) continue;
    let extracto = "";
    try { const c = await gh(`/repos/${repo}/contents/${f.split("/").map(encodeURIComponent).join("/")}?ref=${rama}`); const t = new TextDecoder().decode(Uint8Array.from(atob(String(c.content ?? "").replace(/\n/g, "")), (x) => x.charCodeAt(0)));
      const textos = [...t.matchAll(/>([^<>{}]{3,120})</g)].map((m) => m[1].trim()).filter((s) => /[a-záéíóúñ]/i.test(s));
      const cadenas = [...t.matchAll(/(?:title|label|placeholder|descripcion|description|titulo)\s*[:=]\s*["'`]([^"'`]{3,120})["'`]/gi)].map((m) => m[1]);
      extracto = [...new Set([...textos, ...cadenas])].slice(0, 80).join(" | ").slice(0, 2500);
    } catch { /* sin extracto */ }
    pantallas.push({ archivo: f, ruta, extracto });
  }
  return pantallas;
}

// ---------- IA ----------
async function proveedor(sb: SB, userId: string) {
  for (const slug of ["abacus", "anthropic", "google", "groq", "openai"]) {
    const { data: prov } = await sb.from("proveedores_ia").select("id, clave_cifrada").eq("user_id", userId).eq("clave_slug", slug).maybeSingle();
    if (!prov?.clave_cifrada) continue;
    const { data: clave } = await sb.rpc("descifrar_clave_proveedor", { p_proveedor_id: prov.id }); if (!clave) continue;
    const { data: m } = await sb.from("modelos_ia").select("id, identificador, coste_entrada, coste_salida").eq("proveedor_id", prov.id).eq("activo", true).order("calidad", { ascending: false }).limit(3);
    const modelo = (m ?? []).find((x) => !/image|tts|whisper|embed/i.test(x.identificador)) ?? null;
    return { slug, clave: String(clave), modelo: modelo?.identificador ?? (slug === "abacus" ? "route-llm" : slug === "anthropic" ? "claude-sonnet-4-5" : slug === "google" ? "gemini-2.5-flash" : slug === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini"), modelo_id: modelo?.id ?? null, ce: Number(modelo?.coste_entrada ?? 3), cs: Number(modelo?.coste_salida ?? 15) };
  }
  return null;
}
async function preguntar(p: any, sistema: string, pregunta: string, maxTokens = 3000, jsonMode = false) {
  if (p.slug === "anthropic") { const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": p.clave, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: p.modelo, max_tokens: maxTokens, system: sistema, messages: [{ role: "user", content: pregunta }] }) }); const j = await r.json(); if (!r.ok) throw new Error(`Anthropic ${r.status}: ${String(j?.error?.message ?? "").slice(0, 160)}`); return { texto: (j.content ?? []).map((c: any) => c.text ?? "").join(""), te: j.usage?.input_tokens ?? 0, ts: j.usage?.output_tokens ?? 0 }; }
  if (p.slug === "google") { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${p.modelo}:generateContent?key=${p.clave}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: "user", parts: [{ text: pregunta }] }], generationConfig: { maxOutputTokens: maxTokens, ...(jsonMode ? { responseMimeType: "application/json" } : {}) } }) }); const j = await r.json(); if (!r.ok) throw new Error(`Google ${r.status}`); return { texto: (j.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text ?? "").join(""), te: j.usageMetadata?.promptTokenCount ?? 0, ts: j.usageMetadata?.candidatesTokenCount ?? 0 }; }
  const base = p.slug === "groq" ? "https://api.groq.com/openai/v1" : p.slug === "abacus" ? "https://routellm.abacus.ai/v1" : "https://api.openai.com/v1";
  const r = await fetch(`${base}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${p.clave}`, "content-type": "application/json" }, body: JSON.stringify({ model: p.modelo, max_tokens: maxTokens, temperature: 0.3, ...(jsonMode ? { response_format: { type: "json_object" } } : {}), messages: [{ role: "system", content: sistema }, { role: "user", content: pregunta }] }) });
  const j = await r.json(); if (!r.ok) throw new Error(`${p.slug} ${r.status}`); return { texto: j.choices?.[0]?.message?.content ?? "", te: j.usage?.prompt_tokens ?? 0, ts: j.usage?.completion_tokens ?? 0 };
}
const extraerJson = (t: string) => { const m = t.match(/```json\s*([\s\S]*?)```/) ?? t.match(/(\{[\s\S]*\})/); if (!m) return null; try { return JSON.parse(m[1]); } catch { return null; } };
const PUBLICOS: Record<string, string> = { usuario: "el usuario final que usa la aplicación cada día (no técnico)", administrador: "el administrador o responsable que configura la aplicación y gestiona usuarios", comercial: "un cliente potencial o distribuidor: destaca beneficios y casos de uso, sin detalles técnicos" };

// ---------- Revisor de redacción (0.35.0) ----------
const GLOSARIO_BASE = ["NexDeveloper", "Proyectian", "EvoluteIA", "Modeontecno", "Soluciones EvoluteIA", "Supabase", "Lovable", "GitHub", "WhatsApp", "PDF", "Markdown"];
const NIVELES: Record<string, string> = {
  ligera: "Corrige SOLO errores objetivos: ortografía, tildes, concordancia, puntuación y mayúsculas. No cambies el estilo ni reordenes frases.",
  normal: "Corrige errores de ortografía, tildes, concordancia y puntuación; mejora la claridad de las frases confusas; unifica el tratamiento al lector. Mantén el contenido y la estructura.",
  exhaustiva: "Corrige todos los errores; divide las frases largas (más de 25 palabras); elimina repeticiones y muletillas; unifica el tratamiento y el tono en todo el texto; sustituye tecnicismos innecesarios por palabras llanas. Mantén el contenido, la estructura y los pasos.",
};
async function perfilEstilo(sb: SB, userId: string) {
  const { data } = await sb.from("personal_config").select("perfil_estilo").eq("user_id", userId).maybeSingle();
  return String(data?.perfil_estilo ?? "").trim().slice(0, 1500);
}
function sistemaRevisor(cfg: any, glosario: string[], perfil: string) {
  const trato = cfg.tratamiento === "tu" ? "tú (tuteo, cercano pero correcto)" : "usted (formal y respetuoso, sin resultar frío)";
  return [
    "Eres el revisor de redacción de manuales en español de España. Recibes el texto de un capítulo en Markdown y devuelves el mismo capítulo revisado.",
    NIVELES[cfg.nivel_revision] ?? NIVELES.normal,
    `Tratamiento al lector: ${trato}. Todo el texto debe usar el mismo tratamiento.`,
    `Respeta exactamente, sin traducir ni cambiar mayúsculas, estos nombres: ${glosario.join(", ")}.`,
    "Conserva los encabezados Markdown (###), las listas numeradas, las viñetas, la negrita y el código entre comillas invertidas. No añadas contenido nuevo ni quites pasos. No pongas ningún título nuevo al principio.",
    "Nunca menciones que el texto lo ha escrito o revisado una IA.",
    perfil ? `Guía de estilo del autor (aplícala en la medida en que no contradiga lo anterior):\n${perfil}` : "",
    'Devuelve SOLO JSON con esta forma: {"texto_md":"capítulo revisado completo en Markdown","correcciones":número de cambios realizados,"ejemplos":["antes → después", … máximo 3 ejemplos cortos y representativos]}',
  ].filter(Boolean).join("\n");
}
async function revisarTexto(prov: any, sistema: string, texto: string) {
  const r = await preguntar(prov, sistema, `Texto a revisar:\n\n${texto}`, Math.min(4000, Math.max(1200, Math.ceil(texto.length / 2))), true);
  const j = extraerJson(r.texto);
  const revisado = typeof j?.texto_md === "string" && j.texto_md.trim().length > texto.length * 0.5 ? j.texto_md.trim() : null;
  return { texto: revisado ?? texto, correcciones: revisado ? Math.max(0, Number(j?.correcciones ?? 0) || 0) : 0, ejemplos: revisado && Array.isArray(j?.ejemplos) ? j.ejemplos.filter((e: unknown) => typeof e === "string").slice(0, 3) : [], aplicado: !!revisado, te: r.te, ts: r.ts };
}

// ---------- Composición ----------
function mdAHtml(md: string) {
  const lineas = md.split("\n"); const out: string[] = []; let enLista: string | null = null;
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  const cerrar = () => { if (enLista) { out.push(`</${enLista}>`); enLista = null; } };
  for (const l of lineas) {
    const t = l.trim();
    if (!t) { cerrar(); continue; }
    const h = t.match(/^(#{1,4})\s+(.*)$/); if (h) { cerrar(); const n = Math.min(h[1].length + 1, 4); out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }
    const li = t.match(/^[-*]\s+(.*)$/); if (li) { if (enLista !== "ul") { cerrar(); out.push("<ul>"); enLista = "ul"; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    const ol = t.match(/^\d+[.)]\s+(.*)$/); if (ol) { if (enLista !== "ol") { cerrar(); out.push("<ol>"); enLista = "ol"; } out.push(`<li>${inline(ol[1])}</li>`); continue; }
    cerrar(); out.push(`<p>${inline(t)}</p>`);
  }
  cerrar(); return out.join("\n");
}
function componerHtml(m: any, p: any, marca: string) {
  const caps = (m.capitulos ?? []).filter((c: any) => c.texto_md);
  const fecha = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "Europe/Madrid" }).format(new Date());
  const indice = caps.map((c: any, i: number) => `<li><a href="#cap-${i + 1}">${esc(c.titulo)}</a></li>`).join("");
  const cuerpo = caps.map((c: any, i: number) => `<section class="cap" id="cap-${i + 1}"><h2><span class="num">${i + 1}</span> ${esc(c.titulo)}</h2>${c.captura_url && m.incluir_capturas !== false ? `<figure><img src="${esc(c.captura_url)}" alt="${esc(c.titulo)}" loading="lazy"><figcaption>Pantalla «${esc(c.titulo)}»${c.ruta ? ` · ${esc(c.ruta)}` : ""}</figcaption></figure>` : ""}${mdAHtml(c.texto_md)}</section>`).join("\n");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.titulo)}</title>
<style>
:root{--c:#0f766e;--c2:#134e4a;--g:#475569;--b:#e2e8f0}*{box-sizing:border-box}body{font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0;background:#fff;line-height:1.55}
.portada{background:linear-gradient(135deg,var(--c2),var(--c));color:#fff;padding:72px 56px;min-height:60vh;display:flex;flex-direction:column;justify-content:flex-end}.portada .k{opacity:.85;letter-spacing:.2em;text-transform:uppercase;font-size:12px}.portada h1{font-size:40px;margin:12px 0 6px}.portada .sub{font-size:18px;opacity:.9}.portada .meta{margin-top:28px;font-size:13px;opacity:.85}
main{max-width:860px;margin:0 auto;padding:40px 32px}h2{font-size:24px;color:var(--c2);border-bottom:2px solid var(--b);padding-bottom:8px;margin-top:48px}h2 .num{display:inline-block;background:var(--c);color:#fff;border-radius:8px;padding:2px 10px;font-size:16px;margin-right:8px}h3{color:var(--c);margin-top:24px}h4{margin-top:18px}
figure{margin:18px 0;border:1px solid var(--b);border-radius:12px;overflow:hidden;background:#f8fafc}figure img{display:block;width:100%}figcaption{font-size:12px;color:var(--g);padding:8px 12px}
.indice{background:#f1f5f9;border-radius:12px;padding:18px 24px}.indice ol{margin:8px 0 0 18px}.indice a{color:var(--c2);text-decoration:none}.intro{font-size:17px}
.nota{background:#ecfeff;border-left:4px solid var(--c);padding:10px 14px;border-radius:8px;margin:14px 0}code{background:#f1f5f9;padding:1px 5px;border-radius:4px}
footer{margin-top:60px;border-top:1px solid var(--b);padding:18px 0;font-size:12px;color:var(--g);display:flex;justify-content:space-between}
@media print{.portada{min-height:auto;page-break-after:always}.cap{page-break-before:always}main{padding:0}footer{position:fixed;bottom:0;width:100%}}
</style></head><body>
<div class="portada"><div class="k">Manual de ${esc(m.publico === "comercial" ? "presentación" : m.publico === "administrador" ? "administración" : "usuario")}</div><h1>${esc(m.titulo)}</h1><div class="sub">${esc(p.nombre)}${m.version_proyecto ? ` · versión ${esc(m.version_proyecto)}` : ""}</div><div class="meta">${esc(marca)} · ${fecha}</div></div>
<main>
<section class="intro">${mdAHtml(m.introduccion_md ?? "")}</section>
<nav class="indice"><strong>Índice</strong><ol>${indice}</ol></nav>
${cuerpo}
<footer><span>${esc(m.titulo)} · ${esc(p.nombre)}</span><span>${esc(marca)}</span></footer>
</main></body></html>`;
}
function componerMd(m: any, p: any) {
  const caps = (m.capitulos ?? []).filter((c: any) => c.texto_md);
  return `# ${m.titulo}\n\n${p.nombre}${m.version_proyecto ? ` · versión ${m.version_proyecto}` : ""}\n\n${m.introduccion_md ?? ""}\n\n## Índice\n${caps.map((c: any, i: number) => `${i + 1}. ${c.titulo}`).join("\n")}\n\n${caps.map((c: any, i: number) => `## ${i + 1}. ${c.titulo}\n\n${c.captura_url ? `![${c.titulo}](${c.captura_url})\n\n` : ""}${c.texto_md}`).join("\n\n")}\n`;
}

// ---------- Proceso ----------
async function config(sb: SB, userId: string) {
  const { data } = await sb.from("manuales_config").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data;
  const { data: n } = await sb.from("manuales_config").insert({ user_id: userId }).select("*").single(); return n!;
}
async function procesar(sb: SB, id: string) {
  const { data: m } = await sb.from("manuales").select("*").eq("id", id).maybeSingle();
  if (!m || ["listo", "error"].includes(m.estado)) return;
  const guardar = async (cambios: Record<string, unknown>) => sb.from("manuales").update({ ...cambios, actualizado_el: ahora() }).eq("id", id);
  try {
    const { data: p } = await sb.from("proyectos").select("*").eq("id", m.proyecto_id).single();
    const cfg = await config(sb, m.user_id);
    const prov = await proveedor(sb, m.user_id); if (!prov) throw new Error("No hay proveedor de IA con clave (Anthropic recomendado). Ponla en Ajustes → Proveedores.");
    const { data: permitido } = await sb.rpc("gasto_ia_permitido", { p_user_id: m.user_id, p_proveedor: null, p_proyecto_id: m.proyecto_id });
    if (permitido === false) throw new Error("Presupuesto de IA superado con acción «bloquear».");
    let te = m.tokens_entrada ?? 0, ts = m.tokens_salida ?? 0;
    const apuntar = async (r: { te: number; ts: number }) => { te += r.te; ts += r.ts; const c = (r.te * prov.ce + r.ts * prov.cs) / 1_000_000; await sb.from("consumos_ia").insert({ user_id: m.user_id, proyecto_id: m.proyecto_id, modelo_id: prov.modelo_id, tokens_entrada: r.te, tokens_salida: r.ts, coste: c, resultado: "ok" }).then(() => {}, () => {}); return c; };
    let coste = Number(m.coste ?? 0);
    const trato = cfg.tratamiento === "tu" ? "tutea al lector (tú)" : "trata al lector de usted";
    const sistemaBase = `Escribes manuales en español de España para ${PUBLICOS[m.publico] ?? PUBLICOS.usuario}. Estilo ${cfg.estilo === "tecnico" ? "preciso y técnico" : "claro, cercano y sin tecnicismos"}; ${trato} en todo el texto; frases cortas; pasos numerados cuando hay que hacer algo; consejos prácticos en notas. Nunca menciones que el texto lo ha escrito una IA ni cites archivos de código.`;
    if (m.estado === "borrador" || m.estado === "preparando") {
      await guardar({ estado: "preparando", paso: "Leyendo las pantallas del proyecto" });
      let pantallas: any[] = [];
      if (p.repositorio && TOKEN_GITHUB) { try { pantallas = await pantallasDelRepo(p.repositorio, Number(cfg.max_capitulos ?? 25) + 10); } catch { pantallas = []; } }
      const base = cfg.servicio_capturas ?? "https://image.thum.io/get/width/1280/crop/800/noanimate/";
      const urlApp = (p.espacio_trabajo_url ?? "").replace(/\/+$/, "");
      await guardar({ paso: "Proponiendo el índice del manual" });
      const r = await preguntar(prov, sistemaBase + " Devuelves SOLO JSON.", `Proyecto «${p.nombre}»: ${p.descripcion ?? ""}. Objetivo: ${p.objetivo ?? ""}. Tecnologías: ${p.tecnologias ?? ""}.\nPantallas detectadas (ruta → textos visibles):\n${pantallas.map((x) => `- ${x.ruta}: ${x.extracto || "(sin textos)"}`).join("\n").slice(0, 14000)}\n\nPropón el índice de un manual para ${PUBLICOS[m.publico] ?? PUBLICOS.usuario}: máximo ${cfg.max_capitulos ?? 25} capítulos, uno por pantalla o flujo importante (agrupa las pantallas menores; omite login/errores salvo que aporten). Devuelve JSON: {"titulo":"…","introduccion":"3-5 frases de bienvenida y para qué sirve la aplicación","capitulos":[{"orden":1,"titulo":"…","ruta":"/ruta o null","objetivo":"qué consigue el usuario aquí","elementos":["botón X","campo Y"]}]}`, 3500, true);
      coste += await apuntar(r);
      const esquema = extraerJson(r.texto); if (!esquema?.capitulos?.length) throw new Error("La IA no devolvió un índice válido");
      const capitulos = esquema.capitulos.slice(0, Number(cfg.max_capitulos ?? 25)).map((c: any, i: number) => ({ orden: i + 1, titulo: c.titulo, ruta: c.ruta ?? null, objetivo: c.objetivo ?? "", elementos: c.elementos ?? [], captura_url: cfg.incluir_capturas && urlApp && c.ruta && !/:/.test(c.ruta) ? `${base}${urlApp}${c.ruta}` : null, texto_md: null, revisado: false }));
      await guardar({ estado: "redactando", esquema, capitulos, titulo: m.titulo || esquema.titulo || `Manual de ${p.nombre}`, introduccion_md: esquema.introduccion ?? "", revision: null, revisado_el: null, tokens_entrada: te, tokens_salida: ts, coste, paso: `Redactando 0 de ${capitulos.length} capítulos` });
      m.capitulos = capitulos; m.esquema = esquema; m.estado = "redactando"; m.revision = null; m.introduccion_md = esquema.introduccion ?? "";
    }
    if (m.estado === "redactando") {
      const caps: any[] = m.capitulos ?? [];
      for (let i = 0; i < caps.length; i++) {
        if (caps[i].texto_md) continue;
        if (Date.now() - INICIO > PRESUPUESTO_MS - 20_000) { await guardar({ capitulos: caps, tokens_entrada: te, tokens_salida: ts, coste }); await sb.rpc("lanzar_manuales", { p_accion: "continuar", p_id: id }); return; }
        const c = caps[i];
        const r = await preguntar(prov, sistemaBase, `Manual «${m.titulo}» del proyecto «${p.nombre}» (${p.descripcion ?? ""}). Índice completo: ${caps.map((x) => x.titulo).join(" · ")}.\nEscribe el capítulo ${i + 1}: «${c.titulo}»${c.ruta ? ` (pantalla ${c.ruta})` : ""}. Objetivo: ${c.objetivo}. Elementos visibles: ${(c.elementos ?? []).join(", ")}.\nFormato Markdown: empieza con un párrafo de qué es y para qué sirve; luego subapartados «### Qué ves», «### Paso a paso» (lista numerada) y «### Consejos» (2-3 viñetas). Entre 180 y 350 palabras. No repitas el título del capítulo.`, 1400);
        coste += await apuntar(r);
        caps[i] = { ...c, texto_md: r.texto.trim(), revisado: false };
        await guardar({ capitulos: caps, tokens_entrada: te, tokens_salida: ts, coste, paso: `Redactando ${caps.filter((x) => x.texto_md).length} de ${caps.length} capítulos` });
      }
      m.capitulos = caps;
      if (cfg.revisar_redaccion === false) { m.estado = "publicando"; await guardar({ estado: "publicando", paso: "Componiendo el documento" }); }
      else { m.estado = "revisando"; await guardar({ estado: "revisando", paso: `Revisando la redacción: 0 de ${caps.length} capítulos` }); }
    }
    if (m.estado === "revisando") {
      const caps: any[] = m.capitulos ?? [];
      const glosario = [...new Set([p.nombre, ...GLOSARIO_BASE, ...((cfg.glosario ?? []) as string[])].filter(Boolean))];
      const perfil = cfg.usar_perfil_estilo === false ? "" : await perfilEstilo(sb, m.user_id);
      const sistema = sistemaRevisor(cfg, glosario, perfil);
      const rev: any = m.revision && typeof m.revision === "object" ? { ...m.revision } : { capitulos: 0, correcciones: 0, ejemplos: [], intro: false, no_aplicados: 0 };
      const acumular = (r: { correcciones: number; ejemplos: string[]; aplicado: boolean }) => { rev.correcciones += r.correcciones; if (!r.aplicado) rev.no_aplicados = (rev.no_aplicados ?? 0) + 1; rev.ejemplos = [...(rev.ejemplos ?? []), ...r.ejemplos].slice(0, 8); };
      let introMd = m.introduccion_md ?? "";
      if (!rev.intro && introMd.trim()) {
        const r = await revisarTexto(prov, sistema, introMd); coste += await apuntar(r); acumular(r); introMd = r.texto; rev.intro = true;
        await guardar({ introduccion_md: introMd, revision: rev, tokens_entrada: te, tokens_salida: ts, coste });
      }
      for (let i = 0; i < caps.length; i++) {
        if (!caps[i].texto_md || caps[i].revisado) continue;
        if (Date.now() - INICIO > PRESUPUESTO_MS - 20_000) { await guardar({ capitulos: caps, revision: rev, tokens_entrada: te, tokens_salida: ts, coste }); await sb.rpc("lanzar_manuales", { p_accion: "continuar", p_id: id }); return; }
        const r = await revisarTexto(prov, sistema, caps[i].texto_md); coste += await apuntar(r); acumular(r);
        caps[i] = { ...caps[i], texto_md: r.texto, revisado: true }; rev.capitulos = caps.filter((x) => x.revisado).length;
        await guardar({ capitulos: caps, revision: rev, tokens_entrada: te, tokens_salida: ts, coste, paso: `Revisando la redacción: ${rev.capitulos} de ${caps.length} capítulos` });
      }
      rev.nivel = cfg.nivel_revision ?? "normal"; rev.tratamiento = cfg.tratamiento ?? "usted"; rev.modelo = `${prov.slug} · ${prov.modelo}`; rev.con_perfil_estilo = !!perfil; rev.glosario = glosario;
      m.capitulos = caps; m.introduccion_md = introMd; m.revision = rev; m.estado = "publicando";
      await guardar({ estado: "publicando", revision: rev, revisado_el: ahora(), paso: "Componiendo el documento" });
    }
    if (m.estado === "publicando") {
      const { data: cfgApp } = await sb.from("configuracion_app").select("valor").eq("clave", "powered_by").maybeSingle();
      const marca = cfgApp?.valor ?? "Modeontecno S.L.";
      const html = componerHtml({ ...m, incluir_capturas: cfg.incluir_capturas }, p, marca); const md = componerMd(m, p);
      const d = await destinoDocumentos(sb, m.user_id);
      const slug = p.proyectian_slug ?? p.slug; const v = m.version_proyecto ?? p.version_actual ?? "";
      const baseNombre = `${slug}-manual-${m.publico}${v ? `-v${v}` : ""}`;
      let rutaHtml: string | null = null, rutaMd: string | null = null;
      if (d) {
        rutaHtml = `proyectos/${slug}/03-MANUALES/${baseNombre}.html`; rutaMd = `proyectos/${slug}/03-MANUALES/${baseNombre}.md`;
        await s3put(d, rutaHtml, enc.encode(html), "text/html; charset=utf-8"); await s3put(d, rutaMd, enc.encode(md), "text/markdown; charset=utf-8");
      }
      const rutaMac = `NUEVOS DESARROLLOS/${p.nombre.toUpperCase()}/03-MANUALES/${baseNombre}.pdf`;
      const { data: doc } = await sb.from("documentos_nex").insert({ user_id: m.user_id, proyecto_id: p.id, tipo: "manual", titulo: m.titulo, version: v || null, nombre_archivo: `${baseNombre}.html`, mime: "text/html", bytes: html.length, ruta_remota: rutaHtml, origen: "generado", ruta_mac: rutaMac }).select("id").single();
      let avisoP: string | null = null;
      try { await proyectianSql(`insert into public.documentos (user_id, proyecto_id, tipo, titulo, version, descripcion, fecha, ruta_mac, destino_id, ruta_remota, bytes) select p.user_id, p.id, 'manual', ${sqlLit(m.titulo)}, ${sqlLit(v || null)}, ${sqlLit(`Manual de ${m.publico} generado por NexDeveloper${m.revision ? " (redacción revisada)" : ""}`)}, current_date, ${sqlLit(rutaMac)}, (select id from public.destinos_almacenamiento where tipo='s3' and activo order by usar_para_documentos desc limit 1), ${sqlLit(rutaHtml)}, ${html.length} from public.proyectos p where p.slug = ${sqlLit(slug)}`); }
      catch (e) { avisoP = `Proyectian no respondió: ${String(e?.message ?? e).slice(0, 150)}`; }
      await sb.from("tareas").insert({ user_id: m.user_id, proyecto_id: p.id, titulo: `Repaso final y copia en el Mac: ${baseNombre}.pdf`, descripcion: `Descarga el PDF del manual desde Manuales → ${m.titulo}, dale el repaso final en Grammarly si lo ves necesario y guárdalo en ${rutaMac}`, estado: "pendiente", prioridad: "baja", requiere_atencion: true, motivo_atencion: "Repaso final y copia local en el Mac", instrucciones: `Manuales → abre «${m.titulo}» → «Descargar PDF» → (opcional) repaso final en Grammarly → guarda el archivo en ${rutaMac}` }).then(() => {}, () => {});
      await guardar({ estado: "listo", paso: avisoP ?? (m.revision ? `Manual publicado · redacción revisada (${m.revision.correcciones ?? 0} correcciones)` : "Manual publicado"), html, markdown: md, ruta_remota_html: rutaHtml, ruta_remota_md: rutaMd, documento_id: doc?.id ?? null, tokens_entrada: te, tokens_salida: ts, coste, error: null });
    }
  } catch (e) { await guardar({ estado: "error", error: String(e?.message ?? e).slice(0, 500) }); }
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
      case "continuar": { if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403); await procesar(sb, String(cuerpo.manual_id)); return json({ ok: true }); }
      case "programado": {
        if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
        const { data: cfgs } = await sb.from("manuales_config").select("user_id, regenerar_al_cambiar_version").eq("regenerar_al_cambiar_version", true);
        const res: unknown[] = [];
        for (const c of cfgs ?? []) {
          const { data: ultimos } = await sb.from("manuales").select("id, proyecto_id, publico, version_proyecto, titulo, proyectos(version_actual)").eq("user_id", c.user_id).eq("estado", "listo").order("creado_el", { ascending: false });
          const vistos = new Set<string>();
          for (const u of ultimos ?? []) {
            const k = `${u.proyecto_id}:${u.publico}`; if (vistos.has(k)) continue; vistos.add(k);
            const va = (u as any).proyectos?.version_actual; if (!va || va === u.version_proyecto) continue;
            const { data: n } = await sb.from("manuales").insert({ user_id: c.user_id, proyecto_id: u.proyecto_id, titulo: u.titulo, publico: u.publico, version_proyecto: va }).select("id").single();
            if (n) { await sb.rpc("lanzar_manuales", { p_accion: "continuar", p_id: n.id }); res.push({ regenerado: k, version: va }); }
          }
        }
        return json({ ok: true, resultados: res });
      }
      case "estado": {
        const cfg = await config(sb, userId!);
        const prov = await proveedor(sb, userId!);
        const perfil = await perfilEstilo(sb, userId!);
        return json({ ok: true, config: cfg, ia: prov ? `${prov.slug} · ${prov.modelo}` : null, github: !!TOKEN_GITHUB, proyectian: !!TOKEN_CUENTA, almacen: !!(await destinoDocumentos(sb, userId!)), perfil_estilo: !!perfil, revisor: !!prov });
      }
      case "configurar": {
        const permitidos = ["regenerar_al_cambiar_version", "estilo", "incluir_capturas", "servicio_capturas", "max_capitulos", "revisar_redaccion", "tratamiento", "nivel_revision", "usar_perfil_estilo", "glosario"];
        const cambios: Record<string, unknown> = { user_id: userId!, actualizado_el: ahora() };
        for (const k of permitidos) if (k in cuerpo) cambios[k] = cuerpo[k];
        if ("tratamiento" in cambios && !["usted", "tu"].includes(String(cambios.tratamiento))) cambios.tratamiento = "usted";
        if ("nivel_revision" in cambios && !["ligera", "normal", "exhaustiva"].includes(String(cambios.nivel_revision))) cambios.nivel_revision = "normal";
        if ("glosario" in cambios) cambios.glosario = (Array.isArray(cambios.glosario) ? cambios.glosario : String(cambios.glosario ?? "").split(/[,\n;]/)).map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 60);
        const { data } = await sb.from("manuales_config").upsert(cambios).select("*").single();
        return json({ ok: true, config: data });
      }
      case "generar": {
        const { data: p } = await sb.from("proyectos").select("id, nombre, version_actual").eq("id", String(cuerpo.proyecto_id)).eq("user_id", userId!).maybeSingle();
        if (!p) return json({ ok: false, error: "Proyecto no encontrado" });
        const publico = ["usuario", "administrador", "comercial"].includes(cuerpo.publico) ? cuerpo.publico : "usuario";
        const { data: m } = await sb.from("manuales").insert({ user_id: userId!, proyecto_id: p.id, titulo: cuerpo.titulo || `Manual de ${publico === "comercial" ? "presentación" : publico} de ${p.nombre}`, publico, version_proyecto: cuerpo.version ?? p.version_actual ?? null }).select("*").single();
        await procesar(sb, m!.id);
        const { data: fin } = await sb.from("manuales").select("id, estado, paso, error, titulo").eq("id", m!.id).single();
        return json({ ok: fin!.estado !== "error", manual: fin, error: fin!.error });
      }
      case "reintentar": {
        const { data: m } = await sb.from("manuales").select("id, estado").eq("id", String(cuerpo.manual_id)).eq("user_id", userId!).maybeSingle();
        if (!m) return json({ ok: false, error: "Manual no encontrado" });
        await sb.from("manuales").update({ estado: m.estado === "error" ? "borrador" : m.estado, error: null }).eq("id", m.id);
        await procesar(sb, m.id);
        const { data: fin } = await sb.from("manuales").select("id, estado, paso, error").eq("id", m.id).single();
        return json({ ok: fin!.estado !== "error", manual: fin });
      }
      case "revisar": {
        // Vuelve a pasar el Revisor de redacción a un manual ya publicado (o con error), sin redactarlo de nuevo.
        const { data: m } = await sb.from("manuales").select("id, estado, capitulos").eq("id", String(cuerpo.manual_id)).eq("user_id", userId!).maybeSingle();
        if (!m) return json({ ok: false, error: "Manual no encontrado" });
        if (!["listo", "error"].includes(m.estado)) return json({ ok: false, error: "El manual todavía se está generando" });
        const caps: any[] = (m.capitulos ?? []).map((c: any) => ({ ...c, revisado: false }));
        if (!caps.some((c) => c.texto_md)) return json({ ok: false, error: "El manual no tiene capítulos redactados" });
        await sb.from("manuales").update({ capitulos: caps, estado: "revisando", revision: null, revisado_el: null, error: null, paso: `Revisando la redacción: 0 de ${caps.length} capítulos` }).eq("id", m.id);
        await procesar(sb, m.id);
        const { data: fin } = await sb.from("manuales").select("id, estado, paso, error, revision").eq("id", m.id).single();
        return json({ ok: fin!.estado !== "error", manual: fin });
      }
      case "regenerar_capitulo": {
        const { data: m } = await sb.from("manuales").select("*").eq("id", String(cuerpo.manual_id)).eq("user_id", userId!).maybeSingle();
        if (!m) return json({ ok: false, error: "Manual no encontrado" });
        const caps: any[] = m.capitulos ?? []; const i = caps.findIndex((c) => c.orden === Number(cuerpo.orden)); if (i < 0) return json({ ok: false, error: "Capítulo no encontrado" });
        caps[i] = { ...caps[i], texto_md: null, revisado: false, ...(cuerpo.titulo ? { titulo: cuerpo.titulo } : {}), ...(cuerpo.objetivo ? { objetivo: cuerpo.objetivo } : {}) };
        await sb.from("manuales").update({ capitulos: caps, estado: "redactando", error: null }).eq("id", m.id);
        await procesar(sb, m.id);
        const { data: fin } = await sb.from("manuales").select("id, estado, paso, error").eq("id", m.id).single();
        return json({ ok: fin!.estado !== "error", manual: fin });
      }
      case "editar_capitulo": {
        const { data: m } = await sb.from("manuales").select("capitulos").eq("id", String(cuerpo.manual_id)).eq("user_id", userId!).maybeSingle();
        if (!m) return json({ ok: false, error: "Manual no encontrado" });
        const caps: any[] = (m.capitulos ?? []).map((c: any) => c.orden === Number(cuerpo.orden) ? { ...c, ...(cuerpo.titulo !== undefined ? { titulo: cuerpo.titulo } : {}), ...(cuerpo.texto_md !== undefined ? { texto_md: cuerpo.texto_md } : {}), ...(cuerpo.captura_url !== undefined ? { captura_url: cuerpo.captura_url } : {}) } : c);
        await sb.from("manuales").update({ capitulos: caps, estado: "publicando" }).eq("id", String(cuerpo.manual_id));
        await procesar(sb, String(cuerpo.manual_id));
        return json({ ok: true });
      }
      case "enlace": {
        const { data: m } = await sb.from("manuales").select("ruta_remota_html, ruta_remota_md, titulo").eq("id", String(cuerpo.manual_id)).eq("user_id", userId!).maybeSingle();
        if (!m?.ruta_remota_html) return json({ ok: false, error: "El manual no está en el almacén" });
        const d = await destinoDocumentos(sb, userId!); if (!d) return json({ ok: false, error: "Sin almacén configurado" });
        const md = cuerpo.formato === "md";
        return json({ ok: true, url: await presignar(d, md ? m.ruta_remota_md : m.ruta_remota_html, `${m.titulo}.${md ? "md" : "html"}`, 3600, !md) });
      }
      case "borrar": { await sb.from("manuales").delete().eq("id", String(cuerpo.manual_id)).eq("user_id", userId!); return json({ ok: true }); }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (err) { return json({ ok: false, error: String(err?.message ?? err) }, 500); }
});
