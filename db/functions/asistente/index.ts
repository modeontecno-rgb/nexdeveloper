// NexDeveloper · Edge Function «asistente» (0.24.0)
// Asistente de chat con contexto de TODA la cartera: resumen vivo de proyectos, tareas, órdenes, ejecuciones, salud,
// gasto de IA, dominios, copias y Proyectian; herramientas para consultar datos (solo lectura), leer Proyectian,
// y crear tareas, órdenes (opcionalmente ejecutadas por la IA) y avisos. Anthropic con herramientas nativas;
// OpenAI/Groq/Mistral/DeepSeek/xAI/OpenRouter con «function calling».
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_CUENTA = Deno.env.get("CUENTA_SUPABASE_TOKEN") ?? "";
const REF_PROYECTIAN = "hjtweberlereyfhagkvx";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const ahora = () => new Date().toISOString();

type Prov = { slug: string; clave: string; modelo: string; modelo_id: string | null; ce: number; cs: number; calidad: number };
async function proveedoresDisponibles(sb: SB, userId: string): Promise<Prov[]> {
  const { data: provs } = await sb.from("proveedores_ia").select("id, clave_slug, activo, clave_cifrada").eq("user_id", userId).eq("activo", true).not("clave_cifrada", "is", null).in("clave_slug", ["anthropic", "openai", "groq", "mistral", "deepseek", "xai", "openrouter"]);
  const out: Prov[] = [];
  for (const p of provs ?? []) {
    const { data: clave } = await sb.rpc("descifrar_clave_proveedor", { p_proveedor_id: p.id }); if (!clave) continue;
    const { data: modelos } = await sb.from("modelos_ia").select("id, identificador, calidad, coste_entrada, coste_salida").eq("proveedor_id", p.id).eq("activo", true).order("calidad", { ascending: false });
    const m = (modelos ?? []).find((x) => !/image|imagen|tts|whisper|embed/i.test(x.identificador)); if (!m) continue;
    out.push({ slug: p.clave_slug, clave: String(clave), modelo: m.identificador, modelo_id: m.id, ce: Number(m.coste_entrada ?? 0), cs: Number(m.coste_salida ?? 0), calidad: Number(m.calidad ?? 3) });
  }
  return out.sort((a, b) => (a.slug === "anthropic" ? -1 : b.slug === "anthropic" ? 1 : b.calidad - a.calidad));
}
const coste = (p: Prov, te: number, ts: number) => Number(((te * p.ce + ts * p.cs) / 1_000_000).toFixed(4));

