import { ExternalLink, Mic, MicOff } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Boton, claseCampo } from "@/components/nex/campos";
import { sonidoFin, sonidoTic } from "@/lib/nex/sonidos";
import { cn } from "@/lib/utils";

type ResultadoVoz = ArrayLike<{ transcript?: string }> & { isFinal: boolean };
type Reconocimiento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ResultadoVoz> }) => void) | null;
};

/** Errores que sí obligan a parar del todo: el resto se reintenta solo. */
export const ERRORES_FATALES = ["not-allowed", "audio-capture", "service-not-allowed"] as const;

export function esErrorFatal(error: string | undefined | null): boolean {
  return ERRORES_FATALES.includes(String(error ?? "") as (typeof ERRORES_FATALES)[number]);
}

/** Une lo dictado al texto que ya hubiera escrito. */
export function unirDictado(actual: string, dicho: string) {
  const base = actual.trimEnd();
  return base ? `${base} ${dicho}` : dicho;
}

/** ¿La app se está usando instalada en la pantalla de inicio? */
export function esAppInstalada(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    return false;
  }
}

const MAXIMO_REINICIOS = 20;

/** Captura, onda y reconocimiento comparten un mismo ciclo. El audio nunca se guarda. */
export function useDictado(alTexto: (texto: string) => void) {
  const [escuchando, setEscuchando] = React.useState(false),
    [iniciando, setIniciando] = React.useState(false),
    [soportado, setSoportado] = React.useState(false),
    [parcial, setParcial] = React.useState(""),
    [hayOnda, setHayOnda] = React.useState(false),
    [avisoNavegador, setAvisoNavegador] = React.useState(false);
  const lienzoOnda = React.useRef<HTMLCanvasElement | null>(null),
    textoRef = React.useRef(alTexto),
    rec = React.useRef<Reconocimiento | null>(null);
  textoRef.current = alTexto;
  const media = React.useRef<MediaStream | null>(null),
    audio = React.useRef<AudioContext | null>(null),
    frame = React.useRef(0),
    sesion = React.useRef(0),
    activo = React.useRef(false),
    montado = React.useRef(false),
    reinicios = React.useRef(0),
    temporizador = React.useRef<ReturnType<typeof setTimeout> | null>(null),
    indices = React.useRef(new Set<number>());

  /** Cierra micrófono y onda; el reconocimiento se gestiona aparte. */
  const cerrarAudio = React.useCallback(() => {
    cancelAnimationFrame(frame.current);
    media.current?.getTracks().forEach((t) => t.stop());
    media.current = null;
    void audio.current?.close();
    audio.current = null;
    if (montado.current) setHayOnda(false);
  }, []);

  const limpiar = React.useCallback(() => {
    activo.current = false;
    sesion.current++;
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    cerrarAudio();
    if (montado.current) {
      setEscuchando(false);
      setIniciando(false);
      setParcial("");
    }
  }, [cerrarAudio]);

  React.useEffect(() => {
    montado.current = true;
    const w = window as unknown as {
      SpeechRecognition?: new () => Reconocimiento;
      webkitSpeechRecognition?: new () => Reconocimiento;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (Ctor) {
      setSoportado(true);
      const r = new Ctor();
      rec.current = r;
      r.lang = "es-ES";
      r.continuous = true;
      r.interimResults = true;
      r.onstart = () => {
        if (montado.current && activo.current) {
          setEscuchando(true);
          setIniciando(false);
        }
      };
      r.onend = () => {
        // Chrome corta el reconocimiento por su cuenta: mientras el usuario no pulse «Parar», se reanuda.
        if (activo.current && reinicios.current < MAXIMO_REINICIOS) {
          reinicios.current += 1;
          temporizador.current = setTimeout(() => {
            if (!activo.current) return;
            try {
              rec.current?.start();
            } catch {
              /* ya estaba arrancando */
            }
          }, 150);
          return;
        }
        limpiar();
      };
      r.onerror = (e) => {
        if (esErrorFatal(e.error)) {
          limpiar();
          if (montado.current)
            toast.error(
              e.error === "not-allowed"
                ? "No se concedió acceso al micrófono. Puedes escribir el texto."
                : "El micrófono no está disponible. Puedes escribir el texto.",
            );
        }
      };
      r.onresult = (e) => {
        if (!montado.current) return;
        let texto = "",
          temporal = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const item = e.results[i];
          if (!item) continue;
          if (item.isFinal && !indices.current.has(i)) {
            indices.current.add(i);
            texto += (item[0]?.transcript ?? "") + " ";
          } else if (!item.isFinal) temporal += item[0]?.transcript ?? "";
        }
        if (texto.trim()) textoRef.current(texto.trim());
        setParcial(temporal);
      };
    }
    return () => {
      montado.current = false;
      activo.current = false;
      if (rec.current) {
        rec.current.onresult = null;
        rec.current.onend = null;
        rec.current.onerror = null;
        rec.current.abort();
      }
      limpiar();
    };
  }, [limpiar]);

  /** La onda es un extra: si falla, el dictado continúa con las barras animadas. */
  const abrirOnda = React.useCallback(async (version: number) => {
    if (typeof navigator.mediaDevices?.getUserMedia !== "function") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!montado.current || !activo.current || sesion.current !== version) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      media.current = stream;
      const context = new AudioContext();
      audio.current = context;
      await context.resume();
      if (!activo.current || sesion.current !== version) {
        stream.getTracks().forEach((t) => t.stop());
        void context.close();
        return;
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      setHayOnda(true);
      const draw = () => {
        if (!activo.current) return;
        const canvas = lienzoOnda.current,
          ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
          canvas.width = canvas.clientWidth || 240;
          canvas.height = canvas.clientHeight || 48;
          const alto = canvas.height;
          analyser.getByteTimeDomainData(samples);
          ctx.clearRect(0, 0, canvas.width, alto);
          ctx.strokeStyle = getComputedStyle(canvas).color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < samples.length; i++) {
            const x = (i * canvas.width) / samples.length,
              y = alto / 2 + ((samples[i]! - 128) / 128) * (alto / 2 - 3);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        frame.current = requestAnimationFrame(draw);
      };
      draw();
    } catch {
      if (montado.current) setHayOnda(false);
    }
  }, []);

  const alternar = async () => {
    if (!rec.current) {
      setAvisoNavegador(true);
      return;
    }
    if (activo.current) {
      activo.current = false;
      sonidoFin();
      try {
        rec.current.stop();
      } catch {
        /* ya estaba parado */
      }
      limpiar();
      return;
    }
    activo.current = true;
    reinicios.current = 0;
    indices.current.clear();
    setIniciando(true);
    const version = ++sesion.current;
    sonidoTic();
    try {
      rec.current.start();
    } catch {
      /* el navegador ya lo tenía arrancado */
    }
    await abrirOnda(version);
  };

  return {
    escuchando,
    iniciando,
    soportado,
    alternar,
    parcial,
    lienzoOnda,
    hayOnda,
    avisoNavegador,
    ocultarAviso: () => setAvisoNavegador(false),
  };
}

