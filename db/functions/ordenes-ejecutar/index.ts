import { validarPlan, fasesDelPlan, parcheExacto, cubrirLectura } from "../_shared/cola.ts";
import { esRevisionMejoras } from "../_shared/mejoras.ts";
import {prepararEquipo, solicitudModelo, respuestaModelo, instruccionesPapel, soloLectura, escrituraPermitida, PAPELES, PROVEEDORES_MOTOR} from "../_shared/equipo.ts";
// NexDeveloper · Edge Function «ordenes-ejecutar» (0.20.0)
// Ejecución real de las órdenes por la IA con dos motores:
//  · Lovable: conexión OAuth (PKCE) con el servidor MCP de Lovable → send_message / get_message / deploy_project.
//  · Claude + GitHub: agente de código (Anthropic) que lee y modifica el repositorio del proyecto por la API de GitHub,
//    abre una rama y una solicitud de cambios; al aprobar, se fusiona y Lovable la sincroniza (GitHub en dos sentidos).
// En ambos casos: sondeo programado cada 2 minutos, comprobación de la vista previa, tarea «Aprobar y publicar» y
// publicación (Lovable) o aviso para publicar. Todo el estado es reanudable entre invocaciones.
import { fetchIA } from "../_shared/presupuesto.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const html = (t: string, s = 200) => new Response(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px;background:#0f1419;color:#e6edf3"><h2>NexDeveloper</h2><p>${t}</p><p><a style="color:#22d3c5" href="javascript:window.close()">Cerrar esta ventana</a></p></body>`, { status: s, headers: { "Content-Type": "text/html; charset=utf-8" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const URL_FUNCION = `${URL_SUPABASE}/functions/v1/ordenes-ejecutar`;
const OAUTH = { authorize: "https://lovable.dev/oauth/authorize", token: "https://lovable.dev/oauth/token", register: "https://lovable.dev/oauth/register" };
const CLIENT_ID_DOC = `${URL_FUNCION}/cliente.json`;   // identificador por documento de metadatos (si Lovable lo admite)
const URL_CALLBACK = `${URL_FUNCION}/callback`;
const MCP_URL = "https://mcp.lovable.dev/";
const SCOPES = "offline openid email profile projects:read projects:write workspaces:read";
const documentoCliente = () => ({ client_id: CLIENT_ID_DOC, client_name: "NexDeveloper", client_uri: "https://nexdeveloper.lovable.app", logo_uri: "https://nexdeveloper.lovable.app/favicon.ico", redirect_uris: [URL_CALLBACK], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", scope: SCOPES });
const ahora = () => new Date().toISOString();
const PRESUPUESTO_MS = 95_000;   // tiempo máximo de trabajo por invocación (las Edge Functions tienen límite)

// ---------- PKCE ----------
const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const aleatorio = (n = 48) => b64url(crypto.getRandomValues(new Uint8Array(n)));
async function desafio(verifier: string) { return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))); }

// ---------- Tokens de Lovable ----------
async function tokenAcceso(sb: SB, userId: string): Promise<string> {
  const { data, error } = await sb.rpc("leer_secretos_lovable", { p_user_id: userId });
  if (error) throw new Error(`No se pudo leer la conexión: ${error.message}`);
  const c = (data ?? [])[0];
  if (!c?.refresh_token && !c?.access_token) throw new Error("Lovable no está conectado. Ve a Órdenes → Ejecución → Conectar con Lovable.");
  const caduca = c.expira_el ? new Date(c.expira_el).getTime() : 0;
  if (c.access_token && caduca - Date.now() > 60_000) return c.access_token;
  if (!c.refresh_token) throw new Error("La sesión con Lovable ha caducado; vuelve a conectar.");
  const r = await fetch(OAUTH.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: c.refresh_token, client_id: c.client_id ?? CLIENT_ID_DOC }) });
  if (!r.ok) {
    const t = await r.text();
    await sb.from("lovable_conexion").update({ estado: "error", ultimo_error: `Renovación rechazada: ${t.slice(0, 200)}`, actualizado_el: ahora() }).eq("user_id", userId);
    throw new Error(`Lovable rechazó la renovación del acceso (${r.status}). Vuelve a conectar.`);
  }
  const tok = await r.json();
  const expira = new Date(Date.now() + Number(tok.expires_in ?? 3600) * 1000).toISOString();
  await sb.rpc("guardar_secreto_lovable", { p_user_id: userId, p_refresh: tok.refresh_token ?? null, p_acceso: tok.access_token, p_expira: expira });
  return tok.access_token;
}

// ---------- MCP de Lovable (Streamable HTTP) ----------
function parsearMcp(texto: string, tipo: string) {
  if (tipo.includes("text/event-stream")) {
    let ultimo: any = null;
    for (const linea of texto.split("\n")) { if (linea.startsWith("data:")) { try { const j = JSON.parse(linea.slice(5).trim()); if (j.result || j.error) ultimo = j; } catch { /* ignorar */ } } }
    return ultimo;
  }
  try { return JSON.parse(texto); } catch { return null; }
}
async function llamadaMcp(token: string, sesion: string | null, cuerpo: unknown) {
  const h: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" };
  if (sesion) h["Mcp-Session-Id"] = sesion;
  const r = await fetch(MCP_URL, { method: "POST", headers: h, body: JSON.stringify(cuerpo) });
  const nuevaSesion = r.headers.get("mcp-session-id") ?? sesion;
  if (r.status === 202 || r.status === 204) return { sesion: nuevaSesion, datos: null, status: r.status };
  const texto = await r.text();
  if (!r.ok) throw new Error(`MCP de Lovable ${r.status}: ${texto.slice(0, 300)}`);
  return { sesion: nuevaSesion, datos: parsearMcp(texto, r.headers.get("content-type") ?? ""), status: r.status };
}
async function herramientaLovable(token: string, nombre: string, argumentos: Record<string, unknown>) {
  if(nombre==='send_message')throw new Error('Ejecución con créditos de Lovable desactivada: su API no tiene un tope de coste verificado por petición. Usa el motor con reserva de presupuesto.');
  const ini = await llamadaMcp(token, null, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "NexDeveloper", version: "0.20.0" } } });
  const sesion = ini.sesion;
  try { await llamadaMcp(token, sesion, { jsonrpc: "2.0", method: "notifications/initialized" }); } catch { /* opcional */ }
  const r = await llamadaMcp(token, sesion, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: nombre, arguments: argumentos } });
  const d = r.datos;
  if (!d) throw new Error(`Lovable no devolvió respuesta a ${nombre}`);
  if (d.error) throw new Error(`Lovable (${nombre}): ${d.error.message ?? JSON.stringify(d.error)}`);
  const res = d.result ?? {};
  if (res.isError) throw new Error(`Lovable (${nombre}): ${(res.content ?? []).map((c: any) => c.text ?? "").join(" ").slice(0, 400)}`);
  if (res.structuredContent) return res.structuredContent;
  const texto = (res.content ?? []).map((c: any) => c.text ?? "").join("\n");
  try { return JSON.parse(texto); } catch { return { texto }; }
}
const limpiarRespuesta = (t: string) => (t ?? "").replace(/<lov-tool-use[^>]*>[\s\S]*?<\/lov-tool-use>/g, "").replace(/<\/?lov-[^>]*>/g, "").trim();

// ---------- GitHub ----------
const GH = "https://api.github.com";
async function gh(ruta: string, init: RequestInit = {}) {
  if (!GITHUB_TOKEN) throw new Error("Falta el secreto GITHUB_TOKEN en las Edge Functions");
  const r = await fetch(`${GH}${ruta}`, { ...init, headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "NexDeveloper", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) } });
  if (r.status === 204) return null;
  const t = await r.text();
  let j: any = null; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  if (!r.ok) throw new Error(`GitHub ${r.status} ${ruta}: ${String(j?.message ?? t).slice(0, 200)}`);
  return j;
}
const utf8b64 = (s: string) => { const b = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(bin); };
const b64utf8 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
async function ramaPorDefecto(repo: string) { const r = await gh(`/repos/${repo}`); return r.default_branch ?? "main"; }
async function arbolRepo(repo: string, ref: string) {
  const r = await gh(`/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
  return ((r.tree ?? []) as any[]).filter((n) => n.type === "blob").map((n) => ({ ruta: n.path as string, tam: n.size as number }));
}
async function leerArchivoRepo(repo: string, ruta: string, ref: string) {
  const r = await gh(`/repos/${repo}/contents/${ruta.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`);
  if (Array.isArray(r)) throw new Error(`${ruta} es una carpeta`);
  if (r.encoding !== "base64") throw new Error(`${ruta} no es un archivo de texto`);
  return b64utf8(r.content);
}
const IGNORAR = /^(node_modules|dist|build|\.git|\.lovable|public\/fonts|bun\.lockb|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)|\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|mp3|mp4|pdf|lock)$/i;

