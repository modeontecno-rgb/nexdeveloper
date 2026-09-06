// NexDeveloper · Edge Function «dominios-comprobar» (0.12.0)
// Comprueba DNS, HTTPS, caducidad del certificado y del dominio; avisa N días antes.
// Acciones: comprobar {dominio_id?} (usuario) · programado (x-cron-token) · sin acción → ping
import { createClient } from "npm:@supabase/supabase-js@2";
import tls from "node:tls";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const dias = (f: Date | null) => f ? Math.floor((f.getTime() - Date.now()) / 86400000) : null;
const conTiempo = <T,>(p: Promise<T>, ms: number, msg: string) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

// Certificado: primero por TLS directo (node:tls), si no, por crt.sh
async function certificado(host: string): Promise<{ emisor: string | null; hasta: Date | null; via: string }> {
  if (/\.(lovable\.app|supabase\.co|vercel\.app|netlify\.app)$/.test(host)) return { emisor: "Gestionado por la plataforma", hasta: null, via: "plataforma" };
  try {
    const r = await conTiempo(new Promise<{ emisor: string | null; hasta: Date | null }>((resolve, reject) => {
      const s = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false }, () => {
        try {
          const c: any = s.getPeerCertificate?.();
          s.end();
          if (c && c.valid_to) resolve({ emisor: c.issuer?.O ?? c.issuer?.CN ?? null, hasta: new Date(c.valid_to) });
          else reject(new Error("sin datos de certificado"));
        } catch (e) { reject(e); }
      });
      s.on("error", reject);
    }), 6000, "TLS: tiempo agotado");
    if (r.hasta && !isNaN(r.hasta.getTime())) return { ...r, via: "tls" };
  } catch (_) { /* seguimos */ }
  try {
    const r = await conTiempo(fetch(`https://crt.sh/?q=${encodeURIComponent(host)}&output=json`, { headers: { "User-Agent": "NexDeveloper" } }), 15000, "crt.sh: tiempo agotado");
    if (r.ok) {
      const lista = (await r.json()) as { not_after: string; issuer_name: string; name_value: string }[];
      const vigentes = lista.filter((c) => c.name_value.split("\n").some((n) => n === host || (n.startsWith("*.") && host.endsWith(n.slice(1))))).sort((a, b) => b.not_after.localeCompare(a.not_after));
      const c = vigentes[0];
      if (c) { const m = c.issuer_name.match(/O=([^,]+)/); return { emisor: m?.[1] ?? c.issuer_name.slice(0, 60), hasta: new Date(c.not_after + "Z"), via: "crt.sh" }; }
    }
  } catch (_) { /* nada */ }
  return { emisor: null, hasta: null, via: "ninguna" };
}

// Caducidad del dominio registrado (RDAP)
const raiz = (host: string) => { const p = host.split("."); const dos = p.slice(-2).join("."); return /\.(co|com|org|net)\.[a-z]{2}$/.test(host) ? p.slice(-3).join(".") : dos; };
async function caducidadDominio(host: string): Promise<{ hasta: Date | null; registrador: string | null }> {
  const dom = raiz(host);
  if (/\.(lovable\.app|synology\.me|supabase\.co|vercel\.app|netlify\.app|github\.io)$/.test(host)) return { hasta: null, registrador: null };
  try {
    const r = await conTiempo(fetch(`https://rdap.org/domain/${dom}`, { headers: { Accept: "application/rdap+json", "User-Agent": "NexDeveloper" }, redirect: "follow" }), 10000, "RDAP: tiempo agotado");
    if (!r.ok) return { hasta: null, registrador: null };
    const j = await r.json();
    const ev = (j.events ?? []).find((e: any) => e.eventAction === "expiration");
    const reg = (j.entities ?? []).find((e: any) => (e.roles ?? []).includes("registrar"));
    const nombre = reg?.vcardArray?.[1]?.find((v: any) => v[0] === "fn")?.[3] ?? reg?.handle ?? null;
    return { hasta: ev?.eventDate ? new Date(ev.eventDate) : null, registrador: nombre };
  } catch (_) { return { hasta: null, registrador: null }; }
}

