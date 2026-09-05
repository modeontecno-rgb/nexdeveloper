import { Outlet } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { AppShell } from "@/components/nex/app-shell";
import { PantallaAcceso } from "@/components/nex/pantalla-acceso";
import { useAuth } from "@/lib/nex/auth";
import { useRealtime } from "@/lib/nex/queries/realtime";

/** Protege toda la aplicación: sin sesión solo se ve la pantalla de acceso. */
export function Puerta() {
  const { sesion, cargando } = useAuth();
  useRealtime(Boolean(sesion));

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sesion) return <PantallaAcceso />;

  return (
    <AppShell>
      {/* Aquí se dibujan todas las pantallas de la aplicación. */}
      <Outlet />
    </AppShell>
  );
}
