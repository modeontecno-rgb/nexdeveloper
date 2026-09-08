// NexDeveloper · Edge Function «salud» (0.21.0)
// Panel de salud de todos los Supabase de la cartera + Sentry: estado del proyecto (pausado, sano…), servicios,
// advisors de seguridad y rendimiento, tablas sin RLS, funciones sin search_path, errores en 24 h (API, BD, funciones),
// tamaño de la base de datos, usuarios y último acceso, incidencias de Sentry. Semáforo por proyecto y tarea
// «Requiere tu atención» solo cuando algo esté en rojo. Trabaja por tandas (se reanuda a sí misma).
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_CUENTA = Deno.env.get("CUENTA_SUPABASE_TOKEN") ?? "";
const SENTRY_TOKEN = Deno.env.get("SENTRY_AUTH_TOKEN") ?? "";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const ahora = () => new Date().toISOString();
const INICIO = Date.now();
const PRESUPUESTO_MS = 100_000;

// ---------- API de administración de Supabase ----------
async function admin(ruta: string, init: RequestInit = {}) {
  if (!TOKEN_CUENTA) throw new Error("Falta el secreto CUENTA_SUPABASE_TOKEN");
  const r = await fetch(`https://api.supabase.com/v1${ruta}`, { ...init, headers: { Authorization: `Bearer ${TOKEN_CUENTA}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const t = await r.text();
  let j: any; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  if (!r.ok) throw new Error(`API Supabase ${r.status} ${ruta.split("?")[0]}: ${String(j?.message ?? t).slice(0, 200)}`);
  return j;
}
async function sqlProyecto(ref: string, query: string) {
  const r = await admin(`/projects/${ref}/database/query`, { method: "POST", body: JSON.stringify({ query, read_only: true }) });
  return Array.isArray(r) ? r : (r?.result ?? r);
}
async function logsProyecto(ref: string, sql: string) {
  const fin = new Date(); const ini = new Date(fin.getTime() - 24 * 3600 * 1000);
  const p = new URLSearchParams({ sql, iso_timestamp_start: ini.toISOString(), iso_timestamp_end: fin.toISOString() });
  const r = await admin(`/projects/${ref}/analytics/endpoints/logs?${p}`);
  return (r?.result ?? r?.data ?? []) as any[];
}

// ---------- Sentry ----------
async function sentry(ruta: string) {
  if (!SENTRY_TOKEN) throw new Error("Falta SENTRY_AUTH_TOKEN");
  const r = await fetch(`https://sentry.io/api/0${ruta}`, { headers: { Authorization: `Bearer ${SENTRY_TOKEN}` } });
  const t = await r.text();
  if (!r.ok) throw new Error(`Sentry ${r.status}: ${t.slice(0, 200)}`);
  return JSON.parse(t);
}
async function orgSentry(sb: SB, cfg: any, userId: string) {
  if (cfg.sentry_org) return cfg.sentry_org as string;
  const orgs = await sentry("/organizations/");
  const slug = orgs?.[0]?.slug ?? null;
  if (slug) await sb.from("salud_config").update({ sentry_org: slug }).eq("user_id", userId);
  return slug;
}
async function incidenciasSentry(org: string, proyectoSlug: string) {
  const proyectos = await sentry(`/organizations/${org}/projects/`);
  const p = (proyectos ?? []).find((x: any) => x.slug === proyectoSlug || String(x.name).toLowerCase() === proyectoSlug.toLowerCase());
  if (!p) return null;
  const issues = await sentry(`/projects/${org}/${p.slug}/issues/?query=is:unresolved&statsPeriod=24h&sort=freq&limit=10`);
  return { slug: p.slug, incidencias: (issues ?? []).map((i: any) => ({ titulo: i.title, nivel: i.level, veces: Number(i.count ?? 0), usuarios: i.userCount ?? 0, url: i.permalink, ultima: i.lastSeen })) };
}

// ---------- Comprobación de un proyecto ----------
async function comprobarProyecto(sb: SB, cfg: any, fila: any, estadosCuenta: Record<string, any>, orgSentrySlug: string | null) {
  const ref = fila.supabase_ref; const motivos: string[] = []; const datos: Record<string, unknown> = { comprobado_el: ahora(), pendiente: false, error: null };
  let semaforo: "verde" | "ambar" | "rojo" | "gris" = "verde";
  const sube = (n: "ambar" | "rojo") => { if (n === "rojo") semaforo = "rojo"; else if (semaforo !== "rojo") semaforo = "ambar"; };
  try {
    if (!ref) { datos.semaforo = "gris"; datos.motivos = ["Sin Supabase asociado"]; await sb.from("salud_proyectos").update(datos).eq("id", fila.id); return "gris"; }
    const est = estadosCuenta[ref];
    datos.estado_supabase = est?.status ?? "DESCONOCIDO";
    if (!est) { motivos.push("El proyecto no aparece en la cuenta de Supabase"); sube("rojo"); }
    else if (est.status === "INACTIVE" || est.status === "PAUSED") { motivos.push("Proyecto PAUSADO por inactividad (los usuarios no pueden entrar)"); sube("rojo"); }
    else if (est.status !== "ACTIVE_HEALTHY") { motivos.push(`Estado ${est.status}`); sube("ambar"); }
    if (semaforo === "rojo" && (est?.status === "INACTIVE" || est?.status === "PAUSED")) { datos.semaforo = "rojo"; datos.motivos = motivos; await sb.from("salud_proyectos").update(datos).eq("id", fila.id); if (fila.proyecto_id) await sb.from("proyectos").update({ semaforo_salud: "rojo", salud_comprobada_el: ahora() }).eq("id", fila.proyecto_id); return "rojo"; }
    try { const s = await admin(`/projects/${ref}/health?services=auth,db,realtime,rest,storage`); datos.servicios = s; for (const x of s ?? []) if (x.status && x.status !== "ACTIVE_HEALTHY" && x.name !== "realtime") { motivos.push(`Servicio ${x.name}: ${x.status}`); sube("ambar"); } } catch (e) { datos.servicios = { error: String(e?.message ?? e).slice(0, 120) }; }
    try {
      const a = await admin(`/projects/${ref}/advisors/security`);
      const lints = (a?.lints ?? a ?? []) as any[];
      const graves = lints.filter((l) => l.level === "ERROR"); const avisos = lints.filter((l) => l.level === "WARN");
      datos.advisors_seguridad = graves.length + avisos.length;
      const lista = [...graves, ...avisos].slice(0, 40).map((l) => ({ tipo: "seguridad", nivel: l.level, nombre: l.name, titulo: l.title, detalle: String(l.detail ?? "").slice(0, 200), url: l.remediation }));
      if (cfg.incluir_rendimiento) { try { const p = await admin(`/projects/${ref}/advisors/performance`); const lp = (p?.lints ?? p ?? []) as any[]; const lpw = lp.filter((l) => l.level !== "INFO"); datos.advisors_rendimiento = lpw.length; lista.push(...lpw.slice(0, 20).map((l) => ({ tipo: "rendimiento", nivel: l.level, nombre: l.name, titulo: l.title, detalle: String(l.detail ?? "").slice(0, 200), url: l.remediation }))); } catch { /* opcional */ } }
      datos.advisors = lista;
      if (graves.length) { motivos.push(`${graves.length} aviso(s) de seguridad graves (advisors)`); sube("rojo"); }
      else if (avisos.length > 10) { motivos.push(`${avisos.length} avisos de seguridad`); sube("ambar"); }
    } catch (e) { datos.advisors = [{ tipo: "seguridad", nivel: "INFO", titulo: "No se pudieron leer los advisors", detalle: String(e?.message ?? e).slice(0, 150) }]; }
    try {
      const filas = await sqlProyecto(ref, `select
        (select coalesce(json_agg(relname order by relname), '[]'::json) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity) as sin_rls,
        (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')) as sin_search_path,
        round(pg_database_size(current_database())/1048576.0, 1) as bd_mb,
        (select count(*) from auth.users) as usuarios,
        (select max(last_sign_in_at) from auth.users) as ultimo_acceso`);
      const f = filas?.[0] ?? {};
      let sinRls: string[] = f.sin_rls ?? []; if (typeof sinRls === "string") { try { sinRls = JSON.parse(sinRls); } catch { sinRls = String(sinRls).replace(/^[{\[]|[}\]]$/g, "").split(",").map((x) => x.replace(/"/g, "").trim()).filter(Boolean); } }
      datos.tablas_sin_rls = sinRls.length; datos.tablas_sin_rls_lista = sinRls.slice(0, 50);
      datos.funciones_sin_search_path = Number(f.sin_search_path ?? 0);
      datos.bd_mb = Number(f.bd_mb ?? 0); datos.usuarios = Number(f.usuarios ?? 0); datos.ultimo_acceso = f.ultimo_acceso ?? null;
      if (sinRls.length) { motivos.push(`${sinRls.length} tabla(s) públicas sin RLS: ${sinRls.slice(0, 5).join(", ")}${sinRls.length > 5 ? "…" : ""}`); sube("rojo"); }
      if (Number(f.sin_search_path ?? 0) > 0) { motivos.push(`${f.sin_search_path} función(es) SECURITY DEFINER sin search_path`); sube("ambar"); }
      if (Number(f.bd_mb ?? 0) >= Number(cfg.umbral_bd_rojo_mb ?? 480)) { motivos.push(`Base de datos ${f.bd_mb} MB (límite cercano)`); sube("rojo"); }
      else if (Number(f.bd_mb ?? 0) >= Number(cfg.umbral_bd_mb ?? 400)) { motivos.push(`Base de datos ${f.bd_mb} MB`); sube("ambar"); }
    } catch (e) { motivos.push(`No se pudo consultar la base de datos: ${String(e?.message ?? e).slice(0, 120)}`); sube("ambar"); }
    try {
      const filas = await logsProyecto(ref, `select source, count() as n from logs where (source = 'edge_logs' and toInt32OrZero(log_attributes['response.status_code']) >= 500) or (source = 'function_edge_logs' and toInt32OrZero(log_attributes['response.status_code']) >= 500) or (source = 'postgres_logs' and log_attributes['parsed.error_severity'] in ('ERROR','FATAL','PANIC')) group by source`);
      const n = (s: string) => Number((filas.find((x: any) => x.source === s)?.n) ?? 0);
      datos.errores_api_24h = n("edge_logs"); datos.errores_funciones_24h = n("function_edge_logs"); datos.errores_bd_24h = n("postgres_logs");
      const total = n("edge_logs") + n("function_edge_logs") + n("postgres_logs");
      if (total >= Number(cfg.umbral_errores_rojo ?? 50)) { motivos.push(`${total} errores en 24 h (API ${n("edge_logs")}, funciones ${n("function_edge_logs")}, BD ${n("postgres_logs")})`); sube("rojo"); }
      else if (total >= Number(cfg.umbral_errores_ambar ?? 5)) { motivos.push(`${total} errores en 24 h`); sube("ambar"); }
    } catch (e) { datos.errores_api_24h = null; motivos.push(`Sin acceso a los registros: ${String(e?.message ?? e).slice(0, 100)}`); }
    if (orgSentrySlug) {
      try {
        const s = await incidenciasSentry(orgSentrySlug, fila.sentry_slug ?? fila.slug);
        if (s) { datos.sentry_incidencias = s.incidencias; const total = s.incidencias.reduce((a: number, i: any) => a + i.veces, 0); datos.sentry_errores_24h = total; if (s.incidencias.some((i: any) => i.nivel === "fatal") || total >= 50) { motivos.push(`Sentry: ${s.incidencias.length} incidencias (${total} eventos) en 24 h`); sube("rojo"); } else if (total > 0) { motivos.push(`Sentry: ${s.incidencias.length} incidencia(s) abiertas`); sube("ambar"); } }
      } catch { /* Sentry opcional */ }
    }
  } catch (e) { datos.error = String(e?.message ?? e).slice(0, 300); motivos.push(`Error al comprobar: ${datos.error}`); semaforo = "gris"; }
  datos.semaforo = semaforo; datos.motivos = motivos;
  await sb.from("salud_proyectos").update(datos).eq("id", fila.id);
  if (fila.proyecto_id) await sb.from("proyectos").update({ semaforo_salud: semaforo, salud_comprobada_el: ahora() }).eq("id", fila.proyecto_id);
  return semaforo;
}

async function config(sb: SB, userId: string) {
  const { data } = await sb.from("salud_config").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data;
  const { data: n } = await sb.from("salud_config").insert({ user_id: userId }).select("*").single();
  return n!;
}
async function crearInforme(sb: SB, userId: string, origen: string, soloProyecto?: string) {
  let q = sb.from("proyectos").select("id, nombre, slug, supabase_ref, sentry_slug").eq("user_id", userId).order("nombre");
  if (soloProyecto) q = q.eq("id", soloProyecto);
  const { data: proyectos } = await q;
  const { data: inf } = await sb.from("salud_informes").insert({ user_id: userId, origen, total: (proyectos ?? []).length }).select("*").single();
  if ((proyectos ?? []).length) await sb.from("salud_proyectos").insert((proyectos ?? []).map((p) => ({ user_id: userId, informe_id: inf!.id, proyecto_id: p.id, supabase_ref: p.supabase_ref, nombre: p.nombre })));
  return inf!;
}
async function continuar(sb: SB, informeId: string) {
  const { data: inf } = await sb.from("salud_informes").select("*").eq("id", informeId).maybeSingle();
  if (!inf || inf.estado !== "en_curso") return { hecho: true };
  const cfg = await config(sb, inf.user_id);
  let estados: Record<string, any> = {};
  try { const lista = await admin("/projects"); for (const p of lista ?? []) estados[p.id] = p; } catch { estados = {}; }
  let org: string | null = null; if (SENTRY_TOKEN) { try { org = await orgSentry(sb, cfg, inf.user_id); } catch { org = null; } }
  let hechos = 0;
  while (Date.now() - INICIO < PRESUPUESTO_MS) {
    const { data: fila } = await sb.from("salud_proyectos").select("*, proyectos(slug, sentry_slug)").eq("informe_id", informeId).eq("pendiente", true).order("nombre").limit(1).maybeSingle();
    if (!fila) break;
    const f = { ...fila, slug: fila.proyectos?.slug, sentry_slug: fila.proyectos?.sentry_slug };
    await comprobarProyecto(sb, cfg, f, estados, org); hechos++;
  }
  const { count: quedan } = await sb.from("salud_proyectos").select("id", { count: "exact", head: true }).eq("informe_id", informeId).eq("pendiente", true);
  if ((quedan ?? 0) > 0) {
    await sb.rpc("lanzar_salud", { p_accion: "continuar", p_informe: informeId });
    return { hecho: false, hechos, quedan };
  }
  await cerrarInforme(sb, inf, cfg);
  return { hecho: true, hechos };
}
async function cerrarInforme(sb: SB, inf: any, cfg: any) {
  const { data: filas } = await sb.from("salud_proyectos").select("nombre, semaforo, motivos, proyecto_id").eq("informe_id", inf.id);
  const cuenta = (s: string) => (filas ?? []).filter((f) => f.semaforo === s).length;
  const rojos = (filas ?? []).filter((f) => f.semaforo === "rojo"); const ambar = (filas ?? []).filter((f) => f.semaforo === "ambar");
  const resumen = `${cuenta("verde")} en verde · ${ambar.length} en ámbar · ${rojos.length} en rojo · ${cuenta("gris")} sin datos.` + (rojos.length ? ` Rojo: ${rojos.map((f) => `${f.nombre} (${(f.motivos ?? [])[0] ?? ""})`).join("; ")}.` : "");
  await sb.from("salud_informes").update({ estado: "terminado", verdes: cuenta("verde"), ambar: ambar.length, rojos: rojos.length, grises: cuenta("gris"), resumen, terminado_el: ahora() }).eq("id", inf.id);
  const avisar = cfg.avisar_solo_rojo ? rojos : [...rojos, ...ambar];
  for (const f of avisar) {
    const titulo = `Salud ${f.semaforo === "rojo" ? "en ROJO" : "en ámbar"}: ${f.nombre}`;
    const { data: ya } = await sb.from("tareas").select("id").eq("user_id", inf.user_id).eq("titulo", titulo).in("estado", ["pendiente", "en_cola", "esperando_revision", "bloqueada"]).limit(1);
    if (ya?.length) continue;
    await sb.from("tareas").insert({ user_id: inf.user_id, proyecto_id: f.proyecto_id, titulo, descripcion: (f.motivos ?? []).join("\n"), estado: "esperando_revision", prioridad: f.semaforo === "rojo" ? "critica" : "media", requiere_atencion: true, motivo_atencion: "Salud del proyecto", instrucciones: `Abre Salud → ${f.nombre} para ver el detalle y las soluciones propuestas (advisors con enlace a la documentación, tablas sin RLS, errores de las últimas 24 h). Cuando lo resuelvas, vuelve a comprobar el proyecto desde la misma pantalla.` });
  }
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
    const cuerpo = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const accion = String(cuerpo.accion ?? "estado");
    switch (accion) {
      case "programado": {
        if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
        const { data: usuarios } = await sb.from("salud_config").select("user_id, activo");
        const ids = new Set<string>((usuarios ?? []).filter((u) => u.activo).map((u) => u.user_id));
        if (!ids.size) { const { data: ps } = await sb.from("proyectos").select("user_id").limit(1); if (ps?.[0]) ids.add(ps[0].user_id); }
        const res: unknown[] = [];
        for (const uid of ids) { const inf = await crearInforme(sb, uid, "programado"); res.push(await continuar(sb, inf.id)); }
        return json({ ok: true, resultados: res });
      }
      case "continuar": {
        if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
        return json({ ok: true, ...(await continuar(sb, String(cuerpo.informe_id))) });
      }
      case "estado": {
        const cfg = await config(sb, userId!);
        const { data: ultimo } = await sb.from("salud_informes").select("*").eq("user_id", userId!).order("iniciado_el", { ascending: false }).limit(1).maybeSingle();
        return json({ ok: true, config: cfg, ultimo, token_cuenta: !!TOKEN_CUENTA, sentry: !!SENTRY_TOKEN, sentry_org: cfg.sentry_org ?? null });
      }
      case "configurar": {
        const permitidos = ["activo", "avisar_solo_rojo", "umbral_bd_mb", "umbral_bd_rojo_mb", "umbral_errores_ambar", "umbral_errores_rojo", "sentry_org", "incluir_rendimiento"];
        const cambios: Record<string, unknown> = { user_id: userId!, actualizado_el: ahora() };
        for (const k of permitidos) if (k in cuerpo) cambios[k] = cuerpo[k];
        const { data } = await sb.from("salud_config").upsert(cambios).select("*").single();
        return json({ ok: true, config: data });
      }
      case "comprobar": {
        const inf = await crearInforme(sb, userId!, "manual", cuerpo.proyecto_id ? String(cuerpo.proyecto_id) : undefined);
        const r = await continuar(sb, inf.id);
        const { data: fin } = await sb.from("salud_informes").select("*").eq("id", inf.id).single();
        return json({ ok: true, informe: fin, ...r });
      }
      case "probar": {
        const salida: Record<string, any> = {};
        try { const l = await admin("/projects"); salida.supabase = { ok: true, proyectos: (l ?? []).length, pausados: (l ?? []).filter((p: any) => p.status === "INACTIVE").map((p: any) => p.name) }; } catch (e) { salida.supabase = { ok: false, error: String(e?.message ?? e) }; }
        try { const cfg = await config(sb, userId!); const org = await orgSentry(sb, cfg, userId!); const ps = org ? await sentry(`/organizations/${org}/projects/`) : []; salida.sentry = { ok: !!org, org, proyectos: (ps ?? []).map((p: any) => p.slug) }; } catch (e) { salida.sentry = { ok: false, error: String(e?.message ?? e) }; }
        return json({ ok: salida.supabase.ok, ...salida });
      }
      case "asignar_sentry": {
        await sb.from("proyectos").update({ sentry_slug: cuerpo.sentry_slug ? String(cuerpo.sentry_slug) : null }).eq("id", String(cuerpo.proyecto_id)).eq("user_id", userId!);
        return json({ ok: true });
      }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (err) { return json({ ok: false, error: String(err?.message ?? err) }, 500); }
});
