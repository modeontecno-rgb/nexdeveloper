import { CheckCircle2, CircleAlert, Play, Plus, ShieldCheck, X } from "lucide-react";
import * as React from "react";

import { Boton, claseCampo } from "@/components/nex/campos";
import { FormularioAccion } from "@/components/nex/formulario-accion";
import { CAMPOS_ACCION } from "@/lib/nex/acciones-campos";
import type { AccionRow, EstadoAccion } from "@/lib/nex/db-types";
import { ETIQUETA_ESTADO_ACCION, ETIQUETA_TIPO_ACCION, formatoFechaHora } from "@/lib/nex/labels";
import { useEjecutarAccion, useResolverAccion } from "@/lib/nex/queries/acciones";
import { useAcciones } from "@/lib/nex/queries/datos";

const COLOR: Record<EstadoAccion, string> = {
  borrador: "border-border bg-muted text-muted-foreground",
  pendiente_aprobacion: "border-warning/40 bg-warning/10 text-warning",
  aprobada: "border-primary/40 bg-primary/10 text-primary",
  ejecutando: "border-primary/40 bg-primary/10 text-primary",
  completada: "border-success/40 bg-success/10 text-success",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  cancelada: "border-border bg-muted text-muted-foreground",
};

export function PanelAcciones({ proyectoId }: { proyectoId: string | null }) {
  const { data: acciones = [] } = useAcciones(proyectoId ?? undefined);
  const [abierto, setAbierto] = React.useState(false);

  return (
    <section className="panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold">Acciones reales</h2>
          <p className="text-xs text-muted-foreground">
            Cambios sobre tu base de datos, tus repositorios y otros servicios.
          </p>
        </div>
        <Boton className="px-2.5 py-1 text-xs" onClick={() => setAbierto(true)}>
          <Plus className="size-3.5" /> Nueva acción
        </Boton>
      </header>

      <ul className="divide-y divide-border">
        {acciones.map((a) => (
          <FilaAccion key={a.id} accion={a} />
        ))}
        {acciones.length === 0 && (
          <li className="px-4 py-6 text-sm text-muted-foreground">Todavía no has creado ninguna acción.</li>
        )}
      </ul>

      <FormularioAccion abierto={abierto} onCerrar={() => setAbierto(false)} proyectoId={proyectoId} />
    </section>
  );
}

function FilaAccion({ accion }: { accion: AccionRow }) {
  const resolver = useResolverAccion();
  const ejecutar = useEjecutarAccion();
  const [secreto, setSecreto] = React.useState("");

  const campoSecreto = CAMPOS_ACCION[accion.tipo].find((c) => c.esSecreto);
  const puedeEjecutar = accion.estado === "aprobada";

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{accion.titulo}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ETIQUETA_TIPO_ACCION[accion.tipo]} · {formatoFechaHora(accion.creado_el)}
            {accion.aprobada_por ? ` · aprobada por ${accion.aprobada_por}` : ""}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs ${COLOR[accion.estado]}`}>
          {ETIQUETA_ESTADO_ACCION[accion.estado]}
        </span>
      </div>

      {accion.error ? (
        <p className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {accion.error}
        </p>
      ) : null}

      {accion.resultado ? (
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
          {JSON.stringify(accion.resultado, null, 2)}
        </pre>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {accion.estado === "pendiente_aprobacion" ? (
          <>
            <Boton
              className="px-2.5 py-1 text-xs"
              disabled={resolver.isPending}
              onClick={() => resolver.mutate({ accion, decision: "aprobada" })}
            >
              <ShieldCheck className="size-3.5" /> Aprobar
            </Boton>
            <Boton
              variante="peligro"
              className="px-2.5 py-1 text-xs"
              disabled={resolver.isPending}
              onClick={() => resolver.mutate({ accion, decision: "cancelada" })}
            >
              <X className="size-3.5" /> Rechazar
            </Boton>
          </>
        ) : null}

        {puedeEjecutar ? (
          <>
            {campoSecreto ? (
              <input
                type="password"
                value={secreto}
                onChange={(e) => setSecreto(e.target.value)}
                placeholder={campoSecreto.etiqueta}
                className={`${claseCampo} max-w-xs`}
              />
            ) : null}
            <Boton
              className="px-2.5 py-1 text-xs"
              disabled={ejecutar.isPending || (!!campoSecreto && !secreto.trim())}
              onClick={() =>
                ejecutar.mutate(
                  { accionId: accion.id, ...(secreto.trim() ? { valorSecreto: secreto.trim() } : {}) },
                  { onSuccess: () => setSecreto("") },
                )
              }
            >
              <Play className="size-3.5" /> Ejecutar ahora
            </Boton>
          </>
        ) : null}

        {accion.estado === "completada" ? (
          <span className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="size-3.5" /> Ejecutada {accion.ejecutada_el ? formatoFechaHora(accion.ejecutada_el) : ""}
          </span>
        ) : null}
      </div>
    </li>
  );
}
