// NexDeveloper · Edge Function «facturacion» v3 (0.33.0) · Puente con EvoluteIA · empresa emisora elegible por proyecto
// (SOLO MODEONTECNO S.L. o SOLUCIONES EVOLUTEIA S.L., decisión de Javier 6/09/2026: ninguna otra empresa de EvoluteIA puede emitir
// desde NexDeveloper. Cada proyecto se factura desde la que se elija; si no, la de por defecto)
// La facturación NO vive en NexDeveloper: los clientes (terceros), contratos, facturas, numeración, Verifactu, vencimientos y cobros
// están en EvoluteIA (el ERP propio, Supabase eykvsbqwkvfnfiztehsy, empresa MODEONTECNO S.L. por defecto). NexDeveloper aporta las
// HORAS por proyecto (manual, cronómetro, automáticas) y el GASTO DE IA, y con ellas prepara borradores de factura en EvoluteIA,
// los emite allí (emitir_documento → numeración de serie + registro Verifactu) y lee el estado de cobro.
// Acceso a EvoluteIA como el propio Javier (sesión de usuario con su contraseña guardada en Proyectian; nunca se muestra), de modo que
// se respetan sus permisos y disparadores. La sesión (refresh token) se guarda cifrada en conexiones_externas ('evoluteia').
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_CUENTA = Deno.env.get("CUENTA_SUPABASE_TOKEN") ?? "";
const REF_PROYECTIAN = "hjtweberlereyfhagkvx";
// Empresas emisoras PERMITIDAS (las dos del fabricante). Cualquier otra empresa de EvoluteIA queda fuera aunque exista.
const TENANTS_PERMITIDOS: Record<string, string> = { "0440f414-d6a3-4a34-934f-7e581d6e9881": "MODEONTECNO S.L.", "11111111-2222-4333-8444-555555555555": "SOLUCIONES EVOLUTEIA S.L." };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const ahora = () => new Date().toISOString();
const hoy = () => new Date().toISOString().slice(0, 10);
const sqlLit = (s: unknown) => s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`;
const r2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
const fechaEs = (d?: string | null) => d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }) : "";

// ---------- API de administración / Proyectian ----------
async function admin(ruta: string, init: RequestInit = {}) {
  if (!TOKEN_CUENTA) throw new Error("Falta el secreto CUENTA_SUPABASE_TOKEN");
  const r = await fetch(`https://api.supabase.com/v1${ruta}`, { ...init, headers: { Authorization: `Bearer ${TOKEN_CUENTA}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  if (!r.ok) throw new Error(`API Supabase ${r.status}: ${String(j?.message ?? t).slice(0, 200)}`);
  return j;
}
async function sqlEn(ref: string, query: string, readOnly = true) { const r = await admin(`/projects/${ref}/database/query`, { method: "POST", body: JSON.stringify({ query, read_only: readOnly }) }); return Array.isArray(r) ? r : (r?.result ?? r); }
async function claveAnon(ref: string) { const keys = await admin(`/projects/${ref}/api-keys?reveal=true`); const k = (keys ?? []).find((x: any) => x.name === "anon" || x.type === "publishable" || x.id === "anon"); if (!k?.api_key) throw new Error("No se pudo obtener la clave pública de EvoluteIA"); return String(k.api_key); }

