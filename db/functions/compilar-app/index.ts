// NexDeveloper · Edge Function «compilar-app» (0.10.0)
// Compila APK/AAB, iOS, escritorio y web con GitHub Actions sin intervención humana.
// Acciones (sesión de usuario): detectar, preparar, lanzar, sincronizar, descargar, guardar_secretos_repo, cancelar
// Acción de servicio (x-cron-token): sincronizar
import { createClient } from "npm:@supabase/supabase-js@2";
import sodium from "npm:libsodium-wrappers@0.7.13";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_GITHUB = Deno.env.get("GITHUB_TOKEN") ?? "";
const API = "https://api.github.com";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const servicio = () => createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });
const cab = () => ({ Authorization: `Bearer ${TOKEN_GITHUB}`, Accept: "application/vnd.github+json", "User-Agent": "NexDeveloper", "Content-Type": "application/json" });
const gh = (ruta: string, init?: RequestInit) => fetch(`${API}${ruta}`, { ...init, headers: { ...cab(), ...(init?.headers ?? {}) } });
const enB64 = (t: string) => btoa(unescape(encodeURIComponent(t)));

// ---------- S3 (almacén propio) ----------
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string | Uint8Array) => hex(await crypto.subtle.digest("SHA-256", typeof s === "string" ? enc.encode(s) : s));
async function hmac(key: ArrayBuffer | Uint8Array, msg: string) { const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return crypto.subtle.sign("HMAC", k, enc.encode(msg)); }
const codificar = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const codClave = (k: string) => k.split("/").map(codificar).join("/");
const fechaAmz = () => { const iso = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); return { larga: iso, corta: iso.slice(0, 8) }; };
type Destino = { endpoint: string; region: string; bucket: string; prefijo: string; access: string; secret: string };
async function claveFirma(d: Destino, corta: string) { const a = await hmac(enc.encode("AWS4" + d.secret), corta); const b = await hmac(a, d.region); const c = await hmac(b, "s3"); return hmac(c, "aws4_request"); }
async function s3put(d: Destino, clave: string, cuerpo: Uint8Array, tipo: string) {
  const u = new URL(d.endpoint); const host = u.host; const { larga, corta } = fechaAmz(); const ruta = `/${d.bucket}/${codClave(clave)}`;
  const hashCuerpo = await sha256(cuerpo);
  const cabs: Record<string, string> = { "content-type": tipo, host, "x-amz-content-sha256": hashCuerpo, "x-amz-date": larga };
  const firmadas = Object.keys(cabs).sort();
  const canon = ["PUT", ruta, "", firmadas.map((k) => `${k}:${cabs[k]}\n`).join(""), firmadas.join(";"), hashCuerpo].join("\n");
  const aFirmar = ["AWS4-HMAC-SHA256", larga, `${corta}/${d.region}/s3/aws4_request`, await sha256(canon)].join("\n");
  const firma = hex(await hmac(await claveFirma(d, corta), aFirmar));
  const headers: Record<string, string> = { ...cabs, Authorization: `AWS4-HMAC-SHA256 Credential=${d.access}/${corta}/${d.region}/s3/aws4_request, SignedHeaders=${firmadas.join(";")}, Signature=${firma}` };
  delete headers.host;
  const r = await fetch(`${u.protocol}//${host}${ruta}`, { method: "PUT", headers, body: cuerpo });
  if (!r.ok) throw new Error(`Almacén ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
async function presignar(d: Destino, clave: string, nombre: string, seg = 3600) {
  const u = new URL(d.endpoint); const host = u.host; const { larga, corta } = fechaAmz(); const path = `/${d.bucket}/${codClave(clave)}`;
  const q: Record<string, string> = { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${d.access}/${corta}/${d.region}/s3/aws4_request`, "X-Amz-Date": larga, "X-Amz-Expires": String(seg), "X-Amz-SignedHeaders": "host", "response-content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}` };
  const cq = Object.keys(q).sort().map((k) => `${codificar(k)}=${codificar(q[k])}`).join("&");
  const canon = ["GET", path, cq, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const aFirmar = ["AWS4-HMAC-SHA256", larga, `${corta}/${d.region}/s3/aws4_request`, await sha256(canon)].join("\n");
  return `${u.protocol}//${host}${path}?${cq}&X-Amz-Signature=${hex(await hmac(await claveFirma(d, corta), aFirmar))}`;
}
async function destinoPredeterminado(sb: ReturnType<typeof servicio>, userId: string) {
  const { data: dest } = await sb.from("copias_destinos").select("id").eq("user_id", userId).eq("activo", true).order("es_predeterminado", { ascending: false }).limit(1);
  if (!dest?.[0]) return null;
  const { data } = await sb.rpc("leer_destino_copias", { p_destino_id: dest[0].id });
  const f = Array.isArray(data) ? data[0] : data;
  if (!f?.secreto) return null;
  const d: Destino = { endpoint: f.url_servidor.replace(/\/+$/, ""), region: f.region || "eu-central-1", bucket: f.bucket, prefijo: (f.ruta_prefijo || "").replace(/^\/+|\/+$/g, ""), access: f.usuario, secret: f.secreto };
  return { d, id: dest[0].id as string };
}
const limpiar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// ---------- GitHub ----------
async function repoDelProyecto(sb: ReturnType<typeof servicio>, proyectoId: string, userId: string) {
  const { data: p } = await sb.from("proyectos").select("id, slug, nombre, repositorio, user_id").eq("id", proyectoId).maybeSingle();
  if (!p || p.user_id !== userId) throw new Error("El proyecto no es tuyo");
  let repo = p.repositorio as string | null;
  if (!repo) { const { data: r } = await sb.from("repositorios").select("nombre_completo").eq("proyecto_id", proyectoId).maybeSingle(); repo = r?.nombre_completo ?? null; }
  if (!repo) throw new Error("El proyecto no tiene repositorio en GitHub. Créalo o enlázalo en Repositorios.");
  repo = repo.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/+$/, "");
  return { proyecto: p, repo };
}
async function subirArchivo(repo: string, ruta: string, contenido: string, mensaje: string, rama = "main") {
  const api = `/repos/${repo}/contents/${ruta}`;
  let sha: string | undefined; let igual = false;
  const actual = await gh(`${api}?ref=${rama}`);
  if (actual.ok) { const j = await actual.json(); sha = j.sha; try { igual = atob((j.content ?? "").replace(/\n/g, "")) === contenido; } catch { igual = false; } }
  if (igual) return { cambiado: false };
  const r = await gh(api, { method: "PUT", body: JSON.stringify({ message: mensaje, content: enB64(contenido), branch: rama, ...(sha ? { sha } : {}) }) });
  if (!r.ok) throw new Error(`No se pudo escribir ${ruta}: ${(await r.text()).slice(0, 300)}`);
  return { cambiado: true };
}
async function detectar(repo: string, rama: string) {
  const r = await gh(`/repos/${repo}/git/trees/${rama}?recursive=0`);
  if (!r.ok) { if (r.status === 404) throw new Error("Repositorio o rama no encontrados (¿está vacío?)"); throw new Error(`GitHub ${r.status}`); }
  const tree = (await r.json()).tree as { path: string; type: string }[];
  const tiene = (p: string) => tree.some((t) => t.path === p);
  let pkg: Record<string, unknown> = {};
  if (tiene("package.json")) { const pr = await gh(`/repos/${repo}/contents/package.json?ref=${rama}`); if (pr.ok) { try { pkg = JSON.parse(atob(((await pr.json()).content ?? "").replace(/\n/g, ""))); } catch { /* nada */ } } }
  const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
  const herramientas: string[] = [];
  if (tiene("pubspec.yaml")) herramientas.push("flutter");
  if (deps["@capacitor/core"] || tiene("capacitor.config.ts") || tiene("capacitor.config.json")) herramientas.push("capacitor");
  if (deps["@tauri-apps/api"] || tiene("src-tauri")) herramientas.push("tauri");
  if (deps["react-native"] || deps["expo"]) herramientas.push("react-native");
  if (Object.keys(pkg).length && (pkg.scripts as Record<string, string> ?? {})["build"]) herramientas.push("web");
  const plantillas: string[] = [];
  if (herramientas.includes("capacitor")) plantillas.push("capacitor-android", "capacitor-ios");
  if (herramientas.includes("flutter")) plantillas.push("flutter-android", "flutter-ios");
  if (herramientas.includes("tauri")) plantillas.push("tauri-escritorio");
  if (herramientas.includes("web") && !herramientas.includes("capacitor")) plantillas.push("capacitor-android", "capacitor-ios"); // una web Vite se puede empaquetar añadiendo Capacitor
  if (herramientas.includes("web")) plantillas.push("web-estatica");
  const talleres = tree.filter((t) => t.path.startsWith(".github/workflows/nex-compilar-")).map((t) => t.path);
  return { herramientas, plantillas_sugeridas: [...new Set(plantillas)], talleres_presentes: talleres, tiene_android: tiene("android"), tiene_ios: tiene("ios"), version_package: (pkg.version as string) ?? null };
}
async function secretosRepo(repo: string) {
  const r = await gh(`/repos/${repo}/actions/secrets?per_page=100`);
  if (!r.ok) return [] as string[];
  return ((await r.json()).secrets ?? []).map((s: { name: string }) => s.name) as string[];
}
async function ponerSecretoRepo(repo: string, nombre: string, valor: string) {
  await sodium.ready;
  const kr = await gh(`/repos/${repo}/actions/secrets/public-key`);
  if (!kr.ok) throw new Error(`No se pudo leer la clave pública del repositorio: ${kr.status}`);
  const { key, key_id } = await kr.json();
  const bin = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
  const sellado = sodium.crypto_box_seal(sodium.from_string(valor), bin);
  const r = await gh(`/repos/${repo}/actions/secrets/${nombre}`, { method: "PUT", body: JSON.stringify({ encrypted_value: sodium.to_base64(sellado, sodium.base64_variants.ORIGINAL), key_id }) });
  if (!r.ok) throw new Error(`No se pudo guardar ${nombre}: ${(await r.text()).slice(0, 200)}`);
}

// ---------- Sincronizar con GitHub Actions ----------
async function sincronizar(sb: ReturnType<typeof servicio>, soloUsuario?: string) {
  let q = sb.from("compilaciones").select("*, plantillas_compilacion(archivo_workflow, artefacto_patron)").in("estado", ["enviada", "en_curso"]);
  if (soloUsuario) q = q.eq("user_id", soloUsuario);
  const { data: vivas } = await q;
  const resultados: unknown[] = [];
  for (const c of vivas ?? []) {
    try {
      const archivo = (c.plantillas_compilacion?.archivo_workflow as string).split("/").pop();
      let run: Record<string, any> | null = null;
      if (c.run_id_github) {
        const r = await gh(`/repos/${c.repositorio}/actions/runs/${c.run_id_github}`);
        if (r.ok) run = await r.json();
      } else {
        const desde = new Date(new Date(c.enviada_el ?? c.creado_el).getTime() - 120000).toISOString();
        const r = await gh(`/repos/${c.repositorio}/actions/workflows/${archivo}/runs?event=workflow_dispatch&branch=${encodeURIComponent(c.rama)}&created=>=${desde}&per_page=10`);
        if (r.ok) {
          const lista = ((await r.json()).workflow_runs ?? []) as Record<string, any>[];
          // No asignar un run ya usado por otra compilación
          const { data: usados } = await sb.from("compilaciones").select("run_id_github").eq("repositorio", c.repositorio).not("run_id_github", "is", null);
          const ocupados = new Set((usados ?? []).map((u) => Number(u.run_id_github)));
          run = lista.filter((x) => !ocupados.has(Number(x.id))).sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null;
        }
      }
      if (!run) {
        // Si lleva más de 15 min sin aparecer el run, error
        if (Date.now() - new Date(c.enviada_el ?? c.creado_el).getTime() > 15 * 60000) await sb.from("compilaciones").update({ estado: "error", error: "GitHub no ha arrancado el taller (¿existe el archivo del workflow en la rama? ¿tiene Actions activadas el repositorio?)", terminada_el: new Date().toISOString(), actualizado_el: new Date().toISOString() }).eq("id", c.id);
        continue;
      }
      const cambios: Record<string, unknown> = { run_id_github: run.id, url_run: run.html_url, actualizado_el: new Date().toISOString() };
      if (run.status !== "completed") {
        cambios.estado = "en_curso"; if (!c.iniciada_el && run.run_started_at) cambios.iniciada_el = run.run_started_at;
      } else {
        const ini = new Date(run.run_started_at ?? run.created_at).getTime(); const fin = new Date(run.updated_at).getTime();
        cambios.duracion_seg = Math.round((fin - ini) / 1000); cambios.terminada_el = run.updated_at; cambios.iniciada_el = c.iniciada_el ?? run.run_started_at;
        if (run.conclusion === "success") {
          cambios.estado = "ok";
          const ar = await gh(`/repos/${c.repositorio}/actions/runs/${run.id}/artifacts`);
          const arts = ar.ok ? ((await ar.json()).artifacts ?? []) as Record<string, any>[] : [];
          const art = arts[0];
          if (art) {
            cambios.artefacto_nombre = art.name; cambios.artefacto_bytes = art.size_in_bytes;
            cambios.artefacto_url_github = `https://github.com/${c.repositorio}/actions/runs/${run.id}#artifacts`;
            // Copiar al almacén propio si hay destino
            try {
              const dp = await destinoPredeterminado(sb, c.user_id);
              if (dp && art.size_in_bytes < 180 * 1024 * 1024) {
                const z = await fetch(art.archive_download_url, { headers: cab(), redirect: "follow" });
                if (z.ok) {
                  const bytes = new Uint8Array(await z.arrayBuffer());
                  const { data: p } = await sb.from("proyectos").select("slug").eq("id", c.proyecto_id).maybeSingle();
                  const clave = `${dp.d.prefijo ? dp.d.prefijo + "/" : ""}compilaciones/${limpiar(p?.slug ?? "proyecto")}/v${limpiar(c.version)}/${limpiar(art.name)}.zip`;
                  await s3put(dp.d, clave, bytes, "application/zip");
                  cambios.ruta_remota = clave; cambios.destino_id = dp.id;
                }
              }
            } catch (e) { cambios.log_resumen = `Artefacto en GitHub; no se pudo copiar al almacén: ${String(e?.message ?? e).slice(0, 200)}`; }
          } else cambios.log_resumen = "El taller terminó bien pero no subió ningún artefacto.";
          // Actividad + tarea desatendida de archivo
          await sb.from("actividad").insert({ user_id: c.user_id, proyecto_id: c.proyecto_id, tipo: "compilacion", texto: `Compilación ${c.plataforma} v${c.version} terminada correctamente${art ? ` (${art.name})` : ""}.`, referencia_tabla: "compilaciones", referencia_id: c.id });
          await sb.from("tareas").insert({ user_id: c.user_id, proyecto_id: c.proyecto_id, titulo: `Guardar ${c.plataforma} v${c.version} en 04-ENTREGABLES y registrar la versión`, descripcion: `Descarga el artefacto desde Compilaciones y guárdalo en NUEVOS DESARROLLOS/<PROYECTO>/04-ENTREGABLES; registra la versión ${c.version} en Proyectian con su hoja de cambios.`, estado: "pendiente", prioridad: "media", requiere_atencion: true, motivo_atencion: "Copia del ejecutable y registro de versión", instrucciones: "1) Compilaciones → Descargar. 2) Copiar a 04-ENTREGABLES. 3) Proyectian → versión + cambios." });
        } else if (run.conclusion === "cancelled") { cambios.estado = "cancelada"; }
        else {
          cambios.estado = "error";
          // Resumen del log: pasos fallidos
          const jr = await gh(`/repos/${c.repositorio}/actions/runs/${run.id}/jobs`);
          if (jr.ok) { const jobs = ((await jr.json()).jobs ?? []) as Record<string, any>[]; const fallos = jobs.flatMap((j) => (j.steps ?? []).filter((s: any) => s.conclusion === "failure").map((s: any) => `${j.name} → ${s.name}`)); cambios.error = fallos.length ? `Falló en: ${fallos.join("; ")}` : `Taller terminado con resultado ${run.conclusion}`; }
          else cambios.error = `Taller terminado con resultado ${run.conclusion}`;
          await sb.from("tareas").insert({ user_id: c.user_id, proyecto_id: c.proyecto_id, titulo: `Revisar compilación ${c.plataforma} v${c.version} (error)`, descripcion: String(cambios.error), estado: "pendiente", prioridad: "alta", requiere_atencion: true, motivo_atencion: "Compilación fallida", instrucciones: `Abre el registro en ${run.html_url}, corrige y vuelve a lanzar desde Compilaciones.` });
        }
      }
      await sb.from("compilaciones").update(cambios).eq("id", c.id);
      resultados.push({ id: c.id, estado: cambios.estado ?? c.estado });
    } catch (e) { resultados.push({ id: c.id, error: String(e?.message ?? e) }); }
  }
  return resultados;
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
    if (!accion) return json({ ok: true, listo: true, github: !!TOKEN_GITHUB });
    if (!TOKEN_GITHUB && accion !== "sincronizar") return json({ ok: false, error: "Falta el secreto GITHUB_TOKEN (permisos repo y workflow) en las Edge Functions." });

    switch (accion) {
      case "sincronizar": {
        const r = await sincronizar(sb, esServicio ? undefined : userId!);
        return json({ ok: true, resultados: r });
      }
      case "detectar": {
        const { repo } = await repoDelProyecto(sb, String(cuerpo.proyecto_id), userId!);
        const rama = String(cuerpo.rama || "main");
        const d = await detectar(repo, rama);
        const secretos = await secretosRepo(repo);
        return json({ ok: true, repositorio: repo, rama, ...d, secretos_presentes: secretos });
      }
      case "preparar": {
        const { repo } = await repoDelProyecto(sb, String(cuerpo.proyecto_id), userId!);
        const rama = String(cuerpo.rama || "main");
        const { data: pl } = await sb.from("plantillas_compilacion").select("*").eq("id", String(cuerpo.plantilla_id)).maybeSingle();
        if (!pl) return json({ ok: false, error: "Plantilla desconocida" }, 400);
        const r = await subirArchivo(repo, pl.archivo_workflow, pl.yaml, `NexDeveloper: taller de compilación ${pl.plataforma}`, rama);
        return json({ ok: true, archivo: pl.archivo_workflow, cambiado: r.cambiado });
      }
      case "lanzar": {
        const { proyecto, repo } = await repoDelProyecto(sb, String(cuerpo.proyecto_id), userId!);
        const rama = String(cuerpo.rama || "main");
        const version = String(cuerpo.version || "").trim();
        if (!/^\d+\.\d+\.\d+/.test(version)) return json({ ok: false, error: "Indica una versión con formato 1.2.3" }, 400);
        const { data: pl } = await sb.from("plantillas_compilacion").select("*").eq("id", String(cuerpo.plantilla_id)).maybeSingle();
        if (!pl) return json({ ok: false, error: "Plantilla desconocida" }, 400);
        // Misma versión ya compilada con éxito → obligar a subir versión
        const { data: previa } = await sb.from("compilaciones").select("id").eq("proyecto_id", proyecto.id).eq("plataforma", pl.plataforma).eq("version", version).in("estado", ["ok", "en_curso", "enviada"]).limit(1);
        if (previa?.length && !cuerpo.forzar) return json({ ok: false, error: `Ya existe una compilación ${pl.plataforma} v${version}. Sube el número de versión.` }, 409);
        await subirArchivo(repo, pl.archivo_workflow, pl.yaml, `NexDeveloper: taller de compilación ${pl.plataforma}`, rama);
        const presentes = await secretosRepo(repo);
        const firmada = (pl.secretos_firma as string[]).length > 0 && (pl.secretos_firma as string[]).every((s) => presentes.includes(s));
        const archivo = (pl.archivo_workflow as string).split("/").pop();
        // Pequeña espera para que GitHub indexe el workflow recién subido
        let disp = await gh(`/repos/${repo}/actions/workflows/${archivo}/dispatches`, { method: "POST", body: JSON.stringify({ ref: rama, inputs: { version } }) });
        if (disp.status === 404 || disp.status === 422) { await new Promise((r) => setTimeout(r, 4000)); disp = await gh(`/repos/${repo}/actions/workflows/${archivo}/dispatches`, { method: "POST", body: JSON.stringify({ ref: rama, inputs: { version } }) }); }
        if (!disp.ok) return json({ ok: false, error: `GitHub no aceptó el lanzamiento (${disp.status}): ${(await disp.text()).slice(0, 300)}` }, 502);
        const { data: fila, error } = await sb.from("compilaciones").insert({ user_id: userId, proyecto_id: proyecto.id, repositorio: repo, rama, plantilla_id: pl.id, plataforma: pl.plataforma, herramienta: pl.herramienta, version, firmada, estado: "enviada", enviada_el: new Date().toISOString(), notas: cuerpo.notas ?? null }).select("*").single();
        if (error) return json({ ok: false, error: error.message }, 500);
        await sb.from("actividad").insert({ user_id: userId, proyecto_id: proyecto.id, tipo: "compilacion", texto: `Compilación ${pl.plataforma} v${version} enviada a GitHub Actions${firmada ? " (firmada)" : " (sin firma)"}.`, referencia_tabla: "compilaciones", referencia_id: fila.id });
        return json({ ok: true, compilacion: fila, firmada, minutos_estimados: pl.minutos_estimados });
      }
      case "cancelar": {
        const { data: c } = await sb.from("compilaciones").select("*").eq("id", String(cuerpo.compilacion_id)).eq("user_id", userId!).maybeSingle();
        if (!c) return json({ ok: false, error: "No encontrada" }, 404);
        if (c.run_id_github) await gh(`/repos/${c.repositorio}/actions/runs/${c.run_id_github}/cancel`, { method: "POST" });
        await sb.from("compilaciones").update({ estado: "cancelada", terminada_el: new Date().toISOString(), actualizado_el: new Date().toISOString() }).eq("id", c.id);
        return json({ ok: true });
      }
      case "descargar": {
        const { data: c } = await sb.from("compilaciones").select("*").eq("id", String(cuerpo.compilacion_id)).eq("user_id", userId!).maybeSingle();
        if (!c) return json({ ok: false, error: "No encontrada" }, 404);
        if (c.ruta_remota) {
          const dp = await destinoPredeterminado(sb, userId!);
          if (dp) return json({ ok: true, url: await presignar(dp.d, c.ruta_remota, `${c.artefacto_nombre ?? "artefacto"}.zip`), origen: "almacen" });
        }
        if (c.run_id_github) {
          const ar = await gh(`/repos/${c.repositorio}/actions/runs/${c.run_id_github}/artifacts`);
          const arts = ar.ok ? ((await ar.json()).artifacts ?? []) as Record<string, any>[] : [];
          if (arts[0]) {
            // URL temporal de GitHub (redirección firmada, válida ~1 min)
            const z = await fetch(arts[0].archive_download_url, { headers: cab(), redirect: "manual" });
            const loc = z.headers.get("location");
            if (loc) return json({ ok: true, url: loc, origen: "github", caduca_en_seg: 60 });
          }
        }
        return json({ ok: false, error: "No hay artefacto descargable (los artefactos de GitHub caducan a los 30 días; configura un destino en Copias para conservarlos)." });
      }
      case "guardar_secretos_repo": {
        const { proyecto, repo } = await repoDelProyecto(sb, String(cuerpo.proyecto_id), userId!);
        const secretos = (cuerpo.secretos ?? {}) as Record<string, string>;
        const plataforma = String(cuerpo.plataforma ?? "android");
        const permitidos = ["ANDROID_KEYSTORE_BASE64", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD", "APPLE_CERT_P12_BASE64", "APPLE_CERT_PASSWORD", "APPLE_PROVISION_PROFILE_BASE64", "APPLE_TEAM_ID"];
        const puestos: string[] = [];
        for (const [k, v] of Object.entries(secretos)) { if (!permitidos.includes(k) || !v) continue; await ponerSecretoRepo(repo, k, String(v)); puestos.push(k); }
        const presentes = await secretosRepo(repo);
        await sb.from("firmas_compilacion").upsert({ user_id: userId, proyecto_id: proyecto.id, plataforma, secretos_puestos: presentes.filter((s) => permitidos.includes(s)), actualizado_el: new Date().toISOString() }, { onConflict: "proyecto_id,plataforma" });
        return json({ ok: true, puestos, presentes: presentes.filter((s) => permitidos.includes(s)) });
      }
      default: return json({ ok: false, error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (e) { return json({ ok: false, error: String(e?.message ?? e) }, 500); }
});
