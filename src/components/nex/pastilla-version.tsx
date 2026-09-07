import { toast } from "sonner";

import { VERSION_APP } from "@/lib/version";
import { cn } from "@/lib/utils";

async function copiarVersion() {
  try {
    await navigator.clipboard.writeText(`v${VERSION_APP}`);
    toast.success("Versión copiada");
  } catch {
    toast.error("Tu navegador no ha permitido copiar la versión.");
  }
}

/** Etiqueta discreta con la versión; al pulsarla la copia. */
export function PastillaVersion({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => void copiarVersion()}
      title="Copiar la versión"
      className={cn(
        "rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/60 transition-colors hover:text-foreground",
        className,
      )}
    >
      v{VERSION_APP}
    </button>
  );
}

/** Pastilla fija abajo a la derecha, para pantallas sin menú lateral. */
export function PastillaVersionFija({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none fixed right-3 bottom-3 z-40", className)}
      style={{ paddingBottom: "env(safe-area-inset-bottom)", paddingRight: "env(safe-area-inset-right)" }}
    >
      <PastillaVersion className="pointer-events-auto bg-surface/80 backdrop-blur" />
    </div>
  );
}
