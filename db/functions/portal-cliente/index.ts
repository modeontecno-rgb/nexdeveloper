// NexDeveloper · Edge Function «portal-cliente» (0.28.0)
// Modo cliente: enlace de solo lectura por proyecto, con tu marca y «Powered by» cambiable, donde el cliente ve la versión
// actual, las hojas de cambios, los documentos (manuales, comerciales) y el estado de lo que ha pedido, y puede enviar
// peticiones. Acceso público por token (sin usuario); administración solo para el propietario.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_CUENTA = Deno.env.get("CUENTA_SUPABASE_TOKEN") ?? "";
const REF_PROYECTIAN = "hjtweberlereyfhagkvx";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const ahora = () => new Date().toISOString();
const sqlLit = (s: unknown) => s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`;
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const nuevoToken = () => b64url(crypto.getRandomValues(new Uint8Array(24)));

async function proyectianSql(sql: string) {
  if (!TOKEN_CUENTA) throw new Error("Falta CUENTA_SUPABASE_TOKEN");
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF_PROYECTIAN}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN_CUENTA}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql, read_only: true }) });
  if (!r.ok) throw new Error(`Proyectian ${r.status}`); return await r.json();
}
// ---------- S3 (enlaces firmados a documentos) ----------
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
async function hmac(key: ArrayBuffer | Uint8Array, msg: string) { const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return crypto.subtle.sign("HMAC", k, enc.encode(msg)); }
const codificar = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
type Destino = { endpoint: string; region: string; bucket: string; access: string; secret: string };
async function presignar(d: Destino, clave: string, nombre: string, seg = 3600, inline = true) {
  const u = new URL(d.endpoint); const host = u.host; const iso = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); const larga = iso, corta = iso.slice(0, 8);
  const path = `/${d.bucket}/${clave.split("/").map(codificar).join("/")}`;
  const q: Record<string, string> = { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${d.access}/${corta}/${d.region}/s3/aws4_request`, "X-Amz-Date": larga, "X-Amz-Expires": String(seg), "X-Amz-SignedHeaders": "host", "response-content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(nombre)}` };
  const cq = Object.keys(q).sort().map((k) => `${codificar(k)}=${codificar(q[k])}`).join("&");
  const canon = ["GET", path, cq, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const aFirmar = ["AWS4-HMAC-SHA256", larga, `${corta}/${d.region}/s3/aws4_request`, await sha256(canon)].join("\n");
  const a = await hmac(enc.encode("AWS4" + d.secret), corta); const b = await hmac(a, d.region); const c = await hmac(b, "s3"); const k = await hmac(c, "aws4_request");
  return `${u.protocol}//${host}${path}?${cq}&X-Amz-Signature=${hex(await hmac(k, aFirmar))}`;
}
async function destinoDocumentos(sb: SB, userId: string): Promise<Destino | null> {
  const { data: lista } = await sb.from("copias_destinos").select("id").eq("user_id", userId).eq("activo", true).order("usar_para_documentos", { ascending: false }).order("es_predeterminado", { ascending: false }).limit(1);
  const dest = lista?.[0]; if (!dest) return null;
  const { data } = await sb.rpc("leer_destino_copias", { p_destino_id: dest.id });
  const f = Array.isArray(data) ? data[0] : data; if (!f?.secreto) return null;
  return { endpoint: f.url_servidor.replace(/\/+$/, ""), region: f.region || "eu-central-1", bucket: "proyectian", access: f.usuario, secret: f.secreto };
}

