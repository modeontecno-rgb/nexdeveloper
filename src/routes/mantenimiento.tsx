import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Eraser, ListChecks, Search, Sparkles, Wrench } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando } from "@/components/nex/badges";
import { Boton, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type { Gravedad, Problema } from "@/lib/nex/diagnostico";
import { BLOQUES_LIMPIEZA, confirmacionValida, type BloqueLimpieza } from "@/lib/nex/mantenimiento";
import { useAplicarArreglo, useDiagnostico, useLimpiarTrabajo } from "@/lib/nex/queries/mantenimiento";

const DESCRIPCION =
  "Vacía la cola de trabajo para empezar de cero y busca problemas con su arreglo propuesto.";

export const Route = createFileRoute("/mantenimiento")({
  head: () => ({
    meta: [
      { title: "Mantenimiento · NexDeveloper" },
      { name: "description", content: DESCRIPCION },
      { property: "og:title", content: "Mantenimiento · NexDeveloper" },
      { property: "og:description", content: DESCRIPCION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Mantenimiento,
});

const COLOR_GRAVEDAD: Record<Gravedad, string> = {
  alta: "border-destructive/40 bg-destructive/10 text-destructive",
  media: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  baja: "border-border bg-surface text-muted-foreground",
};

const TEXTO_GRAVEDAD: Record<Gravedad, string> = {
  alta: "Urgente",
  media: "Conviene mirarlo",
  baja: "Sin prisa",
};

function Mantenimiento() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <Encabezado titulo="Mantenimiento" descripcion={DESCRIPCION} />
      <div className="grid gap-6">
        <BuscadorDeProblemas />
        <EmpezarDeCero />
      </div>
    </div>
  );
}

/* ------------------------------ Buscar problemas --------------------------- */

function BuscadorDeProblemas() {
  const [buscado, setBuscado] = React.useState(false);
  const { data: problemas = [], isFetching, refetch } = useDiagnostico(buscado);
  const arreglar = useAplicarArreglo();
  const [detalle, setDetalle] = React.useState<Problema | null>(null);

  const buscar = async () => {
    setBuscado(true);
    const r = await refetch();
    if (r.error) toast.error(r.error.message);
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Search className="size-4 text-primary" /> Buscar problemas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Revisa tareas, peticiones, mesas, avisos e incidencias y te dice qué está mal y cómo arreglarlo.
          </p>
        </div>
        <Boton onClick={buscar} disabled={isFetching}>
          {isFetching ? "Buscando…" : "Buscar problemas"}
        </Boton>
      </div>

      {isFetching ? <Cargando /> : null}

      {buscado && !isFetching ? (
        problemas.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
            <Sparkles className="mr-2 inline size-4 text-primary" />
            No he encontrado nada que arreglar. Todo está en orden.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {problemas.map((p) => (
              <li key={p.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${COLOR_GRAVEDAD[p.gravedad]}`}>
                    {TEXTO_GRAVEDAD[p.gravedad]}
                  </span>
                  <h3 className="min-w-0 text-sm font-semibold break-words">{p.titulo}</h3>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground break-words">{p.detalle}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {p.arreglo ? (
                    <Boton
                      onClick={() => {
                        const arreglo = p.arreglo;
                        if (!arreglo) return;
                        arreglar.mutate(
                          { tipo: arreglo.tipo, ids: arreglo.ids },
                          {
                            onSuccess: () => toast.success("Arreglado."),
                            onError: (e) => toast.error((e as Error).message),
                          },
                        );
                      }}
                      disabled={arreglar.isPending}
                    >
                      <Wrench className="size-4" /> {p.arreglo.etiqueta}
                    </Boton>
                  ) : null}
                  <Boton variante="suave" onClick={() => setDetalle(p)}>
                    <ListChecks className="size-4" /> Dame las instrucciones
                  </Boton>
                  {p.ruta ? (
                    <Link to={p.ruta} className="text-sm text-primary underline-offset-4 hover:underline">
                      Ir a la pantalla
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      <Dialogo
        abierto={detalle !== null}
        titulo={detalle?.titulo ?? ""}
        descripcion="Pasos para arreglarlo tú mismo."
        onCerrar={() => setDetalle(null)}
      >
        <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm text-muted-foreground">
          {(detalle?.instrucciones ?? []).map((paso) => (
            <li key={paso} className="break-words">
              {paso}
            </li>
          ))}
        </ol>
      </Dialogo>
    </section>
  );
}

/* ------------------------------ Empezar de cero ---------------------------- */

function EmpezarDeCero() {
  const limpiar = useLimpiarTrabajo();
  const [elegidos, setElegidos] = React.useState<BloqueLimpieza[]>(BLOQUES_LIMPIEZA.map((b) => b.id));
  const [confirmacion, setConfirmacion] = React.useState("");
  const [abierto, setAbierto] = React.useState(false);

  const alternar = (id: BloqueLimpieza) =>
    setElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const vaciar = () => {
    limpiar.mutate(elegidos, {
      onSuccess: (resultados) => {
        const fallos = resultados.filter((r) => r.error);
        const total = resultados.reduce((suma, r) => suma + (r.borrados ?? 0), 0);
        setAbierto(false);
        setConfirmacion("");
        if (fallos.length > 0) {
          toast.error(`Se han borrado ${total} registros, pero algo no se pudo vaciar: ${fallos[0]?.error ?? ""}`);
        } else {
          toast.success(`Listo. Se han borrado ${total} registros y empiezas de cero.`);
        }
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    <section className="rounded-xl border border-destructive/30 bg-surface p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Eraser className="size-4 text-destructive" /> Empezar de cero
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Vacía lo que elijas para quitarte el lío de encima. Los proyectos, los ajustes y las conexiones no se
        tocan.
      </p>

      <ul className="mt-4 grid gap-2">
        {BLOQUES_LIMPIEZA.map((bloque) => (
          <li key={bloque.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={elegidos.includes(bloque.id)}
                onChange={() => alternar(bloque.id)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{bloque.titulo}</span>
                <span className="block text-xs text-muted-foreground break-words">{bloque.descripcion}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Boton variante="peligro" onClick={() => setAbierto(true)} disabled={elegidos.length === 0}>
          <AlertTriangle className="size-4" /> Vaciar lo seleccionado
        </Boton>
      </div>

      <Dialogo
        abierto={abierto}
        titulo="Esto no tiene vuelta atrás"
        descripcion="Se borrará definitivamente lo que has marcado."
        ancho="max-w-lg"
        onCerrar={() => setAbierto(false)}
      >
        <ul className="mt-3 grid gap-1 text-sm text-muted-foreground">
          {BLOQUES_LIMPIEZA.filter((b) => elegidos.includes(b.id)).map((b) => (
            <li key={b.id}>· {b.titulo}</li>
          ))}
        </ul>
        <label className="mt-4 block text-sm">
          Escribe <strong>BORRAR</strong> para confirmar
          <input
            className={`${claseCampo} mt-1.5`}
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            aria-label="Confirmación de borrado"
          />
        </label>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Boton variante="suave" onClick={() => setAbierto(false)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            onClick={vaciar}
            disabled={!confirmacionValida(confirmacion) || limpiar.isPending}
          >
            {limpiar.isPending ? "Vaciando…" : "Sí, vaciar"}
          </Boton>
        </div>
      </Dialogo>
    </section>
  );
}
