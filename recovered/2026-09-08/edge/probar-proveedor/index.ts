// Edge Function «probar-proveedor» (v4: perplexity y fal sin endpoint válido de comprobación; Canva con renovación de permiso).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Prueba = { url: string; cabeceras: Record<string, string> };

function peticionDePrueba(slug: string, clave: string, urlBase: string | null): Prueba | null {
  const base = (urlBase ?? "").replace(/\/$/, "");
  switch (slug) {
    case "anthropic":
      return {
        url: `${base || "https://api.anthropic.com"}/v1/models`,
        cabeceras: { "x-api-key": clave, "anthropic-version": "2023-06-01" },
      };
    case "google":
      return {
        url: `${base || "https://generativelanguage.googleapis.com"}/v1beta/models?key=${encodeURIComponent(clave)}`,
        cabeceras: {},
      };
    case "elevenlabs":
      return { url: `${base || "https://api.elevenlabs.io"}/v1/models`, cabeceras: { "xi-api-key": clave } };
    case "fal":
      // fal.ai no tiene un endpoint raíz de comprobación: cada llamada va contra un modelo concreto
      // (p. ej. fal.run/fal-ai/flux/schnell), así que probar la raíz "/" siempre da 404 aunque la clave sea correcta.
      return null;
    case "cohere":
      return { url: `${base || "https://api.cohere.com"}/v1/models`, cabeceras: { Authorization: `Bearer ${clave}` } };
    case "perplexity":
      // La API de Perplexity no tiene endpoint GET /models (solo POST /chat/completions), así que
      // probar "/models" siempre da 404 aunque la clave sea correcta. Probarla de verdad consumiría
      // una llamada de pago, así que no se comprueba en automático.
      return null;
    case "canva":
      return { url: `${base || "https://api.canva.com/rest/v1"}/users/me`, cabeceras: { Authorization: `Bearer ${clave}` } };
    case "ollama":
      return { url: `${base || "http://localhost:11434"}/api/tags`, cabeceras: {} };
    default:
      return { url: `${base}/models`, cabeceras: { Authorization: `Bearer ${clave}` } };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const responder = (cuerpo: Record<string, unknown>, estado = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status: estado,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const { proveedor_id: proveedorId } = await req.json();
    if (!proveedorId) return responder({ ok: false, error: "Falta el proveedor." }, 400);

    const autorizacion = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;

    const comoUsuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: autorizacion } },
    });
    const { data: filas, error: errorRpc } = await comoUsuario.rpc("probar_proveedor", {
      p_proveedor_id: proveedorId,
    });
    if (errorRpc) return responder({ ok: false, error: errorRpc.message }, 400);
    const info = Array.isArray(filas) ? filas[0] : filas;
    if (!info) return responder({ ok: false, error: "Proveedor no encontrado." }, 404);
    if (!info.tiene_clave) return responder({ ok: false, error: "Este proveedor todavía no tiene clave guardada." });

    const comoServicio = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: clave, error: errorClave } = await comoServicio.rpc("descifrar_clave_proveedor", {
      p_proveedor_id: proveedorId,
    });
    if (errorClave || !clave) return responder({ ok: false, error: "No se ha podido leer la clave guardada." });

    let claveUso = clave as string;

    if (info.clave_slug === "canva") {
      try {
        const tokens = JSON.parse(claveUso);
        const caducado = !tokens.expira_en || new Date(tokens.expira_en).getTime() < Date.now() + 60_000;
        if (caducado && tokens.refresh_token) {
          const clienteId = Deno.env.get("CANVA_CLIENT_ID");
          const clienteSecreto = Deno.env.get("CANVA_CLIENT_SECRET");
          if (!clienteId || !clienteSecreto) {
            return responder({ ok: false, error: "Faltan CANVA_CLIENT_ID y CANVA_CLIENT_SECRET en los secretos." });
          }
          const renovacion = await fetch("https://api.canva.com/rest/v1/oauth/token", {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${clienteId}:${clienteSecreto}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token }),
          });
          const datos = await renovacion.json();
          if (!renovacion.ok) {
            return responder({ ok: false, error: "La conexión con Canva ha caducado. Vuelve a conectarla." });
          }
          const nuevos = {
            access_token: datos.access_token,
            refresh_token: datos.refresh_token ?? tokens.refresh_token,
            expira_en: new Date(Date.now() + Number(datos.expires_in ?? 0) * 1000).toISOString(),
          };
          await comoUsuario.rpc("guardar_clave_proveedor", {
            p_proveedor_id: proveedorId,
            p_clave: JSON.stringify(nuevos),
          });
          claveUso = nuevos.access_token;
        } else {
          claveUso = tokens.access_token;
        }
      } catch {
        return responder({ ok: false, error: "La conexión con Canva no es válida. Vuelve a conectarla." });
      }
    }

    const prueba = peticionDePrueba(info.clave_slug, claveUso, info.url_base);
    if (!prueba) return responder({ ok: false, error: "Este proveedor no admite comprobación automática." });

    const inicio = Date.now();
    const respuesta = await fetch(prueba.url, { headers: prueba.cabeceras });
    const duracion = Date.now() - inicio;

    if (!respuesta.ok) {
      const texto = (await respuesta.text()).slice(0, 300);
      return responder({ ok: false, error: `El proveedor ha respondido ${respuesta.status}. ${texto}` });
    }
    return responder({ ok: true, duracion_ms: duracion });
  } catch (e) {
    return responder({ ok: false, error: e instanceof Error ? e.message : "Error inesperado." }, 500);
  }
});
