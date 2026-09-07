// NexDeveloper · Edge Function «sincronizar-proyectian» (06/09/2026, ampliada 07/09/2026)
// Mantiene Proyectian al día desde NexDeveloper sin intervención manual:
//   · versiones: lee src/lib/version.ts (o package.json) de cada repositorio en GitHub y actualiza
//     version_actual en NexDeveloper y en Proyectian; si la versión es nueva, crea la fila en «Versiones y cambios».
//   · salud: copia el semáforo de salud de NexDeveloper a Proyectian.proyectos.salud.
//   · pantallas: lee las rutas de src/routes del repositorio y da de alta las pantallas en Proyectian.
//   · reuniones: lleva a Proyectian.reuniones las grabaciones de Plaud procesadas (plaud_grabaciones).
//   · ficha: ficha única del proyecto (Proyectian manda; cambios hechos en NexDeveloper se llevan a Proyectian y se informa).
//   · pendientes: sincroniza en los dos sentidos Proyectian.pendientes <-> NexDeveloper.tareas (estados y fechas).
//   · altas (07/09): los proyectos que existen en Proyectian y no en NexDeveloper se dan de alta aquí automáticamente.
//   · documentos (07/09): espejo de Proyectian.documentos (manuales, hojas de cambios, prompts…) en documentos_nex,
//     para que la ficha de cada proyecto en NexDeveloper muestre la misma documentación que Proyectian (almacén propio).
// Escribe en Proyectian por la API de administración de Supabase (database/query) con CUENTA_SUPABASE_TOKEN.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_CUENTA = Deno.env.get("CUENTA_SUPABASE_TOKEN") ?? "";
const TOKEN_GITHUB = Deno.env.get("GITHUB_TOKEN") ?? "";
const PROYECTIAN_REF = "hjtweberlereyfhagkvx";
const RUTA_VERSION = "src/lib/version.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
type SB = ReturnType<typeof servicio>;
const ahora = () => new Date().toISOString();
const q = (v: unknown) => v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`;

// ---------- Proyectian (SQL por la API de administración) ----------
async function sqlProyectian(query: string, soloLectura = false) {
  if (!TOKEN_CUENTA) throw new Error("Falta el secreto CUENTA_SUPABASE_TOKEN");
  let r!: Response;
  for (let intento = 0; intento < 4; intento++) {
    r = await fetch(`https://api.supabase.com/v1/projects/${PROYECTIAN_REF}/database/query`, {
      method: "POST", headers: { Authorization: `Bearer ${TOKEN_CUENTA}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, read_only: soloLectura }),
    });
    if (r.status !== 429) break;
    await new Promise((res) => setTimeout(res, 1500 * (intento + 1)));
  }
  const t = await r.text();
  let j: any; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  if (!r.ok) throw new Error(`Proyectian SQL ${r.status}: ${String(j?.message ?? t).slice(0, 300)}`);
  return (Array.isArray(j) ? j : (j?.result ?? [])) as any[];
}

// ---------- GitHub ----------
async function github(ruta: string) {
  if (!TOKEN_GITHUB) throw new Error("Falta el secreto GITHUB_TOKEN");
  const r = await fetch(`https://api.github.com${ruta}`, { headers: { Authorization: `Bearer ${TOKEN_GITHUB}`, Accept: "application/vnd.github+json", "User-Agent": "nexdeveloper" } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status} ${ruta.split("?")[0]}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}
function deBase64(b64: string) { try { return new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0))); } catch { return ""; } }

async function leerVersion(repo: string) {
  const fichero = await github(`/repos/${repo}/contents/${RUTA_VERSION}`);
  if (fichero?.content) {
    const m = deBase64(fichero.content).match(/VERSION_APP\s*=\s*["']([^"']+)["']/);
    if (m) {
      const commits = await github(`/repos/${repo}/commits?path=${RUTA_VERSION}&per_page=1`);
      const c = commits?.[0];
      return { version: m[1], origen: RUTA_VERSION, sha: c?.sha ?? null, fecha: c?.commit?.author?.date ?? null, mensaje: c?.commit?.message?.split("\n")[0] ?? null };
    }
  }
  const pkg = await github(`/repos/${repo}/contents/package.json`);
  if (pkg?.content) {
    try { const v = JSON.parse(deBase64(pkg.content))?.version; if (v && String(v) !== "0.0.0") return { version: String(v), origen: "package.json", sha: null, fecha: null, mensaje: null }; } catch { /* sin version */ }
  }
  return null;
}

