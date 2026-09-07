import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Cpu,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  Wand2,
  X,
} from "lucide-react";
import * as React from "react";

import { CronometroBarra } from "@/components/nex/cronometro";
import { BotonInstalar } from "@/components/nex/instalar-app";
import { PaletaAsistente } from "@/components/nex/paleta-asistente";
import { PastillaVersion } from "@/components/nex/pastilla-version";
import { PieMarca } from "@/components/nex/pie-marca";
import { useAuth } from "@/lib/nex/auth";
import { usePerfil, useProyectos } from "@/lib/nex/queries/datos";
import { pendientes, useEntradasBandeja } from "@/lib/nex/queries/bandeja";
import { useAvisosSinLeer } from "@/lib/nex/queries/avisos";
import { usePropuestasPendientes } from "@/routes/pideme";
import {
  ANCLADOS_PIE,
  CLAVE_GRUPO_ABIERTO,
  CLAVE_MENU_CONTRAIDO,
  FIJOS_ARRIBA,
  GRUPOS_MENU,
  TODAS_LAS_PANTALLAS,
  buscarPantallas,
  esRutaActiva,
  grupoDeRuta,
  leerAccesosMovil,
  pantallaPorRuta,
  type PantallaMenu,
  type RutaMenu,
} from "@/lib/nex/menu";
import { cn } from "@/lib/utils";

const CURVA = "cubic-bezier(.32,.72,0,1)";

/* ------------------------------ Contadores -------------------------------- */

type Contadores = { bandeja: number; avisos: number; propuestas: number };

const CtxContadores = React.createContext<Contadores>({ bandeja: 0, avisos: 0, propuestas: 0 });

function contadorDe(to: string, c: Contadores) {
  if (to === "/bandeja") return c.bandeja;
  if (to === "/avisos") return c.avisos;
  if (to === "/pideme") return c.propuestas;
  return 0;
}

/* --------------------------- Accesos del móvil ---------------------------- */

/** Los cuatro accesos rápidos de la barra inferior, configurables en Ajustes. */
export function useAccesosMovil(): RutaMenu[] {
  const [rutas, setRutas] = React.useState<RutaMenu[]>(() => leerAccesosMovil());
  React.useEffect(() => {
    const releer = () => setRutas(leerAccesosMovil());
    releer();
    window.addEventListener("nexdeveloper:accesos-movil", releer);
    window.addEventListener("storage", releer);
    return () => {
      window.removeEventListener("nexdeveloper:accesos-movil", releer);
      window.removeEventListener("storage", releer);
    };
  }, []);
  return rutas;
}

/* --------------------------------- Shell ---------------------------------- */

