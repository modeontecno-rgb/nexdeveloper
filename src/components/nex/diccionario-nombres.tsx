import { BookA, Plus, RefreshCw, Trash2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { useAuth } from "@/lib/nex/auth";
import {
  useActualizarTerminoDiccionario,
  useBorrarTerminoDiccionario,
  useCrearTerminoDiccionario,
  useDiccionarioNombres,
  useSembrarDiccionario,
} from "@/lib/nex/queries/diccionario";
import { cn } from "@/lib/utils";

const ETIQUETA_ORIGEN: Record<string, string> = {
  manual: "A mano",
  proyecto: "De un proyecto",
  aprendido: "Aprendido",
};

/** Nombres propios y sus variantes, para corregir lo que Plaud transcribe mal. */
export function DiccionarioNombres() {
  const { usuario } = useAuth();
  const { data: terminos = [], isPending } = useDiccionarioNombres();
  const crear = useCrearTerminoDiccionario();
  const actualizar = useActualizarTerminoDiccionario();
  const borrar = useBorrarTerminoDiccionario();
  const sembrar = useSembrarDiccionario();

  const [nuevoTermino, setNuevoTermino] = React.useState("");
  const [nuevasVariantes, setNuevasVariantes] = React.useState("");

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <BookA className="size-4" /> Diccionario de nombres
        </h2>
        <Boton
          variante="suave"
          className="px-2.5 py-1.5 text-xs"
          disabled={sembrar.isPending || !usuario?.id}
          onClick={() => {
            if (!usuario?.id) {
              toast.error("No he podido identificar tu cuenta.");
              return;
            }
            sembrar.mutate(usuario.id);
          }}
        >
          <RefreshCw className={cn("size-3.5", sembrar.isPending && "animate-spin")} /> Recargar desde mis proyectos
        </Boton>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Sirve para corregir los nombres que Plaud transcribe mal: apunta el nombre bueno y cómo suele escribirlo.
      </p>

      <form
        className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const termino = nuevoTermino.trim();
          if (!termino) return;
          crear.mutate(
            { termino, variantes: separar(nuevasVariantes) },
            {
              onSuccess: () => {
                setNuevoTermino("");
                setNuevasVariantes("");
              },
            },
          );
        }}
      >
        <Campo etiqueta="Nombre correcto">
          <input value={nuevoTermino} onChange={(e) => setNuevoTermino(e.target.value)} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Cómo suele escribirse mal" pista="Separa las variantes con comas.">
          <input value={nuevasVariantes} onChange={(e) => setNuevasVariantes(e.target.value)} className={claseCampo} />
        </Campo>
        <Boton type="submit" disabled={!nuevoTermino.trim() || crear.isPending}>
          <Plus className="size-4" /> Añadir
        </Boton>
      </form>

      <div className="mt-4 space-y-3">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : terminos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay nombres. Añade uno o recárgalos desde tus proyectos.
          </p>
        ) : (
          terminos.map((t) => (
            <FilaTermino
              key={t.id}
              id={t.id}
              termino={t.termino}
              variantes={t.variantes ?? []}
              origen={t.origen}
              usos={t.usos ?? 0}
              activo={t.activo}
              onVariantes={(variantes) => actualizar.mutate({ id: t.id, variantes })}
              onActivo={(activo) => actualizar.mutate({ id: t.id, activo })}
              onBorrar={() => borrar.mutate(t.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function separar(texto: string) {
  return texto
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function FilaTermino({
  termino,
  variantes,
  origen,
  usos,
  activo,
  onVariantes,
  onActivo,
  onBorrar,
}: {
  id: string;
  termino: string;
  variantes: string[];
  origen: string;
  usos: number;
  activo: boolean;
  onVariantes: (v: string[]) => void;
  onActivo: (v: boolean) => void;
  onBorrar: () => void;
}) {
  const [nueva, setNueva] = React.useState("");

  return (
    <div className={cn("rounded-lg border border-border p-3", !activo && "opacity-60")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{termino}</p>
          <p className="text-xs text-muted-foreground">
            {ETIQUETA_ORIGEN[origen] ?? origen} · {usos} {usos === 1 ? "uso" : "usos"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => onActivo(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Activo
          </label>
          <Boton variante="peligro" className="px-2 py-1 text-xs" onClick={onBorrar}>
            <Trash2 className="size-3.5" />
          </Boton>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {variantes.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
          >
            {v}
            <button
              type="button"
              aria-label={`Quitar ${v}`}
              onClick={() => onVariantes(variantes.filter((x) => x !== v))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const limpia = nueva.trim();
            if (!limpia || variantes.includes(limpia)) return;
            onVariantes([...variantes, limpia]);
            setNueva("");
          }}
        >
          <input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            placeholder="añadir variante"
            className="w-40 rounded-full border border-dashed border-border bg-transparent px-2 py-0.5 text-xs outline-none focus:border-primary"
          />
        </form>
      </div>
    </div>
  );
}
