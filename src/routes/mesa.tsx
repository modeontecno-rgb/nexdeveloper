import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ClipboardCopy,
  ListChecks,
  Loader2,
  MessagesSquare,
  Plus,
  Send,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando } from "@/components/nex/badges";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import { useConTrabajo } from "@/components/nex/indicador-trabajo";
import { PanelCostes } from "@/components/nex/costes";
import { duracionEntre } from "@/lib/nex/costes";
import type {
  MesaRow,
  ModoMesa,
  ParticipanteMesa,
  PasoPlanMesa,
  RolMesa,
} from "@/lib/nex/db-types";
import { desde, formatoEuros } from "@/lib/nex/labels";
import { useAjustes, useChats, useProyectos } from "@/lib/nex/queries/datos";
import { useExpertos } from "@/lib/nex/queries/expertos";
import { markdownAHtml } from "@/lib/nex/queries/resumenes";
import {
  COLOR_ROL_MESA,
  ETIQUETA_MODO_MESA,
  ETIQUETA_ROL_MESA,
  EXPLICACION_MODO_MESA,
  participantes as leerParticipantes,
  useActualizarMesa,
  useCrearTareasMesa,
  useDeliberar,
  useIntervenciones,
  useMesa,
  useMesas,
  usePingMesa,
  normalizarPlan,
  recomendacionDeMesa,
  sintesisLegible,
  useRealtimeMesa,
  useRecomendarMesa,
  useValoraciones,
  useValorarMesa,
} from "@/lib/nex/queries/mesa";
import { useCrearOrden } from "@/lib/nex/queries/ordenes";

type BusquedaMesa = { mesa?: string };