async function candidatosEquipo(sb: SB,userId:string) {
 const {data:proveedores,error:pe}=await sb.from('proveedores_ia').select('id,clave_slug').eq('user_id',userId).eq('activo',true).not('clave_cifrada','is',null).in('clave_slug',PROVEEDORES_MOTOR);
 if(pe)throw Error('No se pudo comprobar la conexión de los proveedores');
 const {data:modelos,error:me}=await sb.from('modelos_ia').select('id,proveedor_id,identificador,calidad,tareas_aconsejadas').eq('user_id',userId).eq('activo',true).eq('desarrollo_estado','disponible');
 const {data:tarifas,error:te}=await sb.from('ia_tarifas').select('modelo_id,entrada_eur_millon,salida_eur_millon,verificada_hasta').eq('user_id',userId).gt('verificada_hasta',ahora());
 if(me||te)throw Error('No se pudo comprobar los modelos y tarifas');
 // Count confirmed reservations, including uncertain calls, without pretending to know subscription balances.
 const uso:Record<string,number>={};
 for(const p of proveedores??[]){
   const {count,error}=await sb.from('ia_reservas').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('proveedor',p.clave_slug).gte('creada_el',new Date(Date.now()-7*86400000).toISOString());
   if(error)throw Error('No se pudo comprobar el consumo para repartir el equipo');
   uso[p.clave_slug]=count??0;
 }
 return (modelos??[]).flatMap((m:any)=>{const p=proveedores?.find((p:any)=>p.id===m.proveedor_id),t=tarifas?.find((t:any)=>t.modelo_id===m.id);return p&&t?[{...m,proveedor:p.clave_slug,llamadas_recientes:uso[p.clave_slug],coste:Number(t.entrada_eur_millon)+Number(t.salida_eur_millon)}]:[];});
}
async function llamarEquipo(sb:SB,e:any,fase:any,sistema:string,mensajes:any[],lectura:boolean,prueba=false){
 const {data:p,error}=await sb.from('proveedores_ia').select('id').eq('id',fase.modelo.proveedor_id).eq('user_id',e.user_id).eq('activo',true).single();
 if(error||!p)throw Error('La conexión del agente ya no está activa');
 const {data:clave,error:ke}=await sb.rpc('descifrar_clave_proveedor',{p_proveedor_id:p.id});
 if(ke||!clave)throw Error('Falta la clave del agente asignado');
 const proveedor=fase.modelo.proveedor;
 const req=solicitudModelo(proveedor,fase.modelo.identificador,sistema,mensajes,lectura?HERRAMIENTAS.filter(h=>!['escribir_archivo','editar_archivo','borrar_archivo'].includes(h.name)):HERRAMIENTAS);
 if(prueba){if(proveedor==='google')req.body.generationConfig.maxOutputTokens=1024;else if(proveedor==='openai')req.body.max_completion_tokens=1024;else req.body.max_tokens=1024;}
 const headers:Record<string,string>={'content-type':'application/json'};
 if(proveedor==='anthropic'){headers['x-api-key']=clave;headers['anthropic-version']='2023-06-01';}
 else if(proveedor==='google')headers['x-goog-api-key']=clave;
 else headers.Authorization=`Bearer ${clave}`;
 let r:Response;try{r=await fetchIA(sb,{userId:e.user_id,modeloId:fase.modelo.id,ambito:e.proyecto_id?'proyecto':'cartera',proyectoId:e.proyecto_id,ejecucionId:e.id,bloqueoToken:e.bloqueo_token,operacion:`equipo:${fase.papel}`},req.url,{method:'POST',headers,body:JSON.stringify(req.body)});}catch(error){const detalle=String((error as Error).message);if(/HTTP (400|401|403|404|429)/.test(detalle))await sb.from('modelos_ia').update({desarrollo_estado:'bloqueado',desarrollo_detalle:detalle,desarrollo_comprobado_el:ahora()}).eq('id',fase.modelo.id).eq('user_id',e.user_id);throw error;}
 return respuestaModelo(proveedor,await r.json());
}

