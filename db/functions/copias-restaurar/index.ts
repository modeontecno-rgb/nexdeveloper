// NexDeveloper · Edge Function «copias-restaurar» (0.22.0)
// Restaurar copias con un clic: bases de datos (JSON de copias-generar) en el Supabase original o en uno de pruebas,
// repositorios (zip) como rama nueva en GitHub, enlaces de descarga, restauración simulada (validación de la copia)
// y prueba mensual automática de que las copias sirven de verdad. Trabajo por tandas reanudable.
import { createClient } from "npm:@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_CUENTA = Deno.env.get("CUENTA_SUPABASE_TOKEN") ?? "";
const TOKEN_GITHUB = Deno.env.get("GITHUB_TOKEN") ?? "";
const API_SUPABASE = "https://api.supabase.com/v1";
const API_GITHUB = "https://api.github.com";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const ahora = () => new Date().toISOString();
const INICIO = Date.now();
const PRESUPUESTO_MS = 100_000;

// ---------- SigV4 (S3) ----------
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string | Uint8Array) => hex(await crypto.subtle.digest("SHA-256", typeof s === "string" ? enc.encode(s) : s));
async function hmac(key: ArrayBuffer | Uint8Array, msg: string) { const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return crypto.subtle.sign("HMAC", k, enc.encode(msg)); }
const codificar = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const codificarClave = (k: string) => k.split("/").map(codificar).join("/");
function fechaAmz() { const iso = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); return { larga: iso, corta: iso.slice(0, 8) }; }
type Destino = { endpoint: string; region: string; bucket: string; prefijo: string; access: string; secret: string };
async function claveFirma(d: Destino, corta: string) { const a = await hmac(enc.encode("AWS4" + d.secret), corta); const b = await hmac(a, d.region); const c = await hmac(b, "s3"); return hmac(c, "aws4_request"); }
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
  const q: Record<string, string> = { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${d.access}/${corta}/${d.region}/s3/aws4_request`, "X-Amz-Date": larga, "X-Amz-Expires": String(caducaSeg), "X-Amz-SignedHeaders": "host", "response-content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}` };
  const cq = Object.keys(q).sort().map((k) => `${codificar(k)}=${codificar(q[k])}`).join("&");
  const canon = ["GET", path, cq, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const aFirmar = ["AWS4-HMAC-SHA256", larga, `${corta}/${d.region}/s3/aws4_request`, await sha256(canon)].join("\n");
  const firma = hex(await hmac(await claveFirma(d, corta), aFirmar));
  return `${u.protocol}//${host}${path}?${cq}&X-Amz-Signature=${firma}`;
}
async function descargar(d: Destino, clave: string) {
  const r = await s3(d, "GET", `/${d.bucket}/${codificarClave(clave)}`);
  if (!r.ok) throw new Error(`Descarga del almacén ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return new Uint8Array(await r.arrayBuffer());
}
async function subir(d: Destino, clave: string, cuerpo: Uint8Array, tipo: string) {
  const r = await s3(d, "PUT", `/${d.bucket}/${codificarClave(clave)}`, {}, cuerpo, tipo);
  if (!r.ok) throw new Error(`Subida al almacén ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
async function cargarDestino(sb: SB, destinoId: string) {
  const { data, error } = await sb.rpc("leer_destino_copias", { p_destino_id: destinoId });
  const f = Array.isArray(data) ? data[0] : data;
  if (error || !f) throw new Error("Destino de copias no encontrado");
  if (!f.secreto || !f.usuario || !f.url_servidor || !f.bucket) throw new Error("Al destino le faltan datos");
  return { endpoint: f.url_servidor.replace(/\/+$/, ""), region: f.region || "eu-central-1", bucket: f.bucket, prefijo: (f.ruta_prefijo || "").replace(/^\/+|\/+$/g, ""), access: f.usuario, secret: f.secreto } as Destino;
}
async function destinoDeCopia(sb: SB, copia: any) {
  const destinoId = copia?.destino_id ?? (await sb.from("copias_destinos").select("id").eq("user_id", copia.user_id).eq("es_predeterminado", true).maybeSingle()).data?.id;
  if (!destinoId) throw new Error("No hay destino de copias configurado");
  return cargarDestino(sb, destinoId);
}

// ---------- Supabase (API de administración) ----------
async function sqlEn(ref: string, query: string, readOnly = false) {
  if (!TOKEN_CUENTA) throw new Error("Falta CUENTA_SUPABASE_TOKEN");
  const r = await fetch(`${API_SUPABASE}/projects/${ref}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN_CUENTA}`, "Content-Type": "application/json" }, body: JSON.stringify({ query, read_only: readOnly }) });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${ref} ${r.status}: ${t.slice(0, 300)}`);
  try { return JSON.parse(t); } catch { return []; }
}
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

// ---------- Restauración de base de datos ----------
function ddlDesdeCopia(copia: any) {
  const esq = copia.esquema ?? {}; const sentencias: { paso: string; sql: string }[] = [];
  for (const e of esq.enums ?? []) sentencias.push({ paso: `tipo ${e.nombre}`, sql: `do $$ begin create type public.${q(e.nombre)} as enum (${(e.valores ?? []).map(lit).join(", ")}); exception when duplicate_object then null; end $$;` });
  const porTabla: Record<string, any[]> = {};
  for (const c of esq.columnas ?? []) (porTabla[c.table_name] ??= []).push(c);
  for (const t of esq.tablas ?? []) {
    const cols = (porTabla[t] ?? []).map((c: any) => {
      let tipo = String(c.data_type ?? "text");
      if (tipo === "USER-DEFINED") { const def = String(c.column_default ?? ""); const m = def.match(/::"?([A-Za-z_][A-Za-z0-9_]*)"?$/); tipo = m ? `public.${q(m[1])}` : "text"; }
      if (tipo === "ARRAY") tipo = "text[]";
      const def = c.column_default && !/nextval\(/.test(String(c.column_default)) ? ` default ${c.column_default}` : "";
      const ident = /nextval\(/.test(String(c.column_default ?? "")) ? " generated by default as identity" : "";
      return `${q(c.column_name)} ${tipo}${ident}${c.is_nullable === "NO" ? " not null" : ""}${def}`;
    });
    const pk = (porTabla[t] ?? []).some((c: any) => c.column_name === "id") ? `, primary key (id)` : "";
    sentencias.push({ paso: `tabla ${t}`, sql: `create table if not exists public.${q(t)} (${cols.join(", ")}${pk});` });
  }
  for (const v of esq.vistas ?? []) sentencias.push({ paso: `vista ${v.nombre}`, sql: `create or replace view public.${q(v.nombre)} as ${v.definicion}` });
  for (const f of esq.funciones ?? []) sentencias.push({ paso: `función ${f.nombre}`, sql: String(f.definicion) });
  for (const p of esq.politicas ?? []) {
    const roles = Array.isArray(p.roles) ? p.roles : String(p.roles ?? "{public}").replace(/[{}]/g, "").split(",");
    sentencias.push({ paso: `política ${p.policyname}`, sql: `alter table public.${q(p.tablename)} enable row level security; do $$ begin create policy ${q(p.policyname)} on public.${q(p.tablename)} for ${p.cmd === "*" ? "all" : p.cmd} to ${roles.map((r: string) => r.trim() === "public" ? "public" : q(r.trim())).join(", ")}${p.qual ? ` using (${p.qual})` : ""}${p.with_check ? ` with check (${p.with_check})` : ""}; exception when duplicate_object then null; end $$;` });
  }
  return sentencias;
}
async function copiaPreviaDatos(d: Destino, ref: string, tablas: string[], carpeta: string) {
  // Copia rápida de los datos actuales de las tablas que se van a sobrescribir (por si hay que volver atrás)
  const datos: Record<string, unknown[]> = {};
  for (const t of tablas) { try { datos[t] = await sqlEn(ref, `select * from public.${q(t)} limit 200000`, true); } catch { datos[t] = []; } }
  const clave = `${carpeta}/pre-restauracion/${ref}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await subir(d, clave, enc.encode(JSON.stringify({ manifiesto: { tipo: "pre_restauracion", ref, fecha: ahora(), tablas: tablas.length }, datos })), "application/json");
  return clave;
}
async function restaurarBaseDatos(sb: SB, r: any) {
  const { data: copia } = await sb.from("copias").select("*").eq("id", r.copia_id).maybeSingle();
  const d = await destinoDeCopia(sb, copia ?? { user_id: r.user_id });
  const prog = { ...(r.progreso ?? {}) };
  const guardar = async (extra: Record<string, unknown> = {}) => sb.from("restauraciones").update({ progreso: prog, actualizado_el: ahora(), ...extra }).eq("id", r.id);
  await guardar({ estado: "preparando", paso: "Descargando la copia del almacén", iniciada_el: r.iniciada_el ?? ahora() });
  const bytes = await descargar(d, r.ruta_remota);
  const copiaJson = JSON.parse(new TextDecoder().decode(bytes));
  const tablas: string[] = copiaJson.esquema?.tablas ?? Object.keys(copiaJson.datos ?? {});
  prog.tablas_total = tablas.length; prog.filas_total = Object.values(copiaJson.datos ?? {}).reduce((a: number, v: any) => a + (v?.length ?? 0), 0);
  const avisos: string[] = prog.avisos ?? [];
  if (r.modo === "simulada") {
    const problemas: string[] = [];
    if (!copiaJson.manifiesto) problemas.push("La copia no tiene manifiesto");
    for (const t of tablas) if (!Array.isArray(copiaJson.datos?.[t])) problemas.push(`Faltan los datos de la tabla ${t}`);
    const cols = new Set((copiaJson.esquema?.columnas ?? []).map((c: any) => c.table_name));
    for (const t of tablas) if (!cols.has(t)) problemas.push(`Falta la definición de columnas de ${t}`);
    const ok = problemas.length === 0;
    await guardar({ estado: ok ? "completada" : "error", paso: ok ? "Copia válida" : "Copia con problemas", terminada_el: ahora(), error: ok ? null : problemas.join("; "), resultado: { simulada: true, tablas: tablas.length, filas: prog.filas_total, bytes: bytes.length, funciones: (copiaJson.esquema?.funciones ?? []).length, politicas: (copiaJson.esquema?.politicas ?? []).length, problemas } });
    return ok;
  }
  const ref = r.destino; if (!ref) throw new Error("Falta el Supabase de destino");
  // Copia previa (solo la primera vez) si el destino ya tiene datos
  if (!r.copia_previa && !prog.sin_copia_previa) {
    const existentes: any[] = await sqlEn(ref, `select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')`, true);
    const comunes = tablas.filter((t) => existentes.some((e) => e.relname === t));
    if (comunes.length) { await guardar({ paso: `Guardando copia previa de ${comunes.length} tablas` }); const clave = await copiaPreviaDatos(d, ref, comunes, `${d.prefijo ? d.prefijo + "/" : ""}copias`); r.copia_previa = clave; await guardar({ copia_previa: clave }); }
    else { prog.sin_copia_previa = true; await guardar(); }
  }
  // Esquema
  if (r.modo === "esquema_y_datos" && !prog.esquema_hecho) {
    await guardar({ estado: "restaurando", paso: "Creando el esquema (tipos, tablas, vistas, funciones, políticas)" });
    for (const s of ddlDesdeCopia(copiaJson)) { try { await sqlEn(ref, s.sql); } catch (e) { avisos.push(`${s.paso}: ${String(e?.message ?? e).slice(0, 160)}`); } }
    prog.esquema_hecho = true; prog.avisos = avisos.slice(0, 200); await guardar();
  }
  // Datos por tablas (reanudable)
  const pendientes: string[] = prog.tablas_pendientes ?? tablas.slice();
  prog.tablas_hechas = prog.tablas_hechas ?? 0; prog.filas_hechas = prog.filas_hechas ?? 0;
  await guardar({ estado: "restaurando" });
  while (pendientes.length && Date.now() - INICIO < PRESUPUESTO_MS - 10_000) {
    const t = pendientes[0]; const filas: any[] = copiaJson.datos?.[t] ?? [];
    await guardar({ paso: `Restaurando ${t} (${filas.length} filas)` });
    try {
      await sqlEn(ref, `set session_replication_role = replica; truncate table only public.${q(t)};`);
      for (let i = 0; i < filas.length; i += 400) {
        const trozo = filas.slice(i, i + 400);
        await sqlEn(ref, `set session_replication_role = replica; insert into public.${q(t)} select * from jsonb_populate_recordset(null::public.${q(t)}, ${lit(JSON.stringify(trozo))}::jsonb);`);
        prog.filas_hechas += trozo.length;
      }
      // Secuencias
      try { await sqlEn(ref, `do $$ declare r record; begin for r in select column_name, pg_get_serial_sequence('public.${t.replace(/'/g, "''")}', column_name) seq from information_schema.columns where table_schema='public' and table_name=${lit(t)} and (column_default like 'nextval(%' or is_identity='YES') loop if r.seq is not null then execute format('select setval(%L, coalesce((select max(%I) from public.%I), 0) + 1, false)', r.seq, r.column_name, ${lit(t)}); end if; end loop; end $$;`); } catch { /* opcional */ }
    } catch (e) { avisos.push(`Tabla ${t}: ${String(e?.message ?? e).slice(0, 200)}`); }
    pendientes.shift(); prog.tablas_hechas++; prog.tablas_pendientes = pendientes; prog.avisos = avisos.slice(0, 200);
    await guardar();
  }
  if (pendientes.length) { await sb.rpc("lanzar_restauracion", { p_accion: "continuar", p_id: r.id }); return null; }
  await guardar({ estado: "completada", paso: "Restauración terminada", terminada_el: ahora(), resultado: { tablas: prog.tablas_hechas, filas: prog.filas_hechas, avisos: avisos.length, copia_previa: r.copia_previa ?? null } });
  return true;
}

