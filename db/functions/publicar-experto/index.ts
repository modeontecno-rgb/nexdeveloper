// Edge Function «publicar-experto».
// Sube el fichero expertos/<slug>/SKILL.md al repositorio privado de GitHub
// modeontecno-rgb/expertos-red y guarda la dirección del fichero publicado.
// Si falta GITHUB_TOKEN deja una tarea en «Requiere tu atención».
//
// Despliegue: supabase functions deploy publicar-experto
// Secretos: GITHUB_TOKEN (permiso repo).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DUENO = "modeontecno-rgb";
const REPO = "expertos-red";

type Experto = {
  id: string;
  user_id: string;
  slug: string;
  nombre: string;
  papel: string;
  cuando_usarlo: string | null;
  instrucciones: string | null;
  url_origen: string | null;
};

function cabeceras(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "nexdeveloper",
    "Content-Type": "application/json",
  };
}

async function asegurarRepositorio(token: string) {
  const existe = await fetch(`https://api.github.com/repos/${DUENO}/${REPO}`, { headers: cabeceras(token) });
  if (existe.ok) return;
  const creado = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: cabeceras(token),
    body: JSON.stringify({ name: REPO, private: true, description: "Expertos encontrados en la red (NexDeveloper)" }),
  });
  if (!creado.ok) throw new Error(`No se ha podido crear el repositorio: ${await creado.text()}`);
}

function contenido(e: Experto) {
  return [
    `# ${e.nombre}`,
    "",
    `**Papel:** ${e.papel}`,
    `**Cuándo usarlo:** ${e.cuando_usarlo ?? "sin indicar"}`,
    `**Origen:** ${e.url_origen ?? "sin indicar"}`,
    "",
    "---",
    "",
    e.instrucciones ?? "_Sin instrucciones todavía._",
    "",
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const responder = (cuerpo: Record<string, unknown>, estado = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status: estado,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const { experto_id: expertoId } = await req.json();
    if (!expertoId) return responder({ ok: false, error: "Falta el experto." }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const servicio = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: experto, error } = await servicio
      .from("expertos")
      .select("id, user_id, slug, nombre, papel, cuando_usarlo, instrucciones, url_origen")
      .eq("id", expertoId)
      .maybeSingle();
    if (error || !experto) return responder({ ok: false, error: "No se encuentra el experto." }, 404);

    const token = Deno.env.get("GITHUB_TOKEN");
    if (!token) {
      const { data: proyecto } = await servicio
        .from("proyectos")
        .select("id")
        .eq("user_id", experto.user_id)
        .limit(1)
        .maybeSingle();
      if (proyecto) {
        await servicio.from("tareas").insert({
          user_id: experto.user_id,
          proyecto_id: proyecto.id,
          titulo: "Publicar experto en GitHub",
          descripcion: `Falta el token de GitHub para publicar «${experto.nombre}».`,
          requiere_atencion: true,
          motivo_atencion: "Falta GITHUB_TOKEN",
          instrucciones:
            "Añade el secreto GITHUB_TOKEN a las Edge Functions de Supabase y vuelve a adoptar el experto.",
        });
      }
      return responder({ ok: false, error: "Falta GITHUB_TOKEN; se ha dejado la tarea pendiente." });
    }

    await asegurarRepositorio(token);

    const ruta = `expertos/${experto.slug}/SKILL.md`;
    const api = `https://api.github.com/repos/${DUENO}/${REPO}/contents/${ruta}`;

    let sha: string | undefined;
    const actual = await fetch(api, { headers: cabeceras(token) });
    if (actual.ok) sha = ((await actual.json()) as { sha?: string }).sha;

    const subida = await fetch(api, {
      method: "PUT",
      headers: cabeceras(token),
      body: JSON.stringify({
        message: `Experto ${experto.slug}`,
        content: btoa(unescape(encodeURIComponent(contenido(experto as Experto)))),
        ...(sha ? { sha } : {}),
      }),
    });
    if (!subida.ok) return responder({ ok: false, error: await subida.text() }, 502);

    const publicado = (await subida.json()) as { content?: { html_url?: string } };
    const enlace = publicado.content?.html_url ?? `https://github.com/${DUENO}/${REPO}/blob/main/${ruta}`;
    await servicio.from("expertos").update({ url_origen_publicado: enlace }).eq("id", experto.id);

    return responder({ ok: true, url: enlace });
  } catch (err) {
    return responder({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
