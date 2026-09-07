import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bell, CheckCircle2, ListTodo, MessageSquareText, Play, Send, Users } from "lucide-react";

import { Encabezado } from "@/components/nex/app-shell";

export const Route = createFileRoute("/guia")({
  head: () => ({
    meta: [
      { title: "Cómo hacer un trabajo · NexDeveloper" },
      { name: "description", content: "Guía paso a paso para pedir, revisar, ejecutar y terminar un trabajo en NexDeveloper." },
      { property: "og:title", content: "Cómo hacer un trabajo · NexDeveloper" },
      { property: "og:description", content: "Guía paso a paso para completar un trabajo de principio a fin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuiaTrabajo,
});

const PASOS = [
  {
    numero: 1,
    titulo: "Pide el trabajo",
    texto: "Entra en «Pídeme qué quieres», elige el proyecto y explica el resultado que necesitas. Puedes escribir o dictar.",
    to: "/pideme" as const,
    accion: "Abrir Pídeme",
    icono: MessageSquareText,
  },
  {
    numero: 2,
    titulo: "Revisa la propuesta",
    texto: "En la pestaña «Propuestas pendientes», comprueba qué se va a hacer, el proyecto y el coste. Aprueba solo si está correcto.",
    to: "/pideme" as const,
    accion: "Ver propuestas",
    icono: CheckCircle2,
  },
  {
    numero: 3,
    titulo: "Sigue las tareas",
    texto: "La Cola reúne todo el trabajo. «Requiere tu atención» espera una decisión tuya; «Trabajo desatendido» avanza solo.",
    to: "/cola" as const,
    accion: "Abrir la Cola",
    icono: ListTodo,
  },
  {
    numero: 4,
    titulo: "Revisa la ejecución",
    texto: "Cuando la IA empiece, consulta «Ejecución de la IA». Ahí verás el avance y el resultado técnico del encargo.",
    to: "/ejecucion" as const,
    accion: "Ver ejecuciones",
    icono: Play,
  },
  {
    numero: 5,
    titulo: "Atiende los avisos",
    texto: "Un aviso te lleva directamente al elemento que necesita revisión. Al abrir una tarea, aparecerá destacada en la Cola.",
    to: "/avisos" as const,
    accion: "Abrir avisos",
    icono: Bell,
  },
] as const;

function GuiaTrabajo() {
  return (
    <>
      <Encabezado
        titulo="Cómo hacer un trabajo"
        descripcion="Un único recorrido, desde la petición hasta el resultado terminado."
        acciones={
          <Link
            to="/pideme"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Empezar un trabajo <ArrowRight className="size-4" />
          </Link>
        }
      />

      <section className="border-y border-border py-5">
        <p className="text-sm font-medium text-foreground">La regla sencilla</p>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Empieza siempre en «Pídeme qué quieres». Usa la Mesa de expertos solo cuando necesites comparar varias soluciones antes de crear tareas.
        </p>
      </section>

      <ol className="mt-6 divide-y divide-border border-y border-border">
        {PASOS.map((paso) => {
          const Icono = paso.icono;
          return (
            <li key={paso.numero} className="grid gap-4 py-5 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center">
              <span className="grid size-10 place-items-center rounded-full border border-primary/40 bg-primary/10 font-display text-sm font-semibold text-primary">
                {paso.numero}
              </span>
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                  <Icono className="size-4 text-primary" /> {paso.titulo}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{paso.texto}</p>
              </div>
              <Link to={paso.to} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                {paso.accion} <ArrowRight className="size-4" />
              </Link>
            </li>
          );
        })}
      </ol>

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="border-l-2 border-primary pl-4">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold"><Users className="size-4 text-primary" /> Cuándo usar la Mesa</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Úsala para decisiones complejas: arquitectura, diseño, estrategia o comparación de alternativas. Al terminar, pulsa una sola vez «Crear tareas del plan» y abre la Cola.
          </p>
          <Link to="/mesa" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">Abrir la Mesa <ArrowRight className="size-4" /></Link>
        </div>
        <div className="border-l-2 border-success pl-4">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold"><Send className="size-4 text-success" /> Cuándo está terminado</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            El trabajo termina cuando sus tareas están completadas y has revisado el resultado. Si necesita publicación, hazla desde la ejecución o compilación correspondiente.
          </p>
        </div>
      </section>
    </>
  );
}