// ---------- Anthropic ----------
async function claveAnthropic(sb: SB, userId: string) {
  const { data: p } = await sb.from("proveedores_ia").select("id").eq("user_id", userId).eq("clave_slug", "anthropic").maybeSingle();
  if (!p) return null;
  const { data: clave } = await sb.rpc("descifrar_clave_proveedor", { p_proveedor_id: p.id });
  return clave ? String(clave) : null;
}
const HERRAMIENTAS = [
  { name: "listar_archivos", description: "Lista las rutas de los archivos del repositorio (opcionalmente filtradas por prefijo o texto en la ruta). Úsala primero para orientarte.", input_schema: { type: "object", properties: { filtro: { type: "string", description: "Prefijo o fragmento de ruta, p. ej. src/routes o Ajustes" } } } },
  { name: "leer_archivo", description: "Lee hasta 60000 caracteres. Para archivos grandes continúa con inicio indicado hasta cubrir todo el archivo.", input_schema: { type: "object", properties: { ruta: { type: "string" }, inicio: {type:"integer",minimum:0,description:"Posición de carácter desde 1 (no número de línea). Omitir para empezar; 0 también inicia el archivo."} }, required: ["ruta"] } },
  { name: "buscar", description: "Busca un texto literal en los archivos del repositorio (máximo 30 coincidencias con su ruta y línea).", input_schema: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] } },
  { name: "escribir_archivo", description: "Crea o sustituye COMPLETAMENTE un archivo con el contenido indicado. Escribe siempre el archivo entero, nunca fragmentos.", input_schema: { type: "object", properties: { ruta: { type: "string" }, contenido: { type: "string" } }, required: ["ruta", "contenido"] } },
  { name: "borrar_archivo", description: "Elimina un archivo del repositorio.", input_schema: { type: "object", properties: { ruta: { type: "string" } }, required: ["ruta"] } },
  { name: "editar_archivo", description: "Sustituye un fragmento exacto y único en un archivo existente, conservando íntegro el resto. Lee primero el archivo actualizado.", input_schema: {type:"object",properties:{ruta:{type:"string"},antes:{type:"string"},despues:{type:"string"}},required:["ruta","antes","despues"]} },
  { name: "terminar", description: "Da por terminado el trabajo. Indica un resumen en español (3-6 líneas: qué has cambiado y por qué, archivos tocados, cómo probarlo) y, si procede, la nueva versión.", input_schema: { type: "object", properties: { tareas: {type:"array",items:{type:"object",properties:{id:{type:"string"},titulo:{type:"string"},papel:{type:"string",enum:["backend","interfaz"]},depende_de:{type:"array",items:{type:"string"}},aceptacion:{type:"array",items:{type:"string"}}},required:["id","titulo","papel","depende_de","aceptacion"]}}, resumen: { type: "string" }, entrega: {type:"string",description:"Consejo o diseño completo para el usuario y el siguiente agente: contenido concreto, alternativas y decisiones. No una frase diciendo que se ha elaborado."}, version: { type: "string", description: "Nueva versión X.Y.Z si el proyecto muestra versión" }, revision_ok: {type:"boolean",description:"Solo en revisión: true si no quedan problemas bloqueantes"}, hallazgos:{type:"array",items:{type:"string"}}, sin_cambios: { type: "boolean", description: "true si has decidido no tocar nada (explica por qué en el resumen)" } }, required: ["resumen"] } },
];
async function llamarClaude(sb: SB, e: any, modeloId: string, clave: string, modelo: string, sistema: string, mensajes: any[], planificar = false) {
  const r = await fetchIA(sb, {userId:e.user_id,modeloId,ambito:"proyecto",proyectoId:e.proyecto_id,ejecucionId:e.id,bloqueoToken:e.bloqueo_token,operacion:"ordenes-ejecutar"}, "https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": clave, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: modelo, max_tokens: 8000, system: sistema, tools: planificar ? HERRAMIENTAS.filter(h => !["escribir_archivo", "editar_archivo", "borrar_archivo"].includes(h.name)) : HERRAMIENTAS, messages: mensajes }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${String(j?.error?.message ?? JSON.stringify(j)).slice(0, 300)}`);
  return j;
}
function recortarHistorial(mensajes: any[]) {
  // Mantiene el primer mensaje (la orden) y acorta resultados antiguos de herramientas para no desbordar el contexto
  if (mensajes.length <= 12) return mensajes;
  const inicio = mensajes.slice(0, 1); const resto = mensajes.slice(1);
  const antiguos = resto.slice(0, resto.length - 8).map((m) => {
    if (m.role !== "user" || !Array.isArray(m.content)) return m;
    return { ...m, content: m.content.map((c: any) => c.type === "tool_result" && typeof c.content === "string" && c.content.length > 600 ? { ...c, content: c.content.slice(0, 600) + "\n…(recortado)" } : c) };
  });
  return [...inicio, ...antiguos, ...resto.slice(resto.length - 8)];
}

/** Keep the activity record, but send only complete recent exchanges and explicit user notes. */
function contextoModelo(mensajes:any[]){
  if(mensajes.length<=5)return mensajes;
  let desde=mensajes.length-4;
  if(mensajes[desde]?.role==='user' && Array.isArray(mensajes[desde].content) && mensajes[desde].content.some((b:any)=>b.type==='tool_result') && mensajes[desde-1]?.role==='assistant')desde--;
  const notas=mensajes.slice(1,desde).filter((m:any)=>m.role==='user'&&typeof m.content==='string');
  return [mensajes[0],...notas.filter((m:any,i:number)=>notas.findIndex((n:any)=>n.content===m.content)===i),...mensajes.slice(desde)];
}

// ---------- Utilidades de estado ----------
async function config(sb: SB, userId: string) {
  const { data } = await sb.from("ejecucion_config").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data;
  const { data: n } = await sb.from("ejecucion_config").insert({ user_id: userId }).select("*").single();
  return n!;
}
async function actualizar(sb: SB, id: string, cambios: Record<string, unknown>, bloqueoToken?: string) {
  let query = sb.from("ejecuciones_orden").update({ ...cambios, actualizado_el: ahora() }).eq("id", id);
  if (bloqueoToken) query = query.eq("bloqueo_token",bloqueoToken).gt("bloqueo_hasta",ahora()).neq("estado","cancelada");
  const {data,error} = await query.select("id").maybeSingle();
  if (error || !data) throw new Error("La ejecución ha cambiado o se ha cancelado; no se sobrescribe su estado.");
}
async function comprobarActiva(sb: SB, e: any) {
  const {data,error} = await sb.from("ejecuciones_orden").select("estado,bloqueo_token,bloqueo_hasta,tarea_origen_id").eq("id",e.id).eq("user_id",e.user_id).single();
  if (error || !data || data.estado === "cancelada" || (e.bloqueo_token && (data.bloqueo_token !== e.bloqueo_token || (!Number.isFinite(Date.parse(data.bloqueo_hasta)) || Date.parse(data.bloqueo_hasta) <= Date.now())))) throw new Error("Ejecución cancelada o bloqueo caducado");
  if (data.tarea_origen_id) {
    const {data:t,error:et}=await sb.from("tareas").select("estado").eq("id",data.tarea_origen_id).eq("user_id",e.user_id).single();
    if (et || !t || ["pausada","cancelada"].includes(t.estado)) throw new Error("La tarea de origen está pausada o cancelada");
  }
}
async function conBloqueo(sb: SB,e: any,accion: (e: any)=>Promise<void>) {
  const token=crypto.randomUUID();
  const {data,error}=await sb.rpc("reclamar_ejecucion",{p_id:e.id,p_user_id:e.user_id,p_token:token});
  if(error) throw new Error("No se pudo reclamar la ejecución");
  if(data!==true) return;
  try { await accion({...e,bloqueo_token:token}); }
  finally { const {error:libError}=await sb.rpc("liberar_ejecucion",{p_id:e.id,p_user_id:e.user_id,p_token:token}); if(libError) console.error("No se pudo liberar el bloqueo de ejecución"); }
}

async function finalizar(sb:SB,e:any,resultado:Record<string,unknown>){
 const {error}=await sb.rpc('cerrar_o_esperar_entregas',{p_usuario:e.user_id,p_ejecucion:e.id,p_token:e.bloqueo_token,p_resultado:resultado});
 if(error)throw new Error('No se pudo finalizar de forma coherente. La orden y la tarea deben revisarse antes de repetir.');
}
async function sincronizarOrden(sb: SB, e: any, estadoOrden: string | null, comentario?: string) {
  if (!e.orden_id) return;
  const cambios: Record<string, unknown> = { actualizado_el: ahora() };
  if (estadoOrden) cambios.estado = estadoOrden;
  if (comentario) cambios.comentario = comentario;
  if (estadoOrden === "completada") { cambios.resuelta_el = ahora(); cambios.resuelta_por = "NexDeveloper"; }
  await sb.from("ordenes").update(cambios).eq("id", e.orden_id);
}
async function mensajeChat(sb: SB, e: any, texto: string) {
  if (!e.orden_id) return;
  const { data: o } = await sb.from("ordenes").select("chat_id").eq("id", e.orden_id).maybeSingle();
  if (o?.chat_id) await sb.from("mensajes").insert({ user_id: e.user_id, chat_id: o.chat_id, proyecto_id: e.proyecto_id, autor: "sistema", texto: texto.slice(0, 2000) });
}
async function crearTareaAtencion(sb: SB, e: any, titulo: string, instrucciones: string, motivo = "Aprobar y publicar") {
  const { data: t } = await sb.from("tareas").insert({ user_id: e.user_id, proyecto_id: e.proyecto_id, orden_id: e.orden_id, titulo, descripcion: String(e.resumen ?? e.texto ?? "").slice(0, 300), estado: "esperando_revision", prioridad: "alta", requiere_atencion: true, motivo_atencion: motivo, instrucciones, progreso: 0 }).select("id").single();
  if (t) await actualizar(sb, e.id, { tarea_id: t.id }, e.bloqueo_token);
  return t?.id ?? null;
}
async function fallo(sb: SB, e: any, msg: string, comentario?: string) {
  await actualizar(sb, e.id, { estado: "error", error: msg.slice(0, 500), terminada_el: ahora() }, e.bloqueo_token);
  await sincronizarOrden(sb, e, "aprobada", comentario ?? `Error: ${msg.slice(0, 200)}`);
}
async function comprobarPreview(sb: SB, cfg: any, userId: string, p: any) {
  let previewUrl: string | null = p.espacio_trabajo_url ?? null; let previewOk: boolean | null = null;
  try {
    const { data: c } = await sb.from("lovable_conexion").select("estado").eq("user_id", userId).maybeSingle();
    if (c?.estado === "conectada" && p.lovable_project_id) { const token = await tokenAcceso(sb, userId); const pr = await herramientaLovable(token, "get_project", { project_id: p.lovable_project_id }); previewUrl = pr.preview_url ?? pr.project?.preview_url ?? previewUrl; }
    if (cfg.comprobar_preview && previewUrl) { const pv = await fetch(previewUrl, { method: "GET", redirect: "follow" }); previewOk = pv.ok; }
  } catch { previewOk = null; }
  return { previewUrl, previewOk };
}
async function pedirAprobacion(sb: SB, e: any, p: any, previewUrl: string | null, previewOk: boolean | null, resumen: string) {
  await actualizar(sb, e.id, { estado: "esperando_aprobacion", preview_url: previewUrl, preview_ok: previewOk }, e.bloqueo_token);
  await sincronizarOrden(sb, e, "ejecutando", "Cambios hechos por la IA; esperando tu aprobación");
  const donde = e.motor === "claude" ? `Revisa la solicitud de cambios en GitHub${e.pr_url ? ` (${e.pr_url})` : ""}` : `Revisa la vista previa${previewUrl ? ` (${previewUrl})` : ""}`;
  await crearTareaAtencion(sb, e, `Aprobar y publicar: ${p.nombre}`, `${donde} y, si está bien, pulsa «Aprobar y publicar» en Órdenes → Ejecución. Resumen:\n${resumen}`);
}

// ---------- Motor Lovable ----------
async function enviarLovable(sb: SB, e: any, p: any, cfg: any) {
  const token = await tokenAcceso(sb, e.user_id);
  const mensaje = `${e.texto}\n\n---\nInstrucciones fijas de NexDeveloper: responde en español; al terminar, resume en 3-5 líneas qué has cambiado y qué archivos has tocado; sube el número de versión visible en la esquina de la aplicación si el proyecto lo muestra; no toques la configuración de Supabase ni secretos.`;
  const r = await herramientaLovable(token, "send_message", { project_id: p.lovable_project_id, message: mensaje, wait: false, plan_mode: e.modo === "planificar", max_mode: !!cfg.modo_max });
  const mensajeId = r.message_id ?? r.messageId ?? r.id ?? null;
  if (!mensajeId) throw new Error(`Lovable no devolvió el identificador del mensaje: ${JSON.stringify(r).slice(0, 300)}`);
  await actualizar(sb, e.id, { estado: "construyendo", mensaje_id: mensajeId, thread_id: r.thread_id ?? null, error: null }, e.bloqueo_token);
  await sincronizarOrden(sb, e, "ejecutando", `Enviada a Lovable (${p.nombre})`);
  await mensajeChat(sb, e, `Orden enviada a Lovable (${p.nombre}). Ejecución ${e.id.slice(0, 8)}.`);
}
async function sondearLovable(sb: SB, e: any, p: any, cfg: any) {
  const token = await tokenAcceso(sb, e.user_id);
  const r = await herramientaLovable(token, "get_message", { project_id: p.lovable_project_id, message_id: e.mensaje_id, ...(e.thread_id ? { thread_id: e.thread_id } : {}) });
  const resp = r.response ?? r;
  const estado = String(resp.status ?? r.status ?? "in_progress");
  if (estado !== "completed" && estado !== "failed" && estado !== "error") {
    if (e.iniciada_el && Date.now() - new Date(e.iniciada_el).getTime() > 45 * 60_000) await fallo(sb, e, "Lovable lleva más de 45 minutos sin terminar; revisa el proyecto en Lovable.", "Tiempo agotado en Lovable");
    return;
  }
  const contenido = limpiarRespuesta(resp.content ?? resp.text ?? "");
  const commit = resp.commit_sha ?? resp.commitSha ?? null;
  const coste = resp.cost_credits ?? resp.credits ?? null;
  if (estado !== "completed") { await actualizar(sb, e.id, { respuesta: contenido }, e.bloqueo_token); await fallo(sb, e, `Lovable terminó con error: ${contenido.slice(0, 400)}`, "Lovable terminó con error"); return; }
  const resumen = contenido.split("\n").filter((l) => l.trim()).slice(-6).join("\n").slice(0, 900);
  await actualizar(sb, e.id, { estado: "comprobando", respuesta: contenido.slice(0, 12000), resumen, commit_sha: commit, coste_creditos: coste }, e.bloqueo_token);
  if (coste != null) await sb.from("consumos_ia").insert({ user_id: e.user_id, proyecto_id: e.proyecto_id, tarea_id: e.tarea_id, tokens_entrada: 0, tokens_salida: 0, coste: Number(coste) * 0.2, duracion_ms: e.iniciada_el ? Date.now() - new Date(e.iniciada_el).getTime() : null, resultado: "ok" }).then(() => {}, () => {});
  const { previewUrl, previewOk } = await comprobarPreview(sb, cfg, e.user_id, p);
  if (e.modo === "planificar") { await finalizar(sb,e,{comentario:"Plan de Lovable recibido (sin cambios de código)"}); return; }
  if (cfg.comprobar_preview && previewOk === false) {
    await actualizar(sb, e.id, { preview_url: previewUrl, preview_ok: false }, e.bloqueo_token);
    await fallo(sb, e, "La vista previa no responde tras los cambios; revisa el proyecto en Lovable antes de publicar.", "La vista previa no responde tras los cambios");
    await crearTareaAtencion(sb, e, `Revisar en Lovable: la vista previa de ${p.nombre} no responde`, `Abre el proyecto en Lovable, comprueba el error de compilación y vuelve a lanzar la orden desde NexDeveloper.`, "Revisar error");
    return;
  }
  if (Number(coste ?? 0) > Number(cfg.aviso_creditos ?? 20)) await crearTareaAtencion(sb, e, `Aviso: la orden de ${p.nombre} ha consumido ${coste} créditos de Lovable`, `Revisa el resultado en Órdenes → Ejecución antes de publicar.`, "Aviso de consumo");
  if (cfg.auto_publicar) { await actualizar(sb, e.id, { preview_url: previewUrl, preview_ok: previewOk }, e.bloqueo_token); await publicar(sb, { ...e, resumen, preview_url: previewUrl }); return; }
  await pedirAprobacion(sb, { ...e, resumen }, p, previewUrl, previewOk, resumen);
}

// ---------- Motor Claude + GitHub ----------
function sistemaAgente(p: any, cfg: any) {
  return `Eres el desarrollador senior de NexDeveloper trabajando para Javier (Soluciones EvoluteIA S.L. / Modeontecno S.L.). Trabajas sobre el repositorio GitHub «${p.repositorio}» del proyecto «${p.nombre}» (${p.descripcion ?? ""}; tecnologías: ${p.tecnologias ?? "Lovable, React, TypeScript, Tailwind, shadcn/ui, Supabase"}).
Tu misión: ejecutar la orden recibida modificando el código con las herramientas, de forma completa y lista para producción.
Reglas fijas:
- Habla y comenta SIEMPRE en español de España; los textos de la interfaz también en español.
- Antes de escribir, orienta: lista archivos y lee los que vas a tocar. Crea archivos nuevos completos; para modificar archivos existentes prefiere editar_archivo y conserva el resto. Nunca sustituyas un archivo por fragmentos ni marcadores «…».
- Respeta el estilo y la estructura existentes (rutas, componentes, hooks, tipos). No añadas dependencias nuevas salvo que sea imprescindible (si lo es, actualiza package.json).
- No toques secretos ni archivos .env, ni ejecutes migraciones o alteres proyectos remotos. Si el encargo pide integrar Supabase, puedes preparar cliente opcional, código de configuración y migraciones aditivas sin credenciales reales, conservando la demo y declarando los datos pendientes. No borres funcionalidades ajenas a la orden.
- Si el proyecto muestra la versión en una esquina (busca «version» en el código o en package.json), súbela (parche o menor) e indícala en «terminar».
- Sé eficiente: máximo ${cfg.max_pasos ?? 40} pasos. Cuando termines, llama a «terminar» con un resumen claro para el cliente (qué cambia, archivos, cómo probarlo).`;
}
async function pasoAgente(sb: SB, e: any, p: any, cfg: any) {
  const INICIO = Date.now();
  const clave = e.equipo_automatico ? null : await claveAnthropic(sb, e.user_id);
  if (!clave && !e.equipo_automatico) throw new Error("Falta la clave de Anthropic en Ajustes → Proveedores (necesaria para el motor Claude).");
  const { data: permitido, error: errorPresupuesto } = await sb.rpc("gasto_ia_permitido", { p_user_id: e.user_id, p_proveedor: null, p_proyecto_id: e.proyecto_id });
  if (errorPresupuesto || permitido !== true) throw new Error("Presupuesto de IA superado con acción «bloquear». Revisa Gasto de IA → Presupuestos.");
  const repo = p.repositorio;
  let st = e.estado_agente ?? null;
  if (!st) {
    const base = repo ? await ramaPorDefecto(repo) : "sin-repositorio";
    const ref = repo ? await gh(`/repos/${repo}/git/ref/heads/${base}`) : {object:{sha:null}};
    st = { base, base_sha: ref.object.sha, mensajes: [{ role: "user", content: `ORDEN:\n${e.texto}\n\nEmpieza orientándote con listar_archivos.` }], arbol: repo ? null : [] };
  }
  if(e.equipo_automatico && !st.equipo){const candidatos=await candidatosEquipo(sb,e.user_id);st.disponibles=candidatos;st.equipo=prepararEquipo(candidatos,e.texto??'',e.modo==='planificar',cfg.equipo_modelos??{},esRevisionMejoras(e));st.fase=0;st.cola_version=1;}
  const fase=e.equipo_automatico?st.equipo[st.fase]:null;
  if(fase){fase.estado='trabajando';fase.iniciada??=ahora();fase.coste_inicio??=Number(e.coste_ia??0);}
  const lectura=e.modo==='planificar'||(fase&&soloLectura(fase.papel));
  const costeInicialFase=Number(e.coste_ia??0);
  const cambios: Record<string, string | null> = e.cambios ?? {};
  let pasos = e.pasos ?? 0; let te = e.tokens_entrada ?? 0; let ts = e.tokens_salida ?? 0; let coste = Number(e.coste_ia ?? 0);
  const modelo = cfg.modelo_claude ?? "claude-sonnet-4-5";
  const { data: mod } = await sb.from("modelos_ia").select("id, coste_entrada, coste_salida").eq("user_id", e.user_id).eq("identificador", modelo).maybeSingle();
  const guardar = async (extra: Record<string, unknown> = {}) => actualizar(sb, e.id, { estado_agente: st, cambios, pasos, tokens_entrada: te, tokens_salida: ts, coste_ia: coste, ...extra }, e.bloqueo_token);
  const arbol = async () => { if (!st.arbol) st.arbol = (await arbolRepo(repo, st.base_sha)).filter((n) => !IGNORAR.test(n.ruta)).map((n) => n.ruta); return st.arbol as string[]; };
  const leer = async (ruta: string) => { if (ruta in cambios) { const c = cambios[ruta]; if (c === null) throw new Error(`${ruta} fue borrado`); return c; } if(!repo)throw Error("Este proyecto aún no tiene archivos: aconseja sobre la descripción aportada."); return await leerArchivoRepo(repo, ruta, st.base_sha); };

  if(fase)await guardar();
  while (Date.now() - INICIO < PRESUPUESTO_MS) {
    await comprobarActiva(sb,e);
    if (pasos >= (cfg.max_pasos ?? 40)) { await guardar(); throw new Error(`Se alcanzó el máximo de ${cfg.max_pasos ?? 40} pasos sin terminar. El encargo y sus entregas están guardados; amplía el límite de pasos y reanuda para continuar la cola.`); }
    if (coste > Number(cfg.max_coste_ia ?? 3)) { await guardar(); throw new Error(`La orden ha superado el coste máximo de IA (${cfg.max_coste_ia} €). Ajústalo en Órdenes → Ejecución → Configuración.`); }
    st.mensajes = recortarHistorial(st.mensajes);
    const sistema=sistemaAgente(p,cfg)+(fase?'\n'+instruccionesPapel(fase,st.equipo.slice(0,st.fase))+'\nArchivos modificados hasta ahora: '+Object.keys(cambios).join(', ')+'\nModelos disponibles y coste relativo de tarifa (no ranking medido): '+JSON.stringify(st.disponibles??[]):'')+(lectura?'\nSOLO LECTURA: no escribas ni borres archivos.':'');
    let r:any;
    const contexto=contextoModelo(st.mensajes);
    try{r = fase ? await llamarEquipo(sb,e,fase,sistema,contexto,lectura) : await llamarClaude(sb,e,mod?.id,clave,modelo,sistema,contexto,lectura);}
    catch(error){
      const detalle=error as any;
      if(fase && detalle.codigo==='SALIDA_TRUNCADA_CONTABILIZADA'){
        pasos++;te+=detalle.entrada;ts+=detalle.salida;coste+=detalle.coste;fase.recortes=(fase.recortes??0)+1;
        if(fase.recortes<=1){
          st.mensajes.push({role:'user',content:'La última respuesta se descartó por exceder la salida; su consumo ya está contabilizado. Los archivos guardados antes de esa llamada se conservan. Continúa desde ellos: una operación pequeña por respuesta, preferiblemente editar_archivo; limita la respuesta a 1500 tokens. Si necesitas más código, construye módulos o migraciones completos pequeños en operaciones sucesivas. Al terminar usa solo un resumen breve y no repitas el contenido de los archivos en entrega.'});
          await guardar();return null;
        }
        await guardar();throw error;
      }
      if(!fase||fase.sustitucion||!/HTTP (429|503)/.test(String((error as Error).message)))throw error;
      const candidatos=(await candidatosEquipo(sb,e.user_id)).filter((c:any)=>c.proveedor!==fase.modelo.proveedor);
      if(!candidatos.length)throw error;
      const alternativa=prepararEquipo(candidatos,e.texto??'',e.modo==='planificar',cfg.equipo_modelos??{},esRevisionMejoras(e)).find((f:any)=>f.papel===fase.papel);
      if(!alternativa)throw error;
      fase.sustitucion={proveedor:fase.modelo.proveedor,modelo:fase.modelo.identificador,motivo:String((error as Error).message),fecha:ahora()};
      fase.modelo=alternativa.modelo;fase.motivo='Sustitución por cuota o indisponibilidad del proveedor anterior. El consumo pendiente conserva su reserva.';
      st.mensajes=[{role:'user',content:`ORDEN ORIGINAL:\n${e.texto}\nRetoma tu papel y comprueba los archivos acumulados antes de continuar. El proveedor anterior no pudo completar la llamada.`}];
      await guardar();return null;
    }
    pasos++;
    const ue = r.usage?.input_tokens ?? 0, us = r.usage?.output_tokens ?? 0; te += ue; ts += us;
    const c = Number(r._nex_coste_eur); coste += c;
    st.mensajes.push({ role: "assistant", content: r.content, ...(r._native?{_native:r._native}:{}) });
    const usos = (r.content ?? []).filter((b: any) => b.type === "tool_use");
    if (!usos.length) {
      const texto = (r.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
      st.mensajes.push({ role: "user", content: `Si has terminado, llama a la herramienta «terminar» con el resumen. Si no, continúa con las herramientas.` });
      if (pasos > 3 && !texto) { await guardar(); throw new Error("El agente dejó de responder con herramientas."); }
      await guardar(); continue;
    }
    const resultados: any[] = [];
    let terminado: any = null;
    for (const u of usos) {
      await comprobarActiva(sb,e);
      let out = "";
      try {
        const a = u.input ?? {};
        if (lectura && ["escribir_archivo", "editar_archivo", "borrar_archivo"].includes(u.name)) throw new Error("La planificación no permite modificar archivos");
        if (u.name === "listar_archivos") { const f = String(a.filtro ?? "").toLowerCase(); const lista = (await arbol()).filter((x) => !f || x.toLowerCase().includes(f)); const extra = Object.keys(cambios).filter((k) => cambios[k] !== null && !lista.includes(k) && (!f || k.toLowerCase().includes(f))); out = [...lista, ...extra].slice(0, 400).join("\n") || "(sin coincidencias)"; if (lista.length > 400) out += `\n…(${lista.length - 400} más; afina el filtro)`; }
        else if (u.name === "leer_archivo") { const ruta=String(a.ruta),t=await leer(ruta),posicion=a.inicio??1; if(!Number.isInteger(posicion)||posicion<0)throw Error("La posición debe ser un entero desde 1; omítela para leer desde el principio");const inicio=Math.max(0,posicion-1); if(inicio>t.length)throw Error("Índice de lectura no válido");const fin=Math.min(t.length,inicio+60000);if(fase){fase.lecturas??={};const cobertura=cubrirLectura(fase.lecturas[ruta]??[],inicio,fin,t.length);fase.lecturas[ruta]=cobertura.rangos;if(cobertura.completa){fase.leidos??=[];if(!fase.leidos.includes(ruta))fase.leidos.push(ruta);}}out=t.slice(inicio,fin)+(fin<t.length?`\n…(lectura parcial ${inicio}-${fin} de ${t.length}; continúa con inicio:${fin+1})`:"\n(fin del archivo)"); }
        else if (u.name === "buscar") {
          const q = String(a.texto ?? ""); const hits: string[] = [];
          const candidatos = (await arbol()).filter((x) => /\.(tsx?|jsx?|css|json|md|sql|html|toml|ya?ml)$/i.test(x)).slice(0, 250);
          for (const ruta of candidatos) { if (hits.length >= 30 || Date.now() - INICIO > PRESUPUESTO_MS - 15_000) break; try { const t = await leer(ruta); const lineas = t.split("\n"); lineas.forEach((l, i) => { if (hits.length < 30 && l.includes(q)) hits.push(`${ruta}:${i + 1}: ${l.trim().slice(0, 160)}`); }); } catch { /* seguir */ } }
          out = hits.join("\n") || "(sin coincidencias)";
        }
        else if (u.name === "escribir_archivo") { const ruta = String(a.ruta); if (!escrituraPermitida(ruta)) throw new Error("Ruta protegida o no válida"); const contenido = String(a.contenido ?? ""); const previo = ruta in cambios ? cambios[ruta] : (await arbol()).includes(ruta) ? await leer(ruta) : null; if(previo && previo.length>2000 && contenido.length<previo.length*0.7)throw Error("La sustitución eliminaría gran parte del archivo. Usa editar_archivo para cambios exactos y conserva el resto."); const total = Object.values({ ...cambios, [ruta]: contenido }).reduce((s, v) => s + (v?.length ?? 0), 0); if (total > 900_000) throw new Error("Se alcanzó la capacidad de cambios de esta ejecución (900 KB). La entrega se conserva; requiere ampliar el almacenamiento del motor."); if(fase && contenido !== previo){fase.archivos??=[];if(!fase.archivos.includes(ruta))fase.archivos.push(ruta);} cambios[ruta] = contenido; if (st.arbol && !st.arbol.includes(ruta)) st.arbol.push(ruta); out = `Guardado ${ruta} (${contenido.length} caracteres)`; }
        else if (u.name === "editar_archivo") { const ruta=String(a.ruta);if(!escrituraPermitida(ruta))throw Error("Ruta protegida o no válida");const contenido=parcheExacto(await leer(ruta),a.antes,a.despues);const total=Object.values({...cambios,[ruta]:contenido}).reduce((s,v)=>s+(v?.length??0),0);if(total>900_000)throw Error("Capacidad de cambios alcanzada; se conserva la entrega anterior.");cambios[ruta]=contenido;if(fase){fase.archivos??=[];if(!fase.archivos.includes(ruta))fase.archivos.push(ruta);}out=`Parche guardado en ${ruta}; resto del archivo conservado.`; }
        else if (u.name === "borrar_archivo") { const ruta = String(a.ruta); if(!escrituraPermitida(ruta))throw Error("Ruta protegida o no válida"); await leer(ruta); cambios[ruta] = null; if(fase){fase.archivos??=[];if(!fase.archivos.includes(ruta))fase.archivos.push(ruta);} out = `Marcado para borrar ${ruta}`; }
        else if (u.name === "terminar") { if((fase&&(["consejo","diseno"].includes(fase.papel)||fase.papel.startsWith("mejoras_")))&&String(a.entrega??"").trim().length<40)throw Error("Incluye entrega con el consejo o diseño completo: decisiones, razones y pasos concretos. No basta un resumen de que lo has elaborado."); if(st.cola_version && fase?.papel==='diseno') a.tareas=validarPlan(a.tareas);
          if(fase?.tarea && !soloLectura(fase.papel) && !fase.archivos?.length)throw Error("Esta tarea necesita cambios reales guardados; una descripción de trabajo pendiente no es una implementación.");
          if(fase?.papel==='revision'){
            const anterior=st.equipo.slice(0,st.fase).reverse().find((f:any)=>!soloLectura(f.papel));
            const pendientes=(fase.tarea ? (anterior?.archivos??Object.keys(cambios)) : Object.keys(cambios)).filter((ruta:string)=>cambios[ruta]!==null&&!fase.leidos?.includes(ruta));
            if(pendientes.length)throw Error('Falta cobertura desde el primer carácter. Repite leer_archivo con inicio:1 (posición de carácter, no línea) para completar estos archivos antes de terminar: '+pendientes.join(', '));
            if(a.revision_ok===true && (!Array.isArray(a.hallazgos)||a.hallazgos.length))throw Error('Una revisión aprobada requiere hallazgos vacíos.');
          }
          terminado = a; out = "Entrega registrada; las pruebas automáticas requieren CI sobre el commit final."; }
        else out = `Herramienta desconocida ${u.name}`;
      } catch (err) { out = `ERROR: ${String(err?.message ?? err)}`; }
      resultados.push({ type: "tool_result", tool_use_id: u.id, name:u.name, content: out });
    }
    st.mensajes.push({ role: "user", content: resultados });
    await guardar();
    if(fase)fase.coste=coste-Number(fase.coste_inicio??costeInicialFase);
    if (terminado && fase) {
      if(st.cola_version && fase.papel==='diseno' && !st.plan){st.plan=terminado.tareas;st.equipo.splice(st.fase+1,st.equipo.length-st.fase-1,...fasesDelPlan(st.plan,st.equipo));}
      fase.revision_ok=fase.papel==='revision'?terminado.revision_ok:undefined;
      fase.resumen=String(terminado.entrega??terminado.resumen??'');fase.estado='completada';fase.terminada=ahora();
      if(fase.papel==='revision' && terminado.revision_ok!==true){
        const revisionClave=fase.tarea?'tarea:'+fase.tarea.id:'revision-integral';st.reparaciones??={};
        if((st.reparaciones[revisionClave]??0)<2){
          st.reparaciones[revisionClave]=(st.reparaciones[revisionClave]??0)+1;
          const anterior=st.equipo.slice(0,st.fase).reverse().find((f:any)=>!soloLectura(f.papel));
          if(anterior){
            st.equipo.splice(st.fase+1,0,{...anterior,tarea:fase.tarea,archivos:[],leidos:[],lecturas:{},estado:'pendiente',resumen:undefined,coste:0,coste_inicio:undefined,iniciada:undefined,terminada:undefined,motivo:'Corregir los problemas concretos encontrados por la revisión.'},{...fase,lecturas:{},leidos:[],estado:'pendiente',resumen:undefined,coste:0,coste_inicio:undefined,iniciada:undefined,terminada:undefined});
            fase.resumen+='\nProblemas: '+(terminado.hallazgos??[]).join(' · ');
          }else throw Error('No hay desarrollador para corregir la revisión');
        }else {await guardar();throw Error('La tarea sigue bloqueada después de dos ciclos de corrección y revisión: '+(terminado.hallazgos??[fase.resumen]).join(' · '));}
      }
      if(st.fase<st.equipo.length-1){
        st.fase++;st.mensajes=[{role:'user',content:`ORDEN ORIGINAL:\n${e.texto}\nContinúa con tu papel sobre los archivos acumulados. Lee las entregas anteriores y los archivos antes de escribir.`}];
        await guardar();return null;
      }
      terminado.resumen=st.equipo.map((f:any)=>`${PAPELES[f.papel]} · ${f.modelo.proveedor}/${f.modelo.identificador}: ${f.resumen}`).join('\n\n');
      await guardar();
    }
    if (terminado) return { terminado, cambios, coste, pasos, st };
  }
  return null; // sin tiempo: se reanuda en la siguiente invocación
}
async function publicarRama(e: any, p: any, st: any, cambios: Record<string, string | null>, resumen: string, version?: string) {
  const repo = p.repositorio; const rama = `nexdeveloper/orden-${e.id.slice(0, 8)}`;
  const ref = await gh(`/repos/${repo}/git/ref/heads/${st.base}`); const baseSha = ref.object.sha;
  if (baseSha !== st.base_sha) throw new Error("El repositorio ha cambiado desde la lectura. Revisa y reinicia la ejecución sobre la versión actual para evitar sobrescribir cambios.");
  const commitBase = await gh(`/repos/${repo}/git/commits/${baseSha}`);
  const tree: any[] = [];
  for (const [ruta, contenido] of Object.entries(cambios)) {
    if (contenido === null) { tree.push({ path: ruta, mode: "100644", type: "blob", sha: null }); continue; }
    const blob = await gh(`/repos/${repo}/git/blobs`, { method: "POST", body: JSON.stringify({ content: utf8b64(contenido), encoding: "base64" }) });
    tree.push({ path: ruta, mode: "100644", type: "blob", sha: blob.sha });
  }
  const nuevoTree = await gh(`/repos/${repo}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: commitBase.tree.sha, tree }) });
  const titulo = `NexDeveloper${version ? ` v${version}` : ""}: ${e.texto.split("\n")[0].slice(0, 60)}`;
  const commit = await gh(`/repos/${repo}/git/commits`, { method: "POST", body: JSON.stringify({ message: `${titulo}\n\n${resumen}\n\nOrden ${e.id} ejecutada por NexDeveloper.`, tree: nuevoTree.sha, parents: [baseSha] }) });
  try { await gh(`/repos/${repo}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${rama}`, sha: commit.sha }) }); }
  catch { throw new Error("La rama de esta ejecución ya existe. Revisa su contenido antes de reanudar; no se sobrescribe automáticamente."); }
  const pr = await gh(`/repos/${repo}/pulls`, { method: "POST", body: JSON.stringify({ title: titulo, head: rama, base: st.base, body: `## Orden\n${e.texto}\n\n## Resumen de la IA\n${resumen}\n\n## Archivos\n${Object.keys(cambios).map((k) => `- ${cambios[k] === null ? "(borrado) " : ""}${k}`).join("\n")}\n\n_Generado por NexDeveloper · equipo de desarrollo. «Aprobar y publicar» desde NexDeveloper fusiona esta solicitud._` }) });
  return { rama, commit: commit.sha, pr_url: pr.html_url, pr_numero: pr.number };
}
async function ejecutarClaude(sb: SB, e: any, p: any, cfg: any) {
  if (!p.repositorio && !(e.equipo_automatico && e.modo === "planificar")) throw new Error("El proyecto no tiene repositorio de GitHub en su ficha.");
  const r = await pasoAgente(sb, e, p, cfg);
  if (!r) return; // continúa en el siguiente tic
  const { terminado, cambios, coste, pasos, st } = r;
  const resumen = String(terminado.resumen ?? "").slice(0, 3000);
  const archivos = Object.keys(cambios);
  if(e.modo!=="planificar" && (terminado.sin_cambios||!archivos.length)){
    await actualizar(sb,e.id,{estado:'esperando_aprobacion',resumen,respuesta:resumen,error:'La IA terminó sin cambios de código; no se da la tarea por completada.'},e.bloqueo_token);
    await crearTareaAtencion(sb,e,'Revisar resultado sin cambios',resumen,'Resultado sin implementación');
    return;
  }
  if (e.modo === "planificar") {
    await finalizar(sb,e,{resumen,respuesta:resumen,comentario:`Sin cambios de código: ${resumen.slice(0,200)}`});
    await mensajeChat(sb, e, `La IA no ha cambiado código. ${resumen}`);
    return;
  }
  await comprobarActiva(sb,e);
  const pub = await publicarRama(e, p, st, cambios, resumen, terminado.version);
  await actualizar(sb, e.id, { estado: "comprobando", resumen, respuesta: resumen, rama: pub.rama, commit_sha: pub.commit, pr_url: pub.pr_url, pr_numero: pub.pr_numero, coste_ia: coste, pasos }, e.bloqueo_token);
  await mensajeChat(sb, e, `Cambios preparados en GitHub (${pub.pr_url}). ${resumen}`);
  const e2 = { ...e, motor: "claude", resumen, rama: pub.rama, commit_sha: pub.commit, pr_numero: pub.pr_numero, pr_url: pub.pr_url };
  if (cfg.auto_publicar && !e.equipo_automatico) { await publicar(sb, e2); return; }
  await pedirAprobacion(sb, e2, p, null, null, `${resumen}\nArchivos: ${archivos.join(", ")}`);
}

