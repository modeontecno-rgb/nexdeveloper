import { BellRing, Check, ListChecks } from "lucide-react";

import { EstadoTareaBadge, PrioridadBadge, Progreso } from "@/components/nex/badges";
import { Boton } from "@/components/nex/campos";
import type { TareaAtencionRow } from "@/lib/nex/db-types";
import { desde } from "@/lib/nex/labels";
import { useMarcarAtendida } from "@/lib/nex/queries/atencion";

const PESO = { critica: 0, alta: 1, media: 2, baja: 3 } as const;

/** Separa el trabajo que va solo del que te está esperando a ti. */
export function TareasEnBloques({
  tareas,
  mostrarProyecto = false,
}: {
  tareas: TareaAtencionRow[];
  mostrarProyecto?: boolean;
}) {
  const atencion = tareas
    .filter((t) => t.bloque === "requiere_atencion")
    .sort((a, b) => PESO[a.prioridad] - PESO[b.prioridad] || a.ultima_actividad.localeCompare(b.ultima_actividad));
  const desatendido = tareas.filter((t) => t.bloque === "desatendida");

  return (
    <div className="space-y-6">
      <Bloque
        id="requieren-atencion"
        titulo={`Requiere tu atención (${atencion.length})`}
        descripcion="Estas tareas están paradas hasta que hagas algo tú."
        icono={<BellRing className="size-4 text-warning" />}
        vacio="Nada te está esperando ahora mismo."
        tareas={atencion}
        mostrarProyecto={mostrarProyecto}
        destacado
      />
      <Bloque
        titulo={`Trabajo desatendido (${desatendido.length})`}
        descripcion="Avanza solo, sin que tengas que intervenir."
        icono={<ListChecks className="size-4 text-primary" />}
        vacio="No hay trabajo automático en marcha."
        tareas={desatendido}
        mostrarProyecto={mostrarProyecto}
      />
    </div>
  );
}

function Bloque({
  id,
  titulo,
  descripcion,
  icono,
  vacio,
  tareas,
  mostrarProyecto,
  destacado = false,
}: {
  id?: string;
  titulo: string;
  descripcion: string;
  icono: React.ReactNode;
  vacio: string;
  tareas: TareaAtencionRow[];
  mostrarProyecto: boolean;
  destacado?: boolean;
}) {
  const atender = useMarcarAtendida();

  return (
    <section id={id} className="panel overflow-hidden">
      <header
        className={
          destacado
            ? "flex flex-wrap items-center gap-2 border-b border-warning/40 bg-warning/10 px-4 py-3"
            : "flex flex-wrap items-center gap-2 border-b border-border px-4 py-3"
        }
      >
        {icono}
        <h2 className="font-display text-sm font-semibold">{titulo}</h2>
        <p className="text-xs text-muted-foreground">{descripcion}</p>
      </header>

      <ul className="divide-y divide-border">
        {tareas.map((t) => (
          <li key={t.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{t.titulo}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {mostrarProyecto ? `${t.proyecto_nombre ?? "Sin clasificar"} · ` : ""}
                  {t.agente_nombre ?? "Sin asignar"} · {desde(t.ultima_actividad)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <EstadoTareaBadge estado={t.estado} />
                <PrioridadBadge prioridad={t.prioridad} />
              </div>
            </div>

            {t.motivo_atencion ? (
              <p className="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                Motivo: {t.motivo_atencion}
              </p>
            ) : null}
            {t.instrucciones ? (
              <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
                {t.instrucciones}
              </p>
            ) : null}

            <Progreso className="mt-3" valor={Number(t.progreso)} />

            {t.bloque === "requiere_atencion" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Boton
                  variante="suave"
                  className="px-2.5 py-1 text-xs"
                  disabled={atender.isPending}
                  onClick={() => atender.mutate({ id: t.id, titulo: t.titulo, proyectoId: t.proyecto_id })}
                >
                  <Check className="size-3.5" /> Ya lo he hecho
                </Boton>
                <BotonConvocarMesa
                  etiqueta="Pedir opinión a la mesa"
                  className="px-2.5 py-1 text-xs"
                  tareaId={t.id}
                  pregunta={`${t.titulo}${t.motivo_atencion ? `\n\nMotivo: ${t.motivo_atencion}` : ""}`}
                  {...(t.proyecto_id ? { proyectoId: t.proyecto_id } : {})}
                />
              </div>
            ) : null}

          </li>
        ))}
        {tareas.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">{vacio}</li>}
      </ul>
    </section>
  );
}
