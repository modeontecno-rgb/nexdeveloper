// NexDeveloper · Edge Function «gasto-ia» (0.15.0)
// Control de gasto real de IA: agrega consumos internos, lee el coste real de Anthropic y OpenAI (claves de administración opcionales)
// y comprueba presupuestos (avisos y bloqueo). Acciones: sincronizar (usuario) · programado (x-cron-token) · comprobar_presupuestos · sin acción → estado
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_ADMIN = Deno.env.get("ANTHROPIC_ADMIN_KEY") ?? "";
const OPENAI_ADMIN = Deno.env.get("OPENAI_ADMIN_KEY") ?? "";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const dia = (d: Date) => d.toISOString().slice(0, 10);

async function anthropicReal(sb: SB, userId: string, desde: Date, cambio: number) {
  if (!ANTHROPIC_ADMIN) return { proveedor: "anthropic", estado: "sin clave de administración" };
  // Informe de costes por día (USD) — API de administración de Anthropic
  const r = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?starting_at=${desde.toISOString()}&group_by[]=description&bucket_width=1d&limit=31`, { headers: { "x-api-key": ANTHROPIC_ADMIN, "anthropic-version": "2023-06-01" } });
  if (!r.ok) return { proveedor: "anthropic", estado: `error ${r.status}: ${(await r.text()).slice(0, 120)}` };
  const j = await r.json();
  let n = 0;
  for (const b of j.data ?? []) {
    const fecha = dia(new Date(b.starting_at));
    const total = (b.results ?? []).reduce((s: number, x: any) => s + Number(x.amount ?? 0), 0); // en centavos? La API devuelve amount en USD decimal (string)
    const usd = total > 1000 ? total / 100 : total;
    await sb.from("gasto_ia_diario").upsert({ user_id: userId, fecha, proveedor: "anthropic", fuente: "anthropic_admin", proyecto_id: null, modelo: null, coste: Number((usd * cambio).toFixed(4)), detalle: { usd, conceptos: (b.results ?? []).map((x: any) => ({ d: x.description, a: x.amount })) }, actualizado_el: new Date().toISOString() }, { onConflict: "user_id,fecha,proveedor,fuente,proyecto_id,modelo" });
    n++;
  }
  return { proveedor: "anthropic", estado: `ok · ${n} días` };
}
async function openaiReal(sb: SB, userId: string, desde: Date, cambio: number) {
  if (!OPENAI_ADMIN) return { proveedor: "openai", estado: "sin clave de administración" };
  const r = await fetch(`https://api.openai.com/v1/organization/costs?start_time=${Math.floor(desde.getTime() / 1000)}&bucket_width=1d&limit=31`, { headers: { Authorization: `Bearer ${OPENAI_ADMIN}` } });
  if (!r.ok) return { proveedor: "openai", estado: `error ${r.status}: ${(await r.text()).slice(0, 120)}` };
  const j = await r.json();
  let n = 0;
  for (const b of j.data ?? []) {
    const fecha = dia(new Date(Number(b.start_time) * 1000));
    const usd = (b.results ?? []).reduce((s: number, x: any) => s + Number(x.amount?.value ?? 0), 0);
    await sb.from("gasto_ia_diario").upsert({ user_id: userId, fecha, proveedor: "openai", fuente: "openai_admin", proyecto_id: null, modelo: null, coste: Number((usd * cambio).toFixed(4)), detalle: { usd }, actualizado_el: new Date().toISOString() }, { onConflict: "user_id,fecha,proveedor,fuente,proyecto_id,modelo" });
    n++;
  }
  return { proveedor: "openai", estado: `ok · ${n} días` };
}