// Required GitHub Actions checks must pass on the precise PR head.
async function verificarCI(repo: string, numero: number, sha: string) {
  if (!/^[0-9a-f]{40}$/.test(sha ?? "")) throw new Error("Falta el commit que se debe comprobar");
  const pr=await gh(`/repos/${repo}/pulls/${numero}`);
  if (pr.head?.sha!==sha || pr.state!=="open" || pr.draft) throw new Error("La solicitud cambió o no está lista para fusionar");
  const required=(Deno.env.get("DEPLOY_REQUIRED_CHECKS")??"build-and-test").split(",").map(x=>x.trim()).filter(Boolean);
  if (!required.length) throw new Error("No se han definido comprobaciones obligatorias");
  const checks=await gh(`/repos/${repo}/commits/${sha}/check-runs?per_page=100&filter=latest`);
  if (checks.total_count>100) throw new Error("Demasiadas comprobaciones; requiere revisión completa antes de publicar");
  for(const name of required) {
    const matches=(checks.check_runs??[]).filter((c:any)=>c.name===name && c.app?.slug==="github-actions" && c.head_sha===sha);
    if(matches.length!==1 || matches[0].status!=="completed" || matches[0].conclusion!=="success") throw new Error(`La comprobación ${name} no ha terminado correctamente para este commit`);
  }
}
// ---------- Publicación ----------
async function publicar(sb: SB, e: any) {
  if (!e.bloqueo_token) return conBloqueo(sb,e,locked=>publicar(sb,locked));
  await comprobarActiva(sb,e);
  await actualizar(sb, e.id, { estado: "publicando", aprobada_el: e.aprobada_el ?? ahora() }, e.bloqueo_token);
  const { data: p } = await sb.from("proyectos").select("lovable_project_id, nombre, slug, repositorio, espacio_trabajo_url").eq("id", e.proyecto_id).maybeSingle();
  try {
    if (e.motor === "claude" && e.pr_numero && !e.fusionada_sha) {
      await verificarCI(p!.repositorio,e.pr_numero,e.commit_sha);
      await comprobarActiva(sb,e);
      const m = await gh(`/repos/${p!.repositorio}/pulls/${e.pr_numero}/merge`, { method: "PUT", body: JSON.stringify({ sha:e.commit_sha, merge_method: "merge", commit_title: `NexDeveloper: ${String(e.texto).split("\n")[0].slice(0, 60)}` }) });
      if (!m?.merged || !m.sha) throw new Error("GitHub no confirmó la fusión");
      e.fusionada_sha=m.sha;
      await actualizar(sb, e.id, { fusionada_sha:m.sha }, e.bloqueo_token);
      try { await gh(`/repos/${p!.repositorio}/git/refs/heads/${e.rama}`, { method: "DELETE" }); } catch { /* opcional */ }
    }
    const { data: c } = await sb.from("lovable_conexion").select("estado").eq("user_id", e.user_id).maybeSingle();
    if (c?.estado === "conectada" && p?.lovable_project_id) {
      const token = await tokenAcceso(sb, e.user_id);
      if (e.motor === "claude") await new Promise((r) => setTimeout(r, 20_000)); // dar tiempo a la sincronización GitHub → Lovable
      await comprobarActiva(sb,e);
      const r = await herramientaLovable(token, "deploy_project", { project_id: p!.lovable_project_id });
      const url = r.url ?? r.live_url ?? r.published_url ?? r.deployment?.url ?? null;
      const confirmedSha = r.commit_sha ?? r.deployment?.commit_sha;
      if (!url || confirmedSha !== (e.fusionada_sha ?? e.commit_sha) || !["success","completed","ready"].includes(r.status ?? r.deployment?.status)) throw new Error("Publicación solicitada; falta confirmar el commit desplegado. Comprueba el destino antes de repetir.");
      await finalizar(sb,e,{publicada:true,url,commit:confirmedSha,comentario:`Publicada por NexDeveloper en ${url}`});
      await mensajeChat(sb, e, `Publicado${url ? `: ${url}` : ""}. ${e.resumen ?? ""}`);
    } else {
      await actualizar(sb, e.id, { estado: "esperando_aprobacion", terminada_el: null, error: "Código fusionado; publicación pendiente de confirmar" }, e.bloqueo_token);
      await sincronizarOrden(sb, e, "ejecutando", "Cambios fusionados en GitHub; pendiente de publicar en Lovable");
      await crearTareaAtencion(sb, e, `Publicar en Lovable: ${p!.nombre}`, `Los cambios ya están en GitHub y Lovable los sincroniza solo. Abre el proyecto en Lovable, comprueba la vista previa y pulsa «Publicar» (o conecta Lovable en Órdenes → Ejecución para que NexDeveloper publique solo).`, "Publicar");
      await mensajeChat(sb, e, `Cambios fusionados en GitHub. Falta publicar en Lovable. ${e.resumen ?? ""}`);
    }
  } catch (err) {
    await actualizar(sb, e.id, { estado: "esperando_aprobacion", error: `No se pudo publicar: ${String(err?.message ?? err).slice(0, 400)}` }, e.bloqueo_token);
  }
}

