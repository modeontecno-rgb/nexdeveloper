// NexDeveloper · Edge Function "ejecutar-accion"
// Ejecuta una acción directa (Supabase o GitHub) creada desde la app.
// Los secretos viven SOLO aquí (Supabase → Edge Functions → Secrets):
//   SUPABASE_ACCESS_TOKEN  → token de cuenta de Supabase (Management API)
//   GITHUB_TOKEN           → token personal de GitHub con permiso repo
// La acción debe pertenecer al usuario que llama y estar aprobada (o no requerir aprobación).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

type Accion = {
  id: string; user_id: string; tipo: string; titulo: string; estado: string;
  requiere_aprobacion: boolean; parametros: Record<string, string>;
};

async function supabaseMgmt(path: string, init: RequestInit = {}) {
  const token = Deno.env.get("SUPABASE_ACCESS_TOKEN");
  if (!token) throw new Error("Falta el secreto SUPABASE_ACCESS_TOKEN en Edge Functions → Secrets.");
  const r = await fetch(`https://api.supabase.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const texto = await r.text();
  let datos: unknown = texto;
  try { datos = JSON.parse(texto); } catch { /* texto plano */ }
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${typeof datos === "string" ? datos : JSON.stringify(datos)}`);
  return datos;
}

async function github(path: string, init: RequestInit = {}) {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) throw new Error("Falta el secreto GITHUB_TOKEN en Edge Functions → Secrets.");
  const r = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const texto = await r.text();
  let datos: unknown = texto;
  try { datos = JSON.parse(texto); } catch { /* texto plano */ }
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${typeof datos === "string" ? datos : JSON.stringify(datos)}`);
  return datos;
}

function soloLectura(sql: string) {
  const s = sql.trim().toLowerCase().replace(/^\(+/, "");
  return (s.startsWith("select") || s.startsWith("with") || s.startsWith("explain") || s.startsWith("show")) && !/;\s*\S/.test(sql.trim());
}

async function ejecutar(a: Accion, valorSecreto?: string): Promise<unknown> {
  const p = a.parametros ?? {};
  switch (a.tipo) {
    case "supabase_listar_tablas": {
      const datos = await supabaseMgmt(`/projects/${p.project_ref}/database/query`, {
        method: "POST",
        body: JSON.stringify({ query: "select table_name, (select count(*) from information_schema.columns c where c.table_name=t.table_name and c.table_schema='public') as columnas from information_schema.tables t where table_schema='public' and table_type='BASE TABLE' order by 1" }),
      });
      return { tablas: datos };
    }
    case "supabase_sql": {
      if (!soloLectura(p.sql ?? "")) throw new Error("Esta acción solo admite consultas de lectura (SELECT). Para cambios usa «Aplicar migración».");
      return { filas: await supabaseMgmt(`/projects/${p.project_ref}/database/query`, { method: "POST", body: JSON.stringify({ query: p.sql, read_only: true }) }) };
    }
    case "supabase_migracion": {
      const nombre = (p.nombre || a.titulo).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60);
      const datos = await supabaseMgmt(`/projects/${p.project_ref}/database/migrations`, { method: "POST", body: JSON.stringify({ name: nombre, query: p.sql }) });
      return { migracion: nombre, resultado: datos };
    }
    case "supabase_secreto": {
      if (!valorSecreto) throw new Error("Hay que indicar el valor del secreto en el momento de ejecutar (no se guarda).");
      await supabaseMgmt(`/projects/${p.project_ref}/secrets`, { method: "POST", body: JSON.stringify([{ name: p.nombre, value: valorSecreto }]) });
      return { secreto: p.nombre, guardado: true };
    }
    case "github_crear_repo": {
      const datos = await github(`/user/repos`, { method: "POST", body: JSON.stringify({ name: p.nombre, description: p.descripcion ?? "", private: true, auto_init: true }) }) as Record<string, unknown>;
      return { repo: datos["full_name"], url: datos["html_url"] };
    }
    case "github_listar_ramas": {
      const datos = await github(`/repos/${p.repo}/branches`) as Array<Record<string, unknown>>;
      return { ramas: datos.map((b) => b["name"]) };
    }
    case "github_crear_issue": {
      const datos = await github(`/repos/${p.repo}/issues`, { method: "POST", body: JSON.stringify({ title: p.titulo, body: p.cuerpo ?? "" }) }) as Record<string, unknown>;
      return { numero: datos["number"], url: datos["html_url"] };
    }
    case "github_subir_archivo": {
      const ruta = p.ruta.replace(/^\/+/, "");
      let sha: string | undefined;
      try {
        const actual = await github(`/repos/${p.repo}/contents/${ruta}?ref=${p.rama || "main"}`) as Record<string, unknown>;
        sha = actual["sha"] as string;
      } catch { /* no existe: se crea */ }
      const contenido = btoa(unescape(encodeURIComponent(p.contenido ?? "")));
      const datos = await github(`/repos/${p.repo}/contents/${ruta}`, {
        method: "PUT",
        body: JSON.stringify({ message: p.mensaje || `Actualiza ${ruta} desde NexDeveloper`, content: contenido, branch: p.rama || "main", sha }),
      }) as Record<string, unknown>;
      return { ruta, commit: (datos["commit"] as Record<string, unknown>)?.["sha"] };
    }
    case "http_generica": {
      const r = await fetch(p.url, { method: p.metodo || "GET", headers: p.cabeceras ? JSON.parse(p.cabeceras) : undefined, body: p.cuerpo });
      return { estado: r.status, cuerpo: (await r.text()).slice(0, 20000) };
    }
    default:
      throw new Error(`Tipo de acción no soportado: ${a.tipo}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Sin sesión." }, 401);

    const { accion_id, valor_secreto } = await req.json();
    const { data: accion, error } = await supabase.from("acciones").select("*").eq("id", accion_id).single();
    if (error || !accion) return json({ error: "Acción no encontrada." }, 404);
    const a = accion as Accion;
    if (a.user_id !== user.id) return json({ error: "No es tuya." }, 403);
    if (a.requiere_aprobacion && a.estado !== "aprobada") return json({ error: "La acción necesita aprobación antes de ejecutarse." }, 409);
    if (["ejecutando", "completada"].includes(a.estado)) return json({ error: `La acción ya está ${a.estado}.` }, 409);

    await supabase.from("acciones").update({ estado: "ejecutando", error: null }).eq("id", a.id);
    try {
      const resultado = await ejecutar(a, valor_secreto);
      await supabase.from("acciones").update({ estado: "completada", resultado, ejecutada_el: new Date().toISOString() }).eq("id", a.id);
      await supabase.from("actividad").insert({ proyecto_id: (accion as Record<string, unknown>)["proyecto_id"], tipo: "resultado", texto: `Acción ejecutada: ${a.titulo}`, referencia_tabla: "acciones", referencia_id: a.id });
      return json({ ok: true, resultado });
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      await supabase.from("acciones").update({ estado: "error", error: mensaje }).eq("id", a.id);
      return json({ ok: false, error: mensaje }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