// ---------- Restauración de repositorio (rama nueva en GitHub) ----------
async function gh(ruta: string, init: RequestInit = {}) {
  if (!TOKEN_GITHUB) throw new Error("Falta GITHUB_TOKEN");
  const r = await fetch(`${API_GITHUB}${ruta}`, { ...init, headers: { Authorization: `Bearer ${TOKEN_GITHUB}`, Accept: "application/vnd.github+json", "User-Agent": "NexDeveloper", ...(init.body ? { "Content-Type": "application/json" } : {}) } });
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  if (!r.ok) throw new Error(`GitHub ${r.status} ${ruta}: ${String(j?.message ?? t).slice(0, 200)}`);
  return j;
}
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
async function restaurarRepositorio(sb: SB, r: any) {
  const { data: copia } = await sb.from("copias").select("*").eq("id", r.copia_id).maybeSingle();
  const d = await destinoDeCopia(sb, copia ?? { user_id: r.user_id });
  const prog = { ...(r.progreso ?? {}) };
  const guardar = async (extra: Record<string, unknown> = {}) => sb.from("restauraciones").update({ progreso: prog, actualizado_el: ahora(), ...extra }).eq("id", r.id);
  await guardar({ estado: "preparando", paso: "Descargando el zip del almacén", iniciada_el: r.iniciada_el ?? ahora() });
  const zip = unzipSync(await descargar(d, r.ruta_remota));
  const entradas = Object.entries(zip).filter(([n, c]) => !n.endsWith("/") && c.length > 0).map(([n, c]) => ({ ruta: n.split("/").slice(1).join("/"), datos: c })).filter((e) => e.ruta && !e.ruta.startsWith(".git/"));
  prog.archivos_total = entradas.length; prog.blobs = prog.blobs ?? {};
  const repo = r.destino; if (!repo) throw new Error("Falta el repositorio de destino");
  const rama = r.rama || `restauracion-${new Date().toISOString().slice(0, 10)}`;
  await guardar({ estado: "restaurando", paso: `Subiendo ${entradas.length} archivos a GitHub`, rama });
  for (const e of entradas) {
    if (prog.blobs[e.ruta]) continue;
    if (Date.now() - INICIO > PRESUPUESTO_MS - 10_000) { await guardar(); await sb.rpc("lanzar_restauracion", { p_accion: "continuar", p_id: r.id }); return null; }
    const b = await gh(`/repos/${repo}/git/blobs`, { method: "POST", body: JSON.stringify({ content: b64(e.datos), encoding: "base64" }) });
    prog.blobs[e.ruta] = b.sha; prog.archivos_hechos = Object.keys(prog.blobs).length;
    if (prog.archivos_hechos % 25 === 0) await guardar();
  }
  await guardar({ paso: "Creando el árbol y el commit" });
  const info = await gh(`/repos/${repo}`); const base = info.default_branch ?? "main";
  const tree = await gh(`/repos/${repo}/git/trees`, { method: "POST", body: JSON.stringify({ tree: Object.entries(prog.blobs).map(([path, sha]) => ({ path, mode: "100644", type: "blob", sha })) }) });
  let parents: string[] = []; try { const ref = await gh(`/repos/${repo}/git/ref/heads/${base}`); parents = [ref.object.sha]; } catch { parents = []; }
  const commit = await gh(`/repos/${repo}/git/commits`, { method: "POST", body: JSON.stringify({ message: `Restauración desde la copia ${r.ruta_remota.split("/").pop()} (NexDeveloper)`, tree: tree.sha, parents }) });
  try { await gh(`/repos/${repo}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${rama}`, sha: commit.sha }) }); }
  catch { await gh(`/repos/${repo}/git/refs/heads/${rama}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: true }) }); }
  const url = `https://github.com/${repo}/tree/${rama}`;
  prog.blobs = undefined;
  await guardar({ estado: "completada", paso: "Rama creada en GitHub", terminada_el: ahora(), resultado: { rama, commit: commit.sha, url, archivos: entradas.length } });
  return true;
}

async function procesar(sb: SB, id: string) {
  const { data: r } = await sb.from("restauraciones").select("*").eq("id", id).maybeSingle();
  if (!r || ["completada", "cancelada"].includes(r.estado)) return;
  try {
    const ok = r.tipo === "repositorio" ? await restaurarRepositorio(sb, r) : await restaurarBaseDatos(sb, r);
    if (ok !== null && r.origen === "programado") await avisarPrueba(sb, r, ok);
  } catch (e) {
    const msg = String(e?.message ?? e).slice(0, 500);
    await sb.from("restauraciones").update({ estado: "error", error: msg, terminada_el: ahora() }).eq("id", id);
    if (r.origen === "programado") await avisarPrueba(sb, { ...r, error: msg }, false);
  }
}
async function avisarPrueba(sb: SB, r: any, ok: boolean) {
  const { data: fin } = await sb.from("restauraciones").select("resultado, error, modo, destino").eq("id", r.id).maybeSingle();
  const titulo = ok ? `Prueba mensual de restauración: OK` : `Prueba mensual de restauración: FALLÓ`;
  await sb.from("tareas").insert({ user_id: r.user_id, proyecto_id: r.proyecto_id, titulo, descripcion: ok ? `La copia ${r.ruta_remota.split("/").pop()} se ha ${fin?.modo === "simulada" ? "validado" : `restaurado en ${fin?.destino}`} correctamente: ${JSON.stringify(fin?.resultado ?? {})}` : `Error: ${fin?.error ?? r.error}`, estado: ok ? "completada" : "esperando_revision", prioridad: ok ? "baja" : "critica", requiere_atencion: !ok, motivo_atencion: ok ? null : "Las copias no restauran", instrucciones: ok ? null : "Abre Copias → Restaurar → Historial para ver el detalle y corrige el destino o la copia.", completada_el: ok ? ahora() : null, completada_por: ok ? "NexDeveloper" : null });
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
    const cuerpo = await req.json().catch(() => ({}));
    const accion = String(cuerpo.accion ?? "estado");
    switch (accion) {
      case "continuar": {
        if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
        await procesar(sb, String(cuerpo.restauracion_id)); return json({ ok: true });
      }
      case "programado": {
        if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
        const { data: cfgs } = await sb.from("restauracion_config").select("*").eq("prueba_mensual", true);
        const lista = cfgs?.length ? cfgs : [{ user_id: (await sb.from("proyectos").select("user_id").limit(1)).data?.[0]?.user_id, sandbox_ref: null, proyecto_prueba_id: null }];
        const res: unknown[] = [];
        for (const cfg of lista) {
          if (!cfg.user_id) continue;
          let q1 = sb.from("copias").select("*").eq("user_id", cfg.user_id).eq("tipo", "base_datos").eq("estado", "ok").order("bytes", { ascending: true }).limit(1);
          if (cfg.proyecto_prueba_id) { const { data: p } = await sb.from("proyectos").select("supabase_ref").eq("id", cfg.proyecto_prueba_id).maybeSingle(); if (p?.supabase_ref) q1 = sb.from("copias").select("*").eq("user_id", cfg.user_id).eq("tipo", "base_datos").eq("estado", "ok").eq("objetivo", p.supabase_ref).order("terminada_el", { ascending: false }).limit(1); }
          const { data: copias } = await q1; const c = copias?.[0]; if (!c) { res.push({ user: cfg.user_id, sin_copias: true }); continue; }
          const { data: p } = await sb.from("proyectos").select("id").eq("user_id", cfg.user_id).eq("supabase_ref", c.objetivo).maybeSingle();
          const modo = cfg.sandbox_ref ? "esquema_y_datos" : "simulada";
          const { data: r } = await sb.from("restauraciones").insert({ user_id: cfg.user_id, copia_id: c.id, proyecto_id: p?.id ?? null, tipo: "prueba", origen: "programado", ruta_remota: c.ruta_remota, destino: cfg.sandbox_ref ?? null, modo }).select("id").single();
          await procesar(sb, r!.id); res.push({ user: cfg.user_id, restauracion: r!.id, modo });
        }
        return json({ ok: true, resultados: res });
      }
      case "estado": {
        const { data: cfg } = await sb.from("restauracion_config").select("*").eq("user_id", userId!).maybeSingle();
        const { data: ultimaPrueba } = await sb.from("restauraciones").select("*").eq("user_id", userId!).eq("tipo", "prueba").order("creado_el", { ascending: false }).limit(1).maybeSingle();
        return json({ ok: true, config: cfg ?? { prueba_mensual: true, dia_prueba: 1 }, ultima_prueba: ultimaPrueba, token_cuenta: !!TOKEN_CUENTA, github: !!TOKEN_GITHUB });
      }
      case "configurar": {
        const permitidos = ["sandbox_ref", "prueba_mensual", "dia_prueba", "proyecto_prueba_id"];
        const cambios: Record<string, unknown> = { user_id: userId!, actualizado_el: ahora() };
        for (const k of permitidos) if (k in cuerpo) cambios[k] = cuerpo[k];
        const { data } = await sb.from("restauracion_config").upsert(cambios).select("*").single();
        return json({ ok: true, config: data });
      }
      case "copias": {
        // Copias disponibles (completadas) de un proyecto o de todo
        let q1 = sb.from("copias").select("id, tipo, objetivo, nombre, ruta_remota, bytes, num_tablas, num_filas, terminada_el, destino_id").eq("user_id", userId!).eq("estado", "ok").order("terminada_el", { ascending: false }).limit(300);
        if (cuerpo.objetivo) q1 = q1.eq("objetivo", String(cuerpo.objetivo));
        if (cuerpo.tipo) q1 = q1.eq("tipo", String(cuerpo.tipo));
        const { data } = await q1; return json({ ok: true, copias: data ?? [] });
      }
      case "enlace": {
        const { data: c } = await sb.from("copias").select("*").eq("id", String(cuerpo.copia_id)).eq("user_id", userId!).maybeSingle();
        if (!c) return json({ ok: false, error: "Copia no encontrada" });
        const d = await destinoDeCopia(sb, c);
        return json({ ok: true, url: await presignarGet(d, c.ruta_remota, c.ruta_remota.split("/").pop() ?? "copia"), caduca_min: 60 });
      }
      case "preparar": {
        // Resumen de la copia antes de restaurar (tablas, filas, fecha) y estado del destino
        const { data: c } = await sb.from("copias").select("*").eq("id", String(cuerpo.copia_id)).eq("user_id", userId!).maybeSingle();
        if (!c) return json({ ok: false, error: "Copia no encontrada" });
        if (c.tipo === "repositorio") return json({ ok: true, copia: c, resumen: { bytes: c.bytes } });
        const d = await destinoDeCopia(sb, c);
        const bytes = await descargar(d, c.ruta_remota);
        const cj = JSON.parse(new TextDecoder().decode(bytes));
        const tablas = (cj.esquema?.tablas ?? []).map((t: string) => ({ tabla: t, filas: (cj.datos?.[t] ?? []).length }));
        let destino: any = null;
        const ref = cuerpo.destino ?? c.objetivo;
        try { const ex = await sqlEn(ref, `select count(*)::int as tablas, (select count(*)::int from auth.users) as usuarios from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')`, true); destino = { ref, ...ex[0] }; } catch (e) { destino = { ref, error: String(e?.message ?? e).slice(0, 200) }; }
        return json({ ok: true, copia: c, resumen: { fecha: cj.manifiesto?.fecha, tablas, filas: tablas.reduce((a: number, t: any) => a + t.filas, 0), funciones: (cj.esquema?.funciones ?? []).length, politicas: (cj.esquema?.politicas ?? []).length, bytes: bytes.length }, destino });
      }
      case "restaurar": {
        const { data: c } = await sb.from("copias").select("*").eq("id", String(cuerpo.copia_id)).eq("user_id", userId!).maybeSingle();
        if (!c) return json({ ok: false, error: "Copia no encontrada" });
        const modo = String(cuerpo.modo ?? (c.tipo === "repositorio" ? "rama" : "solo_datos"));
        const destino = String(cuerpo.destino ?? c.objetivo);
        if (c.tipo === "base_datos" && modo !== "simulada" && String(cuerpo.confirmacion ?? "").trim().toUpperCase() !== "RESTAURAR") return json({ ok: false, error: "Escribe RESTAURAR para confirmar: se sobrescribirán los datos del destino (se guarda una copia previa automática)." });
        const { data: p } = await sb.from("proyectos").select("id").eq("user_id", userId!).eq(c.tipo === "repositorio" ? "repositorio" : "supabase_ref", c.objetivo).maybeSingle();
        const { data: r } = await sb.from("restauraciones").insert({ user_id: userId!, copia_id: c.id, proyecto_id: p?.id ?? null, tipo: c.tipo, origen: "manual", ruta_remota: c.ruta_remota, destino, rama: cuerpo.rama ?? null, modo }).select("*").single();
        await procesar(sb, r!.id);
        const { data: fin } = await sb.from("restauraciones").select("*").eq("id", r!.id).single();
        return json({ ok: fin!.estado !== "error", restauracion: fin, error: fin!.error });
      }
      case "cancelar": {
        await sb.from("restauraciones").update({ estado: "cancelada", terminada_el: ahora() }).eq("id", String(cuerpo.restauracion_id)).eq("user_id", userId!);
        return json({ ok: true });
      }
      case "probar_ahora": {
        // Lanza la prueba (simulada o en el sandbox) sin esperar al día 1
        const { data: cfg } = await sb.from("restauracion_config").select("*").eq("user_id", userId!).maybeSingle();
        const { data: copias } = await sb.from("copias").select("*").eq("user_id", userId!).eq("tipo", "base_datos").eq("estado", "ok").order("bytes", { ascending: true }).limit(1);
        const c = copias?.[0]; if (!c) return json({ ok: false, error: "No hay copias de bases de datos completadas" });
        const modo = cfg?.sandbox_ref ? "esquema_y_datos" : "simulada";
        const { data: p } = await sb.from("proyectos").select("id").eq("user_id", userId!).eq("supabase_ref", c.objetivo).maybeSingle();
        const { data: r } = await sb.from("restauraciones").insert({ user_id: userId!, copia_id: c.id, proyecto_id: p?.id ?? null, tipo: "prueba", origen: "programado", ruta_remota: c.ruta_remota, destino: cfg?.sandbox_ref ?? null, modo }).select("*").single();
        await procesar(sb, r!.id);
        const { data: fin } = await sb.from("restauraciones").select("*").eq("id", r!.id).single();
        return json({ ok: fin!.estado === "completada", restauracion: fin });
      }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (err) { return json({ ok: false, error: String(err?.message ?? err) }, 500); }
});