// ---------- Acciones ----------
async function sincronizarVersiones(sb: SB, soloProyecto?: string) {
  let qy = sb.from("proyectos").select("id, user_id, slug, nombre, repositorio, version_actual, proyectian_slug").not("repositorio", "is", null).order("nombre");
  if (soloProyecto) qy = qy.eq("id", soloProyecto);
  const { data: proyectos } = await qy;
  const salida: any[] = [];
  for (const p of proyectos ?? []) {
    const fila: any = { proyecto: p.nombre, antes: p.version_actual };
    try {
      const v = await leerVersion(p.repositorio);
      if (!v) { fila.resultado = "sin_fichero"; await sb.from("proyectos").update({ version_comprobada_el: ahora(), version_origen: "ninguno" }).eq("id", p.id); await registrar(sb, p, "versiones", false, `Sin fichero de versión en ${p.repositorio}`, fila); salida.push(fila); continue; }
      fila.ahora = v.version; fila.origen = v.origen; fila.commit = v.sha;
      const cambia = v.version !== p.version_actual;
      await sb.from("proyectos").update({ version_actual: v.version, version_commit_sha: v.sha, version_commit_el: v.fecha, version_comprobada_el: ahora(), version_origen: v.origen, ...(cambia ? { actualizado_el: ahora() } : {}) }).eq("id", p.id);
      const slug = p.proyectian_slug ?? p.slug;
      const fecha = v.fecha ? v.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const notas = `Versión detectada automáticamente en ${v.origen}${v.sha ? ` (commit ${v.sha.slice(0, 8)}${v.mensaje ? `: ${v.mensaje}` : ""})` : ""}. Sincronizado desde NexDeveloper.`;
      const res = await sqlProyectian(`
        with p as (select id, user_id, version_actual from public.proyectos where slug = ${q(slug)} limit 1),
        u as (update public.proyectos x set version_actual = ${q(v.version)}, updated_at = now() from p where x.id = p.id and x.version_actual is distinct from ${q(v.version)} returning x.id),
        v as (insert into public.versiones (user_id, proyecto_id, numero, fecha, titulo, notas_version)
              select p.user_id, p.id, ${q(v.version)}, ${q(fecha)}::date, 'Versión detectada en el código', ${q(notas)} from p
              on conflict (proyecto_id, numero) do nothing returning id)
        select (select count(*) from p) as encontrado, (select count(*) from u) as actualizado, (select count(*) from v) as version_nueva;`);
      const r = res?.[0] ?? {};
      fila.proyectian = { encontrado: Number(r.encontrado ?? 0), actualizado: Number(r.actualizado ?? 0), version_nueva: Number(r.version_nueva ?? 0) };
      fila.resultado = Number(r.encontrado ?? 0) === 0 ? "sin_ficha_en_proyectian" : (cambia || Number(r.actualizado ?? 0) ? "actualizado" : "igual");
      if (fila.resultado !== "igual") await registrar(sb, p, "versiones", fila.resultado !== "sin_ficha_en_proyectian", `${p.nombre}: ${p.version_actual ?? "—"} → ${v.version} (${fila.resultado})`, fila);
    } catch (e) { fila.resultado = "error"; fila.error = String((e as Error)?.message ?? e).slice(0, 300); await registrar(sb, p, "versiones", false, fila.error, fila); }
    salida.push(fila);
  }
  return salida;
}

async function sincronizarSalud(sb: SB) {
  const { data: proyectos } = await sb.from("proyectos").select("id, user_id, slug, nombre, proyectian_slug, semaforo_salud").in("semaforo_salud", ["verde", "ambar", "rojo"]);
  if (!proyectos?.length) return { actualizados: 0 };
  const valores = proyectos.map((p) => `(${q(p.proyectian_slug ?? p.slug)}, ${q(p.semaforo_salud)})`).join(",");
  const res = await sqlProyectian(`
    with s(slug, salud) as (values ${valores})
    update public.proyectos p set salud = s.salud, updated_at = now() from s where p.slug = s.slug and p.salud is distinct from s.salud returning p.slug, p.salud;`);
  const cambiados = (res ?? []).map((r: any) => `${r.slug} → ${r.salud}`);
  if (cambiados.length) await registrar(sb, { user_id: proyectos[0].user_id }, "salud", true, `Salud actualizada en Proyectian: ${cambiados.join(", ")}`, { cambiados });
  return { actualizados: cambiados.length, cambiados };
}

// Rutas → pantallas. Soporta TanStack Router (src/routes, ficheros y carpetas) y react-router (src/pages).
function rutaDesdeFichero(path: string): { ruta: string; nombre: string } | null {
  let p = path.replace(/^src\/routes\//, "").replace(/\.(tsx|jsx|ts)$/, "");
  if (/(^|\/)(__root|route|-[^/]*)$/.test(p) || /\/-/.test(p) || p.startsWith("-")) return null;
  const segs = p.split(/[\/.]/).filter(Boolean).filter((s) => !s.startsWith("_") && s !== "index" && !/^\(.*\)$/.test(s));
  const ruta = "/" + segs.map((s) => s.startsWith("$") ? `:${s.slice(1)}` : s).join("/");
  const ultimo = segs.filter((s) => !s.startsWith("$")).pop() ?? "inicio";
  const nombre = ultimo.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return { ruta: ruta === "/" ? "/" : ruta.replace(/\/+/g, "/"), nombre };
}

async function sincronizarPantallas(sb: SB, soloProyecto?: string) {
  let qy = sb.from("proyectos").select("id, user_id, slug, nombre, repositorio, proyectian_slug").not("repositorio", "is", null).order("nombre");
  if (soloProyecto) qy = qy.eq("id", soloProyecto);
  const { data: proyectos } = await qy;
  const salida: any[] = [];
  for (const p of proyectos ?? []) {
    const fila: any = { proyecto: p.nombre };
    try {
      const arbol = await github(`/repos/${p.repositorio}/git/trees/main?recursive=1`);
      const ficheros: string[] = (arbol?.tree ?? []).filter((n: any) => n.type === "blob").map((n: any) => n.path);
      let rutas = ficheros.filter((f) => f.startsWith("src/routes/") && /\.(tsx|jsx)$/.test(f)).map(rutaDesdeFichero).filter(Boolean) as { ruta: string; nombre: string }[];
      if (!rutas.length) rutas = ficheros.filter((f) => f.startsWith("src/pages/") && /\.(tsx|jsx)$/.test(f)).map((f) => rutaDesdeFichero(f.replace("src/pages/", "src/routes/"))).filter(Boolean) as { ruta: string; nombre: string }[];
      const unicas = new Map<string, string>(); for (const r of rutas) if (!unicas.has(r.ruta)) unicas.set(r.ruta, r.nombre);
      fila.rutas = unicas.size;
      if (!unicas.size) { fila.resultado = "sin_rutas"; salida.push(fila); continue; }
      const slug = p.proyectian_slug ?? p.slug;
      const valores = [...unicas.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ruta, nombre], i) => `(${q(ruta)}, ${q(nombre)}, ${i + 1})`).join(",");
      const res = await sqlProyectian(`
        with p as (select id, user_id from public.proyectos where slug = ${q(slug)} limit 1),
        r(ruta, nombre, orden) as (values ${valores}),
        ins as (insert into public.pantallas (user_id, proyecto_id, nombre, ruta, descripcion, orden)
                select p.user_id, p.id, r.nombre, r.ruta, 'Detectada en el código (src/routes). Sincronizado desde NexDeveloper.', r.orden from p, r
                on conflict (proyecto_id, ruta) do update set orden = excluded.orden returning (xmax = 0) as nueva)
        select (select count(*) from p) as encontrado, count(*) filter (where nueva) as nuevas, count(*) filter (where not nueva) as existentes from ins;`);
      const r = res?.[0] ?? {};
      fila.proyectian = { encontrado: Number(r.encontrado ?? 0), nuevas: Number(r.nuevas ?? 0), existentes: Number(r.existentes ?? 0) };
      fila.resultado = Number(r.encontrado ?? 0) === 0 ? "sin_ficha_en_proyectian" : "ok";
      if (Number(r.nuevas ?? 0) > 0 || fila.resultado !== "ok") await registrar(sb, p, "pantallas", fila.resultado === "ok", `${p.nombre}: ${r.nuevas} pantallas nuevas, ${r.existentes} ya existían (${unicas.size} rutas en el código)`, fila);
    } catch (e) { fila.resultado = "error"; fila.error = String((e as Error)?.message ?? e).slice(0, 300); await registrar(sb, p, "pantallas", false, fila.error, fila); }
    salida.push(fila);
  }
  return salida;
}