// ---------- Orquestación ----------
async function elegirMotor(sb: SB, userId: string, cfg: any, p: any) {
  const { data: c } = await sb.from("lovable_conexion").select("estado").eq("user_id", userId).maybeSingle();
  const lov = false; // Unbounded credit-based execution is not eligible for automatic selection.
  const pref = cfg.motor_preferido ?? "auto";
  if (pref === "lovable") return lov ? "lovable" : null;
  if (pref === "claude") return p.repositorio && GITHUB_TOKEN ? "claude" : null;
  if (lov) return "lovable";
  if (p.repositorio && GITHUB_TOKEN && (await claveAnthropic(sb, userId))) return "claude";
  return null;
}
async function enviar(sb: SB, e: any) { return conBloqueo(sb,e,locked=>enviarReclamada(sb,locked)); }
async function enviarReclamada(sb: SB, e: any) {
  await comprobarActiva(sb,e);
  const { data: p } = await sb.from("proyectos").select("id, nombre, slug, descripcion, tecnologias, repositorio, lovable_project_id, espacio_trabajo_url").eq("id", e.proyecto_id).maybeSingle();
  if (!p) { await fallo(sb, e, "Proyecto no encontrado"); return; }
  const cfg = await config(sb, e.user_id);
  const motor = e.motor && e.motor !== "auto" ? e.motor : await elegirMotor(sb, e.user_id, cfg, p);
  if (!motor) { await fallo(sb, e, "No hay motor disponible: conecta Lovable (Órdenes → Ejecución) o pon la clave de Anthropic y el repositorio del proyecto.", "Sin motor de ejecución disponible"); return; }
  await actualizar(sb, e.id, { estado: "enviando", motor, iniciada_el: e.iniciada_el ?? ahora(), intentos: (e.intentos ?? 0) + 1 }, e.bloqueo_token);
  try {
    if (motor === "lovable") await enviarLovable(sb, e, p, cfg);
    else { await actualizar(sb, e.id, { estado: "construyendo" }, e.bloqueo_token); await sincronizarOrden(sb, e, "ejecutando", `Desarrollo en marcha sobre ${p.repositorio}`); await mensajeChat(sb, e, `Desarrollo en marcha sobre ${p.repositorio}. Ejecución ${e.id.slice(0, 8)}.`); await ejecutarClaude(sb, { ...e, motor }, p, cfg); }
  } catch (err) { await fallo(sb, e, String(err?.message ?? err), `Error al ejecutar: ${String(err?.message ?? err).slice(0, 200)}`); }
}
async function sondear(sb: SB, e: any) { return conBloqueo(sb,e,locked=>sondearReclamada(sb,locked)); }
async function sondearReclamada(sb: SB, e: any) {
  await comprobarActiva(sb,e);
  if(e.resultado_pendiente){await finalizar(sb,e,e.resultado_pendiente);return;}
  const cfg = await config(sb, e.user_id);
  const { data: p } = await sb.from("proyectos").select("id, nombre, slug, descripcion, tecnologias, repositorio, lovable_project_id, espacio_trabajo_url").eq("id", e.proyecto_id).maybeSingle();
  if (!p) { await fallo(sb, e, "Proyecto no encontrado"); return; }
  try {
    if (e.motor === "lovable") await sondearLovable(sb, e, p, cfg);
    else if (e.estado === "construyendo") await ejecutarClaude(sb, e, p, cfg);
  } catch (err) {
    const msg = String(err?.message ?? err);
    const intentos = (e.intentos ?? 0) + 1;
    const definitivo = e.motor === "claude" || intentos >= 5;
    if (definitivo) await fallo(sb, e, msg, `Error: ${msg.slice(0, 200)}`);
    else await actualizar(sb, e.id, { intentos, error: msg.slice(0, 500) }, e.bloqueo_token);
  }
}
async function encolarOrden(sb: SB, orden: any, modo = "construir", motor = "auto") {
  const {data, error} = await sb.rpc("encolar_orden_atomica", {p_user_id:orden.user_id,p_orden_id:orden.id,p_modo:modo,p_motor:motor});
  if (error || !data?.id) throw new Error("La orden no pudo entrar en la cola. Revisa aprobación, proyecto y revisión.");
  return data;
}

