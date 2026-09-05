import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { supabase } from "./supabase";

interface Autenticacion {
  sesion: Session | null;
  usuario: User | null;
  cargando: boolean;
  entrar: (email: string, contrasena: string) => Promise<void>;
  salir: () => Promise<void>;
}

const Ctx = React.createContext<Autenticacion | null>(null);

export function ProveedorAuth({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = React.useState<Session | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    let activo = true;

    const { data: sub } = supabase.auth.onAuthStateChange((evento, nueva) => {
      if (!activo) return;
      setSesion(nueva);
      if (evento === "SIGNED_IN" || evento === "USER_UPDATED") {
        void queryClient.invalidateQueries();
      }
      if (evento === "SIGNED_OUT") queryClient.clear();
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!activo) return;
      setSesion(data.session);
      setCargando(false);
    });

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const valor: Autenticacion = {
    sesion,
    usuario: sesion?.user ?? null,
    cargando,
    entrar: async (email, contrasena) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password: contrasena });
      if (error) throw new Error(traducirError(error.message));
    },
    salir: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useAuth debe usarse dentro de ProveedorAuth");
  return ctx;
}

function traducirError(mensaje: string) {
  const m = mensaje.toLowerCase();
  if (m.includes("invalid login")) return "El correo o la contraseña no son correctos.";
  if (m.includes("email not confirmed")) return "Esta cuenta todavía no está confirmada.";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Espera un momento.";
  if (m.includes("failed to fetch")) return "No se ha podido contactar con el servidor.";
  return "No se ha podido iniciar sesión.";
}
