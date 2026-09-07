import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BellRing,
  Check,
  Coins,
  DatabaseBackup,
  Globe,
  HeartPulse,
  Package,
  Share,
  ShieldCheck,
  Smartphone,
  Trash2,
  Zap,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { AppShell, Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import type { AvisoRow, TipoAviso } from "@/lib/nex/db-types";
import { desde, formatoFechaHora } from "@/lib/nex/labels";
import { normalizarDestinoInterno } from "@/lib/nex/navegacion";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  ETIQUETA_TIPO_AVISO,
  TIPOS_AVISO_CONFIGURABLES,
  claveVapidABytes,
  enPantallaInicio,
  esIos,
  nombreDispositivo,
  registrarTrabajador,
  soportaAvisos,
  useAvisos,
  useEstadoAvisos,
  useGuardarConfigAvisos,
  useMarcarLeidos,
  useProbarAviso,
  useQuitarDispositivo,
  useRealtimeAvisos,
  useSuscribirDispositivo,
} from "@/lib/nex/queries/avisos";
import { cn } from "@/lib/utils";

/** El silencio nocturno puede llegar como número de hora (23) o como texto ("23:00"). */
function aHoraTexto(valor: string | number | null | undefined) {
  if (valor === null || valor === undefined || valor === "") return "";
  if (typeof valor === "number") return `${String(valor).padStart(2, "0")}:00`;
  const texto = String(valor);
  if (/^\d{1,2}$/.test(texto)) return `${texto.padStart(2, "0")}:00`;
  return texto.slice(0, 5);
}

function deHoraTexto(valor: string): number | null {
  if (!valor) return null;
  const hora = Number(valor.split(":")[0]);
  return Number.isFinite(hora) ? hora : null;
}


export const Route = createFileRoute("/avisos")({
  head: () => ({
    meta: [
      { title: "Avisos · NexDeveloper" },
      {
        name: "description",
        content: "Recibe avisos en el móvil cuando algo necesita tu atención en tus proyectos.",
      },
      { property: "og:title", content: "Avisos · NexDeveloper" },
      { property: "og:description", content: "Avisos en el móvil de compilaciones, dominios, presupuestos y salud." },
    ],
  }),
  component: PantallaAvisos,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="font-display text-lg font-semibold">No se han podido cargar los avisos</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Error desconocido."}</p>
      <a href="/" className="mt-4 inline-flex rounded-md border border-border px-4 py-2 text-sm">Ir al inicio</a>
    </div>
  ),
});

/** Devuelve siempre una lista, venga lo que venga del servidor. */
function comoLista<T>(valor: unknown): T[] {
  if (Array.isArray(valor)) return valor as T[];
  if (valor && typeof valor === "object") return Object.values(valor as Record<string, T>);
  return [];
}

const ICONO_TIPO: Record<TipoAviso, React.ComponentType<{ className?: string }>> = {
  tarea_atencion: Bell,
  aprobacion: ShieldCheck,
  compilacion: Package,
  dominio: Globe,
  presupuesto: Coins,
  salud: HeartPulse,
  copias: DatabaseBackup,
  ejecucion: Zap,
  prueba: BellRing,
  otro: Bell,
};

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("panel min-w-0 max-w-full overflow-hidden p-5", className)}>{children}</section>;
}

