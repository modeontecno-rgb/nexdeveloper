// NexDeveloper · Edge Function «documentar» (0.16.0)
// Documentación automática al cerrar versión (hoja de cambios HTML+MD, almacén propio, Proyectian, GitHub) y documentos de proyecto coordinados con Proyectian.
// Acciones: preparar_cierre · cerrar_version · subir_documento · listar_documentos · enlace_descarga · importar_destino_proyectian · sin acción → estado
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_CUENTA = Deno.env.get("CUENTA_SUPABASE_TOKEN") ?? "";
const TOKEN_GITHUB = Deno.env.get("GITHUB_TOKEN") ?? "";
const REF_PROYECTIAN = Deno.env.get("PROYECTIAN_REF") ?? "hjtweberlereyfhagkvx";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const limpiar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
const sqlLit = (s: unknown) => s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`;

// ---------- Proyectian (SQL por la API de administración de Supabase, con el token de cuenta) ----------
async function proyectianSql(sql: string, readOnly = false) {
  if (!TOKEN_CUENTA) throw new Error("Falta CUENTA_SUPABASE_TOKEN para hablar con Proyectian");
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF_PROYECTIAN}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN_CUENTA}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql, read_only: readOnly }) });
  if (!r.ok) throw new Error(`Proyectian ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return await r.json();
}

// ---------- S3 (almacén propio) ----------
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
  const f = Array.isArray(data) ? data[0] : data;
  if (!f?.secreto) return null;
  return { id: dest.id, endpoint: f.url_servidor.replace(/\/+$/, ""), region: f.region || "eu-central-1", bucket: f.bucket, prefijo: (f.ruta_prefijo || "").replace(/^\/+|\/+$/g, ""), access: f.usuario, secret: f.secreto };
}
// Copia el destino S3 de Proyectian a NexDeveloper sin que la credencial pase por ningún cliente
async function importarDestinoProyectian(sb: SB, userId: string) {
  const filas = await proyectianSql(`select d.id, d.nombre, d.url_servidor, d.usuario, d.bucket, d.region, coalesce(d.ruta_prefijo,'') as ruta_prefijo,
    case when d.credencial_cifrada is null then null else extensions.pgp_sym_decrypt(decode(d.credencial_cifrada,'base64'), public.fn_clave_maestra()) end as secreto
    from public.destinos_almacenamiento d where d.tipo = 's3' and d.activo order by d.usar_para_documentos desc, d.es_predeterminado desc limit 1`, true);
  const f = filas?.[0]; if (!f?.secreto) throw new Error("Proyectian no tiene un destino S3 con credencial");
  const { data: existente } = await sb.from("copias_destinos").select("id").eq("user_id", userId).eq("url_servidor", f.url_servidor).maybeSingle();
  let id = existente?.id as string | undefined;
  const base = { user_id: userId, nombre: `${f.nombre} (desde Proyectian)`, tipo: "s3", url_servidor: f.url_servidor, bucket: "copias", region: f.region || "eu-central-1", ruta_prefijo: "", usuario: f.usuario, activo: true, es_predeterminado: true, usar_para_documentos: true, notas: "Importado automáticamente desde Proyectian. Bucket «copias» para copias de seguridad y compilaciones; los documentos van al bucket «proyectian».", actualizado_el: new Date().toISOString() };
  if (id) await sb.from("copias_destinos").update(base).eq("id", id); else { const { data: n } = await sb.from("copias_destinos").insert(base).select("id").single(); id = n?.id; }
  // Cifrar con la clave de NexDeveloper (SQL en la propia base, sin exponer nada)
  const { error } = await sb.rpc("guardar_secreto_copias_servicio", { p_destino_id: id, p_secreto: f.secreto });
  if (error) throw new Error(error.message);
  // Configurar copias si no hay destino
  await sb.from("copias_config").upsert({ user_id: userId, destino_id: id, auto_activa: true }, { onConflict: "user_id" });
  return { destino_id: id, servidor: f.url_servidor };
}

