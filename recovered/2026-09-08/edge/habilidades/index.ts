// NexDeveloper · Edge Function «habilidades» (0.17.0)
// Catálogo de habilidades: sincroniza el repositorio de habilidades propias (y expertos), barre GitHub en busca de habilidades externas
// (repositorio separado «habilidades-externas»), permite guardar habilidades nuevas (BD + GitHub) e invocarlas desde cualquier proyecto.
// Acciones: crear_repos · sincronizar · barrer · programado (x-cron-token) · guardar · invocar · adoptar · sin acción → estado
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_GITHUB = Deno.env.get("GITHUB_TOKEN") ?? "";
const API = "https://api.github.com";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const cab = () => ({ Authorization: `Bearer ${TOKEN_GITHUB}`, Accept: "application/vnd.github+json", "User-Agent": "NexDeveloper", "Content-Type": "application/json" });
const gh = (ruta: string, init?: RequestInit) => fetch(`${API}${ruta}`, { ...init, headers: { ...cab(), ...(init?.headers ?? {}) } });
const b64dec = (s: string) => new TextDecoder().decode(Uint8Array.from(atob((s ?? "").replace(/\n/g, "")), (c) => c.charCodeAt(0)));
const b64enc = (t: string) => btoa(unescape(encodeURIComponent(t)));
const limpiar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

