// NexDeveloper · Edge Function «copias-generar»
// Copias de seguridad de TODAS las bases de datos (Supabase de la cuenta) y TODOS los repositorios (GitHub)
// hacia un destino S3 propio (MinIO en Konectian). Autenticación: x-cron-token (servicio) o sesión de usuario.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_CUENTA = Deno.env.get("CUENTA_SUPABASE_TOKEN") ?? Deno.env.get("SUPABASE_ACCESS_TOKEN") ?? "";
const TOKEN_GITHUB = Deno.env.get("GITHUB_TOKEN") ?? "";
const API_SUPABASE = "https://api.supabase.com/v1";
const API_GITHUB = "https://api.github.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });

// ---------- SigV4 ----------
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string | Uint8Array) => hex(await crypto.subtle.digest("SHA-256", typeof s === "string" ? enc.encode(s) : s));
async function hmac(key: ArrayBuffer | Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
}
const codificar = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const codificarClave = (k: string) => k.split("/").map(codificar).join("/");
function fechaAmz() { const iso = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); return { larga: iso, corta: iso.slice(0, 8) }; }
type Destino = { endpoint: string; region: string; bucket: string; prefijo: string; access: string; secret: string };
async function claveFirma(d: Destino, corta: string) {
  const a = await hmac(enc.encode("AWS4" + d.secret), corta);
  const b = await hmac(a, d.region); const c = await hmac(b, "s3"); return hmac(c, "aws4_request");
}
async function s3(d: Destino, metodo: string, ruta: string, query: Record<string, string> = {}, cuerpo?: Uint8Array, contentType?: string) {
  const u = new URL(d.endpoint); const host = u.host; const { larga, corta } = fechaAmz();
  const hashCuerpo = cuerpo ? await sha256(cuerpo) : await sha256("");
  const cab: Record<string, string> = { host, "x-amz-content-sha256": hashCuerpo, "x-amz-date": larga };
  if (contentType) cab["content-type"] = contentType;
  const firmadas = Object.keys(cab).sort();
  const canonCab = firmadas.map((k) => `${k}:${cab[k].trim()}\n`).join("");
  const canonQuery = Object.keys(query).sort().map((k) => `${codificar(k)}=${codificar(query[k])}`).join("&");
  const canon = [metodo, ruta, canonQuery, canonCab, firmadas.join(";"), hashCuerpo].join("\n");
  const aFirmar = ["AWS4-HMAC-SHA256", larga, `${corta}/${d.region}/s3/aws4_request`, await sha256(canon)].join("\n");
  const firma = hex(await hmac(await claveFirma(d, corta), aFirmar));
  const headers: Record<string, string> = { ...cab, Authorization: `AWS4-HMAC-SHA256 Credential=${d.access}/${corta}/${d.region}/s3/aws4_request, SignedHeaders=${firmadas.join(";")}, Signature=${firma}` };
  delete headers.host;
  return fetch(`${u.protocol}//${host}${ruta}${canonQuery ? "?" + canonQuery : ""}`, { method: metodo, headers, body: cuerpo });
}
async function presignarGet(d: Destino, clave: string, nombre: string, caducaSeg = 3600) {
  const u = new URL(d.endpoint); const host = u.host; const { larga, corta } = fechaAmz();
  const path = `/${d.bucket}/${codificarClave(clave)}`;
  const q: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${d.access}/${corta}/${d.region}/s3/aws4_request`,
    "X-Amz-Date": larga, "X-Amz-Expires": String(caducaSeg), "X-Amz-SignedHeaders": "host",
    "response-content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}`,
  };
  const cq = Object.keys(q).sort().map((k) => `${codificar(k)}=${codificar(q[k])}`).join("&");
  const canon = ["GET", path, cq, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const aFirmar = ["AWS4-HMAC-SHA256", larga, `${corta}/${d.region}/s3/aws4_request`, await sha256(canon)].join("\n");
  const firma = hex(await hmac(await claveFirma(d, corta), aFirmar));
  return `${u.protocol}//${host}${path}?${cq}&X-Amz-Signature=${firma}`;
}
async function subir(d: Destino, clave: string, cuerpo: Uint8Array, tipo: string) {
  const r = await s3(d, "PUT", `/${d.bucket}/${codificarClave(clave)}`, {}, cuerpo, tipo);
  if (!r.ok) throw new Error(`Subida al almacén ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
async function listar(d: Destino, prefijo: string) {
  const objetos: { clave: string; bytes: number }[] = [];
  let token = "";
  do {
    const q: Record<string, string> = { "list-type": "2", prefix: prefijo, "max-keys": "1000" };
    if (token) q["continuation-token"] = token;
    const r = await s3(d, "GET", `/${d.bucket}`, q);
    const txt = await r.text();
    if (!r.ok) throw new Error(`Listado ${r.status}: ${txt.slice(0, 200)}`);
    const claves = [...txt.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
    const tam = [...txt.matchAll(/<Size>(\d+)<\/Size>/g)].map((m) => Number(m[1]));
    claves.forEach((k, i) => objetos.push({ clave: k, bytes: tam[i] ?? 0 }));
    token = txt.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? "";
  } while (token);
  return objetos;
}
async function cargarDestino(sb: ReturnType<typeof servicio>, destinoId: string) {
  const { data, error } = await sb.rpc("leer_destino_copias", { p_destino_id: destinoId });
  const f = Array.isArray(data) ? data[0] : data;
  if (error || !f) throw new Error("Destino de copias no encontrado");
  if (f.tipo !== "s3") throw new Error("Por ahora las copias solo admiten destino S3");
  if (!f.secreto || !f.usuario || !f.url_servidor || !f.bucket) throw new Error("Al destino le faltan datos (servidor, bucket, access key o secret key)");
  const d: Destino = { endpoint: f.url_servidor.replace(/\/+$/, ""), region: f.region || "eu-central-1", bucket: f.bucket, prefijo: (f.ruta_prefijo || "").replace(/^\/+|\/+$/g, ""), access: f.usuario, secret: f.secreto };
  return { d, userId: f.user_id as string };
}
const limpiar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// ---------- Copia de una base de datos (Supabase de la cuenta) ----------
async function consultar(ref: string, sql: string) {
  const r = await fetch(`${API_SUPABASE}/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${TOKEN_CUENTA}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql, read_only: true }),
  });
  if (!r.ok) throw new Error(`Supabase ${ref} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return await r.json();
}
async function copiarBaseDatos(d: Destino, ref: string, nombre: string, carpeta: string) {
  const tablas: { table_name: string; n: number }[] = await consultar(ref, `
    select c.relname as table_name, coalesce(c.reltuples,0)::bigint as n
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind in ('r','p') order by 1`);
  const columnas = await consultar(ref, `
    select table_name, column_name, data_type, is_nullable, column_default
    from information_schema.columns where table_schema='public' order by table_name, ordinal_position`);
  const funciones = await consultar(ref, `
    select p.proname as nombre, pg_get_functiondef(p.oid) as definicion
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' order by 1`);
  const politicas = await consultar(ref, `select schemaname, tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' order by 2,3`);
  const enums = await consultar(ref, `
    select t.typname as nombre, array_agg(e.enumlabel order by e.enumsortorder) as valores
    from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
    where n.nspname='public' group by 1 order by 1`);
  const vistas = await consultar(ref, `select table_name as nombre, view_definition as definicion from information_schema.views where table_schema='public' order by 1`);

  const datos: Record<string, unknown[]> = {};
  let filas = 0;
  for (const t of tablas) {
    const nombreT = t.table_name;
    const todas: unknown[] = [];
    const paso = 2000;
    for (let offset = 0; ; offset += paso) {
      const trozo = await consultar(ref, `select * from public."${nombreT.replace(/"/g, '""')}" offset ${offset} limit ${paso}`);
      todas.push(...trozo);
      if (trozo.length < paso) break;
      if (todas.length > 300000) break; // tope de seguridad por tabla
    }
    datos[nombreT] = todas;
    filas += todas.length;
  }
  const copia = {
    manifiesto: { tipo: "base_datos", proyecto: nombre, ref, fecha: new Date().toISOString(), generado_por: "NexDeveloper", tablas: tablas.length, filas },
    esquema: { tablas: tablas.map((t) => t.table_name), columnas, enums, vistas, funciones, politicas },
    datos,
  };
  const cuerpo = enc.encode(JSON.stringify(copia));
  const clave = `${carpeta}/bases-datos/${limpiar(nombre)}-${ref}.json`;
  await subir(d, clave, cuerpo, "application/json");
  return { clave, bytes: cuerpo.length, num_tablas: tablas.length, num_filas: filas };
}

