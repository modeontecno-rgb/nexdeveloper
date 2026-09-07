import { Mic, MicOff } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Boton } from "@/components/nex/campos";
import { cn } from "@/lib/utils";

/** Dictado por voz del navegador en español de España, si está disponible. */
export function useDictado(alTexto: (t: string) => void) {
  const [escuchando, setEscuchando] = React.useState(false);
  const [soportado, setSoportado] = React.useState(false);
  const refReconocimiento = React.useRef<{ start: () => void; stop: () => void } | null>(null);
  const refTexto = React.useRef(alTexto);
  refTexto.current = alTexto;

  React.useEffect(() => {
    const ventana = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const Constructor = (ventana.SpeechRecognition ?? ventana.webkitSpeechRecognition) as
      | (new () => Record<string, unknown>)
      | undefined;
    if (!Constructor) return;
    setSoportado(true);
    const reconocimiento = new Constructor() as Record<string, unknown> & { start: () => void; stop: () => void };
    reconocimiento["lang"] = "es-ES";
    reconocimiento["interimResults"] = false;
    reconocimiento["continuous"] = true;
    reconocimiento["onresult"] = (evento: unknown) => {
      const resultados = (evento as { results?: ArrayLike<ArrayLike<{ transcript?: string }>>; resultIndex?: number });
      const lista = resultados.results;
      const desde = resultados.resultIndex ?? 0;
      if (!lista) return;
      let dicho = "";
      for (let i = desde; i < lista.length; i += 1) dicho += lista[i]?.[0]?.transcript ?? "";
      if (dicho.trim()) refTexto.current(dicho.trim());
    };
    reconocimiento["onend"] = () => setEscuchando(false);
    reconocimiento["onerror"] = () => {
      setEscuchando(false);
      toast.error("No se ha podido usar el micrófono.");
    };
    refReconocimiento.current = reconocimiento;
    return () => {
      try {
        reconocimiento.stop();
      } catch {
        /* ya parado */
      }
    };
  }, []);

  const alternar = () => {
    const reconocimiento = refReconocimiento.current;
    if (!reconocimiento) return;
    if (escuchando) {
      reconocimiento.stop();
      setEscuchando(false);
      return;
    }
    try {
      reconocimiento.start();
      setEscuchando(true);
    } catch {
      setEscuchando(false);
    }
  };

  return { escuchando, soportado, alternar };
}

/** Une lo dictado al texto que ya hubiera escrito. */
export function unirDictado(actual: string, dicho: string) {
  const base = actual.trimEnd();
  return base ? `${base} ${dicho}` : dicho;
}

/** Botón de micrófono para dictar dentro de un campo de texto. */
export function BotonDictado({
  onTexto,
  etiqueta = "Dictar",
  className,
}: {
  onTexto: (t: string) => void;
  etiqueta?: string;
  className?: string;
}) {
  const { escuchando, soportado, alternar } = useDictado(onTexto);
  if (!soportado) return null;
  return (
    <Boton
      type="button"
      variante="suave"
      aria-label={escuchando ? "Dejar de dictar" : etiqueta}
      onClick={alternar}
      className={cn("px-3 py-1.5 text-xs", escuchando && "border-primary/60 text-primary", className)}
    >
      {escuchando ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
      {escuchando ? "Te escucho…" : etiqueta}
    </Boton>
  );
}