// ---------- Datos públicos del portal ----------
async function datosPortal(sb: SB, portal: any) {
  const { data: p } = await sb.from("proyectos").select("id, nombre, slug, proyectian_slug, descripcion, version_actual, espacio_trabajo_url, semaforo_salud, salud_comprobada_el").eq("id", portal.proyecto_id).single();
  const { data: cfgApp } = await sb.from("configuracion_app").select("valor").eq("clave", "powered_by").maybeSingle();
  const s = portal.secciones ?? {};
  const out: any = { marca: { nombre: portal.marca?.nombre ?? "Soluciones EvoluteIA", color: portal.marca?.color ?? "#0f766e", logo_url: portal.marca?.logo_url ?? null, powered_by: portal.marca?.powered_by ?? cfgApp?.valor ?? "Modeontecno S.L.", mensaje_bienvenida: portal.marca?.mensaje_bienvenida ?? null }, cliente: portal.nombre_cliente, proyecto: { nombre: p!.nombre, descripcion: p!.descripcion, version: p!.version_actual, url: p!.espacio_trabajo_url }, secciones: s };
  if (s.estado !== false) out.estado = { semaforo: p!.semaforo_salud ?? "verde", comprobado_el: p!.salud_comprobada_el, texto: p!.semaforo_salud === "rojo" ? "Estamos revisando una incidencia" : p!.semaforo_salud === "ambar" ? "Funcionando con avisos menores" : "Todo funciona correctamente" };
  if (s.version !== false || s.cambios !== false) {
    try {
      const vs = await proyectianSql(`select v.id, v.numero, v.fecha, v.titulo, v.notas from public.versiones v join public.proyectos p on p.id = v.proyecto_id where p.slug = ${sqlLit(p!.proyectian_slug ?? p!.slug)} order by v.fecha desc, v.created_at desc limit 12`);
      const ids = (vs ?? []).map((v: any) => v.id);
      let cambios: any[] = [];
      if (ids.length && s.cambios !== false) cambios = await proyectianSql(`select version_id, titulo, descripcion, tipo, importancia from public.cambios where version_id in (${ids.map(sqlLit).join(",")}) order by created_at`);
      out.versiones = (vs ?? []).map((v: any) => ({ numero: v.numero, fecha: v.fecha, titulo: v.titulo, notas: s.cambios !== false ? v.notas : null, cambios: cambios.filter((c) => c.version_id === v.id).map((c) => ({ titulo: c.titulo, descripcion: c.descripcion, tipo: c.tipo, importancia: c.importancia })) }));
    } catch { out.versiones = []; }
  }
  if (s.documentos !== false) {
    const { data: docs } = await sb.from("documentos_nex").select("id, tipo, titulo, version, nombre_archivo, mime, bytes, ruta_remota, creado_el").eq("proyecto_id", p!.id).in("tipo", ["manual", "hoja_cambios", "comercial", "video"]).not("ruta_remota", "is", null).order("creado_el", { ascending: false }).limit(30);
    const d = await destinoDocumentos(sb, portal.user_id);
    out.documentos = [];
    for (const doc of docs ?? []) { let url: string | null = null; if (d) { try { url = await presignar(d, doc.ruta_remota, doc.nombre_archivo ?? doc.titulo, 3600, true); } catch { url = null; } } out.documentos.push({ id: doc.id, tipo: doc.tipo, titulo: doc.titulo, version: doc.version, fecha: doc.creado_el, bytes: doc.bytes, url }); }
  }
  if (s.peticiones !== false) {
    const { data: pet } = await sb.from("portal_peticiones").select("id, texto, tipo, estado, respuesta, respondida_el, creado_el").eq("portal_id", portal.id).order("creado_el", { ascending: false }).limit(50);
    out.peticiones = pet ?? [];
  }
  if (s.contacto !== false) { const { data: c } = await sb.from("configuracion_app").select("valor").eq("clave", "whatsapp_url").maybeSingle(); out.contacto = { whatsapp_url: c?.valor ?? null, email: portal.marca?.email_contacto ?? null }; }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = servicio();
  const url = new URL(req.url);
  try {
    const cuerpo = req.method === "POST" ? await req.json().catch(() => ({})) : Object.fromEntries(url.searchParams);
    const accion = String(cuerpo.accion ?? (req.method === "GET" ? "ver" : "estado"));
    // ---- Acceso público por token ----
    if (accion === "ver" || accion === "peticion") {
      const token = String(cuerpo.token ?? "");
      const { data: portal } = await sb.from("portales_cliente").select("*").eq("token", token).maybeSingle();
      if (!portal || !portal.activo || (portal.expira_el && new Date(portal.expira_el) < new Date())) return json({ ok: false, error: "Este enlace no está disponible" }, 404);
      if (accion === "ver") {
        await sb.from("portales_cliente").update({ visitas: (portal.visitas ?? 0) + 1, ultimo_acceso: ahora() }).eq("id", portal.id);
        return json({ ok: true, ...(await datosPortal(sb, portal)) });
      }
      const texto = String(cuerpo.texto ?? "").trim(); if (texto.length < 5) return json({ ok: false, error: "Escribe la petición" });
      if ((portal.secciones ?? {}).peticiones === false) return json({ ok: false, error: "Las peticiones no están activas" });
      const { count } = await sb.from("portal_peticiones").select("id", { count: "exact", head: true }).eq("portal_id", portal.id).gte("creado_el", new Date(Date.now() - 3600_000).toISOString());
      if ((count ?? 0) >= 10) return json({ ok: false, error: "Demasiadas peticiones seguidas; inténtalo más tarde" }, 429);
      const tipo = ["peticion", "incidencia", "pregunta"].includes(cuerpo.tipo) ? cuerpo.tipo : "peticion";
      const { data: t } = await sb.from("tareas").insert({ user_id: portal.user_id, proyecto_id: portal.proyecto_id, titulo: `${tipo === "incidencia" ? "Incidencia" : tipo === "pregunta" ? "Pregunta" : "Petición"} del cliente${portal.nombre_cliente ? ` (${portal.nombre_cliente})` : ""}: ${texto.slice(0, 80)}`, descripcion: texto + (cuerpo.contacto ? `\n\nContacto: ${cuerpo.contacto}` : ""), estado: "pendiente", prioridad: tipo === "incidencia" ? "alta" : "media", requiere_atencion: true, motivo_atencion: "Petición desde el portal del cliente", instrucciones: "Revisa la petición en Modo cliente → Peticiones, decide si se hace y responde al cliente desde allí (o conviértela en orden para la IA)." }).select("id").single();
      const { data: pet } = await sb.from("portal_peticiones").insert({ portal_id: portal.id, user_id: portal.user_id, proyecto_id: portal.proyecto_id, texto, contacto: cuerpo.contacto ?? null, tipo, tarea_id: t?.id ?? null }).select("id, creado_el").single();
      return json({ ok: true, peticion: pet });
    }
    // ---- Administración (propietario) ----
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) return json({ ok: false, error: "No autorizado" }, 401);
    const userId = u.user.id;
    const base = String(cuerpo.base_url ?? "https://nexdeveloper.lovable.app");
    switch (accion) {
      case "estado": {
        const { data: portales } = await sb.from("portales_cliente").select("*, proyectos(nombre, slug)").eq("user_id", userId).order("creado_el", { ascending: false });
        const { count } = await sb.from("portal_peticiones").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("estado", "nueva");
        return json({ ok: true, portales: (portales ?? []).map((p) => ({ ...p, url: `${base}/cliente/${p.token}` })), peticiones_nuevas: count ?? 0 });
      }
      case "crear": {
        const { data: p } = await sb.from("proyectos").select("id, nombre").eq("id", String(cuerpo.proyecto_id)).eq("user_id", userId).maybeSingle();
        if (!p) return json({ ok: false, error: "Proyecto no encontrado" });
        const { data: portal } = await sb.from("portales_cliente").insert({ user_id: userId, proyecto_id: p.id, token: nuevoToken(), nombre_cliente: cuerpo.nombre_cliente ?? null, contacto_email: cuerpo.contacto_email ?? null, marca: cuerpo.marca ?? {}, secciones: cuerpo.secciones ?? undefined, expira_el: cuerpo.expira_el ?? null }).select("*").single();
        return json({ ok: true, portal: { ...portal, url: `${base}/cliente/${portal!.token}` } });
      }
      case "actualizar": {
        const permitidos = ["nombre_cliente", "contacto_email", "marca", "secciones", "activo", "expira_el"];
        const cambios: Record<string, unknown> = { actualizado_el: ahora() };
        for (const k of permitidos) if (k in cuerpo) cambios[k] = cuerpo[k];
        const { data } = await sb.from("portales_cliente").update(cambios).eq("id", String(cuerpo.portal_id)).eq("user_id", userId).select("*").single();
        return json({ ok: true, portal: { ...data, url: `${base}/cliente/${data!.token}` } });
      }
      case "regenerar_token": {
        const { data } = await sb.from("portales_cliente").update({ token: nuevoToken(), actualizado_el: ahora() }).eq("id", String(cuerpo.portal_id)).eq("user_id", userId).select("*").single();
        return json({ ok: true, portal: { ...data, url: `${base}/cliente/${data!.token}` } });
      }
      case "borrar": { await sb.from("portales_cliente").delete().eq("id", String(cuerpo.portal_id)).eq("user_id", userId); return json({ ok: true }); }
      case "vista_previa": {
        const { data: portal } = await sb.from("portales_cliente").select("*").eq("id", String(cuerpo.portal_id)).eq("user_id", userId).maybeSingle();
        if (!portal) return json({ ok: false, error: "Portal no encontrado" });
        return json({ ok: true, ...(await datosPortal(sb, portal)) });
      }
      case "responder": {
        const { data: pet } = await sb.from("portal_peticiones").select("*").eq("id", String(cuerpo.peticion_id)).eq("user_id", userId).maybeSingle();
        if (!pet) return json({ ok: false, error: "Petición no encontrada" });
        const estado = ["nueva", "vista", "en_curso", "hecha", "descartada"].includes(cuerpo.estado) ? cuerpo.estado : pet.estado;
        await sb.from("portal_peticiones").update({ estado, respuesta: cuerpo.respuesta ?? pet.respuesta, respondida_el: cuerpo.respuesta ? ahora() : pet.respondida_el }).eq("id", pet.id);
        if (pet.tarea_id && ["hecha", "descartada"].includes(estado)) await sb.from("tareas").update({ estado: estado === "hecha" ? "completada" : "cancelada", requiere_atencion: false, atendida_el: ahora(), completada_el: estado === "hecha" ? ahora() : null }).eq("id", pet.tarea_id);
        if (cuerpo.crear_orden) { const { data: o } = await sb.from("ordenes").insert({ user_id: userId, proyecto_id: pet.proyecto_id, texto: pet.texto, modo: "equilibrado", prioridad: "media", estado: "aprobada", ejecutar_con: "lovable", requiere_atencion: false, comentario: "Petición del cliente desde el portal" }).select("id").single(); await sb.from("portal_peticiones").update({ estado: "en_curso" }).eq("id", pet.id); return json({ ok: true, orden_id: o?.id }); }
        return json({ ok: true });
      }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (err) { return json({ ok: false, error: String(err?.message ?? err) }, 500); }
});
