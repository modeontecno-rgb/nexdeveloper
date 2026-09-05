// Edge Function «barrer-expertos».
// Busca en la API pública de GitHub repositorios de habilidades y agentes, y
// deja los hallazgos nuevos como expertos propuestos, con una tarea en
// «Requiere tu atención» para adoptarlos o descartarlos.
//
// Despliegue: supabase functions deploy barrer-expertos
// Secretos opcionales: GITHUB_TOKEN (sube el límite de peticiones).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUSQUEDAS = [
  "topic:claude-skills",
  "topic:agent-skills",
  "topic:claude-agents",
  "topic:cursor-rules",
  "awesome-claude in:name",
  "SKILL.md in:readme",
];

const MAXIMO_POR_EJECUCION = 10;

type Repo = {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  topics?: string[];
};

function slugDe(nombre: string) {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

async function buscarRepos(token: string | undefined): Promise<Repo[]> {
  const cabeceras: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "nexdeveloper",
  };
  if (token) cabeceras["Authorization"] = `Bearer ${token}`;

  const encontrados = new Map<string, Repo>();
  for (const consulta of BUSQUEDAS) {
    const url =
      "https://api.github.com/search/repositories?sort=stars&order=desc&per_page=10&q=" +
      encodeURIComponent(consulta);
    const respuesta = await fetch(url, { headers: cabeceras });
    if (!respuesta.ok) continue;
    const cuerpo = (await respuesta.json()) as { items?: Repo[] };
    for (const repo of cuerpo.items ?? []) {
      if (!encontrados.has(repo.html_url)) encontrados.set(repo.html_url, repo);
    }
  }
  return [...encontrados.values()].sort((a, b) => b.stargazers_count - a.stargazers_count);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const responder = (cuerpo: Record<string, unknown>, estado = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status: estado,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const servicio = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Usuarios a los que hay que asignar los hallazgos: el que llama, o todos
    // si el barrido viene programado desde la base de datos.
    const autorizacion = req.headers.get("Authorization") ?? "";
    let usuarios: string[] = [];
    const comoUsuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: autorizacion } },
    });
    const { data: sesion } = await comoUsuario.auth.getUser();
    if (sesion?.user) {
      usuarios = [sesion.user.id];
    } else {
      const { data: lista } = await servicio.auth.admin.listUsers();
      usuarios = (lista?.users ?? []).map((u) => u.id);
    }
    if (usuarios.length === 0) return responder({ ok: false, error: "No hay usuarios." }, 400);

    const repos = await buscarRepos(Deno.env.get("GITHUB_TOKEN") ?? undefined);
    let nuevos = 0;

    for (const usuario of usuarios) {
      const { data: existentes } = await servicio
        .from("expertos")
        .select("url_origen")
        .eq("user_id", usuario)
        .not("url_origen", "is", null);
      const yaEstan = new Set((existentes ?? []).map((e: { url_origen: string }) => e.url_origen));

      let creados = 0;
      for (const repo of repos) {
        if (creados >= MAXIMO_POR_EJECUCION) break;
        if (yaEstan.has(repo.html_url)) continue;

        const nombre = repo.full_name.split("/")[1] ?? repo.full_name;
        const papel = (repo.description ?? "Habilidad encontrada en la red").slice(0, 140);
        const { error } = await servicio.from("expertos").insert({
          user_id: usuario,
          slug: slugDe(repo.full_name),
          nombre,
          origen: "red",
          estado: "propuesto",
          papel,
          cuando_usarlo: `Repositorio con ${repo.stargazers_count} estrellas: ${repo.full_name}.`,
          url_origen: repo.html_url,
          tareas: [],
        });
        if (error) continue;
        creados += 1;
        nuevos += 1;

        const { data: proyecto } = await servicio
          .from("proyectos")
          .select("id")
          .eq("user_id", usuario)
          .limit(1)
          .maybeSingle();
        if (proyecto) {
          await servicio.from("tareas").insert({
            user_id: usuario,
            proyecto_id: proyecto.id,
            titulo: `Revisar experto encontrado: ${nombre}`,
            descripcion: papel,
            requiere_atencion: true,
            motivo_atencion: "Experto nuevo encontrado en la red",
            instrucciones: `Ve a Expertos y decide si adoptas o descartas «${nombre}». Origen: ${repo.html_url}`,
          });
        }
      }
    }

    return responder({ ok: true, nuevos, revisados: repos.length });
  } catch (err) {
    return responder({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
