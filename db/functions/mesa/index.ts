// NexDeveloper · Edge Function «mesa» (0.19.0)
// Mesa de expertos: recomienda el equipo (planificar / ejecutar / revisar) para un trabajo, delibera con varios expertos
// (cada uno con su proveedor y modelo) y sintetiza un plan con riesgos, coste y horas; puede crear las tareas del plan.
// Acciones: recomendar {proyecto_id, pregunta, contexto?, modo?} · deliberar {mesa_id} · crear_tareas {mesa_id} · sin acción → estado
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;

type Prov = { slug: string; clave: string; modelo: string; modelo_id: string | null; ce: number; cs: number; calidad: number };
async function proveedoresDisponibles(sb: SB, userId: string): Promise<Prov[]> {
  const { data: provs } = await sb.from("proveedores_ia").select("id, clave_slug, activo, clave_cifrada").eq("user_id", userId).eq("activo", true).not("clave_cifrada", "is", null).in("clave_slug", ["anthropic", "openai", "google", "groq", "mistral", "deepseek", "xai", "openrouter"]);
  const out: Prov[] = [];
  for (const p of provs ?? []) {
    const { data: clave } = await sb.rpc("descifrar_clave_proveedor", { p_proveedor_id: p.id }); if (!clave) continue;
    const { data: modelos } = await sb.from("modelos_ia").select("id, identificador, calidad, coste_entrada, coste_salida").eq("proveedor_id", p.id).eq("activo", true).order("calidad", { ascending: false });
    const m = (modelos ?? []).find((x) => !/image|imagen|tts|whisper|embed/i.test(x.identificador)); if (!m) continue;
    out.push({ slug: p.clave_slug, clave: String(clave), modelo: m.identificador, modelo_id: m.id, ce: Number(m.coste_entrada ?? 0), cs: Number(m.coste_salida ?? 0), calidad: Number(m.calidad ?? 3) });
  }
  return out.sort((a, b) => b.calidad - a.calidad);
}
async function llamar(p: Prov, sistema: string, pregunta: string, maxTokens = 2500) {
  if (p.slug === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": p.clave, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: p.modelo, max_tokens: maxTokens, system: sistema, messages: [{ role: "user", content: pregunta }] }) });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 160)}`); const j = await r.json();
    return { texto: (j.content ?? []).map((c: any) => c.text ?? "").join(""), te: j.usage?.input_tokens ?? 0, ts: j.usage?.output_tokens ?? 0 };
  }
  if (p.slug === "google") {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${p.modelo}:generateContent?key=${p.clave}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: "user", parts: [{ text: pregunta }] }], generationConfig: { maxOutputTokens: maxTokens } }) });
    if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 160)}`); const j = await r.json();
    return { texto: (j.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text ?? "").join(""), te: j.usageMetadata?.promptTokenCount ?? 0, ts: j.usageMetadata?.candidatesTokenCount ?? 0 };
  }
  const bases: Record<string, string> = { openai: "https://api.openai.com/v1", groq: "https://api.groq.com/openai/v1", mistral: "https://api.mistral.ai/v1", deepseek: "https://api.deepseek.com/v1", xai: "https://api.x.ai/v1", openrouter: "https://openrouter.ai/api/v1" };
  const r = await fetch(`${bases[p.slug]}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${p.clave}`, "content-type": "application/json" }, body: JSON.stringify({ model: p.modelo, max_tokens: maxTokens, temperature: 0.3, messages: [{ role: "system", content: sistema }, { role: "user", content: pregunta }] }) });
  if (!r.ok) throw new Error(`${p.slug} ${r.status}: ${(await r.text()).slice(0, 160)}`); const j = await r.json();
  return { texto: j.choices?.[0]?.message?.content ?? "", te: j.usage?.prompt_tokens ?? 0, ts: j.usage?.completion_tokens ?? 0 };
}
const coste = (p: Prov, te: number, ts: number) => Number(((te * p.ce + ts * p.cs) / 1_000_000).toFixed(4));
const extraerJson = (t: string) => { const m = t.match(/```json\s*([\s\S]*?)```/) ?? t.match(/(\{[\s\S]*\})/); if (!m) return null; try { return JSON.parse(m[1]); } catch { return null; } };

// Elegir expertos según el texto (papel, cuando_usarlo, tareas)
async function elegirExpertos(sb: SB, userId: string, texto: string, n = 3) {
  const { data: expertos } = await sb.from("expertos").select("slug, nombre, papel, cuando_usarlo, instrucciones, tareas").eq("user_id", userId).eq("estado", "adoptado").eq("origen", "propio");
  const t = texto.toLowerCase();
  const puntuados = (expertos ?? []).filter((e) => !["claude", "chatgpt", "gemini", "lovable", "canva", "nano_banana"].includes(e.slug)).map((e) => {
    const bolsa = `${e.papel ?? ""} ${e.cuando_usarlo ?? ""} ${(e.tareas ?? []).join(" ")}`.toLowerCase();
    const palabras = [...new Set(bolsa.split(/[^a-záéíóúñ]+/).filter((w) => w.length > 5))];
    const puntos = palabras.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    return { ...e, puntos };
  }).sort((a, b) => b.puntos - a.puntos);
  const elegidos = puntuados.slice(0, n);
  const jefe = (expertos ?? []).find((e) => e.slug === "auditor-jefe-orquestador");
  if (jefe && !elegidos.some((e) => e.slug === jefe.slug)) elegidos.push({ ...jefe, puntos: 0 });
  return elegidos;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = servicio();
    const cuerpo = await req.json().catch(() => ({}));
    const accion = String(cuerpo.accion ?? "");
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = jwt ? await sb.auth.getUser(jwt) : { data: { user: null } };
    if (!user) return json({ ok: false, error: "Sin sesión" }, 401);
    const userId = user.id;
    const provs = await proveedoresDisponibles(sb, userId);
    if (!accion) return json({ ok: true, listo: true, proveedores: provs.map((p) => `${p.slug} · ${p.modelo}`), minimo_ok: provs.length >= 1 });

    if (accion === "recomendar") {
      const proyectoId = cuerpo.proyecto_id ?? null;
      const pregunta = String(cuerpo.pregunta ?? "").trim(); if (!pregunta) return json({ ok: false, error: "Escribe qué quieres decidir o hacer" }, 400);
      const modo = ["economico", "equilibrado", "maxima_calidad"].includes(cuerpo.modo) ? cuerpo.modo : "equilibrado";
      let proyecto: any = null; if (proyectoId) { const { data: p } = await sb.from("proyectos").select("id, nombre, descripcion, tecnologias").eq("id", proyectoId).eq("user_id", userId).maybeSingle(); proyecto = p; }
      const expertos = await elegirExpertos(sb, userId, `${pregunta} ${cuerpo.contexto ?? ""} ${proyecto?.descripcion ?? ""}`, modo === "economico" ? 2 : modo === "maxima_calidad" ? 4 : 3);
      // Reparto de proveedores: el mejor planifica/revisa, los baratos opinan
      const mejor = provs[0]; const barato = provs.slice().sort((a, b) => a.ce - b.ce)[0] ?? mejor;
      const participantes = expertos.map((e, i) => {
        const rol = i === 0 ? "planificar" : e.slug === "auditor-jefe-orquestador" ? "revisar" : "opinar";
        const p = modo === "economico" ? barato : modo === "maxima_calidad" ? mejor : (rol === "opinar" ? barato : mejor);
        return { rol, experto_slug: e.slug, experto_nombre: e.nombre, proveedor: p?.slug ?? null, modelo: p?.modelo ?? null, motivo: e.puntos > 0 ? `Encaja con el trabajo (${e.puntos} coincidencias)` : "Siempre presente: revisión final" };
      });
      const equipo = { planificar: participantes.find((p) => p.rol === "planificar")?.experto_nombre ?? "Claude", ejecutar: /pantalla|interfaz|dise|react|lovable/i.test(pregunta) ? "Lovable" : "Claude", revisar: participantes.find((p) => p.rol === "revisar")?.experto_nombre ?? "Auditor jefe" };
      const { data: mesa, error } = await sb.from("mesas").insert({ user_id: userId, proyecto_id: proyectoId, orden_id: cuerpo.orden_id ?? null, tarea_id: cuerpo.tarea_id ?? null, titulo: pregunta.slice(0, 120), pregunta, contexto: cuerpo.contexto ?? null, modo, participantes, recomendacion: { equipo, plan: [], riesgos: [], coste_estimado: null, horas_estimadas: null, calidad_prevista: null, requiere_aprobacion: false, motivo: "Pendiente de deliberar" } }).select("*").single();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, mesa, sin_proveedores: provs.length === 0 });
    }

    if (accion === "deliberar") {
      const { data: mesa } = await sb.from("mesas").select("*").eq("id", String(cuerpo.mesa_id)).eq("user_id", userId).maybeSingle();
      if (!mesa) return json({ ok: false, error: "Mesa no encontrada" }, 404);
      if (!provs.length) return json({ ok: false, error: "Ningún proveedor de texto con clave (Anthropic, Groq, Google, OpenAI…). Ponla en Ajustes → Proveedores." });
      const { data: permitido } = await sb.rpc("gasto_ia_permitido", { p_user_id: userId, p_proveedor: null, p_proyecto_id: mesa.proyecto_id });
      if (permitido === false) return json({ ok: false, error: "Presupuesto de IA superado con acción «bloquear». Revisa Gasto de IA → Presupuestos." });
      await sb.from("mesas").update({ estado: "deliberando", error: null }).eq("id", mesa.id);
      let proyecto: any = null; if (mesa.proyecto_id) { const { data: p } = await sb.from("proyectos").select("nombre, descripcion, tecnologias").eq("id", mesa.proyecto_id).maybeSingle(); proyecto = p; }
      const { data: expertos } = await sb.from("expertos").select("slug, nombre, papel, instrucciones").eq("user_id", userId);
      const base = `Proyecto: ${proyecto?.nombre ?? "(sin proyecto)"}. ${proyecto?.descripcion ?? ""} Tecnologías: ${proyecto?.tecnologias ?? "Lovable, Supabase, React, TypeScript"}.\nTrabajo o decisión: ${mesa.pregunta}\n${mesa.contexto ? `Contexto adicional: ${mesa.contexto}\n` : ""}`;
      let te = 0, ts = 0, costeTotal = 0, orden = 0; const opiniones: string[] = [];
      try {
        for (const part of (mesa.participantes ?? []) as any[]) {
          const p = provs.find((x) => x.slug === part.proveedor) ?? provs[0];
          const ex = (expertos ?? []).find((e) => e.slug === part.experto_slug);
          const sistema = `${ex?.instrucciones ? ex.instrucciones.slice(0, 6000) : `Eres ${ex?.nombre ?? part.experto_nombre}, ${ex?.papel ?? "experto"}.`}\n\nRespondes en español de España, concreto y breve (máximo 350 palabras), como miembro de una mesa de expertos. Tu rol en esta mesa: ${part.rol}.`;
            const preg = part.rol === "planificar" ? `${base}\nPropón el plan: pasos numerados (máx. 8), quién los hace (Claude, Lovable, un experto, Javier), horas estimadas y riesgos.` : part.rol === "revisar" ? `${base}\nOpiniones previas de la mesa:\n${opiniones.join("\n\n")}\n\nRevisa el plan: qué falta, qué sobra, qué riesgos de seguridad, datos o calidad ves, y si requiere aprobación de Javier antes de ejecutar.` : `${base}\nDa tu opinión desde tu especialidad: qué hay que tener en cuenta y qué recomendarías.`;
          const r = await llamar(p, sistema, preg, 1200);
          te += r.te; ts += r.ts; const c = coste(p, r.te, r.ts); costeTotal += c; orden++;
          opiniones.push(`[${part.experto_nombre} · ${part.rol}]\n${r.texto}`);
          await sb.from("mesa_intervenciones").insert({ user_id: userId, mesa_id: mesa.id, orden, rol: part.rol, experto_slug: part.experto_slug, experto_nombre: part.experto_nombre, proveedor: p.slug, modelo: p.modelo, texto: r.texto, tokens_entrada: r.te, tokens_salida: r.ts, coste: c });
          if (p.modelo_id) await sb.from("consumos_ia").insert({ user_id: userId, proyecto_id: mesa.proyecto_id, modelo_id: p.modelo_id, tokens_entrada: r.te, tokens_salida: r.ts, coste: c, resultado: "ok" }).then(() => {}, () => {});
        }
        // Síntesis con el mejor modelo
        const mejor = provs[0];
        const { data: ajustes } = await sb.from("ajustes").select("umbral_aprobacion_eur, aprobar_si_riesgo_alto").eq("user_id", userId).maybeSingle();
        const sistemaS = "Eres el coordinador de la mesa de expertos de Soluciones EvoluteIA. Sintetizas en español de España y devuelves SOLO JSON.";
        const pregS = `${base}\nIntervenciones de la mesa:\n${opiniones.join("\n\n")}\n\nDevuelve JSON: {"sintesis":"conclusión en 4-6 frases para Javier","equipo":{"planificar":"nombre","ejecutar":"Claude|Lovable|experto|Javier","revisar":"nombre"},"plan":[{"orden":1,"titulo":"…","descripcion":"…","responsable":"Claude|Lovable|Javier|experto","horas":1.5,"requiere_atencion":false}],"riesgos":["…"],"coste_estimado_eur":0,"horas_estimadas":0,"calidad_prevista":"alta|media|baja","riesgo":"bajo|medio|alto","requiere_aprobacion":true|false,"motivo_aprobacion":"…"}`;
        const s = await llamar(mejor, sistemaS, pregS, 2000);
        te += s.te; ts += s.ts; const cs = coste(mejor, s.te, s.ts); costeTotal += cs; orden++;
        const j = extraerJson(s.texto) ?? { sintesis: s.texto.slice(0, 1500), equipo: mesa.recomendacion?.equipo, plan: [], riesgos: [] };
        const requiere = !!j.requiere_aprobacion || (j.riesgo === "alto" && ajustes?.aprobar_si_riesgo_alto !== false) || (Number(j.coste_estimado_eur ?? 0) >= Number(ajustes?.umbral_aprobacion_eur ?? 50));
        await sb.from("mesa_intervenciones").insert({ user_id: userId, mesa_id: mesa.id, orden, rol: "sintesis", experto_slug: "coordinador", experto_nombre: "Coordinador de la mesa", proveedor: mejor.slug, modelo: mejor.modelo, texto: j.sintesis ?? s.texto, tokens_entrada: s.te, tokens_salida: s.ts, coste: cs });
        if (mejor.modelo_id) await sb.from("consumos_ia").insert({ user_id: userId, proyecto_id: mesa.proyecto_id, modelo_id: mejor.modelo_id, tokens_entrada: s.te, tokens_salida: s.ts, coste: cs, resultado: "ok" }).then(() => {}, () => {});
        const recomendacion = { equipo: j.equipo ?? mesa.recomendacion?.equipo, plan: j.plan ?? [], riesgos: j.riesgos ?? [], coste_estimado: j.coste_estimado_eur ?? null, horas_estimadas: j.horas_estimadas ?? null, calidad_prevista: j.calidad_prevista ?? null, riesgo: j.riesgo ?? null, requiere_aprobacion: requiere, motivo: j.motivo_aprobacion ?? (requiere ? "Supera el umbral o el riesgo configurado" : "Dentro de los umbrales") };
        await sb.from("mesas").update({ estado: "concluida", sintesis: j.sintesis ?? s.texto, recomendacion, tokens_entrada: te, tokens_salida: ts, coste: costeTotal, concluida_el: new Date().toISOString() }).eq("id", mesa.id);
        if (mesa.orden_id) await sb.from("ordenes").update({ equipo: recomendacion.equipo, coste_estimado: recomendacion.coste_estimado, horas_estimadas: recomendacion.horas_estimadas, riesgo: recomendacion.riesgo, calidad_prevista: recomendacion.calidad_prevista, requiere_aprobacion: requiere, motivo_aprobacion: recomendacion.motivo }).eq("id", mesa.orden_id).then(() => {}, () => {});
        await sb.from("actividad").insert({ user_id: userId, proyecto_id: mesa.proyecto_id, tipo: "mesa", texto: `Mesa de expertos concluida: ${mesa.titulo} (${(mesa.participantes ?? []).length} expertos, ${costeTotal.toFixed(3)} €)`, referencia_tabla: "mesas", referencia_id: mesa.id });
        return json({ ok: true, mesa_id: mesa.id, sintesis: j.sintesis, recomendacion, coste: costeTotal, tokens: te + ts });
      } catch (e) { await sb.from("mesas").update({ estado: "error", error: String(e?.message ?? e).slice(0, 300) }).eq("id", mesa.id); return json({ ok: false, error: String(e?.message ?? e) }); }
    }

    if (accion === "crear_tareas") {
      const { data: mesa } = await sb.from("mesas").select("*").eq("id", String(cuerpo.mesa_id)).eq("user_id", userId).maybeSingle();
      if (!mesa?.recomendacion?.plan?.length) return json({ ok: false, error: "La mesa no tiene plan" }, 400);
      const ids: string[] = [];
      for (const paso of mesa.recomendacion.plan as any[]) {
        const { data: t } = await sb.from("tareas").insert({ user_id: userId, proyecto_id: mesa.proyecto_id, orden_id: mesa.orden_id ?? null, titulo: String(paso.titulo ?? "Paso").slice(0, 200), descripcion: `${paso.descripcion ?? ""}\n\nResponsable propuesto: ${paso.responsable ?? "-"} · Mesa: ${mesa.titulo}`, estado: "pendiente", prioridad: "media", orden: Number(paso.orden ?? 0), estimacion_horas: paso.horas ?? null, requiere_atencion: !!paso.requiere_atencion || /javier/i.test(String(paso.responsable ?? "")), motivo_atencion: (!!paso.requiere_atencion || /javier/i.test(String(paso.responsable ?? ""))) ? "Paso que necesita tu decisión o tu acción" : null }).select("id").single();
        if (t) ids.push(t.id);
      }
      return json({ ok: true, tareas: ids.length });
    }
    return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
  } catch (e) { return json({ ok: false, error: String(e?.message ?? e) }, 500); }
});
