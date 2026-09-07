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
    | typeof AudioContext
    | undefined;
  if (!Ctor) return null;
  if (!contexto) contexto = new Ctor();
  if (contexto.state === "suspended") void contexto.resume();
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