// Reuniones: lleva a Proyectian las grabaciones de Plaud ya procesadas por NexDeveloper (plaud_grabaciones con proyecto).
async function sincronizarReuniones(sb: SB) {
  const { data: grabs } = await sb.from("plaud_grabaciones").select("id, user_id, plaud_id, nombre, fecha, duracion_seg, resumen, destacados, estado, proyecto_id, proyectos(slug, proyectian_slug)").eq("estado", "procesada").not("proyecto_id", "is", null).order("fecha", { ascending: false }).limit(60);
  if (!grabs?.length) return { revisadas: 0, nuevas: 0 };
  const filas = grabs.map((g: any) => {
    const d = (g.destacados && typeof g.destacados === "object") ? g.destacados : {};
    const lista = (v: unknown) => Array.isArray(v) && v.length ? v.map((x) => `• ${String(x)}`).join("\n") : null;
    const etiquetas = Array.isArray(d.etiquetas) ? d.etiquetas.map((x: unknown) => String(x)) : [];
    return `(${q(g.plaud_id)}, ${q(g.proyectos?.proyectian_slug ?? g.proyectos?.slug)}, ${q(g.nombre)}, ${q(g.fecha)}::timestamptz, ${Number(g.duracion_seg ?? 0)}, ${q(g.resumen)}, ${q(lista(d.acuerdos))}, ${q(lista(d.cambios_solicitados))}, array[${etiquetas.map(q).join(",")}]::text[])`;
  }).join(",\n");
  const res = await sqlProyectian(`
    insert into public.reuniones (user_id, proyecto_id, origen, origen_id, titulo, fecha, duracion_seg, resumen, acuerdos, cambios_solicitados, estado, etiquetas, audio_url, notas)
    select p.user_id, p.id, 'plaud', r.plaud_id, r.titulo, r.fecha, r.dur, r.resumen, r.acuerdos, r.cambios, 'procesada', r.etiquetas, 'https://web.plaud.ai/file/' || r.plaud_id, 'Importada desde Plaud por NexDeveloper.'
    from (values ${filas}) as r(plaud_id, slug, titulo, fecha, dur, resumen, acuerdos, cambios, etiquetas)
    join public.proyectos p on p.slug = r.slug
    on conflict (user_id, origen, origen_id) do nothing
    returning titulo;`);
  const nuevas = (res ?? []).map((r: any) => r.titulo);
  if (nuevas.length) await registrar(sb, { user_id: grabs[0].user_id }, "reuniones", true, `${nuevas.length} reunión(es) nueva(s) en Proyectian: ${nuevas.slice(0, 5).join(" · ")}`, { nuevas });
  return { revisadas: grabs.length, nuevas: nuevas.length };
}

// ---------- Pendientes (Proyectian) <-> Tareas (NexDeveloper), en los dos sentidos ----------
// Estados: pendiente<->pendiente/en_cola/esperando_revision/bloqueada · haciendo<->ejecutando · hecho<->completada · descartado<->cancelada · pospuesto<->pausada
const A_NEX: Record<string, string> = { pendiente: "pendiente", haciendo: "ejecutando", hecho: "completada", descartado: "cancelada", pospuesto: "pausada" };
const A_PY: Record<string, string> = { pendiente: "pendiente", en_cola: "pendiente", esperando_revision: "pendiente", bloqueada: "pendiente", ejecutando: "haciendo", completada: "hecho", cancelada: "descartado", pausada: "pospuesto" };
const fechaSql = (v: unknown) => v ? `${q(String(v))}::timestamptz` : "null::timestamptz";
const diaSql = (v: unknown) => v ? `${q(String(v).slice(0, 10))}::date` : "null::date";

