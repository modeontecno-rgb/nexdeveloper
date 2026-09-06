// NexDeveloper · Edge Function «vigilar» (0.11.0)
// Vigía de novedades (semanal) y radar de competencia (mensual) con búsqueda en internet.
// Usa el primer proveedor con clave que sepa buscar: Anthropic (web_search) → Google Gemini (google_search) → Perplexity.
// Acciones: ejecutar {proyecto_id, tipo:'novedades'|'competencia'} (usuario) · programado {tipo} (x-cron-token) · descubrir_competidores {proyecto_id}
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;

// ---------- Proveedor con búsqueda ----------
type Buscador = { proveedor: string; modelo: string; clave: string; modelo_id: string | null; coste_entrada: number; coste_salida: number };
async function elegirBuscador(sb: SB, userId: string): Promise<Buscador | null> {
  const orden: [string, string][] = [["anthropic", "claude-sonnet-4-5"], ["google", "gemini-2.5-flash"], ["perplexity", "sonar-pro"]];
  for (const [slug, modeloPorDefecto] of orden) {
    const { data: p } = await sb.from("proveedores_ia").select("id, activo, clave_cifrada").eq("user_id", userId).eq("clave_slug", slug).maybeSingle();
    if (!p?.clave_cifrada) continue;
    const { data: clave } = await sb.rpc("descifrar_clave_proveedor", { p_proveedor_id: p.id });
    if (!clave) continue;
    const { data: m } = await sb.from("modelos_ia").select("id, identificador, coste_entrada, coste_salida").eq("proveedor_id", p.id).eq("identificador", modeloPorDefecto).maybeSingle();
    return { proveedor: slug, modelo: modeloPorDefecto, clave: String(clave), modelo_id: m?.id ?? null, coste_entrada: Number(m?.coste_entrada ?? 0), coste_salida: Number(m?.coste_salida ?? 0) };
  }
  return null;
}

type Salida = { texto: string; tokens_entrada: number; tokens_salida: number; busquedas: number };
async function consultar(b: Buscador, sistema: string, pregunta: string): Promise<Salida> {
  if (b.proveedor === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": b.clave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: b.modelo, max_tokens: 6000, system: sistema, tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }], messages: [{ role: "user", content: pregunta }] }),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    const texto = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    return { texto, tokens_entrada: j.usage?.input_tokens ?? 0, tokens_salida: j.usage?.output_tokens ?? 0, busquedas: j.usage?.server_tool_use?.web_search_requests ?? 0 };
  }
  if (b.proveedor === "google") {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${b.modelo}:generateContent?key=${b.clave}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: "user", parts: [{ text: pregunta }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2, maxOutputTokens: 6000 } }),
    });
    if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    const texto = (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("\n");
    return { texto, tokens_entrada: j.usageMetadata?.promptTokenCount ?? 0, tokens_salida: j.usageMetadata?.candidatesTokenCount ?? 0, busquedas: (j.candidates?.[0]?.groundingMetadata?.webSearchQueries ?? []).length };
  }
  // Perplexity (compatible OpenAI)
  const r = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${b.clave}`, "content-type": "application/json" },
    body: JSON.stringify({ model: b.modelo, messages: [{ role: "system", content: sistema }, { role: "user", content: pregunta }], temperature: 0.2, max_tokens: 6000 }),
  });
  if (!r.ok) throw new Error(`Perplexity ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return { texto: j.choices?.[0]?.message?.content ?? "", tokens_entrada: j.usage?.prompt_tokens ?? 0, tokens_salida: j.usage?.completion_tokens ?? 0, busquedas: (j.citations ?? []).length };
}
function extraerJson(texto: string): any {
  const m = texto.match(/```json\s*([\s\S]*?)```/) ?? texto.match(/(\{[\s\S]*\})/);
  if (!m) throw new Error("La IA no devolvió JSON");
  return JSON.parse(m[1]);
}
const fechaHoy = () => new Date().toISOString().slice(0, 10);

// ---------- Prompts ----------
const SISTEMA = `Eres el vigía tecnológico de Soluciones EvoluteIA S.L., una empresa española que desarrolla aplicaciones de gestión (ERP, SaaS) con Lovable, Supabase, React, TypeScript y modelos de IA. Respondes SIEMPRE en español de España, con precisión y sin inventar: solo incluyes hechos que hayas verificado buscando en internet, con su URL. Si no hay nada relevante, devuelves listas vacías. Devuelves ÚNICAMENTE un bloque \`\`\`json con el formato pedido.`;

