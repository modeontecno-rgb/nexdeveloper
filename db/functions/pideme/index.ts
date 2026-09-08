// NexDeveloper · Edge Function «pideme» (0.37.2) — v5: propuestas a partir de transcripciones (extraer cambios, no tomar las aclaraciones como tarea), JSON recortado recuperable; v4: transcripción Plaud legible (segments), «personal» solo si es explícito, proyecto elegido al revisar se respeta
// «Pídeme qué quieres»: la tecla directa de Javier. Recibe texto (escrito, dictado o de una grabación del Plaud), lo CLASIFICA
// (¿de qué proyecto habla? ¿es personal? ¿es una consulta, una modificación o tareas?) y lo ENRUTA:
//  - proyecto + consulta  → chat nuevo en ese proyecto con título propio y respuesta con contexto del proyecto
//  - proyecto + modificación → PROPUESTA revisada por los expertos que tocan (programación, seguridad, legal/RGPD, comercial, fiscal,
//    UX, datos…) y por el Auditor jefe; solo al aprobarla se convierte en orden para la IA
//  - proyecto + tareas → tareas creadas en el proyecto
//  - personal (o sin proyecto) → conversación en el apartado PERSONAL (fusión de IAs)
// Plaud: conexión OAuth (PKCE, registro dinámico) con el servidor MCP de Plaud, importación de grabaciones (manual y cada 30 min)
// y procesado por el mismo clasificador. Nada personal se guarda en los proyectos ni en Proyectian.
// 0.36.1: la prueba de conexión con Plaud pedía list_files con page_size 5 y la API exige un mínimo de 10 → salía en rojo estando bien.
import { fetchIADeUsuario } from "../_shared/presupuesto.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const html = (t: string, s = 200) => new Response(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px;background:#0f1419;color:#e6edf3"><h2>NexDeveloper</h2><p>${t}</p><p><a style="color:#22d3c5" href="javascript:window.close()">Cerrar esta ventana</a></p></body>`, { status: s, headers: { "Content-Type": "text/html; charset=utf-8" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const ahora = () => new Date().toISOString();
const URL_FUNCION = `${URL_SUPABASE}/functions/v1/pideme`;
const URL_CALLBACK = `${URL_FUNCION}/callback`;
const PLAUD = { issuer: "https://mcp.plaud.ai/", authorize: "https://mcp.plaud.ai/authorize", token: "https://mcp.plaud.ai/token", register: "https://mcp.plaud.ai/register", mcp: "https://mcp.plaud.ai/mcp" };
// La API de Plaud exige page_size >= 10 en list_files.
const PLAUD_PAGE_MIN = 10;
const INICIO = Date.now();
const quedaTiempo = (ms = 95_000) => Date.now() - INICIO < ms;

// ---------- IA ----------
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
  return out.sort((a, b) => (a.slug === "anthropic" ? -1 : b.slug === "anthropic" ? 1 : b.calidad - a.calidad));
}
const coste = (p: Prov, te: number, ts: number) => Number(((te * p.ce + ts * p.cs) / 1_000_000).toFixed(4));
async function llamar(sb: SB, userId: string, proyectoId: string | null, p: Prov, sistema: string, pregunta: string, maxTokens = 2500, jsonMode = false) {
  if (p.slug === "anthropic") {
    const r = await fetchIADeUsuario(sb, userId, proyectoId, "pideme", "https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": p.clave, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: p.modelo, max_tokens: maxTokens, system: sistema, messages: [{ role: "user", content: pregunta }] }) });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 160)}`); const j = await r.json();
    return { coste: Number(j._nex_coste_eur), texto: (j.content ?? []).map((c: any) => c.text ?? "").join(""), te: j.usage?.input_tokens ?? 0, ts: j.usage?.output_tokens ?? 0 };
  }
  if (p.slug === "google") {
    const r = await fetchIADeUsuario(sb, userId, proyectoId, "pideme", `https://generativelanguage.googleapis.com/v1beta/models/${p.modelo}:generateContent?key=${p.clave}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: "user", parts: [{ text: pregunta }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2, ...(jsonMode ? { responseMimeType: "application/json" } : {}) } }) });
    if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 160)}`); const j = await r.json();
    return { coste: Number(j._nex_coste_eur), texto: (j.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text ?? "").join(""), te: j.usageMetadata?.promptTokenCount ?? 0, ts: j.usageMetadata?.candidatesTokenCount ?? 0 };
  }
  const bases: Record<string, string> = { abacus: "https://routellm.abacus.ai/v1", openai: "https://api.openai.com/v1", groq: "https://api.groq.com/openai/v1", mistral: "https://api.mistral.ai/v1", deepseek: "https://api.deepseek.com/v1", xai: "https://api.x.ai/v1", openrouter: "https://openrouter.ai/api/v1" };
  const r = await fetchIADeUsuario(sb, userId, proyectoId, "pideme", `${bases[p.slug]}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${p.clave}`, "content-type": "application/json" }, body: JSON.stringify({ model: p.modelo, max_tokens: maxTokens, temperature: 0.2, ...(jsonMode ? { response_format: { type: "json_object" } } : {}), messages: [{ role: "system", content: sistema }, { role: "user", content: pregunta }] }) });
  if (!r.ok) throw new Error(`${p.slug} ${r.status}: ${(await r.text()).slice(0, 160)}`); const j = await r.json();
  return { coste: Number(j._nex_coste_eur), texto: j.choices?.[0]?.message?.content ?? "", te: j.usage?.prompt_tokens ?? 0, ts: j.usage?.completion_tokens ?? 0 };
}
const extraerJson = (t: string) => {
  const m = t.match(/```json\s*([\s\S]*?)```/) ?? t.match(/```\s*([\s\S]*?)```/) ?? t.match(/(\{[\s\S]*\})/);
  const candidatos = [m?.[1], t.replace(/^[\s\S]*?```json\s*/, "").replace(/```[\s\S]*$/, ""), t.slice(t.indexOf("{"))].filter((x): x is string => !!x && x.trim().startsWith("{"));
  for (const c of candidatos) {
    try { return JSON.parse(c); } catch { /* seguir */ }
    // Respuesta recortada: cerrar cadenas, arrays y objetos abiertos para salvar lo que haya
    let s = c.trim(); let enCadena = false, esc = false; const pila: string[] = [];
    for (const ch of s) { if (enCadena) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') enCadena = false; continue; } if (ch === '"') enCadena = true; else if (ch === "{") pila.push("}"); else if (ch === "[") pila.push("]"); else if (ch === "}" || ch === "]") pila.pop(); }
    if (enCadena) s += '"';
    s = s.replace(/,\s*$/, "");
    while (pila.length) s += pila.pop();
    try { const j = JSON.parse(s); j._recortado = true; return j; } catch { /* siguiente */ }
  }
  return null;
};

