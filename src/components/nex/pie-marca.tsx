import { MessageCircle } from "lucide-react";

import { useAutoria, useConfiguracionApp } from "@/lib/nex/queries/datos";
import { cn } from "@/lib/utils";

/** Indica si la leyenda «Powered by» debe verse según la configuración de autoría. */
export function debeMostrarPie(mostrar: string | undefined): boolean {
  return mostrar === "siempre" || mostrar === "solo_marca_propia";
}

export function LeyendaAutoria({ className }: { className?: string }) {
  const { data } = useAutoria();
  if (!data?.powered_by || !debeMostrarPie(data.mostrar_en_pie)) return null;

  const estilo = cn(
    "text-[10px] text-muted-foreground/40 transition-opacity hover:text-muted-foreground",
    className,
  );
  const texto = `Powered by ${data.powered_by}`;

  if (data.url) {
    return (
      <a href={data.url} target="_blank" rel="noreferrer" className={estilo}>
        {texto}
      </a>
    );
  }
  return <span className={estilo}>{texto}</span>;
}

export function PieMarca({ className }: { className?: string }) {
  const { data } = useConfiguracionApp();
  const { data: autoria } = useAutoria();
  const whatsapp = data?.["whatsapp_url"];
  const hayLeyenda = Boolean(autoria?.powered_by) && debeMostrarPie(autoria?.mostrar_en_pie);

  if (!hayLeyenda && !whatsapp) return null;

  return (
    <div className={cn("flex items-center justify-between gap-2 px-1 py-2", className)}>
      {hayLeyenda ? <LeyendaAutoria /> : <span />}
      {whatsapp ? (
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir WhatsApp"
          title="Contactar por WhatsApp"
          className="-m-2 inline-flex size-11 items-center justify-center text-muted-foreground/40 transition-colors hover:text-success"
        >
          <MessageCircle className="size-4" />
        </a>
      ) : null}
    </div>
  );
}
