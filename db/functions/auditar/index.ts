// NexDeveloper · Edge Function «auditar» (0.26.0)
// Auditoría mensual de calidad con el Auditor jefe: por cada proyecto reúne material real (estructura y archivos clave del
// repositorio, dependencias, rutas, resultado de salud, controles de calidad, errores) y pasa el auditor (accesibilidad,
// rendimiento, seguridad, textos, código, datos) con las instrucciones del experto «Auditor jefe y orquestador».
// Devuelve puntuación, semáforo, hallazgos con solución y abre tareas para que la IA lo arregle. Por tandas reanudable.
// 0.36.0: el selector de proveedor prueba primero Abacus (RouteLLM), incluido sin coste extra en la suscripción.
import { fetchIADeUsuario } from "../_shared/presupuesto.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_GITHUB = Deno.env.get("GITHUB_TOKEN") ?? "";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const ahora = () => new Date().toISOString();
const INICIO = Date.now();
const PRESUPUESTO_MS = 100_000;

async function gh(ruta: string) {
  const r = await fetch(`https://api.github.com${ruta}`, { headers: { Authorization: `Bearer ${TOKEN_GITHUB}`, Accept: "application/vnd.github+json", "User-Agent": "NexDeveloper" } });
  if (!r.ok) throw new Error(`GitHub ${r.status} ${ruta}`); return await r.json();
}
const b64utf8 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
async function leer(repo: string, ruta: string, rama: string, max = 6000) {
  try { const c = await gh(`/repos/${repo}/contents/${ruta.split("/").map(encodeURIComponent).join("/")}?ref=${rama}`); return b64utf8(String(c.content ?? "")).slice(0, max); } catch { return null; }
}
async function instruccionesAuditor(sb: SB, userId: string) {
  const { data: e } = await sb.from("expertos").select("slug, nombre, instrucciones").eq("user_id", userId).eq("slug", "auditor-jefe-orquestador").maybeSingle();
  let texto = e?.instrucciones ?? "";
  if (TOKEN_GITHUB) { const t = await leer("modeontecno-rgb/habilidades-propias", "expertos/auditor-jefe-orquestador/SKILL.md", "main", 9000); if (t) texto = t; }
  return texto || "Eres el Auditor jefe: revisas accesibilidad, rendimiento, seguridad, textos, calidad de código y datos con criterio profesional y priorizas por impacto.";
}
async function materialProyecto(sb: SB, p: any) {
  const m: any = { proyecto: { nombre: p.nombre, descripcion: p.descripcion, tecnologias: p.tecnologias, version: p.version_actual, url: p.espacio_trabajo_url }, archivos: {}, rutas: [], dependencias: null, salud: null, calidad: null };
  if (p.repositorio && TOKEN_GITHUB) {
    try {
      const info = await gh(`/repos/${p.repositorio}`); const rama = info.default_branch ?? "main";
      const arbol = await gh(`/repos/${p.repositorio}/git/trees/${rama}?recursive=1`);
      const paths: string[] = (arbol.tree ?? []).filter((n: any) => n.type === "blob").map((n: any) => n.path);
      m.rutas = paths.filter((x) => /^src\/(routes|pages)\//.test(x)).slice(0, 80);
      m.total_archivos = paths.length;
      m.estructura = [...new Set(paths.map((x) => x.split("/").slice(0, 2).join("/")))].slice(0, 60);
      const pkg = await leer(p.repositorio, "package.json", rama, 5000); if (pkg) { try { const j = JSON.parse(pkg); m.dependencias = { dependencies: Object.keys(j.dependencies ?? {}), devDependencies: Object.keys(j.devDependencies ?? {}).slice(0, 40), scripts: Object.keys(j.scripts ?? {}) }; } catch { m.dependencias = pkg.slice(0, 1500); } }
      const clave = ["src/routes/__root.tsx", "src/App.tsx", "src/main.tsx", "index.html", "src/index.css", "src/integrations/supabase/client.ts", "src/lib/supabase.ts", "supabase/config.toml", "vite.config.ts"].filter((x) => paths.includes(x));
      const muestra = paths.filter((x) => /^src\/(routes|pages|components)\/.*\.tsx$/.test(x)).sort((a, b) => a.length - b.length).slice(0, 6);
      for (const f of [...clave, ...muestra].slice(0, 12)) { const t = await leer(p.repositorio, f, rama, 3500); if (t) m.archivos[f] = t; }
      const sql = paths.filter((x) => /^supabase\/migrations\/.*\.sql$/.test(x)).slice(-2);
      for (const f of sql) { const t = await leer(p.repositorio, f, rama, 3000); if (t) m.archivos[f] = t; }
    } catch (e) { m.error_repo = String(e?.message ?? e).slice(0, 150); }
  }
  const { data: s } = await sb.from("salud_proyectos").select("semaforo, motivos, advisors, tablas_sin_rls_lista, errores_api_24h, errores_bd_24h, errores_funciones_24h, bd_mb, usuarios").eq("proyecto_id", p.id).order("comprobado_el", { ascending: false }).limit(1).maybeSingle();
  if (s) m.salud = { ...s, advisors: (s.advisors ?? []).slice(0, 15) };
  const { data: c } = await sb.from("ejecuciones_calidad").select("id, estado, resumen, terminada_el").eq("proyecto_id", p.id).order("creado_el", { ascending: false }).limit(1).maybeSingle();
  if (c) { const { data: rs } = await sb.from("resultados_calidad").select("control_codigo, resultado, detalle").eq("ejecucion_id", c.id); m.calidad = { ...c, resultados: rs ?? [] }; }
  return m;
}
async function proveedor(sb: SB, userId: string) {
  for (const slug of ["anthropic", "google", "openai", "groq"]) {
    const { data: prov } = await sb.from("proveedores_ia").select("id, clave_cifrada").eq("user_id", userId).eq("clave_slug", slug).maybeSingle();
    if (!prov?.clave_cifrada) continue;
    const { data: clave } = await sb.rpc("descifrar_clave_proveedor", { p_proveedor_id: prov.id }); if (!clave) continue;
    const { data: ms } = await sb.from("modelos_ia").select("id, identificador, coste_entrada, coste_salida").eq("proveedor_id", prov.id).eq("activo", true).order("calidad", { ascending: false }).limit(3);
    const mo = (ms ?? []).find((x) => !/image|tts|whisper|embed/i.test(x.identificador)) ?? null;
    return { slug, clave: String(clave), modelo: mo?.identificador ?? (slug === "abacus" ? "route-llm" : slug === "anthropic" ? "claude-sonnet-4-5" : slug === "google" ? "gemini-2.5-flash" : slug === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini"), modelo_id: mo?.id ?? null, ce: Number(mo?.coste_entrada ?? 3), cs: Number(mo?.coste_salida ?? 15) };
  }
  return null;
}
async function preguntar(sb: SB, userId: string, proyectoId: string | null, p: any, sistema: string, pregunta: string) {
  if (p.slug === "anthropic") { const r = await fetchIADeUsuario(sb, userId, proyectoId, "auditar", "https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": p.clave, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: p.modelo, max_tokens: 5000, system: sistema, messages: [{ role: "user", content: pregunta }] }) }); const j = await r.json(); if (!r.ok) throw new Error(`Anthropic ${r.status}: ${String(j?.error?.message ?? "").slice(0, 160)}`); return { coste: Number(j._nex_coste_eur), texto: (j.content ?? []).map((c: any) => c.text ?? "").join(""), te: j.usage?.input_tokens ?? 0, ts: j.usage?.output_tokens ?? 0 }; }
  if (p.slug === "google") { const r = await fetchIADeUsuario(sb, userId, proyectoId, "auditar", `https://generativelanguage.googleapis.com/v1beta/models/${p.modelo}:generateContent?key=${p.clave}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: "user", parts: [{ text: pregunta }] }], generationConfig: { maxOutputTokens: 5000, responseMimeType: "application/json" } }) }); const j = await r.json(); if (!r.ok) throw new Error(`Google ${r.status}`); return { coste: Number(j._nex_coste_eur), texto: (j.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text ?? "").join(""), te: j.usageMetadata?.promptTokenCount ?? 0, ts: j.usageMetadata?.candidatesTokenCount ?? 0 }; }
  const base = p.slug === "groq" ? "https://api.groq.com/openai/v1" : p.slug === "abacus" ? "https://routellm.abacus.ai/v1" : "https://api.openai.com/v1";
  const r = await fetchIADeUsuario(sb, userId, proyectoId, "auditar", `${base}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${p.clave}`, "content-type": "application/json" }, body: JSON.stringify({ model: p.modelo, max_tokens: 5000, temperature: 0.2, response_format: { type: "json_object" }, messages: [{ role: "system", content: sistema }, { role: "user", content: pregunta }] }) });
  const j = await r.json(); if (!r.ok) throw new Error(`${p.slug} ${r.status}`); return { coste: Number(j._nex_coste_eur), texto: j.choices?.[0]?.message?.content ?? "", te: j.usage?.prompt_tokens ?? 0, ts: j.usage?.completion_tokens ?? 0 };
}
const extraerJson = (t: string) => { const m = t.match(/```json\s*([\s\S]*?)```/) ?? t.match(/(\{[\s\S]*\})/); if (!m) return null; try { return JSON.parse(m[1]); } catch { return null; } };
async function config(sb: SB, userId: string) {
  const { data } = await sb.from("auditoria_config").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data;
  const { data: n } = await sb.from("auditoria_config").insert({ user_id: userId }).select("*").single(); return n!;
}

async function auditar(sb: SB, a: any) {
  const guardar = async (c: Record<string, unknown>) => sb.from("auditorias").update(c).eq("id", a.id);
  try {
    await guardar({ estado: "analizando", paso: "Reuniendo material del proyecto" });
    const { data: p } = await sb.from("proyectos").select("*").eq("id", a.proyecto_id).single();
    const cfg = await config(sb, a.user_id);
    const prov = await proveedor(sb, a.user_id); if (!prov) throw new Error("No hay proveedor de IA con clave (Anthropic recomendado).");
    const { data: permitido } = await sb.rpc("gasto_ia_permitido", { p_user_id: a.user_id, p_proveedor: null, p_proyecto_id: a.proyecto_id });
    if (permitido === false) throw new Error("Presupuesto de IA superado con acción «bloquear».");
    const material = await materialProyecto(sb, p);
    await guardar({ paso: "El Auditor jefe está revisando", material: { archivos: Object.keys(material.archivos), rutas: material.rutas.length, salud: material.salud?.semaforo ?? null, calidad: material.calidad?.estado ?? null } });
    const areas = Object.entries(cfg.areas ?? {}).filter(([, v]) => v).map(([k]) => k);
    const sistema = `${await instruccionesAuditor(sb, a.user_id)}\n\nAuditas para Javier (Soluciones EvoluteIA S.L.). Respondes SIEMPRE en español de España y SOLO con JSON válido. Sé concreto: cada hallazgo debe decir dónde está (archivo, pantalla o tabla) y cómo arreglarlo en 1-3 frases que un desarrollador o la IA puedan ejecutar. No inventes archivos que no aparezcan en el material.`;
    const pregunta = `PROYECTO: ${JSON.stringify(material.proyecto)}\nESTRUCTURA: ${JSON.stringify(material.estructura)}\nRUTAS: ${JSON.stringify(material.rutas)}\nDEPENDENCIAS: ${JSON.stringify(material.dependencias)}\nSALUD (Supabase): ${JSON.stringify(material.salud)}\nCONTROLES DE CALIDAD: ${JSON.stringify(material.calidad)}\nARCHIVOS CLAVE (recortados):\n${Object.entries(material.archivos).map(([f, t]) => `--- ${f}\n${t}`).join("\n").slice(0, 60000)}\n\nÁreas a auditar: ${areas.join(", ")}. Devuelve JSON: {"puntuacion": 0-100, "semaforo": "verde|ambar|rojo", "resumen": "3-4 frases para Javier", "puntuaciones": {${areas.map((x) => `"${x}": 0-100`).join(", ")}}, "hallazgos": [{"area": "${areas.join("|")}", "severidad": "critica|alta|media|baja", "titulo": "…", "detalle": "…", "donde": "archivo/pantalla/tabla", "solucion": "…"}]} (máximo ${cfg.max_hallazgos_por_proyecto ?? 12} hallazgos, ordenados por severidad).`;
    const r = await preguntar(sb, a.user_id, a.proyecto_id, prov, sistema, pregunta);
    const c = r.coste;

    const j = extraerJson(r.texto); if (!j) throw new Error("El auditor no devolvió un resultado válido");
    const hallazgos: any[] = (j.hallazgos ?? []).slice(0, Number(cfg.max_hallazgos_por_proyecto ?? 12));
    let tareas = 0;
    if (cfg.crear_tareas) {
      for (const h of hallazgos) {
        if (cfg.solo_criticas_y_altas && !["critica", "alta"].includes(h.severidad)) continue;
        const titulo = `Auditoría (${h.area}, ${h.severidad}): ${String(h.titulo).slice(0, 120)}`;
        const { data: ya } = await sb.from("tareas").select("id").eq("proyecto_id", a.proyecto_id).eq("titulo", titulo).in("estado", ["pendiente", "en_cola", "ejecutando", "esperando_revision", "bloqueada"]).limit(1);
        if (ya?.length) { h.tarea_id = ya[0].id; continue; }
        const { data: t } = await sb.from("tareas").insert({ user_id: a.user_id, proyecto_id: a.proyecto_id, titulo, descripcion: `${h.detalle}\n\nDónde: ${h.donde ?? "-"}\n\nSolución propuesta: ${h.solucion ?? "-"}`, estado: "pendiente", prioridad: h.severidad === "critica" ? "critica" : h.severidad === "alta" ? "alta" : h.severidad === "media" ? "media" : "baja", requiere_atencion: false }).select("id").single();
        if (t) { h.tarea_id = t.id; tareas++; }
      }
    }
    const sem = ["verde", "ambar", "rojo"].includes(j.semaforo) ? j.semaforo : Number(j.puntuacion) >= 80 ? "verde" : Number(j.puntuacion) >= 60 ? "ambar" : "rojo";
    await guardar({ estado: "terminada", paso: "Terminada", puntuacion: Math.max(0, Math.min(100, Number(j.puntuacion ?? 0))), semaforo: sem, resumen: j.resumen ?? null, puntuaciones: j.puntuaciones ?? null, hallazgos, tareas_creadas: tareas, tokens_entrada: r.te, tokens_salida: r.ts, coste: c, terminada_el: ahora() });
    await sb.from("proyectos").update({ puntuacion_auditoria: Math.max(0, Math.min(100, Number(j.puntuacion ?? 0))), auditoria_el: ahora() }).eq("id", a.proyecto_id);
    return true;
  } catch (e) { await guardar({ estado: "error", error: String(e?.message ?? e).slice(0, 500), terminada_el: ahora() }); return false; }
}
async function procesarLote(sb: SB, userId: string, lote: string) {
  let hechos = 0;
  while (Date.now() - INICIO < PRESUPUESTO_MS - 30_000) {
    const { data: a } = await sb.from("auditorias").select("*").eq("user_id", userId).eq("lote", lote).eq("estado", "pendiente").order("creado_el").limit(1).maybeSingle();
    if (!a) break;
    await auditar(sb, a); hechos++;
    if (Date.now() - INICIO > 40_000) break;
  }
  const { count } = await sb.from("auditorias").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("lote", lote).eq("estado", "pendiente");
  if ((count ?? 0) > 0) { await sb.rpc("lanzar_auditoria", { p_accion: "continuar_lote", p_id: null }).then(() => {}, () => {}); }
  else {
    const { data: filas } = await sb.from("auditorias").select("proyecto_id, puntuacion, semaforo, tareas_creadas, estado, proyectos(nombre)").eq("user_id", userId).eq("lote", lote);
    const rojos = (filas ?? []).filter((f) => f.semaforo === "rojo").map((f: any) => `${f.proyectos?.nombre} (${f.puntuacion})`);
    const tareas = (filas ?? []).reduce((s, f) => s + (f.tareas_creadas ?? 0), 0);
    await sb.rpc("crear_aviso", { p_user: userId, p_tipo: "otro", p_titulo: `Auditoría ${lote}: ${(filas ?? []).length} proyectos, ${tareas} tareas`, p_cuerpo: rojos.length ? `En rojo: ${rojos.join(", ")}` : "Ningún proyecto en rojo", p_url: "/auditoria", p_proyecto: null, p_referencia: `auditoria-${lote}` }).then(() => {}, () => {});
  }
  return { hechos, quedan: count ?? 0 };
}
async function crearLote(sb: SB, userId: string, origen: string, soloProyecto?: string) {
  const cfg = await config(sb, userId);
  const lote = soloProyecto ? `manual-${ahora().slice(0, 16).replace(/[:T]/g, "-")}` : ahora().slice(0, 7);
  let q = sb.from("proyectos").select("id").eq("user_id", userId).not("repositorio", "is", null);
  if (soloProyecto) q = q.eq("id", soloProyecto);
  const { data: ps } = await q;
  const excl = new Set<string>(cfg.proyectos_excluidos ?? []);
  const filas = (ps ?? []).filter((p) => soloProyecto || !excl.has(p.id)).map((p) => ({ user_id: userId, lote, proyecto_id: p.id, origen }));
  if (!soloProyecto) await sb.from("auditorias").delete().eq("user_id", userId).eq("lote", lote).eq("estado", "pendiente");
  if (filas.length) await sb.from("auditorias").insert(filas);
  return { lote, n: filas.length };
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
      case "programado": {
        if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
        const { data: cfgs } = await sb.from("auditoria_config").select("user_id, activa").eq("activa", true);
        const ids = (cfgs ?? []).map((c) => c.user_id);
        if (!ids.length) { const { data: ps } = await sb.from("proyectos").select("user_id").limit(1); if (ps?.[0]) ids.push(ps[0].user_id); }
        const res: unknown[] = [];
        for (const uid of ids) { const l = await crearLote(sb, uid, "programado"); res.push({ uid, ...l, ...(await procesarLote(sb, uid, l.lote)) }); }
        return json({ ok: true, resultados: res });
      }
      case "continuar_lote": {
        if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
        const { data: pend } = await sb.from("auditorias").select("user_id, lote").eq("estado", "pendiente").order("creado_el").limit(1).maybeSingle();
        if (!pend) return json({ ok: true, hechos: 0 });
        return json({ ok: true, ...(await procesarLote(sb, pend.user_id, pend.lote)) });
      }
      case "estado": {
        const cfg = await config(sb, userId!);
        const { data: ultimo } = await sb.from("auditorias").select("lote").eq("user_id", userId!).order("creado_el", { ascending: false }).limit(1).maybeSingle();
        const prov = await proveedor(sb, userId!);
        return json({ ok: true, config: cfg, ultimo_lote: ultimo?.lote ?? null, ia: prov ? `${prov.slug} · ${prov.modelo}` : null, github: !!TOKEN_GITHUB });
      }
      case "configurar": {
        const permitidos = ["activa", "dia_mes", "areas", "crear_tareas", "solo_criticas_y_altas", "max_hallazgos_por_proyecto", "proyectos_excluidos"];
        const cambios: Record<string, unknown> = { user_id: userId!, actualizado_el: ahora() };
        for (const k of permitidos) if (k in cuerpo) cambios[k] = cuerpo[k];
        const { data } = await sb.from("auditoria_config").upsert(cambios).select("*").single();
        return json({ ok: true, config: data });
      }
      case "auditar": {
        if (cuerpo.proyecto_id) {
          const l = await crearLote(sb, userId!, "manual", String(cuerpo.proyecto_id));
          const { data: a } = await sb.from("auditorias").select("*").eq("user_id", userId!).eq("lote", l.lote).eq("estado", "pendiente").limit(1).maybeSingle();
          if (!a) return json({ ok: false, error: "El proyecto no tiene repositorio" });
          await auditar(sb, a);
          const { data: fin } = await sb.from("auditorias").select("*").eq("id", a.id).single();
          return json({ ok: fin!.estado === "terminada", auditoria: fin, error: fin!.error });
        }
        const l = await crearLote(sb, userId!, "manual");
        const r = await procesarLote(sb, userId!, l.lote);
        return json({ ok: true, lote: l.lote, total: l.n, ...r });
      }
      case "reintentar": {
        const { data: a } = await sb.from("auditorias").select("*").eq("id", String(cuerpo.auditoria_id)).eq("user_id", userId!).maybeSingle();
        if (!a) return json({ ok: false, error: "Auditoría no encontrada" });
        await sb.from("auditorias").update({ estado: "pendiente", error: null }).eq("id", a.id);
        await auditar(sb, { ...a, estado: "pendiente" });
        const { data: fin } = await sb.from("auditorias").select("*").eq("id", a.id).single();
        return json({ ok: fin!.estado === "terminada", auditoria: fin });
      }
      case "crear_tarea": {
        const { data: a } = await sb.from("auditorias").select("*").eq("id", String(cuerpo.auditoria_id)).eq("user_id", userId!).maybeSingle();
        if (!a) return json({ ok: false, error: "Auditoría no encontrada" });
        const hs: any[] = a.hallazgos ?? []; const i = Number(cuerpo.indice); const h = hs[i]; if (!h) return json({ ok: false, error: "Hallazgo no encontrado" });
        const { data: t } = await sb.from("tareas").insert({ user_id: userId!, proyecto_id: a.proyecto_id, titulo: `Auditoría (${h.area}, ${h.severidad}): ${String(h.titulo).slice(0, 120)}`, descripcion: `${h.detalle}\n\nDónde: ${h.donde ?? "-"}\n\nSolución propuesta: ${h.solucion ?? "-"}`, estado: "pendiente", prioridad: h.severidad === "critica" ? "critica" : h.severidad === "alta" ? "alta" : "media", requiere_atencion: false }).select("id").single();
        hs[i] = { ...h, tarea_id: t?.id }; await sb.from("auditorias").update({ hallazgos: hs, tareas_creadas: (a.tareas_creadas ?? 0) + 1 }).eq("id", a.id);
        return json({ ok: true, tarea_id: t?.id });
      }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (err) { return json({ ok: false, error: String(err?.message ?? err) }, 500); }
});