// ---------- Clasificación ----------
const normalizar = (s: string) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
async function clasificar(sb: SB, userId: string, texto: string, provs: Prov[], forzarProyectoId: string | null = null) {
  const { data: ps } = await sb.from("proyectos").select("id, nombre, slug, alias, descripcion, palabras_clave").eq("user_id", userId);
  const t = normalizar(texto);
  const personalExplicito = !forzarProyectoId && /\b(a nivel personal|es personal|esto es personal|es algo personal|cosa mia|es cosa mia|nada que ver con (los |mis )?proyectos|para mi personalmente)\b/.test(t) && !/\bproyecto\b/.test(t);
  // 1) Coincidencia directa por nombre, slug, alias o palabras clave
  const candidatos = (ps ?? []).map((p) => {
    const nombres = [p.nombre, p.slug, ...(p.alias ?? []), ...((p.palabras_clave ?? []) as string[])].filter(Boolean).map(normalizar);
    const puntos = nombres.reduce((a, n) => a + (n.length >= 3 && t.includes(n) ? (n === normalizar(p.nombre) ? 3 : 1) : 0), 0);
    return { p, puntos };
  }).filter((c) => c.puntos > 0).sort((a, b) => b.puntos - a.puntos);
  let clasificacion: any = null;
  const p0 = provs[0];
  if (p0) {
    const lista = (ps ?? []).map((p) => `- ${p.nombre} (id ${p.id}): ${(p.descripcion ?? "").slice(0, 120)}${p.alias?.length ? ` · alias: ${p.alias.join(", ")}` : ""}`).join("\n");
    const sistema = `Eres el clasificador de peticiones de NexDeveloper (centro de control de los proyectos de software de Javier). Devuelves SOLO JSON.`;
    const preg = `Proyectos de Javier:\n${lista}\n\nPetición (puede venir de una grabación de voz, con muletillas):\n"""${texto.slice(0, 6000)}"""\n\nReglas: si Javier dice «a nivel personal», «es personal» o la petición no tiene nada que ver con ningún proyecto (salud, viajes, compras, familia, cultura, dudas generales…), destino = "personal". Si nombra o alude claramente a un proyecto, destino = "proyecto" con su id. tipo: "consulta" (pregunta o quiere información/opinión), "modificacion" (pide cambiar, añadir, quitar, mejorar, arreglar algo de la app), "tareas" (dicta cosas por hacer). Devuelve JSON: {"destino":"proyecto|personal","proyecto_id":"uuid o null","proyecto_nombre":"…","confianza":0-1,"tipo":"consulta|modificacion|tareas|personal","titulo":"título corto (3-8 palabras) para el chat","motivo":"una frase","tareas":[{"titulo":"…","descripcion":"…","prioridad":"baja|media|alta"}] (solo si tipo=tareas),"resumen":"resumen limpio de lo pedido en 2-4 frases"}`;
    try { const r = await llamar(sb, userId, null, p0, sistema, preg, 900, true); r.coste; clasificacion = extraerJson(r.texto) ?? JSON.parse(r.texto); } catch { clasificacion = null; }
  }
  if (!clasificacion) {
    clasificacion = candidatos.length && !personalExplicito ? { destino: "proyecto", proyecto_id: candidatos[0].p.id, proyecto_nombre: candidatos[0].p.nombre, confianza: 0.6, tipo: /\b(cambia|anade|añade|quita|mejora|arregla|modifica|pon|crea|implementa)\b/.test(t) ? "modificacion" : "consulta", titulo: texto.slice(0, 60), motivo: "Coincidencia por nombre", resumen: texto.slice(0, 400) } : { destino: "personal", proyecto_id: null, confianza: 0.5, tipo: "personal", titulo: texto.slice(0, 60), motivo: "Sin proyecto reconocido", resumen: texto.slice(0, 400) };
  }
  // Refuerzos con la coincidencia directa
  if (personalExplicito) { clasificacion.destino = "personal"; clasificacion.tipo = "personal"; clasificacion.proyecto_id = null; clasificacion.confianza = 0.95; clasificacion.motivo = "Javier lo ha marcado como personal"; }
  else if (candidatos.length && candidatos[0].puntos >= 3 && clasificacion.destino !== "proyecto") { clasificacion.destino = "proyecto"; clasificacion.proyecto_id = candidatos[0].p.id; clasificacion.proyecto_nombre = candidatos[0].p.nombre; clasificacion.confianza = Math.max(clasificacion.confianza ?? 0, 0.8); if (clasificacion.tipo === "personal") clasificacion.tipo = "consulta"; }
  if (clasificacion.destino === "proyecto" && clasificacion.proyecto_id && !(ps ?? []).some((p) => p.id === clasificacion.proyecto_id)) { const porNombre = (ps ?? []).find((p) => normalizar(p.nombre) === normalizar(clasificacion.proyecto_nombre ?? "")); if (porNombre) clasificacion.proyecto_id = porNombre.id; else { clasificacion.destino = "personal"; clasificacion.proyecto_id = null; } }
  if (forzarProyectoId) {
    const pf = (ps ?? []).find((p) => p.id === forzarProyectoId);
    if (pf) { clasificacion.destino = "proyecto"; clasificacion.proyecto_id = pf.id; clasificacion.proyecto_nombre = pf.nombre; clasificacion.confianza = 1; clasificacion.motivo = "Proyecto elegido por Javier al revisar"; if (clasificacion.tipo === "personal") clasificacion.tipo = /\b(cambia|anade|añade|quita|mejora|arregla|modifica|pon|crea|implementa|desarrolla|integra)\b/.test(t) ? "modificacion" : "consulta"; }
  }
  return clasificacion;
}

// ---------- Respuesta con contexto del proyecto (consulta) ----------
async function contextoProyecto(sb: SB, userId: string, proyectoId: string) {
  const { data: p } = await sb.from("proyectos").select("nombre, descripcion, objetivo, tecnologias, version_actual, estado, semaforo_salud, semaforo_calidad, puntuacion_auditoria, repositorio").eq("id", proyectoId).single();
  const { data: tareas } = await sb.from("tareas").select("titulo, estado, prioridad").eq("proyecto_id", proyectoId).in("estado", ["pendiente", "en_cola", "ejecutando", "esperando_revision", "bloqueada"]).order("creado_el", { ascending: false }).limit(15);
  const { data: ordenes } = await sb.from("ordenes").select("texto, estado").eq("proyecto_id", proyectoId).order("creado_el", { ascending: false }).limit(8);
  const { data: msgs } = await sb.from("mensajes").select("autor, texto").eq("proyecto_id", proyectoId).order("fecha", { ascending: false }).limit(12);
  return `Proyecto: ${p?.nombre}. ${p?.descripcion ?? ""} Objetivo: ${p?.objetivo ?? "-"}. Tecnologías: ${p?.tecnologias ?? "Lovable, React, TypeScript, Supabase"}. Versión ${p?.version_actual ?? "?"}, estado ${p?.estado}, salud ${p?.semaforo_salud ?? "?"}, calidad ${p?.semaforo_calidad ?? "?"}, auditoría ${p?.puntuacion_auditoria ?? "?"}/100. Repositorio ${p?.repositorio ?? "-"}.\nTareas abiertas:\n${(tareas ?? []).map((t) => `- [${t.estado}/${t.prioridad}] ${t.titulo}`).join("\n") || "(ninguna)"}\nÓrdenes recientes:\n${(ordenes ?? []).map((o) => `- [${o.estado}] ${String(o.texto).slice(0, 140)}`).join("\n") || "(ninguna)"}\nÚltimos mensajes del proyecto:\n${(msgs ?? []).reverse().map((m) => `${m.autor}: ${String(m.texto).slice(0, 200)}`).join("\n")}`;
}

