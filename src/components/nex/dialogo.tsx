import { X } from "lucide-react";
import * as React from "react";

/** Ventana modal sencilla, con el mismo aspecto que el resto de la aplicación. */
export function Dialogo({
  abierto,
  titulo,
  descripcion,
  onCerrar,
  ancho = "max-w-2xl",
  children,
}: {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
  ancho?: string;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-black/50 sm:items-start sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`w-full ${ancho} min-h-full bg-background p-4 shadow-xl sm:min-h-0 sm:rounded-xl sm:border sm:border-border sm:p-5`}
      >

        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">{titulo}</h2>
            {descripcion ? <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p> : null}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