export function AppShell({ children }: { children: React.ReactNode }) {
  const ruta = useRouterState({ select: (s) => s.location.pathname });
  const { usuario, salir } = useAuth();
  const { data: perfil } = usePerfil();
  const { data: entradasBandeja = [] } = useEntradasBandeja();
  const avisosSinLeer = useAvisosSinLeer();
  const propuestasPendientes = usePropuestasPendientes();

  const contadores = React.useMemo<Contadores>(
    () => ({
      bandeja: pendientes(entradasBandeja),
      avisos: avisosSinLeer,
      propuestas: propuestasPendientes,
    }),
    [entradasBandeja, avisosSinLeer, propuestasPendientes],
  );

  const [hoja, setHoja] = React.useState(false);
  const [contraido, setContraido] = React.useState(false);
  const [buscadorAbierto, setBuscadorAbierto] = React.useState(false);

  // Entre 768 y 1023 px el menú arranca contraído; recordamos la elección.
  React.useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_MENU_CONTRAIDO);
      if (guardado !== null) {
        setContraido(guardado === "1");
        return;
      }
    } catch {
      /* sin almacenamiento */
    }
    setContraido(window.matchMedia("(max-width: 1279px)").matches);
  }, []);

  const cambiarContraido = (v: boolean) => {
    setContraido(v);
    try {
      window.localStorage.setItem(CLAVE_MENU_CONTRAIDO, v ? "1" : "0");
    } catch {
      /* sin almacenamiento */
    }
  };

  React.useEffect(() => {
    setHoja(false);
  }, [ruta]);

  // Cmd/Ctrl + K abre el buscador del menú.
  React.useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.matchMedia("(min-width: 1024px)").matches) {
          cambiarContraido(false);
          setBuscadorAbierto(true);
        } else {
          setHoja(true);
        }
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  const pantallaActual = React.useMemo(
    () => [...TODAS_LAS_PANTALLAS].reverse().find((p) => esRutaActiva(p.to, ruta)),
    [ruta],
  );

  return (
    <CtxContadores.Provider value={contadores}>
      <div
        className="min-h-screen lg:grid"
        style={{ gridTemplateColumns: contraido ? "4.5rem 1fr" : "17rem 1fr" }}
      >
        <CabeceraMovil titulo={pantallaActual?.etiqueta ?? "NexDeveloper"} onMenu={() => setHoja(true)} />

        <aside
          className={cn(
            "z-20 hidden flex-col border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-screen",
          )}
        >
          <MenuLateral
            ruta={ruta}
            contraido={contraido}
            onContraer={cambiarContraido}
            buscadorAbierto={buscadorAbierto}
            onBuscadorAbierto={setBuscadorAbierto}
            perfil={perfil?.nombre_completo || usuario?.email || "Sesión iniciada"}
            onSalir={() => void salir()}
          />
        </aside>

        <HojaMenu
          abierta={hoja}
          onCerrar={() => setHoja(false)}
          ruta={ruta}
          perfil={perfil?.nombre_completo || usuario?.email || "Sesión iniciada"}
          onSalir={() => void salir()}
        />

        <main className="min-w-0 overflow-x-hidden px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:py-10 lg:pb-10">
          {children}
        </main>

        <BarraInferior ruta={ruta} onMenu={() => setHoja(true)} />
        <BotonPideme ruta={ruta} />
        <CronometroBarra />
        <PaletaAsistente />
      </div>
    </CtxContadores.Provider>
  );
}

/* ------------------------------ Menú lateral ------------------------------ */

function useGrupoAbierto(ruta: string) {
  const [grupo, setGrupo] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      setGrupo(window.localStorage.getItem(CLAVE_GRUPO_ABIERTO));
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  // Navegar a una pantalla abre su grupo.
  React.useEffect(() => {
    const suyo = grupoDeRuta(ruta);
    if (suyo) {
      setGrupo(suyo);
      try {
        window.localStorage.setItem(CLAVE_GRUPO_ABIERTO, suyo);
      } catch {
        /* sin almacenamiento */
      }
    }
  }, [ruta]);

  const alternar = (id: string) => {
    setGrupo((actual) => {
      const nuevo = actual === id ? null : id;
      try {
        if (nuevo) window.localStorage.setItem(CLAVE_GRUPO_ABIERTO, nuevo);
        else window.localStorage.removeItem(CLAVE_GRUPO_ABIERTO);
      } catch {
        /* sin almacenamiento */
      }
      return nuevo;
    });
  };

  return { grupo, alternar };
}