// ---------- Hoja de cambios ----------
function hojaHtml(p: { nombre: string }, c: any, fecha: string) {
  const cambios = (c.cambios ?? []) as any[]; const tec = (c.tecnico ?? []) as string[]; const probar = (c.como_probar ?? []) as string[]; const pend = (c.pendiente_usuario ?? []) as string[];
  const md = [`# ${p.nombre} — Hoja de cambios v${c.version}`, "", `**${c.titulo ?? ""}** · ${fecha}`, "", "Fabricante: Soluciones EvoluteIA S.L.", "", "## Resumen", "", c.resumen ?? "", "", "## Cambios de esta versión", ""];
  cambios.forEach((x, i) => { md.push(`### ${i + 1}. ${x.titulo}`, "", x.descripcion ?? "", ""); if (x.motivo) md.push(`> **Por qué importa:** ${x.motivo}`, ""); });
  if (tec.length) md.push("## Detalle técnico", "", ...tec.map((t) => `- ${t}`), "");
  if (probar.length) md.push("## Cómo probarlo", "", ...probar.map((t, i) => `${i + 1}. ${t}`), "");
  if (pend.length) md.push("## Lo que necesita tu intervención", "", ...pend.map((t) => `- ${t}`), "");
  md.push("---", "", `Versión publicada: **v${c.version}**. Registro en Proyectian: versión + cambios. Copia en NUEVOS DESARROLLOS/${p.nombre.toUpperCase()}/04-ENTREGABLES.`);
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(p.nombre)} · Hoja de cambios v${esc(c.version)}</title><style>
  @page{size:A4;margin:18mm 16mm}body{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1b2430;font-size:10.5pt;line-height:1.5;margin:0;padding:24px;background:#f6f9fb}
  .doc{max-width:820px;margin:0 auto;background:#fff;padding:0 0 24px;border-radius:14px;overflow:hidden}
  .portada{background:linear-gradient(135deg,#0f2a3a,#12706f);color:#fff;padding:34px 36px 30px}.emb{display:inline-block;width:46px;height:46px;border-radius:12px;background:#22d3c5;color:#0f2a3a;font-weight:800;font-size:22px;text-align:center;line-height:46px;margin-bottom:14px}
  h1{margin:0 0 6px;font-size:22pt}.sub{font-size:12pt;opacity:.92}.meta{margin-top:14px;font-size:9.5pt;opacity:.85}
  .cifras{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:18px 36px 0}.cifra{border:1px solid #d9e2ea;border-radius:10px;padding:10px 14px;background:#f6f9fb}.cifra b{display:block;font-size:18pt;color:#12706f}.cifra span{font-size:8.5pt;color:#5b6b7a;text-transform:uppercase;letter-spacing:.6px}
  .cuerpo{padding:0 36px}h2{font-size:14pt;color:#0f2a3a;border-bottom:2px solid #22d3c5;padding-bottom:4px;margin-top:24px}h3{font-size:11.5pt;color:#12706f;margin:16px 0 4px}
  blockquote{margin:6px 0 10px;padding:8px 12px;background:#fff7e6;border-left:4px solid #f0a92e;border-radius:6px;font-size:9.8pt}ul,ol{padding-left:20px}li{margin:3px 0}
  .pie{font-size:8.5pt;color:#7a8794;padding:16px 36px 0;border-top:1px solid #e6edf3;margin-top:20px}@media print{body{background:#fff;padding:0}}
  </style></head><body><div class="doc"><div class="portada"><div class="emb">${esc(p.nombre[0])}</div><h1>${esc(p.nombre)} · Hoja de cambios v${esc(c.version)}</h1><div class="sub">${esc(c.titulo ?? "")}</div><div class="meta">${esc(fecha)} · Fabricante: Soluciones EvoluteIA S.L. · Registro: Proyectian</div></div>
  <div class="cifras"><div class="cifra"><b>v${esc(c.version)}</b><span>Versión publicada</span></div><div class="cifra"><b>${cambios.length}</b><span>Cambios funcionales</span></div><div class="cifra"><b>${tec.length}</b><span>Cambios técnicos</span></div><div class="cifra"><b>${pend.length}</b><span>Acciones tuyas</span></div></div>
  <div class="cuerpo"><h2>Resumen</h2><p>${esc(c.resumen ?? "")}</p><h2>Cambios de esta versión</h2>
  ${cambios.map((x, i) => `<h3>${i + 1}. ${esc(x.titulo)}</h3><p>${esc(x.descripcion ?? "")}</p>${x.motivo ? `<blockquote><b>Por qué importa:</b> ${esc(x.motivo)}</blockquote>` : ""}`).join("")}
  ${tec.length ? `<h2>Detalle técnico</h2><ul>${tec.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
  ${probar.length ? `<h2>Cómo probarlo</h2><ol>${probar.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>` : ""}
  ${pend.length ? `<h2>Lo que necesita tu intervención</h2><ul>${pend.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
  </div><div class="pie">Versión publicada v${esc(c.version)} · Registro en Proyectian (versión + cambios) · Copia en NUEVOS DESARROLLOS/${esc(p.nombre.toUpperCase())}/04-ENTREGABLES · Generado por NexDeveloper</div></div></body></html>`;
  return { md: md.join("\n"), html };
}
const siguienteVersion = (v: string | null) => { const m = (v ?? "0.0.0").match(/^(\d+)\.(\d+)\.(\d+)/); if (!m) return "0.1.0"; return `${m[1]}.${Number(m[2]) + 1}.0`; };

async function redactarConIA(sb: SB, userId: string, p: any, version: string, material: string) {
  for (const slug of ["anthropic", "groq", "google"]) {
    const { data: prov } = await sb.from("proveedores_ia").select("id, clave_cifrada").eq("user_id", userId).eq("clave_slug", slug).maybeSingle();
    if (!prov?.clave_cifrada) continue;
    const { data: clave } = await sb.rpc("descifrar_clave_proveedor", { p_proveedor_id: prov.id }); if (!clave) continue;
    const sistema = "Redactas hojas de cambios para el usuario final en español de España, claras y sin tecnicismos innecesarios. Devuelves SOLO JSON.";
    const pregunta = `Proyecto «${p.nombre}» (${p.descripcion ?? ""}). Versión nueva: ${version}.\nMaterial (tareas completadas, actividad, compilaciones, commits):\n${material.slice(0, 9000)}\n\nDevuelve JSON: {"titulo":"título corto de la versión","resumen":"2-3 frases para el cliente","cambios":[{"tipo":"nueva_funcion|arreglo|diseno|seguridad|rendimiento|datos|documentacion|despliegue|otro","titulo":"…","descripcion":"1-3 frases","motivo":"por qué importa (1 frase)","importancia":"alta|media|baja"}],"tecnico":["…"],"como_probar":["paso 1","paso 2"],"pendiente_usuario":["…"]}`;
    try {
      let texto = "";
      if (slug === "anthropic") { const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": String(clave), "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 2500, system: sistema, messages: [{ role: "user", content: pregunta }] }) }); if (!r.ok) continue; const j = await r.json(); texto = (j.content ?? []).map((c: any) => c.text ?? "").join(""); }
      else if (slug === "google") { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${clave}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: "user", parts: [{ text: pregunta }] }], generationConfig: { responseMimeType: "application/json" } }) }); if (!r.ok) continue; const j = await r.json(); texto = (j.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text ?? "").join(""); }
      else { const r = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${clave}`, "content-type": "application/json" }, body: JSON.stringify({ model: "llama-3.3-70b-versatile", temperature: 0.2, response_format: { type: "json_object" }, messages: [{ role: "system", content: sistema }, { role: "user", content: pregunta }] }) }); if (!r.ok) continue; const j = await r.json(); texto = j.choices?.[0]?.message?.content ?? ""; }
      const m = texto.match(/\{[\s\S]*\}/); if (m) return { ...JSON.parse(m[0]), redactado_por: slug };
    } catch (_) { /* siguiente */ }
  }
  return null;
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
    } else if (cuerpo.user_id) userId = String(cuerpo.user_id);
    if (!userId) { const { data: c } = await sb.from("copias_config").select("user_id").limit(1).maybeSingle(); userId = c?.user_id ?? null; }
    if (!accion) {
      const d = userId ? await destinoDocumentos(sb, userId) : null;
      let proyectian = false; try { await proyectianSql("select 1", true); proyectian = true; } catch { /* nada */ }
      return json({ ok: true, listo: true, almacen: !!d, proyectian, github: !!TOKEN_GITHUB });
    }
    switch (accion) {
      case "importar_destino_proyectian": return json({ ok: true, ...(await importarDestinoProyectian(sb, userId!)) });
      case "preparar_cierre": {
        const { data: p } = await sb.from("proyectos").select("*").eq("id", String(cuerpo.proyecto_id)).eq("user_id", userId!).maybeSingle();
        if (!p) return json({ ok: false, error: "Proyecto no encontrado" }, 404);
        const { data: ultimo } = await sb.from("cierres_version").select("cerrada_el, version").eq("proyecto_id", p.id).eq("estado", "cerrada").order("cerrada_el", { ascending: false }).limit(1);
        const desde = ultimo?.[0]?.cerrada_el ?? new Date(Date.now() - 30 * 86400000).toISOString();
        const version = String(cuerpo.version || siguienteVersion(p.version_actual ?? ultimo?.[0]?.version ?? null));
        const [tareas, actividad, compil, calidad] = await Promise.all([
          sb.from("tareas").select("titulo, descripcion, completada_el").eq("proyecto_id", p.id).eq("estado", "completada").gte("completada_el", desde).limit(60),
          sb.from("actividad").select("tipo, texto, fecha").eq("proyecto_id", p.id).gte("fecha", desde).order("fecha", { ascending: false }).limit(80),
          sb.from("compilaciones").select("plataforma, version, estado, terminada_el").eq("proyecto_id", p.id).gte("creado_el", desde).limit(20),
          sb.from("ejecuciones_calidad").select("version, estado, resumen").eq("proyecto_id", p.id).gte("creado_el", desde).limit(10),
        ]);
        let commits: string[] = [];
        if (TOKEN_GITHUB && p.repositorio) { try { const r = await fetch(`https://api.github.com/repos/${p.repositorio}/commits?since=${desde}&per_page=50`, { headers: { Authorization: `Bearer ${TOKEN_GITHUB}`, Accept: "application/vnd.github+json", "User-Agent": "NexDeveloper" } }); if (r.ok) commits = ((await r.json()) as any[]).map((c) => `- ${c.commit?.message?.split("\n")[0]} (${(c.sha ?? "").slice(0, 7)})`); } catch { /* nada */ } }
        const material = [`Tareas completadas:`, ...(tareas.data ?? []).map((t) => `- ${t.titulo}: ${(t.descripcion ?? "").slice(0, 200)}`), `Actividad:`, ...(actividad.data ?? []).map((a) => `- ${a.tipo}: ${a.texto.slice(0, 200)}`), `Compilaciones:`, ...(compil.data ?? []).map((c) => `- ${c.plataforma} v${c.version} ${c.estado}`), `Calidad:`, ...(calidad.data ?? []).map((c) => `- v${c.version} ${c.estado}: ${c.resumen ?? ""}`), `Commits:`, ...commits].join("\n");
        let propuesta: any = cuerpo.sin_ia ? null : await redactarConIA(sb, userId!, p, version, material);
        if (!propuesta) propuesta = { titulo: `Versión ${version}`, resumen: "", cambios: (tareas.data ?? []).map((t) => ({ tipo: "nueva_funcion", titulo: t.titulo, descripcion: (t.descripcion ?? "").slice(0, 300), motivo: "", importancia: "media" })), tecnico: commits.slice(0, 15).map((c) => c.replace(/^- /, "")), como_probar: [], pendiente_usuario: [], redactado_por: "plantilla" };
        const { data: fila, error } = await sb.from("cierres_version").upsert({ user_id: userId, proyecto_id: p.id, version, titulo: propuesta.titulo, resumen: propuesta.resumen, cambios: propuesta.cambios ?? [], tecnico: propuesta.tecnico ?? [], como_probar: propuesta.como_probar ?? [], pendiente_usuario: propuesta.pendiente_usuario ?? [], estado: "borrador", redactado_por: propuesta.redactado_por, ruta_mac: `NUEVOS DESARROLLOS/${p.nombre.toUpperCase()}/04-ENTREGABLES/${limpiar(p.nombre.toUpperCase())}-hoja-de-cambios-v${version}.pdf` }, { onConflict: "proyecto_id,version" }).select("*").single();
        if (error) return json({ ok: false, error: error.message }, 500);
        return json({ ok: true, cierre: fila, material_lineas: material.split("\n").length });
      }
      case "cerrar_version": {
        const { data: c } = await sb.from("cierres_version").select("*").eq("id", String(cuerpo.cierre_id)).eq("user_id", userId!).maybeSingle();
        if (!c) return json({ ok: false, error: "Cierre no encontrado" }, 404);
        const { data: p } = await sb.from("proyectos").select("*").eq("id", c.proyecto_id).maybeSingle();
        const datos = { ...c, ...(cuerpo.datos ?? {}) };
        const fecha = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
        const hoja = hojaHtml(p, datos, fecha);
        const res: Record<string, unknown> = { hoja_md: hoja.md, hoja_html: hoja.html, titulo: datos.titulo, resumen: datos.resumen, cambios: datos.cambios, tecnico: datos.tecnico, como_probar: datos.como_probar, pendiente_usuario: datos.pendiente_usuario, error: null };
        const avisos: string[] = [];
        const nombreBase = `${limpiar(p.nombre.toUpperCase())}-hoja-de-cambios-v${c.version}`;
        // 1) Almacén propio (bucket proyectian → proyectos/<slug>/04-ENTREGABLES)
        try {
          const d = await destinoDocumentos(sb, userId!);
          if (!d) throw new Error("sin destino de almacén");
          const dDoc: Destino = { ...d, bucket: "proyectian" };
          const carpeta = `proyectos/${p.proyectian_slug ?? p.slug}/04-ENTREGABLES`;
          await s3put(dDoc, `${carpeta}/${nombreBase}.html`, enc.encode(hoja.html), "text/html; charset=utf-8");
          await s3put(dDoc, `${carpeta}/${nombreBase}.md`, enc.encode(hoja.md), "text/markdown; charset=utf-8");
          res.ruta_remota_html = `${carpeta}/${nombreBase}.html`; res.ruta_remota_md = `${carpeta}/${nombreBase}.md`;
          await sb.from("documentos_nex").insert({ user_id: userId, proyecto_id: p.id, tipo: "hoja_cambios", titulo: `Hoja de cambios ${c.version}`, version: c.version, nombre_archivo: `${nombreBase}.html`, mime: "text/html", bytes: hoja.html.length, ruta_remota: res.ruta_remota_html, ruta_mac: c.ruta_mac });
        } catch (e) { avisos.push(`Almacén: ${String(e?.message ?? e)}`); }
        // 2) Proyectian: versión + cambios + documento
        try {
          const cambiosJson = JSON.stringify((datos.cambios ?? []).map((x: any) => ({ tipo: x.tipo ?? "nueva_funcion", titulo: x.titulo, descripcion: x.descripcion, motivo: x.motivo, importancia: x.importancia ?? "media" })));
          const notas = `${datos.resumen ?? ""} Hoja de cambios: ${nombreBase}.`;
          const filas = await proyectianSql(`select public.nex_registrar_version(${sqlLit(p.proyectian_slug ?? p.slug)}, ${sqlLit(c.version)}, current_date, ${sqlLit(datos.titulo ?? "Versión " + c.version)}, ${sqlLit(notas)}, ${sqlLit(cambiosJson)}::jsonb) as id`);
          res.proyectian_version_id = filas?.[0]?.id ?? null; res.proyectian_ok = true;
          if (res.ruta_remota_html) await proyectianSql(`update public.documentos set destino_id = (select id from public.destinos_almacenamiento where tipo='s3' and activo order by usar_para_documentos desc limit 1), ruta_remota = ${sqlLit(res.ruta_remota_html)}, archivo_path = null where proyecto_id = (select id from public.proyectos where slug = ${sqlLit(p.proyectian_slug ?? p.slug)}) and version = ${sqlLit(c.version)} and tipo = 'notas_version'`);
        } catch (e) { avisos.push(`Proyectian: ${String(e?.message ?? e)}`); }
        // 3) GitHub: CHANGELOG.md y etiqueta
        if (TOKEN_GITHUB && p.repositorio && cuerpo.github !== false) {
          try {
            const cab = { Authorization: `Bearer ${TOKEN_GITHUB}`, Accept: "application/vnd.github+json", "User-Agent": "NexDeveloper", "Content-Type": "application/json" };
            const entrada = `## ${c.version} — ${fecha}\n\n${(datos.cambios ?? []).map((x: any) => `- ${x.titulo}${x.descripcion ? `: ${x.descripcion}` : ""}`).join("\n")}\n\n`;
            const r = await fetch(`https://api.github.com/repos/${p.repositorio}/contents/CHANGELOG.md`, { headers: cab });
            let contenido = "# Historial de cambios\n\n"; let sha: string | undefined;
            if (r.ok) { const j = await r.json(); sha = j.sha; contenido = new TextDecoder().decode(Uint8Array.from(atob((j.content ?? "").replace(/\n/g, "")), (ch) => ch.charCodeAt(0))); }
            const nuevo = contenido.includes(`## ${c.version} `) ? contenido : contenido.replace(/^(# [^\n]*\n\n?)/, `$1${entrada}`);
            const up = await fetch(`https://api.github.com/repos/${p.repositorio}/contents/CHANGELOG.md`, { method: "PUT", headers: cab, body: JSON.stringify({ message: `Hoja de cambios v${c.version}`, content: btoa(unescape(encodeURIComponent(nuevo))), ...(sha ? { sha } : {}) }) });
            res.github_changelog = up.ok;
            const ref = await fetch(`https://api.github.com/repos/${p.repositorio}/git/ref/heads/main`, { headers: cab });
            if (ref.ok) { const shaMain = (await ref.json()).object.sha; const t = await fetch(`https://api.github.com/repos/${p.repositorio}/git/refs`, { method: "POST", headers: cab, body: JSON.stringify({ ref: `refs/tags/v${c.version}`, sha: shaMain }) }); if (t.ok || t.status === 422) res.github_tag = `v${c.version}`; }
          } catch (e) { avisos.push(`GitHub: ${String(e?.message ?? e)}`); }
        }
        res.estado = "cerrada"; res.cerrada_el = new Date().toISOString(); res.error = avisos.length ? avisos.join(" · ") : null;
        await sb.from("cierres_version").update(res).eq("id", c.id);
        await sb.from("proyectos").update({ version_actual: c.version, actualizado_el: new Date().toISOString() }).eq("id", p.id);
        await sb.from("actividad").insert({ user_id: userId, proyecto_id: p.id, tipo: "version", texto: `Versión ${c.version} cerrada: hoja de cambios${res.proyectian_ok ? ", Proyectian" : ""}${res.github_changelog ? ", CHANGELOG" : ""}${res.github_tag ? ", etiqueta " + res.github_tag : ""}.`, referencia_tabla: "cierres_version", referencia_id: c.id });
        await sb.from("tareas").insert({ user_id: userId, proyecto_id: p.id, titulo: `Guardar la hoja de cambios v${c.version} en la carpeta del Mac`, descripcion: `Descárgala desde Documentación (PDF) y guárdala en ${c.ruta_mac}. Si trabajas con Claude, pídele que la copie él.`, estado: "pendiente", prioridad: "baja", requiere_atencion: true, motivo_atencion: "Copia en el Mac", instrucciones: "Documentación → cierre → Descargar PDF → guardar en 04-ENTREGABLES." });
        return json({ ok: true, cierre_id: c.id, avisos, proyectian_ok: res.proyectian_ok ?? false, ruta_remota_html: res.ruta_remota_html ?? null, github_tag: res.github_tag ?? null });
      }
      case "subir_documento": {
        const { data: p } = await sb.from("proyectos").select("*").eq("id", String(cuerpo.proyecto_id)).eq("user_id", userId!).maybeSingle();
        if (!p) return json({ ok: false, error: "Proyecto no encontrado" }, 404);
        const d = await destinoDocumentos(sb, userId!); if (!d) return json({ ok: false, error: "No hay destino de almacén (Copias → destino con «usar para documentos»)." });
        const bytes = Uint8Array.from(atob(String(cuerpo.contenido_base64 ?? "")), (c) => c.charCodeAt(0));
        if (bytes.length > 45 * 1024 * 1024) return json({ ok: false, error: "Máximo 45 MB por archivo desde la app" }, 400);
        const tipo = String(cuerpo.tipo ?? "otro"); const carpetaPorTipo: Record<string, string> = { hoja_cambios: "04-ENTREGABLES", manual: "03-MANUALES", comercial: "07-COMERCIAL", informe: "06-DOCUMENTOS-DE-TRABAJO", video: "03-MANUALES", imagen: "07-COMERCIAL", otro: "06-DOCUMENTOS-DE-TRABAJO" };
        const nombre = limpiar(String(cuerpo.nombre_archivo ?? "documento"));
        const clave = `proyectos/${p.proyectian_slug ?? p.slug}/${carpetaPorTipo[tipo] ?? "06-DOCUMENTOS-DE-TRABAJO"}/${nombre}`;
        await s3put({ ...d, bucket: "proyectian" }, clave, bytes, String(cuerpo.mime ?? "application/octet-stream"));
        const { data: doc } = await sb.from("documentos_nex").insert({ user_id: userId, proyecto_id: p.id, tipo, titulo: String(cuerpo.titulo ?? nombre), version: cuerpo.version ?? null, nombre_archivo: nombre, mime: cuerpo.mime ?? null, bytes: bytes.length, ruta_remota: clave, origen: "subido", ruta_mac: `NUEVOS DESARROLLOS/${p.nombre.toUpperCase()}/${carpetaPorTipo[tipo] ?? "06-DOCUMENTOS-DE-TRABAJO"}/${nombre}` }).select("id").single();
        try {
          const tipoP: Record<string, string> = { hoja_cambios: "notas_version", manual: "manual", comercial: "comercial", informe: "informe", video: "video", imagen: "imagen", otro: "otro" };
          await proyectianSql(`insert into public.documentos (user_id, proyecto_id, tipo, titulo, version, descripcion, fecha, ruta_mac, destino_id, ruta_remota, bytes)
            select p.user_id, p.id, ${sqlLit(tipoP[tipo] ?? "otro")}, ${sqlLit(String(cuerpo.titulo ?? nombre))}, ${sqlLit(cuerpo.version ?? null)}, 'Subido desde NexDeveloper', current_date, ${sqlLit(`NUEVOS DESARROLLOS/${p.nombre.toUpperCase()}/${carpetaPorTipo[tipo] ?? "06-DOCUMENTOS-DE-TRABAJO"}/${nombre}`)}, (select id from public.destinos_almacenamiento where tipo='s3' and activo order by usar_para_documentos desc limit 1), ${sqlLit(clave)}, ${bytes.length}
            from public.proyectos p where p.slug = ${sqlLit(p.proyectian_slug ?? p.slug)}`);
        } catch (e) { return json({ ok: true, id: doc?.id, ruta_remota: clave, aviso: `Guardado en el almacén, pero Proyectian no respondió: ${String(e?.message ?? e)}` }); }
        return json({ ok: true, id: doc?.id, ruta_remota: clave });
      }
      case "listar_documentos": {
        const { data: p } = await sb.from("proyectos").select("slug, proyectian_slug").eq("id", String(cuerpo.proyecto_id)).eq("user_id", userId!).maybeSingle();
        if (!p) return json({ ok: false, error: "Proyecto no encontrado" }, 404);
        let lista: any[] = [];
        try { lista = await proyectianSql(`select d.id, d.tipo, d.titulo, d.version, d.fecha, d.ruta_mac, d.ruta_remota, d.archivo_path, d.bytes, d.created_at from public.documentos d join public.proyectos p on p.id = d.proyecto_id where p.slug = ${sqlLit(p.proyectian_slug ?? p.slug)} order by d.fecha desc, d.created_at desc limit 300`, true); }
        catch (e) { return json({ ok: false, error: `Proyectian: ${String(e?.message ?? e)}` }); }
        return json({ ok: true, documentos: lista });
      }
      case "enlace_descarga": {
        const d = await destinoDocumentos(sb, userId!); if (!d) return json({ ok: false, error: "Sin destino de almacén" });
        const clave = String(cuerpo.ruta_remota ?? ""); if (!clave) return json({ ok: false, error: "Falta ruta_remota" }, 400);
        const nombre = clave.split("/").pop() ?? "documento";
        return json({ ok: true, url: await presignar({ ...d, bucket: String(cuerpo.bucket ?? "proyectian") }, clave, nombre, 3600, !!cuerpo.inline) });
      }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (e) { return json({ ok: false, error: String(e?.message ?? e) }, 500); }
});