function PantallaAvisos() {
  const estado = useEstadoAvisos();
  const { data: avisosCrudos, isPending } = useAvisos();
  const avisos = comoLista<AvisoRow>(avisosCrudos);
  useRealtimeAvisos();

  const sinLeer = avisos.filter((a) => !a.leido).length;

  return (
    <AppShell>
      <Encabezado
        titulo="Avisos"
        descripcion="Instala NexDeveloper en el móvil y recibe un aviso cuando algo necesite tu atención."
        acciones={
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
            <Bell className="size-4" /> {sinLeer} sin leer
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <BandejaAvisos avisos={avisos} cargando={isPending} />
        </div>
        <div className="space-y-5">
          <TarjetaDispositivo clavePublica={estado.data?.clave_publica ?? null} />
          <ListaDispositivos />
          <PanelConfiguracion />
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------------------- Este dispositivo ---------------------------- */

function TarjetaDispositivo({ clavePublica }: { clavePublica: string | null }) {
  const suscribir = useSuscribirDispositivo();
  const probar = useProbarAviso();
  const [permiso, setPermiso] = React.useState<NotificationPermission | "sin-soporte">("default");
  const [nombre, setNombre] = React.useState("Dispositivo");
  const [instalable, setInstalable] = React.useState<Event | null>(null);
  const [ios, setIos] = React.useState(false);
  const [instalada, setInstalada] = React.useState(false);

  React.useEffect(() => {
    setIos(esIos());
    setInstalada(enPantallaInicio());
    setNombre(nombreDispositivo());
    setPermiso(soportaAvisos() ? Notification.permission : "sin-soporte");

    const alInstalar = (evento: Event) => {
      evento.preventDefault();
      setInstalable(evento);
    };
    window.addEventListener("beforeinstallprompt", alInstalar);
    return () => window.removeEventListener("beforeinstallprompt", alInstalar);
  }, []);

  const activar = async () => {
    if (!soportaAvisos()) {
      toast.error("Este navegador no admite avisos.");
      return;
    }
    if (!clavePublica) {
      toast.error("El servicio de avisos aún no está configurado.");
      return;
    }
    const resultado = await Notification.requestPermission();
    setPermiso(resultado);
    if (resultado !== "granted") {
      toast.error("No has dado permiso para recibir avisos.");
      return;
    }
    const registro = (await navigator.serviceWorker.getRegistration("/")) ?? (await registrarTrabajador());
    if (!registro) {
      toast.error("No se ha podido preparar este dispositivo.");
      return;
    }
    await navigator.serviceWorker.ready;
    const suscripcion =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveVapidABytes(clavePublica),
      }));
    suscribir.mutate({
      suscripcion: suscripcion.toJSON(),
      dispositivo: nombre,
      agente: typeof navigator === "undefined" ? "" : navigator.userAgent,
    });
  };

  const instalar = async () => {
    const evento = instalable as (Event & { prompt?: () => Promise<void> }) | null;
    if (!evento?.prompt) return;
    await evento.prompt();
    setInstalable(null);
  };

  const textoPermiso =
    permiso === "granted"
      ? "Permiso concedido"
      : permiso === "denied"
        ? "Permiso denegado en este navegador"
        : permiso === "sin-soporte"
          ? "Este navegador no admite avisos"
          : "Permiso sin conceder";

  return (
    <Panel>
      <div className="flex items-center gap-2">
        <Smartphone className="size-4 text-primary" />
        <h2 className="font-display text-base font-semibold">Este dispositivo</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{textoPermiso}</p>

      <div className="mt-4 space-y-3">
        <Campo etiqueta="Nombre del dispositivo" pista="Así lo verás en la lista de dispositivos.">
          <input className={claseCampo} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>

        <Boton className="w-full py-3" onClick={() => void activar()} disabled={suscribir.isPending}>
          <BellRing className="size-4" /> Activar avisos en este dispositivo
        </Boton>
        <Boton variante="suave" className="w-full py-3" onClick={() => probar.mutate()} disabled={probar.isPending}>
          Enviar aviso de prueba
        </Boton>
        {instalable ? (
          <Boton variante="suave" className="w-full py-3" onClick={() => void instalar()}>
            Instalar aplicación
          </Boton>
        ) : null}
      </div>

      {ios && !instalada ? (
        <p className="mt-4 flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          <Share className="mt-0.5 size-4 shrink-0" />
          En iPhone y iPad los avisos solo funcionan si añades NexDeveloper a la pantalla de inicio (Compartir → Añadir a
          pantalla de inicio) y la abres desde ahí.
        </p>
      ) : null}
    </Panel>
  );
}

