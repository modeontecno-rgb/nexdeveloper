import { Link } from "@tanstack/react-router";
import { Play, Square, Timer } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Boton } from "@/components/nex/campos";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  transcurrido,
  useCronometro,
  useIniciarCronometro,
  usePararCronometro,
} from "@/lib/nex/queries/facturacion";

/** Reloj que se actualiza cada segundo mientras el cronómetro está en marcha. */
function useTicTac(activo: boolean) {
  const [, refrescar] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (!activo) return;
    const id = window.setInterval(refrescar, 1000);
    return () => window.clearInterval(id);
  }, [activo]);
}

/** Barra fija con el cronómetro en marcha, visible en toda la aplicación. */
export function CronometroBarra() {
  const { data: enMarcha } = useCronometro();
  const { data: proyectos = [] } = useProyectos();
  const parar = usePararCronometro();
  useTicTac(Boolean(enMarcha));

  if (!enMarcha?.inicio) return null;

  const proyecto = proyectos.find((p) => p.id === enMarcha.proyecto_id);

  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 lg:bottom-4 lg:left-auto lg:right-4 lg:translate-x-0">
      <div className="panel flex items-center gap-3 bg-background/95 p-3 shadow-lg backdrop-blur">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Timer className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">
            {proyecto?.nombre ?? "Proyecto"}
            {enMarcha.descripcion ? ` · ${enMarcha.descripcion}` : ""}
          </p>
          <p className="font-display text-base font-semibold tabular-nums">{transcurrido(enMarcha.inicio)}</p>
        </div>
        <Link to="/facturacion" className="text-xs text-primary hover:underline">
          Ver
        </Link>
        <Boton
          variante="peligro"
          disabled={parar.isPending}
          onClick={async () => {
            try {
              await parar.mutateAsync(undefined);
              toast.success("Cronómetro parado y horas registradas.");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          <Square className="size-3.5" /> Parar
        </Boton>
      </div>
    </div>
  );
}

/** Botón para arrancar el cronómetro desde la ficha de un proyecto. */
export function BotonCronometroProyecto({ proyectoId }: { proyectoId: string }) {
  const { data: enMarcha } = useCronometro();
  const iniciar = useIniciarCronometro();
  const parar = usePararCronometro();
  const corriendoAqui = enMarcha?.proyecto_id === proyectoId;

  if (corriendoAqui) {
    return (
      <Boton
        variante="peligro"
        disabled={parar.isPending}
        onClick={async () => {
          try {
            await parar.mutateAsync(undefined);
            toast.success("Cronómetro parado y horas registradas.");
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      >
        <Square className="size-3.5" /> Parar el cronómetro
      </Boton>
    );
  }

  return (
    <Boton
      variante="suave"
      disabled={iniciar.isPending || Boolean(enMarcha)}
      title={enMarcha ? "Ya hay un cronómetro en marcha en otro proyecto" : undefined}
      onClick={async () => {
        try {
          await iniciar.mutateAsync({ proyecto_id: proyectoId });
          toast.success("Cronómetro en marcha.");
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    >
      <Play className="size-3.5" /> Iniciar cronómetro
    </Boton>
  );
}
