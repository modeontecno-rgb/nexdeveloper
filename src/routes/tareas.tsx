import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compatibilidad con avisos antiguos que todavía enlazan a `/tareas`. */
export const Route = createFileRoute("/tareas")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search["tarea"] === "string" ? { tarea: search["tarea"] } : {}),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/cola", search });
  },
});