import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "./supabase";

/**
 * Adjunta el token de la sesión real de la aplicación (cliente propio, con su
 * propia clave de almacenamiento) a cada llamada al servidor.
 */
export const adjuntarSesion = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