// ---------- Contexto de la cartera ----------
async function contextoCartera(sb: SB, userId: string) {
  const [{ data: proyectos }, { data: tareas }, { data: ordenes }, { data: ejec }, { data: salud }, { data: gasto }, { data: dominios }, { data: copias }, { data: pres }] = await Promise.all([
    sb.from("proyectos").select("id, slug, nombre, estado, prioridad, version_actual, semaforo_salud, supabase_ref, repositorio, espacio_trabajo_url, descripcion").eq("user_id", userId).order("nombre"),
    sb.from("tareas").select("id, proyecto_id, titulo, estado, prioridad, requiere_atencion, motivo_atencion, creado_el").eq("user_id", userId).in("estado", ["pendiente", "en_cola", "ejecutando", "esperando_revision", "bloqueada"]).order("creado_el", { ascending: false }).limit(120),
    sb.from("ordenes").select("id, proyecto_id, texto, estado, prioridad, requiere_aprobacion, creado_el").eq("user_id", userId).in("estado", ["borrador", "pendiente_aprobacion", "aprobada", "en_cola", "ejecutando"]).order("creado_el", { ascending: false }).limit(40),
    sb.from("ejecuciones_orden").select("id, proyecto_id, estado, motor, resumen, pr_url, publicado_url, creado_el").eq("user_id", userId).order("creado_el", { ascending: false }).limit(15),
    sb.from("salud_informes").select("resumen, terminado_el").eq("user_id", userId).eq("estado", "terminado").order("iniciado_el", { ascending: false }).limit(1),
    sb.from("consumos_ia").select("proyecto_id, coste").eq("user_id", userId).gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    sb.from("dominios").select("dominio, proyecto_id, cert_dias, dominio_dias, resultado").eq("user_id", userId).eq("activo", true).order("cert_dias").limit(40),
    sb.from("copias").select("tipo, nombre, estado, terminada_el, bytes").eq("user_id", userId).order("terminada_el", { ascending: false }).limit(10),
    sb.from("presupuestos_ia").select("ambito, referencia, limite_mensual, bloqueado").eq("user_id", userId).eq("activo", true),
  ]);
  const nombre = (id: string | null) => (proyectos ?? []).find((p) => p.id === id)?.nombre ?? "(sin proyecto)";
  const gastoPorProyecto: Record<string, number> = {}; let gastoTotal = 0;
  for (const g of gasto ?? []) { const k = nombre(g.proyecto_id); gastoPorProyecto[k] = (gastoPorProyecto[k] ?? 0) + Number(g.coste ?? 0); gastoTotal += Number(g.coste ?? 0); }
  const lineas: string[] = [];
  lineas.push(`FECHA Y HORA: ${new Intl.DateTimeFormat("es-ES", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date())}`);
  lineas.push(`PROYECTOS (${(proyectos ?? []).length}):`);
  for (const p of proyectos ?? []) lineas.push(`- ${p.nombre} [${p.slug}] · estado ${p.estado} · prioridad ${p.prioridad} · versión ${p.version_actual ?? "?"} · salud ${p.semaforo_salud ?? "sin datos"} · supabase ${p.supabase_ref ?? "-"} · repo ${p.repositorio ?? "-"} · ${(p.descripcion ?? "").slice(0, 90)}`);
  lineas.push(`TAREAS ABIERTAS (${(tareas ?? []).length}); requieren tu atención: ${(tareas ?? []).filter((t) => t.requiere_atencion).length}`);
  for (const t of (tareas ?? []).slice(0, 60)) lineas.push(`- [${t.estado}${t.requiere_atencion ? " · ATENCIÓN" : ""}] ${nombre(t.proyecto_id)}: ${t.titulo} (${t.prioridad}, ${t.creado_el.slice(0, 10)})`);
  lineas.push(`ÓRDENES ACTIVAS (${(ordenes ?? []).length}):`);
  for (const o of ordenes ?? []) lineas.push(`- [${o.estado}] ${nombre(o.proyecto_id)}: ${(o.texto ?? "").slice(0, 100)}`);
  lineas.push(`ÚLTIMAS EJECUCIONES DE LA IA:`);
  for (const e of ejec ?? []) lineas.push(`- ${e.creado_el.slice(0, 16)} ${nombre(e.proyecto_id)} · ${e.motor} · ${e.estado}${e.publicado_url ? ` · publicado ${e.publicado_url}` : ""}${e.pr_url ? ` · PR ${e.pr_url}` : ""} · ${(e.resumen ?? "").slice(0, 100)}`);
  if (salud?.[0]) lineas.push(`SALUD (último informe ${salud[0].terminado_el?.slice(0, 16)}): ${salud[0].resumen}`);
  lineas.push(`GASTO DE IA ESTE MES: ${gastoTotal.toFixed(2)} € · por proyecto: ${Object.entries(gastoPorProyecto).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${v.toFixed(2)} €`).join(", ") || "sin consumos"}`);
  if (pres?.length) lineas.push(`PRESUPUESTOS DE IA: ${pres.map((p) => `${p.referencia ?? p.ambito} ${p.limite_mensual} €${p.bloqueado ? " (BLOQUEADO)" : ""}`).join(", ")}`);
  lineas.push(`DOMINIOS (días hasta caducar certificado/dominio):`);
  for (const d of (dominios ?? []).slice(0, 25)) lineas.push(`- ${d.dominio} (${nombre(d.proyecto_id)}): cert ${d.cert_dias ?? "?"} · dominio ${d.dominio_dias ?? "?"} · ${d.resultado ?? ""}`);
  lineas.push(`ÚLTIMAS COPIAS: ${(copias ?? []).map((c) => `${c.tipo} ${c.nombre} ${c.estado} ${c.terminada_el?.slice(0, 10)}`).join("; ") || "ninguna"}`);
  return lineas.join("\n");
}

// ---------- Herramientas ----------
const HERRAMIENTAS = [
  { name: "consultar_datos", description: "Ejecuta una consulta SQL de SOLO LECTURA (SELECT) sobre la base de datos de NexDeveloper para responder con precisión. Tablas útiles: proyectos, tareas, ordenes, ejecuciones_orden, consumos_ia(coste, created_at, proyecto_id, modelo_id), gasto_ia_diario, presupuestos_ia, salud_proyectos, salud_informes, dominios, copias, compilaciones, documentos_nex, cierres_version, mesas, habilidades, expertos, bandeja_entradas, resumenes, vigilancia_hallazgos, competidores, mensajes, chats, actividad. Filtra siempre por user_id = '{USER}'. Máximo 200 filas.", input_schema: { type: "object", properties: { sql: { type: "string" }, motivo: { type: "string", description: "Qué buscas, en una frase" } }, required: ["sql"] } },
  { name: "consultar_proyectian", description: "Consulta de SOLO LECTURA (SELECT) en Proyectian, el gestor de cartera de Javier. Tablas: proyectos(slug, nombre, estado, url_produccion…), versiones(proyecto_id, numero, fecha, titulo, notas), cambios(version_id, titulo, descripcion, tipo, fecha), documentos(proyecto_id, nombre, tipo, ruta, creado_el), usuarios_proyecto, clientes.", input_schema: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] } },
  { name: "crear_tarea", description: "Crea una tarea en un proyecto. Usa requiere_atencion=true solo si Javier tiene que hacer algo personalmente.", input_schema: { type: "object", properties: { proyecto_slug: { type: "string" }, titulo: { type: "string" }, descripcion: { type: "string" }, prioridad: { type: "string", enum: ["baja", "media", "alta", "critica"] }, requiere_atencion: { type: "boolean" }, instrucciones: { type: "string" } }, required: ["proyecto_slug", "titulo"] } },
  { name: "crear_orden", description: "Crea una orden de trabajo para la IA en un proyecto (queda aprobada; si ejecutar=true se manda a ejecutar ahora con el motor disponible: Lovable o Claude+GitHub).", input_schema: { type: "object", properties: { proyecto_slug: { type: "string" }, texto: { type: "string" }, prioridad: { type: "string", enum: ["baja", "media", "alta", "critica"] }, ejecutar: { type: "boolean" } }, required: ["proyecto_slug", "texto"] } },
  { name: "crear_aviso", description: "Envía un aviso push a los dispositivos de Javier (recordatorio, alerta).", input_schema: { type: "object", properties: { titulo: { type: "string" }, cuerpo: { type: "string" }, url: { type: "string" } }, required: ["titulo"] } },
];
async function ejecutarHerramienta(sb: SB, userId: string, nombre: string, a: any, acciones: any[]) {
  if (nombre === "consultar_datos") {
    const { data, error } = await sb.rpc("asistente_consulta", { p_user: userId, p_sql: String(a.sql ?? "").replace(/\{USER\}/g, userId) });
    if (error) return `ERROR: ${error.message}`;
    const t = JSON.stringify(data); return t.length > 12000 ? t.slice(0, 12000) + "…(recortado)" : t;
  }
  if (nombre === "consultar_proyectian") {
    if (!TOKEN_CUENTA) return "ERROR: falta CUENTA_SUPABASE_TOKEN";
    const sql = String(a.sql ?? ""); if (!/^\s*(select|with)\b/i.test(sql) || /;/.test(sql.trim().replace(/;\s*$/, ""))) return "ERROR: solo SELECT";
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF_PROYECTIAN}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN_CUENTA}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: `select * from (${sql.replace(/;\s*$/, "")}) t limit 200`, read_only: true }) });
    const t = await r.text(); if (!r.ok) return `ERROR Proyectian ${r.status}: ${t.slice(0, 300)}`;
    return t.length > 12000 ? t.slice(0, 12000) + "…(recortado)" : t;
  }
  if (nombre === "crear_tarea" || nombre === "crear_orden") {
    const { data: p } = await sb.from("proyectos").select("id, nombre").eq("user_id", userId).eq("slug", String(a.proyecto_slug)).maybeSingle();
    if (!p) return `ERROR: no existe el proyecto ${a.proyecto_slug}`;
    if (nombre === "crear_tarea") {
      const { data: t, error } = await sb.from("tareas").insert({ user_id: userId, proyecto_id: p.id, titulo: String(a.titulo).slice(0, 200), descripcion: a.descripcion ?? null, prioridad: a.prioridad ?? "media", estado: "pendiente", requiere_atencion: !!a.requiere_atencion, instrucciones: a.instrucciones ?? null, motivo_atencion: a.requiere_atencion ? "Pedido desde el asistente" : null }).select("id").single();
      if (error) return `ERROR: ${error.message}`;
      acciones.push({ tipo: "tarea", id: t!.id, titulo: a.titulo, url: `/tareas?tarea=${t!.id}` }); return `Tarea creada en ${p.nombre} (id ${t!.id})`;
    }
    const { data: o, error } = await sb.from("ordenes").insert({ user_id: userId, proyecto_id: p.id, texto: String(a.texto), modo: "equilibrado", prioridad: a.prioridad ?? "media", estado: "aprobada", ejecutar_con: a.ejecutar === false ? "manual" : "lovable", requiere_atencion: false, comentario: "Creada desde el asistente" }).select("id").single();
    if (error) return `ERROR: ${error.message}`;
    acciones.push({ tipo: "orden", id: o!.id, titulo: String(a.texto).slice(0, 80), url: `/ordenes?orden=${o!.id}` });
    return `Orden creada en ${p.nombre} (id ${o!.id})${a.ejecutar === false ? "" : "; el lanzador la ejecutará en los próximos 2 minutos si hay motor disponible (Lovable conectado o clave de Anthropic + repositorio)"}`;
  }
  if (nombre === "crear_aviso") {
    await sb.rpc("crear_aviso", { p_user: userId, p_tipo: "otro", p_titulo: String(a.titulo).slice(0, 120), p_cuerpo: a.cuerpo ?? "", p_url: a.url ?? "/avisos", p_proyecto: null, p_referencia: null });
    acciones.push({ tipo: "aviso", titulo: a.titulo, url: "/avisos" }); return "Aviso enviado";
  }
  return `Herramienta desconocida ${nombre}`;
}

// ---------- Proveedores con herramientas ----------
type Turno = { role: string; content: any };
async function anthropicConHerramientas(p: Prov, sistema: string, mensajes: Turno[], sb: SB, userId: string, acciones: any[], usadas: any[]) {
  let te = 0, ts = 0; const msgs = [...mensajes];
  for (let paso = 0; paso < 8; paso++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": p.clave, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: p.modelo, max_tokens: 3000, system: sistema, tools: HERRAMIENTAS, messages: msgs }) });
    const j = await r.json(); if (!r.ok) throw new Error(`Anthropic ${r.status}: ${String(j?.error?.message ?? "").slice(0, 200)}`);
    te += j.usage?.input_tokens ?? 0; ts += j.usage?.output_tokens ?? 0;
    const usos = (j.content ?? []).filter((b: any) => b.type === "tool_use");
    if (!usos.length || j.stop_reason !== "tool_use") return { texto: (j.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim(), te, ts };
    msgs.push({ role: "assistant", content: j.content });
    const res: any[] = [];
    for (const u of usos) { const out = await ejecutarHerramienta(sb, userId, u.name, u.input ?? {}, acciones); usadas.push({ nombre: u.name, entrada: u.input, salida_resumen: String(out).slice(0, 300) }); res.push({ type: "tool_result", tool_use_id: u.id, content: String(out) }); }
    msgs.push({ role: "user", content: res });
  }
  return { texto: "He agotado los pasos de herramientas sin poder concluir. Pregúntame de forma más concreta.", te, ts };
}
async function openaiConHerramientas(p: Prov, sistema: string, mensajes: Turno[], sb: SB, userId: string, acciones: any[], usadas: any[]) {
  const bases: Record<string, string> = { openai: "https://api.openai.com/v1", groq: "https://api.groq.com/openai/v1", mistral: "https://api.mistral.ai/v1", deepseek: "https://api.deepseek.com/v1", xai: "https://api.x.ai/v1", openrouter: "https://openrouter.ai/api/v1" };
  const tools = HERRAMIENTAS.map((h) => ({ type: "function", function: { name: h.name, description: h.description, parameters: h.input_schema } }));
  let te = 0, ts = 0; const msgs: any[] = [{ role: "system", content: sistema }, ...mensajes.map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }))];
  for (let paso = 0; paso < 8; paso++) {
    const r = await fetch(`${bases[p.slug]}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${p.clave}`, "content-type": "application/json" }, body: JSON.stringify({ model: p.modelo, max_tokens: 3000, temperature: 0.2, tools, messages: msgs }) });
    const j = await r.json(); if (!r.ok) throw new Error(`${p.slug} ${r.status}: ${String(j?.error?.message ?? "").slice(0, 200)}`);
    te += j.usage?.prompt_tokens ?? 0; ts += j.usage?.completion_tokens ?? 0;
    const m = j.choices?.[0]?.message ?? {}; const calls = m.tool_calls ?? [];
    if (!calls.length) return { texto: String(m.content ?? "").trim(), te, ts };
    msgs.push(m);
    for (const c of calls) { let args: any = {}; try { args = JSON.parse(c.function?.arguments ?? "{}"); } catch { args = {}; } const out = await ejecutarHerramienta(sb, userId, c.function?.name, args, acciones); usadas.push({ nombre: c.function?.name, entrada: args, salida_resumen: String(out).slice(0, 300) }); msgs.push({ role: "tool", tool_call_id: c.id, content: String(out) }); }
  }
  return { texto: "He agotado los pasos de herramientas sin poder concluir.", te, ts };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = servicio();
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) return json({ ok: false, error: "No autorizado" }, 401);
    const userId = u.user.id;
    const cuerpo = await req.json().catch(() => ({}));
    const accion = String(cuerpo.accion ?? "estado");
    if (accion === "estado") {
      const provs = await proveedoresDisponibles(sb, userId);
      return json({ ok: true, proveedores: provs.map((p) => ({ slug: p.slug, modelo: p.modelo })), listo: provs.length > 0, proyectian: !!TOKEN_CUENTA });
    }
    if (accion === "nueva") {
      const { data } = await sb.from("asistente_conversaciones").insert({ user_id: userId, proyecto_id: cuerpo.proyecto_id ?? null, titulo: cuerpo.titulo ?? "Nueva conversación" }).select("*").single();
      return json({ ok: true, conversacion: data });
    }
    if (accion === "preguntar") {
      const texto = String(cuerpo.texto ?? "").trim(); if (!texto) return json({ ok: false, error: "Escribe una pregunta" });
      const provs = await proveedoresDisponibles(sb, userId);
      const p = provs.find((x) => x.slug === cuerpo.proveedor) ?? provs[0];
      if (!p) return json({ ok: false, error: "No hay ningún proveedor de IA con clave (Anthropic recomendado). Ponla en Ajustes → Proveedores." });
      const { data: permitido } = await sb.rpc("gasto_ia_permitido", { p_user_id: userId, p_proveedor: null, p_proyecto_id: cuerpo.proyecto_id ?? null });
      if (permitido === false) return json({ ok: false, error: "Presupuesto de IA superado con acción «bloquear»." });
      let convId = cuerpo.conversacion_id as string | undefined;
      if (!convId) { const { data } = await sb.from("asistente_conversaciones").insert({ user_id: userId, proyecto_id: cuerpo.proyecto_id ?? null, titulo: texto.slice(0, 60) }).select("id").single(); convId = data!.id; }
      await sb.from("asistente_mensajes").insert({ conversacion_id: convId, user_id: userId, rol: "usuario", texto });
      const { data: historial } = await sb.from("asistente_mensajes").select("rol, texto").eq("conversacion_id", convId).order("creado_el").limit(30);
      const contexto = await contextoCartera(sb, userId);
      let proyectoFoco = "";
      if (cuerpo.proyecto_id) { const { data: pf } = await sb.from("proyectos").select("nombre, slug, descripcion, objetivo, tecnologias").eq("id", cuerpo.proyecto_id).maybeSingle(); if (pf) proyectoFoco = `\nPROYECTO EN FOCO: ${pf.nombre} [${pf.slug}] · ${pf.descripcion ?? ""} · objetivo: ${pf.objetivo ?? ""} · tecnologías: ${pf.tecnologias ?? ""}`; }
      const sistema = `Eres el asistente de NexDeveloper, el centro de control con el que Javier (Soluciones EvoluteIA S.L. / Modeontecno S.L.) gestiona más de veinte proyectos de software con ayuda de la IA. Hablas SIEMPRE en español de España, con claridad y sin tecnicismos innecesarios; respuestas breves y accionables, con cifras exactas cuando las tengas (usa las herramientas para comprobar en vez de suponer). Cuando Javier pida hacer algo (crear una tarea, una orden, un aviso), hazlo con la herramienta y confirma qué has creado. Nunca inventes datos: si no lo sabes, consúltalo o dilo. Formato: Markdown ligero (listas cortas, negritas para lo importante). El identificador de usuario para las consultas es ${userId}.\n\nCONTEXTO ACTUAL DE LA CARTERA (resumen; consulta los datos completos con las herramientas si hace falta):\n${contexto}${proyectoFoco}`;
      const mensajes: Turno[] = (historial ?? []).map((m) => ({ role: m.rol === "usuario" ? "user" : "assistant", content: m.texto }));
      if (mensajes.length && mensajes[mensajes.length - 1].role !== "user") mensajes.push({ role: "user", content: texto });
      const acciones: any[] = []; const usadas: any[] = []; const t0 = Date.now();
      let r: { texto: string; te: number; ts: number };
      try { r = p.slug === "anthropic" ? await anthropicConHerramientas(p, sistema, mensajes, sb, userId, acciones, usadas) : await openaiConHerramientas(p, sistema, mensajes, sb, userId, acciones, usadas); }
      catch (e) { const msg = String(e?.message ?? e); await sb.from("asistente_mensajes").insert({ conversacion_id: convId, user_id: userId, rol: "asistente", texto: `No he podido responder: ${msg}`, error: msg, proveedor: p.slug, modelo: p.modelo }); return json({ ok: false, error: msg, conversacion_id: convId }); }
      const c = coste(p, r.te, r.ts);
      const { data: m } = await sb.from("asistente_mensajes").insert({ conversacion_id: convId, user_id: userId, rol: "asistente", texto: r.texto || "(sin respuesta)", herramientas: usadas, acciones, proveedor: p.slug, modelo: p.modelo, tokens_entrada: r.te, tokens_salida: r.ts, coste: c, duracion_ms: Date.now() - t0 }).select("*").single();
      await sb.rpc("incrementar_conversacion", { p_id: convId, p_te: r.te, p_ts: r.ts, p_coste: c }).then(() => {}, () => {});
      if (p.modelo_id) await sb.from("consumos_ia").insert({ user_id: userId, proyecto_id: cuerpo.proyecto_id ?? null, modelo_id: p.modelo_id, tokens_entrada: r.te, tokens_salida: r.ts, coste: c, duracion_ms: Date.now() - t0, resultado: "ok" }).then(() => {}, () => {});
      return json({ ok: true, conversacion_id: convId, mensaje: m, acciones });
    }
    if (accion === "borrar") { await sb.from("asistente_conversaciones").delete().eq("id", String(cuerpo.conversacion_id)).eq("user_id", userId); return json({ ok: true }); }
    if (accion === "renombrar") { await sb.from("asistente_conversaciones").update({ titulo: String(cuerpo.titulo ?? "").slice(0, 80), fijada: cuerpo.fijada ?? undefined }).eq("id", String(cuerpo.conversacion_id)).eq("user_id", userId); return json({ ok: true }); }
    return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
  } catch (err) { return json({ ok: false, error: String(err?.message ?? err) }, 500); }
});
