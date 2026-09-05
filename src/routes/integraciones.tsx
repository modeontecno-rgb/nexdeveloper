import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, KeyRound, Lock, Pencil, Plug, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando } from "@/components/nex/badges";
import { Boton } from "@/components/nex/campos";
import { FormularioIntegracion } from "@/components/nex/formulario-integracion";
import type { IntegracionRow } from "@/lib/nex/db-types";
import { useBorrarIntegracion } from "@/lib/nex/queries/integraciones";
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
  const borrar = useBorrarIntegracion();
  const [abierto, setAbierto] = React.useState(false);
  const [editando, setEditando] = React.useState<IntegracionRow | undefined>(undefined);

  const abrirNueva = () => {
    setEditando(undefined);
    setAbierto(true);
  };
  const abrirEdicion = (i: IntegracionRow) => {
    setEditando(i);
    setAbierto(true);
  };

  if (isPending) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Integraciones y seguridad"
        descripcion="Ninguna contraseña ni clave se guarda en texto plano: solo se muestra si está configurada."
        acciones={
          <Boton onClick={abrirNueva}>
            <Plus className="size-4" /> Nueva integración
          </Boton>
        }
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
                <div className="flex items-center gap-2">
                <span
                  className={
                    i.conectada
                      ? "rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs text-success"
                      : "rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                  }
                >
                  {i.conectada ? "Conectada" : "Sin conectar"}
                </span>
                  <button
                    type="button"
                    aria-label={`Editar ${i.nombre}`}
                    onClick={() => abrirEdicion(i)}
                    className="rounded-md p-1.5 text-muted-foreground transition hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  {!i.es_predefinida ? (
                    <button
                      type="button"
                      aria-label={`Eliminar ${i.nombre}`}
                      onClick={() => borrar.mutate(i)}
                      className="rounded-md p-1.5 text-muted-foreground transition hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              {i.descripcion ? <p className="mt-3 text-sm text-muted-foreground">{i.descripcion}</p> : null}

              {(i.capacidades ?? []).length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {(i.capacidades ?? []).map((c) => (
                    <li key={c} className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted-foreground">
                      {c}
                    </li>
                  ))}
                </ul>
              ) : null}

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

              {i.url_panel || i.url_docs ? (
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  {i.url_panel ? (
                    <a href={i.url_panel} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      Panel del servicio <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                  {i.url_docs ? (
                    <a href={i.url_docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      Documentación <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
              ) : null}

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

      <FormularioIntegracion abierto={abierto} onCerrar={() => setAbierto(false)} integracion={editando} />
    </>
  );
}