async function programado(sb: SB) {
  const INICIO = Date.now();
  const res: Record<string, number> = { enviadas: 0, sondeadas: 0, encoladas: 0 };
  const { data: pendientes } = await sb.from("ordenes").select("*").in("estado", ["aprobada", "en_cola"]).eq("bloqueada_por_revision", false).eq("pendiente_confirmar_proyecto", false).is("ejecucion_id", null).neq("ejecutar_con", "manual").or("requiere_atencion.is.null,requiere_atencion.eq.false").not("proyecto_id", "is", null).limit(10);
  for (const o of pendientes ?? []) {
    if (o.requiere_aprobacion && !o.resuelta_el) continue;
    const cfg = await config(sb, o.user_id); if (!cfg.auto_ejecutar) continue;
    const { data: p } = await sb.from("proyectos").select("repositorio, lovable_project_id").eq("id", o.proyecto_id).maybeSingle();
    if (!p || !(await elegirMotor(sb, o.user_id, cfg, p))) continue;
    await encolarOrden(sb, o); res.encoladas++;
  }
  const { data: activas } = await sb.from("ejecuciones_orden").select("*").in("estado", ["construyendo", "comprobando"]).order("creado_el").limit(6);
  for (const e of activas ?? []) { if (Date.now() - INICIO > PRESUPUESTO_MS) break; if (e.motor === "lovable" && !e.mensaje_id) continue; if (e.motor === "claude" && e.estado === "comprobando") continue; await sondear(sb, e); res.sondeadas++; }
  const { data: cola } = await sb.from("ejecuciones_orden").select("*").eq("estado", "en_cola").order("creado_el").limit(10);
  for (const e of cola ?? []) {
    if (Date.now() - INICIO > PRESUPUESTO_MS) break;
    const cfg = await config(sb, e.user_id);
    const { count } = await sb.from("ejecuciones_orden").select("id", { count: "exact", head: true }).eq("user_id", e.user_id).in("estado", ["enviando", "construyendo", "comprobando"]);
    if ((count ?? 0) >= (cfg.max_simultaneas ?? 2)) continue;
    await enviar(sb, e); res.enviadas++;
  }
  return res;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = servicio();
  const url = new URL(req.url);
  try {
    // Documento de metadatos del cliente OAuth y callback (GET, sin sesión)
    if (req.method === "GET" && url.pathname.endsWith("/cliente.json")) return new Response(JSON.stringify(documentoCliente()), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
    if (req.method === "GET" && (url.pathname.endsWith("/callback") || url.searchParams.get("accion") === "callback")) {
      const code = url.searchParams.get("code"); const state = url.searchParams.get("state") ?? "";
      const errorOauth = url.searchParams.get("error");
      if (errorOauth) return html(`Lovable devolvió un error: ${errorOauth} ${url.searchParams.get("error_description") ?? ""}`, 400);
      if (!code) return html("Lovable no devolvió el código de autorización.", 400);
      const { data: st } = await sb.from("oauth_estados").select("*").eq("state", state).eq("proveedor", "lovable").maybeSingle();
      if (!st) return html("Estado de autorización no válido o caducado. Vuelve a pulsar «Conectar con Lovable».", 400);
      await sb.from("oauth_estados").delete().eq("state", state);
      const { data: con } = await sb.from("lovable_conexion").select("client_id").eq("user_id", st.user_id).maybeSingle();
      const r = await fetch(OAUTH.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: URL_CALLBACK, client_id: con?.client_id ?? CLIENT_ID_DOC, code_verifier: st.verifier }) });
      if (!r.ok) { const t = await r.text(); await sb.from("lovable_conexion").update({ estado: "error", ultimo_error: t.slice(0, 300) }).eq("user_id", st.user_id); return html(`Lovable rechazó el intercambio: ${t.slice(0, 300)}`, 502); }
      const tok = await r.json();
      const expira = new Date(Date.now() + Number(tok.expires_in ?? 3600) * 1000).toISOString();
      await sb.rpc("guardar_secreto_lovable", { p_user_id: st.user_id, p_refresh: tok.refresh_token ?? "", p_acceso: tok.access_token, p_expira: expira });
      let cuenta: string | null = null;
      try { const me = await herramientaLovable(tok.access_token, "get_me", {}); cuenta = me.email ?? me.user?.email ?? me.name ?? null; } catch { /* sin cuenta */ }
      await sb.from("lovable_conexion").update({ estado: "conectada", cuenta, ultimo_error: null, ultima_comprobacion: ahora(), actualizado_el: ahora() }).eq("user_id", st.user_id);
      return html(`Lovable conectado${cuenta ? ` (${cuenta})` : ""}. Ya puedes cerrar esta ventana y volver a NexDeveloper.`);
    }

    // Autenticación: cron (x-cron-token) o usuario (JWT)
    const tokenCron = req.headers.get("x-cron-token") ?? "";
    let esServicio = false; let userId: string | null = null;
    if (tokenCron) { const { data } = await sb.rpc("comprobar_cron_token", { p_token: tokenCron }); esServicio = data === true; }
    if (!esServicio) {
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: u } = await sb.auth.getUser(jwt);
      if (!u?.user) return json({ ok: false, error: "No autorizado" }, 401);
      userId = u.user.id;
    }
    const cuerpo = req.method === "POST" ? await req.json().catch(() => ({})) : Object.fromEntries(url.searchParams);
    const accion = String(cuerpo.accion ?? url.searchParams.get("accion") ?? "estado");

    switch (accion) {
      case "programado": {
        if (!esServicio) return json({ ok: false, error: "Solo el servicio" }, 403);
        return json({ ok: true, ...(await programado(sb)) });
      }
      case "equipo_probar": {
        const {data:m}=await sb.from('modelos_ia').select('id,proveedor_id,identificador,desarrollo_comprobado_el').eq('id',String(cuerpo.modelo_id??'')).eq('user_id',userId).eq('activo',true).single();
        if(!m)return json({ok:false,error:'Modelo no autorizado'},403);
        if(m.desarrollo_comprobado_el&&Date.now()-Date.parse(m.desarrollo_comprobado_el)<60000)return json({ok:false,error:'Espera un minuto antes de repetir la comprobación.'},429);
        const {data:p}=await sb.from('proveedores_ia').select('clave_slug').eq('id',m.proveedor_id).eq('user_id',userId).single();
        if(!PROVEEDORES_MOTOR.includes(p?.clave_slug))return json({ok:false,error:'Proveedor pendiente de adaptador de desarrollo'},400);
        const r=await llamarEquipo(sb,{user_id:userId},{papel:'comprobacion',modelo:{...m,proveedor:p.clave_slug}},'Prueba de conexión. Llama a terminar con resumen "Conexión verificada" y sin_cambios true. No leas ni escribas archivos.',[{role:'user',content:'Confirma la conexión con la herramienta terminar.'}],true,true);
        if(!r.content?.some((c:any)=>c.type==='tool_use'&&c.name==='terminar'))throw Error('La respuesta no confirmó el uso de herramientas');
        const {error}=await sb.from('modelos_ia').update({desarrollo_estado:'disponible',desarrollo_detalle:'Llamada real y herramienta verificadas; consumo registrado.',desarrollo_comprobado_el:ahora()}).eq('id',m.id).eq('user_id',userId);
        if(error)throw Error('Prueba realizada, no se pudo guardar su estado');
        return json({ok:true});
      }
      case "equipo_estado": {
        const {data:modelos,error}=await sb.from('modelos_ia').select('id,nombre,identificador,proveedor_id,desarrollo_estado,desarrollo_detalle,desarrollo_comprobado_el').eq('user_id',userId).eq('activo',true);
        const {data:tarifas}=await sb.from('ia_tarifas').select('modelo_id').eq('user_id',userId).gt('verificada_hasta',ahora());
        return json({ok:!error,modelos:(modelos??[]).map((m:any)=>({...m,tarifa_vigente:!!tarifas?.some((t:any)=>t.modelo_id===m.id)}))});
      }
      case "estado": {
        const { data: c } = await sb.from("lovable_conexion").select("estado, cuenta, ultimo_error, ultima_comprobacion, expira_el").eq("user_id", userId!).maybeSingle();
        const cfg = await config(sb, userId!);
        const { count: sinId } = await sb.from("proyectos").select("id", { count: "exact", head: true }).eq("user_id", userId!).is("lovable_project_id", null);
        const anthropic = !!(await claveAnthropic(sb, userId!));
        return json({ ok: true, conexion: c ?? { estado: "desconectada" }, config: cfg, proyectos_sin_lovable: sinId ?? 0, motor_claude_listo: anthropic && !!GITHUB_TOKEN, github_token: !!GITHUB_TOKEN, clave_anthropic: anthropic, url_callback: URL_CALLBACK, client_id: CLIENT_ID_DOC });
      }
      case "conectar": {
        // Lovable requires an allowlisted callback or a client metadata document for hosted clients.
        const { data: con } = await sb.from("lovable_conexion").select("user_id").eq("user_id", userId!).maybeSingle();
        if (!con) await sb.from("lovable_conexion").insert({ user_id: userId! });
        const idFinal = CLIENT_ID_DOC;
        const aviso = null;
        await sb.from("lovable_conexion").update({ client_id: idFinal, actualizado_el: ahora() }).eq("user_id", userId!);
        const verifier = aleatorio(); const state = aleatorio(24);
        await sb.from("oauth_estados").delete().eq("user_id", userId!).eq("proveedor", "lovable");
        await sb.from("oauth_estados").insert({ state, user_id: userId!, proveedor: "lovable", verifier });
        const p = new URLSearchParams({ response_type: "code", resource: "https://mcp.lovable.dev", client_id: idFinal, redirect_uri: URL_CALLBACK, scope: SCOPES, state, code_challenge: await desafio(verifier), code_challenge_method: "S256" });
        return json({ ok: true, url: `${OAUTH.authorize}?${p}`, aviso, registro_dinamico: false });
      }
      case "desconectar": {
        await sb.rpc("guardar_secreto_lovable", { p_user_id: userId!, p_refresh: "", p_acceso: "", p_expira: null }).then(() => {}, () => {});
        await sb.from("lovable_conexion").update({ estado: "desconectada", cuenta: null, actualizado_el: ahora() }).eq("user_id", userId!);
        return json({ ok: true });
      }
      case "probar": {
        // Prueba de conexión en VERDE/ROJO de los dos motores
        const salida: Record<string, any> = {};
        try { const token = await tokenAcceso(sb, userId!); const me = await herramientaLovable(token, "get_me", {}); const cuenta = me.email ?? me.user?.email ?? null; await sb.from("lovable_conexion").update({ estado: "conectada", cuenta: cuenta ?? undefined, ultimo_error: null, ultima_comprobacion: ahora() }).eq("user_id", userId!); salida.lovable = { ok: true, cuenta }; }
        catch (err) { const msg = String(err?.message ?? err); await sb.from("lovable_conexion").update({ estado: msg.includes("no está conectado") ? "desconectada" : "error", ultimo_error: msg.slice(0, 300), ultima_comprobacion: ahora() }).eq("user_id", userId!).then(() => {}, () => {}); salida.lovable = { ok: false, error: msg }; }
        try { if (!GITHUB_TOKEN) throw new Error("Falta GITHUB_TOKEN"); const u = await gh("/user"); salida.github = { ok: true, cuenta: u.login }; } catch (err) { salida.github = { ok: false, error: String(err?.message ?? err) }; }
        try { const k = await claveAnthropic(sb, userId!); if (!k) throw new Error("Sin clave de Anthropic en Ajustes → Proveedores"); const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": k, "anthropic-version": "2023-06-01" } }); if (!r.ok) throw new Error(`Anthropic ${r.status}`); salida.anthropic = { ok: true }; } catch (err) { salida.anthropic = { ok: false, error: String(err?.message ?? err) }; }
        return json({ ok: salida.lovable.ok || (salida.github.ok && salida.anthropic.ok), ...salida });
      }
      case "configurar": {
        const permitidos = ["auto_ejecutar", "auto_publicar", "comprobar_preview", "max_simultaneas", "modo_max", "aviso_creditos", "motor_preferido", "modelo_claude", "max_pasos", "max_coste_ia"];
        const cambios: Record<string, unknown> = { user_id: userId!, actualizado_el: ahora() };
        for (const k of permitidos) if (k in cuerpo) cambios[k] = cuerpo[k];
        const { data } = await sb.from("ejecucion_config").upsert(cambios).select("*").single();
        return json({ ok: true, config: data });
      }
      case "asignar_lovable": {
        const m = String(cuerpo.lovable ?? "").match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (!m) return json({ ok: false, error: "Pega el identificador del proyecto o la URL del editor de Lovable" });
        await sb.from("proyectos").update({ lovable_project_id: m[0] }).eq("id", String(cuerpo.proyecto_id)).eq("user_id", userId!);
        return json({ ok: true, lovable_project_id: m[0] });
      }
      case "ejecutar": {
        let orden: any = null;
        if (cuerpo.orden_id) { const { data } = await sb.from("ordenes").select("*").eq("id", String(cuerpo.orden_id)).eq("user_id", userId!).maybeSingle(); orden = data; if (!orden) return json({ ok: false, error: "Orden no encontrada" }); }
        else {
          if (!cuerpo.proyecto_id || !cuerpo.texto) return json({ ok: false, error: "Faltan proyecto y texto" });
          const { data } = await sb.from("ordenes").insert({ user_id: userId!, proyecto_id: String(cuerpo.proyecto_id), texto: String(cuerpo.texto), modo: "equilibrado", prioridad: cuerpo.prioridad ?? "media", estado: "aprobada", ejecutar_con: "lovable", requiere_atencion: false }).select("*").single();
          orden = data;
        }
        if (!orden.proyecto_id) return json({ ok: false, error: "La orden no tiene proyecto" });
        const cfg = await config(sb, userId!);
        const { data: p } = await sb.from("proyectos").select("repositorio, lovable_project_id").eq("id", orden.proyecto_id).maybeSingle();
        const motorPedido = cuerpo.motor && cuerpo.motor !== "auto" ? String(cuerpo.motor) : "auto";
        const motor = motorPedido !== "auto" ? motorPedido : await elegirMotor(sb, userId!, cfg, p ?? {});
        if (!motor) return json({ ok: false, error: "No hay motor disponible: conecta Lovable o pon la clave de Anthropic (y el repositorio del proyecto en su ficha)." });
        if (orden.ejecucion_id) { const { data: prev } = await sb.from("ejecuciones_orden").select("estado").eq("id", orden.ejecucion_id).maybeSingle(); if (prev && ["en_cola", "enviando", "construyendo", "comprobando", "publicando"].includes(prev.estado)) return json({ ok: false, error: "Esta orden ya se está ejecutando" }); }
        const e = await encolarOrden(sb, orden, cuerpo.modo === "planificar" ? "planificar" : "construir", motor);
        if (cuerpo.ahora !== false) await enviar(sb, e);
        const { data: fin } = await sb.from("ejecuciones_orden").select("*").eq("id", e.id).single();
        return json({ ok: true, ejecucion: fin });
      }
      case "sondear": {
        const { data: e } = await sb.from("ejecuciones_orden").select("*").eq("id", String(cuerpo.ejecucion_id)).eq("user_id", userId!).maybeSingle();
        if (!e) return json({ ok: false, error: "Ejecución no encontrada" });
        if (["construyendo", "comprobando"].includes(e.estado) && (e.motor === "claude" ? e.estado === "construyendo" : !!e.mensaje_id)) await sondear(sb, e);
        const { data: fin } = await sb.from("ejecuciones_orden").select("*").eq("id", e.id).single();
        return json({ ok: true, ejecucion: fin });
      }
      case "aprobar_publicar": {
        const { data: e } = await sb.from("ejecuciones_orden").select("*").eq("id", String(cuerpo.ejecucion_id)).eq("user_id", userId!).maybeSingle();
        if (!e) return json({ ok: false, error: "Ejecución no encontrada" });
        if (e.estado !== "esperando_aprobacion") return json({ ok: false, error: `La ejecución está en estado ${e.estado}` });
        await publicar(sb, { ...e, bloqueo_token: undefined, aprobada_el: ahora() });
        const { data: fin } = await sb.from("ejecuciones_orden").select("*").eq("id", e.id).single();
        return json({ ok: fin!.estado === "completada", ejecucion: fin, error: fin!.error });
      }
      case "rechazar": {
        const { data: e } = await sb.from("ejecuciones_orden").select("*").eq("id", String(cuerpo.ejecucion_id)).eq("user_id", userId!).maybeSingle();
        if (!e) return json({ ok: false, error: "Ejecución no encontrada" });
        if (e.motor === "claude" && e.pr_numero) { const { data: p } = await sb.from("proyectos").select("repositorio").eq("id", e.proyecto_id).maybeSingle(); try { await gh(`/repos/${p!.repositorio}/pulls/${e.pr_numero}`, { method: "PATCH", body: JSON.stringify({ state: "closed" }) }); await gh(`/repos/${p!.repositorio}/git/refs/heads/${e.rama}`, { method: "DELETE" }); } catch { /* opcional */ } }
        await actualizar(sb, e.id, { estado: "cancelada", terminada_el: ahora(), error: cuerpo.motivo ? `Rechazada: ${String(cuerpo.motivo).slice(0, 300)}` : "Rechazada por Javier" }, e.bloqueo_token);
        await sincronizarOrden(sb, e, "aprobada", `Cambios no publicados${cuerpo.motivo ? `: ${String(cuerpo.motivo).slice(0, 200)}` : ""}`);
        if (e.tarea_id) await sb.from("tareas").update({ estado: "cancelada", requiere_atencion: false, atendida_el: ahora() }).eq("id", e.tarea_id);
        return json({ ok: true });
      }
      case "cancelar": {
        const {error}=await sb.rpc('cancelar_ejecucion',{p_usuario:userId,p_ejecucion:String(cuerpo.ejecucion_id)});
        if(error)return json({ok:false,error:'No se pudo cancelar; comprueba si el trabajo ya terminó.'},409);
        return json({ok:true,aviso:'No se iniciarán más pasos. Las operaciones ya enviadas al proveedor pueden seguir y requieren conciliación.'});
      }
      case "reintentar": {
        const {data:nueva,error}=await sb.rpc("reintentar_ejecucion",{p_user_id:userId,p_ejecucion_id:String(cuerpo.ejecucion_id)});
        if(error||!nueva?.id)return json({ok:false,error:"No se puede repetir todavía. Revisa posibles efectos remotos y reservas pendientes."},409);
        await enviar(sb,nueva);
        const {data:fin,error:lectura}=await sb.from("ejecuciones_orden").select("*").eq("id",nueva.id).eq("user_id",userId).single();
        if(lectura)return json({ok:false,error:"El nuevo intento se ha guardado; no se pudo consultar su estado."},503);
        return json({ok:true,ejecucion:fin});
      }

      default:
        return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (err) {
    return json({ ok: false, error: String(err?.message ?? err) }, 500);
  }
});