function ListaDispositivos() {
  const estado = useEstadoAvisos();
  const quitar = useQuitarDispositivo();
  const dispositivos = comoLista<{ id: string; dispositivo?: string | null; ultimo_envio?: string | null; ultimo_error?: string | null }>(
    estado.data?.dispositivos,
  );

  return (
    <Panel>
      <h2 className="font-display text-base font-semibold">Dispositivos</h2>
      {dispositivos.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Todavía no hay ningún dispositivo con los avisos activados.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {dispositivos.map((d) => (
            <li key={d.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.dispositivo || "Dispositivo"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {d.ultimo_envio ? `Último aviso ${desde(d.ultimo_envio)}` : "Sin avisos enviados todavía"}
                  </p>
                  {d.ultimo_error ? <p className="mt-0.5 text-xs text-destructive">{d.ultimo_error}</p> : null}
                </div>
                <button
                  type="button"
                  aria-label="Quitar dispositivo"
                  onClick={() => quitar.mutate({ id: d.id })}
                  className="rounded-md border border-border p-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------ Configuración ------------------------------ */

function PanelConfiguracion() {
  const estado = useEstadoAvisos();
  const guardar = useGuardarConfigAvisos();
  const config = estado.data?.config ?? null;
  const tiposCrudos = config?.tipos;
  const tipos = (tiposCrudos && typeof tiposCrudos === "object" && !Array.isArray(tiposCrudos)
    ? tiposCrudos
    : {}) as Record<string, boolean>;

  const cambiarTipo = (tipo: TipoAviso, valor: boolean) =>
    guardar.mutate({ tipos: { ...tipos, [tipo]: valor } });

  return (
    <Panel>
      <h2 className="font-display text-base font-semibold">Qué avisos quiero recibir</h2>

      <label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
        <span>Recibir avisos</span>
        <input
          type="checkbox"
          className="size-5 accent-[var(--primary)]"
          checked={config?.activo ?? true}
          onChange={(e) => guardar.mutate({ activo: e.target.checked })}
        />
      </label>

      <ul className="mt-3 space-y-1.5">
        {TIPOS_AVISO_CONFIGURABLES.map((tipo) => (
          <li key={tipo}>
            <label className="flex items-center justify-between gap-3 rounded-lg px-1 py-2 text-sm">
              <span className="text-muted-foreground">{ETIQUETA_TIPO_AVISO[tipo]}</span>
              <input
                type="checkbox"
                className="size-5 accent-[var(--primary)]"
                checked={tipos[tipo] ?? true}
                onChange={(e) => cambiarTipo(tipo, e.target.checked)}
              />
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Campo etiqueta="Silencio desde">
          <input
            type="time"
            className={claseCampo}
            value={aHoraTexto(config?.silencio_desde)}
            onChange={(e) => guardar.mutate({ silencio_desde: deHoraTexto(e.target.value) })}
          />
        </Campo>
        <Campo etiqueta="Silencio hasta">
          <input
            type="time"
            className={claseCampo}
            value={aHoraTexto(config?.silencio_hasta)}
            onChange={(e) => guardar.mutate({ silencio_hasta: deHoraTexto(e.target.value) })}
          />
        </Campo>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Durante esas horas no se envía ningún aviso al móvil.</p>
    </Panel>
  );
}

/* --------------------------------- Bandeja --------------------------------- */

function BandejaAvisos({ avisos, cargando }: { avisos: AvisoRow[]; cargando: boolean }) {
  const navegar = useNavigate();
  const marcar = useMarcarLeidos();
  const { data: proyectosCrudos } = useProyectos();
  const proyectos = comoLista<{ id: string; nombre: string }>(proyectosCrudos);
  const [tipo, setTipo] = React.useState<"todos" | TipoAviso>("todos");
  const [soloNoLeidos, setSoloNoLeidos] = React.useState(false);

  const visibles = comoLista<AvisoRow>(avisos).filter(
    (a) => (tipo === "todos" || a.tipo === tipo) && (!soloNoLeidos || !a.leido),
  );

  const abrir = (aviso: AvisoRow) => {
    if (!aviso.leido) marcar.mutate({ id: aviso.id });
    const destino = normalizarDestinoInterno(aviso.url);
    if (destino) void navegar({ href: destino });
  };

  const estadoEnvio = (aviso: AvisoRow) =>
    aviso.enviado
      ? `Enviado a ${aviso.enviados} dispositivo${aviso.enviados === 1 ? "" : "s"}`
      : aviso.resultado
        ? aviso.resultado
        : "Sin dispositivos";

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold">Bandeja de avisos</h2>
        <Boton variante="suave" onClick={() => marcar.mutate(undefined)} disabled={marcar.isPending}>
          <Check className="size-4" /> Marcar todos como leídos
        </Boton>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          className="min-w-0 max-w-full rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as "todos" | TipoAviso)}
        >
          <option value="todos">Todos los tipos</option>
          {Object.entries(ETIQUETA_TIPO_AVISO).map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={soloNoLeidos}
            onChange={(e) => setSoloNoLeidos(e.target.checked)}
          />
          Solo sin leer
        </label>
      </div>

      {cargando ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No hay avisos que mostrar.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {visibles.map((aviso) => {
            const Icono = ICONO_TIPO[aviso.tipo] ?? Bell;
            const proyecto = proyectos.find((p) => p.id === aviso.proyecto_id);
            return (
              <li key={aviso.id}>
                <button
                  type="button"
                  onClick={() => abrir(aviso)}
                  className={cn(
                    "flex w-full min-w-0 gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/40",
                    aviso.leido ? "border-border bg-surface" : "border-primary/40 bg-primary/5",
                  )}
                >
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                    <Icono className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 break-words">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{aviso.titulo}</span>
                      {!aviso.leido ? <span className="size-2 rounded-full bg-primary" /> : null}
                    </span>
                    {aviso.cuerpo ? (
                      <span className="mt-0.5 block text-sm text-muted-foreground">{aviso.cuerpo}</span>
                    ) : null}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {ETIQUETA_TIPO_AVISO[aviso.tipo]}
                      {proyecto ? ` · ${proyecto.nombre}` : ""} · {desde(aviso.creado_el)} · {estadoEnvio(aviso)}
                    </span>
                    <span className="sr-only">{formatoFechaHora(aviso.creado_el)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
