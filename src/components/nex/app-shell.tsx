import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  Boxes,
  Cpu,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Moon,
  Plug,
  Users,
  GitBranch,
  Globe,
  Settings,
  ShieldCheck,
  Sparkle,
  Sun,
  X,
  BadgeCheck,
  DatabaseBackup,
  Package,
} from "lucide-react";
import * as React from "react";

import { PastillaVersion } from "@/components/nex/pastilla-version";
import { PieMarca } from "@/components/nex/pie-marca";
import { useAuth } from "@/lib/nex/auth";
import { usePerfil } from "@/lib/nex/queries/datos";
import { pendientes, useEntradasBandeja } from "@/lib/nex/queries/bandeja";
import { cn } from "@/lib/utils";

const NAVEGACION = [
  { to: "/", etiqueta: "Inicio", icono: LayoutDashboard },
  { to: "/bandeja", etiqueta: "Bandeja", icono: Inbox },
  { to: "/resumenes", etiqueta: "Resúmenes", icono: Newspaper },
  { to: "/proyectos", etiqueta: "Proyectos", icono: Boxes },
  { to: "/nueva-orden", etiqueta: "Nueva orden", icono: Sparkle },
  { to: "/cola", etiqueta: "Cola", icono: ListTodo },
  { to: "/aprobaciones", etiqueta: "Aprobaciones", icono: ShieldCheck },
  { to: "/agentes", etiqueta: "Agentes", icono: Cpu },
  { to: "/referencia", etiqueta: "Referencia de uso", icono: BookOpen },
  { to: "/expertos", etiqueta: "Expertos", icono: Users },
  { to: "/repositorios", etiqueta: "Repositorios", icono: GitBranch },
  { to: "/compilaciones", etiqueta: "Compilaciones", icono: Package },
  { to: "/calidad", etiqueta: "Calidad", icono: BadgeCheck },
  { to: "/vigilancia", etiqueta: "Vigilancia", icono: Radar },
  { to: "/copias", etiqueta: "Copias", icono: DatabaseBackup },
  { to: "/dominios", etiqueta: "Dominios", icono: Globe },

  { to: "/integraciones", etiqueta: "Integraciones", icono: Plug },
  { to: "/estado", etiqueta: "Estado del sistema", icono: Activity },
  { to: "/ajustes", etiqueta: "Ajustes", icono: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = React.useState(false);
  const ruta = useRouterState({ select: (s) => s.location.pathname });
  const { usuario, salir } = useAuth();
  const { data: perfil } = usePerfil();
  const { data: entradasBandeja = [] } = useEntradasBandeja();
  const pendientesBandeja = pendientes(entradasBandeja);

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
          "z-20 flex flex-col border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:h-screen lg:flex",
          abierto ? "flex" : "hidden",
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
                {to === "/bandeja" && pendientesBandeja > 0 ? (
                  <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                    {pendientesBandeja}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 p-3">
          <SelectorTema />
          <div className="rounded-lg border border-sidebar-border bg-surface p-3">
            <p className="truncate text-xs font-medium text-foreground">
              {perfil?.nombre_completo || usuario?.email || "Sesión iniciada"}
            </p>
            <button
              type="button"
              onClick={() => void salir()}
              className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              <LogOut className="size-3.5" /> Cerrar sesión
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <PieMarca className="flex-1" />
            <PastillaVersion />
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}

const CLAVE_TEMA = "nexdeveloper-tema";

function SelectorTema() {
  const [oscuro, setOscuro] = React.useState(true);

  React.useEffect(() => {
    setOscuro(document.documentElement.classList.contains("dark"));
  }, []);

  const cambiar = (aOscuro: boolean) => {
    setOscuro(aOscuro);
    document.documentElement.classList.toggle("dark", aOscuro);
    try {
      window.localStorage.setItem(CLAVE_TEMA, aOscuro ? "oscuro" : "claro");
    } catch {
      /* sin almacenamiento */
    }
  };

  return (
    <div
      role="group"
      aria-label="Tema de color"
      className="grid grid-cols-2 gap-1 rounded-lg border border-sidebar-border bg-surface p-1"
    >
      <button
        type="button"
        onClick={() => cambiar(false)}
        aria-pressed={!oscuro}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
          !oscuro ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Sun className="size-3.5" /> Claro
      </button>
      <button
        type="button"
        onClick={() => cambiar(true)}
        aria-pressed={oscuro}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
          oscuro ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Moon className="size-3.5" /> Oscuro
      </button>
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