async function comprobar(sb: SB, d: any) {
  const res: Record<string, unknown> = { ultima_comprobacion: new Date().toISOString(), actualizado_el: new Date().toISOString(), error: null, pendiente: false };
  const problemas: string[] = [];
  // DNS
  try { const ips = await conTiempo(Deno.resolveDns(d.dominio, "A"), 5000, "DNS: tiempo agotado"); res.ip_resuelta = ips[0] ?? null; res.dns_ok = ips.length > 0; }
  catch (e) { try { const ips6 = await Deno.resolveDns(d.dominio, "AAAA"); res.ip_resuelta = ips6[0] ?? null; res.dns_ok = ips6.length > 0; } catch { res.dns_ok = false; problemas.push("DNS no resuelve"); } }
  // HTTPS
  const t0 = Date.now();
  try {
    const r = await conTiempo(fetch(`https://${d.dominio}/`, { method: "GET", redirect: "follow", headers: { "User-Agent": "NexDeveloper-vigilancia" } }), 12000, "HTTPS: tiempo agotado");
    res.http_estado = r.status; res.https_ok = r.status < 500; res.tiempo_ms = Date.now() - t0;
    if (r.status >= 500) problemas.push(`HTTP ${r.status}`);
  } catch (e) { res.https_ok = false; res.tiempo_ms = Date.now() - t0; problemas.push(`Sin respuesta HTTPS (${String(e?.message ?? e).slice(0, 80)})`); }
  // Certificado
  const c = await certificado(d.dominio);
  res.cert_emisor = c.emisor; res.cert_valido_hasta = c.hasta?.toISOString() ?? null; res.cert_dias = dias(c.hasta);
  // Dominio
  const cad = await caducidadDominio(d.dominio);
  res.dominio_caduca = cad.hasta?.toISOString() ?? null; res.dominio_dias = dias(cad.hasta);
  if (cad.registrador && !d.registrador) res.registrador = cad.registrador;
  // Resultado
  let resultado = "ok";
  if (problemas.length || (res.cert_dias !== null && (res.cert_dias as number) < 0)) resultado = "error";
  else if ((res.cert_dias !== null && (res.cert_dias as number) <= d.aviso_dias) || (res.dominio_dias !== null && (res.dominio_dias as number) <= d.aviso_dias)) resultado = "aviso";
  if (res.cert_dias !== null && (res.cert_dias as number) < 0) problemas.push("Certificado caducado");
  res.resultado = resultado; res.error = problemas.length ? problemas.join("; ") : null;
  await sb.from("dominios").update(res).eq("id", d.id);
  await sb.from("dominios_historial").insert({ user_id: d.user_id, dominio_id: d.id, resultado, http_estado: res.http_estado ?? null, https_ok: res.https_ok ?? null, tiempo_ms: res.tiempo_ms ?? null, cert_dias: res.cert_dias ?? null, dominio_dias: res.dominio_dias ?? null, error: res.error ?? null });
  // Aviso (una tarea por dominio cada 7 días como mucho)
  const hacePoco = d.avisado_el && Date.now() - new Date(d.avisado_el).getTime() < 7 * 86400000;
  if (resultado !== "ok" && !hacePoco) {
    const motivo = resultado === "error" ? `Fallo en ${d.dominio}: ${res.error}` : `Caducidad próxima en ${d.dominio}: ${res.cert_dias !== null && (res.cert_dias as number) <= d.aviso_dias ? `certificado en ${res.cert_dias} días` : ""}${res.dominio_dias !== null && (res.dominio_dias as number) <= d.aviso_dias ? ` dominio en ${res.dominio_dias} días` : ""}`.trim();
    const { data: t } = await sb.from("tareas").insert({ user_id: d.user_id, proyecto_id: d.proyecto_id, titulo: motivo.slice(0, 200), descripcion: `Dominio: ${d.dominio}\nGestionado por: ${d.gestionado_por ?? "-"}\nEmisor del certificado: ${res.cert_emisor ?? "-"}\nCaduca certificado: ${res.cert_valido_hasta ?? "-"}\nCaduca dominio: ${res.dominio_caduca ?? "-"}`, estado: "pendiente", prioridad: resultado === "error" ? "alta" : "media", requiere_atencion: true, motivo_atencion: resultado === "error" ? "Dominio o servicio caído" : "Renovación próxima", instrucciones: resultado === "error" ? "Comprueba el servidor o el DNS y vuelve a comprobar desde Dominios." : "Renueva el certificado o el dominio en el proveedor y vuelve a comprobar desde Dominios." }).select("id").single();
    await sb.from("dominios").update({ avisado_el: new Date().toISOString(), tarea_id: t?.id ?? null }).eq("id", d.id);
    await sb.from("alertas").insert({ user_id: d.user_id, proyecto_id: d.proyecto_id, texto: motivo.slice(0, 300), nivel: resultado === "error" ? "critica" : "aviso", requiere_decision: false, referencia_tabla: "dominios", referencia_id: d.id }).then(() => {}, () => {});
  }
  if (resultado === "ok" && d.avisado_el) await sb.from("dominios").update({ avisado_el: null }).eq("id", d.id);
  return { dominio: d.dominio, resultado, ...res, cert_via: c.via };
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
    if (!accion) return json({ ok: true, listo: true });
    if (accion === "programado" && !esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
    // Un dominio concreto (usuario)
    if (cuerpo.dominio_id) {
      const { data: d } = await sb.from("dominios").select("*").eq("id", String(cuerpo.dominio_id)).eq("user_id", userId ?? "").maybeSingle();
      if (!d) return json({ ok: false, error: "Dominio no encontrado" }, 404);
      return json({ ok: true, comprobados: 1, resultados: [await comprobar(sb, d)] });
    }
    // Todos: se marcan como pendientes y se procesan por tandas de 4 encadenando llamadas (límite de tiempo de la función)
    if (accion === "comprobar_todos" || (accion === "programado" && !cuerpo.continuar)) {
      let m = sb.from("dominios").update({ pendiente: true }).eq("activo", true);
      if (!esServicio) m = m.eq("user_id", userId!);
      await m;
    }
    const { data: lista } = await sb.from("dominios").select("*").eq("activo", true).eq("pendiente", true).order("creado_el").limit(4);
    const resultados: unknown[] = [];
    for (const d of lista ?? []) { try { resultados.push(await comprobar(sb, d)); } catch (e) { resultados.push({ dominio: d.dominio, error: String(e?.message ?? e) }); await sb.from("dominios").update({ ultima_comprobacion: new Date().toISOString(), pendiente: false, resultado: "error", error: String(e?.message ?? e).slice(0, 200) }).eq("id", d.id); } }
    const { count } = await sb.from("dominios").select("id", { count: "exact", head: true }).eq("activo", true).eq("pendiente", true);
    if ((count ?? 0) > 0) await sb.rpc("lanzar_comprobacion_dominios_continuar");
    return json({ ok: true, comprobados: resultados.length, quedan: count ?? 0, resultados });
  } catch (e) { return json({ ok: false, error: String(e?.message ?? e) }, 500); }
});
