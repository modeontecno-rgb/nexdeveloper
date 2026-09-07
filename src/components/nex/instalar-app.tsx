import * as React from "react";
import { Download, Share } from "lucide-react";

import { Dialogo } from "@/components/nex/dialogo";
import { cn } from "@/lib/utils";

/**
 * Botón «Instalar aplicación»: usa el aviso nativo del navegador cuando está
 * disponible (Android/Chrome/Edge) y muestra instrucciones en iPhone/iPad.
 * Si la app ya está instalada, el botón no se muestra.
 */

type EventoInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function esIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function yaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function BotonInstalar({ compacto = false }: { compacto?: boolean }) {
  const [evento, setEvento] = React.useState<EventoInstalacion | null>(null);
  const [instalada, setInstalada] = React.useState(yaInstalada);
  const [ayudaIOS, setAyudaIOS] = React.useState(false);

  React.useEffect(() => {
    const alListo = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalacion);
    };
    const alInstalar = () => {
      setInstalada(true);
      setEvento(null);
    };
    window.addEventListener("beforeinstallprompt", alListo);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alListo);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  if (instalada) return null;

  const pulsar = async () => {
    if (evento) {
      await evento.prompt();
      const eleccion = await evento.userChoice;
      if (eleccion.outcome === "accepted") setInstalada(true);
      setEvento(null);
      return;
    }
    // Sin aviso nativo: en iPhone/iPad hay que hacerlo desde Compartir.
    if (esIOS()) setAyudaIOS(true);
  };

  // Solo se muestra si hay aviso nativo o es iOS (donde damos instrucciones).
  if (!evento && !esIOS()) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => void pulsar()}
        title="Instalar aplicación"
        className={cn(
          "inline-flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent",
          compacto && "justify-center px-0",
        )}
      >
        <Download className="size-3.5 shrink-0" />
        {!compacto && "Instalar aplicación"}
      </button>

      <Dialogo
        abierto={ayudaIOS}
        titulo="Instalar en este iPhone o iPad"
        descripcion="Safari no muestra el aviso automático, pero se instala en dos toques:"
        onCerrar={() => setAyudaIOS(false)}
        ancho="max-w-md"
      >
          <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
            <li className="flex items-start gap-2">
              <Share className="mt-0.5 size-4 shrink-0" />
              <span>Pulsa el botón <strong>Compartir</strong> de Safari (el cuadrado con la flecha hacia arriba).</span>
            </li>
            <li>Baja en la lista y elige <strong>«Añadir a pantalla de inicio»</strong>.</li>
            <li>Confirma con <strong>Añadir</strong>: aparecerá el icono de NexDeveloper junto a tus apps.</li>
          </ol>
      </Dialogo>
    </>
  );
}
