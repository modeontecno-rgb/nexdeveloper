import { ExternalLink, Maximize2, Minimize2, Pin, PinOff, RefreshCw, X } from "lucide-react";
import * as React from "react";

import type { PosicionPanel, PreviewRow } from "@/lib/nex/db-types";
import { useGuardarPosicionPreview } from "@/lib/nex/queries/previews";

const POSICION_INICIAL: PosicionPanel = { x: 24, y: 96, ancho: 420, alto: 560, anclado: false };

function leerPosicion(preview: PreviewRow): PosicionPanel {
  const guardada = preview.posicion as Partial<PosicionPanel> | null;
  return { ...POSICION_INICIAL, ...(guardada ?? {}) };
}

/** Ventana flotante con la vista previa del proyecto: se mueve, se ancla y recuerda dónde la dejaste. */
export function PanelPreview({ preview, onCerrar }: { preview: PreviewRow; onCerrar: () => void }) {
  const guardar = useGuardarPosicionPreview();
  const [pos, setPos] = React.useState<PosicionPanel>(() => leerPosicion(preview));
  const [ampliado, setAmpliado] = React.useState(false);
  const [recarga, setRecarga] = React.useState(0);
  const arrastre = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => setPos(leerPosicion(preview)), [preview.id]);

  const persistir = React.useCallback(
    (siguiente: PosicionPanel) => guardar.mutate({ id: preview.id, posicion: siguiente }),
    [guardar, preview.id],
  );

  const alBajar = (e: React.PointerEvent) => {
    if (pos.anclado || ampliado) return;
    arrastre.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const alMover = (e: React.PointerEvent) => {
    if (!arrastre.current) return;
    setPos((p) => ({
      ...p,
      x: Math.max(0, Math.min(window.innerWidth - 200, e.clientX - arrastre.current!.x)),
      y: Math.max(0, Math.min(window.innerHeight - 80, e.clientY - arrastre.current!.y)),
    }));
  };
  const alSoltar = () => {
    if (!arrastre.current) return;
    arrastre.current = null;
    persistir(pos);
  };

  const estilo: React.CSSProperties = ampliado
    ? { inset: "1rem" }
    : pos.anclado
      ? { right: "1rem", bottom: "1rem", width: pos.ancho, height: pos.alto }
      : { left: pos.x, top: pos.y, width: pos.ancho, height: pos.alto };

  return (
    <div
      className="panel fixed z-40 flex flex-col overflow-hidden bg-background shadow-2xl"
      style={estilo}
      role="complementary"
      aria-label={`Vista previa de ${preview.titulo}`}
    >
      <header
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        className={`flex items-center justify-between gap-2 border-b border-border px-3 py-2 ${
          pos.anclado || ampliado ? "" : "cursor-move"
        }`}
      >
        <p className="truncate text-xs font-medium text-foreground">{preview.titulo}</p>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Icono etiqueta="Recargar" onClick={() => setRecarga((r) => r + 1)}>
            <RefreshCw className="size-3.5" />
          </Icono>
          <Icono
            etiqueta={pos.anclado ? "Soltar de la esquina" : "Anclar en la esquina"}
            onClick={() => {
              const siguiente = { ...pos, anclado: !pos.anclado };
              setPos(siguiente);
              persistir(siguiente);
            }}
          >
            {pos.anclado ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
          </Icono>
          <Icono etiqueta={ampliado ? "Reducir" : "Ampliar"} onClick={() => setAmpliado((v) => !v)}>
            {ampliado ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Icono>
          <a
            href={preview.url}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir en una pestaña nueva"
            className="rounded p-1 transition hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
          </a>
          <Icono etiqueta="Cerrar" onClick={onCerrar}>
            <X className="size-3.5" />
          </Icono>
        </div>
      </header>

      <iframe
        key={recarga}
        src={preview.url}
        title={preview.titulo}
        className="flex-1 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}

function Icono({ etiqueta, onClick, children }: { etiqueta: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={etiqueta} title={etiqueta} onClick={onClick} className="rounded p-1 transition hover:text-foreground">
      {children}
    </button>
  );
}
