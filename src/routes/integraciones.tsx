import { createFileRoute, redirect } from "@tanstack/react-router";

/** Ruta antigua: se mantiene solo para redirigir a «Conexiones». */
export const Route = createFileRoute("/integraciones")({
  beforeLoad: () => {
    throw redirect({ to: "/conexiones" });
  },
});