function MenuLateral({
  ruta,
  contraido,
  onContraer,
  buscadorAbierto,
  onBuscadorAbierto,
  perfil,
  onSalir,
}: {
  ruta: string;
  contraido: boolean;
  onContraer: (v: boolean) => void;
  buscadorAbierto: boolean;
  onBuscadorAbierto: (v: boolean) => void;
  perfil: string;
  onSalir: () => void;
}) {
  const { grupo, alternar } = useGrupoAbierto(ruta);

  if (contraido) return <RailContraido ruta={ruta} onExpandir={() => onContraer(false)} />;

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-4 pt-5 pb-3">
        <Marca />
        <button
          type="button"
          onClick={() => onContraer(true)}
          aria-label="Contraer el menú"
          title="Contraer el menú"
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <ChevronsLeft className="size-4" />
        </button>
      </div>

      <div className="px-3 pb-2">
        <BuscadorMenu abierto={buscadorAbierto} onAbierto={onBuscadorAbierto} />
      </div>

      <nav aria-label="Menú principal" className="px-3 pb-1">
        <ul className="flex flex-col gap-0.5">
          {FIJOS_ARRIBA.map((p) => (
            <li key={p.to}>
              <ItemMenu pantalla={p} ruta={ruta} />
            </li>
          ))}
        </ul>
      </nav>

      <nav aria-label="Categorías" className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-2">
        <ul className="flex flex-col gap-3">
          {GRUPOS_MENU.map((g) => {
            const abierto = grupo === g.id;
            const tieneActiva = g.pantallas.some((p) => esRutaActiva(p.to, ruta));
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => alternar(g.id)}
                  aria-expanded={abierto}
                  className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-muted-foreground/80 transition-colors hover:text-foreground"
                  style={{ fontSize: "12.5px" }}
                >
                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 transition-transform motion-reduce:transition-none",
                      !abierto && "-rotate-90",
                    )}
                    style={{ transitionDuration: abierto ? "180ms" : "140ms", transitionTimingFunction: CURVA }}
                  />
                  <span className="truncate">{g.titulo}</span>
                  {!abierto && tieneActiva ? (
                    <span className="ml-auto size-1.5 shrink-0 rounded-full bg-sidebar-primary" aria-hidden />
                  ) : null}
                </button>

                <div
                  className="grid overflow-hidden transition-[grid-template-rows] motion-reduce:transition-none"
                  style={{
                    gridTemplateRows: abierto ? "1fr" : "0fr",
                    transitionDuration: abierto ? "180ms" : "140ms",
                    transitionTimingFunction: CURVA,
                  }}
                >
                  <div className="min-h-0">
                    <ul className="ml-[18px] flex flex-col gap-0.5 border-l border-sidebar-border pl-[18px] pt-0.5">
                      {g.pantallas.map((p) => (
                        <li key={p.to}>
                          <ItemMenu pantalla={p} ruta={ruta} sangrado />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto space-y-2 border-t border-sidebar-border p-3">
        <ul className="flex flex-col gap-0.5">
          {ANCLADOS_PIE.map((p) => (
            <li key={p.to}>
              <ItemMenu pantalla={p} ruta={ruta} />
            </li>
          ))}
        </ul>
        <SelectorTema />
        <div className="rounded-lg border border-sidebar-border bg-surface p-3">
          <p className="truncate text-xs font-medium text-foreground">{perfil}</p>
          <button
            type="button"
            onClick={onSalir}
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
    </>
  );
}

function ItemMenu({
  pantalla,
  ruta,
  sangrado,
  onNavegar,
  alto,
}: {
  pantalla: PantallaMenu;
  ruta: string;
  sangrado?: boolean;
  onNavegar?: () => void;
  alto?: number;
}) {
  const contadores = React.useContext(CtxContadores);
  const activo = esRutaActiva(pantalla.to, ruta);
  const Icono = pantalla.icono;
  const contador = contadorDe(pantalla.to, contadores);

  return (
    <Link
      to={pantalla.to}
      onClick={onNavegar}
      title={pantalla.descripcion}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg pr-2.5 transition-colors motion-reduce:transition-none",
        sangrado ? "pl-2.5" : "pl-2.5",
        activo
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
      )}
      style={{ fontSize: "13.5px", height: alto ? `${alto}px` : "40px" }}
    >
      {activo ? (
        <span
          aria-hidden
          className="absolute -left-[19px] top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary"
          style={sangrado ? undefined : { left: "-6px" }}
        />
      ) : null}
      <Icono className={cn("size-4 shrink-0", activo && "text-sidebar-primary")} />
      <span className="truncate">{pantalla.etiqueta}</span>
      {contador > 0 ? (
        <span className="ml-auto shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
          {contador > 99 ? "99+" : contador}
        </span>
      ) : null}
    </Link>
  );
}

/* ------------------------------ Rail contraído ---------------------------- */

