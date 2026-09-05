import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { useFinalizarCanva } from "@/lib/nex/queries/proveedores";

export const Route = createFileRoute("/ajustes_/proveedores/canva/retorno")({
  head: () => ({
    meta: [
      { title: "Conexión con Canva · NexDeveloper" },
      { name: "description", content: "Paso final de la conexión con Canva: se guardan los permisos de forma cifrada." },
      { property: "og:title", content: "Conexión con Canva · NexDeveloper" },
      {
        property: "og:description",
        content: "Paso final de la conexión con Canva: se guardan los permisos de forma cifrada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RetornoCanva,
});

function RetornoCanva() {
  const navegar = useNavigate();
  const finalizar = useFinalizarCanva();
  const [mensaje, setMensaje] = React.useState("Terminando la conexión con Canva…");
  const hecho = React.useRef(false);

  React.useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;

    const parametros = new URLSearchParams(window.location.search);
    const error = parametros.get("error_description") ?? parametros.get("error");
    const codigo = parametros.get("code");

    if (error || !codigo) {
      setMensaje(error ? `Canva ha cancelado la conexión: ${error}` : "Canva no ha devuelto ningún permiso.");
      return;
    }

    finalizar.mutate(codigo, {
      onSuccess: (cuenta) => {
        toast.success(`Canva conectado como ${cuenta}.`);
        void navegar({ to: "/ajustes/proveedores" });
      },
      onError: (e: Error) => setMensaje(e.message),
    });
  }, [finalizar, navegar]);

  return (
    <>
      <Encabezado titulo="Conexión con Canva" descripcion="Estamos guardando los permisos de forma cifrada en el servidor." />
      <p className="text-sm text-muted-foreground">{mensaje}</p>
      <Link
        to="/ajustes/proveedores"
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver a Proveedores de IA
      </Link>
    </>
  );
}
