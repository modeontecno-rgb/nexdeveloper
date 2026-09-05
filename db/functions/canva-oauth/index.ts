// Edge Function «canva-oauth».
// Gestiona la conexión con Canva Connect por OAuth 2.0 con PKCE. El identificador
// y el secreto de la aplicación de Canva viven en los secretos de la función
// (CANVA_CLIENT_ID y CANVA_CLIENT_SECRET) y nunca llegan al navegador.
//
// Acciones:
//   { accion: "autorizar", code_challenge, redirect_uri } -> { url }
//   { accion: "intercambiar", code, code_verifier, redirect_uri } -> { ok, cuenta }
//
// Despliegue: supabase functions deploy canva-oauth
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALCANCES = [
  "design:content:read",
  "design:content:write",
  "design:meta:read",
  "asset:read",
  "asset:write",
  "brandtemplate:content:read",
  "brandtemplate:meta:read",
].join(" ");

const AUTORIZACION = "https://www.canva.com/api/oauth/authorize";
const TOKEN = "https://api.canva.com/rest/v1/oauth/token";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const responder = (cuerpo: Record<string, unknown>, estado = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status: estado,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const cuerpo = await req.json().catch(() => ({}));
    const accion = cuerpo.accion as string | undefined;
    const clienteId = Deno.env.get("CANVA_CLIENT_ID");
    const clienteSecreto = Deno.env.get("CANVA_CLIENT_SECRET");

    if (!accion) return responder({ ok: true, configurado: Boolean(clienteId && clienteSecreto) });
    if (!clienteId || !clienteSecreto) {
      return responder({ ok: false, error: "Faltan CANVA_CLIENT_ID y CANVA_CLIENT_SECRET en los secretos." }, 400);
    }

    if (accion === "autorizar") {
      const url = new URL(AUTORIZACION);
      url.searchParams.set("code_challenge", String(cuerpo.code_challenge ?? ""));
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("client_id", clienteId);
      url.searchParams.set("redirect_uri", String(cuerpo.redirect_uri ?? ""));
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", ALCANCES);
      url.searchParams.set("state", String(cuerpo.state ?? ""));
      return responder({ ok: true, url: url.toString() });
    }

    if (accion !== "intercambiar") return responder({ ok: false, error: "Acción desconocida." }, 400);

    const basica = btoa(`${clienteId}:${clienteSecreto}`);
    const respuesta = await fetch(TOKEN, {
      method: "POST",
      headers: { Authorization: `Basic ${basica}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(cuerpo.code ?? ""),
        code_verifier: String(cuerpo.code_verifier ?? ""),
        redirect_uri: String(cuerpo.redirect_uri ?? ""),
      }),
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) {
      return responder({ ok: false, error: datos?.error_description ?? "Canva ha rechazado la conexión." });
    }

    const tokens = {
      access_token: datos.access_token,
      refresh_token: datos.refresh_token,
      expira_en: new Date(Date.now() + Number(datos.expires_in ?? 0) * 1000).toISOString(),
    };

    // Nombre visible de la cuenta, para poder mostrar «Conectado como…».
    let cuentaNombre = "cuenta de Canva";
    try {
      const perfil = await fetch("https://api.canva.com/rest/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (perfil.ok) {
        const p = await perfil.json();
        cuentaNombre = p?.profile?.display_name ?? cuentaNombre;
      }
    } catch { /* el nombre es opcional */ }

    const autorizacion = req.headers.get("Authorization") ?? "";
    const comoUsuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: autorizacion } },
    });

    const proveedorId = String(cuerpo.proveedor_id ?? "");
    if (!proveedorId) return responder({ ok: false, error: "Falta el proveedor." }, 400);

    const { error: errorClave } = await comoUsuario.rpc("guardar_clave_proveedor", {
      p_proveedor_id: proveedorId,
      p_clave: JSON.stringify(tokens),
    });
    if (errorClave) return responder({ ok: false, error: errorClave.message }, 400);

    await comoUsuario.from("proveedores_ia").update({ cuenta: cuentaNombre }).eq("id", proveedorId);

    return responder({ ok: true, cuenta: cuentaNombre });
  } catch (e) {
    return responder({ ok: false, error: e instanceof Error ? e.message : "Error inesperado." }, 500);
  }
});
