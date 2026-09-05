import { MessageCircle } from "lucide-react";

import { useConfiguracionApp } from "@/lib/nex/queries/datos";
import { cn } from "@/lib/utils";

export function PieMarca({ className }: { className?: string }) {
  const { data } = useConfiguracionApp();
  const poweredBy = data?.["powered_by"];
  const whatsapp = data?.["whatsapp_url"];

  if (!poweredBy && !whatsapp) return null;

  return (
    <div className={cn("flex items-center justify-between gap-2 px-1 py-2", className)}>
      {poweredBy ? (
        <span className="text-[10px] text-muted-foreground/40 transition-opacity hover:text-muted-foreground">
          Powered by {poweredBy}
        </span>
      ) : (
        <span />
      )}
      {whatsapp ? (
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir WhatsApp"
          title="Contactar por WhatsApp"
          className="text-muted-foreground/40 transition-colors hover:text-success"
        >
          <MessageCircle className="size-4" />
        </a>
      ) : null}
    </div>
  );
}