// ---------- Propuesta revisada por expertos (modificación) ----------
const AREAS: { area: string; slugs: string[]; persona: string; cuando: RegExp | null }[] = [
  { area: "Programación y arquitectura", slugs: ["arquitecto-frontend-ux", "arquitecto-db-backend"], persona: "arquitecto de software senior (React, TypeScript, Supabase, Lovable)", cuando: null },
  { area: "Seguridad y RGPD", slugs: ["auditor-seguridad-appsec", "cumplimiento-rgpd"], persona: "auditor de seguridad de aplicaciones y consultor RGPD/LOPDGDD/LSSI", cuando: null },
  { area: "Legal", slugs: ["cumplimiento-rgpd"], persona: "abogado especializado en derecho tecnológico, contratos de software, condiciones de uso, consumidores y propiedad intelectual en España", cuando: /\b(contrato|condicion|legal|ley|consentimiento|cookie|dato|privacidad|firma|cliente|usuario|pago|factura|garantia|devolucion|menor|salud|imagen|marca)\b/ },
  { area: "Comercial y producto", slugs: ["analista-finops-roi"], persona: "director comercial y de producto SaaS: valor para el cliente, precio, posicionamiento y adopción", cuando: /\b(precio|plan|suscrip|cliente|venta|comercial|tarifa|oferta|mercado|competencia|marketing|landing|captar|cobrar|factura)\b/ },
  { area: "Fiscal y facturación", slugs: ["analista-finops-roi"], persona: "asesor fiscal y contable en España (IVA, IRPF, facturación electrónica, Verifactu, obligaciones con Hacienda)", cuando: /\b(factura|iva|irpf|fiscal|hacienda|contab|cobro|pago|tpv|stripe|precio|verifactu|impuesto|nomina|ticket)\b/ },
  { area: "Experiencia de usuario y accesibilidad", slugs: ["arquitecto-frontend-ux"], persona: "diseñador UX/UI y experto en accesibilidad (WCAG) para usuarios no técnicos", cuando: /\b(pantalla|boton|formulario|menu|diseno|color|movil|usuario|interfaz|ux|accesib|texto|mensaje)\b/ },
  { area: "Datos y rendimiento", slugs: ["arquitecto-db-backend", "devops-observabilidad"], persona: "arquitecto de datos y rendimiento (PostgreSQL, RLS, migraciones, índices)", cuando: /\b(tabla|base de datos|dato|campo|migra|informe|listado|filtro|exportar|importar|lento|rendimiento|copia)\b/ },
  { area: "Calidad y pruebas", slugs: ["qa-tolerancia-fallos", "testing-automatizado"], persona: "responsable de QA: pruebas, casos límite y tolerancia a fallos", cuando: null },
];
async function proponer(sb: SB, userId: string, provs: Prov[], proyectoId: string, peticion: string, resumen: string) {
  const ctx = await contextoProyecto(sb, userId, proyectoId);
  const { data: expertos } = await sb.from("expertos").select("slug, nombre, papel, instrucciones").eq("user_id", userId).eq("estado", "adoptado");
  const t = normalizar(peticion);
  const areas = AREAS.filter((a) => !a.cuando || a.cuando.test(t));
  const mejor = provs[0]; const barato = provs.slice().sort((a, b) => a.ce - b.ce)[0] ?? mejor;
  let costeTotal = 0; const revisiones: any[] = [];
  const esTranscripcion = /\bSpeaker \d|\[Grabación del Plaud|Aclaraciones:|Notas añadidas:/.test(peticion) || peticion.length > 2500;
  const guia = esTranscripcion
    ? `\n\nIMPORTANTE: el texto de la petición es la TRANSCRIPCIÓN de una conversación o grabación (con muletillas, varios interlocutores y posibles errores de transcripción). NO es una orden literal. Tu trabajo es extraer de ella QUÉ CAMBIOS O FUNCIONALIDADES quiere Javier para el proyecto: lo que dice que le gustaría tener, lo que hace la competencia y él quiere igualar o superar, las ideas que se apuntan. Las líneas «Aclaraciones» o «Notas añadidas» son correcciones de vocabulario de la transcripción (por ejemplo, cómo se llama de verdad un producto o una empresa); úsalas para entender el texto, NUNCA las conviertas en la tarea a realizar.`
    : "";
  const base = `${ctx}\n\nPETICIÓN DE JAVIER (modificación del proyecto):\n${peticion}\n\nResumen de lo pedido: ${resumen}${guia}`;
  for (const a of areas) {
    if (!quedaTiempo(80_000)) break;
    const ex = (expertos ?? []).find((e) => a.slugs.includes(e.slug));
    const sistema = `${ex?.instrucciones ? ex.instrucciones.slice(0, 5000) : `Eres ${a.persona}.`}\n\nRevisas una modificación pedida para un proyecto de software desde el punto de vista de tu área («${a.area}»). Español de España, concreto, máximo 250 palabras. Devuelve SOLO JSON: {"observaciones":["…"],"riesgos":["…"],"requisitos":["qué debe cumplir la implementación"],"veredicto":"adelante|adelante con cambios|no recomendable","cambios_sugeridos":"texto breve o vacío"}`;
    const p = a.area.startsWith("Programación") || a.area.startsWith("Seguridad") ? mejor : barato;
    try { const r = await llamar(sb, userId, proyectoId, p, sistema, base, 900, true); costeTotal += r.coste; const j = extraerJson(r.texto) ?? { observaciones: [r.texto.slice(0, 500)], riesgos: [], requisitos: [], veredicto: "adelante" }; revisiones.push({ area: a.area, experto: ex?.nombre ?? a.persona, proveedor: p.slug, modelo: p.modelo, ...j }); }
    catch (e) { revisiones.push({ area: a.area, experto: ex?.nombre ?? a.persona, error: String(e?.message ?? e).slice(0, 150), observaciones: [], riesgos: [], requisitos: [], veredicto: "sin revisar" }); }
  }
  // Auditor jefe: síntesis y plan
  const jefe = (expertos ?? []).find((e) => e.slug === "auditor-jefe-orquestador");
  const sistemaS = `${jefe?.instrucciones ? jefe.instrucciones.slice(0, 5000) : "Eres el Auditor jefe y orquestador: director de QA y Tech Lead."}\n\nRecibes la petición de Javier y las revisiones de cada área. Redacta la PROPUESTA final para que Javier la apruebe o la rechace. Español de España. Sé conciso: la respuesta completa debe caber en 1500 palabras. Devuelve SOLO JSON (sin texto antes ni después): {"sintesis":"5-8 frases: qué se va a hacer, qué cambia para el usuario y qué han dicho las áreas","funcionalidades":[{"titulo":"…","descripcion":"una frase","prioridad":"alta|media|baja"}],"plan":[{"orden":1,"titulo":"…","descripcion":"…","responsable":"Lovable|Claude|Javier","horas":1}],"requisitos_obligatorios":["lo que las áreas exigen"],"riesgos":["…"],"decisiones_para_javier":["preguntas que solo él puede responder, si las hay"],"horas_estimadas":0,"coste_estimado_eur":0,"riesgo":"bajo|medio|alto","recomendacion":"aprobar|aprobar con cambios|no hacer","orden_para_la_ia":"texto completo y preciso de la orden que se enviará a la IA constructora si Javier aprueba, con todos los requisitos de las áreas incorporados"}`;
  const pregS = `${base}\n\nREVISIONES POR ÁREA:\n${revisiones.map((r) => `[${r.area} · ${r.experto}] veredicto: ${r.veredicto}\n- Observaciones: ${(r.observaciones ?? []).join(" | ")}\n- Riesgos: ${(r.riesgos ?? []).join(" | ")}\n- Requisitos: ${(r.requisitos ?? []).join(" | ")}${r.cambios_sugeridos ? `\n- Cambios sugeridos: ${r.cambios_sugeridos}` : ""}`).join("\n\n")}`;
  const s = await llamar(sb, userId, proyectoId, mejor, sistemaS, pregS, 7000, true); costeTotal += s.coste;
  const j = extraerJson(s.texto) ?? { sintesis: s.texto.slice(0, 1500), plan: [], riesgos: [], recomendacion: "aprobar con cambios", orden_para_la_ia: peticion };
  return { ...j, revisiones, coste: Number(costeTotal.toFixed(4)), areas: areas.map((a) => a.area) };
}

// ---------- Enrutado ----------
async function procesarPeticion(sb: SB, userId: string, peticionId: string) {
  const { data: pet } = await sb.from("peticiones_directas").select("*").eq("id", peticionId).eq("user_id", userId).single();
  if (!pet) throw new Error("Petición no encontrada");
  const provs = await proveedoresDisponibles(sb, userId);
  // No keyword classifier may transfer professional content to Personal.
  const forzar: string | null = pet.proyecto_id ?? null;
  if (!forzar) throw new Error("Elige un proyecto antes de procesar. Personal se abre por separado.");
  const {data: autorizado,error: errorProyecto}=await sb.from("proyectos").select("id").eq("id",forzar).eq("user_id",userId).single();
  if(errorProyecto || !autorizado) throw new Error("Proyecto no autorizado");
  const c = await clasificar(sb, userId, pet.texto, provs, forzar);
  await sb.from("peticiones_directas").update({ clasificacion: c, destino: c.destino, proyecto_id: c.destino === "proyecto" ? c.proyecto_id : null, estado: "clasificada", actualizado_el: ahora() }).eq("id", pet.id);
  const salida: any = { clasificacion: c };
  try {
    if (c.destino === "personal") {
      // Conversación en PERSONAL (fusión de IAs)
      const r = await fetch(`${URL_SUPABASE}/functions/v1/personal`, { method: "POST", headers: { "Content-Type": "application/json", "x-cron-token": await tokenCron(sb) }, body: JSON.stringify({ accion: "preguntar", user_id: userId, texto: pet.texto }) });
      const j = await r.json(); if (!j.ok) throw new Error(j.error ?? "PERSONAL no respondió");
      await sb.from("personal_conversaciones").update({ titulo: c.titulo ?? undefined }).eq("id", j.conversacion_id).eq("mensajes", 2).then(() => {}, () => {});
      await sb.from("peticiones_directas").update({ conversacion_id: j.conversacion_id, respuesta: j.respuesta?.texto ?? null, estado: "respondida", actualizado_el: ahora() }).eq("id", pet.id);
      Object.assign(salida, { conversacion_id: j.conversacion_id, respuesta: j.respuesta?.texto ?? null, url: `/personal?conversacion=${j.conversacion_id}` });
    } else {
      const proyectoId = c.proyecto_id as string;
      // Chat nuevo en el proyecto con título propio
      const { data: chat } = await sb.from("chats").insert({ user_id: userId, proyecto_id: proyectoId, titulo: String(c.titulo ?? pet.texto.slice(0, 60)).slice(0, 120), es_principal: false }).select("id").single();
      await sb.from("mensajes").insert({ user_id: userId, chat_id: chat!.id, proyecto_id: proyectoId, autor: "usuario", texto: pet.texto });
      salida.chat_id = chat!.id; salida.url = `/proyectos/${proyectoId}?chat=${chat!.id}`;
      if (c.tipo === "tareas" && Array.isArray(c.tareas) && c.tareas.length) {
        const ids: string[] = [];
        for (const t of c.tareas.slice(0, 20)) { const { data: tt } = await sb.from("tareas").insert({ user_id: userId, proyecto_id: proyectoId, titulo: String(t.titulo ?? "").slice(0, 200), descripcion: t.descripcion ?? null, estado: "pendiente", prioridad: ["baja", "media", "alta", "critica"].includes(t.prioridad) ? t.prioridad : "media" }).select("id").single(); if (tt) ids.push(tt.id); }
        const texto = `He creado ${ids.length} tarea(s) en ${c.proyecto_nombre}: ${c.tareas.slice(0, 20).map((t: any) => `«${t.titulo}»`).join(", ")}.`;
        await sb.from("mensajes").insert({ user_id: userId, chat_id: chat!.id, proyecto_id: proyectoId, autor: "sistema", texto });
        await sb.from("peticiones_directas").update({ chat_id: chat!.id, tarea_id: ids[0] ?? null, respuesta: texto, estado: "respondida", actualizado_el: ahora() }).eq("id", pet.id);
        Object.assign(salida, { tareas: ids.length, respuesta: texto });
      } else if (c.tipo === "modificacion") {
        if (!provs.length) throw new Error("No hay proveedor de IA con clave para preparar la propuesta");
        const prop = await proponer(sb, userId, provs, proyectoId, pet.texto, c.resumen ?? pet.texto);
        const texto = `PROPUESTA (revisada por ${prop.areas.length} áreas: ${prop.areas.join(", ")}):\n${prop.sintesis}\n\nRecomendación: ${prop.recomendacion}. Horas estimadas: ${prop.horas_estimadas ?? "?"}. Riesgo: ${prop.riesgo ?? "?"}.\nApruébala o recházala desde «Pídeme qué quieres» → Propuestas.`;
        await sb.from("mensajes").insert({ user_id: userId, chat_id: chat!.id, proyecto_id: proyectoId, autor: "agente", texto });
        await sb.from("peticiones_directas").update({ chat_id: chat!.id, propuesta: prop, respuesta: prop.sintesis, estado: "propuesta", actualizado_el: ahora() }).eq("id", pet.id);
        await sb.from("tareas").insert({ user_id: userId, proyecto_id: proyectoId, titulo: `Aprobar propuesta: ${String(c.titulo ?? pet.texto.slice(0, 60))}`, descripcion: prop.sintesis, estado: "esperando_revision", prioridad: "media", requiere_atencion: true, motivo_atencion: "Propuesta revisada por expertos", instrucciones: "Pídeme qué quieres → Propuestas → revisa las observaciones de cada área y pulsa «Aprobar» (se crea la orden para la IA) o «Rechazar»." }).then(() => {}, () => {});
        Object.assign(salida, { propuesta: prop, respuesta: prop.sintesis });
      } else {
        // Consulta: respuesta con contexto del proyecto
        if (!provs.length) throw new Error("No hay proveedor de IA con clave");
        const p = provs[0]; const ctx = await contextoProyecto(sb, userId, proyectoId);
        const r = await llamar(sb, userId, proyectoId, p, `Eres el asistente de NexDeveloper para el proyecto ${c.proyecto_nombre}. Respondes a Javier en español de España, con datos del contexto; si no sabes algo, dilo y propón cómo averiguarlo.\n\nCONTEXTO:\n${ctx}`, pet.texto, 1800);
        r.coste;
        await sb.from("mensajes").insert({ user_id: userId, chat_id: chat!.id, proyecto_id: proyectoId, autor: "agente", texto: r.texto, tokens_entrada: r.te, tokens_salida: r.ts, coste: r.coste });
        await sb.from("peticiones_directas").update({ chat_id: chat!.id, respuesta: r.texto, estado: "respondida", actualizado_el: ahora() }).eq("id", pet.id);
        salida.respuesta = r.texto;
      }
    }
  } catch (e) { await sb.from("peticiones_directas").update({ estado: "error", error: String(e?.message ?? e).slice(0, 300), actualizado_el: ahora() }).eq("id", pet.id); throw e; }
  return salida;
}
async function tokenCron(sb: SB) { const { data } = await sb.rpc("leer_cron_token"); return data ? String(data) : ""; }

// ---------- Plaud: OAuth + MCP ----------
const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const aleatorio = (n = 48) => b64url(crypto.getRandomValues(new Uint8Array(n)));
async function desafio(v: string) { return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v))); }
async function tokenPlaud(sb: SB, userId: string): Promise<string> {
  const { data, error } = await sb.rpc("leer_secretos_conexion", { p_user_id: userId, p_proveedor: "plaud" });
  if (error) throw new Error(`No se pudo leer la conexión: ${error.message}`);
  const c = (data ?? [])[0];
  if (!c?.refresh_token && !c?.access_token) throw new Error("Plaud no está conectado. Pulsa «Conectar Plaud».");
  if (c.access_token && (c.expira_el ? new Date(c.expira_el).getTime() : 0) - Date.now() > 60_000) return c.access_token;
  if (!c.refresh_token) throw new Error("La sesión con Plaud ha caducado; vuelve a conectar.");
  const r = await fetch(PLAUD.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: c.refresh_token, client_id: c.client_id ?? "" }) });
  if (!r.ok) { const t = await r.text(); await sb.from("conexiones_externas").update({ estado: "error", ultimo_error: `Renovación rechazada: ${t.slice(0, 200)}` }).eq("user_id", userId).eq("proveedor", "plaud"); throw new Error(`Plaud rechazó la renovación (${r.status}). Vuelve a conectar.`); }
  const tok = await r.json();
  const expira = new Date(Date.now() + Number(tok.expires_in ?? 3600) * 1000).toISOString();
  await sb.rpc("guardar_secreto_conexion", { p_user_id: userId, p_proveedor: "plaud", p_refresh: tok.refresh_token ?? null, p_acceso: tok.access_token, p_expira: expira });
  return tok.access_token;
}
function parsearMcp(texto: string, tipo: string) {
  if (tipo.includes("text/event-stream")) { let ultimo: any = null; for (const l of texto.split("\n")) if (l.startsWith("data:")) { try { const j = JSON.parse(l.slice(5).trim()); if (j.result || j.error) ultimo = j; } catch { /* nada */ } } return ultimo; }
  try { return JSON.parse(texto); } catch { return null; }
}
async function mcp(token: string, sesion: string | null, cuerpo: unknown) {
  const h: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" };
  if (sesion) h["Mcp-Session-Id"] = sesion;
  const r = await fetch(PLAUD.mcp, { method: "POST", headers: h, body: JSON.stringify(cuerpo) });
  const nueva = r.headers.get("mcp-session-id") ?? sesion;
  if (r.status === 202 || r.status === 204) return { sesion: nueva, datos: null };
  const texto = await r.text();
  if (!r.ok) throw new Error(`MCP de Plaud ${r.status}: ${texto.slice(0, 200)}`);
  return { sesion: nueva, datos: parsearMcp(texto, r.headers.get("content-type") ?? "") };
}
async function herramientaPlaud(token: string, nombre: string, argumentos: Record<string, unknown>, sesion?: string | null) {
  let s = sesion ?? null;
  if (!s) { const ini = await mcp(token, null, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "NexDeveloper", version: "0.36.1" } } }); s = ini.sesion; try { await mcp(token, s, { jsonrpc: "2.0", method: "notifications/initialized" }); } catch { /* opcional */ } }
  const r = await mcp(token, s, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: nombre, arguments: argumentos } });
  const d = r.datos; if (!d) throw new Error(`Plaud no respondió a ${nombre}`);
  if (d.error) throw new Error(`Plaud (${nombre}): ${d.error.message ?? JSON.stringify(d.error)}`);
  const res = d.result ?? {};
  if (res.isError) throw new Error(`Plaud (${nombre}): ${(res.content ?? []).map((c: any) => c.text ?? "").join(" ").slice(0, 300)}`);
  let salida: any = res.structuredContent ?? null;
  if (!salida) { const texto = (res.content ?? []).map((c: any) => c.text ?? "").join("\n"); try { salida = JSON.parse(texto); } catch { salida = { texto }; } }
  return { salida, sesion: s };
}
const textoDeTranscripcion = (t: any): string => {
  if (!t) return ""; if (typeof t === "string") return t;
  const lista = t.segments ?? t.utterances ?? t.items ?? t.transcript ?? t.data ?? t.transaction ?? (Array.isArray(t) ? t : null);
  if (Array.isArray(lista)) return lista.map((u: any) => typeof u === "string" ? u : `${u.speaker ?? u.speaker_name ?? ""}${u.speaker || u.speaker_name ? ": " : ""}${u.text ?? u.content ?? ""}`).join("\n");
  if (t.texto) return String(t.texto); if (t.text) return String(t.text); if (t.content) return textoDeTranscripcion(t.content);
  return JSON.stringify(t).slice(0, 20000);
};
async function importarPlaud(sb: SB, userId: string, cfg: any, maxNuevas = 8) {
  const token = await tokenPlaud(sb, userId);
  const { salida: lista, sesion } = await herramientaPlaud(token, "list_files", { page: 1, page_size: 30 });
  const archivos: any[] = lista?.files ?? lista?.items ?? lista?.data ?? lista?.recordings ?? (Array.isArray(lista) ? lista : []);
  const { data: ya } = await sb.from("plaud_grabaciones").select("plaud_id").eq("user_id", userId);
  const vistos = new Set((ya ?? []).map((x) => x.plaud_id));
  const nuevas: string[] = []; let contadas = 0;
  for (const a of archivos) {
    const id = String(a.id ?? a.file_id ?? a.fileId ?? ""); if (!id || vistos.has(id)) continue;
    const fecha = a.created_at ?? a.createdAt ?? a.start_time ?? a.date ?? null;
    const fechaIso = fecha ? (typeof fecha === "number" ? new Date(fecha < 1e12 ? fecha * 1000 : fecha).toISOString() : new Date(fecha).toISOString()) : null;
    if (cfg.desde && fechaIso && new Date(fechaIso) < new Date(cfg.desde)) { vistos.add(id); continue; }
    if (contadas >= maxNuevas || !quedaTiempo(75_000)) break;
    let transcripcion = ""; let resumen: string | null = null; let destacados: any = null;
    try { const t = await herramientaPlaud(token, "get_transcript", { file_id: id, block: "transaction_polish", limit: 500 }, sesion); transcripcion = textoDeTranscripcion(t.salida); if (!transcripcion.trim()) { const t2 = await herramientaPlaud(token, "get_transcript", { file_id: id, block: "transaction", limit: 500 }, sesion); transcripcion = textoDeTranscripcion(t2.salida); } } catch (e) { transcripcion = ""; }
    try { const n = await herramientaPlaud(token, "get_note", { file_id: id }, sesion); resumen = typeof n.salida === "string" ? n.salida : (n.salida?.summary ?? n.salida?.note ?? n.salida?.texto ?? (n.salida ? JSON.stringify(n.salida).slice(0, 4000) : null)); } catch { resumen = null; }
    try { const m = await herramientaPlaud(token, "get_transcript", { file_id: id, block: "mark_memo" }, sesion); destacados = m.salida?.marks ?? null; } catch { destacados = null; }
    await sb.from("plaud_grabaciones").insert({ user_id: userId, plaud_id: id, nombre: a.name ?? a.title ?? a.filename ?? `Grabación ${id.slice(0, 6)}`, fecha: fechaIso, duracion_seg: Number(a.duration ?? a.duration_seconds ?? a.durationSeconds ?? 0) || null, transcripcion: transcripcion.slice(0, 60000) || null, resumen: resumen ? String(resumen).slice(0, 8000) : null, destacados, estado: transcripcion.trim() ? "importada" : "importada", error: transcripcion.trim() ? null : "Sin transcripción disponible todavía" });
    nuevas.push(id); contadas++;
  }
  await sb.from("plaud_config").upsert({ user_id: userId, ultima_importacion: ahora(), actualizado_el: ahora() });
  await sb.from("conexiones_externas").update({ estado: "conectada", ultimo_error: null, ultima_comprobacion: ahora() }).eq("user_id", userId).eq("proveedor", "plaud");
  return { nuevas: nuevas.length, total_plaud: archivos.length };
}
async function procesarGrabacion(sb: SB, userId: string, g: any) {
  const texto = (g.transcripcion ?? "").trim() || (g.resumen ?? "").trim(); if (!texto) throw new Error("La grabación no tiene transcripción");
  const cuerpo = `[Grabación del Plaud «${g.nombre ?? ""}» del ${g.fecha ? new Date(g.fecha).toLocaleString("es-ES") : "?"}]\n${g.resumen ? `Resumen: ${g.resumen}\n\n` : ""}${texto}`;
  const { data: pet } = await sb.from("peticiones_directas").insert({ user_id: userId, texto: cuerpo.slice(0, 20000), origen: "plaud" }).select("id").single();
  await sb.from("plaud_grabaciones").update({ peticion_id: pet!.id, estado: "clasificada" }).eq("id", g.id);
  const r = await procesarPeticion(sb, userId, pet!.id);
  await sb.from("plaud_grabaciones").update({ estado: "procesada", destino: r.clasificacion?.destino ?? null, proyecto_id: r.clasificacion?.destino === "proyecto" ? r.clasificacion.proyecto_id : null, tareas_creadas: r.tareas ?? 0, error: null }).eq("id", g.id);
  return r;
}
async function plaudConfig(sb: SB, userId: string) { const { data } = await sb.from("plaud_config").select("*").eq("user_id", userId).maybeSingle(); if (data) return data; const { data: n } = await sb.from("plaud_config").insert({ user_id: userId }).select("*").single(); return n!; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = servicio(); const url = new URL(req.url);
  try {
    // Retorno del OAuth de Plaud (GET, sin sesión)
    if (req.method === "GET" && url.pathname.endsWith("/callback")) {
      const code = url.searchParams.get("code"); const state = url.searchParams.get("state") ?? "";
      if (url.searchParams.get("error")) return html(`Plaud devolvió un error: ${url.searchParams.get("error")} ${url.searchParams.get("error_description") ?? ""}`, 400);
      if (!code) return html("Plaud no devolvió el código de autorización.", 400);
      const { data: st } = await sb.from("oauth_estados").select("*").eq("state", state).eq("proveedor", "plaud").maybeSingle();
      if (!st) return html("Estado de autorización no válido o caducado. Vuelve a pulsar «Conectar Plaud».", 400);
      await sb.from("oauth_estados").delete().eq("state", state);
      const { data: con } = await sb.from("conexiones_externas").select("client_id").eq("user_id", st.user_id).eq("proveedor", "plaud").maybeSingle();
      const r = await fetch(PLAUD.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: URL_CALLBACK, client_id: con?.client_id ?? "", code_verifier: st.verifier }) });
      if (!r.ok) { const t = await r.text(); await sb.from("conexiones_externas").update({ estado: "error", ultimo_error: t.slice(0, 300) }).eq("user_id", st.user_id).eq("proveedor", "plaud"); return html(`Plaud rechazó el intercambio: ${t.slice(0, 300)}`, 502); }
      const tok = await r.json();
      const expira = new Date(Date.now() + Number(tok.expires_in ?? 3600) * 1000).toISOString();
      await sb.rpc("guardar_secreto_conexion", { p_user_id: st.user_id, p_proveedor: "plaud", p_refresh: tok.refresh_token ?? "", p_acceso: tok.access_token, p_expira: expira });
      let cuenta: string | null = null; try { const me = await herramientaPlaud(tok.access_token, "get_current_user", {}); cuenta = me.salida?.email ?? me.salida?.name ?? me.salida?.user?.email ?? null; } catch { /* sin cuenta */ }
      await sb.from("conexiones_externas").update({ estado: "conectada", cuenta, ultimo_error: null, ultima_comprobacion: ahora(), actualizado_el: ahora() }).eq("user_id", st.user_id).eq("proveedor", "plaud");
      return html(`Plaud conectado${cuenta ? ` (${cuenta})` : ""}. Ya puedes cerrar esta ventana y volver a NexDeveloper: las grabaciones se importarán solas.`);
    }
    const tokenCronCab = req.headers.get("x-cron-token") ?? "";
    let esServicio = false; let userId: string | null = null;
    if (tokenCronCab) { const { data } = await sb.rpc("comprobar_cron_token", { p_token: tokenCronCab }); esServicio = data === true; }
    if (!esServicio) {
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: u } = await sb.auth.getUser(jwt);
      if (!u?.user) return json({ ok: false, error: "No autorizado" }, 401);
      userId = u.user.id;
    }
    const cuerpo = req.method === "POST" ? await req.json().catch(() => ({})) : Object.fromEntries(url.searchParams);
    const accion = String(cuerpo.accion ?? "estado");
    if (esServicio && cuerpo.user_id) userId = String(cuerpo.user_id);
    if (accion === "programado") {
      if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
      const { data: cons } = await sb.from("conexiones_externas").select("user_id").eq("proveedor", "plaud").eq("estado", "conectada");
      const res: any[] = [];
      for (const c of cons ?? []) { const cfg = await plaudConfig(sb, c.user_id); if (!cfg.importar_automatico) continue; try { const r = await importarPlaud(sb, c.user_id, cfg); let procesadas = 0; if (cfg.procesar_automatico) { const { data: pend } = await sb.from("plaud_grabaciones").select("*").eq("user_id", c.user_id).eq("estado", "importada").not("transcripcion", "is", null).order("fecha").limit(3); for (const g of pend ?? []) { if (!quedaTiempo(85_000)) break; try { await procesarGrabacion(sb, c.user_id, g); procesadas++; } catch (e) { await sb.from("plaud_grabaciones").update({ error: String(e?.message ?? e).slice(0, 200) }).eq("id", g.id); } } } res.push({ user: c.user_id, ...r, procesadas }); } catch (e) { res.push({ user: c.user_id, error: String(e?.message ?? e) }); } }
      return json({ ok: true, resultados: res });
    }
    if (!userId) return json({ ok: false, error: "Falta el usuario" }, 400);
    switch (accion) {
      case "estado": {
        const { data: con } = await sb.from("conexiones_externas").select("estado, cuenta, ultimo_error, ultima_comprobacion").eq("user_id", userId).eq("proveedor", "plaud").maybeSingle();
        const cfg = await plaudConfig(sb, userId);
        const { data: pets } = await sb.from("peticiones_directas").select("id, texto, origen, destino, proyecto_id, chat_id, conversacion_id, estado, clasificacion, respuesta, propuesta, error, creado_el, proyectos!peticiones_directas_proyecto_id_fkey(nombre, color)").eq("user_id", userId).order("creado_el", { ascending: false }).limit(60);
        const { data: grabs } = await sb.from("plaud_grabaciones").select("id, plaud_id, nombre, fecha, duracion_seg, resumen, estado, destino, proyecto_id, tareas_creadas, error, importada_el, peticion_id").eq("user_id", userId).order("fecha", { ascending: false }).limit(60);
        const provs = await proveedoresDisponibles(sb, userId);
        return json({ ok: true, plaud: con ?? { estado: "desconectada" }, plaud_config: cfg, peticiones: pets ?? [], grabaciones: grabs ?? [], ia: provs.map((p) => p.slug), propuestas_pendientes: (pets ?? []).filter((p) => p.estado === "propuesta").length });
      }
      case "pedir": {
        if (!cuerpo.proyecto_id) return json({ok:false,error:"Selecciona un proyecto. Para asuntos personales, abre Personal."},400);
        const {data: destinoAutorizado,error: errorDestino}=await sb.from("proyectos").select("id").eq("id",String(cuerpo.proyecto_id)).eq("user_id",userId).single();
        if(errorDestino || !destinoAutorizado) return json({ok:false,error:"Proyecto no autorizado"},403);
        const texto = String(cuerpo.texto ?? "").trim(); if (texto.length < 3) return json({ ok: false, error: "Dime qué quieres" }, 400);
        const { data: pet } = await sb.from("peticiones_directas").insert({ user_id: userId, texto, origen: cuerpo.origen === "voz" ? "voz" : "texto", proyecto_id: cuerpo.proyecto_id ? String(cuerpo.proyecto_id) : null }).select("id").single();
        const r = await procesarPeticion(sb, userId, pet!.id);
        const { data: fin } = await sb.from("peticiones_directas").select("*").eq("id", pet!.id).single();
        return json({ ok: true, peticion: fin, ...r });
      }
      case "reclasificar": {
        if (cuerpo.destino !== "proyecto" || !cuerpo.proyecto_id) return json({ok:false,error:"Abre Personal para iniciar una conversación allí; no se trasladan automáticamente textos profesionales."},400);
        const {data: proyectoDestino,error: errorDestino}=await sb.from("proyectos").select("id").eq("id",String(cuerpo.proyecto_id)).eq("user_id",userId).single();
        if(errorDestino || !proyectoDestino) return json({ok:false,error:"Proyecto no autorizado"},403);
        // Javier corrige el destino: {peticion_id, destino: 'proyecto'|'personal', proyecto_id?}
        const { data: pet } = await sb.from("peticiones_directas").select("*").eq("id", String(cuerpo.peticion_id)).eq("user_id", userId).single();
        if (!pet) return json({ ok: false, error: "Petición no encontrada" }, 404);
        const c = { ...(pet.clasificacion ?? {}), destino: cuerpo.destino, proyecto_id: cuerpo.destino === "proyecto" ? cuerpo.proyecto_id : null, tipo: cuerpo.tipo ?? (cuerpo.destino === "personal" ? "personal" : "consulta"), confianza: 1, motivo: "Corregido por Javier" };
        if (c.destino === "proyecto" && cuerpo.proyecto_id) { const { data: p } = await sb.from("proyectos").select("nombre").eq("id", String(cuerpo.proyecto_id)).single(); c.proyecto_nombre = p?.nombre; if (cuerpo.proyecto_id) await sb.from("proyectos").update({ alias: [...new Set([...(await sb.from("proyectos").select("alias").eq("id", String(cuerpo.proyecto_id)).single()).data?.alias ?? [], ...(Array.isArray(cuerpo.alias) ? cuerpo.alias : [])])] }).eq("id", String(cuerpo.proyecto_id)).then(() => {}, () => {}); }
        // Volver a procesar con la clasificación forzada: se guarda y se procesa igual, saltando el clasificador
        const { data: nueva } = await sb.from("peticiones_directas").insert({ user_id: userId, texto: pet.texto, origen: pet.origen, clasificacion: c }).select("id").single();
        await sb.from("peticiones_directas").update({ estado: "descartada" }).eq("id", pet.id);
        const r = await procesarForzada(sb, userId, nueva!.id, c);
        return json({ ok: true, peticion_id: nueva!.id, ...r });
      }
      case "aprobar_propuesta": {
        const { data: ordenId, error } = await sb.rpc("aprobar_propuesta_atomica", {
          p_user_id: userId, p_peticion_id: String(cuerpo.peticion_id),
          p_texto: cuerpo.orden == null ? null : String(cuerpo.orden),
          p_motor: String(cuerpo.ejecutar_con ?? "auto"),
        });
        if (error || !ordenId) return json({ ok: false, error: "No se ha aprobado la propuesta. Comprueba el proyecto y vuelve a intentarlo." }, 409);
        return json({ ok: true, orden_id: ordenId });
      }
      case "rechazar_propuesta": {
        await sb.from("peticiones_directas").update({ estado: "descartada", respuesta: cuerpo.motivo ? `Rechazada: ${cuerpo.motivo}` : "Rechazada", actualizado_el: ahora() }).eq("id", String(cuerpo.peticion_id)).eq("user_id", userId);
        return json({ ok: true });
      }
      case "borrar_peticion": { await sb.from("peticiones_directas").delete().eq("id", String(cuerpo.peticion_id)).eq("user_id", userId); return json({ ok: true }); }
      // ----- Plaud -----
      case "plaud_conectar": {
        let { data: con } = await sb.from("conexiones_externas").select("client_id").eq("user_id", userId).eq("proveedor", "plaud").maybeSingle();
        if (!con) { await sb.from("conexiones_externas").insert({ user_id: userId, proveedor: "plaud" }); con = { client_id: null }; }
        let clientId = con.client_id;
        if (!clientId) {
          const r = await fetch(PLAUD.register, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "NexDeveloper", redirect_uris: [URL_CALLBACK], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" }) });
          if (!r.ok) return json({ ok: false, error: `Plaud no aceptó el registro del cliente (${r.status}): ${(await r.text()).slice(0, 200)}` }, 502);
          clientId = (await r.json()).client_id;
          await sb.from("conexiones_externas").update({ client_id: clientId, actualizado_el: ahora() }).eq("user_id", userId).eq("proveedor", "plaud");
        }
        const verifier = aleatorio(); const state = aleatorio(24);
        await sb.from("oauth_estados").delete().eq("user_id", userId).eq("proveedor", "plaud");
        await sb.from("oauth_estados").insert({ state, user_id: userId, proveedor: "plaud", verifier });
        const p = new URLSearchParams({ response_type: "code", client_id: clientId!, redirect_uri: URL_CALLBACK, state, code_challenge: await desafio(verifier), code_challenge_method: "S256", resource: PLAUD.mcp });
        return json({ ok: true, url: `${PLAUD.authorize}?${p}` });
      }
      case "plaud_desconectar": {
        await sb.rpc("guardar_secreto_conexion", { p_user_id: userId, p_proveedor: "plaud", p_refresh: "", p_acceso: "", p_expira: null }).then(() => {}, () => {});
        await sb.from("conexiones_externas").update({ estado: "desconectada", cuenta: null, actualizado_el: ahora() }).eq("user_id", userId).eq("proveedor", "plaud");
        return json({ ok: true });
      }
      case "plaud_probar": {
        try { const token = await tokenPlaud(sb, userId); const me = await herramientaPlaud(token, "get_current_user", {}); const l = await herramientaPlaud(token, "list_files", { page: 1, page_size: PLAUD_PAGE_MIN }, me.sesion); const archivos = l.salida?.files ?? l.salida?.items ?? l.salida?.data ?? (Array.isArray(l.salida) ? l.salida : []); await sb.from("conexiones_externas").update({ estado: "conectada", ultimo_error: null, ultima_comprobacion: ahora() }).eq("user_id", userId).eq("proveedor", "plaud"); return json({ ok: true, cuenta: me.salida?.email ?? me.salida?.name ?? null, grabaciones_vistas: archivos.length }); }
        catch (e) { await sb.from("conexiones_externas").update({ estado: "error", ultimo_error: String(e?.message ?? e).slice(0, 300), ultima_comprobacion: ahora() }).eq("user_id", userId).eq("proveedor", "plaud"); return json({ ok: false, error: String(e?.message ?? e) }); }
      }
      case "plaud_configurar": {
        const permitidos = ["importar_automatico", "procesar_automatico", "desde"];
        const cambios: Record<string, unknown> = { user_id: userId, actualizado_el: ahora() };
        for (const k of permitidos) if (k in cuerpo) cambios[k] = cuerpo[k];
        const { data } = await sb.from("plaud_config").upsert(cambios).select("*").single();
        return json({ ok: true, plaud_config: data });
      }
      case "plaud_importar": {
        const cfg = await plaudConfig(sb, userId);
        const r = await importarPlaud(sb, userId, cfg, Number(cuerpo.maximo ?? 8));
        return json({ ok: true, ...r });
      }
      case "plaud_procesar": {
        // Una grabación concreta (o todas las importadas sin procesar)
        let q = sb.from("plaud_grabaciones").select("*").eq("user_id", userId).eq("estado", "importada").not("transcripcion", "is", null).order("fecha");
        if (cuerpo.grabacion_id) q = sb.from("plaud_grabaciones").select("*").eq("user_id", userId).eq("id", String(cuerpo.grabacion_id));
        const { data: grabs } = await q.limit(3);
        const res: any[] = [];
        for (const g of grabs ?? []) { if (!quedaTiempo(85_000)) break; try { const r = await procesarGrabacion(sb, userId, g); res.push({ id: g.id, nombre: g.nombre, destino: r.clasificacion?.destino, proyecto: r.clasificacion?.proyecto_nombre, tipo: r.clasificacion?.tipo, url: r.url }); } catch (e) { await sb.from("plaud_grabaciones").update({ error: String(e?.message ?? e).slice(0, 200) }).eq("id", g.id); res.push({ id: g.id, error: String(e?.message ?? e) }); } }
        return json({ ok: true, procesadas: res });
      }
      case "plaud_grabacion": { const { data } = await sb.from("plaud_grabaciones").select("*").eq("id", String(cuerpo.grabacion_id)).eq("user_id", userId).single(); return json({ ok: !!data, grabacion: data }); }
      case "plaud_descartar": { await sb.from("plaud_grabaciones").update({ estado: "descartada" }).eq("id", String(cuerpo.grabacion_id)).eq("user_id", userId); return json({ ok: true }); }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (err) { return json({ ok: false, error: String(err?.message ?? err) }, 500); }
});