async function sincronizarPendientes(sb: SB) {
  const { data: nexProys } = await sb.from("proyectos").select("id, slug, proyectian_slug, user_id");
  const py = await sqlProyectian("select id, slug, user_id from public.proyectos", true);
  const pyPorSlug = new Map<string, any>((py ?? []).map((p: any) => [p.slug, p]));
  const nexPorPyId = new Map<string, any>(); const pyIdPorNex = new Map<string, any>();
  for (const n of nexProys ?? []) { const p = pyPorSlug.get(n.proyectian_slug ?? n.slug); if (p) { nexPorPyId.set(p.id, n); pyIdPorNex.set(n.id, p); } }
  const salida = { proyectian_a_nex: { creadas: 0, actualizadas: 0, omitidas: 0 }, nex_a_proyectian: { creados: 0, actualizados: 0, omitidos: 0 }, errores: [] as string[] };

  // 1) Proyectian → NexDeveloper (pocas llamadas a Proyectian: una lectura y una escritura por lote)
  const cambiosPy = await sqlProyectian(`select id, proyecto_id, tipo, titulo, descripcion, prompt, prioridad, estado, fecha_objetivo, fecha_cierre, fecha_inicio, fecha_pospuesto_hasta, motivo_estado, nex_tarea_id, created_at, updated_at, sincronizado_el
    from public.pendientes where sincronizado_el is null or updated_at > sincronizado_el order by created_at limit 200`, true);
  const idsPy = (cambiosPy ?? []).map((p: any) => p.id);
  const { data: tareasEnlazadas } = idsPy.length ? await sb.from("tareas").select("id, estado, actualizado_el, sincronizado_el, proyectian_pendiente_id").in("proyectian_pendiente_id", idsPy) : { data: [] as any[] };
  const tareaPorPendiente = new Map<string, any>((tareasEnlazadas ?? []).map((t: any) => [t.proyectian_pendiente_id, t]));
  const enlaces: { pendiente_id: string; tarea_id: string | null }[] = [];
  for (const p of cambiosPy ?? []) {
    try {
      const n = nexPorPyId.get(p.proyecto_id);
      if (!n) { salida.proyectian_a_nex.omitidas++; continue; }
      let t = tareaPorPendiente.get(p.id);
      if (!t && p.nex_tarea_id) { const r = await sb.from("tareas").select("id, estado, actualizado_el, sincronizado_el").eq("id", p.nex_tarea_id).maybeSingle(); t = r.data ?? undefined; }
      if (t) {
        if (t.sincronizado_el && new Date(t.actualizado_el).getTime() - new Date(t.sincronizado_el).getTime() > 3000) { salida.proyectian_a_nex.omitidas++; continue; } // NexDeveloper tiene cambios sin llevar: manda él (paso 2)
        const mismoGrupo = A_PY[t.estado] === p.estado;
        const { error } = await sb.from("tareas").update({ titulo: p.titulo, descripcion: p.descripcion, instrucciones: p.prompt ?? undefined, prioridad: p.prioridad ?? "media", estado: mismoGrupo ? t.estado : (A_NEX[p.estado] ?? "pendiente"), pausada_hasta: p.fecha_pospuesto_hasta, motivo_estado: p.motivo_estado, completada_el: p.estado === "hecho" ? (p.fecha_cierre ?? ahora()) : null, proyectian_pendiente_id: p.id, sincronizado_el: ahora() }).eq("id", t.id);
        if (error) throw new Error(error.message);
        salida.proyectian_a_nex.actualizadas++;
        enlaces.push({ pendiente_id: p.id, tarea_id: t.id });
      } else {
        const { data: nt, error } = await sb.from("tareas").insert({ user_id: n.user_id, proyecto_id: n.id, titulo: p.titulo, descripcion: p.descripcion, instrucciones: p.prompt, prioridad: p.prioridad ?? "media", estado: A_NEX[p.estado] ?? "pendiente", pausada_hasta: p.fecha_pospuesto_hasta, motivo_estado: p.motivo_estado, origen: "proyectian", proyectian_pendiente_id: p.id, creado_el: p.created_at, ...(p.fecha_inicio ? { enviada_el: p.fecha_inicio } : {}), completada_el: p.estado === "hecho" ? (p.fecha_cierre ?? p.updated_at) : null, cancelada_el: p.estado === "descartado" ? (p.fecha_cierre ?? p.updated_at) : null, sincronizado_el: ahora() }).select("id").single();
        if (error) throw new Error(error.message);
        salida.proyectian_a_nex.creadas++;
        enlaces.push({ pendiente_id: p.id, tarea_id: nt!.id });
      }
    } catch (e) { salida.errores.push(`Pendiente ${p.titulo}: ${String((e as Error)?.message ?? e).slice(0, 150)}`); }
  }
  if (enlaces.length) {
    const valores = enlaces.map((e) => `(${q(e.pendiente_id)}::uuid, ${q(e.tarea_id)}::uuid)`).join(",");
    await sqlProyectian(`update public.pendientes p set nex_tarea_id = v.tarea_id, sincronizado_el = now() from (values ${valores}) as v(pendiente_id, tarea_id) where p.id = v.pendiente_id`);
  }

  // 2) NexDeveloper → Proyectian (una sola escritura por lote)
  const { data: tareas } = await sb.from("tareas").select("id, user_id, proyecto_id, titulo, descripcion, instrucciones, prioridad, estado, enviada_el, completada_el, cancelada_el, pausada_hasta, motivo_estado, proyectian_pendiente_id, creado_el, actualizado_el, sincronizado_el").or(`sincronizado_el.is.null,actualizado_el.gte.${new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()}`).order("creado_el").limit(400);
  const pendientesDeNex = (tareas ?? []).filter((t: any) => !t.sincronizado_el || new Date(t.actualizado_el).getTime() - new Date(t.sincronizado_el).getTime() > 3000);
  const filasUpd: string[] = []; const filasIns: string[] = []; const idsTareas: string[] = [];
  for (const t of pendientesDeNex) {
    const p = pyIdPorNex.get(t.proyecto_id);
    if (!p) { salida.nex_a_proyectian.omitidos++; continue; }
    const estadoPy = A_PY[t.estado] ?? "pendiente";
    const cierre = estadoPy === "hecho" ? (t.completada_el ?? ahora()) : estadoPy === "descartado" ? (t.cancelada_el ?? ahora()) : null;
    idsTareas.push(t.id);
    const comunes = `${q(t.titulo)}::text, ${q(t.descripcion)}::text, ${q(t.instrucciones)}::text, ${q(t.prioridad ?? "media")}::text, ${q(estadoPy)}::text, ${fechaSql(t.enviada_el)}, ${diaSql(cierre)}, ${diaSql(t.pausada_hasta)}, ${q(t.motivo_estado)}::text`;
    if (t.proyectian_pendiente_id) filasUpd.push(`(${q(t.proyectian_pendiente_id)}::uuid, ${comunes})`);
    else filasIns.push(`(${q(p.user_id)}::uuid, ${q(p.id)}::uuid, ${q(t.id)}::uuid, ${fechaSql(t.creado_el)}, ${comunes})`);
  }
  try {
    if (filasUpd.length) {
      const r = await sqlProyectian(`update public.pendientes p set titulo = v.titulo, descripcion = v.descripcion, prompt = coalesce(v.prompt, p.prompt), prioridad = v.prioridad, estado = v.estado, fecha_inicio = coalesce(v.fecha_inicio, p.fecha_inicio), fecha_cierre = v.fecha_cierre, fecha_pospuesto_hasta = v.pospuesto, motivo_estado = v.motivo, sincronizado_el = now()
        from (values ${filasUpd.join(",")}) as v(id, titulo, descripcion, prompt, prioridad, estado, fecha_inicio, fecha_cierre, pospuesto, motivo) where p.id = v.id returning p.id`);
      salida.nex_a_proyectian.actualizados = (r ?? []).length;
    }
    if (filasIns.length) {
      const r = await sqlProyectian(`insert into public.pendientes (user_id, proyecto_id, nex_tarea_id, created_at, titulo, descripcion, prompt, prioridad, estado, fecha_inicio, fecha_cierre, fecha_pospuesto_hasta, motivo_estado, tipo, origen, sincronizado_el)
        select v.user_id, v.proyecto_id, v.nex_tarea_id, coalesce(v.created_at, now()), v.titulo, v.descripcion, v.prompt, v.prioridad, v.estado, v.fecha_inicio, v.fecha_cierre, v.pospuesto, v.motivo, 'tarea', 'nexdeveloper', now()
        from (values ${filasIns.join(",")}) as v(user_id, proyecto_id, nex_tarea_id, created_at, titulo, descripcion, prompt, prioridad, estado, fecha_inicio, fecha_cierre, pospuesto, motivo)
        on conflict (nex_tarea_id) where nex_tarea_id is not null do update set sincronizado_el = now() returning id, nex_tarea_id`);
      for (const f of r ?? []) { await sb.from("tareas").update({ proyectian_pendiente_id: f.id, sincronizado_el: ahora() }).eq("id", f.nex_tarea_id); }
      salida.nex_a_proyectian.creados = (r ?? []).length;
    }
    if (idsTareas.length) await sb.from("tareas").update({ sincronizado_el: ahora() }).in("id", idsTareas);
  } catch (e) { salida.errores.push(`NexDeveloper → Proyectian: ${String((e as Error)?.message ?? e).slice(0, 200)}`); }

  const total = salida.proyectian_a_nex.creadas + salida.proyectian_a_nex.actualizadas + salida.nex_a_proyectian.creados + salida.nex_a_proyectian.actualizados;
  if (total || salida.errores.length) await registrar(sb, { user_id: (nexProys ?? [])[0]?.user_id }, "pendientes", salida.errores.length === 0, `Pendientes: ${salida.proyectian_a_nex.creadas} tareas creadas y ${salida.proyectian_a_nex.actualizadas} actualizadas en NexDeveloper; ${salida.nex_a_proyectian.creados} pendientes creados y ${salida.nex_a_proyectian.actualizados} actualizados en Proyectian${salida.errores.length ? `; ${salida.errores.length} errores` : ""}`, salida);
  return salida;
}