// ---------- Copia de un repositorio (GitHub) ----------
async function copiarRepositorio(d: Destino, nombreCompleto: string, carpeta: string) {
  const cabGh = { Authorization: `Bearer ${TOKEN_GITHUB}`, Accept: "application/vnd.github+json", "User-Agent": "NexDeveloper" };
  const info = await fetch(`${API_GITHUB}/repos/${nombreCompleto}`, { headers: cabGh });
  if (!info.ok) throw new Error(`GitHub ${nombreCompleto} ${info.status}`);
  const meta = await info.json();
  const rama = meta.default_branch ?? "main";
  const r = await fetch(`${API_GITHUB}/repos/${nombreCompleto}/zipball/${rama}`, { headers: cabGh, redirect: "follow" });
  if (!r.ok) throw new Error(`Descarga zip ${nombreCompleto} ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  const clave = `${carpeta}/repositorios/${limpiar(nombreCompleto.replace("/", "__"))}-${rama}.zip`;
  await subir(d, clave, bytes, "application/zip");
  // Metadatos junto al zip (rama, último commit)
  const commit = await fetch(`${API_GITHUB}/repos/${nombreCompleto}/commits/${rama}`, { headers: cabGh }).then((x) => x.ok ? x.json() : null).catch(() => null);
  const manifiesto = { tipo: "repositorio", repositorio: nombreCompleto, rama, commit: commit?.sha ?? null, fecha_commit: commit?.commit?.committer?.date ?? null, fecha: new Date().toISOString(), bytes: bytes.length };
  await subir(d, clave.replace(/\.zip$/, ".json"), enc.encode(JSON.stringify(manifiesto)), "application/json");
  return { clave, bytes: bytes.length };
}

// ---------- Retención ----------
async function aplicarRetencion(d: Destino, sb: ReturnType<typeof servicio>, userId: string) {
  const { data: cfg } = await sb.from("copias_config").select("retener_diarias, retener_semanales").eq("user_id", userId).maybeSingle();
  const reglas: [string, number][] = [["diaria", cfg?.retener_diarias ?? 7], ["semanal", cfg?.retener_semanales ?? 4], ["manual", 10]];
  let borrados = 0;
  for (const [origen, mantener] of reglas) {
    const base = `${d.prefijo ? d.prefijo + "/" : ""}${origen}/`;
    const objetos = await listar(d, base);
    const carpetas = [...new Set(objetos.map((o) => o.clave.slice(base.length).split("/")[0]))].sort();
    const sobran = carpetas.slice(0, Math.max(0, carpetas.length - mantener));
    for (const c of sobran) {
      for (const o of objetos.filter((x) => x.clave.startsWith(base + c + "/"))) {
        const r = await s3(d, "DELETE", `/${d.bucket}/${codificarClave(o.clave)}`);
        if (r.ok || r.status === 204) borrados++;
      }
    }
  }
  return borrados;
}

// ---------- Procesar una copia y encadenar la siguiente ----------
async function procesarSiguiente(loteId: string) {
  const sb = servicio();
  // Coge la siguiente pendiente del lote
  const { data: pend } = await sb.from("copias").select("*").eq("lote_id", loteId).eq("estado", "pendiente").order("creado_el").limit(1);
  const c = pend?.[0];
  if (!c) {
    // Lote terminado → retención
    const { data: ultima } = await sb.from("copias").select("user_id, destino_id").eq("lote_id", loteId).limit(1);
    if (ultima?.[0]?.destino_id) {
      try { const { d } = await cargarDestino(sb, ultima[0].destino_id); await aplicarRetencion(d, sb, ultima[0].user_id); } catch (_) { /* sin bloquear */ }
    }
    return { terminado: true };
  }
  await sb.from("copias").update({ estado: "en_curso", iniciada_el: new Date().toISOString() }).eq("id", c.id);
  try {
    const { d } = await cargarDestino(sb, c.destino_id);
    // Carpeta del lote: {prefijo}/{origen}/{fecha}
    const { data: primera } = await sb.from("copias").select("iniciada_el").eq("lote_id", loteId).order("creado_el").limit(1);
    const fecha = (primera?.[0]?.iniciada_el ? new Date(primera[0].iniciada_el) : new Date()).toISOString().slice(0, 16).replace("T", "_").replace(":", "");
    const carpeta = `${d.prefijo ? d.prefijo + "/" : ""}${c.origen}/${fecha}`;
    let res: Record<string, unknown>;
    if (c.tipo === "base_datos") res = await copiarBaseDatos(d, c.objetivo, c.nombre, carpeta);
    else res = await copiarRepositorio(d, c.objetivo, carpeta);
    await sb.from("copias").update({ estado: "ok", ruta_remota: res.clave, bytes: res.bytes, num_tablas: res.num_tablas ?? null, num_filas: res.num_filas ?? null, terminada_el: new Date().toISOString() }).eq("id", c.id);
  } catch (e) {
    await sb.from("copias").update({ estado: "error", error: String(e?.message ?? e).slice(0, 500), terminada_el: new Date().toISOString() }).eq("id", c.id);
  }
  return { terminado: false, procesada: c.id };
}

async function encadenar(loteId: string, token: string) {
  const url = `${URL_SUPABASE}/functions/v1/copias-generar`;
  const p = fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-cron-token": token }, body: JSON.stringify({ accion: "procesar_lote", lote_id: loteId }) }).catch(() => {});
  // @ts-ignore EdgeRuntime existe en Supabase
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p); else await p;
}

// ---------- Orígenes (catálogo) ----------
async function refrescarOrigenes(sb: ReturnType<typeof servicio>, userId: string) {
  let bd = 0, repos = 0;
  if (TOKEN_CUENTA) {
    const r = await fetch(`${API_SUPABASE}/projects`, { headers: { Authorization: `Bearer ${TOKEN_CUENTA}` } });
    if (r.ok) {
      const lista = await r.json();
      for (const p of lista) {
        await sb.from("copias_origenes").upsert({ user_id: userId, tipo: "base_datos", objetivo: p.id, nombre: p.name, detalle: { region: p.region, estado: p.status, organizacion: p.organization_id }, actualizado_el: new Date().toISOString() }, { onConflict: "user_id,tipo,objetivo" });
        bd++;
      }
    }
  }
  if (TOKEN_GITHUB) {
    for (let pagina = 1; pagina < 10; pagina++) {
      const r = await fetch(`${API_GITHUB}/user/repos?per_page=100&page=${pagina}&affiliation=owner`, { headers: { Authorization: `Bearer ${TOKEN_GITHUB}`, Accept: "application/vnd.github+json", "User-Agent": "NexDeveloper" } });
      if (!r.ok) break;
      const lista = await r.json();
      for (const g of lista) {
        await sb.from("copias_origenes").upsert({ user_id: userId, tipo: "repositorio", objetivo: g.full_name, nombre: g.name, detalle: { privado: g.private, rama: g.default_branch, url: g.html_url, actualizado: g.pushed_at, bytes_kb: g.size }, actualizado_el: new Date().toISOString() }, { onConflict: "user_id,tipo,objetivo" });
        repos++;
      }
      if (lista.length < 100) break;
    }
  }
  // Enlazar con proyectos por slug/nombre
  const { data: proyectos } = await sb.from("proyectos").select("id, slug, nombre, supabase_ref, repositorio").eq("user_id", userId);
  const { data: origenes } = await sb.from("copias_origenes").select("id, tipo, objetivo, nombre").eq("user_id", userId);
  for (const o of origenes ?? []) {
    const p = (proyectos ?? []).find((x) =>
      (o.tipo === "base_datos" && x.supabase_ref === o.objetivo) ||
      (o.tipo === "repositorio" && x.repositorio && o.objetivo.toLowerCase().endsWith("/" + x.repositorio.split("/").pop()!.toLowerCase())) ||
      limpiar(x.slug).toLowerCase() === limpiar(o.nombre).toLowerCase() ||
      limpiar(x.nombre).toLowerCase() === limpiar(o.nombre).toLowerCase());
    if (p) await sb.from("copias_origenes").update({ proyecto_id: p.id }).eq("id", o.id);
  }
  return { bases_datos: bd, repositorios: repos };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = servicio();
    const cuerpo = await req.json().catch(() => ({}));
    const accion = String(cuerpo.accion ?? "");
    const tokenCron = req.headers.get("x-cron-token") ?? "";
    let esServicio = false;
    if (tokenCron) {
      const { data } = await sb.rpc("comprobar_cron_token", { p_token: tokenCron });
      esServicio = data === true;
    }
    let userId: string | null = esServicio ? (cuerpo.user_id ? String(cuerpo.user_id) : null) : null;
    if (!esServicio) {
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: { user } } = jwt ? await sb.auth.getUser(jwt) : { data: { user: null } };
      if (!user) return json({ error: "Sin sesión" }, 401);
      userId = user.id;
    }

    switch (accion) {
      case "procesar_lote": {
        if (!esServicio) return json({ error: "Solo el servicio" }, 403);
        const loteId = String(cuerpo.lote_id ?? "");
        const r = await procesarSiguiente(loteId);
        if (!r.terminado) await encadenar(loteId, tokenCron);
        return json({ ok: true, ...r });
      }
      case "refrescar_origenes": {
        const r = await refrescarOrigenes(sb, userId!);
        return json({ ok: true, ...r });
      }
      case "probar_destino": {
        try {
          const { d, userId: dueno } = await cargarDestino(sb, String(cuerpo.destino_id));
          if (dueno !== userId) return json({ error: "Sin permiso" }, 403);
          await listar(d, d.prefijo ? d.prefijo + "/" : "");
          await sb.from("copias_destinos").update({ ultima_prueba: new Date().toISOString(), resultado_prueba: "ok" }).eq("id", cuerpo.destino_id);
          return json({ ok: true, mensaje: `Conexión correcta con el bucket «${d.bucket}»` });
        } catch (e) {
          await sb.from("copias_destinos").update({ ultima_prueba: new Date().toISOString(), resultado_prueba: "error: " + String(e.message ?? e).slice(0, 200) }).eq("id", cuerpo.destino_id);
          return json({ ok: false, error: String(e.message ?? e) });
        }
      }
      case "firmar_descarga": {
        const { data: c } = await sb.from("copias").select("*").eq("id", String(cuerpo.copia_id)).eq("user_id", userId!).maybeSingle();
        if (!c?.ruta_remota) return json({ error: "Copia sin archivo" }, 404);
        const { d } = await cargarDestino(sb, c.destino_id);
        const nombre = c.ruta_remota.split("/").pop()!;
        return json({ ok: true, url: await presignarGet(d, c.ruta_remota, nombre) });
      }
      case "importar_proyectos": {
        // Crea fichas de proyecto en NexDeveloper a partir de los orígenes sin proyecto
        const { data: origenes } = await sb.from("copias_origenes").select("*").eq("user_id", userId!).is("proyecto_id", null);
        let creados = 0;
        const { data: existentes } = await sb.from("proyectos").select("id, slug").eq("user_id", userId!);
        const slugs = new Set((existentes ?? []).map((p) => p.slug));
        for (const o of origenes ?? []) {
          if (o.tipo !== "base_datos") continue; // los repos se enlazan a las fichas de BD por nombre
          let slug = limpiar(o.nombre).toLowerCase() || o.objetivo;
          if (slugs.has(slug)) { await sb.from("copias_origenes").update({ proyecto_id: (existentes ?? []).find((p) => p.slug === slug)!.id }).eq("id", o.id); continue; }
          const { data: nuevo, error } = await sb.from("proyectos").insert({ user_id: userId, slug, nombre: o.nombre, descripcion: `Importado desde Supabase (${o.objetivo})`, estado: "pendiente", supabase_ref: o.objetivo }).select("id").single();
          if (!error && nuevo) { slugs.add(slug); creados++; await sb.from("copias_origenes").update({ proyecto_id: nuevo.id }).eq("id", o.id); }
        }
        await refrescarOrigenes(sb, userId!);
        return json({ ok: true, creados });
      }
      default:
        return json({ error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