function preguntaNovedades(p: any, cfg: any) {
  const desde = cfg.ultima_novedades ? new Date(cfg.ultima_novedades).toISOString().slice(0, 10) : "hace 30 días";
  return `Proyecto: «${p.nombre}». ${p.descripcion ?? ""}
Tecnologías del proyecto: ${(cfg.tecnologias ?? []).join(", ") || "Lovable, Supabase, React, TypeScript"}${cfg.temas_extra?.length ? `. Temas extra: ${cfg.temas_extra.join(", ")}` : ""}.
Busca en internet las NOVEDADES publicadas desde ${desde} hasta hoy (${fechaHoy()}) que afecten a este proyecto: versiones nuevas o cambios importantes de esas tecnologías, avisos de seguridad, funciones nuevas útiles para el proyecto, cambios de precios o de condiciones, fin de soporte o retirada de versiones, y novedades de IA aplicables. Máximo 8 hallazgos, ordenados por relevancia.
Formato:
\`\`\`json
{"hallazgos":[{"titulo":"…","categoria":"version|seguridad|funcionalidad|precio|fin_de_soporte|ia|otro","resumen":"2-3 frases","por_que_afecta":"qué le afecta concretamente a este proyecto","accion_sugerida":"qué hacer (1 frase)","fuente_url":"https://…","fuente_nombre":"…","fecha_fuente":"AAAA-MM-DD","relevancia":"alta|media|baja"}],"resumen":"2 frases con lo más importante de la semana para este proyecto"}
\`\`\``;
}
function preguntaCompetencia(p: any, cfg: any, competidores: any[]) {
  const lista = competidores.map((c) => `- ${c.nombre}${c.url ? ` (${c.url})` : ""}${c.precio_desde ? ` · precio conocido: ${c.precio_desde}` : ""}`).join("\n");
  return `Proyecto: «${p.nombre}». ${p.descripcion ?? ""}${cfg.sector ? ` Sector: ${cfg.sector}.` : ""} Mercado principal: España.
${competidores.length ? `Competidores que ya seguimos:\n${lista}` : "Todavía no seguimos ningún competidor: descubre los 5-8 competidores directos más relevantes en España (y 1-2 internacionales si dominan el mercado)."}
Busca en internet y devuelve: (1) la ficha actualizada de cada competidor (precio desde, planes, puntos fuertes y débiles) y (2) los CAMBIOS del último mes: competidores nuevos, cambios de precio, funciones nuevas, noticias (rondas, adquisiciones, cierres). Máximo 8 cambios, ordenados por relevancia. Fecha de hoy: ${fechaHoy()}.
Formato:
\`\`\`json
{"competidores":[{"nombre":"…","url":"https://…","pais":"ES","descripcion":"1 frase","precio_desde":"29 €/mes o a medida","planes":[{"nombre":"…","precio":"…","periodo":"mes|año","notas":"…"}],"puntos_fuertes":["…"],"puntos_debiles":["…"],"ultimo_cambio":"qué ha cambiado este mes o null"}],
"cambios":[{"competidor":"nombre","titulo":"…","categoria":"nuevo_competidor|precio|funcionalidad|noticia","resumen":"2-3 frases","por_que_afecta":"…","accion_sugerida":"…","fuente_url":"https://…","fuente_nombre":"…","fecha_fuente":"AAAA-MM-DD","relevancia":"alta|media|baja"}],
"resumen":"2 frases sobre cómo está el mercado este mes frente a este proyecto"}
\`\`\``;
}