// ---------- Ficha única del proyecto: Proyectian manda; lo que se cambie en NexDeveloper se lleva a Proyectian y se informa ----------
const idLovable = (u: unknown) => (String(u ?? "").match(/projects\/([0-9a-f-]{36})/i) ?? [])[1] ?? null;
const repoGithub = (u: unknown) => (String(u ?? "").match(/github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?(?:\/|$)/i) ?? [])[1] ?? null;
const refSupabase = (u: unknown) => (String(u ?? "").match(/([a-z]{20})\.supabase\.co|project\/([a-z]{20})/i) ?? []).slice(1).find(Boolean) ?? null;

const SQL_FICHAS_PY = `select p.id, p.slug, p.user_id, p.nombre, p.descripcion_corta, p.url_produccion, p.version_actual, pc.project_ref,
      (select url from public.proyecto_enlaces e where e.proyecto_id = p.id and e.tipo = 'editor' order by orden limit 1) as editor,
      (select url from public.proyecto_enlaces e where e.proyecto_id = p.id and e.tipo = 'codigo' order by orden limit 1) as codigo,
      (select url from public.proyecto_enlaces e where e.proyecto_id = p.id and e.tipo = 'backend' order by orden limit 1) as backend,
      (select url from public.proyecto_enlaces e where e.proyecto_id = p.id and e.tipo = 'produccion' order by orden limit 1) as produccion
    from public.proyectos p left join public.proyecto_conexiones pc on pc.proyecto_id = p.id`;

