/** Sonidos discretos generados con Web Audio API (sin archivos externos). */

const CLAVE_SONIDOS = "nexdeveloper:sonidos";

export function sonidosActivos(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CLAVE_SONIDOS) !== "0";
  } catch {
    return true;
  }
}

export function guardarSonidos(activos: boolean) {
  try {
    window.localStorage.setItem(CLAVE_SONIDOS, activos ? "1" : "0");
    window.dispatchEvent(new Event("nexdeveloper:sonidos"));
  } catch {
    /* sin almacenamiento */
  }
}

let contexto: AudioContext | null = null;

function obtenerContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
    typeof AudioContext | undefined;
  if (!Ctor) return null;
  if (!contexto) contexto = new Ctor();
  if (contexto.state === "suspended")
    void contexto.resume().catch(() => {
      /* El aviso visual permanece si se bloquea el audio. */
    });
  return contexto;
}

function tono(frecuencia: number, duracion: number, retraso = 0, volumen = 0.045) {
  const ctx = obtenerContexto();
  if (!ctx) return;
  const inicio = ctx.currentTime + retraso;
  const osc = ctx.createOscillator();
  const ganancia = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frecuencia;
  ganancia.gain.setValueAtTime(0.0001, inicio);
  ganancia.gain.exponentialRampToValueAtTime(volumen, inicio + 0.015);
  ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
  osc.connect(ganancia).connect(ctx.destination);
  osc.start(inicio);
  osc.stop(inicio + duracion + 0.02);
}

function reproducir(fn: () => void) {
  if (!sonidosActivos()) return;
  try {
    fn();
  } catch {
    /* el navegador no ha permitido sonido */
  }
}

/** Tic corto: al empezar algo. */
export function sonidoTic() {
  reproducir(() => tono(880, 0.07));
}

/** Doble tono agradable: ha ido bien. */
export function sonidoExito() {
  reproducir(() => {
    tono(660, 0.1);
    tono(990, 0.16, 0.11);
  });
}

/** Tono grave: algo ha fallado. */
export function sonidoError() {
  reproducir(() => {
    tono(220, 0.28, 0, 0.06);
  });
}

/** Dos notas descendentes: se ha dejado de escuchar. */
export function sonidoFin() {
  reproducir(() => {
    tono(660, 0.09, 0, 0.04);
    tono(440, 0.12, 0.07, 0.04);
  });
}

/** Se llama durante el clic de envío para habilitar el aviso posterior. */
export function prepararSonido() {
  reproducir(() => {
    obtenerContexto();
  });
}

/** Aviso de finalización perceptible, una sola vez por cambio de estado. */
export function sonidoTrabajoTerminado() {
  reproducir(() => {
    tono(660, 0.22, 0, 0.12);
    tono(880, 0.22, 0.28, 0.12);
    tono(1100, 0.35, 0.56, 0.12);
  });
}