/* --------------------------------- Piezas --------------------------------- */

/** Cinco barras que suben y bajan cuando no hay onda real del micrófono. */
export function BarrasEscucha({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex h-8 items-end gap-1", className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
          style={{ height: `${12 + ((i * 7) % 20)}px`, animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

export function AvisoSinDictado({ onCerrar }: { onCerrar?: () => void }) {
  return (
    <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
      <p>Este navegador no permite dictar. Abre NexDeveloper en Safari o Chrome.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          href={typeof window === "undefined" ? "/" : window.location.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-warning/40 px-2 py-1 underline"
        >
          <ExternalLink className="size-3.5" /> Abrir en el navegador
        </a>
        {onCerrar ? (
          <button type="button" onClick={onCerrar} className="rounded-md px-2 py-1 underline">
            Entendido
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Botón de micrófono para dictar dentro de un campo de texto. Siempre visible y pulsable. */
export function BotonDictado({
  onTexto,
  etiqueta = "Dictar",
  className,
}: {
  onTexto: (t: string) => void;
  etiqueta?: string;
  className?: string;
}) {
  const { escuchando, iniciando, alternar, lienzoOnda, hayOnda, parcial, avisoNavegador, ocultarAviso } =
    useDictado(onTexto);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Boton
        type="button"
        title="El reconocimiento de voz depende del navegador. Revisa el texto antes de enviarlo."
        variante="suave"
        aria-pressed={escuchando}
        aria-label={escuchando ? "Dejar de dictar" : etiqueta}
        onClick={alternar}
        className={cn("px-3 py-1.5 text-xs", escuchando && "border-destructive/50 text-destructive", className)}
      >
        {escuchando ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
        {iniciando ? "Iniciando…" : escuchando ? "Parar" : etiqueta}
      </Boton>
      {escuchando ? (
        <>
          <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
            <span className="size-2 animate-pulse rounded-full bg-destructive motion-reduce:animate-none" aria-hidden />
            Te escucho…
          </span>
          {hayOnda ? (
            <canvas aria-label="Onda del micrófono en directo" ref={lienzoOnda} className="h-8 w-24 text-primary" />
          ) : (
            <BarrasEscucha />
          )}
        </>
      ) : null}
      {parcial ? <span className="text-xs italic text-muted-foreground">{parcial}</span> : null}
      {avisoNavegador ? <AvisoSinDictado onCerrar={ocultarAviso} /> : null}
    </span>
  );
}

/** Campo de texto con dictado incorporado: mismo comportamiento en toda la aplicación. */
export function CampoTextoConDictado({
  valor,
  onValor,
  filas = 3,
  placeholder,
  etiquetaDictado = "Dictar",
  className,
  extras,
  onKeyDown,
  areaRef,
}: {
  valor: string;
  onValor: (v: string) => void;
  filas?: number;
  placeholder?: string;
  etiquetaDictado?: string;
  className?: string;
  extras?: React.ReactNode;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  areaRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const propio = React.useRef<HTMLTextAreaElement | null>(null);
  const ref = areaRef ?? propio;
  const { escuchando, iniciando, alternar, lienzoOnda, hayOnda, parcial, avisoNavegador, ocultarAviso } = useDictado(
    (dicho) => onValor(unirDictado(valor, dicho)),
  );

  return (
    <div className={className}>
      <textarea
        ref={ref}
        value={valor}
        rows={filas}
        placeholder={placeholder}
        onChange={(e) => onValor(e.target.value)}
        onKeyDown={onKeyDown}
        className={cn(claseCampo, "resize-y")}
      />
      {parcial ? (
        <div className="mt-1 text-sm italic text-muted-foreground" aria-live="polite">
          {parcial}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Boton
          type="button"
          variante="suave"
          aria-pressed={escuchando}
          onClick={alternar}
          className={cn("px-3 py-1.5 text-xs", escuchando && "border-destructive/50 text-destructive")}
        >
          {escuchando ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          {iniciando ? "Iniciando…" : escuchando ? "Parar" : etiquetaDictado}
        </Boton>
        {extras}
      </div>
      {escuchando ? (
        <div className="mt-2 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
            <span className="size-2 animate-pulse rounded-full bg-destructive motion-reduce:animate-none" aria-hidden />
            Te escucho…
          </span>
          {hayOnda ? (
            <canvas
              aria-label="Onda del micrófono en directo"
              ref={lienzoOnda}
              className="h-10 w-full flex-1 rounded-lg border border-border bg-surface text-primary"
            />
          ) : (
            <BarrasEscucha />
          )}
        </div>
      ) : null}
      {avisoNavegador ? <AvisoSinDictado onCerrar={ocultarAviso} /> : null}
    </div>
  );
}
