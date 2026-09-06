// NexDeveloper · Edge Function «infraestructura» (0.30.0)
// Control total de la infraestructura: inventario de servicios (descubierto + manual), comprobación continua cada 10 min
// (Supabase, GitHub, Lovable, DNS, HTTP, TCP, almacén S3, Edge Functions, proveedores de IA, Sentry, Proyectian, servidores),
// incidencias con los proyectos y módulos afectados (aviso push + tarea), y sincronización por proyecto GitHub ↔ Supabase ↔ Mac
// (último commit, versión del repo frente a la de la app, migraciones y funciones del repo frente a las aplicadas/desplegadas).
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_CUENTA = Deno.env.get("CUENTA_SUPABASE_TOKEN") ?? "";
const TOKEN_GITHUB = Deno.env.get("GITHUB_TOKEN") ?? "";
const SENTRY_TOKEN = Deno.env.get("SENTRY_AUTH_TOKEN") ?? "";
const REF_PROYECTIAN = "hjtweberlereyfhagkvx";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
type Sem = "verde" | "ambar" | "rojo" | "gris";
const ahora = () => new Date().toISOString();
const INICIO = Date.now();
const PRESUPUESTO_MS = 95_000;
const quedaTiempo = () => Date.now() - INICIO < PRESUPUESTO_MS;

async function conTiempo<T>(p: Promise<T>, ms = 12_000): Promise<T> {
  let t: number | undefined;
  const limite = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`Sin respuesta en ${ms / 1000} s`)), ms); });
  try { return await Promise.race([p, limite]); } finally { clearTimeout(t); }
}
async function admin(ruta: string, init: RequestInit = {}) {
  if (!TOKEN_CUENTA) throw new Error("Falta el secreto CUENTA_SUPABASE_TOKEN");
  const r = await conTiempo(fetch(`https://api.supabase.com/v1${ruta}`, { ...init, headers: { Authorization: `Bearer ${TOKEN_CUENTA}`, "Content-Type": "application/json", ...(init.headers ?? {}) } }));
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  if (!r.ok) throw new Error(`API Supabase ${r.status}: ${String(j?.message ?? t).slice(0, 160)}`);
  return j;
}
async function gh(ruta: string) {
  const r = await conTiempo(fetch(`https://api.github.com${ruta}`, { headers: { Authorization: TOKEN_GITHUB ? `Bearer ${TOKEN_GITHUB}` : "", Accept: "application/vnd.github+json", "User-Agent": "NexDeveloper" } }));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return await r.json();
}

// ---------- S3 (comprobación firmada del bucket) ----------
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
async function hmac(key: ArrayBuffer | Uint8Array, msg: string) { const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return crypto.subtle.sign("HMAC", k, enc.encode(msg)); }
async function comprobarS3(endpoint: string, region: string, bucket: string, access: string, secret: string) {
  const u = new URL(endpoint); const host = u.host; const iso = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); const corta = iso.slice(0, 8);
  const path = `/${bucket}`; const q = "max-keys=1";
  const cabs = { host, "x-amz-content-sha256": "UNSIGNED-PAYLOAD", "x-amz-date": iso };
  const canon = ["GET", path, q, `host:${host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${iso}\n`, "host;x-amz-content-sha256;x-amz-date", "UNSIGNED-PAYLOAD"].join("\n");
  const aFirmar = ["AWS4-HMAC-SHA256", iso, `${corta}/${region}/s3/aws4_request`, await sha256(canon)].join("\n");
  const a = await hmac(enc.encode("AWS4" + secret), corta); const b = await hmac(a, region); const c = await hmac(b, "s3"); const k = await hmac(c, "aws4_request");
  const firma = hex(await hmac(k, aFirmar));
  const r = await conTiempo(fetch(`${u.protocol}//${host}${path}?${q}`, { headers: { ...cabs, Authorization: `AWS4-HMAC-SHA256 Credential=${access}/${corta}/${region}/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${firma}` } }));
  if (!r.ok) throw new Error(`Almacén ${r.status}`);
  return `Bucket «${bucket}» accesible`;
}

