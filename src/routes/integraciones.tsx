import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, ShieldCheck } from "lucide-react";

import { Encabezado } from "@/components/nex/app-shell";
import { useNex } from "@/lib/nex/store";

export const Route = createFileRoute("/integraciones")({
  head: () => ({
    meta: [
      { title: "Integraciones y seguridad · NexDeveloper" },
      { name: "description", content: "Cuentas conectadas, acceso por proyecto y gestión segura de secretos." },
      { property: "og:title", content: "Integraciones y seguridad · NexDeveloper" },
      { property: "og:description", content: "Cuentas conectadas y gestión segura de secretos por referencia." },
    ],
  }),
  component: Integraciones,
});

function Integraciones() {
  const { integraciones, proyectos } = useNex();
  const nombre = (id: string) => proyectos.find((p) => p.id === id)?.nombre ?? id;

  return (
    <>
      <Encabezado
        titulo="Integraciones y seguridad"
        descripcion="Los secretos se manejan por referencia: nunca se muestran ni se guardan en texto plano."
      />

      <div className="panel mb-6 flex items-start gap-3 border-warning/40 bg-warning/5 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-warning" />
        <p>
          Toda acción sensible —despliegues, acceso a credenciales o gasto elevado— pide tu aprobación antes de
          ejecutarse. Ninguna integración puede actuar sola.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {integraciones.map((i) => (
          <article key={i.id} className="panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold">{i.nombre}</h2>
                <p className="text-xs text-muted-foreground capitalize">{i.tipo}</p>
              </div>
              <span
                className={
                  i.conectada
                    ? "rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs text-success"
                    : "rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                }
              >
                {i.conectada ? "Conectada" : "Sin conectar"}
              </span>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Acceso a: {i.proyectos.map(nombre).join(", ") || "ningún proyecto"}
            </p>

            <ul className="mt-3 space-y-1.5">
              {i.secretos.map((s) => (
                <li key={s.referencia} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-xs">
                  <span className="flex items-center gap-2 font-mono">
                    <KeyRound className="size-3.5 text-muted-foreground" />
                    {s.referencia}
                  </span>
                  <span className={s.configurado ? "text-success" : "text-muted-foreground"}>
                    {s.configurado ? "configurada" : "sin configurar"}
                  </span>
                </li>
              ))}
            </ul>

            {i.requiereAprobacion && (
              <p className="mt-3 text-xs text-warning">Requiere aprobación humana para cualquier acción.</p>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