function RailContraido({ ruta, onExpandir }: { ruta: string; onExpandir: () => void }) {
  const [flotante, setFlotante] = React.useState<string | null>(null);

  return (
    <div className="flex h-full w-[4.5rem] flex-col items-center gap-1 py-4">
      <button
        type="button"
        onClick={onExpandir}
        aria-label="Desplegar el menú"
        title="Desplegar el menú"
        className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
      >
        <ChevronsRight className="size-4" />
      </button>

      {FIJOS_ARRIBA.map((p) => (
        <IconoRail key={p.to} pantalla={p} ruta={ruta} />
      ))}

      <div className="my-1 h-px w-8 bg-sidebar-border" />

      <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
        {GRUPOS_MENU.map((g) => {
          const Icono = g.icono;
          const tieneActiva = g.pantallas.some((p) => esRutaActiva(p.to, ruta));
          return (
            <div
              key={g.id}
              className="relative"
              onMouseEnter={() => setFlotante(g.id)}
              onMouseLeave={() => setFlotante(null)}
            >
              <button
                type="button"
                aria-label={g.titulo}
                title={g.titulo}
                onClick={() => setFlotante((v) => (v === g.id ? null : g.id))}
                className={cn(
                  "grid size-10 place-items-center rounded-lg transition-colors",
                  tieneActiva
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icono className="size-4" />
              </button>
              {flotante === g.id ? (
                <div className="absolute left-[calc(100%+8px)] top-0 z-40 w-60 rounded-xl border border-sidebar-border bg-sidebar p-2 shadow-xl">
                  <p className="px-2 pb-1 text-[12.5px] text-muted-foreground/80">{g.titulo}</p>
                  <ul className="flex flex-col gap-0.5">
                    {g.pantallas.map((p) => (
                      <li key={p.to}>
                        <ItemMenu pantalla={p} ruta={ruta} onNavegar={() => setFlotante(null)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col items-center gap-1 pt-2">
        {ANCLADOS_PIE.map((p) => (
          <IconoRail key={p.to} pantalla={p} ruta={ruta} />
        ))}
        <PastillaVersion className="mt-1" />
      </div>
    </div>
  );
}

function IconoRail({ pantalla, ruta }: { pantalla: PantallaMenu; ruta: string }) {
  const contadores = React.useContext(CtxContadores);
  const activo = esRutaActiva(pantalla.to, ruta);
  const Icono = pantalla.icono;
  const contador = contadorDe(pantalla.to, contadores);

  return (
    <Link
      to={pantalla.to}
      aria-label={pantalla.etiqueta}
      title={pantalla.etiqueta}
      className={cn(
        "relative grid size-10 place-items-center rounded-lg transition-colors",
        activo
          ? "bg-sidebar-accent text-sidebar-primary"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <Icono className="size-4" />
      {contador > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {contador > 9 ? "9+" : contador}
        </span>
      ) : null}
    </Link>
  );
}

/* -------------------------------- Buscador -------------------------------- */

function BuscadorMenu({
  abierto,
  onAbierto,
  autofoco,
  onNavegar,
}: {
  abierto?: boolean;
  onAbierto?: (v: boolean) => void;
  autofoco?: boolean;
  onNavegar?: () => void;
}) {
  const navegar = useNavigate();
  const [texto, setTexto] = React.useState("");
  const campo = React.useRef<HTMLInputElement>(null);
  const { data: proyectos = [] } = useProyectos();

  React.useEffect(() => {
    if (abierto || autofoco) campo.current?.focus();
  }, [abierto, autofoco]);

  const resultados = React.useMemo(() => buscarPantallas(texto), [texto]);
  const proyectosEncontrados = React.useMemo(() => {
    const q = texto.trim().toLowerCase();
    if (q.length < 2) return [];
    return proyectos.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 5);
  }, [texto, proyectos]);

  const porGrupo = React.useMemo(() => {
    const mapa = new Map<string, typeof resultados>();
    for (const r of resultados) {
      const lista = mapa.get(r.grupo) ?? [];
      lista.push(r);
      mapa.set(r.grupo, lista);
    }
    return [...mapa.entries()];
  }, [resultados]);

  const abrirPrimero = () => {
    const primero = resultados[0];
    if (primero) {
      void navegar({ to: primero.pantalla.to });
      cerrar();
      return;
    }
    const proyecto = proyectosEncontrados[0];
    if (proyecto) {
      void navegar({ to: "/proyectos/$proyectoId", params: { proyectoId: proyecto.id } });
      cerrar();
    }
  };

  const cerrar = () => {
    setTexto("");
    onAbierto?.(false);
    onNavegar?.();
  };

  const hayResultados = resultados.length > 0 || proyectosEncontrados.length > 0;

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={campo}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            abrirPrimero();
          }
          if (e.key === "Escape") cerrar();
        }}
        type="search"
        placeholder="Buscar pantalla o proyecto"
        aria-label="Buscar en el menú"
        className="h-11 w-full rounded-lg border border-input bg-surface pl-9 pr-14 text-sm text-foreground outline-none focus:border-primary"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground lg:block">
        ⌘K
      </kbd>

      {texto.trim().length >= 2 ? (
        <div className="mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-sidebar-border bg-sidebar p-2 shadow-lg">
          {!hayResultados ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">No hay ninguna pantalla con ese nombre.</p>
          ) : null}
          {porGrupo.map(([grupo, lista]) => (
            <div key={grupo} className="mb-2 last:mb-0">
              <p className="px-2 pb-1 text-[11.5px] text-muted-foreground/70">{grupo}</p>
              <ul className="flex flex-col gap-0.5">
                {lista.map((r) => {
                  const Icono = r.pantalla.icono;
                  return (
                    <li key={r.pantalla.to}>
                      <Link
                        to={r.pantalla.to}
                        onClick={cerrar}
                        className="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      >
                        <Icono className="size-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate">{r.pantalla.etiqueta}</span>
                          <span className="block truncate text-[11.5px] text-muted-foreground/70">
                            {r.pantalla.descripcion}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {proyectosEncontrados.length > 0 ? (
            <div>
              <p className="px-2 pb-1 text-[11.5px] text-muted-foreground/70">Proyectos</p>
              <ul className="flex flex-col gap-0.5">
                {proyectosEncontrados.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/proyectos/$proyectoId"
                      params={{ proyectoId: p.id }}
                      onClick={cerrar}
                      className="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    >
                      <span className="truncate">{p.nombre}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ Cabecera móvil ---------------------------- */

function CabeceraMovil({ titulo, onMenu }: { titulo: string; onMenu: () => void }) {
  const { avisos } = React.useContext(CtxContadores);

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-sidebar-border bg-sidebar/95 px-2 backdrop-blur lg:hidden">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Abrir el menú"
        className="grid size-11 place-items-center rounded-md text-muted-foreground hover:text-foreground"
      >
        <Menu className="size-5" />
      </button>
      <p className="min-w-0 flex-1 truncate font-display text-sm font-semibold">{titulo}</p>
      <Link
        to="/avisos"
        aria-label={`Avisos${avisos > 0 ? `: ${avisos} sin leer` : ""}`}
        className="relative grid size-11 place-items-center rounded-md text-muted-foreground hover:text-foreground"
      >
        <Bell className="size-5" />
        {avisos > 0 ? (
          <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {avisos > 9 ? "9+" : avisos}
          </span>
        ) : null}
      </Link>
    </header>
  );
}

/* ------------------------------- Hoja del menú ---------------------------- */

function HojaMenu({
  abierta,
  onCerrar,
  ruta,
  perfil,
  onSalir,
}: {
  abierta: boolean;
  onCerrar: () => void;
  ruta: string;
  perfil: string;
  onSalir: () => void;
}) {
  const { grupo, alternar } = useGrupoAbierto(ruta);

  React.useEffect(() => {
    if (!abierta) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
      <button
        type="button"
        aria-label="Cerrar el menú"
        onClick={onCerrar}
        className="absolute inset-0 bg-black/50"
      />
      <div
        className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col border-r border-sidebar-border bg-sidebar shadow-2xl"
        style={{ animation: `deslizar 180ms ${CURVA}` }}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
          <Marca />
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar el menú"
            className="grid size-11 place-items-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-3 pb-2">
          <BuscadorMenu autofoco onNavegar={onCerrar} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <ul className="flex flex-col gap-0.5">
            {FIJOS_ARRIBA.map((p) => (
              <li key={p.to}>
                <ItemMenu pantalla={p} ruta={ruta} onNavegar={onCerrar} alto={48} />
              </li>
            ))}
          </ul>

          <ul className="mt-3 flex flex-col gap-3">
            {GRUPOS_MENU.map((g) => {
              const abierto = grupo === g.id;
              const tieneActiva = g.pantallas.some((p) => esRutaActiva(p.to, ruta));
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => alternar(g.id)}
                    aria-expanded={abierto}
                    className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-left text-muted-foreground/80"
                    style={{ fontSize: "12.5px" }}
                  >
                    <ChevronDown
                      className={cn(
                        "size-3.5 shrink-0 transition-transform motion-reduce:transition-none",
                        !abierto && "-rotate-90",
                      )}
                      style={{ transitionDuration: "180ms", transitionTimingFunction: CURVA }}
                    />
                    <span className="truncate">{g.titulo}</span>
                    {!abierto && tieneActiva ? (
                      <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" aria-hidden />
                    ) : null}
                  </button>
                  {abierto ? (
                    <ul className="ml-[18px] flex flex-col gap-0.5 border-l border-sidebar-border pl-[18px]">
                      {g.pantallas.map((p) => (
                        <li key={p.to}>
                          <ItemMenu pantalla={p} ruta={ruta} sangrado onNavegar={onCerrar} alto={48} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <ul className="mt-4 flex flex-col gap-0.5 border-t border-sidebar-border pt-3">
            {ANCLADOS_PIE.map((p) => (
              <li key={p.to}>
                <ItemMenu pantalla={p} ruta={ruta} onNavegar={onCerrar} alto={48} />
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-2">
            <SelectorTema />
            <div className="rounded-lg border border-sidebar-border bg-surface p-3">
              <p className="truncate text-xs font-medium text-foreground">{perfil}</p>
              <button
                type="button"
                onClick={onSalir}
                className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive"
              >
                <LogOut className="size-3.5" /> Cerrar sesión
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <PieMarca className="flex-1" />
              <PastillaVersion />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Barra inferior ---------------------------- */

function BarraInferior({ ruta, onMenu }: { ruta: string; onMenu: () => void }) {
  const contadores = React.useContext(CtxContadores);
  const accesos = useAccesosMovil();

  return (
    <nav
      aria-label="Accesos rápidos"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-sidebar-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {accesos.map((to) => {
        const pantalla = pantallaPorRuta(to);
        if (!pantalla) return null;
        const Icono = pantalla.icono;
        const activo = esRutaActiva(pantalla.to, ruta);
        const contador = contadorDe(pantalla.to, contadores);
        return (
          <Link
            key={to}
            to={pantalla.to}
            className={cn(
              "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
              activo ? "font-medium text-sidebar-primary" : "text-muted-foreground",
            )}
          >
            <Icono className="size-5" />
            <span className="max-w-full truncate px-1">{pantalla.etiqueta}</span>
            {contador > 0 ? (
              <span className="absolute right-[22%] top-2 size-2 rounded-full bg-primary" aria-hidden />
            ) : null}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMenu}
        className="flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground"
      >
        <Menu className="size-5" />
        Menú
      </button>
    </nav>
  );
}

/** Botón redondo para dictar con una mano, sobre la barra inferior. */
function BotonPideme({ ruta }: { ruta: string }) {
  const principales = ["/", "/cola", "/bandeja", "/avisos", "/proyectos"];
  if (!principales.includes(ruta)) return null;

  return (
    <Link
      to="/pideme"
      aria-label="Pídeme qué quieres"
      className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg lg:hidden"
    >
      <Wand2 className="size-6" />
    </Link>
  );
}

/* --------------------------------- Varios --------------------------------- */

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
          "flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
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
          "flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
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
      <div className="min-w-0">
        <h1 className="text-xl font-semibold sm:text-3xl">{titulo}</h1>
        {descripcion ? <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p> : null}
      </div>
      {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
    </div>
  );
}
