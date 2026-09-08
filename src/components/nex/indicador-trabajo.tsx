import { Check, Cpu, X } from "lucide-react";
import * as React from "react";

import { sonidoError, sonidoExito, sonidoTic } from "@/lib/nex/sonidos";
import { cn } from "@/lib/utils";

/* ------------------------------- Modelo puro ------------------------------ */

export type FaseTrabajo = "activo" | "ok" | "error";

export type EstadoTrabajo = {
  id: number;
  titulo: string;
  pasos: string[];
  indice: number;
  porcentaje: number | null;
  fase: FaseTrabajo;
  mensaje: string | null;
  inicio: number;
};

let contadorTrabajos = 0;

export function crearTrabajo(titulo: string, pasos: string[] = [], ahora = Date.now()): EstadoTrabajo {
  contadorTrabajos += 1;
  return {
    id: contadorTrabajos,
    titulo,
    pasos,
    indice: pasos.length ? 0 : -1,
    porcentaje: null,
    fase: "activo",
    mensaje: null,
    inicio: ahora,
  };
}

export function avanzarTrabajo(estado: EstadoTrabajo, paso: string, porcentaje?: number): EstadoTrabajo {
  const pasos = estado.pasos.includes(paso) ? estado.pasos : [...estado.pasos, paso];
  return {
    ...estado,
    pasos,
    indice: pasos.indexOf(paso),
    porcentaje: typeof porcentaje === "number" && Number.isFinite(porcentaje) ? Math.max(0, Math.min(100, Math.round(porcentaje))) : null,
    fase: "activo",
  };
}

export function terminarTrabajo(estado: EstadoTrabajo, mensaje?: string): EstadoTrabajo {
  return { ...estado, fase: "ok", porcentaje: 100, mensaje: mensaje ?? "Listo." };
}

export function fallarTrabajo(estado: EstadoTrabajo, mensaje: string): EstadoTrabajo {
  return { ...estado, fase: "error", mensaje };
}

/** «Paso 2 de 4 · Preparando la propuesta con los expertos». */
export function textoPaso(estado: EstadoTrabajo): string {
  if (estado.fase === "ok") return estado.mensaje ?? "Listo.";
  if (estado.fase === "error") return estado.mensaje ?? "Algo ha fallado.";
  if (estado.indice < 0 || !estado.pasos.length) return "Trabajando…";
  return `Paso ${estado.indice + 1} de ${estado.pasos.length} · ${estado.pasos[estado.indice]}`;
}

/** Only a measured percentage is displayed. Unknown duration stays indeterminate. */
export function porcentajeVisible(estado: EstadoTrabajo): number | null {
  if (estado.fase === "ok") return 100;
  return typeof estado.porcentaje === "number" && Number.isFinite(estado.porcentaje) ? estado.porcentaje : null;
}

export function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/* -------------------------------- Contexto -------------------------------- */

export type ManejadorTrabajo = {
  avanzar: (paso: string, porcentaje?: number) => void;
  terminar: (mensajeOk?: string) => void;
  fallar: (mensajeError: string) => void;
};

type Ctx = {
  trabajo: EstadoTrabajo | null;
  cola: EstadoTrabajo[];
  iniciarTrabajo: (opciones: { titulo: string; pasos?: string[] }) => ManejadorTrabajo;
  cerrar: () => void;
};

const CtxTrabajo = React.createContext<Ctx>({
  trabajo: null,
  cola: [],
  iniciarTrabajo: () => ({ avanzar: () => {}, terminar: () => {}, fallar: () => {} }),
  cerrar: () => {},
});

export function useTrabajo() {
  return React.useContext(CtxTrabajo);
}

export function TrabajoProvider({ children }: { children: React.ReactNode }) {
  const [trabajos,setTrabajos]=React.useState<EstadoTrabajo[]>([]);
  const timers=React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const trabajo=trabajos.find(t=>t.fase==='activo')??trabajos[0]??null;
  const iniciarTrabajo=React.useCallback((opciones:{titulo:string;pasos?:string[]})=>{
    const inicial=crearTrabajo(opciones.titulo,opciones.pasos??[]);setTrabajos(lista=>[...lista,inicial]);sonidoTic();
    const propio=(accion:(a:EstadoTrabajo)=>EstadoTrabajo)=>setTrabajos(lista=>lista.map(t=>t.id===inicial.id?accion(t):t));
    return {
      avanzar:(paso:string,porcentaje?:number)=>propio(a=>avanzarTrabajo(a,paso,porcentaje)),
      terminar:(mensaje?:string)=>{propio(a=>terminarTrabajo(a,mensaje));sonidoExito();const timer=setTimeout(()=>{setTrabajos(lista=>lista.filter(t=>t.id!==inicial.id));timers.current.delete(timer);},4000);timers.current.add(timer);},
      fallar:(mensaje:string)=>{propio(a=>fallarTrabajo(a,mensaje));sonidoError();},
    } satisfies ManejadorTrabajo;
  },[]);
  const cerrar=React.useCallback(()=>{if(trabajo)setTrabajos(lista=>lista.filter(t=>t.id!==trabajo.id));},[trabajo]);
  React.useEffect(()=>()=>{for(const timer of timers.current)clearTimeout(timer);timers.current.clear();},[]);
  const cola=React.useMemo(()=>trabajos.filter(t=>t.id!==trabajo?.id),[trabajos,trabajo?.id]);
  const valor=React.useMemo<Ctx>(()=>({trabajo,cola,iniciarTrabajo,cerrar}),[trabajo,cola,iniciarTrabajo,cerrar]);

  return (
    <CtxTrabajo.Provider value={valor}>
      {children}
      <PanelTrabajo />
    </CtxTrabajo.Provider>
  );
}

