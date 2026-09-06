// NexDeveloper · Edge Function «usuarios-clientes» (0.27.0)
// Gestión de usuarios y accesos de los clientes en cualquiera de los Supabase de la cartera: listar (con último acceso),
// buscar en todos, dar de alta, invitar, cambiar contraseña, bloquear/desbloquear y borrar. Las operaciones de escritura usan
// la API de administración de Auth (GoTrue) de cada proyecto con su clave de servicio, obtenida al momento por la API de
// administración de Supabase y nunca guardada. Las contraseñas nuevas se reflejan en Proyectian (app_usuarios + claves).
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_CUENTA = Deno.env.get("CUENTA_SUPABASE_TOKEN") ?? "";
const REF_PROYECTIAN = "hjtweberlereyfhagkvx";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const ahora = () => new Date().toISOString();
const INICIO = Date.now();
const sqlLit = (s: unknown) => s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`;

async function admin(ruta: string, init: RequestInit = {}) {
  if (!TOKEN_CUENTA) throw new Error("Falta CUENTA_SUPABASE_TOKEN");
  const r = await fetch(`https://api.supabase.com/v1${ruta}`, { ...init, headers: { Authorization: `Bearer ${TOKEN_CUENTA}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  if (!r.ok) throw new Error(`API Supabase ${r.status}: ${String(j?.message ?? t).slice(0, 200)}`);
  return j;
}
const sqlEn = (ref: string, query: string, readOnly = true) => admin(`/projects/${ref}/database/query`, { method: "POST", body: JSON.stringify({ query, read_only: readOnly }) });
async function claveServicio(ref: string): Promise<string> {
  const keys = await admin(`/projects/${ref}/api-keys?reveal=true`);
  const k = (keys ?? []).find((x: any) => x.name === "service_role" || x.type === "secret" || x.id === "service_role");
  if (!k?.api_key) throw new Error("No se pudo obtener la clave de servicio del proyecto");
  return k.api_key;
}
async function authAdmin(ref: string, ruta: string, init: RequestInit = {}) {
  const key = await claveServicio(ref);
  const r = await fetch(`https://${ref}.supabase.co/auth/v1/admin${ruta}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  if (!r.ok) throw new Error(`Auth ${r.status}: ${String(j?.msg ?? j?.message ?? j?.error_description ?? t).slice(0, 200)}`);
  return j;
}
const CONSULTA_USUARIOS = `select u.id, u.email, u.phone, u.created_at, u.last_sign_in_at, u.email_confirmed_at, u.banned_until, u.raw_user_meta_data as um, u.raw_app_meta_data as am
  from auth.users u where u.deleted_at is null order by u.last_sign_in_at desc nulls last, u.created_at desc limit 500`;
function normalizar(f: any) {
  const um = f.um ?? {}; const am = f.am ?? {};
  return { auth_id: f.id, email: f.email, telefono: f.phone, nombre: um.nombre ?? um.name ?? um.full_name ?? um.display_name ?? null, rol: am.rol ?? am.role ?? um.rol ?? um.role ?? null, confirmado: !!f.email_confirmed_at, bloqueado: !!f.banned_until && new Date(f.banned_until) > new Date(), bloqueado_hasta: f.banned_until ?? null, proveedor: (am.provider ?? (am.providers ?? [])[0] ?? "email"), creado_en_app: f.created_at, ultimo_acceso: f.last_sign_in_at, metadatos: { user: um, app: am } };
}
async function sincronizarProyecto(sb: SB, userId: string, p: any) {
  const filas: any[] = await sqlEn(p.supabase_ref, CONSULTA_USUARIOS);
  const lista = filas.map(normalizar);
  if (lista.length) await sb.from("usuarios_clientes").upsert(lista.map((u) => ({ ...u, user_id: userId, proyecto_id: p.id, supabase_ref: p.supabase_ref, sincronizado_el: ahora() })), { onConflict: "supabase_ref,auth_id" });
  const ids = lista.map((u) => u.auth_id);
  if (ids.length) await sb.from("usuarios_clientes").delete().eq("supabase_ref", p.supabase_ref).not("auth_id", "in", `(${ids.join(",")})`);
  else await sb.from("usuarios_clientes").delete().eq("supabase_ref", p.supabase_ref);
  return lista;
}
function contrasenaSegura() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const b = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(b, (x) => c[x % c.length]).join("") + "!";
}
async function reflejarEnProyectian(p: any, u: { auth_id?: string; email: string; nombre?: string | null }, contrasena: string | null, accion: string) {
  // Alta/actualización en app_usuarios y contraseña visible (cifrada con la clave maestra) en claves
  if (!TOKEN_CUENTA) return false;
  const slug = p.proyectian_slug ?? p.slug;
  const sql = `do $$
declare v_p uuid; v_due uuid; v_u uuid; v_c uuid;
begin
  select id, user_id into v_p, v_due from public.proyectos where slug = ${sqlLit(slug)} limit 1;
  if v_p is null then return; end if;
  select id, clave_id into v_u, v_c from public.app_usuarios where proyecto_id = v_p and (lower(email) = lower(${sqlLit(u.email)}) ${u.auth_id ? `or auth_uid_remoto = ${sqlLit(u.auth_id)}::uuid` : ""}) limit 1;
  if v_u is null then
    insert into public.app_usuarios (user_id, proyecto_id, nombre, email, auth_uid_remoto, entorno, estado, fecha_alta, sincronizado_el, notas)
    values (v_due, v_p, ${sqlLit(u.nombre ?? u.email.split("@")[0])}, ${sqlLit(u.email)}, ${u.auth_id ? `${sqlLit(u.auth_id)}::uuid` : "null"}, 'produccion', 'activo', current_date, now(), 'Creado desde NexDeveloper')
    returning id, clave_id into v_u, v_c;
  else
    update public.app_usuarios set auth_uid_remoto = coalesce(${u.auth_id ? `${sqlLit(u.auth_id)}::uuid` : "null"}, auth_uid_remoto), estado = ${sqlLit(accion === "bloquear" ? "suspendido" : accion === "borrar" ? "baja" : "activo")}, fecha_baja = ${accion === "borrar" ? "current_date" : "null"}, sincronizado_el = now(), updated_at = now() where id = v_u;
  end if;
  ${contrasena ? `
  if v_c is null then
    insert into public.claves (user_id, proyecto_id, nombre, tipo, entorno, usuario, valor_cifrado, iv, ultima_rotacion, notas)
    values (v_due, v_p, 'Acceso ' || ${sqlLit(u.email)}, 'password', 'produccion', ${sqlLit(u.email)}, encode(extensions.pgp_sym_encrypt(${sqlLit(contrasena)}, public.fn_clave_maestra()), 'base64'), 'pgp_sym_v1', current_date, 'Contraseña puesta desde NexDeveloper')
    returning id into v_c;
    update public.app_usuarios set clave_id = v_c where id = v_u;
  else
    update public.claves set valor_cifrado = encode(extensions.pgp_sym_encrypt(${sqlLit(contrasena)}, public.fn_clave_maestra()), 'base64'), iv = 'pgp_sym_v1', ultima_rotacion = current_date, updated_at = now() where id = v_c;
  end if;` : ""}
  insert into public.app_accesos_log (user_id, proyecto_id, tipo, detalle) values (v_due, v_p, 'nexdeveloper', ${sqlLit(`${accion}: ${u.email}`)});
end $$;`;
  try { await sqlEn(REF_PROYECTIAN, sql, false); return true; } catch { return false; }
}
async function registrar(sb: SB, userId: string, p: any, accion: string, email: string | null, authId: string | null, resultado: string, detalle: string | null, proyectian: boolean | null) {
  await sb.from("usuarios_acciones").insert({ user_id: userId, proyecto_id: p?.id ?? null, supabase_ref: p?.supabase_ref ?? null, accion, email, auth_id: authId, resultado, detalle, proyectian });
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
    const proyecto = async () => { const { data: p } = await sb.from("proyectos").select("id, nombre, slug, proyectian_slug, supabase_ref").eq("id", String(cuerpo.proyecto_id)).eq("user_id", userId!).maybeSingle(); if (!p) throw new Error("Proyecto no encontrado"); if (!p.supabase_ref) throw new Error("El proyecto no tiene Supabase asociado"); return p; };
    switch (accion) {
      case "programado": {
        if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
        const { data: ps } = await sb.from("proyectos").select("id, user_id, supabase_ref").not("supabase_ref", "is", null);
        let n = 0;
        for (const p of ps ?? []) { if (Date.now() - INICIO > 100_000) break; try { n += (await sincronizarProyecto(sb, p.user_id, p)).length; } catch { /* siguiente */ } }
        return json({ ok: true, usuarios: n });
      }
      case "estado": {
        const { count } = await sb.from("usuarios_clientes").select("id", { count: "exact", head: true }).eq("user_id", userId!);
        const { data: ult } = await sb.from("usuarios_clientes").select("sincronizado_el").eq("user_id", userId!).order("sincronizado_el", { ascending: false }).limit(1).maybeSingle();
        return json({ ok: true, total: count ?? 0, ultima_sincronizacion: ult?.sincronizado_el ?? null, token_cuenta: !!TOKEN_CUENTA });
      }
      case "sincronizar": {
        if (cuerpo.proyecto_id) { const p = await proyecto(); const l = await sincronizarProyecto(sb, userId!, p); await registrar(sb, userId!, p, "sincronizar", null, null, "ok", `${l.length} usuarios`, null); return json({ ok: true, usuarios: l.length }); }
        const { data: ps } = await sb.from("proyectos").select("id, nombre, slug, supabase_ref").eq("user_id", userId!).not("supabase_ref", "is", null);
        const res: any[] = [];
        for (const p of ps ?? []) { if (Date.now() - INICIO > 100_000) { res.push({ proyecto: p.nombre, pendiente: true }); continue; } try { res.push({ proyecto: p.nombre, usuarios: (await sincronizarProyecto(sb, userId!, p)).length }); } catch (e) { res.push({ proyecto: p.nombre, error: String(e?.message ?? e).slice(0, 120) }); } }
        return json({ ok: true, resultados: res });
      }
      case "listar": {
        // Lista en vivo del proyecto (y refresca la caché)
        const p = await proyecto();
        const l = await sincronizarProyecto(sb, userId!, p);
        return json({ ok: true, proyecto: p.nombre, usuarios: l });
      }
      case "crear": {
        const p = await proyecto();
        const email = String(cuerpo.email ?? "").trim().toLowerCase(); if (!email.includes("@")) return json({ ok: false, error: "Correo no válido" });
        const contrasena = cuerpo.contrasena ? String(cuerpo.contrasena) : contrasenaSegura();
        try {
          const meta: Record<string, unknown> = { ...(cuerpo.metadatos ?? {}) }; if (cuerpo.nombre) { meta.nombre = cuerpo.nombre; meta.full_name = cuerpo.nombre; }
          const appMeta: Record<string, unknown> = cuerpo.rol ? { rol: cuerpo.rol, role: cuerpo.rol } : {};
          const u = await authAdmin(p.supabase_ref, "/users", { method: "POST", body: JSON.stringify({ email, password: contrasena, email_confirm: cuerpo.confirmar !== false, phone: cuerpo.telefono || undefined, user_metadata: meta, app_metadata: appMeta }) });
          const proy = await reflejarEnProyectian(p, { auth_id: u.id, email, nombre: cuerpo.nombre ?? null }, contrasena, "crear");
          await sincronizarProyecto(sb, userId!, p).catch(() => {});
          await registrar(sb, userId!, p, "crear", email, u.id, "ok", cuerpo.rol ? `rol ${cuerpo.rol}` : null, proy);
          return json({ ok: true, auth_id: u.id, contrasena, proyectian: proy });
        } catch (e) { const msg = String(e?.message ?? e); await registrar(sb, userId!, p, "crear", email, null, "error", msg, null); return json({ ok: false, error: msg }); }
      }
      case "invitar": {
        const p = await proyecto();
        const email = String(cuerpo.email ?? "").trim().toLowerCase(); if (!email.includes("@")) return json({ ok: false, error: "Correo no válido" });
        try {
          const u = await authAdmin(p.supabase_ref, "/invite", { method: "POST", body: JSON.stringify({ email, data: cuerpo.nombre ? { nombre: cuerpo.nombre } : {} }) });
          const proy = await reflejarEnProyectian(p, { auth_id: u.id, email, nombre: cuerpo.nombre ?? null }, null, "invitar");
          await sincronizarProyecto(sb, userId!, p).catch(() => {});
          await registrar(sb, userId!, p, "invitar", email, u.id, "ok", null, proy);
          return json({ ok: true, auth_id: u.id });
        } catch (e) { const msg = String(e?.message ?? e); await registrar(sb, userId!, p, "invitar", email, null, "error", msg, null); return json({ ok: false, error: msg }); }
      }
      case "resetear": {
        const p = await proyecto();
        const authId = String(cuerpo.auth_id ?? ""); if (!authId) return json({ ok: false, error: "Falta el usuario" });
        const contrasena = cuerpo.contrasena ? String(cuerpo.contrasena) : contrasenaSegura();
        try {
          const u = await authAdmin(p.supabase_ref, `/users/${authId}`, { method: "PUT", body: JSON.stringify({ password: contrasena }) });
          const proy = await reflejarEnProyectian(p, { auth_id: authId, email: u.email ?? cuerpo.email ?? "", nombre: null }, contrasena, "resetear");
          await registrar(sb, userId!, p, "resetear", u.email ?? null, authId, "ok", null, proy);
          return json({ ok: true, contrasena, proyectian: proy });
        } catch (e) { const msg = String(e?.message ?? e); await registrar(sb, userId!, p, "resetear", cuerpo.email ?? null, authId, "error", msg, null); return json({ ok: false, error: msg }); }
      }
      case "bloquear": case "desbloquear": {
        const p = await proyecto();
        const authId = String(cuerpo.auth_id ?? ""); if (!authId) return json({ ok: false, error: "Falta el usuario" });
        try {
          const u = await authAdmin(p.supabase_ref, `/users/${authId}`, { method: "PUT", body: JSON.stringify({ ban_duration: accion === "bloquear" ? "876000h" : "none" }) });
          const proy = await reflejarEnProyectian(p, { auth_id: authId, email: u.email ?? "", nombre: null }, null, accion);
          await sincronizarProyecto(sb, userId!, p).catch(() => {});
          await registrar(sb, userId!, p, accion, u.email ?? null, authId, "ok", null, proy);
          return json({ ok: true });
        } catch (e) { const msg = String(e?.message ?? e); await registrar(sb, userId!, p, accion, cuerpo.email ?? null, authId, "error", msg, null); return json({ ok: false, error: msg }); }
      }
      case "actualizar": {
        const p = await proyecto();
        const authId = String(cuerpo.auth_id ?? ""); if (!authId) return json({ ok: false, error: "Falta el usuario" });
        try {
          const cambios: Record<string, unknown> = {};
          if (cuerpo.email) cambios.email = String(cuerpo.email).trim().toLowerCase();
          if (cuerpo.telefono !== undefined) cambios.phone = cuerpo.telefono || null;
          if (cuerpo.nombre !== undefined || cuerpo.metadatos) cambios.user_metadata = { ...(cuerpo.metadatos ?? {}), ...(cuerpo.nombre !== undefined ? { nombre: cuerpo.nombre, full_name: cuerpo.nombre } : {}) };
          if (cuerpo.rol !== undefined) cambios.app_metadata = { rol: cuerpo.rol, role: cuerpo.rol };
          if (cuerpo.confirmar) cambios.email_confirm = true;
          const u = await authAdmin(p.supabase_ref, `/users/${authId}`, { method: "PUT", body: JSON.stringify(cambios) });
          await sincronizarProyecto(sb, userId!, p).catch(() => {});
          await registrar(sb, userId!, p, "actualizar", u.email ?? null, authId, "ok", Object.keys(cambios).join(", "), null);
          return json({ ok: true });
        } catch (e) { const msg = String(e?.message ?? e); await registrar(sb, userId!, p, "actualizar", cuerpo.email ?? null, authId, "error", msg, null); return json({ ok: false, error: msg }); }
      }
      case "borrar": {
        const p = await proyecto();
        const authId = String(cuerpo.auth_id ?? ""); if (!authId) return json({ ok: false, error: "Falta el usuario" });
        if (String(cuerpo.confirmacion ?? "").toUpperCase() !== "BORRAR") return json({ ok: false, error: "Escribe BORRAR para confirmar" });
        try {
          await authAdmin(p.supabase_ref, `/users/${authId}`, { method: "DELETE" });
          const proy = await reflejarEnProyectian(p, { auth_id: authId, email: String(cuerpo.email ?? ""), nombre: null }, null, "borrar");
          await sb.from("usuarios_clientes").delete().eq("supabase_ref", p.supabase_ref).eq("auth_id", authId);
          await registrar(sb, userId!, p, "borrar", cuerpo.email ?? null, authId, "ok", null, proy);
          return json({ ok: true });
        } catch (e) { const msg = String(e?.message ?? e); await registrar(sb, userId!, p, "borrar", cuerpo.email ?? null, authId, "error", msg, null); return json({ ok: false, error: msg }); }
      }
      case "contrasena_proyectian": {
        // Recuperar la contraseña guardada en Proyectian (visible con el ojo) para un usuario
        const p = await proyecto();
        try {
          const filas = await sqlEn(REF_PROYECTIAN, `select extensions.pgp_sym_decrypt(decode(c.valor_cifrado,'base64'), public.fn_clave_maestra()) as contrasena from public.app_usuarios u join public.claves c on c.id = u.clave_id join public.proyectos p on p.id = u.proyecto_id where p.slug = ${sqlLit(p.proyectian_slug ?? p.slug)} and lower(u.email) = lower(${sqlLit(String(cuerpo.email ?? ""))}) and c.valor_cifrado is not null limit 1`, false);
          return json({ ok: true, contrasena: filas?.[0]?.contrasena ?? null });
        } catch (e) { return json({ ok: false, error: String(e?.message ?? e) }); }
      }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (err) { return json({ ok: false, error: String(err?.message ?? err) }, 500); }
});