// Altas: proyectos que existen en Proyectian y todavía no en NexDeveloper se crean aquí con su ficha (slug, nombre, enlaces, versión).
async function sincronizarAltas(sb: SB) {
  const py = await sqlProyectian(SQL_FICHAS_PY, true);
  const { data: nex } = await sb.from("proyectos").select("id, user_id, slug, proyectian_slug");
  const existentes = new Set<string>(); for (const n of nex ?? []) { existentes.add(n.slug); if (n.proyectian_slug) existentes.add(n.proyectian_slug); }
  const dueno = (nex ?? [])[0]?.user_id ?? null;
  const salida = { creados: [] as string[], errores: [] as string[] };
  if (!dueno) return salida;
  for (const p of py ?? []) {
    if (existentes.has(p.slug)) continue;
    try {
      const { error } = await sb.from("proyectos").insert({ user_id: dueno, slug: p.slug, proyectian_slug: p.slug, nombre: p.nombre, descripcion: p.descripcion_corta, repositorio: repoGithub(p.codigo), lovable_project_id: idLovable(p.editor), supabase_ref: p.project_ref ?? refSupabase(p.backend), version_actual: p.version_actual, version_origen: "proyectian", ficha_sincronizada_el: ahora() });
      if (error) throw new Error(error.message);
      salida.creados.push(p.nombre);
    } catch (e) { salida.errores.push(`${p.nombre}: ${String((e as Error)?.message ?? e).slice(0, 150)}`); }
  }
  if (salida.creados.length || salida.errores.length) await registrar(sb, { user_id: dueno }, "altas", salida.errores.length === 0, `Proyectos dados de alta desde Proyectian: ${salida.creados.join(", ") || "ninguno"}${salida.errores.length ? `; ${salida.errores.length} errores` : ""}`, salida);
  return salida;
}

