import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Lock, Plug } from "lucide-react";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando } from "@/components/nex/badges";
import { ETIQUETA_TIPO_INTEGRACION, formatoFecha } from "@/lib/nex/labels";
import { useCredenciales, useIntegraciones } from "@/lib/nex/queries/datos";

export const Route = createFileRoute("/integraciones")({
  head: () => ({
    meta: [
      { title: "Integraciones y seguridad · NexDeveloper" },
      { name: "description", content: "Servicios conectados y credenciales guardadas siempre cifradas." },
      { property: "og:title", content: "Integraciones y seguridad · NexDeveloper" },
      { property: "og:description", content: "Servicios conectados y credenciales guardadas siempre cifradas." },
    ],
  }),
  component: Integraciones,
});

const ETIQUETA_UBICACION = {
  vault: "Bóveda cifrada",
  supabase_secret: "Secreto del servidor",
  externo: "Servicio externo",
} as const;

function Integraciones() {
  const { data: integraciones = [], isPending } = useIntegraciones();
  const { data: credenciales = [] } = useCredenciales();

  if (isPending) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Integraciones y seguridad"
        descripcion="Ninguna contraseña ni clave se guarda en texto plano: solo se muestra si está configurada."
      />

      <div className="panel mb-6 flex items-start gap-3 p-4 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          Las claves viven en una bóveda cifrada. Desde aquí solo puedes ver el nombre de la referencia, si está
          configurada y cuándo se cambió por última vez.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {integraciones.map((i) => {
          const claves = credenciales.filter((c) => c.integracion_id === i.id);
          return (
            <article key={i.id} className="panel p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-lg bg-accent/10 text-accent">
                    <Plug className="size-4" />
                  </span>
                  <div>
                    <h2 className="font-display text-base font-semibold">{i.nombre}</h2>
                    <p className="text-xs text-muted-foreground">
                      {ETIQUETA_TIPO_INTEGRACION[i.tipo]}
                      {i.cuenta ? ` · ${i.cuenta}` : ""}
                    </p>
                  </div>
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

              <ul className="mt-4 space-y-2">
                {claves.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                  >
                    <span className="flex items-center gap-2 text-foreground">
                      <KeyRound className="size-3.5 text-muted-foreground" />
                      {c.referencia}
                    </span>
                    <span className="text-muted-foreground">
                      {ETIQUETA_UBICACION[c.ubicacion]} ·{" "}
                      <span className={c.configurado ? "text-success" : "text-warning"}>
                        {c.configurado ? "configurada" : "sin configurar"}
                      </span>
                      {c.ultima_rotacion ? ` · cambiada ${formatoFecha(c.ultima_rotacion)}` : ""}
                    </span>
                  </li>
                ))}
                {claves.length === 0 && (
                  <li className="text-xs text-muted-foreground">Esta integración aún no tiene credenciales.</li>
                )}
              </ul>

              <p className="mt-3 text-xs text-muted-foreground">
                {i.requiere_aprobacion
                  ? "Las acciones de esta integración requieren tu aprobación."
                  : "Las acciones de esta integración se ejecutan automáticamente."}
              </p>
            </article>
          );
        })}
        {integraciones.length === 0 && (
          <p className="panel p-6 text-sm text-muted-foreground">Todavía no hay integraciones registradas.</p>
        )}
      </div>
    </>
  );
}
