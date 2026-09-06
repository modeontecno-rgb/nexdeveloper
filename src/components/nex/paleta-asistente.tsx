import { useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import * as React from "react";

import { Boton, claseCampo } from "@/components/nex/campos";
import { SUGERENCIAS } from "@/routes/asistente";
import { cn } from "@/lib/utils";

/** Paleta rápida del asistente: se abre con Ctrl/Cmd + K desde cualquier pantalla. */
export function PaletaAsistente() {
  const navegar = useNavigate();
  const [abierta, setAbierta] = React.useState(false);
  const [texto, setTexto] = React.useState("");

  React.useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierta((v) => !v);
      }
      if (e.key === "Escape") setAbierta(false);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  if (!abierta) return null;

  const preguntar = (pregunta: string) => {
    const limpio = pregunta.trim();
    if (!limpio) return;
    setAbierta(false);
    setTexto("");
    void navegar({ to: "/asistente", search: { q: limpio } });
  };

  return (
    <div
      role="dialog"
      aria-label="Preguntar al asistente"
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 p-4 pt-24 backdrop-blur-sm"
      onClick={() => setAbierta(false)}
    >
      <div className="panel w-full max-w-xl p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Sparkles className="size-4 text-primary" /> Pregúntale a NexDeveloper
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            preguntar(texto);
          }}
          className="mt-3 flex gap-2"
        >
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="¿Qué requiere mi atención hoy?"
            className={cn(claseCampo, "flex-1")}
          />
          <Boton type="submit" disabled={!texto.trim()}>
            Preguntar
          </Boton>
        </form>
        <ul className="mt-3 space-y-1">
          {SUGERENCIAS.slice(0, 4).map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => preguntar(s)}
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