// ---------- Sesión en EvoluteIA como Javier ----------
type Empresa = { tenant_id: string; empresa_id: string; sede_id: string | null; forma_pago_id: string | null; impuesto_id: string | null; nombre: string; nif: string | null; por_defecto: boolean; activa: boolean };
type Evo = { ref: string; base: string; anon: string; token: string; cfg: any; empresas: Empresa[] };
// Catálogo de empresas emisoras (facturacion_empresas) y resolución de la empresa de un proyecto
async function catalogoEmpresas(sb: SB, userId: string): Promise<Empresa[]> { const { data } = await sb.from("facturacion_empresas").select("*").eq("user_id", userId).eq("activa", true).order("por_defecto", { ascending: false }); return ((data ?? []) as Empresa[]).filter((x) => !!TENANTS_PERMITIDOS[x.tenant_id]); }
function empresaPara(e: Evo, tenantId?: string | null): Empresa {
  const t = tenantId ?? e.cfg.evoluteia_tenant_id;
  if (t && !TENANTS_PERMITIDOS[t]) throw new Error("Solo pueden facturar MODEONTECNO S.L. o SOLUCIONES EVOLUTEIA S.L.; ninguna otra empresa de EvoluteIA");
  const emp = e.empresas.find((x) => x.tenant_id === t) ?? e.empresas.find((x) => x.por_defecto) ?? e.empresas[0];
  if (!emp) throw new Error("No hay ninguna empresa emisora configurada (Facturación → Configuración → Empresas)");
  return emp;
}
async function conectarEvoluteia(sb: SB, userId: string, cfg: any): Promise<Evo> {
  const ref = cfg.evoluteia_ref; const base = `https://${ref}.supabase.co`; const anon = await claveAnon(ref); const empresas = await catalogoEmpresas(sb, userId);
  const { data } = await sb.rpc("leer_secretos_conexion", { p_user_id: userId, p_proveedor: "evoluteia" });
  const c = (data ?? [])[0];
  if (c?.access_token && c.expira_el && new Date(c.expira_el).getTime() - Date.now() > 60_000) { const e0: Evo = { ref, base, anon, token: c.access_token, cfg, empresas }; await comprobarModulo(e0, empresaPara(e0).tenant_id); return e0; }
  let tok: any = null;
  if (c?.refresh_token) {
    const r = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: c.refresh_token }) });
    if (r.ok) tok = await r.json();
  }
  if (!tok) {
    // Contraseña de Javier en EvoluteIA, guardada en Proyectian (no se muestra ni se guarda aquí)
    const email = String(cfg.evoluteia_usuario ?? "");
    const filas = await sqlEn(REF_PROYECTIAN, `select extensions.pgp_sym_decrypt(decode(c.valor_cifrado,'base64'), public.fn_clave_maestra()) as contrasena from public.app_usuarios u join public.claves c on c.id = u.clave_id join public.proyectos p on p.id = u.proyecto_id where p.slug = 'evoluteia' and lower(u.email) = lower(${sqlLit(email)}) and c.valor_cifrado is not null limit 1`, false);
    const pass = filas?.[0]?.contrasena; if (!pass) throw new Error(`No hay contraseña de ${email} para EvoluteIA en Proyectian (usuarios y claves del proyecto evoluteia)`);
    const r = await fetch(`${base}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pass }) });
    if (!r.ok) { const t = await r.text(); await sb.from("conexiones_externas").upsert({ user_id: userId, proveedor: "evoluteia", estado: "error", ultimo_error: `Acceso rechazado: ${t.slice(0, 160)}`, actualizado_el: ahora() }); throw new Error(`EvoluteIA rechazó el acceso de ${email} (${r.status})`); }
    tok = await r.json();
  }
  const expira = new Date(Date.now() + Number(tok.expires_in ?? 3600) * 1000).toISOString();
  await sb.rpc("guardar_secreto_conexion", { p_user_id: userId, p_proveedor: "evoluteia", p_refresh: tok.refresh_token ?? null, p_acceso: tok.access_token, p_expira: expira });
  await sb.from("conexiones_externas").update({ estado: "conectada", cuenta: cfg.evoluteia_usuario, ultimo_error: null, ultima_comprobacion: ahora(), actualizado_el: ahora() }).eq("user_id", userId).eq("proveedor", "evoluteia");
  const e: Evo = { ref, base, anon, token: tok.access_token, cfg, empresas };
  await comprobarModulo(e, empresaPara(e).tenant_id);
  return e;
}
// El módulo «NexDeveloper (solo fabricante)» debe estar activo en el espacio de trabajo de EvoluteIA: no se opera con clientes de EvoluteIA
async function comprobarModulo(e: Evo, tenantId: string) {
  const activo = await evoRpc(e, "nexdeveloper_activo", { p_tenant: tenantId }).catch(() => null);
  if (activo !== true) throw new Error("El módulo «NexDeveloper (solo fabricante)» no está activo en este espacio de EvoluteIA. Esta integración es exclusiva del fabricante (MODEONTECNO / Soluciones EvoluteIA); para un cliente solo se activa si se le vende NexDeveloper o se enlaza expresamente.");
}
// PostgREST como el usuario
async function evoRest(e: Evo, ruta: string, init: RequestInit = {}, prefer?: string) {
  const r = await fetch(`${e.base}/rest/v1/${ruta}`, { ...init, headers: { apikey: e.anon, Authorization: `Bearer ${e.token}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}), ...(init.headers ?? {}) } });
  const t = await r.text(); let j: any = null; try { j = t ? JSON.parse(t) : null; } catch { j = { raw: t }; }
  if (!r.ok) throw new Error(`EvoluteIA ${r.status} ${ruta.split("?")[0]}: ${String(j?.message ?? j?.hint ?? t).slice(0, 220)}`);
  return j;
}
const evoRpc = (e: Evo, fn: string, args: Record<string, unknown>) => evoRest(e, `rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
async function asegurarTenantActivo(e: Evo, tenantId?: string) {
  // auth_tenants() usa perfiles.tenant_activo_id: lo ponemos en la empresa que corresponda y devolvemos el anterior para restaurarlo
  const t = tenantId ?? empresaPara(e).tenant_id;
  await comprobarModulo(e, t);
  const yo = await evoRest(e, `perfiles?select=id,tenant_activo_id&id=eq.${await miPerfilId(e)}`);
  const anterior = yo?.[0]?.tenant_activo_id ?? null;
  if (anterior !== t) await evoRest(e, `perfiles?id=eq.${yo[0].id}`, { method: "PATCH", body: JSON.stringify({ tenant_activo_id: t }) }, "return=minimal");
  return async () => { if (anterior && anterior !== t) await evoRest(e, `perfiles?id=eq.${yo[0].id}`, { method: "PATCH", body: JSON.stringify({ tenant_activo_id: anterior }) }, "return=minimal").catch(() => {}); };
}
async function tenantDeDocumento(e: Evo, documentoId: string) { const d = (await evoRest(e, `documentos?select=tenant_id&id=eq.${documentoId}`))?.[0]; if (!d) throw new Error("Factura no encontrada en EvoluteIA"); return String(d.tenant_id); }
let _perfil: string | null = null;
async function miPerfilId(e: Evo) { if (_perfil) return _perfil; const r = await fetch(`${e.base}/auth/v1/user`, { headers: { apikey: e.anon, Authorization: `Bearer ${e.token}` } }); const j = await r.json(); _perfil = j?.id; if (!_perfil) throw new Error("No se pudo leer el usuario de EvoluteIA"); return _perfil; }

// ---------- Configuración ----------
async function config(sb: SB, userId: string) {
  const { data } = await sb.from("facturacion_config").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data;
  const { data: n } = await sb.from("facturacion_config").insert({ user_id: userId }).select("*").single();
  return n!;
}
async function clienteDe(sb: SB, userId: string, proyectoId: string) { const { data } = await sb.from("facturacion_clientes").select("*").eq("user_id", userId).eq("proyecto_id", proyectoId).maybeSingle(); return data ?? { proyecto_id: proyectoId, contrato: "horas", dia_facturacion: 1 }; }
function periodoMesAnterior() { const d = new Date(); const desde = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)); const hasta = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)); return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) }; }

// ---------- Preparar factura en EvoluteIA ----------
async function prepararFactura(sb: SB, userId: string, e: Evo, proyectoId: string, desde: string, hasta: string, opciones: { incluir_horas?: boolean; incluir_ia?: boolean; lineas_extra?: any[]; notas?: string } = {}) {
  const cfg = e.cfg; const cli = await clienteDe(sb, userId, proyectoId); const emp = empresaPara(e, cli.evoluteia_tenant_id);
  const { data: p } = await sb.from("proyectos").select("id, nombre, slug").eq("id", proyectoId).eq("user_id", userId).single();
  if (!p) throw new Error("Proyecto no encontrado");
  if (!cli.tercero_id) throw new Error(`${p.nombre} no está enlazado a un cliente de EvoluteIA: Facturación → Clientes → «Enlazar con EvoluteIA»`);
  if (cli.contrato === "sin_facturar") throw new Error(`${p.nombre} está marcado como «sin facturar»`);
  const tarifa = Number(cli.tarifa_hora ?? cfg.tarifa_hora ?? 0); const refacturarIa = cli.refacturar_ia ?? cfg.refacturar_ia;
  const { data: horas } = await sb.from("horas_registro").select("id, horas, descripcion, fecha").eq("user_id", userId).eq("proyecto_id", proyectoId).eq("facturable", true).is("evoluteia_documento_id", null).gte("fecha", desde).lte("fecha", hasta).order("fecha");
  const totalHoras = r2((horas ?? []).reduce((a, h) => a + Number(h.horas), 0));
  const { data: ia } = await sb.from("consumos_ia").select("coste").eq("user_id", userId).eq("proyecto_id", proyectoId).gte("created_at", `${desde}T00:00:00Z`).lte("created_at", `${hasta}T23:59:59Z`);
  const { data: ej } = await sb.from("ejecuciones_orden").select("coste_ia").eq("user_id", userId).eq("proyecto_id", proyectoId).gte("creado_el", `${desde}T00:00:00Z`).lte("creado_el", `${hasta}T23:59:59Z`);
  const costeIa = r2((ia ?? []).reduce((a, c) => a + Number(c.coste ?? 0), 0) + (ej ?? []).reduce((a, x) => a + Number(x.coste_ia ?? 0), 0));
  const lineas: { descripcion: string; cantidad: number; precio: number }[] = [];
  const detalleHoras = (horas ?? []).slice(0, 15).map((h) => `${h.fecha} · ${h.horas} h${h.descripcion ? ` · ${String(h.descripcion).slice(0, 60)}` : ""}`).join("; ");
  let documentoId: string; let numeroPrevisto: string | null = null; let deContrato = false;
  const restaurar = await asegurarTenantActivo(e, emp.tenant_id);
  try {
    if (cli.contrato === "mensual" && cli.contrato_id) {
      // Cuota del contrato: la factura EvoluteIA (facturar_contrato); añadimos horas extra e IA si sigue en borrador
      const periodo = desde.slice(0, 7);
      const r = await evoRpc(e, "facturar_contrato", { p_contrato: cli.contrato_id, p_periodo: periodo, p_forma_pago: emp.forma_pago_id ?? null, p_fecha: hoy() });
      const fila = Array.isArray(r) ? r[0] : r; documentoId = fila?.documento_id; deContrato = true;
      if (!documentoId) throw new Error("EvoluteIA no devolvió la factura del contrato");
      const extra = r2(Math.max(0, totalHoras - Number(cli.horas_incluidas ?? 0)));
      if (extra > 0 && opciones.incluir_horas !== false) lineas.push({ descripcion: `HORAS FUERA DE LA CUOTA · ${p.nombre} · ${periodo} (${totalHoras} h trabajadas, ${cli.horas_incluidas ?? 0} h incluidas). ${detalleHoras}`, cantidad: extra, precio: tarifa });
    } else {
      if (cli.contrato === "fijo") lineas.push({ descripcion: `DESARROLLO A PRECIO CERRADO · ${p.nombre} · ${fechaEs(desde)} – ${fechaEs(hasta)}`, cantidad: 1, precio: r2(Number(cli.importe_fijo ?? 0)) });
      else if (opciones.incluir_horas !== false && totalHoras > 0) lineas.push({ descripcion: `HORAS DE DESARROLLO Y MANTENIMIENTO · ${p.nombre} · ${fechaEs(desde)} – ${fechaEs(hasta)}. ${detalleHoras}`, cantidad: totalHoras, precio: tarifa });
      if (refacturarIa && opciones.incluir_ia !== false && costeIa > 0) lineas.push({ descripcion: `USO DE INTELIGENCIA ARTIFICIAL · ${p.nombre} · ${desde.slice(0, 7)} (coste ${eur(costeIa)}${Number(cfg.recargo_ia_pct) ? ` + ${cfg.recargo_ia_pct} % gestión` : ""})`, cantidad: 1, precio: r2(costeIa * (1 + Number(cfg.recargo_ia_pct ?? 0) / 100)) });
      for (const l of opciones.lineas_extra ?? []) lineas.push({ descripcion: String(l.concepto ?? l.descripcion ?? ""), cantidad: Number(l.cantidad ?? 1), precio: r2(Number(l.precio ?? 0)) });
      if (!lineas.length) throw new Error(`No hay nada que facturar en ${p.nombre} para ${fechaEs(desde)} – ${fechaEs(hasta)} (sin horas facturables ni gasto de IA)`);
      const doc = await evoRest(e, "documentos", { method: "POST", body: JSON.stringify({ tenant_id: emp.tenant_id, empresa_id: emp.empresa_id, sede_id: emp.sede_id, tipo: "factura", fecha: hoy(), tercero_id: cli.tercero_id, estado: "borrador", forma_pago_id: emp.forma_pago_id ?? null, observaciones: `${opciones.notas ? opciones.notas + " · " : ""}Preparada por NexDeveloper · proyecto ${p.nombre} · periodo ${desde} a ${hasta}`, datos_extra: { nexdeveloper: { proyecto_id: p.id, proyecto: p.nombre, desde, hasta, horas: totalHoras, coste_ia: costeIa, empresa: emp.nombre } } }) }, "return=representation");
      documentoId = (Array.isArray(doc) ? doc[0] : doc)?.id; if (!documentoId) throw new Error("EvoluteIA no devolvió el documento");
    }
    if (deContrato && refacturarIa && opciones.incluir_ia !== false && costeIa > 0) lineas.push({ descripcion: `USO DE INTELIGENCIA ARTIFICIAL · ${p.nombre} · ${desde.slice(0, 7)} (coste ${eur(costeIa)}${Number(cfg.recargo_ia_pct) ? ` + ${cfg.recargo_ia_pct} % gestión` : ""})`, cantidad: 1, precio: r2(costeIa * (1 + Number(cfg.recargo_ia_pct ?? 0) / 100)) });
    if (lineas.length) {
      const est = await evoRest(e, `documentos?select=estado&id=eq.${documentoId}`); const estado = est?.[0]?.estado;
      if (estado === "borrador") {
        const previas = await evoRest(e, `documento_lineas?select=orden&documento_id=eq.${documentoId}&order=orden.desc&limit=1`); let orden = Number(previas?.[0]?.orden ?? -1) + 1;
        await evoRest(e, "documento_lineas", { method: "POST", body: JSON.stringify(lineas.map((l) => ({ tenant_id: emp.tenant_id, documento_id: documentoId, orden: orden++, descripcion: l.descripcion.slice(0, 500), cantidad: l.cantidad, precio: l.precio, descuento: 0, tipo_iva: 21, importe: r2(l.cantidad * l.precio), impuesto_id: emp.impuesto_id }))) }, "return=minimal");
        await evoRpc(e, "recalcular_documento", { p_doc: documentoId });
      } else if (deContrato) {
        // El contrato ya emitió su factura: las horas extra/IA van en una factura aparte
        const doc2 = await evoRest(e, "documentos", { method: "POST", body: JSON.stringify({ tenant_id: emp.tenant_id, empresa_id: emp.empresa_id, sede_id: emp.sede_id, tipo: "factura", fecha: hoy(), tercero_id: cli.tercero_id, estado: "borrador", forma_pago_id: emp.forma_pago_id ?? null, observaciones: `Preparada por NexDeveloper · ${p.nombre} · extras del periodo ${desde} a ${hasta}`, datos_extra: { nexdeveloper: { proyecto_id: p.id, proyecto: p.nombre, desde, hasta, horas: totalHoras, coste_ia: costeIa, extras_de_contrato: documentoId } } }) }, "return=representation");
        const id2 = (Array.isArray(doc2) ? doc2[0] : doc2)?.id;
        await evoRest(e, "documento_lineas", { method: "POST", body: JSON.stringify(lineas.map((l, i) => ({ tenant_id: emp.tenant_id, documento_id: id2, orden: i, descripcion: l.descripcion.slice(0, 500), cantidad: l.cantidad, precio: l.precio, descuento: 0, tipo_iva: 21, importe: r2(l.cantidad * l.precio), impuesto_id: emp.impuesto_id }))) }, "return=minimal");
        await evoRpc(e, "recalcular_documento", { p_doc: id2 }); documentoId = id2;
      }
    }
    try { const n = await evoRpc(e, "numero_previsto_doc", { p_doc: documentoId }); numeroPrevisto = typeof n === "string" ? n : (n?.numero ?? null); } catch { numeroPrevisto = null; }
  } finally { await restaurar(); }
  if ((horas ?? []).length) await sb.from("horas_registro").update({ evoluteia_documento_id: documentoId, actualizado_el: ahora() }).in("id", (horas ?? []).map((h) => h.id));
  await refrescarFactura(sb, userId, e, documentoId, p.id, totalHoras, costeIa);
  return { documento_id: documentoId, numero_previsto: numeroPrevisto, empresa: emp.nombre, horas: totalHoras, coste_ia: costeIa, lineas: lineas.length, de_contrato: deContrato, url: `${cfg.evoluteia_url}/documentos/${documentoId}` };
}
async function refrescarFactura(sb: SB, userId: string, e: Evo, documentoId: string, proyectoId: string | null, horas = 0, costeIa = 0) {
  const d = (await evoRest(e, `documentos?select=id,tenant_id,tercero_id,numero,fecha,estado,base,cuota_iva,total,datos_extra&id=eq.${documentoId}`))?.[0]; if (!d) return null;
  const v = await evoRest(e, `vencimientos?select=importe,cobrado,estado,fecha&documento_id=eq.${documentoId}`);
  const pendiente = r2((v ?? []).reduce((a: number, x: any) => a + Math.max(0, Number(x.importe ?? 0) - Number(x.cobrado ?? 0)), 0));
  const vencido = (v ?? []).some((x: any) => Number(x.importe ?? 0) - Number(x.cobrado ?? 0) > 0 && x.fecha && x.fecha < hoy());
  const reg = await evoRest(e, `registro_facturacion?select=id&documento_id=eq.${documentoId}&limit=1`);
  const pid = proyectoId ?? d.datos_extra?.nexdeveloper?.proyecto_id ?? null;
  await sb.from("facturas_evoluteia").upsert({ documento_id: d.id, user_id: userId, proyecto_id: pid, tenant_id: d.tenant_id, empresa: e.empresas.find((x) => x.tenant_id === d.tenant_id)?.nombre ?? null, tercero_id: d.tercero_id, numero: d.numero, fecha: d.fecha, estado: d.estado, base: d.base, cuota_iva: d.cuota_iva, total: d.total, pendiente, vencido, verifactu: (reg ?? []).length > 0, pdf_ruta: d.datos_extra?.pdf_ruta ?? null, horas: horas || Number(d.datos_extra?.nexdeveloper?.horas ?? 0), coste_ia: costeIa || Number(d.datos_extra?.nexdeveloper?.coste_ia ?? 0), origen: d.datos_extra?.nexdeveloper ? "nexdeveloper" : "evoluteia", actualizado_el: ahora() });
  return { ...d, pendiente, vencido, verifactu: (reg ?? []).length > 0 };
}
async function sincronizarFacturas(sb: SB, userId: string, e: Evo) {
  // Todas las facturas de EvoluteIA de los terceros enlazados a proyectos (últimos 18 meses)
  const { data: clientes } = await sb.from("facturacion_clientes").select("proyecto_id, tercero_id").eq("user_id", userId).not("tercero_id", "is", null);
  const terceros = [...new Set((clientes ?? []).map((c) => c.tercero_id))]; if (!terceros.length) return { facturas: 0 };
  const desde = new Date(Date.now() - 548 * 86400000).toISOString().slice(0, 10);
  const tenants = e.empresas.map((x) => x.tenant_id); if (!tenants.length) return { facturas: 0 };
  const docs = await evoRest(e, `documentos?select=id,tenant_id,tercero_id,numero,fecha,estado,base,cuota_iva,total,datos_extra&tenant_id=in.(${tenants.join(",")})&tipo=in.(factura,rectificativa)&tercero_id=in.(${terceros.join(",")})&fecha=gte.${desde}&order=fecha.desc&limit=500`);
  const ids = (docs ?? []).map((d: any) => d.id); if (!ids.length) return { facturas: 0 };
  const vencs = await evoRest(e, `vencimientos?select=documento_id,importe,cobrado,fecha&documento_id=in.(${ids.join(",")})`);
  const regs = await evoRest(e, `registro_facturacion?select=documento_id&documento_id=in.(${ids.join(",")})`);
  const conReg = new Set((regs ?? []).map((r: any) => r.documento_id));
  const filas = (docs ?? []).map((d: any) => {
    const v = (vencs ?? []).filter((x: any) => x.documento_id === d.id);
    const pendiente = r2(v.reduce((a: number, x: any) => a + Math.max(0, Number(x.importe ?? 0) - Number(x.cobrado ?? 0)), 0));
    const vencido = v.some((x: any) => Number(x.importe ?? 0) - Number(x.cobrado ?? 0) > 0 && x.fecha && x.fecha < hoy());
    const pid = d.datos_extra?.nexdeveloper?.proyecto_id ?? (clientes ?? []).find((c) => c.tercero_id === d.tercero_id)?.proyecto_id ?? null;
    return { documento_id: d.id, user_id: userId, proyecto_id: pid, tenant_id: d.tenant_id, empresa: e.empresas.find((x) => x.tenant_id === d.tenant_id)?.nombre ?? null, tercero_id: d.tercero_id, numero: d.numero, fecha: d.fecha, estado: d.estado, base: d.base, cuota_iva: d.cuota_iva, total: d.total, pendiente, vencido, verifactu: conReg.has(d.id), pdf_ruta: d.datos_extra?.pdf_ruta ?? null, horas: Number(d.datos_extra?.nexdeveloper?.horas ?? 0), coste_ia: Number(d.datos_extra?.nexdeveloper?.coste_ia ?? 0), origen: d.datos_extra?.nexdeveloper ? "nexdeveloper" : "evoluteia", actualizado_el: ahora() };
  });
  for (let i = 0; i < filas.length; i += 100) await sb.from("facturas_evoluteia").upsert(filas.slice(i, i + 100));
  return { facturas: filas.length };
}

// ---------- Resumen ----------
async function resumen(sb: SB, userId: string, mes?: string) {
  const m = mes ?? hoy().slice(0, 7); const desde = `${m}-01`; const hastaD = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const cfg = await config(sb, userId);
  const { data: proyectos } = await sb.from("proyectos").select("id, nombre, slug, color").eq("user_id", userId).order("nombre");
  const { data: horas } = await sb.from("horas_registro").select("proyecto_id, horas, facturable, evoluteia_documento_id").eq("user_id", userId).gte("fecha", desde).lte("fecha", hastaD);
  const { data: fs } = await sb.from("facturas_evoluteia").select("*").eq("user_id", userId);
  const { data: ia } = await sb.from("consumos_ia").select("proyecto_id, coste").eq("user_id", userId).gte("created_at", `${desde}T00:00:00Z`).lte("created_at", `${hastaD}T23:59:59Z`);
  const { data: ej } = await sb.from("ejecuciones_orden").select("proyecto_id, coste_ia").eq("user_id", userId).gte("creado_el", `${desde}T00:00:00Z`).lte("creado_el", `${hastaD}T23:59:59Z`);
  const { data: clientes } = await sb.from("facturacion_clientes").select("proyecto_id, contrato, cuota_mensual, tarifa_hora, tercero_id, nombre_fiscal, evoluteia_tenant_id").eq("user_id", userId);
  const catalogo = await catalogoEmpresas(sb, userId); const nombreEmpresa = (t?: string | null) => (catalogo.find((x) => x.tenant_id === (t ?? cfg.evoluteia_tenant_id)) ?? catalogo.find((x) => x.por_defecto))?.nombre ?? null;
  const porProyecto = (proyectos ?? []).map((p) => {
    const h = (horas ?? []).filter((x) => x.proyecto_id === p.id);
    const hs = r2(h.reduce((a, x) => a + Number(x.horas), 0)); const hsPend = r2(h.filter((x) => x.facturable && !x.evoluteia_documento_id).reduce((a, x) => a + Number(x.horas), 0));
    const mias = (fs ?? []).filter((f) => f.proyecto_id === p.id);
    const delMes = mias.filter((f) => String(f.fecha ?? "").slice(0, 7) === m && f.estado !== "anulado" && f.estado !== "borrador");
    const facturado = r2(delMes.reduce((a, f) => a + Number(f.base ?? 0), 0));
    const cobrado = r2(delMes.reduce((a, f) => a + (Number(f.total ?? 0) - Number(f.pendiente ?? 0)), 0));
    const costeIa = r2((ia ?? []).filter((x) => x.proyecto_id === p.id).reduce((a, x) => a + Number(x.coste ?? 0), 0) + (ej ?? []).filter((x) => x.proyecto_id === p.id).reduce((a, x) => a + Number(x.coste_ia ?? 0), 0));
    const cli = (clientes ?? []).find((c) => c.proyecto_id === p.id); const tarifa = Number(cli?.tarifa_hora ?? cfg.tarifa_hora);
    return { proyecto_id: p.id, nombre: p.nombre, slug: p.slug, color: p.color, enlazado: !!cli?.tercero_id, cliente: cli?.nombre_fiscal ?? null, empresa: nombreEmpresa(cli?.evoluteia_tenant_id), tenant_id: cli?.evoluteia_tenant_id ?? cfg.evoluteia_tenant_id, contrato: cli?.contrato ?? "horas", horas: hs, horas_sin_facturar: hsPend, facturado, cobrado, coste_ia: costeIa, margen: r2(facturado - costeIa), pendiente_facturar: cli?.contrato === "mensual" ? r2(Number(cli.cuota_mensual ?? 0)) : r2(hsPend * tarifa), borradores: mias.filter((f) => f.estado === "borrador").length, pendiente_cobro: r2(mias.reduce((a, f) => a + Number(f.pendiente ?? 0), 0)), vencidas: mias.filter((f) => f.vencido).length };
  });
  const suma = (k: string) => r2(porProyecto.reduce((a, x: any) => a + Number(x[k] ?? 0), 0));
  return { mes: m, desde, hasta: hastaD, totales: { horas: suma("horas"), horas_sin_facturar: suma("horas_sin_facturar"), facturado: suma("facturado"), cobrado: suma("cobrado"), coste_ia: suma("coste_ia"), margen: suma("margen"), pendiente_facturar: suma("pendiente_facturar"), pendiente_cobro: suma("pendiente_cobro"), vencidas: suma("vencidas"), sin_enlazar: porProyecto.filter((x) => !x.enlazado).length }, proyectos: porProyecto };
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
    if (esServicio && cuerpo.user_id) userId = String(cuerpo.user_id);
    if (accion === "programado" || accion === "vencidas") {
      if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
      const { data: cfgs } = await sb.from("facturacion_config").select("user_id");
      const res: any[] = [];
      for (const c of cfgs ?? []) {
        const cfg = await config(sb, c.user_id);
        try {
          const e = await conectarEvoluteia(sb, c.user_id, cfg);
          const s = await sincronizarFacturas(sb, c.user_id, e);
          let preparadas = 0;
          if (accion === "programado" && cfg.generar_borradores_mes) {
            const { desde, hasta } = periodoMesAnterior();
            const { data: clientes } = await sb.from("facturacion_clientes").select("proyecto_id, contrato, contrato_id").eq("user_id", c.user_id).not("tercero_id", "is", null).neq("contrato", "sin_facturar");
            for (const cl of clientes ?? []) {
              if (cl.contrato === "fijo") continue;
              const { count } = await sb.from("horas_registro").select("id", { count: "exact", head: true }).eq("proyecto_id", cl.proyecto_id).eq("facturable", true).is("evoluteia_documento_id", null).gte("fecha", desde).lte("fecha", hasta);
              if (cl.contrato === "horas" && !(count ?? 0)) continue;
              try { await prepararFactura(sb, c.user_id, e, cl.proyecto_id, desde, hasta); preparadas++; } catch { /* siguiente */ }
            }
            if (preparadas) await sb.from("tareas").insert({ user_id: c.user_id, titulo: `Revisar ${preparadas} factura(s) preparadas en EvoluteIA (${desde.slice(0, 7)})`, descripcion: `NexDeveloper ha preparado ${preparadas} borradores en EvoluteIA con las horas, cuotas y gasto de IA de ${desde} a ${hasta}. Revísalos y emítelos (Verifactu se registra al emitir).`, estado: "pendiente", prioridad: "media", requiere_atencion: true, motivo_atencion: "Facturación mensual", instrucciones: "Facturación → Facturas → borradores → «Emitir en EvoluteIA» (o ábrelos en EvoluteIA)." });
          }
          // Vencidas: tarea de cobro (una por factura)
          const { data: venc } = await sb.from("facturas_evoluteia").select("documento_id, numero, total, pendiente, proyecto_id").eq("user_id", c.user_id).eq("vencido", true);
          let tareas = 0;
          for (const f of venc ?? []) { const titulo = `Factura vencida sin cobrar: ${f.numero} (${eur(f.pendiente)})`; const { data: ya } = await sb.from("tareas").select("id").eq("user_id", c.user_id).eq("titulo", titulo).in("estado", ["pendiente", "esperando_revision"]).limit(1); if (ya?.length) continue; await sb.from("tareas").insert({ user_id: c.user_id, proyecto_id: f.proyecto_id, titulo, descripcion: `Reclama el cobro desde EvoluteIA (vencimientos/remesas).`, estado: "pendiente", prioridad: "alta", requiere_atencion: true, motivo_atencion: "Cobro pendiente", instrucciones: `Ábrela en EvoluteIA: ${cfg.evoluteia_url}/documentos/${f.documento_id}` }); tareas++; }
          res.push({ user: c.user_id, ...s, preparadas, tareas_cobro: tareas });
        } catch (err) { res.push({ user: c.user_id, error: String(err?.message ?? err) }); }
      }
      return json({ ok: true, resultados: res });
    }
    if (!userId) return json({ ok: false, error: "Falta el usuario" }, 400);
    const cfg = await config(sb, userId);
    switch (accion) {
      case "estado": {
        const { data: con } = await sb.from("conexiones_externas").select("estado, cuenta, ultimo_error, ultima_comprobacion").eq("user_id", userId).eq("proveedor", "evoluteia").maybeSingle();
        return json({ ok: true, config: cfg, empresas: await catalogoEmpresas(sb, userId), evoluteia: con ?? { estado: "desconectada" }, proyectian: !!TOKEN_CUENTA, resumen: await resumen(sb, userId, cuerpo.mes ? String(cuerpo.mes) : undefined) });
      }
      case "resumen": return json({ ok: true, resumen: await resumen(sb, userId, cuerpo.mes ? String(cuerpo.mes) : undefined) });
      case "configurar": {
        const permitidos = ["tarifa_hora", "refacturar_ia", "recargo_ia_pct", "redondeo_min", "generar_borradores_mes", "evoluteia_url", "evoluteia_tenant_id", "evoluteia_empresa_id", "evoluteia_sede_id", "evoluteia_impuesto_id", "evoluteia_forma_pago_id", "evoluteia_usuario"];
        const cambios: Record<string, unknown> = { user_id: userId, actualizado_el: ahora() };
        for (const k of permitidos) if (k in cuerpo) cambios[k] = cuerpo[k];
        const { data } = await sb.from("facturacion_config").upsert(cambios).select("*").single();
        if (cuerpo.evoluteia_tenant_id && !TENANTS_PERMITIDOS[String(cuerpo.evoluteia_tenant_id)]) return json({ ok: false, error: "Solo MODEONTECNO S.L. o SOLUCIONES EVOLUTEIA S.L." }, 400);
        if (cuerpo.evoluteia_tenant_id) { await sb.from("facturacion_empresas").update({ por_defecto: false }).eq("user_id", userId); await sb.from("facturacion_empresas").update({ por_defecto: true }).eq("user_id", userId).eq("tenant_id", String(cuerpo.evoluteia_tenant_id)); }
        return json({ ok: true, config: data });
      }
      case "probar_evoluteia": {
        try {
          const e = await conectarEvoluteia(sb, userId, cfg); const lista: any[] = [];
          for (const emp of e.empresas) {
            const activo = await evoRpc(e, "nexdeveloper_activo", { p_tenant: emp.tenant_id }).catch(() => false);
            const datos = (await evoRest(e, `empresas?select=razon_social,nif,verifactu_activo,verifactu_modo&id=eq.${emp.empresa_id}`))?.[0] ?? null;
            const serie = (await evoRest(e, `series_documento?select=codigo,siguiente_num,ejercicio&empresa_id=eq.${emp.empresa_id}&tipo=eq.factura&activa=eq.true`))?.[0] ?? null;
            lista.push({ tenant_id: emp.tenant_id, nombre: emp.nombre, por_defecto: emp.por_defecto, modulo_activo: activo === true, empresa: datos, serie });
          }
          const s = await sincronizarFacturas(sb, userId, e); const def = lista.find((x) => x.por_defecto) ?? lista[0];
          return json({ ok: true, usuario: cfg.evoluteia_usuario, empresa: def?.empresa ?? null, serie: def?.serie ?? null, empresas: lista, facturas_sincronizadas: s.facturas });
        }
        catch (err) { return json({ ok: false, error: String(err?.message ?? err) }); }
      }
      case "empresas": {
        // Catálogo de empresas emisoras (facturacion_empresas) refrescado con los datos reales de EvoluteIA
        const e = await conectarEvoluteia(sb, userId, cfg); const emp = await evoRest(e, `empresas?select=id,tenant_id,razon_social,nif,verifactu_activo,verifactu_modo,efactura_activo&order=razon_social`); const sedes = await evoRest(e, `sedes?select=id,empresa_id,nombre`); const fp = await evoRest(e, `formas_pago?select=id,tenant_id,nombre&order=nombre`); const imp = await evoRest(e, `impuestos?select=id,tenant_id,nombre,porcentaje&order=porcentaje.desc`);
        for (const x of emp ?? []) { if (!TENANTS_PERMITIDOS[x.tenant_id]) continue; const ya = e.empresas.find((c) => c.tenant_id === x.tenant_id); const sede = (sedes ?? []).find((s: any) => s.empresa_id === x.id); const tr = (fp ?? []).find((f: any) => f.tenant_id === x.tenant_id && /transferencia$/i.test(f.nombre)) ?? (fp ?? []).find((f: any) => f.tenant_id === x.tenant_id); const iva = (imp ?? []).find((i: any) => i.tenant_id === x.tenant_id && Number(i.porcentaje) === 21); await sb.from("facturacion_empresas").upsert({ tenant_id: x.tenant_id, user_id: userId, empresa_id: x.id, sede_id: ya?.sede_id ?? sede?.id ?? null, forma_pago_id: ya?.forma_pago_id ?? tr?.id ?? null, impuesto_id: ya?.impuesto_id ?? iva?.id ?? null, nombre: x.razon_social, nif: x.nif, por_defecto: ya?.por_defecto ?? false, activa: ya?.activa ?? true, actualizado_el: ahora() }); }
        return json({ ok: true, catalogo: await catalogoEmpresas(sb, userId), permitidas: TENANTS_PERMITIDOS, empresas: (emp ?? []).filter((x: any) => !!TENANTS_PERMITIDOS[x.tenant_id]), sedes, formas_pago: fp, impuestos: imp });
      }
      case "empresa_configurar": {
        // {tenant_id, por_defecto?, activa?, sede_id?, forma_pago_id?, impuesto_id?}
        const t = String(cuerpo.tenant_id ?? ""); if (!TENANTS_PERMITIDOS[t]) return json({ ok: false, error: "Solo MODEONTECNO S.L. o SOLUCIONES EVOLUTEIA S.L." }, 400); const cambios: Record<string, unknown> = { actualizado_el: ahora() };
        for (const k of ["activa", "sede_id", "forma_pago_id", "impuesto_id"]) if (k in cuerpo) cambios[k] = cuerpo[k];
        if (cuerpo.por_defecto === true) { await sb.from("facturacion_empresas").update({ por_defecto: false }).eq("user_id", userId); cambios.por_defecto = true; const { data: emp } = await sb.from("facturacion_empresas").select("*").eq("tenant_id", t).eq("user_id", userId).single(); if (emp) await sb.from("facturacion_config").update({ evoluteia_tenant_id: emp.tenant_id, evoluteia_empresa_id: emp.empresa_id, evoluteia_sede_id: emp.sede_id, evoluteia_forma_pago_id: emp.forma_pago_id, evoluteia_impuesto_id: emp.impuesto_id, actualizado_el: ahora() }).eq("user_id", userId); }
        await sb.from("facturacion_empresas").update(cambios).eq("tenant_id", t).eq("user_id", userId);
        return json({ ok: true, catalogo: await catalogoEmpresas(sb, userId) });
      }
      case "terceros": {
        const e = await conectarEvoluteia(sb, userId, cfg); const q = String(cuerpo.q ?? "").trim(); const tenant = empresaPara(e, cuerpo.tenant_id ?? null).tenant_id;
        const filtro = q ? `&or=(razon_social.ilike.*${encodeURIComponent(q)}*,nombre_comercial.ilike.*${encodeURIComponent(q)}*,nif.ilike.*${encodeURIComponent(q)}*,codigo.ilike.*${encodeURIComponent(q)}*)` : "";
        const t = await evoRest(e, `terceros?select=id,tenant_id,codigo,razon_social,nombre_comercial,nif,email,telefono,poblacion&tenant_id=eq.${tenant}&es_cliente=eq.true&activo=eq.true${filtro}&order=razon_social&limit=60`);
        return json({ ok: true, tenant_id: tenant, terceros: t });
      }
      case "contratos": { const e = await conectarEvoluteia(sb, userId, cfg); const tenant = empresaPara(e, cuerpo.tenant_id ?? null).tenant_id; const c = await evoRest(e, `contratos?select=id,numero,titulo,cuota,periodicidad,estado,tercero_id,fecha_inicio,fecha_fin&tenant_id=eq.${tenant}${cuerpo.tercero_id ? `&tercero_id=eq.${cuerpo.tercero_id}` : ""}&order=creado_en.desc&limit=100`); return json({ ok: true, contratos: c }); }
      case "tercero_crear": {
        const e = await conectarEvoluteia(sb, userId, cfg); const tenant = empresaPara(e, cuerpo.tenant_id ?? null).tenant_id; const restaurar = await asegurarTenantActivo(e, tenant);
        try { const t = await evoRest(e, "terceros", { method: "POST", body: JSON.stringify({ tenant_id: tenant, es_cliente: true, es_proveedor: false, razon_social: String(cuerpo.razon_social ?? "").toUpperCase(), nombre_comercial: cuerpo.nombre_comercial ?? null, nif: cuerpo.nif ?? null, direccion: cuerpo.direccion ?? null, poblacion: cuerpo.poblacion ?? null, provincia: cuerpo.provincia ?? null, cp: cuerpo.cp ?? null, pais: cuerpo.pais ?? "España", email: cuerpo.email ?? null, telefono: cuerpo.telefono ?? null, activo: true }) }, "return=representation"); return json({ ok: true, tercero: Array.isArray(t) ? t[0] : t }); }
        finally { await restaurar(); }
      }
      case "cliente": { const { data } = await sb.from("facturacion_clientes").select("*").eq("user_id", userId).eq("proyecto_id", String(cuerpo.proyecto_id)).maybeSingle(); return json({ ok: true, cliente: data }); }
      case "cliente_enlazar": {
        // {proyecto_id, tercero_id, contrato_id?, contrato ('horas'|'mensual'|'fijo'|'sin_facturar'), cuota_mensual?, horas_incluidas?, importe_fijo?, tarifa_hora?, refacturar_ia?}
        const e = await conectarEvoluteia(sb, userId, cfg);
        const t = (await evoRest(e, `terceros?select=id,tenant_id,codigo,razon_social,nif,email,telefono,direccion,poblacion&id=eq.${cuerpo.tercero_id}`))?.[0]; if (!t) return json({ ok: false, error: "Cliente no encontrado en EvoluteIA" }, 404);
        if (!e.empresas.some((x) => x.tenant_id === t.tenant_id)) return json({ ok: false, error: "Ese cliente pertenece a una empresa de EvoluteIA que no está en el catálogo de emisoras" }, 400);
        let cuota = cuerpo.cuota_mensual ?? null;
        if (cuerpo.contrato_id) { const c = (await evoRest(e, `contratos?select=cuota,periodicidad&id=eq.${cuerpo.contrato_id}`))?.[0]; if (c) cuota = c.cuota; }
        const cambios: Record<string, unknown> = { user_id: userId, proyecto_id: String(cuerpo.proyecto_id), tercero_id: t.id, evoluteia_tenant_id: t.tenant_id, tercero_codigo: t.codigo, nombre_fiscal: t.razon_social, nif: t.nif, email: t.email, telefono: t.telefono, direccion: [t.direccion, t.poblacion].filter(Boolean).join(", "), contrato_id: cuerpo.contrato_id ?? null, sincronizado_el: ahora(), actualizado_el: ahora() };
        for (const k of ["contrato", "horas_incluidas", "importe_fijo", "tarifa_hora", "refacturar_ia", "dia_facturacion", "notas"]) if (k in cuerpo) cambios[k] = cuerpo[k];
        if (cuota !== null) cambios.cuota_mensual = cuota;
        const { data, error } = await sb.from("facturacion_clientes").upsert(cambios).select("*").single(); if (error) throw error;
        await sincronizarFacturas(sb, userId, e).catch(() => {});
        return json({ ok: true, cliente: data });
      }
      case "cliente_cambiar_empresa": {
        // {proyecto_id, tenant_id}: el proyecto pasa a facturarse desde otra empresa; se busca el mismo cliente (por NIF o razón social) en esa empresa
        const e = await conectarEvoluteia(sb, userId, cfg); const emp = empresaPara(e, String(cuerpo.tenant_id)); const cli = await clienteDe(sb, userId, String(cuerpo.proyecto_id));
        const cambios: Record<string, unknown> = { user_id: userId, proyecto_id: String(cuerpo.proyecto_id), evoluteia_tenant_id: emp.tenant_id, contrato_id: null, actualizado_el: ahora() };
        let aviso: string | null = null;
        if (cli.tercero_id) {
          const filtro = cli.nif ? `nif=eq.${encodeURIComponent(cli.nif)}` : `razon_social=eq.${encodeURIComponent(cli.nombre_fiscal ?? "")}`;
          const t = (await evoRest(e, `terceros?select=id,codigo,razon_social,nif,email,telefono,direccion,poblacion&tenant_id=eq.${emp.tenant_id}&${filtro}&limit=1`))?.[0];
          if (t) Object.assign(cambios, { tercero_id: t.id, tercero_codigo: t.codigo, nombre_fiscal: t.razon_social, nif: t.nif, email: t.email, telefono: t.telefono, direccion: [t.direccion, t.poblacion].filter(Boolean).join(", "), sincronizado_el: ahora() });
          else { Object.assign(cambios, { tercero_id: null, tercero_codigo: null }); aviso = `El cliente ${cli.nombre_fiscal ?? cli.nif ?? ""} no existe en ${emp.nombre}: créalo o enlázalo de nuevo`; }
        }
        const { data, error } = await sb.from("facturacion_clientes").upsert(cambios).select("*").single(); if (error) throw error;
        await sincronizarFacturas(sb, userId, e).catch(() => {});
        return json({ ok: true, cliente: data, empresa: emp.nombre, aviso });
      }
      case "cliente_desenlazar": { await sb.from("facturacion_clientes").update({ tercero_id: null, contrato_id: null, tercero_codigo: null, actualizado_el: ahora() }).eq("user_id", userId).eq("proyecto_id", String(cuerpo.proyecto_id)); return json({ ok: true }); }
      case "sugerir_enlaces": {
        // Empareja proyectos con terceros por nombre (sin guardar)
        const e = await conectarEvoluteia(sb, userId, cfg); const tenant = empresaPara(e, cuerpo.tenant_id ?? null).tenant_id;
        const t = await evoRest(e, `terceros?select=id,tenant_id,codigo,razon_social,nombre_comercial,nif&tenant_id=eq.${tenant}&es_cliente=eq.true&activo=eq.true&limit=500`);
        const { data: ps } = await sb.from("proyectos").select("id, nombre, slug, descripcion").eq("user_id", userId);
        const norm = (s: string) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ");
        const sug = (ps ?? []).map((p) => { const np = norm(p.nombre); const cand = (t ?? []).map((x: any) => { const nt = norm(`${x.razon_social} ${x.nombre_comercial ?? ""}`); const pal = np.split(" ").filter((w) => w.length > 3); const primera = norm(x.razon_social).split(" ").find((w) => w.length > 3) ?? ""; const puntos = pal.reduce((a, w) => a + (nt.includes(w) ? 2 : 0), 0) + (primera && norm(`${p.nombre} ${p.descripcion ?? ""}`).includes(primera) ? 1 : 0); return { tercero: x, puntos }; }).filter((c) => c.puntos > 0).sort((a, b) => b.puntos - a.puntos).slice(0, 3); return { proyecto_id: p.id, proyecto: p.nombre, candidatos: cand.map((c) => ({ ...c.tercero, puntos: c.puntos })) }; });
        return json({ ok: true, tenant_id: tenant, sugerencias: sug });
      }
      // ----- Horas (igual que antes) -----
      case "horas": {
        let q = sb.from("horas_registro").select("*, tareas(titulo)").eq("user_id", userId).order("fecha", { ascending: false }).order("creado_el", { ascending: false }).limit(Number(cuerpo.limite ?? 300));
        if (cuerpo.proyecto_id) q = q.eq("proyecto_id", String(cuerpo.proyecto_id)); if (cuerpo.desde) q = q.gte("fecha", String(cuerpo.desde)); if (cuerpo.hasta) q = q.lte("fecha", String(cuerpo.hasta)); if (cuerpo.sin_facturar) q = q.is("evoluteia_documento_id", null);
        const { data } = await q; return json({ ok: true, horas: data ?? [] });
      }
      case "horas_registrar": { const { data, error } = await sb.from("horas_registro").insert({ user_id: userId, proyecto_id: String(cuerpo.proyecto_id), tarea_id: cuerpo.tarea_id ?? null, fecha: cuerpo.fecha ?? hoy(), horas: r2(Number(cuerpo.horas ?? 0)), descripcion: cuerpo.descripcion ?? null, origen: "manual", facturable: cuerpo.facturable ?? true }).select("*").single(); if (error) throw error; return json({ ok: true, registro: data }); }
      case "horas_actualizar": {
        const { data: h } = await sb.from("horas_registro").select("evoluteia_numero").eq("id", String(cuerpo.id)).eq("user_id", userId).single(); if (h?.evoluteia_numero) return json({ ok: false, error: `Estas horas ya están en la factura ${h.evoluteia_numero}` }, 400);
        const cambios: Record<string, unknown> = { actualizado_el: ahora() }; for (const k of ["proyecto_id", "tarea_id", "fecha", "horas", "descripcion", "facturable"]) if (k in cuerpo) cambios[k] = cuerpo[k];
        const { data } = await sb.from("horas_registro").update(cambios).eq("id", String(cuerpo.id)).eq("user_id", userId).select("*").single(); return json({ ok: true, registro: data });
      }
      case "horas_borrar": { const { data: h } = await sb.from("horas_registro").select("evoluteia_numero").eq("id", String(cuerpo.id)).eq("user_id", userId).single(); if (h?.evoluteia_numero) return json({ ok: false, error: `Estas horas ya están en la factura ${h.evoluteia_numero}` }, 400); await sb.from("horas_registro").delete().eq("id", String(cuerpo.id)).eq("user_id", userId); return json({ ok: true }); }
      case "cronometro_iniciar": { const { data: abierto } = await sb.from("horas_registro").select("id").eq("user_id", userId).eq("origen", "cronometro").is("fin", null).limit(1); if (abierto?.length) return json({ ok: false, error: "Ya hay un cronómetro en marcha", registro_id: abierto[0].id }, 400); const { data, error } = await sb.from("horas_registro").insert({ user_id: userId, proyecto_id: String(cuerpo.proyecto_id), tarea_id: cuerpo.tarea_id ?? null, fecha: hoy(), inicio: ahora(), horas: 0, descripcion: cuerpo.descripcion ?? null, origen: "cronometro" }).select("*").single(); if (error) throw error; return json({ ok: true, registro: data }); }
      case "cronometro_parar": { const { data: h } = await sb.from("horas_registro").select("*").eq("user_id", userId).eq("origen", "cronometro").is("fin", null).order("inicio", { ascending: false }).limit(1).maybeSingle(); if (!h) return json({ ok: false, error: "No hay ningún cronómetro en marcha" }, 400); const fin = new Date(); const min = Math.max(1, (fin.getTime() - new Date(h.inicio).getTime()) / 60000); const paso = Number(cfg.redondeo_min ?? 15) || 1; const horas = r2(Math.ceil(min / paso) * paso / 60); const { data } = await sb.from("horas_registro").update({ fin: fin.toISOString(), horas, descripcion: cuerpo.descripcion ?? h.descripcion, actualizado_el: ahora() }).eq("id", h.id).select("*").single(); return json({ ok: true, registro: data }); }
      case "cronometro_estado": { const { data } = await sb.from("horas_registro").select("*, proyectos(nombre)").eq("user_id", userId).eq("origen", "cronometro").is("fin", null).order("inicio", { ascending: false }).limit(1).maybeSingle(); return json({ ok: true, en_marcha: data ?? null }); }
      // ----- Facturas en EvoluteIA -----
      case "facturas": {
        if (cuerpo.sincronizar) { const e = await conectarEvoluteia(sb, userId, cfg); await sincronizarFacturas(sb, userId, e); }
        let q = sb.from("facturas_evoluteia").select("*, proyectos(nombre, slug, color)").eq("user_id", userId).order("fecha", { ascending: false }).limit(Number(cuerpo.limite ?? 300));
        if (cuerpo.proyecto_id) q = q.eq("proyecto_id", String(cuerpo.proyecto_id)); if (cuerpo.estado) q = q.eq("estado", String(cuerpo.estado));
        const { data } = await q; return json({ ok: true, facturas: (data ?? []).map((f) => ({ ...f, url: `${cfg.evoluteia_url}/documentos/${f.documento_id}` })) });
      }
      case "factura": {
        const e = await conectarEvoluteia(sb, userId, cfg); const id = String(cuerpo.documento_id);
        const d = (await evoRest(e, `documentos?select=*,terceros(razon_social,nif,email),documento_lineas(orden,descripcion,cantidad,precio,descuento,tipo_iva,importe)&id=eq.${id}`))?.[0]; if (!d) return json({ ok: false, error: "No encontrada" }, 404);
        const v = await evoRest(e, `vencimientos?select=plazo,fecha,importe,cobrado,estado,situacion&documento_id=eq.${id}&order=plazo`);
        const reg = await evoRest(e, `registro_facturacion?select=tipo,numero,fecha_expedicion,huella,creado_en&documento_id=eq.${id}`);
        const env = await evoRest(e, `envios_aeat?select=*&documento_id=eq.${id}&order=creado_en.desc&limit=3`).catch(() => []);
        await refrescarFactura(sb, userId, e, id, null);
        return json({ ok: true, factura: d, vencimientos: v, verifactu: { registros: reg, envios: env }, url: `${cfg.evoluteia_url}/documentos/${id}` });
      }
      case "preparar": {
        const e = await conectarEvoluteia(sb, userId, cfg);
        const { desde, hasta } = cuerpo.desde && cuerpo.hasta ? { desde: String(cuerpo.desde), hasta: String(cuerpo.hasta) } : periodoMesAnterior();
        return json({ ok: true, ...(await prepararFactura(sb, userId, e, String(cuerpo.proyecto_id), desde, hasta, { incluir_horas: cuerpo.incluir_horas, incluir_ia: cuerpo.incluir_ia, lineas_extra: cuerpo.lineas_extra, notas: cuerpo.notas })) });
      }
      case "emitir": {
        const e = await conectarEvoluteia(sb, userId, cfg); const id = String(cuerpo.documento_id); const tenant = await tenantDeDocumento(e, id); const emp = empresaPara(e, tenant);
        const restaurar = await asegurarTenantActivo(e, tenant); let numero: string;
        try { const n = await evoRpc(e, "emitir_documento", { p_doc: id, p_forma_pago: cuerpo.forma_pago_id ?? emp.forma_pago_id ?? null }); numero = typeof n === "string" ? n : String(n?.numero ?? n ?? ""); } finally { await restaurar(); }
        await sb.from("horas_registro").update({ evoluteia_numero: numero, actualizado_el: ahora() }).eq("evoluteia_documento_id", id);
        const f = await refrescarFactura(sb, userId, e, id, null);
        await sb.from("tareas").insert({ user_id: userId, proyecto_id: f?.datos_extra?.nexdeveloper?.proyecto_id ?? null, titulo: `Enviar la factura ${numero} (${eur(f?.total ?? 0)})`, descripcion: `Emitida en EvoluteIA el ${fechaEs(hoy())}${f?.verifactu ? " · registrada en Verifactu" : ""}. Envíala al cliente desde EvoluteIA (PDF y correo).`, estado: "pendiente", prioridad: "media", requiere_atencion: true, motivo_atencion: "Factura emitida", instrucciones: `Ábrela en EvoluteIA: ${cfg.evoluteia_url}/documentos/${id}` }).then(() => {}, () => {});
        return json({ ok: true, numero, empresa: emp.nombre, verifactu: !!f?.verifactu, url: `${cfg.evoluteia_url}/documentos/${id}` });
      }
      case "descartar_borrador": {
        // Borra el borrador en EvoluteIA (solo si sigue en borrador) y libera las horas
        const e = await conectarEvoluteia(sb, userId, cfg); const id = String(cuerpo.documento_id);
        const d = (await evoRest(e, `documentos?select=estado,tenant_id&id=eq.${id}`))?.[0]; if (!d) return json({ ok: false, error: "No encontrada" }, 404);
        if (d.estado !== "borrador") return json({ ok: false, error: "Solo se puede descartar un borrador; una factura emitida se rectifica en EvoluteIA" }, 400);
        const restaurar = await asegurarTenantActivo(e, String(d.tenant_id));
        try { await evoRest(e, `documento_lineas?documento_id=eq.${id}`, { method: "DELETE" }, "return=minimal"); await evoRest(e, `documentos?id=eq.${id}`, { method: "DELETE" }, "return=minimal"); } finally { await restaurar(); }
        await sb.from("horas_registro").update({ evoluteia_documento_id: null, actualizado_el: ahora() }).eq("evoluteia_documento_id", id);
        await sb.from("facturas_evoluteia").delete().eq("documento_id", id);
        return json({ ok: true });
      }
      case "sincronizar": { const e = await conectarEvoluteia(sb, userId, cfg); return json({ ok: true, ...(await sincronizarFacturas(sb, userId, e)) }); }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (err) { return json({ ok: false, error: String(err?.message ?? err) }, 500); }
});