/* ------------------------------ Panel flotante ---------------------------- */

function PanelTrabajo() {
  const { trabajo, cola, cerrar } = useTrabajo();
  const [tic, setTic] = React.useState(0);

  React.useEffect(() => {
    if (!trabajo) return;
    const reloj = window.setInterval(() => setTic((v) => v + 1), 500);
    return () => window.clearInterval(reloj);
  }, [trabajo?.id]);


  if (!trabajo) return null;

  const porcentaje = porcentajeVisible(trabajo);
  const transcurrido = mmss(Date.now() - trabajo.inicio + tic * 0);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[26rem] sm:px-0"
    >
      <div className="panel border-primary/40 bg-surface/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "relative grid size-16 shrink-0 place-items-center rounded-2xl border",
              trabajo.fase === "ok"
                ? "border-success/40 bg-success/10 text-success"
                : trabajo.fase === "error"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-primary/40 bg-primary/10 text-primary",
            )}
          >
            {trabajo.fase === "ok" ? (
              <Check className="size-8" />
            ) : trabajo.fase === "error" ? (
              <X className="size-8" />
            ) : (
              <>
                <span
                  aria-hidden
                  className="absolute inset-2 rounded-2xl bg-primary/20 animate-ping motion-reduce:animate-none"
                  style={{ animationDuration: "2.6s" }}
                />
                <Cpu
                  className="relative size-9 animate-spin motion-reduce:animate-none"
                  style={{ animationDuration: "2.4s" }}
                />
              </>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold">
              {trabajo.fase === "ok" ? "Hecho" : trabajo.fase === "error" ? "No ha podido ser" : "Trabajando…"}
            </p>
            <p className="truncate text-sm text-foreground">{trabajo.titulo}</p>
            <p
              className={cn(
                "mt-0.5 text-xs",
                trabajo.fase === "error" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {textoPaso(trabajo)}
            </p>
          </div>

          {trabajo.fase === "error" ? (
            <button
              type="button"
              onClick={cerrar}
              className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Cerrar
            </button>
          ) : null}
        </div>

        {cola.length ? (
          <div className="mt-2 border-t border-border/60 pt-2">
            <p className="text-[11px] font-medium text-muted-foreground">+ {cola.length} en cola</p>
            <ul className="mt-0.5 space-y-0.5">
              {cola.map((t) => (
                <li key={t.id} className="truncate text-[11px] text-muted-foreground">
                  {t.titulo}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {trabajo.fase === "error" ? null : (
          <>
            <div role="progressbar" aria-label={trabajo.titulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje ?? undefined} className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  porcentaje === null && "animate-pulse motion-reduce:animate-none",
                  trabajo.fase === "ok" ? "bg-success" : "bg-primary",
                )}
                style={{ width: porcentaje === null ? "100%" : `${porcentaje}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {porcentaje === null ? "Esperando la respuesta del servidor (suele tardar 10–40 s)" : `${porcentaje} %`}
              </span>
              <span>{transcurrido}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Indicador de cabecera ------------------------ */

/** Punto animado con «Trabajando» para las cabeceras. */
export function IndicadorCabeceraTrabajo({ className }: { className?: string }) {
  const { trabajo } = useTrabajo();
  if (!trabajo || trabajo.fase !== "activo") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary",
        className,
      )}
    >
      <Cpu className="size-3 animate-spin motion-reduce:animate-none" style={{ animationDuration: "2.4s" }} />
      Trabajando
    </span>
  );
}

/* ------------------------- Ayuda para las mutaciones ---------------------- */

/** Envuelve cualquier acción larga con el indicador global. */
export function useConTrabajo() {
  const { iniciarTrabajo } = useTrabajo();
  return React.useCallback(
    async <T,>(
      titulo: string,
      accion: (manejador: ManejadorTrabajo) => Promise<T>,
      opciones?: { pasos?: string[]; mensajeOk?: string },
    ): Promise<T | undefined> => {
      const manejador = iniciarTrabajo({ titulo, pasos: opciones?.pasos ?? [] });
      try {
        const resultado = await accion(manejador);
        manejador.terminar(typeof resultado === "string" ? resultado : opciones?.mensajeOk);
        return resultado;
      } catch (e) {
        manejador.fallar(e instanceof Error ? e.message : "No se ha podido completar la operación.");
        return undefined;
      }
    },
    [iniciarTrabajo],
  );
}

/** Sigue una mutación de react-query con el indicador global. */
export function useSeguirTrabajo(titulo: string, pasos?: string[]) {
  const { iniciarTrabajo } = useTrabajo();
  const actual = React.useRef<ManejadorTrabajo | null>(null);

  const empezar = React.useCallback(() => {
    actual.current = iniciarTrabajo({ titulo, pasos: pasos ?? [] });
  }, [iniciarTrabajo, titulo, pasos?.join("|")]);

  const acabar = React.useCallback((_datos: unknown, error: unknown) => {
    if (error) actual.current?.fallar(error instanceof Error ? error.message : "No se ha podido completar.");
    else actual.current?.terminar();
    actual.current = null;
  }, []);

  return { empezar, acabar };
}