// Procesar con clasificación forzada (corrección de Javier)
async function procesarForzada(sb: SB, userId: string, peticionId: string, c: any) {
  // Reutiliza procesarPeticion parcheando el clasificador: guardamos la clasificación y llamamos a la rama correspondiente
  const { data: pet } = await sb.from("peticiones_directas").select("*").eq("id", peticionId).eq("user_id", userId).single();
  const provs = await proveedoresDisponibles(sb, userId);
  await sb.from("peticiones_directas").update({ clasificacion: c, destino: c.destino, proyecto_id: c.destino === "proyecto" ? c.proyecto_id : null, estado: "clasificada" }).eq("id", peticionId);
  const salida: any = { clasificacion: c };
  if (c.destino === "personal") {
    const r = await fetch(`${URL_SUPABASE}/functions/v1/personal`, { method: "POST", headers: { "Content-Type": "application/json", "x-cron-token": await tokenCron(sb) }, body: JSON.stringify({ accion: "preguntar", user_id: userId, texto: pet!.texto }) });
    const j = await r.json(); if (!j.ok) throw new Error(j.error ?? "PERSONAL no respondió");
    await sb.from("peticiones_directas").update({ conversacion_id: j.conversacion_id, respuesta: j.respuesta?.texto ?? null, estado: "respondida", actualizado_el: ahora() }).eq("id", peticionId);
    return { ...salida, conversacion_id: j.conversacion_id, respuesta: j.respuesta?.texto, url: `/personal?conversacion=${j.conversacion_id}` };
  }
  const proyectoId = c.proyecto_id;
  const { data: chat } = await sb.from("chats").insert({ user_id: userId, proyecto_id: proyectoId, titulo: String(c.titulo ?? pet!.texto.slice(0, 60)).slice(0, 120), es_principal: false }).select("id").single();
  await sb.from("mensajes").insert({ user_id: userId, chat_id: chat!.id, proyecto_id: proyectoId, autor: "usuario", texto: pet!.texto });
  if (c.tipo === "modificacion") {
    const prop = await proponer(sb, userId, provs, proyectoId, pet!.texto, c.resumen ?? pet!.texto);
    await sb.from("mensajes").insert({ user_id: userId, chat_id: chat!.id, proyecto_id: proyectoId, autor: "agente", texto: `PROPUESTA (revisada por ${prop.areas.length} áreas): ${prop.sintesis}` });
    await sb.from("peticiones_directas").update({ chat_id: chat!.id, propuesta: prop, respuesta: prop.sintesis, estado: "propuesta", actualizado_el: ahora() }).eq("id", peticionId);
    return { ...salida, chat_id: chat!.id, propuesta: prop, url: `/proyectos/${proyectoId}?chat=${chat!.id}` };
  }
  const p = provs[0]; if (!p) throw new Error("Sin proveedor de IA");
  const r = await llamar(sb, userId, proyectoId, p, `Eres el asistente de NexDeveloper para el proyecto ${c.proyecto_nombre}. Español de España.\n\nCONTEXTO:\n${await contextoProyecto(sb, userId, proyectoId)}`, pet!.texto, 1800);
  r.coste;
  await sb.from("mensajes").insert({ user_id: userId, chat_id: chat!.id, proyecto_id: proyectoId, autor: "agente", texto: r.texto });
  await sb.from("peticiones_directas").update({ chat_id: chat!.id, respuesta: r.texto, estado: "respondida", actualizado_el: ahora() }).eq("id", peticionId);
  return { ...salida, chat_id: chat!.id, respuesta: r.texto, url: `/proyectos/${proyectoId}?chat=${chat!.id}` };
}