export const Route = createFileRoute("/mesa")({
  validateSearch: (busqueda: Record<string, unknown>): BusquedaMesa =>
    typeof busqueda["mesa"] === "string" ? { mesa: busqueda["mesa"] as string } : {},
  head: () => ({
    meta: [
      { title: "Mesa de expertos · NexDeveloper" },
      {
        name: "description",
        content: "Un experto planifica, otro ejecuta y otro revisa: deliberación real con varios modelos de IA.",
      },
      { property: "og:title", content: "Mesa de expertos · NexDeveloper" },
      {
        property: "og:description",
        content: "Un experto planifica, otro ejecuta y otro revisa: deliberación real con varios modelos de IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MesaPantalla,
});

const MODOS: ModoMesa[] = ["economico", "equilibrado", "maxima_calidad"];
const ROLES: RolMesa[] = ["planificar", "opinar", "revisar"];

/* ------------------------------- Pantalla -------------------------------- */

function MesaPantalla() {
  const { mesa: mesaSeleccionada } = Route.useSearch();
  const navegar = useNavigate();
  const ping = usePingMesa();
  const { data: mesas = [], isPending } = useMesas();
  const { data: valoraciones = [] } = useValoraciones();
  const [nueva, setNueva] = React.useState(false);

  const abrir = (id: string | null) =>
    void navegar({ to: "/mesa", search: id ? { mesa: id } : {}, replace: true });

  const proveedores = ping.data?.proveedores ?? [];
  const sinProveedores = ping.data ? ping.data.minimo_ok === false || proveedores.length === 0 : false;

  return (
    <>
      <Encabezado
        titulo="Mesa de expertos"
        descripcion="Reúne a varios expertos para decidir: uno planifica, otro ejecuta y otro revisa."
        acciones={
          <Boton onClick={() => setNueva(true)}>
            <Plus className="size-4" /> Nueva mesa
          </Boton>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {proveedores.map((p) => (
          <span
            key={p}
            className="rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs text-success"
          >
            {p}
          </span>
        ))}
        {sinProveedores ? (
          <span className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs text-destructive">
            No hay ningún proveedor de IA con clave. Añádela en Ajustes → Proveedores.
          </span>
        ) : null}
        {ping.isPending ? <span className="text-xs text-muted-foreground">Comprobando proveedores…</span> : null}
      </div>

      {mesaSeleccionada ? (
        <VistaDeliberacion mesaId={mesaSeleccionada} onVolver={() => abrir(null)} />
      ) : isPending ? (
        <Cargando />
      ) : (
        <Historial mesas={mesas} valoraciones={valoraciones} onAbrir={abrir} />
      )}

      <DialogoNuevaMesa abierto={nueva} onCerrar={() => setNueva(false)} onCreada={(id) => abrir(id)} />
    </>
  );
}

/* ------------------------------- Historial -------------------------------- */

function Historial({
  mesas,
  valoraciones,
  onAbrir,
}: {
  mesas: MesaRow[];
  valoraciones: { mesa_id: string; valoracion: number }[];
  onAbrir: (id: string) => void;
}) {
  const { data: proyectos = [] } = useProyectos();
  const nombre = (id: string | null) => proyectos.find((p) => p.id === id)?.nombre ?? "Sin proyecto";

  if (mesas.length === 0) {
    return (
      <p className="panel p-6 text-sm text-muted-foreground">
        Todavía no has convocado ninguna mesa. Pulsa «Nueva mesa» y plantea la decisión.
      </p>
    );
  }

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[54rem] text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Proyecto</th>
            <th className="px-4 py-3">Título</th>
            <th className="px-4 py-3">Modo</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Coste</th>
            <th className="px-4 py-3">Participantes</th>
            <th className="px-4 py-3">Valoración</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {mesas.map((m) => {
            const suyas = valoraciones.filter((v) => v.mesa_id === m.id);
            const media = suyas.length
              ? suyas.reduce((a, v) => a + Number(v.valoracion ?? 0), 0) / suyas.length
              : null;
            return (
              <tr key={m.id} className="hover:bg-surface/60">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{desde(m.creado_el)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{nombre(m.proyecto_id)}</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => onAbrir(m.id)} className="text-left font-medium hover:text-primary">
                    {m.titulo || m.pregunta.slice(0, 70)}
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{ETIQUETA_MODO_MESA[m.modo]}</td>
                <td className="px-4 py-3">
                  <ChipEstado estado={m.estado} />
                </td>
                <td className="px-4 py-3 text-xs">{formatoEuros(Number(m.coste ?? 0))}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{leerParticipantes(m).length}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {media ? `${media.toFixed(1)} / 5` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChipEstado({ estado }: { estado: MesaRow["estado"] }) {
  const tono =
    estado === "concluida"
      ? "border-success/40 bg-success/10 text-success"
      : estado === "error"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : estado === "deliberando"
          ? "border-info/40 bg-info/10 text-info"
          : "border-border bg-surface text-muted-foreground";
  const texto =
    estado === "concluida"
      ? "Concluida"
      : estado === "error"
        ? "Con error"
        : estado === "deliberando"
          ? "Deliberando"
          : "Preparada";
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs ${tono}`}>{texto}</span>;
}

/* ------------------------------- Nueva mesa ------------------------------- */

export function DialogoNuevaMesa({
  abierto,
  onCerrar,
  onCreada,
  proyectoId,
  ordenId,
  tareaId,
  preguntaInicial,
  contextoInicial,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCreada: (mesaId: string) => void;
  proyectoId?: string;
  ordenId?: string;
  tareaId?: string;
  preguntaInicial?: string;
  contextoInicial?: string;
}) {
  const { data: proyectos = [] } = useProyectos();
  const recomendar = useRecomendarMesa();
  const [proyecto, setProyecto] = React.useState(proyectoId ?? "");
  const [pregunta, setPregunta] = React.useState(preguntaInicial ?? "");
  const [contexto, setContexto] = React.useState(contextoInicial ?? "");
  const [modo, setModo] = React.useState<ModoMesa>("equilibrado");

  React.useEffect(() => {
    if (!abierto) return;
    setProyecto(proyectoId ?? "");
    setPregunta(preguntaInicial ?? "");
    setContexto(contextoInicial ?? "");
    setModo("equilibrado");
  }, [abierto, proyectoId, preguntaInicial, contextoInicial]);

  const convocar = async () => {
    const r = await recomendar.mutateAsync({
      pregunta: pregunta.trim(),
      ...(proyecto ? { proyectoId: proyecto } : {}),
      ...(contexto.trim() ? { contexto: contexto.trim() } : {}),
      modo,
      ...(ordenId ? { ordenId } : {}),
      ...(tareaId ? { tareaId } : {}),
    });
    if (r.mesa?.id) {
      onCerrar();
      onCreada(r.mesa.id);
    }
  };

  return (
    <Dialogo abierto={abierto} titulo="Nueva mesa" onCerrar={onCerrar} ancho="max-w-3xl">
      <div className="space-y-4">
        <Campo etiqueta="Proyecto" pista="Opcional: ayuda a los expertos a conocer el contexto.">
          <select value={proyecto} onChange={(e) => setProyecto(e.target.value)} className={claseCampo}>
            <option value="">Sin proyecto</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="¿Qué hay que decidir o hacer?">
          <textarea
            rows={4}
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder="Por ejemplo: cómo montar la facturación con descarga en PDF y avisos por correo."
            className={claseCampo}
          />
        </Campo>
        <Campo etiqueta="Contexto adicional" pista="Opcional: restricciones, plazos, decisiones ya tomadas.">
          <textarea rows={3} value={contexto} onChange={(e) => setContexto(e.target.value)} className={claseCampo} />
        </Campo>

        <div>
          <p className="text-xs font-medium text-muted-foreground">Modo</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {MODOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                aria-pressed={modo === m}
                className={
                  modo === m
                    ? "rounded-lg border border-primary/50 bg-primary/10 p-3 text-left"
                    : "rounded-lg border border-border bg-surface p-3 text-left transition hover:border-primary/30"
                }
              >
                <span className={`block text-sm font-medium ${modo === m ? "text-primary" : "text-foreground"}`}>
                  {ETIQUETA_MODO_MESA[m]}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">{EXPLICACION_MODO_MESA[m]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Boton type="button" variante="suave" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            type="button"
            disabled={recomendar.isPending || pregunta.trim().length < 8}
            onClick={() => void convocar()}
          >
            {recomendar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
            Proponer equipo
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

/** Botón reutilizable para convocar la mesa desde cualquier pantalla. */
export function BotonConvocarMesa({
  proyectoId,
  ordenId,
  tareaId,
  pregunta,
  contextoInicial,
  etiqueta = "Convocar mesa",
  variante = "suave",
  className,
}: {
  proyectoId?: string;
  ordenId?: string;
  tareaId?: string;
  pregunta?: string;
  contextoInicial?: string;
  etiqueta?: string;
  variante?: "principal" | "suave";
  className?: string;
}) {
  const navegar = useNavigate();
  const [abierto, setAbierto] = React.useState(false);
  return (
    <>
      <Boton type="button" variante={variante} className={className} onClick={() => setAbierto(true)}>
        <MessagesSquare className="size-4" /> {etiqueta}
      </Boton>
      <DialogoNuevaMesa
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        onCreada={(id) => void navegar({ to: "/mesa", search: { mesa: id } })}
        {...(proyectoId ? { proyectoId } : {})}
        {...(ordenId ? { ordenId } : {})}
        {...(tareaId ? { tareaId } : {})}
        {...(pregunta ? { preguntaInicial: pregunta } : {})}
        {...(contextoInicial ? { contextoInicial } : {})}
      />
    </>
  );
}

/* ---------------------------- Vista deliberación --------------------------- */

function VistaDeliberacion({ mesaId, onVolver }: { mesaId: string; onVolver: () => void }) {
  const { data: mesa, isPending } = useMesa(mesaId);
  const { data: intervenciones = [] } = useIntervenciones(mesaId);
  const { data: expertos = [] } = useExpertos();
  const { data: proyectos = [] } = useProyectos();
  const { data: chats = [] } = useChats();
  const { data: ajustes } = useAjustes();
  const actualizar = useActualizarMesa();
  const deliberar = useDeliberar();
  const crearTareas = useCrearTareasMesa();
  const crearOrden = useCrearOrden();
  const valorar = useValorarMesa();
  const conTrabajo = useConTrabajo();
  const [confirmar, setConfirmar] = React.useState(false);
  const [estrellas, setEstrellas] = React.useState(0);
  const [comentario, setComentario] = React.useState("");

  const deliberando = mesa?.estado === "deliberando" || deliberar.isPending;
  useRealtimeMesa(Boolean(mesa));

  if (isPending) return <Cargando />;
  if (!mesa) {
    return (
      <div className="panel p-6 text-sm text-muted-foreground">
        No se encuentra esa mesa.{" "}
        <button type="button" onClick={onVolver} className="text-primary underline">
          Ver el historial
        </button>
      </div>
    );
  }

  const equipo = leerParticipantes(mesa);
  const recomendacion = recomendacionDeMesa(mesa);
  const plan: PasoPlanMesa[] = normalizarPlan(recomendacion?.plan);
  const riesgos = Array.isArray(recomendacion?.riesgos) ? recomendacion.riesgos : [];
  const faltaPlanGuardado =
    plan.length > 0 && normalizarPlan(mesa.recomendacion?.plan).length === 0;

  const crearTareasDelPlan = async () => {
    await conTrabajo(
      "Creando las tareas del plan",
      async (trabajo) => {
        if (plan.length === 0) {
          throw new Error(
            "Esta mesa todavía no tiene un plan de trabajo. Pulsa «Deliberar» o «Recomendar» para que los expertos lo generen.",
          );
        }
        if (faltaPlanGuardado && recomendacion) {
          trabajo.avanzar("Guardando el plan", 25);
          await actualizar.mutateAsync({ id: mesa.id, cambios: { recomendacion } });
        }
        trabajo.avanzar("Creando las tareas", 65);
        const resultado = await crearTareas.mutateAsync(mesa.id);
        const cuantas = Array.isArray(resultado.tareas) ? resultado.tareas.length : Number(resultado.tareas ?? 0);
        return cuantas ? `${cuantas} tareas creadas.` : "Plan enviado al proyecto.";
      },
      { pasos: ["Guardando el plan", "Creando las tareas"] },
    );
  };


  const cambiarParticipante = (indice: number, cambios: Partial<ParticipanteMesa>) => {
    const nuevos = equipo.map((p, i) => (i === indice ? { ...p, ...cambios } : p));
    actualizar.mutate({ id: mesa.id, cambios: { participantes: nuevos } });
  };

  const quitarParticipante = (indice: number) => {
    actualizar.mutate({ id: mesa.id, cambios: { participantes: equipo.filter((_p, i) => i !== indice) } });
  };

  const anadirParticipante = () => {
    const experto = expertos[0];
    const nuevo: ParticipanteMesa = {
      rol: "opinar",
      experto_slug: experto?.slug ?? "",
      experto_nombre: experto?.nombre ?? "Experto",
      proveedor: equipo[0]?.proveedor ?? "",
      modelo: equipo[0]?.modelo ?? "",
      motivo: "Añadido a mano",
    };
    actualizar.mutate({ id: mesa.id, cambios: { participantes: [...equipo, nuevo] } });
  };

  const enviarComoOrden = async () => {
    await conTrabajo(
      "Enviando la conclusión como orden",
      async (trabajo) => {
        trabajo.avanzar("Preparando la orden", 25);
        const texto = mesa.sintesis?.trim() || mesa.pregunta;
        const chat = chats.find((c) => c.proyecto_id === mesa.proyecto_id && c.es_principal);
        trabajo.avanzar("Guardando la orden", 60);
        await crearOrden.mutateAsync({
          entrada: {
            proyectoId: mesa.proyecto_id,
            chatId: chat?.id ?? null,
            texto,
            modo: mesa.modo,
            prioridad: "media",
            agenteId: null,
            equipo: [],
            costeEstimado: Number(recomendacion?.coste_estimado ?? 0),
            horasEstimadas: Number(recomendacion?.horas_estimadas ?? 0),
            riesgo: (recomendacion?.riesgo as "Bajo" | "Medio" | "Alto") ?? "Medio",
            calidadPrevista: Number(recomendacion?.calidad_prevista ?? 80),
          },
          ajustes: ajustes ?? null,
        });
        return "Orden creada con la conclusión de la mesa.";
      },
      { pasos: ["Preparando la orden", "Guardando la orden"] },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onVolver} className="text-xs text-muted-foreground underline">
          ← Volver al historial
        </button>
        <ChipEstado estado={mesa.estado} />
        <span className="text-xs text-muted-foreground">{ETIQUETA_MODO_MESA[mesa.modo]}</span>
        <span className="text-xs text-muted-foreground">
          {proyectos.find((p) => p.id === mesa.proyecto_id)?.nombre ?? "Sin proyecto"}
        </span>
      </div>

      <section className="panel p-5">
        <h2 className="font-display text-sm font-semibold">{mesa.titulo || "Asunto de la mesa"}</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{mesa.pregunta}</p>
        {mesa.contexto ? (
          <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
            {mesa.contexto}
          </p>
        ) : null}
        {mesa.error ? (
          <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {mesa.error}
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold">Equipo propuesto</h2>
          {mesa.estado === "preparada" ? (
            <Boton type="button" variante="suave" className="px-2.5 py-1 text-xs" onClick={anadirParticipante}>
              <Plus className="size-3.5" /> Añadir participante
            </Boton>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {equipo.map((p, i) => (
            <article key={`${p.experto_slug}-${i}`} className="panel space-y-2 p-4">
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] ${COLOR_ROL_MESA[p.rol] ?? ""}`}>
                  {ETIQUETA_ROL_MESA[p.rol] ?? p.rol}
                </span>
                {mesa.estado === "preparada" ? (
                  <button
                    type="button"
                    aria-label="Quitar participante"
                    onClick={() => quitarParticipante(i)}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
              {mesa.estado === "preparada" ? (
                <>
                  <select
                    value={p.experto_slug}
                    onChange={(e) => {
                      const ex = expertos.find((x) => x.slug === e.target.value);
                      cambiarParticipante(i, {
                        experto_slug: e.target.value,
                        experto_nombre: ex?.nombre ?? e.target.value,
                      });
                    }}
                    className={claseCampo}
                  >
                    {expertos.length === 0 ? <option value={p.experto_slug}>{p.experto_nombre}</option> : null}
                    {expertos.map((x) => (
                      <option key={x.slug} value={x.slug}>
                        {x.nombre}
                      </option>
                    ))}
                  </select>
                  <select
                    value={p.rol}
                    onChange={(e) => cambiarParticipante(i, { rol: e.target.value as RolMesa })}
                    className={claseCampo}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ETIQUETA_ROL_MESA[r]}
                      </option>
                    ))}
                  </select>
                  <input
                    value={p.proveedor ?? ""}
                    onChange={(e) => cambiarParticipante(i, { proveedor: e.target.value })}
                    placeholder="Proveedor"
                    className={claseCampo}
                  />
                  <input
                    value={p.modelo ?? ""}
                    onChange={(e) => cambiarParticipante(i, { modelo: e.target.value })}
                    placeholder="Modelo"
                    className={claseCampo}
                  />
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">{p.experto_nombre}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.proveedor} · {p.modelo}
                  </p>
                </>
              )}
              {p.motivo ? <p className="text-xs text-muted-foreground">{p.motivo}</p> : null}
            </article>
          ))}
          {equipo.length === 0 ? (
            <p className="text-sm text-muted-foreground">La mesa no tiene participantes todavía.</p>
          ) : null}
        </div>
      </section>

      {recomendacion?.equipo ? (
        <section className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["planificar", "Planifica"],
              ["ejecutar", "Ejecuta"],
              ["revisar", "Revisa"],
            ] as const
          ).map(([clave, etiqueta]) => (
            <div key={clave} className="panel p-4">
              <p className="text-xs text-muted-foreground">{etiqueta}</p>
              <p className="mt-1 font-display text-sm font-semibold">
                {recomendacion.equipo?.[clave] ?? "Sin asignar"}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {mesa.estado === "preparada" ? (
        <Boton type="button" disabled={deliberando} onClick={() => setConfirmar(true)}>
          <MessagesSquare className="size-4" /> Deliberar
        </Boton>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold">Sala</h2>
        {intervenciones.length === 0 && !deliberando ? (
          <p className="panel p-5 text-sm text-muted-foreground">Todavía no ha hablado nadie.</p>
        ) : null}
        {intervenciones.map((iv) => (
          <article key={iv.id} className="panel flex gap-3 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 font-display text-sm text-primary">
              {(iv.experto_nombre ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{iv.experto_nombre ?? "Experto"}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${COLOR_ROL_MESA[iv.rol] ?? ""}`}>
                  {ETIQUETA_ROL_MESA[iv.rol] ?? iv.rol}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {iv.proveedor} · {iv.modelo}
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {formatoEuros(Number(iv.coste ?? 0))}
                </span>
              </div>
              <div
                className="prose-nex mt-2 text-sm text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: markdownAHtml(iv.texto ?? "") }}
              />
            </div>
          </article>
        ))}
        {deliberando ? (
          <p className="flex items-center gap-2 rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-xs text-info">
            <Loader2 className="size-3.5 animate-spin" /> Deliberando… puede tardar entre 30 y 120 segundos.
          </p>
        ) : null}
      </section>

      <PanelCostes
        titulo="Lo que ha costado esta mesa"
        costeEur={Number(mesa.coste ?? 0)}
        tokensEntrada={mesa.tokens_entrada}
        tokensSalida={mesa.tokens_salida}
        duracionMs={duracionEntre(mesa.creado_el, mesa.concluida_el)}
        horasEstimadas={Number(recomendacion?.horas_estimadas ?? 0) || null}
        costeEstimado={Number(recomendacion?.coste_estimado ?? 0) || null}
      />



      {mesa.estado === "concluida" && mesa.sintesis ? (
        <section className="panel border-success/40 p-5">
          <h2 className="font-display text-sm font-semibold">Conclusión del coordinador</h2>
          <div
            className="prose-nex mt-3 text-sm text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: markdownAHtml(sintesisLegible(mesa.sintesis)) }}
          />

          {plan.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="border-b border-border text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Paso</th>
                    <th className="px-3 py-2">Responsable</th>
                    <th className="px-3 py-2">Horas</th>
                    <th className="px-3 py-2">Requiere tu atención</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plan.map((paso) => (
                    <tr key={paso.orden}>
                      <td className="px-3 py-2">
                        <p className="font-medium">{paso.titulo}</p>
                        {paso.descripcion ? (
                          <p className="text-xs text-muted-foreground">{paso.descripcion}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{paso.responsable ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{paso.horas ? `${Number(paso.horas).toFixed(1)} h` : "—"}</td>
                      <td className="px-3 py-2 text-xs">{paso.requiere_atencion ? "Sí" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              <p className="font-medium">Esta mesa terminó sin plan de trabajo.</p>
              <p className="mt-1">
                La conclusión llegó incompleta, así que no hay pasos que convertir en tareas. Pulsa «Volver a
                deliberar» para que los expertos la rehagan.
              </p>
              <button
                type="button"
                className="mt-2 rounded-md border border-warning/50 px-2 py-1 font-medium hover:bg-warning/20 disabled:opacity-50"
                disabled={deliberar.isPending}
                onClick={() => deliberar.mutate(mesa.id)}
              >
                Volver a deliberar
              </button>
            </div>
          )}

          {riesgos.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-warning">
              {riesgos.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}

          <dl className="mt-4 grid gap-3 sm:grid-cols-4">
            <Dato titulo="Coste estimado" valor={formatoEuros(Number(recomendacion?.coste_estimado ?? 0))} />
            <Dato titulo="Horas estimadas" valor={`${Number(recomendacion?.horas_estimadas ?? 0).toFixed(1)} h`} />
            <Dato titulo="Calidad prevista" valor={`${Number(recomendacion?.calidad_prevista ?? 0)}%`} />
            <Dato titulo="Riesgo" valor={String(recomendacion?.riesgo ?? "—")} />
          </dl>

          <p
            className={
              recomendacion?.requiere_aprobacion
                ? "mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                : "mt-4 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs text-success"
            }
          >
            {recomendacion?.requiere_aprobacion ? "Requiere tu aprobación" : "No requiere aprobación"}
            {recomendacion?.motivo ? `: ${recomendacion.motivo}` : "."}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Boton
              type="button"
              disabled={plan.length === 0 || crearTareas.isPending || actualizar.isPending}
              title={plan.length === 0 ? "Esta mesa todavía no tiene plan de trabajo." : undefined}
              onClick={() => void crearTareasDelPlan()}
            >
              <ListChecks className="size-4" /> Crear tareas del plan
            </Boton>
            <Boton type="button" variante="suave" disabled={crearOrden.isPending} onClick={() => void enviarComoOrden()}>
              <Send className="size-4" /> Enviar como orden
            </Boton>
            <Boton
              type="button"
              variante="suave"
              onClick={() => {
                void navigator.clipboard?.writeText(mesa.sintesis ?? "");
                toast.success("Conclusión copiada.");
              }}
            >
              <ClipboardCopy className="size-4" /> Copiar síntesis
            </Boton>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground">¿Te ha servido esta mesa?</p>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} de 5`}
                  onClick={() => setEstrellas(n)}
                  className={n <= estrellas ? "text-warning" : "text-muted-foreground"}
                >
                  <Star className="size-4" fill={n <= estrellas ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Comentario (opcional)"
              className={`${claseCampo} mt-2`}
            />
            <Boton
              type="button"
              variante="suave"
              className="mt-2"
              disabled={estrellas === 0 || valorar.isPending}
              onClick={() => {
                valorar.mutate({ mesaId: mesa.id, valoracion: estrellas, comentario });
                setComentario("");
              }}
            >
              Guardar valoración
            </Boton>
          </div>
        </section>
      ) : null}

      <Dialogo
        abierto={confirmar}
        titulo="Empezar la deliberación"
        onCerrar={() => setConfirmar(false)}
        ancho="max-w-lg"
      >
        <p className="text-sm text-muted-foreground">
          Van a intervenir {equipo.length} expertos en modo {ETIQUETA_MODO_MESA[mesa.modo].toLowerCase()}.{" "}
          {EXPLICACION_MODO_MESA[mesa.modo]} Puede tardar entre 30 y 120 segundos.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Boton type="button" variante="suave" onClick={() => setConfirmar(false)}>
            Cancelar
          </Boton>
          <Boton
            type="button"
            disabled={deliberar.isPending}
            onClick={() => {
              setConfirmar(false);
              deliberar.mutate(mesa.id);
            }}
          >
            <MessagesSquare className="size-4" /> Deliberar
          </Boton>
        </div>
      </Dialogo>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{titulo}</dt>
      <dd className="mt-0.5 font-display text-sm font-semibold">{valor}</dd>
    </div>
  );
}