function frontmatter(md: string) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---/);
  const out: Record<string, string> = {};
  if (m) {
    const lineas = m[1].split("\n"); let clave = ""; let acum: string[] = [];
    const cerrar = () => { if (clave) out[clave] = acum.join(" ").replace(/\s+/g, " ").trim().replace(/^["']|["']$/g, ""); };
    for (const l of lineas) {
      const k = l.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (k) { cerrar(); clave = k[1]; acum = [k[2].replace(/^>-?\s*$/, "")]; }
      else if (clave) acum.push(l.trim());
    }
    cerrar();
  }
  const cuerpo = m ? md.slice(m[0].length).trim() : md;
  return { meta: out, cuerpo };
}
function categoriaDe(slug: string, desc: string) {
  const t = `${slug} ${desc}`.toLowerCase();
  if (/dise|pantalla|ux|sidebar|navegaci|kpi|tema|afilia|canvas/.test(t)) return "diseno";
  if (/supabase|backend|rls|edge|base de datos|arquitect.*db|sql/.test(t)) return "backend";
  if (/docx|pptx|xlsx|pdf|documento|manual|plantilla|informe|catalogo|impresi/.test(t)) return "documentos";
  if (/comercial|demo|competencia|marketing|brand|precio|distribuidor/.test(t)) return "comercial";
  if (/test|qa|auditor|calidad|verificar|debug|seguridad|rgpd|tolerancia/.test(t)) return "calidad";
  if (/devops|deploy|apk|publicar|copias|backup|almacen|observab|pipeline|repositorio/.test(t)) return "devops";
  if (/prompt|ia\b|modelo|agente|experto|finops|llm/.test(t)) return "ia";
  if (/datos|tabla|maestr|import|export|restablecer|logs|listado|reporte/.test(t)) return "datos";
  if (/proyecto|proyectian|reunion|lean|team|plan|morning|memoria/.test(t)) return "gestion";
  return "otro";
}

async function asegurarRepo(nombre: string, descripcion: string) {
  const [dueno, repo] = nombre.split("/");
  const r = await gh(`/repos/${nombre}`);
  if (r.ok) return { creado: false };
  const c = await gh("/user/repos", { method: "POST", body: JSON.stringify({ name: repo, private: true, description: descripcion, auto_init: true }) });
  if (!c.ok && c.status !== 422) throw new Error(`No se pudo crear ${nombre}: ${(await c.text()).slice(0, 200)}`);
  return { creado: true, dueno };
}
async function subirArchivo(repo: string, ruta: string, contenido: string, mensaje: string) {
  const api = `/repos/${repo}/contents/${ruta}`;
  let sha: string | undefined; const actual = await gh(api); if (actual.ok) sha = (await actual.json()).sha;
  const r = await gh(api, { method: "PUT", body: JSON.stringify({ message: mensaje, content: b64enc(contenido), ...(sha ? { sha } : {}) }) });
  if (!r.ok) throw new Error(`No se pudo escribir ${ruta}: ${(await r.text()).slice(0, 200)}`);
}

async function sincronizar(sb: SB, userId: string, repo: string) {
  const r = await gh(`/repos/${repo}/git/trees/main?recursive=1`);
  if (!r.ok) throw new Error(`No se puede leer ${repo} (${r.status}). ¿Existe y tiene contenido?`);
  const tree = ((await r.json()).tree ?? []) as { path: string; type: string; sha: string; size?: number }[];
  const skills = tree.filter((t) => t.type === "blob" && /^(habilidades|expertos)\/[^/]+\/SKILL\.md$/.test(t.path));
  let n = 0; const vistos = new Set<string>();
  for (const s of skills) {
    const [carpeta, slug] = s.path.split("/");
    const origen = carpeta === "expertos" ? "experto" : "propia";
    vistos.add(`${origen}:${slug}`);
    const { data: ex } = await sb.from("habilidades").select("id, sha").eq("user_id", userId).eq("origen", origen).eq("slug", slug).maybeSingle();
    if (ex?.sha === s.sha) continue;
    const f = await gh(`/repos/${repo}/contents/${s.path}`); if (!f.ok) continue;
    const md = b64dec((await f.json()).content);
    const { meta, cuerpo } = frontmatter(md);
    const archivos = tree.filter((t) => t.type === "blob" && t.path.startsWith(`${carpeta}/${slug}/`) && t.path !== s.path).map((t) => ({ ruta: t.path.slice(`${carpeta}/${slug}/`.length), bytes: t.size ?? 0 }));
    const desc = meta.description ?? cuerpo.slice(0, 300);
    const fila = { user_id: userId, slug, nombre: meta.name ?? slug, origen, categoria: origen === "experto" ? "ia" : categoriaDe(slug, desc), descripcion: desc, cuando_usarla: desc, contenido_md: md, archivos, repositorio: repo, ruta_repo: `${carpeta}/${slug}`, etiquetas: [carpeta, categoriaDe(slug, desc)], estado: "activa", sha: s.sha, sincronizada_el: new Date().toISOString(), actualizado_el: new Date().toISOString() };
    await sb.from("habilidades").upsert(fila, { onConflict: "user_id,origen,slug" });
    n++;
  }
  await sb.from("habilidades_config").update({ ultima_sincronizacion: new Date().toISOString() }).eq("user_id", userId);
  return { total: skills.length, actualizadas: n };
}

async function barrer(sb: SB, userId: string, cfg: any) {
  const nuevas: unknown[] = [];
  const { data: existentes } = await sb.from("habilidades").select("url_origen").eq("user_id", userId).eq("origen", "externa");
  const conocidas = new Set((existentes ?? []).map((e) => e.url_origen));
  for (const tema of (cfg.temas_barrido ?? []).slice(0, 8)) {
    const r = await gh(`/search/code?q=${encodeURIComponent(`${tema} filename:SKILL.md`)}&per_page=15`);
    if (!r.ok) { continue; }
    const items = ((await r.json()).items ?? []) as any[];
    for (const it of items) {
      const repo = it.repository?.full_name; const path = it.path; if (!repo || !path) continue;
      if (repo.startsWith("modeontecno-rgb/")) continue;
      const url = `https://github.com/${repo}/blob/HEAD/${path}`;
      if (conocidas.has(url)) continue;
      const f = await gh(`/repos/${repo}/contents/${path}`); if (!f.ok) continue;
      const md = b64dec((await f.json()).content); if (md.length < 200) continue;
      const { meta, cuerpo } = frontmatter(md);
      const slug = limpiar(meta.name ?? path.split("/").slice(-2, -1)[0] ?? repo.split("/")[1]);
      const desc = meta.description ?? cuerpo.slice(0, 300);
      const meta_repo = await gh(`/repos/${repo}`); const estrellas = meta_repo.ok ? (await meta_repo.json()).stargazers_count ?? 0 : 0;
      const { error } = await sb.from("habilidades").upsert({ user_id: userId, slug: `${slug}-${limpiar(repo.split("/")[0]).slice(0, 12)}`, nombre: meta.name ?? slug, origen: "externa", categoria: categoriaDe(slug, desc), descripcion: desc, cuando_usarla: desc, contenido_md: md, url_origen: url, repositorio: cfg.repo_externas, etiquetas: [tema, `estrellas:${estrellas}`], estado: "candidata", sincronizada_el: new Date().toISOString() }, { onConflict: "user_id,origen,slug" });
      if (!error) { conocidas.add(url); nuevas.push({ repo, path, estrellas }); }
      if (nuevas.length >= 25) break;
    }
    if (nuevas.length >= 25) break;
  }
  if (nuevas.length && cfg.repo_externas) {
    try {
      await asegurarRepo(cfg.repo_externas, "Habilidades externas encontradas por NexDeveloper (separadas de las propias)");
      const { data: todas } = await sb.from("habilidades").select("slug, nombre, descripcion, url_origen, estado, etiquetas").eq("user_id", userId).eq("origen", "externa").order("nombre");
      const indice = ["# Habilidades externas", "", "Encontradas automáticamente por NexDeveloper. Estado: candidata (pendiente de revisar) o activa (adoptada).", "", "| Habilidad | Estado | Origen |", "|---|---|---|", ...(todas ?? []).map((h) => `| **${h.nombre}** — ${(h.descripcion ?? "").slice(0, 120).replace(/\|/g, "/")} | ${h.estado} | [ver](${h.url_origen}) |`)].join("\n");
      await subirArchivo(cfg.repo_externas, "README.md", indice, "Índice de habilidades externas (barrido NexDeveloper)");
    } catch (_) { /* sin bloquear */ }
  }
  await sb.from("habilidades_config").update({ ultimo_barrido: new Date().toISOString() }).eq("user_id", userId);
  if (nuevas.length) await sb.from("tareas").insert({ user_id: userId, proyecto_id: null, titulo: `Habilidades: ${nuevas.length} candidata(s) nueva(s) encontradas en la red`, descripcion: nuevas.map((n: any) => `• ${n.repo} (${n.estrellas} ⭐)`).join("\n"), estado: "pendiente", prioridad: "baja", requiere_atencion: true, motivo_atencion: "Revisar habilidades externas", instrucciones: "Habilidades → pestaña Externas → revisa cada candidata y pulsa Adoptar o Descartar." });
  return { nuevas: nuevas.length };
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
    if (!userId) { const { data: c } = await sb.from("habilidades_config").select("user_id").limit(1).maybeSingle(); userId = c?.user_id ?? null; }
    const { data: cfg } = await sb.from("habilidades_config").select("*").eq("user_id", userId ?? "").maybeSingle();
    if (!accion) {
      let repo_ok = false; if (TOKEN_GITHUB && cfg) { const r = await gh(`/repos/${cfg.repo_propias}`); repo_ok = r.ok; }
      return json({ ok: true, listo: true, github: !!TOKEN_GITHUB, repo_propias: cfg?.repo_propias, repo_externas: cfg?.repo_externas, repo_ok });
    }
    if (!TOKEN_GITHUB) return json({ ok: false, error: "Falta GITHUB_TOKEN en los secretos." });
    switch (accion) {
      case "crear_repos": {
        const a = await asegurarRepo(cfg.repo_propias, "Habilidades propias de Soluciones EvoluteIA (Claude skills) — sincronizadas con NexDeveloper");
        const b = await asegurarRepo(cfg.repo_externas, "Habilidades externas encontradas por NexDeveloper (separadas de las propias)");
        return json({ ok: true, propias: a, externas: b });
      }
      case "sincronizar": return json({ ok: true, ...(await sincronizar(sb, userId!, cfg.repo_propias)) });
      case "barrer": return json({ ok: true, ...(await barrer(sb, userId!, cfg)) });
      case "programado": {
        if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
        const { data: cfgs } = await sb.from("habilidades_config").select("*");
        const res: unknown[] = [];
        for (const c of cfgs ?? []) { try { const s = await sincronizar(sb, c.user_id, c.repo_propias); const b = c.barrido_activo ? await barrer(sb, c.user_id, c) : { nuevas: 0 }; res.push({ user_id: c.user_id, ...s, ...b }); } catch (e) { res.push({ user_id: c.user_id, error: String(e?.message ?? e) }); } }
        return json({ ok: true, resultados: res });
      }
      case "guardar": {
        const slug = limpiar(String(cuerpo.slug || cuerpo.nombre || "")); if (!slug) return json({ ok: false, error: "Falta el nombre" }, 400);
        const nombre = String(cuerpo.nombre ?? slug); const desc = String(cuerpo.descripcion ?? ""); const instrucciones = String(cuerpo.instrucciones ?? "");
        const md = `---\nname: ${slug}\ndescription: ${desc.replace(/\n/g, " ")}\n---\n\n# ${nombre}\n\n${instrucciones}\n`;
        await asegurarRepo(cfg.repo_propias, "Habilidades propias de Soluciones EvoluteIA (Claude skills) — sincronizadas con NexDeveloper");
        await subirArchivo(cfg.repo_propias, `habilidades/${slug}/SKILL.md`, md, `Habilidad ${slug} desde NexDeveloper`);
        const { data: fila, error } = await sb.from("habilidades").upsert({ user_id: userId, slug, nombre, origen: "propia", categoria: cuerpo.categoria ?? categoriaDe(slug, desc), descripcion: desc, cuando_usarla: cuerpo.cuando_usarla ?? desc, contenido_md: md, muestra_url: cuerpo.muestra_url ?? null, muestra_texto: cuerpo.muestra_texto ?? null, repositorio: cfg.repo_propias, ruta_repo: `habilidades/${slug}`, etiquetas: cuerpo.etiquetas ?? [], estado: "activa", sincronizada_el: new Date().toISOString(), actualizado_el: new Date().toISOString() }, { onConflict: "user_id,origen,slug" }).select("*").single();
        if (error) return json({ ok: false, error: error.message }, 500);
        return json({ ok: true, habilidad: fila, aviso: "Guardada en NexDeveloper y en GitHub. Para tenerla también en Claude: pídele a Claude «crea esta habilidad» pegando el SKILL.md, o instala el repositorio como plugin." });
      }
      case "adoptar": {
        const { data: h } = await sb.from("habilidades").select("*").eq("id", String(cuerpo.habilidad_id)).eq("user_id", userId!).maybeSingle();
        if (!h) return json({ ok: false, error: "No encontrada" }, 404);
        const estado = cuerpo.descartar ? "archivada" : "activa";
        await sb.from("habilidades").update({ estado, actualizado_el: new Date().toISOString() }).eq("id", h.id);
        if (estado === "activa" && h.origen === "externa" && h.contenido_md) { try { await asegurarRepo(cfg.repo_externas, "Habilidades externas"); await subirArchivo(cfg.repo_externas, `habilidades/${h.slug}/SKILL.md`, `<!-- Origen: ${h.url_origen} -->\n${h.contenido_md}`, `Adoptada ${h.slug}`); } catch (_) { /* nada */ } }
        return json({ ok: true, estado });
      }
      case "invocar": {
        const { data: h } = await sb.from("habilidades").select("*").eq("id", String(cuerpo.habilidad_id)).eq("user_id", userId!).maybeSingle();
        if (!h) return json({ ok: false, error: "No encontrada" }, 404);
        const proyectoId = cuerpo.proyecto_id ?? null;
        const instr = String(cuerpo.instrucciones ?? "").trim();
        const titulo = `${h.nombre}${instr ? ": " + instr.slice(0, 80) : ""}`.slice(0, 200);
        const descripcion = `Aplicar la habilidad «${h.nombre}» (${h.origen}).\n${instr ? `Instrucciones: ${instr}\n` : ""}\nQué hace: ${(h.descripcion ?? "").slice(0, 600)}\n\nSKILL.md: https://github.com/${h.repositorio}/blob/main/${h.ruta_repo ?? ""}/SKILL.md${h.url_origen ? `\nOrigen: ${h.url_origen}` : ""}`;
        const { data: t, error } = await sb.from("tareas").insert({ user_id: userId, proyecto_id: proyectoId, titulo, descripcion, estado: "pendiente", prioridad: cuerpo.prioridad ?? "media", requiere_atencion: !!cuerpo.requiere_atencion, motivo_atencion: cuerpo.requiere_atencion ? "Habilidad que necesita tu decisión" : null }).select("id").single();
        if (error) return json({ ok: false, error: error.message }, 500);
        await sb.from("habilidades_usos").insert({ user_id: userId, habilidad_id: h.id, proyecto_id: proyectoId, tarea_id: t.id, instrucciones: instr });
        await sb.from("habilidades").update({ usos: (h.usos ?? 0) + 1, ultimo_uso: new Date().toISOString() }).eq("id", h.id);
        const prompt = `Aplica la habilidad «${h.nombre}» al proyecto${proyectoId ? " indicado" : ""}. ${instr}\n\n--- SKILL.md ---\n${h.contenido_md ?? ""}`;
        return json({ ok: true, tarea_id: t.id, prompt });
      }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (e) { return json({ ok: false, error: String(e?.message ?? e) }, 500); }
});
