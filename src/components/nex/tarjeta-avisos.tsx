import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { desde } from "@/lib/nex/labels";
import { useAvisos, useRealtimeAvisos } from "@/lib/nex/queries/avisos";

/** Últimos avisos con la campana y el contador de los que quedan sin leer. */
export function TarjetaAvisos() {
  const { data: avisos = [] } = useAvisos(20);
  useRealtimeAvisos();

  const sinLeer = avisos.filter((a) => !a.leido).length;
  const ultimos = avisos.slice(0, 4);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Bell className="size-4 text-primary" /> Últimos avisos
        </h2>
        <Link
          to="/avisos"
          className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary"
          aria-label={`Avisos: ${sinLeer} sin leer`}
        >
          {sinLeer} sin leer
        </Link>
      </div>

      {ultimos.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Todavía no hay avisos. Actívalos en tu móvil desde la pantalla de Avisos.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {ultimos.map((aviso) => (
            <li key={aviso.id}>
              <Link to="/avisos" className="block rounded-lg border border-border bg-surface p-2.5 hover:border-primary/40">
                <span className="flex items-center gap-2">
                  {!aviso.leido ? <span className="size-2 shrink-0 rounded-full bg-primary" /> : null}
                  <span className="truncate text-sm">{aviso.titulo}</span>
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{desde(aviso.creado_el)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