// ---------- Comprobación de un servicio ----------
type Resultado = { estado: Sem; ms: number; detalle?: string; error?: string };
async function comprobarServicio(sb: SB, s: any, cfg: any): Promise<Resultado> {
  const t0 = Date.now(); const m = s.metodo ?? {};
  const fin = (estado: Sem, detalle?: string, error?: string): Resultado => ({ estado, ms: Date.now() - t0, detalle, error });
  try {
    switch (s.tipo) {
      case "supabase": {
        const ref = s.referencia; if (!ref) return fin("gris", undefined, "Sin referencia de proyecto");
        const p = await admin(`/projects/${ref}`);
        if (p?.status === "INACTIVE" || p?.status === "PAUSED") return fin("rojo", `Proyecto ${p.status}`, "Proyecto pausado: los usuarios no pueden entrar");
        const servicios = String(m.servicios ?? "auth,db,rest,storage");
        const h = await admin(`/projects/${ref}/health?services=${servicios}`);
        const caidos = (h ?? []).filter((x: any) => x.status && x.status !== "ACTIVE_HEALTHY" && x.name !== "realtime");
        if (caidos.length) return fin("rojo", `Servicios con problemas: ${caidos.map((x: any) => `${x.name} (${x.status})`).join(", ")}`, `Servicio ${caidos[0].name}: ${caidos[0].status}`);
        if (p?.status !== "ACTIVE_HEALTHY") return fin("ambar", `Estado ${p?.status}`);
        return fin("verde", `${(h ?? []).length} servicios sanos · región ${p?.region ?? "?"}`);
      }
      case "github": {
        const repo = s.referencia; if (!repo) { const r = await conTiempo(fetch("https://api.github.com/", { headers: { "User-Agent": "NexDeveloper" } })); return r.ok ? fin("verde", "API de GitHub disponible") : fin("rojo", undefined, `GitHub ${r.status}`); }
        const r = await gh(`/repos/${repo}`);
        if (!r) return fin("rojo", undefined, "Repositorio no encontrado o sin acceso");
        return fin("verde", `Rama ${r.default_branch} · último cambio ${new Date(r.pushed_at).toLocaleString("es-ES")}`);
      }
      case "funcion": {
        // Ping (preflight) a una Edge Function de NexDeveloper: basta con que responda
        const nombre = s.referencia; if (!nombre) return fin("gris", undefined, "Sin nombre de función");
        const r = await conTiempo(fetch(`${URL_SUPABASE}/functions/v1/${nombre}`, { method: "OPTIONS" }));
        return r.ok || r.status === 204 ? fin("verde", `Función «${nombre}» responde`) : fin("rojo", undefined, `HTTP ${r.status}`);
      }
      case "dns": {
        const host = s.url ?? s.referencia; if (!host) return fin("gris", undefined, "Sin host");
        const tipo = String(m.tipo_dns ?? "A");
        const r = await conTiempo(fetch(`${cfg.resolver_dns}?name=${encodeURIComponent(host)}&type=${tipo}`, { headers: { Accept: "application/dns-json" } }));
        const j = await r.json();
        const resp = (j?.Answer ?? []).map((a: any) => a.data);
        if (j?.Status !== 0 || !resp.length) return fin("rojo", undefined, `DNS sin respuesta ${tipo} para ${host} (estado ${j?.Status})`);
        if (m.esperado && !resp.some((x: string) => String(x).replace(/\.$/, "") === String(m.esperado).replace(/\.$/, ""))) return fin("rojo", `Resuelve a ${resp.join(", ")}`, `Se esperaba ${m.esperado}`);
        return fin("verde", `${tipo} → ${resp.slice(0, 3).join(", ")}`);
      }
      case "tcp": {
        const host = s.url ?? s.referencia; const puerto = Number(m.puerto ?? 443); if (!host) return fin("gris", undefined, "Sin host");
        const c = await conTiempo(Deno.connect({ hostname: host.replace(/^.*:\/\//, "").split("/")[0], port: puerto }), 8000);
        try { c.close(); } catch { /* nada */ }
        return fin("verde", `Puerto ${puerto} abierto`);
      }
      case "s3": {
        const { data } = await sb.rpc("leer_destino_copias", { p_destino_id: s.referencia });
        const d = Array.isArray(data) ? data[0] : data; if (!d?.secreto) return fin("gris", undefined, "Sin credenciales del destino");
        const det = await comprobarS3(String(d.url_servidor).replace(/\/+$/, ""), d.region || "eu-central-1", String(m.bucket ?? d.bucket ?? "copias"), d.usuario, d.secreto);
        return fin("verde", det);
      }
      case "sentry": {
        if (!SENTRY_TOKEN) return fin("gris", undefined, "Sin SENTRY_AUTH_TOKEN");
        const r = await conTiempo(fetch("https://sentry.io/api/0/organizations/", { headers: { Authorization: `Bearer ${SENTRY_TOKEN}` } }));
        return r.ok ? fin("verde", "API de Sentry disponible") : fin("rojo", undefined, `Sentry ${r.status}`);
      }
      case "proyectian": {
        const r = await admin(`/projects/${REF_PROYECTIAN}/health?services=db,rest,auth`);
        const caidos = (r ?? []).filter((x: any) => x.status !== "ACTIVE_HEALTHY");
        return caidos.length ? fin("rojo", undefined, `Proyectian: ${caidos.map((x: any) => x.name).join(", ")}`) : fin("verde", "Proyectian operativo");
      }
      case "proveedor_ia": {
        // Sin usar la clave: basta con que el endpoint responda (401/403/404 también significan «vivo»)
        const url = s.url; if (!url) return fin("gris", undefined, "Sin URL");
        const r = await conTiempo(fetch(url, { method: "GET", redirect: "manual" }));
        return r.status < 500 ? fin("verde", `Responde (HTTP ${r.status})`) : fin("rojo", undefined, `HTTP ${r.status}`);
      }
      default: {
        // http / lovable / servidor / correo / otro: petición HTTP
        const url = s.url; if (!url) return fin("gris", undefined, "Sin URL");
        const esperado = Number(m.esperado ?? 0);
        const r = await conTiempo(fetch(url, { method: String(m.metodo_http ?? "GET"), redirect: "manual", headers: { "User-Agent": "NexDeveloper-Infra/1.0" } }));
        const ok = esperado ? r.status === esperado : r.status < 400 || (r.status >= 300 && r.status < 400);
        if (!ok) return fin("rojo", undefined, `HTTP ${r.status}`);
        if (m.texto) { const t = await r.text(); if (!t.includes(String(m.texto))) return fin("rojo", `HTTP ${r.status}`, `No aparece el texto esperado «${m.texto}»`); }
        const ms = Date.now() - t0;
        return ms > Number(cfg.umbral_lento_ms ?? 3000) ? fin("ambar", `Lento: ${ms} ms (HTTP ${r.status})`) : fin("verde", `HTTP ${r.status} · ${ms} ms`);
      }
    }
  } catch (e) { return fin("rojo", undefined, String(e?.message ?? e).slice(0, 200)); }
}

// ---------- Impacto: proyectos y módulos afectados ----------
async function impacto(sb: SB, servicio: any) {
  const { data: deps } = await sb.from("infra_dependencias").select("proyecto_id, modulos, critica, proyectos(nombre, slug)").eq("servicio_id", servicio.id);
  let lista = (deps ?? []).map((d: any) => ({ proyecto_id: d.proyecto_id, nombre: d.proyectos?.nombre, slug: d.proyectos?.slug, modulos: d.modulos ?? [], critica: d.critica }));
  const afectaTodo = servicio.ambito === "global";
  if (afectaTodo && !lista.length) {
    const { data: ps } = await sb.from("proyectos").select("id, nombre, slug").eq("user_id", servicio.user_id);
    const modulos = MODULOS_GLOBALES[servicio.tipo] ?? ["Todo el proyecto"];
    lista = (ps ?? []).map((p) => ({ proyecto_id: p.id, nombre: p.nombre, slug: p.slug, modulos, critica: servicio.tipo !== "github" && servicio.tipo !== "sentry" }));
  }
  return { lista, afectaTodo };
}
const MODULOS_GLOBALES: Record<string, string[]> = {
  github: ["Publicación de cambios", "Ejecución de órdenes por la IA", "Auditoría", "Manuales", "Copias de repositorios"],
  lovable: ["Construcción y publicación de la app", "Ejecución de órdenes por la IA"],
  s3: ["Copias de seguridad", "Documentos y manuales", "Compilaciones", "Facturas"],
  proveedor_ia: ["Asistente", "Órdenes de la IA", "Documentación", "Manuales", "Auditoría", "Resúmenes"],
  sentry: ["Errores en tiempo real (Salud)"],
  proyectian: ["Versiones y documentos en Proyectian", "Usuarios de clientes"],
  dns: ["Acceso por dominio"],
};

async function abrirIncidencia(sb: SB, s: any, cfg: any, r: Resultado) {
  const { data: ya } = await sb.from("infra_incidencias").select("id").eq("servicio_id", s.id).eq("estado", "abierta").limit(1);
  if (ya?.length) return;
  const { lista, afectaTodo } = await impacto(sb, s);
  const criticos = lista.filter((x) => x.critica);
  const titulo = `Caída de ${s.nombre}`;
  const resumenProy = afectaTodo ? `Afecta a TODOS los proyectos (${lista.length})` : lista.length ? `Proyectos afectados: ${lista.slice(0, 8).map((x) => `${x.nombre}${x.modulos?.length ? ` (${x.modulos.slice(0, 3).join(", ")})` : ""}`).join("; ")}${lista.length > 8 ? "…" : ""}` : "Sin proyectos dependientes registrados";
  const detalle = `${r.error ?? r.detalle ?? "Sin detalle"}.\n${resumenProy}.`;
  let tareaId: string | null = null;
  if (cfg.crear_tareas) {
    const { data: t } = await sb.from("tareas").insert({ user_id: s.user_id, proyecto_id: lista.length === 1 ? lista[0].proyecto_id : null, titulo: `INFRAESTRUCTURA: ${titulo}`, descripcion: detalle, estado: "esperando_revision", prioridad: criticos.length || afectaTodo ? "critica" : "alta", requiere_atencion: true, motivo_atencion: "Servicio caído", instrucciones: `Abre Infraestructura → ${s.nombre} para ver el detalle, los proyectos y módulos afectados y el histórico. ${s.url ? `URL: ${s.url}. ` : ""}Cuando se recupere, la incidencia se cierra sola y recibirás el aviso.` }).select("id").single();
    tareaId = t?.id ?? null;
  }
  await sb.from("infra_incidencias").insert({ user_id: s.user_id, servicio_id: s.id, titulo, detalle, proyectos_afectados: lista, afecta_todo: afectaTodo, tarea_id: tareaId });
  if (cfg.avisar_push && !tareaId) await sb.rpc("crear_aviso", { p_user: s.user_id, p_tipo: "infraestructura", p_titulo: `🔴 ${titulo}`, p_cuerpo: detalle, p_url: "/infraestructura", p_proyecto: null, p_referencia: `caida:${s.id}:${Date.now()}` });
}
async function cerrarIncidencia(sb: SB, s: any, cfg: any) {
  const { data: abiertas } = await sb.from("infra_incidencias").select("id, abierta_el, tarea_id").eq("servicio_id", s.id).eq("estado", "abierta");
  for (const i of abiertas ?? []) {
    const min = Math.round((Date.now() - new Date(i.abierta_el).getTime()) / 60000);
    await sb.from("infra_incidencias").update({ estado: "resuelta", resuelta_el: ahora(), duracion_min: min }).eq("id", i.id);
    if (i.tarea_id) await sb.from("tareas").update({ estado: "completada", completada_el: ahora(), completada_por: "infraestructura", requiere_atencion: false }).eq("id", i.tarea_id);
    if (cfg.avisar_push) await sb.rpc("crear_aviso", { p_user: s.user_id, p_tipo: "infraestructura", p_titulo: `🟢 Recuperado: ${s.nombre}`, p_cuerpo: `Tras ${min} min sin servicio. Revisa los proyectos afectados por si quedó algo a medias.`, p_url: "/infraestructura", p_proyecto: null, p_referencia: `recuperado:${i.id}` });
  }
}

async function config(sb: SB, userId: string) {
  const { data } = await sb.from("infra_config").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data;
  const { data: n } = await sb.from("infra_config").insert({ user_id: userId }).select("*").single();
  return n!;
}
async function comprobarTodos(sb: SB, userId: string, soloId?: string) {
  const cfg = await config(sb, userId);
  let q = sb.from("infra_servicios").select("*").eq("user_id", userId).eq("activo", true).order("comprobado_el", { ascending: true, nullsFirst: true });
  if (soloId) q = q.eq("id", soloId);
  const { data: servicios } = await q;
  const res: any[] = []; let hechos = 0;
  // En paralelo por grupos de 6 para caber en el presupuesto
  const lista = servicios ?? [];
  for (let i = 0; i < lista.length && quedaTiempo(); i += 6) {
    const grupo = lista.slice(i, i + 6);
    const rs = await Promise.all(grupo.map((s) => comprobarServicio(sb, s, cfg)));
    for (let k = 0; k < grupo.length; k++) {
      const s = grupo[k]; const r = rs[k]; hechos++;
      const fallos = r.estado === "rojo" ? Number(s.fallos_seguidos ?? 0) + 1 : 0;
      // Rojo confirmado solo tras N fallos seguidos (evita falsos positivos); mientras tanto ámbar
      const estadoFinal: Sem = r.estado === "rojo" && fallos < Number(cfg.fallos_para_rojo ?? 2) && !soloId ? "ambar" : r.estado;
      await sb.from("infra_servicios").update({ estado: estadoFinal, fallos_seguidos: fallos, ultimo_ms: r.ms, ultimo_detalle: r.detalle ?? null, ultimo_error: r.error ?? null, comprobado_el: ahora(), ultimo_verde_el: r.estado === "verde" ? ahora() : s.ultimo_verde_el, actualizado_el: ahora() }).eq("id", s.id);
      await sb.from("infra_comprobaciones").insert({ user_id: userId, servicio_id: s.id, estado: r.estado, ms: r.ms, detalle: r.detalle ?? null, error: r.error ?? null });
      if (estadoFinal === "rojo") await abrirIncidencia(sb, { ...s, estado: "rojo" }, cfg, r);
      else if (r.estado === "verde" && (s.estado === "rojo" || s.estado === "ambar")) await cerrarIncidencia(sb, s, cfg);
      res.push({ id: s.id, nombre: s.nombre, estado: estadoFinal, ms: r.ms, error: r.error ?? null });
    }
  }
  // Semáforo por proyecto (peor estado de los servicios de los que depende + globales)
  await recalcularProyectos(sb, userId);
  // Renovaciones próximas (30 días)
  const { data: renov } = await sb.from("infra_servicios").select("id, nombre, renovacion_el").eq("user_id", userId).eq("activo", true).not("renovacion_el", "is", null).lte("renovacion_el", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  for (const s of renov ?? []) await sb.rpc("crear_aviso", { p_user: userId, p_tipo: "infraestructura", p_titulo: `Renovación próxima: ${s.nombre}`, p_cuerpo: `Caduca el ${new Date(s.renovacion_el).toLocaleDateString("es-ES")}. Renueva el contrato para que no se caiga.`, p_url: "/infraestructura", p_proyecto: null, p_referencia: `renovacion:${s.id}:${s.renovacion_el}` });
  return { hechos, total: lista.length, resultados: res };
}
async function recalcularProyectos(sb: SB, userId: string) {
  const { data: ps } = await sb.from("proyectos").select("id").eq("user_id", userId);
  const { data: globales } = await sb.from("infra_servicios").select("estado, critico").eq("user_id", userId).eq("activo", true).eq("ambito", "global");
  const { data: deps } = await sb.from("infra_dependencias").select("proyecto_id, critica, infra_servicios(estado, activo)").eq("user_id", userId);
  const peor = (a: Sem, b: Sem) => (["rojo", "ambar", "verde", "gris"].indexOf(a) <= ["rojo", "ambar", "verde", "gris"].indexOf(b) ? a : b);
  for (const p of ps ?? []) {
    let s: Sem = "gris";
    const mios = (deps ?? []).filter((d: any) => d.proyecto_id === p.id && d.infra_servicios?.activo);
    for (const d of mios as any[]) { const e: Sem = d.infra_servicios.estado; s = peor(s === "gris" ? e : s, d.critica ? e : (e === "rojo" ? "ambar" : e)); }
    for (const g of globales ?? []) { const e: Sem = g.estado; if (e === "gris") continue; s = peor(s === "gris" ? e : s, g.critico ? e : (e === "rojo" ? "ambar" : e)); }
    await sb.from("proyectos").update({ semaforo_infra: s }).eq("id", p.id);
  }
}

// ---------- Descubrimiento automático del inventario ----------
async function descubrir(sb: SB, userId: string) {
  const creados: string[] = []; const clavesVistas = new Set<string>();
  const upsert = async (clave: string, datos: any, dependencias?: { proyecto_id: string; modulos: string[]; critica?: boolean }[]) => {
    clavesVistas.add(clave);
    const { data: ya } = await sb.from("infra_servicios").select("id").eq("user_id", userId).eq("clave_descubrimiento", clave).maybeSingle();
    let id = ya?.id;
    if (!id) { const { data: n } = await sb.from("infra_servicios").insert({ user_id: userId, origen: "descubierto", clave_descubrimiento: clave, ...datos }).select("id").single(); id = n?.id; if (id) creados.push(datos.nombre); }
    else await sb.from("infra_servicios").update({ url: datos.url, referencia: datos.referencia, actualizado_el: ahora() }).eq("id", id);
    for (const d of dependencias ?? []) await sb.from("infra_dependencias").upsert({ user_id: userId, servicio_id: id, proyecto_id: d.proyecto_id, modulos: d.modulos, critica: d.critica ?? true }, { onConflict: "servicio_id,proyecto_id" });
  };
  const { data: ps } = await sb.from("proyectos").select("id, nombre, slug, supabase_ref, repositorio, lovable_project_id, espacio_trabajo_url").eq("user_id", userId);
  // Un Supabase por proyecto
  for (const p of ps ?? []) {
    if (p.supabase_ref) await upsert(`supabase:${p.supabase_ref}`, { nombre: `Supabase · ${p.nombre}`, tipo: "supabase", proveedor: "Supabase", url: `https://${p.supabase_ref}.supabase.co`, referencia: p.supabase_ref, critico: true }, [{ proyecto_id: p.id, modulos: ["Base de datos", "Acceso de usuarios", "API", "Archivos", "Funciones"] }]);
    if (p.repositorio) await upsert(`github:${p.repositorio}`, { nombre: `GitHub · ${p.repositorio}`, tipo: "github", proveedor: "GitHub", url: `https://github.com/${p.repositorio}`, referencia: p.repositorio, critico: false }, [{ proyecto_id: p.id, modulos: ["Código fuente", "Publicación de cambios", "Órdenes de la IA"], critica: false }]);
    if (p.lovable_project_id) await upsert(`lovable:${p.lovable_project_id}`, { nombre: `App publicada · ${p.nombre}`, tipo: "http", proveedor: "Lovable", url: `https://${p.slug}.lovable.app`, referencia: p.lovable_project_id, critico: true, metodo: {} }, [{ proyecto_id: p.id, modulos: ["Aplicación web (acceso de los usuarios)"] }]);
  }
  // Dominios → DNS + HTTPS
  const { data: doms } = await sb.from("dominios").select("id, dominio, tipo, proyecto_id, activo").eq("user_id", userId).eq("activo", true);
  for (const d of doms ?? []) {
    const deps = d.proyecto_id ? [{ proyecto_id: d.proyecto_id, modulos: ["Acceso por dominio", "Certificado HTTPS"] }] : [];
    await upsert(`dns:${d.dominio}`, { nombre: `DNS · ${d.dominio}`, tipo: "dns", proveedor: "DNS", url: d.dominio, referencia: d.id, critico: true, ambito: d.proyecto_id ? "proyecto" : "proyecto" }, deps);
    await upsert(`https:${d.dominio}`, { nombre: `Web · ${d.dominio}`, tipo: "http", proveedor: "Hosting", url: `https://${d.dominio}`, referencia: d.id, critico: true }, deps);
  }
  // Almacén S3 (global)
  const { data: dest } = await sb.from("copias_destinos").select("id, nombre, url_servidor, bucket").eq("user_id", userId).eq("activo", true);
  for (const d of dest ?? []) await upsert(`s3:${d.id}`, { nombre: `Almacén · ${d.nombre}`, tipo: "s3", proveedor: "MinIO/S3", url: d.url_servidor, referencia: d.id, ambito: "global", critico: false, metodo: { bucket: d.bucket } });
  // Proveedores de IA activos (global)
  const { data: prov } = await sb.from("proveedores_ia").select("id, nombre, clave_slug, url_base, activo").eq("user_id", userId).eq("activo", true);
  for (const p of prov ?? []) if (p.url_base && !p.url_base.includes("localhost")) await upsert(`ia:${p.clave_slug}`, { nombre: `IA · ${p.nombre}`, tipo: "proveedor_ia", proveedor: p.nombre, url: p.url_base, referencia: p.clave_slug, ambito: "global", critico: false });
  // Plataformas globales
  await upsert("plataforma:github", { nombre: "GitHub (API)", tipo: "github", proveedor: "GitHub", url: "https://api.github.com", ambito: "global", critico: false });
  await upsert("plataforma:lovable", { nombre: "Lovable (constructor)", tipo: "http", proveedor: "Lovable", url: "https://lovable.dev", ambito: "global", critico: false });
  await upsert("plataforma:supabase-api", { nombre: "Supabase (API de administración)", tipo: "http", proveedor: "Supabase", url: "https://api.supabase.com/v1/projects", ambito: "global", critico: false, metodo: { esperado: 401 } });
  await upsert("plataforma:proyectian", { nombre: "Proyectian (base de datos)", tipo: "proyectian", proveedor: "Supabase", url: `https://${REF_PROYECTIAN}.supabase.co`, referencia: REF_PROYECTIAN, ambito: "global", critico: false });
  if (SENTRY_TOKEN) await upsert("plataforma:sentry", { nombre: "Sentry", tipo: "sentry", proveedor: "Sentry", url: "https://sentry.io", ambito: "global", critico: false });
  await upsert("plataforma:nexdeveloper-app", { nombre: "NexDeveloper (app)", tipo: "http", proveedor: "Lovable", url: "https://nexdeveloper.lovable.app", ambito: "global", critico: true });
  // Edge Functions propias de NexDeveloper
  for (const f of ["salud", "ordenes-ejecutar", "copias-generar", "avisos", "asistente", "infraestructura"]) await upsert(`funcion:${f}`, { nombre: `Función · ${f}`, tipo: "funcion", proveedor: "Supabase", url: `${URL_SUPABASE}/functions/v1/${f}`, referencia: f, ambito: "global", critico: f === "infraestructura" });
  return { creados };
}

// ---------- Sincronización GitHub ↔ Supabase ↔ Mac ----------
async function sincronizarProyecto(sb: SB, cfg: any, p: any) {
  const datos: Record<string, unknown> = { user_id: p.user_id, comprobado_el: ahora(), error: null, version_app: p.version_actual ?? null };
  const motivos: string[] = []; let sem: Sem = "verde";
  const sube = (n: Sem) => { if (n === "rojo") sem = "rojo"; else if (n === "ambar" && sem !== "rojo") sem = "ambar"; };
  try {
    if (!p.repositorio) { motivos.push("Sin repositorio en GitHub"); sem = "gris"; }
    else {
      const repo = await gh(`/repos/${p.repositorio}`);
      if (!repo) { motivos.push("Repositorio no accesible"); sube("rojo"); }
      else {
        const rama = repo.default_branch; datos.github_rama = rama;
        const commits = await gh(`/repos/${p.repositorio}/commits?sha=${rama}&per_page=30`) ?? [];
        const ult = commits[0];
        if (ult) { datos.github_sha = ult.sha; datos.github_fecha = ult.commit?.committer?.date ?? ult.commit?.author?.date; datos.github_autor = ult.commit?.author?.name ?? null; }
        const hace7 = Date.now() - 7 * 86400000;
        datos.commits_7d = commits.filter((c: any) => new Date(c.commit?.committer?.date ?? 0).getTime() > hace7).length;
        const dias = ult ? Math.floor((Date.now() - new Date(datos.github_fecha as string).getTime()) / 86400000) : 999;
        if (dias > Number(cfg.dias_sin_commit_ambar ?? 30)) { motivos.push(`Sin cambios en GitHub desde hace ${dias} días`); sube("ambar"); }
        // Versión del repo
        try { const pk = await gh(`/repos/${p.repositorio}/contents/package.json?ref=${rama}`); if (pk?.content) { const v = JSON.parse(atob(String(pk.content).replace(/\n/g, ""))).version; datos.version_repo = v ?? null; if (v && p.version_actual && v !== p.version_actual) { motivos.push(`La versión del repositorio (${v}) no coincide con la de NexDeveloper (${p.version_actual})`); sube("ambar"); } } } catch { /* sin package.json */ }
        // Migraciones y funciones del repo
        let migRepo: string[] = []; let funRepo: string[] = [];
        try { const tree = await gh(`/repos/${p.repositorio}/git/trees/${rama}?recursive=1`); const paths: string[] = (tree?.tree ?? []).map((t: any) => t.path); migRepo = paths.filter((x) => /^(supabase|db)\/migrations\/[^/]+\.sql$/.test(x)).map((x) => x.split("/").pop()!.replace(/\.sql$/, "")); funRepo = [...new Set(paths.filter((x) => /^(supabase|db)\/functions\/[^/]+\/index\.ts$/.test(x)).map((x) => x.split("/")[2]))]; } catch { /* árbol no disponible */ }
        datos.migraciones_repo = migRepo.length; datos.funciones_repo = funRepo;
        if (p.supabase_ref && TOKEN_CUENTA) {
          try {
            const apl = await admin(`/projects/${p.supabase_ref}/database/migrations`);
            const aplicadas: { version: string; name?: string }[] = Array.isArray(apl) ? apl : [];
            datos.migraciones_aplicadas = aplicadas.length;
            // Emparejamiento: por versión (prefijo numérico) o por nombre normalizado (sin números ni fechas, en minúsculas)
            const norm = (s: string) => String(s ?? "").toLowerCase().replace(/^\d+_?/, "").replace(/^v?\d+(\.\d+)*_?/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
            const igual = (a: string, b: string) => { const x = norm(a), y = norm(b); return !!x && !!y && x.length >= 4 && y.length >= 4 && (x === y || x.includes(y) || y.includes(x)); };
            const versiones = new Set(aplicadas.map((m) => String(m.version)));
            const noRegistradas = migRepo.filter((f) => { const ver = f.split("_")[0]; return !versiones.has(ver) && !aplicadas.some((m) => igual(f, m.name ?? "")); });
            // Lovable aplica sus migraciones sin anotarlas en el registro: solo cuentan como pendientes las POSTERIORES a la última anotada
            const ultimaVersion = [...versiones].sort().pop() ?? "0";
            const pend = noRegistradas.filter((f) => /^\d{14}/.test(f) ? f.split("_")[0] > ultimaVersion : true);
            const antiguasSinRegistro = noRegistradas.length - pend.length;
            const sinRepo = aplicadas.filter((m) => !migRepo.some((f) => f.startsWith(String(m.version)) || igual(f, m.name ?? ""))).map((m) => `${m.version}${m.name ? `_${m.name}` : ""}`);
            datos.migraciones_pendientes = pend.slice(0, 50); datos.migraciones_sin_repo = sinRepo.slice(0, 50);
            if (pend.length) { motivos.push(`${pend.length} migración(es) del repositorio posteriores a la última aplicada en Supabase (${ultimaVersion}): ${pend.slice(0, 4).join(", ")}${pend.length > 4 ? "…" : ""}`); sube("rojo"); }
            if (antiguasSinRegistro) motivos.push(`${antiguasSinRegistro} migración(es) antiguas del repositorio no constan en el registro de Supabase (aplicadas por Lovable sin anotar): informativo`);
            if (sinRepo.length && migRepo.length) { motivos.push(`${sinRepo.length} migración(es) aplicadas en Supabase que no están en el repositorio`); sube("ambar"); }
            else if (sinRepo.length && !migRepo.length) motivos.push(`El repositorio no guarda migraciones (${aplicadas.length} aplicadas en Supabase): conviene exportarlas a supabase/migrations`);
          } catch (e) { motivos.push(`No se pudieron leer las migraciones: ${String(e?.message ?? e).slice(0, 80)}`); sube("ambar"); }
          try {
            const fs = await admin(`/projects/${p.supabase_ref}/functions`);
            const desplegadas: string[] = (Array.isArray(fs) ? fs : []).filter((f: any) => f.status === "ACTIVE").map((f: any) => f.slug);
            datos.funciones_desplegadas = desplegadas;
            const sinDesplegar = funRepo.filter((f) => !desplegadas.includes(f)); const sinRepoF = desplegadas.filter((f) => !funRepo.includes(f));
            datos.funciones_sin_desplegar = sinDesplegar; datos.funciones_sin_repo = sinRepoF;
            if (sinDesplegar.length) { motivos.push(`Funciones en el repositorio sin desplegar: ${sinDesplegar.slice(0, 5).join(", ")}`); sube("rojo"); }
            if (sinRepoF.length && funRepo.length) { motivos.push(`Funciones desplegadas que no están en el repositorio: ${sinRepoF.slice(0, 5).join(", ")}`); sube("ambar"); }
          } catch (e) { motivos.push(`No se pudieron leer las funciones: ${String(e?.message ?? e).slice(0, 80)}`); sube("ambar"); }
        }
        // Copia del Mac (si el Mac ha informado)
        const { data: prev } = await sb.from("infra_sincronizacion").select("mac_sha, mac_fecha, mac_reportado_el").eq("proyecto_id", p.id).maybeSingle();
        if (prev?.mac_sha && datos.github_sha && prev.mac_sha !== datos.github_sha) { motivos.push(`La copia del Mac (${String(prev.mac_sha).slice(0, 7)}) va por detrás de GitHub (${String(datos.github_sha).slice(0, 7)})`); sube("ambar"); }
        if (prev?.mac_reportado_el && Date.now() - new Date(prev.mac_reportado_el).getTime() > 3 * 86400000) { motivos.push("El Mac no informa de su copia desde hace más de 3 días"); sube("ambar"); }
      }
    }
  } catch (e) { datos.error = String(e?.message ?? e).slice(0, 300); motivos.push(`Error: ${datos.error}`); sem = "gris"; }
  datos.semaforo = sem; datos.motivos = motivos;
  await sb.from("infra_sincronizacion").upsert({ proyecto_id: p.id, ...datos }, { onConflict: "proyecto_id" });
  await sb.from("proyectos").update({ semaforo_sincronizacion: sem }).eq("id", p.id);
  return { proyecto: p.nombre, semaforo: sem, motivos };
}
async function sincronizarTodos(sb: SB, userId: string, soloProyecto?: string) {
  const cfg = await config(sb, userId);
  let q = sb.from("proyectos").select("id, user_id, nombre, slug, repositorio, supabase_ref, version_actual").eq("user_id", userId).order("nombre");
  if (soloProyecto) q = q.eq("id", soloProyecto);
  const { data: ps } = await q;
  const { data: previos } = await sb.from("infra_sincronizacion").select("proyecto_id, comprobado_el").eq("user_id", userId);
  const orden = (ps ?? []).sort((a, b) => { const fa = previos?.find((x) => x.proyecto_id === a.id)?.comprobado_el ?? ""; const fb = previos?.find((x) => x.proyecto_id === b.id)?.comprobado_el ?? ""; return fa.localeCompare(fb); });
  const res: any[] = [];
  for (const p of orden) { if (!quedaTiempo()) break; res.push(await sincronizarProyecto(sb, cfg, p)); }
  // Tareas para los rojos (una abierta por proyecto)
  if (cfg.crear_tareas) for (const r of res.filter((x) => x.semaforo === "rojo")) {
    const p = orden.find((x) => x.nombre === r.proyecto)!; const titulo = `Sincronización en ROJO: ${p.nombre}`;
    const { data: ya } = await sb.from("tareas").select("id").eq("user_id", userId).eq("titulo", titulo).in("estado", ["pendiente", "esperando_revision", "bloqueada"]).limit(1);
    if (!ya?.length) await sb.from("tareas").insert({ user_id: userId, proyecto_id: p.id, titulo, descripcion: r.motivos.join("\n"), estado: "esperando_revision", prioridad: "alta", requiere_atencion: true, motivo_atencion: "GitHub y Supabase no coinciden", instrucciones: "Infraestructura → Sincronización → abre el proyecto: aplica las migraciones pendientes o despliega las funciones que falten (o pide a la IA que lo haga con una orden)." });
  }
  return { hechos: res.length, total: (ps ?? []).length, resultados: res };
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
    if (esServicio && cuerpo.user_id) userId = String(cuerpo.user_id); // el servicio (cron o script del Mac) puede actuar en nombre del propietario
    const usuariosActivos = async () => { const { data } = await sb.from("infra_config").select("user_id, activo"); const ids = (data ?? []).filter((u) => u.activo).map((u) => u.user_id); if (!ids.length) { const { data: ps } = await sb.from("proyectos").select("user_id").limit(1); if (ps?.[0]) ids.push(ps[0].user_id); } return ids; };
    switch (accion) {
      case "programado": {
        if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
        const res: unknown[] = [];
        for (const uid of await usuariosActivos()) { const cfg = await config(sb, uid); const { data: ult } = await sb.from("infra_servicios").select("comprobado_el").eq("user_id", uid).order("comprobado_el", { ascending: false }).limit(1).maybeSingle(); if (ult?.comprobado_el && Date.now() - new Date(ult.comprobado_el).getTime() < (Number(cfg.intervalo_min ?? 10) - 1) * 60000) continue; res.push(await comprobarTodos(sb, uid)); }
        return json({ ok: true, resultados: res });
      }
      case "sincronizar_programado": {
        if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
        const res: unknown[] = [];
        for (const uid of await usuariosActivos()) res.push(await sincronizarTodos(sb, uid));
        return json({ ok: true, resultados: res });
      }
      case "reportar_mac": {
        // Lo llama un pequeño script del Mac (con el token de cron o la sesión): {slug|proyecto_id, sha, fecha}
        const { data: p } = cuerpo.proyecto_id ? await sb.from("proyectos").select("id, user_id").eq("id", String(cuerpo.proyecto_id)).maybeSingle() : await sb.from("proyectos").select("id, user_id").eq("slug", String(cuerpo.slug ?? "")).maybeSingle();
        if (!p) return json({ ok: false, error: "Proyecto no encontrado" }, 404);
        if (!esServicio && p.user_id !== userId) return json({ ok: false, error: "No autorizado" }, 403);
        await sb.from("infra_sincronizacion").upsert({ proyecto_id: p.id, user_id: p.user_id, mac_sha: String(cuerpo.sha ?? ""), mac_fecha: cuerpo.fecha ?? ahora(), mac_reportado_el: ahora() }, { onConflict: "proyecto_id" });
        return json({ ok: true });
      }
      case "estado": {
        const cfg = await config(sb, userId!);
        const { data: servicios } = await sb.from("infra_servicios").select("*").eq("user_id", userId!).order("estado").order("nombre");
        const { data: incidencias } = await sb.from("infra_incidencias").select("*, infra_servicios(nombre, tipo)").eq("user_id", userId!).order("abierta_el", { ascending: false }).limit(50);
        const { data: sinc } = await sb.from("infra_sincronizacion").select("*, proyectos(nombre, slug, color)").eq("user_id", userId!);
        const { data: deps } = await sb.from("infra_dependencias").select("*, proyectos(nombre)").eq("user_id", userId!);
        const cuenta = (e: string) => (servicios ?? []).filter((s) => s.activo && s.estado === e).length;
        const global: Sem = cuenta("rojo") ? "rojo" : cuenta("ambar") ? "ambar" : cuenta("verde") ? "verde" : "gris";
        return json({ ok: true, config: cfg, global, resumen: { verdes: cuenta("verde"), ambar: cuenta("ambar"), rojos: cuenta("rojo"), grises: cuenta("gris"), incidencias_abiertas: (incidencias ?? []).filter((i) => i.estado === "abierta").length, sincronizacion_roja: (sinc ?? []).filter((s) => s.semaforo === "rojo").length }, servicios, incidencias, sincronizacion: sinc, dependencias: deps, secretos: { supabase: !!TOKEN_CUENTA, github: !!TOKEN_GITHUB, sentry: !!SENTRY_TOKEN } });
      }
      case "configurar": {
        const permitidos = ["activo", "intervalo_min", "sincronizar_cada_h", "umbral_lento_ms", "fallos_para_rojo", "avisar_push", "crear_tareas", "dias_sin_commit_ambar", "resolver_dns"];
        const cambios: Record<string, unknown> = { user_id: userId!, actualizado_el: ahora() };
        for (const k of permitidos) if (k in cuerpo) cambios[k] = cuerpo[k];
        const { data } = await sb.from("infra_config").upsert(cambios).select("*").single();
        return json({ ok: true, config: data });
      }
      case "descubrir": { const r = await descubrir(sb, userId!); const c = await comprobarTodos(sb, userId!); return json({ ok: true, ...r, comprobados: c.hechos }); }
      case "comprobar": return json({ ok: true, ...(await comprobarTodos(sb, userId!, cuerpo.servicio_id ? String(cuerpo.servicio_id) : undefined)) });
      case "sincronizar": return json({ ok: true, ...(await sincronizarTodos(sb, userId!, cuerpo.proyecto_id ? String(cuerpo.proyecto_id) : undefined)) });
      case "servicio_guardar": {
        const permitidos = ["nombre", "tipo", "proveedor", "url", "referencia", "metodo", "ambito", "critico", "activo", "coste_mensual", "renovacion_el", "notas"];
        const cambios: Record<string, unknown> = { user_id: userId!, actualizado_el: ahora() };
        for (const k of permitidos) if (k in cuerpo) cambios[k] = cuerpo[k];
        if (cuerpo.id) cambios.id = cuerpo.id;
        const { data, error } = await sb.from("infra_servicios").upsert(cambios).select("*").single();
        if (error) throw error;
        if (Array.isArray(cuerpo.dependencias)) {
          await sb.from("infra_dependencias").delete().eq("servicio_id", data!.id);
          for (const d of cuerpo.dependencias) await sb.from("infra_dependencias").insert({ user_id: userId!, servicio_id: data!.id, proyecto_id: String(d.proyecto_id), modulos: d.modulos ?? [], critica: d.critica ?? true });
        }
        const cfg = await config(sb, userId!); const r = await comprobarServicio(sb, data, cfg);
        await sb.from("infra_servicios").update({ estado: r.estado, ultimo_ms: r.ms, ultimo_detalle: r.detalle ?? null, ultimo_error: r.error ?? null, comprobado_el: ahora(), fallos_seguidos: r.estado === "rojo" ? 1 : 0 }).eq("id", data!.id);
        return json({ ok: true, servicio: { ...data, ...r }, comprobacion: r });
      }
      case "adoptar_version": {
        // La versión del repositorio pasa a ser la del proyecto en NexDeveloper (cuando GitHub va por delante)
        const { data: s } = await sb.from("infra_sincronizacion").select("version_repo").eq("proyecto_id", String(cuerpo.proyecto_id)).eq("user_id", userId!).maybeSingle();
        if (!s?.version_repo) return json({ ok: false, error: "Aún no se conoce la versión del repositorio" }, 400);
        await sb.from("proyectos").update({ version_actual: s.version_repo, actualizado_el: ahora() }).eq("id", String(cuerpo.proyecto_id)).eq("user_id", userId!);
        const cfg = await config(sb, userId!); const { data: p } = await sb.from("proyectos").select("id, user_id, nombre, slug, repositorio, supabase_ref, version_actual").eq("id", String(cuerpo.proyecto_id)).single();
        return json({ ok: true, version: s.version_repo, sincronizacion: p ? await sincronizarProyecto(sb, cfg, p) : null });
      }
      case "servicio_borrar": { await sb.from("infra_servicios").delete().eq("id", String(cuerpo.id)).eq("user_id", userId!); return json({ ok: true }); }
      case "dependencia_guardar": {
        const { data, error } = await sb.from("infra_dependencias").upsert({ user_id: userId!, servicio_id: String(cuerpo.servicio_id), proyecto_id: String(cuerpo.proyecto_id), modulos: cuerpo.modulos ?? [], critica: cuerpo.critica ?? true }, { onConflict: "servicio_id,proyecto_id" }).select("*").single();
        if (error) throw error; await recalcularProyectos(sb, userId!);
        return json({ ok: true, dependencia: data });
      }
      case "dependencia_borrar": { await sb.from("infra_dependencias").delete().eq("id", String(cuerpo.id)).eq("user_id", userId!); await recalcularProyectos(sb, userId!); return json({ ok: true }); }
      case "impacto": {
        const { data: s } = await sb.from("infra_servicios").select("*").eq("id", String(cuerpo.servicio_id)).eq("user_id", userId!).single();
        if (!s) return json({ ok: false, error: "Servicio no encontrado" }, 404);
        const { lista, afectaTodo } = await impacto(sb, s);
        return json({ ok: true, servicio: s.nombre, afecta_todo: afectaTodo, proyectos: lista });
      }
      case "historico": {
        const { data } = await sb.from("infra_comprobaciones").select("estado, ms, detalle, error, comprobado_el").eq("servicio_id", String(cuerpo.servicio_id)).eq("user_id", userId!).order("comprobado_el", { ascending: false }).limit(Number(cuerpo.limite ?? 288));
        const total = (data ?? []).length; const verdes = (data ?? []).filter((x) => x.estado === "verde").length;
        return json({ ok: true, historico: data ?? [], disponibilidad_pct: total ? Math.round(verdes / total * 1000) / 10 : null, ms_medio: total ? Math.round((data ?? []).reduce((a, x) => a + Number(x.ms ?? 0), 0) / total) : null });
      }
      case "incidencia": {
        const cambios: Record<string, unknown> = {};
        if (cuerpo.estado) cambios.estado = String(cuerpo.estado); if ("notas" in cuerpo) cambios.notas = cuerpo.notas;
        if (cuerpo.estado === "resuelta" || cuerpo.estado === "ignorada") cambios.resuelta_el = ahora();
        const { data } = await sb.from("infra_incidencias").update(cambios).eq("id", String(cuerpo.id)).eq("user_id", userId!).select("*").single();
        return json({ ok: true, incidencia: data });
      }
      case "ideas": {
        // Sugerencias de cobertura: qué falta por vigilar
        const { data: servicios } = await sb.from("infra_servicios").select("tipo, ambito, activo, renovacion_el, coste_mensual").eq("user_id", userId!);
        const { data: ps } = await sb.from("proyectos").select("id, nombre, supabase_ref, repositorio, lovable_project_id").eq("user_id", userId!);
        const { data: deps } = await sb.from("infra_dependencias").select("proyecto_id").eq("user_id", userId!);
        const ideas: { titulo: string; detalle: string }[] = [];
        const sinDeps = (ps ?? []).filter((p) => !(deps ?? []).some((d) => d.proyecto_id === p.id));
        if (sinDeps.length) ideas.push({ titulo: `${sinDeps.length} proyecto(s) sin dependencias registradas`, detalle: `Pulsa «Descubrir» o añade a mano de qué servicios dependen: ${sinDeps.slice(0, 5).map((p) => p.nombre).join(", ")}.` });
        const sinSupabase = (ps ?? []).filter((p) => !p.supabase_ref); if (sinSupabase.length) ideas.push({ titulo: "Proyectos sin Supabase asociado", detalle: sinSupabase.map((p) => p.nombre).join(", ") });
        const sinRepo = (ps ?? []).filter((p) => !p.repositorio); if (sinRepo.length) ideas.push({ titulo: "Proyectos sin repositorio", detalle: sinRepo.map((p) => p.nombre).join(", ") });
        if (!(servicios ?? []).some((s) => s.tipo === "correo")) ideas.push({ titulo: "Vigilar el correo saliente", detalle: "Añade el servidor SMTP o el proveedor de correo (Resend, Gmail) como servicio tipo «correo» para saber si dejan de salir los correos de acceso y avisos." });
        if (!(servicios ?? []).some((s) => s.tipo === "servidor" || s.tipo === "tcp")) ideas.push({ titulo: "Servidores propios", detalle: "Si contratas un VPS o tienes el NAS/MinIO en casa, añádelo como «servidor» (HTTP) o «tcp» (puerto) con su fecha de renovación y coste mensual." });
        if (!(servicios ?? []).some((s) => s.renovacion_el)) ideas.push({ titulo: "Fechas de renovación", detalle: "Apunta en cada servicio cuándo caduca (dominios, servidores, planes de pago): recibirás aviso 30 días antes." });
        if (!(servicios ?? []).some((s) => s.coste_mensual)) ideas.push({ titulo: "Coste mensual de la infraestructura", detalle: "Rellena el coste de cada servicio para ver cuánto te cuesta al mes cada proyecto (se repercute en Facturación)." });
        if (!SENTRY_TOKEN) ideas.push({ titulo: "Errores en tiempo real", detalle: "Configura SENTRY_AUTH_TOKEN para ver los errores de las apps en Salud e Infraestructura." });
        ideas.push({ titulo: "Informe del Mac", detalle: "Un pequeño script en el Mac (lanzado cada hora) puede informar del último commit de cada copia local con la acción «reportar_mac»; así sabrás si la copia local va por detrás de GitHub." });
        ideas.push({ titulo: "Página pública de estado", detalle: "Con el modo cliente (0.28.0) puedes enseñar a cada cliente el estado de SU aplicación (sección «estado» del portal)." });
        return json({ ok: true, ideas });
      }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (err) { return json({ ok: false, error: String(err?.message ?? err) }, 500); }
});