// ---------- Ejecutar un lote ----------
async function ejecutarLote(sb: SB, userId: string, proyectoId: string, tipo: "novedades" | "competencia", origen: "manual" | "programado") {
  const { data: p } = await sb.from("proyectos").select("id, nombre, descripcion, tecnologias").eq("id", proyectoId).eq("user_id", userId).maybeSingle();
  if (!p) throw new Error("Proyecto no encontrado");
  let { data: cfg } = await sb.from("vigilancia_config").select("*").eq("proyecto_id", proyectoId).maybeSingle();
  if (!cfg) { const { data: n } = await sb.from("vigilancia_config").insert({ proyecto_id: proyectoId, user_id: userId, tecnologias: (p.tecnologias ?? "").split(",").map((s: string) => s.trim()).filter(Boolean) }).select("*").single(); cfg = n; }
  const { data: lote } = await sb.from("vigilancia_lotes").insert({ user_id: userId, proyecto_id: proyectoId, tipo, origen }).select("*").single();
  try {
    const b = await elegirBuscador(sb, userId);
    if (!b) throw new Error("Ningún proveedor con búsqueda tiene clave (Anthropic, Google o Perplexity). Ponla en Ajustes → Proveedores de IA.");
    let n = 0; let resumen = ""; let salida: Salida;
    if (tipo === "novedades") {
      salida = await consultar(b, SISTEMA, preguntaNovedades(p, cfg));
      const j = extraerJson(salida.texto);
      resumen = j.resumen ?? "";
      for (const h of j.hallazgos ?? []) {
        // Evitar duplicados por URL
        if (h.fuente_url) { const { data: dup } = await sb.from("vigilancia_hallazgos").select("id").eq("proyecto_id", proyectoId).eq("fuente_url", h.fuente_url).limit(1); if (dup?.length) continue; }
        await sb.from("vigilancia_hallazgos").insert({ user_id: userId, proyecto_id: proyectoId, lote_id: lote.id, tipo: "novedad", categoria: h.categoria ?? "otro", titulo: String(h.titulo).slice(0, 200), resumen: h.resumen, por_que_afecta: h.por_que_afecta, accion_sugerida: h.accion_sugerida, fuente_url: h.fuente_url, fuente_nombre: h.fuente_nombre, fecha_fuente: /^\d{4}-\d{2}-\d{2}$/.test(h.fecha_fuente ?? "") ? h.fecha_fuente : null, relevancia: ["alta", "media", "baja"].includes(h.relevancia) ? h.relevancia : "media" });
        n++;
      }
      await sb.from("vigilancia_config").update({ ultima_novedades: new Date().toISOString() }).eq("proyecto_id", proyectoId);
    } else {
      const { data: comps } = await sb.from("competidores").select("*").eq("proyecto_id", proyectoId).eq("seguir", true);
      const conocidos = [...(comps ?? []), ...((cfg.competidores_conocidos ?? []) as string[]).filter((k) => !(comps ?? []).some((c) => c.nombre.toLowerCase() === k.toLowerCase())).map((k) => ({ nombre: k, url: null, precio_desde: null }))];
      salida = await consultar(b, SISTEMA, preguntaCompetencia(p, cfg, conocidos));
      const j = extraerJson(salida.texto);
      resumen = j.resumen ?? "";
      const ids: Record<string, string> = {};
      for (const c of j.competidores ?? []) {
        if (!c?.nombre) continue;
        const { data: fila } = await sb.from("competidores").upsert({ user_id: userId, proyecto_id: proyectoId, nombre: String(c.nombre).slice(0, 120), url: c.url ?? null, pais: c.pais ?? null, descripcion: c.descripcion ?? null, precio_desde: c.precio_desde ?? null, planes: Array.isArray(c.planes) ? c.planes : [], puntos_fuertes: Array.isArray(c.puntos_fuertes) ? c.puntos_fuertes : [], puntos_debiles: Array.isArray(c.puntos_debiles) ? c.puntos_debiles : [], ultima_revision: new Date().toISOString(), ultimo_cambio: c.ultimo_cambio ?? null, actualizado_el: new Date().toISOString() }, { onConflict: "proyecto_id,nombre" }).select("id, nombre").maybeSingle();
        if (fila) ids[fila.nombre.toLowerCase()] = fila.id;
      }
      for (const h of j.cambios ?? []) {
        if (h.fuente_url) { const { data: dup } = await sb.from("vigilancia_hallazgos").select("id").eq("proyecto_id", proyectoId).eq("fuente_url", h.fuente_url).limit(1); if (dup?.length) continue; }
        await sb.from("vigilancia_hallazgos").insert({ user_id: userId, proyecto_id: proyectoId, lote_id: lote.id, tipo: "competencia", categoria: h.categoria ?? "noticia", titulo: String(h.titulo).slice(0, 200), resumen: h.resumen, por_que_afecta: h.por_que_afecta, accion_sugerida: h.accion_sugerida, fuente_url: h.fuente_url, fuente_nombre: h.fuente_nombre, fecha_fuente: /^\d{4}-\d{2}-\d{2}$/.test(h.fecha_fuente ?? "") ? h.fecha_fuente : null, relevancia: ["alta", "media", "baja"].includes(h.relevancia) ? h.relevancia : "media", competidor_id: ids[String(h.competidor ?? "").toLowerCase()] ?? null });
        n++;
      }
      await sb.from("vigilancia_config").update({ ultima_competencia: new Date().toISOString() }).eq("proyecto_id", proyectoId);
    }
    const coste = (salida.tokens_entrada * b.coste_entrada + salida.tokens_salida * b.coste_salida) / 1_000_000;
    await sb.from("vigilancia_lotes").update({ estado: "ok", proveedor: b.proveedor, modelo: b.modelo, tokens_entrada: salida.tokens_entrada, tokens_salida: salida.tokens_salida, coste, busquedas: salida.busquedas, resumen, hallazgos: n, terminado_el: new Date().toISOString() }).eq("id", lote.id);
    if (b.modelo_id) await sb.from("consumos_ia").insert({ user_id: userId, proyecto_id: proyectoId, modelo_id: b.modelo_id, tokens_entrada: salida.tokens_entrada, tokens_salida: salida.tokens_salida, coste, resultado: "ok" });
    // Tarea «requiere atención» si hay hallazgos de relevancia alta
    const { data: altas } = await sb.from("vigilancia_hallazgos").select("titulo").eq("lote_id", lote.id).eq("relevancia", "alta");
    if (altas?.length) {
      const { data: t } = await sb.from("tareas").insert({ user_id: userId, proyecto_id: proyectoId, titulo: `${tipo === "novedades" ? "Novedades" : "Competencia"}: ${altas.length} hallazgo(s) importante(s) en ${p.nombre}`, descripcion: altas.map((a) => "• " + a.titulo).join("\n"), estado: "pendiente", prioridad: "media", requiere_atencion: true, motivo_atencion: "Revisar hallazgos de vigilancia", instrucciones: "Abre Vigilancia → proyecto, lee cada hallazgo y decide: convertir en tarea, marcar como visto o descartar." }).select("id").single();
      if (t) await sb.from("vigilancia_hallazgos").update({ tarea_id: t.id }).eq("lote_id", lote.id).eq("relevancia", "alta");
    }
    await sb.from("actividad").insert({ user_id: userId, proyecto_id: proyectoId, tipo: "vigilancia", texto: `${tipo === "novedades" ? "Vigía de novedades" : "Radar de competencia"}: ${n} hallazgo(s). ${resumen}`.slice(0, 500), referencia_tabla: "vigilancia_lotes", referencia_id: lote.id });
    return { lote_id: lote.id, hallazgos: n, resumen, proveedor: b.proveedor, modelo: b.modelo, coste };
  } catch (e) {
    await sb.from("vigilancia_lotes").update({ estado: "error", error: String(e?.message ?? e).slice(0, 500), terminado_el: new Date().toISOString() }).eq("id", lote.id);
    throw e;
  }
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
    if (!accion) { const b = userId ? await elegirBuscador(sb, userId) : null; return json({ ok: true, listo: true, buscador: b ? `${b.proveedor} · ${b.modelo}` : null }); }

    if (accion === "programado") {
      if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
      const tipo = cuerpo.tipo === "competencia" ? "competencia" : "novedades";
      const { data: cfgs } = await sb.from("vigilancia_config").select("proyecto_id, user_id").eq("activa", true).eq(tipo === "novedades" ? "novedades_activas" : "competencia_activa", true);
      const res: unknown[] = [];
      for (const c of cfgs ?? []) { try { res.push(await ejecutarLote(sb, c.user_id, c.proyecto_id, tipo, "programado")); } catch (e) { res.push({ proyecto_id: c.proyecto_id, error: String(e?.message ?? e) }); } }
      return json({ ok: true, ejecutados: res.length, resultados: res });
    }
    if (accion === "ejecutar") {
      const tipo = cuerpo.tipo === "competencia" ? "competencia" : "novedades";
      const r = await ejecutarLote(sb, userId!, String(cuerpo.proyecto_id), tipo, "manual");
      return json({ ok: true, ...r });
    }
    if (accion === "ejecutar_todos") {
      const tipo = cuerpo.tipo === "competencia" ? "competencia" : "novedades";
      const { data: cfgs } = await sb.from("vigilancia_config").select("proyecto_id").eq("user_id", userId!).eq("activa", true);
      const res: unknown[] = [];
      for (const c of cfgs ?? []) { try { res.push(await ejecutarLote(sb, userId!, c.proyecto_id, tipo, "manual")); } catch (e) { res.push({ proyecto_id: c.proyecto_id, error: String(e?.message ?? e) }); } }
      return json({ ok: true, resultados: res });
    }
    if (accion === "convertir_en_tarea") {
      const { data: h } = await sb.from("vigilancia_hallazgos").select("*").eq("id", String(cuerpo.hallazgo_id)).eq("user_id", userId!).maybeSingle();
      if (!h) return json({ ok: false, error: "Hallazgo no encontrado" }, 404);
      const { data: t } = await sb.from("tareas").insert({ user_id: userId, proyecto_id: h.proyecto_id, titulo: h.accion_sugerida ? `${h.titulo} → ${h.accion_sugerida}`.slice(0, 200) : h.titulo, descripcion: `${h.resumen ?? ""}\n\nPor qué afecta: ${h.por_que_afecta ?? ""}\nFuente: ${h.fuente_url ?? ""}`, estado: "pendiente", prioridad: h.relevancia === "alta" ? "alta" : "media", requiere_atencion: !!cuerpo.requiere_atencion, motivo_atencion: cuerpo.requiere_atencion ? "Hallazgo de vigilancia" : null }).select("id").single();
      await sb.from("vigilancia_hallazgos").update({ estado: "convertido", tarea_id: t?.id ?? null }).eq("id", h.id);
      return json({ ok: true, tarea_id: t?.id });
    }
    return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
  } catch (e) { return json({ ok: false, error: String(e?.message ?? e) }, 500); }
});