async function comprobarPresupuestos(sb: SB, userId: string) {
  const { data: estados } = await sb.from("v_gasto_ia_estado").select("*").eq("user_id", userId);
  const mes = new Date().toISOString().slice(0, 7);
  const avisos: unknown[] = [];
  for (const e of estados ?? []) {
    const pct = e.limite_mensual > 0 ? (Number(e.gastado_mes) / Number(e.limite_mensual)) * 100 : 0;
    const { data: b } = await sb.from("presupuestos_ia").select("*").eq("id", e.presupuesto_id).maybeSingle();
    if (!b) continue;
    const superado = pct >= 100; const enAviso = pct >= Number(e.aviso_pct);
    const bloquear = b.accion === "bloquear" && superado;
    if (b.bloqueado !== bloquear) await sb.from("presupuestos_ia").update({ bloqueado: bloquear, actualizado_el: new Date().toISOString() }).eq("id", b.id);
    if (enAviso && b.avisado_mes !== mes) {
      let nombreAmbito = "global";
      if (e.ambito === "proveedor") nombreAmbito = `proveedor ${e.referencia}`;
      if (e.ambito === "proyecto") { const { data: p } = await sb.from("proyectos").select("nombre").eq("id", e.referencia).maybeSingle(); nombreAmbito = `proyecto ${p?.nombre ?? e.referencia}`; }
      const titulo = `${superado ? "Presupuesto de IA superado" : "Presupuesto de IA al " + Math.round(pct) + " %"} (${nombreAmbito}): ${Number(e.gastado_mes).toFixed(2)} € de ${Number(e.limite_mensual).toFixed(2)} €`;
      await sb.from("tareas").insert({ user_id: userId, proyecto_id: e.ambito === "proyecto" ? e.referencia : null, titulo: titulo.slice(0, 200), descripcion: `Gasto del mes ${mes}: ${Number(e.gastado_mes).toFixed(2)} €. Límite: ${Number(e.limite_mensual).toFixed(2)} €. Acción configurada: ${b.accion}${bloquear ? " (los trabajos de IA quedan bloqueados hasta subir el límite o cambiar de mes)" : ""}.`, estado: "pendiente", prioridad: superado ? "alta" : "media", requiere_atencion: true, motivo_atencion: "Presupuesto de IA", instrucciones: "Revisa Gasto de IA → Presupuestos: sube el límite, cambia la acción o reduce el uso (política de enrutado más barata)." });
      await sb.from("alertas").insert({ user_id: userId, proyecto_id: e.ambito === "proyecto" ? e.referencia : null, texto: titulo.slice(0, 300), nivel: superado ? "critica" : "aviso", requiere_decision: superado, referencia_tabla: "presupuestos_ia", referencia_id: b.id }).then(() => {}, () => {});
      await sb.from("presupuestos_ia").update({ avisado_mes: mes }).eq("id", b.id);
      avisos.push({ presupuesto: b.id, pct: Math.round(pct), bloqueado: bloquear });
    }
  }
  return avisos;
}

async function sincronizar(sb: SB, userId: string) {
  const { data: cfg } = await sb.from("gasto_ia_config").select("*").eq("user_id", userId).maybeSingle();
  const cambio = Number(cfg?.tipo_cambio_usd ?? 0.92);
  const desde = new Date(); desde.setDate(desde.getDate() - 31); desde.setHours(0, 0, 0, 0);
  const { data: agregados } = await sb.rpc("agregar_consumos_ia", { p_user_id: userId, p_desde: dia(desde) });
  const reales = [await anthropicReal(sb, userId, desde, cambio), await openaiReal(sb, userId, desde, cambio)];
  const avisos = await comprobarPresupuestos(sb, userId);
  return { agregados, reales, avisos };
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
    if (!accion) return json({ ok: true, listo: true, anthropic_admin: !!ANTHROPIC_ADMIN, openai_admin: !!OPENAI_ADMIN });
    if (accion === "programado") {
      if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
      const { data: cfgs } = await sb.from("gasto_ia_config").select("user_id");
      const res: unknown[] = [];
      for (const c of cfgs ?? []) { try { res.push({ user_id: c.user_id, ...(await sincronizar(sb, c.user_id)) }); } catch (e) { res.push({ user_id: c.user_id, error: String(e?.message ?? e) }); } }
      return json({ ok: true, resultados: res });
    }
    if (accion === "sincronizar") return json({ ok: true, ...(await sincronizar(sb, userId!)) });
    if (accion === "comprobar_presupuestos") return json({ ok: true, avisos: await comprobarPresupuestos(sb, userId!) });
    return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
  } catch (e) { return json({ ok: false, error: String(e?.message ?? e) }, 500); }
});