// Documentos: espejo de Proyectian.documentos (almacén propio) en documentos_nex, para que cada ficha de NexDeveloper enseñe la misma documentación.
const MIME: Record<string, string> = { pdf: "application/pdf", md: "text/markdown", txt: "text/plain", sql: "application/sql", html: "text/html", json: "application/json", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", mp4: "video/mp4", zip: "application/zip" };
async function sincronizarDocumentos(sb: SB) {
  const { data: nex } = await sb.from("proyectos").select("id, user_id, slug, proyectian_slug");
  const nexPorSlug = new Map<string, any>(); for (const n of nex ?? []) nexPorSlug.set(n.proyectian_slug ?? n.slug, n);
  const docs = await sqlProyectian(`select d.id, p.slug, d.tipo, d.titulo, d.version, d.descripcion, d.archivo_path, d.url_externa, d.bytes, d.fecha, d.created_at, d.ruta_mac, d.ruta_remota, d.es_carpeta
    from public.documentos d join public.proyectos p on p.id = d.proyecto_id where coalesce(d.es_carpeta, false) = false order by d.created_at desc limit 1000`, true);
  const filas: any[] = []; let omitidos = 0;
  for (const d of docs ?? []) {
    const n = nexPorSlug.get(d.slug); if (!n) { omitidos++; continue; }
    const ruta = d.ruta_remota ?? d.archivo_path ?? d.url_externa ?? "";
    const nombre = String(ruta).split("/").pop() || String(d.titulo);
    const ext = (nombre.match(/\.([a-z0-9]+)$/i) ?? [])[1]?.toLowerCase() ?? "";
    filas.push({ proyectian_documento_id: d.id, user_id: n.user_id, proyecto_id: n.id, tipo: d.tipo ?? "documento", titulo: d.titulo, version: d.version, nombre_archivo: nombre, mime: MIME[ext] ?? null, bytes: d.bytes ?? null, ruta_remota: d.ruta_remota ?? d.url_externa ?? d.archivo_path, ruta_mac: d.ruta_mac, origen: "proyectian", creado_el: d.created_at ?? (d.fecha ? `${d.fecha}T00:00:00Z` : ahora()) });
  }
  const salida = { revisados: (docs ?? []).length, espejados: 0, omitidos, errores: [] as string[] };
  for (let i = 0; i < filas.length; i += 200) {
    const { error, count } = await sb.from("documentos_nex").upsert(filas.slice(i, i + 200), { onConflict: "proyectian_documento_id", count: "exact" });
    if (error) salida.errores.push(error.message.slice(0, 200)); else salida.espejados += count ?? 0;
  }
  // Documentos borrados en Proyectian se retiran también del espejo
  const idsPy = new Set((docs ?? []).map((d: any) => d.id));
  const { data: espejo } = await sb.from("documentos_nex").select("id, proyectian_documento_id").eq("origen", "proyectian").not("proyectian_documento_id", "is", null);
  const huerfanos = (espejo ?? []).filter((e: any) => !idsPy.has(e.proyectian_documento_id)).map((e: any) => e.id);
  if (huerfanos.length && (docs ?? []).length) await sb.from("documentos_nex").delete().in("id", huerfanos);
  const { data: anterior } = await sb.from("proyectian_sync").select("detalle").eq("tipo", "documentos").order("creado_el", { ascending: false }).limit(1).maybeSingle();
  const antes = Number((anterior?.detalle as any)?.espejados ?? -1);
  if (antes !== salida.espejados || huerfanos.length || salida.errores.length) await registrar(sb, { user_id: (nex ?? [])[0]?.user_id }, "documentos", salida.errores.length === 0, `Documentación: ${salida.espejados} documentos de Proyectian reflejados en NexDeveloper${huerfanos.length ? `, ${huerfanos.length} retirados` : ""}${omitidos ? `, ${omitidos} de proyectos sin ficha` : ""}${salida.errores.length ? `; errores: ${salida.errores.join(" · ")}` : ""}`, { ...salida, retirados: huerfanos.length });
  return { ...salida, retirados: huerfanos.length };
}

async function sincronizarFicha(sb: SB) {
  const py = await sqlProyectian(SQL_FICHAS_PY, true);
  const pyPorSlug = new Map<string, any>((py ?? []).map((p: any) => [p.slug, p]));
  const { data: nex } = await sb.from("proyectos").select("id, user_id, slug, proyectian_slug, nombre, descripcion, repositorio, supabase_ref, lovable_project_id, actualizado_el, ficha_sincronizada_el");
  const salida = { a_nexdeveloper: [] as string[], a_proyectian: [] as string[], errores: [] as string[] };
  const sqlPy: string[] = [];
  for (const n of nex ?? []) {
    const p = pyPorSlug.get(n.proyectian_slug ?? n.slug);
    if (!p) continue;
    try {
      const nexCambio = Boolean(n.ficha_sincronizada_el) && new Date(n.actualizado_el).getTime() - new Date(n.ficha_sincronizada_el).getTime() > 3000;
      const pyLovable = idLovable(p.editor); const pyRepo = repoGithub(p.codigo); const pyRef = p.project_ref ?? refSupabase(p.backend);
      const vacio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
      // Decide por campo: si un lado está vacío se rellena del otro; si los dos tienen valor y difieren, manda Proyectian salvo que NexDeveloper haya cambiado después de la última sincronización.
      const decidir = (valPy: any, valNex: any) => { if (vacio(valPy) && !vacio(valNex)) return { aPy: valNex }; if (!vacio(valPy) && vacio(valNex)) return { aNex: valPy }; if (!vacio(valPy) && !vacio(valNex) && String(valPy) !== String(valNex)) return nexCambio ? { aPy: valNex } : { aNex: valPy }; return {}; };
      const cambiosNex: Record<string, unknown> = {}; const cambiosPy: string[] = []; const enlacesPy: { tipo: string; etiqueta: string; url: string }[] = [];
      let d = decidir(p.nombre, n.nombre); if (d.aNex) cambiosNex.nombre = d.aNex; if (d.aPy) cambiosPy.push(`nombre = ${q(d.aPy)}`);
      d = decidir(p.descripcion_corta, n.descripcion); if (d.aNex) cambiosNex.descripcion = d.aNex; if (d.aPy) cambiosPy.push(`descripcion_corta = ${q(String(d.aPy).slice(0, 500))}`);
      d = decidir(pyRepo, n.repositorio); if (d.aNex) cambiosNex.repositorio = d.aNex; if (d.aPy) enlacesPy.push({ tipo: "codigo", etiqueta: "Repositorio en GitHub", url: `https://github.com/${d.aPy}` });
      d = decidir(pyLovable, n.lovable_project_id); if (d.aNex) cambiosNex.lovable_project_id = d.aNex; if (d.aPy) enlacesPy.push({ tipo: "editor", etiqueta: "Proyecto en Lovable", url: `https://lovable.dev/projects/${d.aPy}` });
      d = decidir(pyRef, n.supabase_ref); if (d.aNex) cambiosNex.supabase_ref = d.aNex; if (d.aPy) { enlacesPy.push({ tipo: "backend", etiqueta: "Panel de Supabase", url: `https://supabase.com/dashboard/project/${d.aPy}` }); sqlPy.push(`update public.proyecto_conexiones set project_ref = ${q(d.aPy)} where proyecto_id = ${q(p.id)} and project_ref is distinct from ${q(d.aPy)}`); }
      if (Object.keys(cambiosNex).length) {
        const { error } = await sb.from("proyectos").update({ ...cambiosNex, ficha_sincronizada_el: ahora() }).eq("id", n.id);
        if (error) throw new Error(error.message);
        salida.a_nexdeveloper.push(`${n.nombre}: ${Object.keys(cambiosNex).join(", ")}`);
      } else await sb.from("proyectos").update({ ficha_sincronizada_el: ahora() }).eq("id", n.id);
      if (cambiosPy.length) sqlPy.push(`update public.proyectos set ${cambiosPy.join(", ")}, updated_at = now() where id = ${q(p.id)}`);
      for (const e of enlacesPy) sqlPy.push(`insert into public.proyecto_enlaces (user_id, proyecto_id, tipo, etiqueta, url, orden) select ${q(p.user_id)}, ${q(p.id)}, ${q(e.tipo)}, ${q(e.etiqueta)}, ${q(e.url)}, coalesce((select max(orden) from public.proyecto_enlaces where proyecto_id = ${q(p.id)}), 0) + 1 where not exists (select 1 from public.proyecto_enlaces where proyecto_id = ${q(p.id)} and tipo = ${q(e.tipo)} and url = ${q(e.url)})`);
      if (cambiosPy.length || enlacesPy.length) salida.a_proyectian.push(`${n.nombre}: ${[...cambiosPy.map((c) => c.split(" =")[0]), ...enlacesPy.map((e) => e.tipo)].join(", ")}${nexCambio ? " (cambiado en NexDeveloper)" : " (rellenado desde NexDeveloper)"}`);
    } catch (e) { salida.errores.push(`${n.nombre}: ${String((e as Error)?.message ?? e).slice(0, 150)}`); }
  }
  if (sqlPy.length) { try { await sqlProyectian(sqlPy.join(";\n")); } catch (e) { salida.errores.push(`Escritura en Proyectian: ${String((e as Error)?.message ?? e).slice(0, 200)}`); } }
  if (salida.a_nexdeveloper.length || salida.a_proyectian.length || salida.errores.length) {
    const resumen = [salida.a_proyectian.length ? `Informado a Proyectian: ${salida.a_proyectian.join(" · ")}` : "", salida.a_nexdeveloper.length ? `Actualizado en NexDeveloper: ${salida.a_nexdeveloper.join(" · ")}` : "", salida.errores.length ? `${salida.errores.length} errores` : ""].filter(Boolean).join(" | ");
    await registrar(sb, { user_id: (nex ?? [])[0]?.user_id }, "ficha", salida.errores.length === 0, resumen, salida);
  }
  return salida;
}

async function registrar(sb: SB, p: any, tipo: string, ok: boolean, resumen: string, detalle: unknown) {
  await sb.from("proyectian_sync").insert({ user_id: p.user_id, proyecto_id: p.id ?? null, tipo, ok, resumen: resumen.slice(0, 500), detalle });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = servicio();
  try {
    const tokenCron = req.headers.get("x-cron-token") ?? "";
    let autorizado = false;
    if (tokenCron) { const { data } = await sb.rpc("comprobar_cron_token", { p_token: tokenCron }); autorizado = data === true; }
    if (!autorizado) {
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: u } = await sb.auth.getUser(jwt);
      autorizado = Boolean(u?.user);
    }
    if (!autorizado) return json({ ok: false, error: "No autorizado" }, 401);
    const cuerpo = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const accion = String(cuerpo.accion ?? "todo");
    const proyectoId = cuerpo.proyecto_id ? String(cuerpo.proyecto_id) : undefined;
    const salida: Record<string, unknown> = { ok: true, accion };
    if (accion === "diagnostico") {
      // Estado de cada repositorio: existe, último commit, si tiene fichero de versión. Sirve para ver qué proyectos no están sincronizados con GitHub.
      const { data: proyectos } = await sb.from("proyectos").select("id, nombre, repositorio, version_actual").not("repositorio", "is", null).order("nombre");
      const filas: any[] = [];
      for (const p of proyectos ?? []) {
        try {
          const repo = await github(`/repos/${p.repositorio}`);
          if (!repo) { filas.push({ proyecto: p.nombre, repositorio: p.repositorio, existe: false }); continue; }
          const commits = await github(`/repos/${p.repositorio}/commits?per_page=1`);
          const c = commits?.[0];
          const ver = await github(`/repos/${p.repositorio}/contents/${RUTA_VERSION}`);
          filas.push({ proyecto: p.nombre, repositorio: p.repositorio, existe: true, privado: repo.private, ultimo_commit: c?.commit?.author?.date ?? null, mensaje: c?.commit?.message?.split("\n")[0] ?? null, tiene_version_ts: Boolean(ver?.content) });
        } catch (e) { filas.push({ proyecto: p.nombre, repositorio: p.repositorio, error: String((e as Error)?.message ?? e).slice(0, 200) }); }
      }
      return json({ ok: true, repositorios: filas });
    }
    if (accion === "probar") {
      const gh = await github("/user"); const py = await sqlProyectian("select count(*) as proyectos from public.proyectos", true);
      return json({ ok: true, github: gh?.login ?? null, proyectian_proyectos: Number(py?.[0]?.proyectos ?? 0) });
    }
    if (["todo", "altas", "versiones_salud", "documentos"].includes(accion)) salida.altas = await sincronizarAltas(sb);
    if (["todo", "versiones", "versiones_salud"].includes(accion)) salida.versiones = await sincronizarVersiones(sb, proyectoId);
    if (["todo", "salud", "versiones_salud"].includes(accion)) salida.salud = await sincronizarSalud(sb);
    if (["todo", "pantallas"].includes(accion)) salida.pantallas = await sincronizarPantallas(sb, proyectoId);
    if (["todo", "reuniones", "versiones_salud"].includes(accion)) salida.reuniones = await sincronizarReuniones(sb);
    if (["todo", "pendientes"].includes(accion)) salida.pendientes = await sincronizarPendientes(sb);
    if (["todo", "ficha", "versiones_salud"].includes(accion)) salida.ficha = await sincronizarFicha(sb);
    if (["todo", "documentos", "versiones_salud"].includes(accion)) salida.documentos = await sincronizarDocumentos(sb);
    return json(salida);
  } catch (err) { return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500); }
});
