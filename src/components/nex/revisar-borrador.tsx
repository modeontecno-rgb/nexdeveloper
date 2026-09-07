import { Check, Loader2, MessageSquare, Send, Trash2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type { CorreccionNombre, PeticionDirectaRow } from "@/lib/nex/db-types";
import { desde, marcaTiempo } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  useAnadirMensaje,
  useAprenderCorreccion,
  useDescartarBorrador,
  useGuardarBorrador,
  useMensajesBorrador,
} from "@/lib/nex/queries/pideme";
import { cn } from "@/lib/utils";

function correcciones(borrador: PeticionDirectaRow): CorreccionNombre[] {
  const bruto = borrador.correcciones;
  if (Array.isArray(bruto)) return bruto as CorreccionNombre[];
  return [];
}

/**
 * Revisión de un borrador antes de lanzarlo: texto corregido, nombres,
 * aclaraciones, proyecto y conversación previa.
 */
export function RevisarBorrador({
  borrador,
  onLanzar,
  lanzando,
  onCerrar,
}: {
  borrador: PeticionDirectaRow;
  onLanzar: (id: string) => void;
  lanzando?: boolean;
  onCerrar?: () => void;
}) {
  const { data: proyectos = [] } = useProyectos();
  const guardar = useGuardarBorrador();
  const aprender = useAprenderCorreccion();
  const descartar = useDescartarBorrador();

  const [texto, setTexto] = React.useState(borrador.texto ?? "");
  const [aclaraciones, setAclaraciones] = React.useState(borrador.aclaraciones ?? "");
  const [proyectoId, setProyectoId] = React.useState(borrador.proyecto_id ?? "");
  const [verOriginal, setVerOriginal] = React.useState(false);
  const [ignoradas, setIgnoradas] = React.useState<string[]>([]);
  const [confirmarDescartar, setConfirmarDescartar] = React.useState(false);
  const primeraCarga = React.useRef(true);

  React.useEffect(() => {
    setTexto(borrador.texto ?? "");
    setAclaraciones(borrador.aclaraciones ?? "");
    setProyectoId(borrador.proyecto_id ?? "");
    primeraCarga.current = true;
  }, [borrador.id, borrador.texto, borrador.aclaraciones, borrador.proyecto_id]);

  // Guardado automático al dejar de escribir.
  React.useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    const reloj = window.setTimeout(() => {
      guardar.mutate({
        id: borrador.id,
        texto,
        aclaraciones: aclaraciones || null,
        proyectoId: proyectoId || null,
      });
    }, 1000);
    return () => window.clearTimeout(reloj);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, aclaraciones, proyectoId]);

  const lista = correcciones(borrador);
  const informativas = lista.filter((c) => c.tipo === "variante" || c.tipo === "aprendida");
  const sugerencias = lista.filter(
    (c) => c.tipo === "sugerencia" && !ignoradas.includes(`${c.de ?? ""}→${c.a ?? ""}`),
  );

  return (
    <section className="panel space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold">Revisar antes de lanzar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Repasa el texto, corrige los nombres y matiza lo que haga falta. {marcaTiempo(borrador.creado_el)} ·{" "}
            {desde(borrador.creado_el)}
          </p>
        </div>
        {onCerrar ? (
          <Boton variante="suave" className="px-2.5 py-1.5 text-xs" onClick={onCerrar}>
            Cerrar
          </Boton>
        ) : null}
      </div>

      <div>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={10}
          className={cn(claseCampo, "min-h-48 leading-relaxed")}
          aria-label="Texto de la petición"
        />
        {borrador.texto_original ? (
          <>
            <button
              type="button"
              onClick={() => setVerOriginal((v) => !v)}
              className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {verOriginal ? "ocultar original de Plaud" : "ver original de Plaud"}
            </button>
            {verOriginal ? (
              <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                {borrador.texto_original}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {informativas.length || sugerencias.length ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Nombres corregidos</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {informativas.map((c, i) => (
              <span
                key={`ok-${i}`}
                className="rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs text-success"
              >
                {c.de ?? "?"} → {c.a ?? "?"}
              </span>
            ))}
          </div>
          {sugerencias.length ? (
            <div className="mt-3 space-y-2">
              {sugerencias.map((c, i) => (
                <div
                  key={`sug-${i}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
                >
                  <span className="font-medium">
                    {c.de ?? "?"} → {c.a ?? "?"}
                  </span>
                  <span className="text-muted-foreground">¿lo cambio?</span>
                  <Boton
                    variante="suave"
                    className="px-2 py-1 text-xs"
                    disabled={aprender.isPending}
                    onClick={() =>
                      aprender.mutate(
                        { id: borrador.id, de: c.de ?? "", a: c.a ?? "" },
                        { onSuccess: (nuevo) => { if (nuevo) setTexto(nuevo); } },
                      )
                    }
                  >
                    <Check className="size-3.5" /> Aplicar
                  </Boton>
                  <Boton
                    variante="suave"
                    className="px-2 py-1 text-xs"
                    onClick={() => setIgnoradas((v) => [...v, `${c.de ?? ""}→${c.a ?? ""}`])}
                  >
                    <X className="size-3.5" /> Ignorar
                  </Boton>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Campo etiqueta="Aclaraciones" pista="Lo que quieras matizar para que se entienda mejor.">
          <textarea
            value={aclaraciones}
            onChange={(e) => setAclaraciones(e.target.value)}
            rows={3}
            className={claseCampo}
          />
        </Campo>
        <Campo etiqueta="Proyecto" pista="Cámbialo si la clasificación automática se equivocó.">
          <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={claseCampo}>
            <option value="">Que lo decida NexDeveloper</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <HiloBorrador peticionId={borrador.id} />

      <div className="flex flex-wrap gap-2">
        <Boton onClick={() => onLanzar(borrador.id)} disabled={Boolean(lanzando) || !texto.trim()}>
          {lanzando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Lanzar tarea
        </Boton>
        <Boton
          variante="suave"
          disabled={guardar.isPending}
          onClick={() =>
            guardar.mutate(
              { id: borrador.id, texto, aclaraciones: aclaraciones || null, proyectoId: proyectoId || null },
              { onSuccess: () => toast.success("Borrador guardado.") },
            )
          }
        >
          Guardar y seguir luego
        </Boton>
        <Boton variante="peligro" onClick={() => setConfirmarDescartar(true)}>
          <Trash2 className="size-4" /> Descartar
        </Boton>
      </div>

      <Dialogo
        abierto={confirmarDescartar}
        titulo="Descartar este borrador"
        descripcion="Se elimina de la lista de pendientes y no se lanzará ninguna tarea."
        onCerrar={() => setConfirmarDescartar(false)}
        ancho="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={() => setConfirmarDescartar(false)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            disabled={descartar.isPending}
            onClick={() =>
              descartar.mutate(borrador.id, {
                onSuccess: () => {
                  setConfirmarDescartar(false);
                  onCerrar?.();
                },
              })
            }
          >
            Descartar
          </Boton>
        </div>
      </Dialogo>
    </section>
  );
}

/** Conversación previa: notas para matizar antes de lanzar. */
function HiloBorrador({ peticionId }: { peticionId: string }) {
  const { data: mensajes = [] } = useMensajesBorrador(peticionId);
  const anadir = useAnadirMensaje(peticionId);
  const [nota, setNota] = React.useState("");

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <MessageSquare className="size-3.5" /> Conversación previa
      </p>
      {mensajes.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Todavía no hay notas. Escribe aquí lo que quieras matizar.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {mensajes.map((m) => (
            <li
              key={m.id}
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                m.rol === "usuario"
                  ? "ml-auto bg-primary/10 text-foreground"
                  : m.rol === "sistema"
                    ? "border border-border bg-muted text-muted-foreground"
                    : "bg-muted text-foreground",
              )}
            >
              <p className="whitespace-pre-wrap">{m.texto}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{desde(m.creado_el)}</p>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const limpio = nota.trim();
          if (!limpio) return;
          anadir.mutate({ texto: limpio }, { onSuccess: () => setNota("") });
        }}
      >
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Añade una nota…"
          className={cn(claseCampo, "flex-1 min-w-40")}
        />
        <Boton type="submit" variante="suave" disabled={!nota.trim() || anadir.isPending}>
          Añadir nota
        </Boton>
      </form>
    </div>
  );
}
