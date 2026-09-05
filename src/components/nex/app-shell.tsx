import { Link, useRouterState } from "@tanstack/react-router";
import {
  Boxes,
  Cpu,
  Gauge,
  LayoutDashboard,
  ListTodo,
  Plug,
  Settings,
  Sparkle,
  Activity,
  Menu,
  X,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const NAVEGACION = [
  { to: "/", etiqueta: "Inicio", icono: LayoutDashboard },
  { to: "/proyectos", etiqueta: "Proyectos", icono: Boxes },
  { to: "/nueva-orden", etiqueta: "Nueva orden", icono: Sparkle },
  { to: "/cola", etiqueta: "Cola", icono: ListTodo },
  { to: "/agentes", etiqueta: "Agentes", icono: Cpu },
  { to: "/integraciones", etiqueta: "Integraciones", icono: Plug },
  { to: "/estado", etiqueta: "Estado del sistema", icono: Activity },
  { to: "/ajustes", etiqueta: "Ajustes", icono: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = React.useState(false);
  const ruta = useRouterState({ select: (s) => s.location.pathname });

  React.useEffect(() => {
    setAbierto(false);
  }, [ruta]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-sidebar/95 px-4 py-3 backdrop-blur lg:hidden">
        <Marca />
        <button
          type="button"
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setAbierto((v) => !v)}
          className="rounded-md border border-border p-2 text-muted-foreground hover:text-foreground"
        >
          {abierto ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </header>

      <aside
        className={cn(
          "z-20 border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:h-screen lg:block",
          abierto ? "block" : "hidden",
        )}
      >
        <div className="hidden px-5 py-6 lg:block">
          <Marca />
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAVEGACION.map(({ to, etiqueta, icono: Icono }) => {
            const activo = to === "/" ? ruta === "/" : ruta.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  activo
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icono className={cn("size-4", activo && "text-sidebar-primary")} />
                {etiqueta}
              </Link>
            );
          })}
        </nav>
        <div className="mx-3 mt-4 rounded-lg border border-sidebar-border bg-surface p-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <Gauge className="size-3.5 text-primary" /> Datos de demostración
          </p>
          <p className="mt-1 leading-relaxed">
            Se usarán tus datos reales en cuanto enlaces tu base de datos propia.
          </p>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}

function Marca() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
        <Cpu className="size-4" />
      </span>
      <span className="font-display text-base font-semibold tracking-tight">NexDeveloper</span>
    </Link>
  );
}

export function Encabezado({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{titulo}</h1>
        {descripcion ? <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p> : null}
      </div>
      {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
    </div>
  );
}
