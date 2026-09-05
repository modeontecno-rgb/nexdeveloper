import { createClient } from "@supabase/supabase-js";

import type { Database } from "./db-types";

// Datos públicos del proyecto propio de Supabase (clave publicable, nunca la secreta).
export const SUPABASE_URL =
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ?? "https://eqyuodrmlbclobaverdb.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ??
  "sb_publishable_tQgS3KEHYJC1jOx4XQCH6w_VL44Avu_";
export const SUPABASE_PROJECT_ID =
  (import.meta.env["VITE_SUPABASE_PROJECT_ID"] as string | undefined) ?? "eqyuodrmlbclobaverdb";

// Las claves nuevas de Supabase son opacas, no son tokens JWT: van en la cabecera `apikey`.
function fetchConClave(clave: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (headers.get("Authorization") === `Bearer ${clave}`) headers.delete("Authorization");
    headers.set("apikey", clave);
    return fetch(input, { ...init, headers });
  };
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: fetchConClave(SUPABASE_PUBLISHABLE_KEY) },
  auth: {
    storageKey: "nexdeveloper-sesion",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
