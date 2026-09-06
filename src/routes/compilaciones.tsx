import { createFileRoute, useSearch } from "@tanstack/react-router";
import {
  Apple,
  Boxes,
  Download,
  ExternalLink,
  Globe,
  Lock,
  LockOpen,
  Monitor,
  Package,
  RefreshCw,
  Search,
  Smartphone,
  XCircle,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type {
  CompilacionRow,
  EstadoCompilacion,
  PlantillaCompilacionRow,
  PlataformaCompilacion,
} from "@/lib/nex/db-types";
import { formatoFechaHora } from "@/lib/nex/labels";
import { tamanoLegible } from "@/lib/nex/queries/copias";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  aBase64,
  duracionLegible,
  siguienteVersion,
  useCancelarCompilacion,
  useCompilaciones,
  useDescargarCompilacion,
  useDetectar,
  useFirmasCompilacion,
  useGuardarSecretosFirma,
  useLanzarCompilacion,
  usePlantillasCompilacion,
  useRealtimeCompilaciones,
  useSincronizarCompilaciones,
  versionValida,
  type Deteccion,
} from "@/lib/nex/queries/compilaciones";

type BusquedaCompilaciones = { proyecto?: string };

export const Route = createFileRoute("/compilaciones")({
  validateSearch: (busqueda: Record<string, unknown>): BusquedaCompilaciones =>
    typeof busqueda["proyecto"] === "string" ? { proyecto: busqueda["proyecto"] } : {},
  head: () => ({
    meta: [
      { title: "Compilaciones · NexDeveloper" },
      {
        name: "description",
        content: "Genera las aplicaciones de Android, iPhone, escritorio y web de cada proyecto sin salir de aquí.",
      },
      { property: "og:title", content: "Compilaciones · NexDeveloper" },
      {
        property: "og:description",
        content: "Genera las aplicaciones de Android, iPhone, escritorio y web de cada proyecto sin salir de aquí.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaCompilaciones,
});

const ETIQUETA_ESTADO: Record<EstadoCompilacion, string> = {
  pendiente: "Pendiente",
  enviada: "Enviada",
  en_curso: "En curso",
  ok: "Correcta",
  error: "Error",
  cancelada: "Cancelada",
};

const TONO_ESTADO: Record<EstadoCompilacion, string> = {
  pendiente: "border-border bg-muted text-muted-foreground",
  enviada: "border-primary/40 bg-primary/10 text-primary",
  en_curso: "border-primary/40 bg-primary/10 text-primary",
  ok: "border-success/40 bg-success/10 text-success",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  cancelada: "border-border bg-muted text-muted-foreground",
};

export const ETIQUETA_PLATAFORMA: Record<PlataformaCompilacion, string> = {
  android: "Android",
  ios: "iPhone y iPad",
  escritorio: "Escritorio",
  web: "Web",
};

const ICONO_PLATAFORMA: Record<PlataformaCompilacion, typeof Smartphone> = {
  android: Smartphone,
  ios: Apple,
  escritorio: Monitor,
  web: Globe,
};

const SECRETOS_ANDROID = [
  { clave: "ANDROID_KEYSTORE_BASE64", etiqueta: "Almacén de claves (.keystore o .jks)", archivo: true },
  { clave: "ANDROID_KEYSTORE_PASSWORD", etiqueta: "Contraseña del almacén", archivo: false },
  { clave: "ANDROID_KEY_ALIAS", etiqueta: "Alias de la clave", archivo: false },
  { clave: "ANDROID_KEY_PASSWORD", etiqueta: "Contraseña de la clave", archivo: false },
] as const;

const SECRETOS_IOS = [
  { clave: "APPLE_CERT_P12_BASE64", etiqueta: "Certificado (.p12)", archivo: true },
  { clave: "APPLE_CERT_PASSWORD", etiqueta: "Contraseña del certificado", archivo: false },
  { clave: "APPLE_PROVISION_PROFILE_BASE64", etiqueta: "Perfil (.mobileprovision)", archivo: true },
  { clave: "APPLE_TEAM_ID", etiqueta: "Identificador de equipo (Team ID)", archivo: false },
] as const;

function Insignia({ estado }: { estado: EstadoCompilacion }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${TONO_ESTADO[estado]}`}>
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}

function Chip({ children, tono = "neutro" }: { children: React.ReactNode; tono?: "neutro" | "verde" | "rojo" | "ambar" }) {
  const tonos = {
    neutro: "border-border bg-surface text-muted-foreground",
    verde: "border-success/40 bg-success/10 text-success",
    rojo: "border-destructive/40 bg-destructive/10 text-destructive",
    ambar: "border-warning/40 bg-warning/10 text-warning",
  } as const;
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${tonos[tono]}`}>{children}</span>;
}

function Transcurrido({ desde }: { desde: string | null }) {
  const [ahora, setAhora] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!desde) return <>—</>;
  const segundos = Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / 1000));
  return <>{duracionLegible(segundos)}</>;
}

function PantallaCompilaciones() {
  const busqueda = useSearch({ from: "/compilaciones" });
  const { data: proyectos = [] } = useProyectos();
  const { data: plantillas = [] } = usePlantillasCompilacion();
  const { data: compilaciones = [] } = useCompilaciones();
  const { data: firmas = [] } = useFirmasCompilacion();

  const detectar = useDetectar();
  const lanzar = useLanzarCompilacion();
  const sincronizar = useSincronizarCompilaciones();
  const cancelar = useCancelarCompilacion();
  const descargar = useDescargarCompilacion();
  const guardarSecretos = useGuardarSecretosFirma();

  const [proyectoId, setProyectoId] = React.useState(busqueda.proyecto ?? "");
  const [deteccion, setDeteccion] = React.useState<Deteccion | null>(null);
  const [plantillaId, setPlantillaId] = React.useState("");
  const [version, setVersion] = React.useState("");
  const [rama, setRama] = React.useState("main");
  const [notas, setNotas] = React.useState("");
  const [verOtras, setVerOtras] = React.useState(false);
  const [conflicto, setConflicto] = React.useState<{ mensaje: string; propuesta: string } | null>(null);
  const [errorVisible, setErrorVisible] = React.useState<CompilacionRow | null>(null);

  const [filtroProyecto, setFiltroProyecto] = React.useState("");
  const [filtroPlataforma, setFiltroPlataforma] = React.useState("");
  const [filtroEstado, setFiltroEstado] = React.useState("");

  const proyecto = proyectos.find((p) => p.id === proyectoId) ?? null;

  const conRepositorio = React.useCallback(
    (id: string) => Boolean(proyectos.find((p) => p.id === id)?.repositorio),
    [proyectos],
  );

  useRealtimeCompilaciones((fila) => {
    if (fila.estado === "ok") {
      toast.success(`Compilación ${ETIQUETA_PLATAFORMA[fila.plataforma]} v${fila.version} lista`, {
        action: { label: "Descargar", onClick: () => void pedirDescarga(fila.id) },
      });
    }
  });

  const enCurso = compilaciones.filter((c) => c.estado === "enviada" || c.estado === "en_curso");

  React.useEffect(() => {
    if (enCurso.length === 0) return;
    const id = window.setInterval(() => sincronizar.mutate(), 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enCurso.length]);

  const pedirDescarga = async (compilacionId: string) => {
    try {
      const respuesta = await descargar.mutateAsync(compilacionId);
      if (respuesta.origen === "github") toast.info("El enlace de GitHub caduca en un minuto.");
      window.open(respuesta.url, "_blank", "noopener");
    } catch (err) {
      toast.error(String((err as Error)?.message ?? err));
    }
  };

  const ejecutarDeteccion = async () => {
    if (!proyectoId) return;
    try {
      const respuesta = await detectar.mutateAsync({ proyectoId, rama });
      setDeteccion(respuesta);
      if (respuesta.version_package) setVersion(siguienteVersion(respuesta.version_package));
      if (respuesta.rama) setRama(respuesta.rama);
      const sugerida = respuesta.plantillas_sugeridas?.[0];
      if (sugerida) setPlantillaId(sugerida);
    } catch (err) {
      setDeteccion(null);
      toast.error(String((err as Error)?.message ?? err));
    }
  };

  const sugeridas = deteccion?.plantillas_sugeridas ?? [];
  const plantillasSugeridas = plantillas.filter((p) => sugeridas.includes(p.id));
  const plantillasOtras = plantillas.filter((p) => !sugeridas.includes(p.id));
  const plantilla = plantillas.find((p) => p.id === plantillaId) ?? null;

  const compilar = async (forzar = false) => {
    if (!proyectoId || !plantilla) return;
    if (!versionValida(version)) {
      toast.error("La versión debe tener el formato 1.2.3.");
      return;
    }
    try {
      const respuesta = await lanzar.mutateAsync({
        proyectoId,
        plantillaId: plantilla.id,
        version: version.trim(),
        rama: rama.trim() || "main",
        notas: notas.trim(),
        forzar,
      });
      setConflicto(null);
      setNotas("");
      toast.success(
        `Compilación enviada${respuesta.minutos_estimados ? `; unos ${respuesta.minutos_estimados} minutos` : ""}.`,
      );
    } catch (err) {
      const fallo = err as { estado?: number; message?: string };
      if (fallo.estado === 409) {
        setConflicto({ mensaje: fallo.message ?? "Esa versión ya está compilada.", propuesta: siguienteVersion(version) });
      } else {
        toast.error(String(fallo.message ?? err));
      }
    }
  };

  const repetir = (fila: CompilacionRow) => {
    setProyectoId(fila.proyecto_id);
    setPlantillaId(fila.plantilla_id);
    setRama(fila.rama);
    setVersion(siguienteVersion(fila.version));
    setNotas(fila.notas ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const historial = compilaciones.filter(
    (c) =>
      (!filtroProyecto || c.proyecto_id === filtroProyecto) &&
      (!filtroPlataforma || c.plataforma === filtroPlataforma) &&
      (!filtroEstado || c.estado === filtroEstado),
  );

  const nombreProyecto = (id: string) => proyectos.find((p) => p.id === id)?.nombre ?? "Proyecto";

  return (
    <>
      <Encabezado
        titulo="Compilaciones"
        descripcion="Genera la aplicación de cada proyecto para Android, iPhone, escritorio o web y descarga el resultado."
        acciones={
          <Boton variante="suave" onClick={() => sincronizar.mutate()} disabled={sincronizar.isPending}>
            <RefreshCw className="size-4" /> Actualizar ahora
          </Boton>
        }
      />

      <section className="panel mb-5 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <Campo etiqueta="Proyecto">
            <select
              value={proyectoId}
              onChange={(e) => {
                setProyectoId(e.target.value);
                setDeteccion(null);
                setPlantillaId("");
              }}
              className={claseCampo}
            >
              <option value="">Elige un proyecto…</option>
              {proyectos.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  disabled={!p.repositorio}
                  title={p.repositorio ? undefined : "Sin repositorio: créalo en Repositorios"}
                >
                  {p.nombre}
                  {p.repositorio ? "" : " (sin repositorio)"}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Rama">
            <input value={rama} onChange={(e) => setRama(e.target.value)} className={claseCampo} />
          </Campo>
          <Boton onClick={() => void ejecutarDeteccion()} disabled={!proyectoId || detectar.isPending}>
            <Search className="size-4" /> Detectar
          </Boton>
        </div>

        {proyectoId && !conRepositorio(proyectoId) ? (
          <p className="mt-3 text-sm text-warning">Este proyecto no tiene repositorio: créalo primero en Repositorios.</p>
        ) : null}

        {deteccion ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Herramientas encontradas</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(deteccion.herramientas ?? []).length === 0 ? (
                  <span className="text-sm text-muted-foreground">Ninguna</span>
                ) : (
                  deteccion.herramientas?.map((h) => <Chip key={h}>{h}</Chip>)
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Carpetas de móvil</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip tono={deteccion.tiene_android ? "verde" : "neutro"}>
                  android {deteccion.tiene_android ? "sí" : "no"}
                </Chip>
                <Chip tono={deteccion.tiene_ios ? "verde" : "neutro"}>ios {deteccion.tiene_ios ? "sí" : "no"}</Chip>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Versión del proyecto: <strong>{deteccion.version_package ?? "sin detectar"}</strong>
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Talleres ya presentes</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(deteccion.talleres_presentes ?? []).length === 0 ? (
                  <span className="text-sm text-muted-foreground">Ninguno</span>
                ) : (
                  deteccion.talleres_presentes?.map((t) => <Chip key={t}>{t}</Chip>)
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Firma por plataforma</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["android", "ios"] as PlataformaCompilacion[]).map((plataforma) => {
                  const necesarios = plataforma === "android" ? SECRETOS_ANDROID : SECRETOS_IOS;
                  const presentes = deteccion.secretos_presentes ?? [];
                  const lista = necesarios.every((s) => presentes.includes(s.clave));
                  return (
                    <Chip key={plataforma} tono={lista ? "verde" : "ambar"}>
                      {ETIQUETA_PLATAFORMA[plataforma]}: {lista ? "Firma lista" : "Sin firma: se genera versión de pruebas"}
                    </Chip>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel mb-5 p-5">
        <h2 className="font-display text-base font-semibold">Compilar ahora</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada compilación sube el número de versión. Elige una plantilla y comprueba los datos.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(plantillasSugeridas.length > 0 ? plantillasSugeridas : plantillas.slice(0, 3)).map((p) => (
            <TarjetaPlantilla
              key={p.id}
              plantilla={p}
              elegida={plantillaId === p.id}
              destacada
              onElegir={() => setPlantillaId(p.id)}
            />
          ))}
        </div>

        {plantillasOtras.length > 0 && plantillasSugeridas.length > 0 ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setVerOtras((v) => !v)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {verOtras ? "Ocultar otras plantillas" : `Otras plantillas (${plantillasOtras.length})`}
            </button>
            {verOtras ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {plantillasOtras.map((p) => (
                  <TarjetaPlantilla
                    key={p.id}
                    plantilla={p}
                    elegida={plantillaId === p.id}
                    onElegir={() => setPlantillaId(p.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {plantilla ? (
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Campo etiqueta="Versión" pista="Formato 1.2.3">
              <input value={version} onChange={(e) => setVersion(e.target.value)} className={claseCampo} placeholder="1.2.3" />
            </Campo>
            <Campo etiqueta="Rama">
              <input value={rama} onChange={(e) => setRama(e.target.value)} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Notas (opcional)">
              <input value={notas} onChange={(e) => setNotas(e.target.value)} className={claseCampo} />
            </Campo>
            <div className="flex items-end">
              <Boton onClick={() => void compilar(false)} disabled={!proyectoId || lanzar.isPending}>
                <Package className="size-4" /> Compilar
              </Boton>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel mb-5 p-5">
        <h2 className="font-display text-base font-semibold">En curso</h2>
        {enCurso.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No hay ninguna compilación en marcha.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {enCurso.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <strong>{nombreProyecto(c.proyecto_id)}</strong> · {ETIQUETA_PLATAFORMA[c.plataforma]} · v{c.version}
                  </div>
                  <div className="flex items-center gap-2">
                    {c.url_run ? (
                      <a
                        href={c.url_run}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Ver en GitHub <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                    <Boton variante="suave" onClick={() => cancelar.mutate(c.id)} disabled={cancelar.isPending}>
                      <XCircle className="size-4" /> Cancelar
                    </Boton>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enviada {formatoFechaHora(c.enviada_el ?? c.creado_el)} · lleva{" "}
                  <Transcurrido desde={c.enviada_el ?? c.creado_el} />
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold">Historial</h2>
          <div className="flex flex-wrap gap-2">
            <select value={filtroProyecto} onChange={(e) => setFiltroProyecto(e.target.value)} className={claseCampo}>
              <option value="">Todos los proyectos</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <select value={filtroPlataforma} onChange={(e) => setFiltroPlataforma(e.target.value)} className={claseCampo}>
              <option value="">Todas las plataformas</option>
              {Object.entries(ETIQUETA_PLATAFORMA).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className={claseCampo}>
              <option value="">Todos los estados</option>
              {Object.entries(ETIQUETA_ESTADO).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Proyecto</th>
                <th className="px-3 py-2">Plataforma</th>
                <th className="px-3 py-2">Herramienta</th>
                <th className="px-3 py-2">Versión</th>
                <th className="px-3 py-2">Firmada</th>
                <th className="px-3 py-2">Duración</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Archivo</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {historial.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                    Todavía no hay compilaciones con estos filtros.
                  </td>
                </tr>
              ) : (
                historial.map((c) => {
                  const Icono = ICONO_PLATAFORMA[c.plataforma];
                  return (
                    <tr key={c.id} className="border-t border-border align-top">
                      <td className="px-3 py-3 text-xs text-muted-foreground">{formatoFechaHora(c.creado_el)}</td>
                      <td className="px-3 py-3">{nombreProyecto(c.proyecto_id)}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Icono className="size-4 text-muted-foreground" /> {ETIQUETA_PLATAFORMA[c.plataforma]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{c.herramienta}</td>
                      <td className="px-3 py-3">v{c.version}</td>
                      <td className="px-3 py-3">
                        {c.firmada ? (
                          <Lock className="size-4 text-success" aria-label="Firmada" />
                        ) : (
                          <LockOpen className="size-4 text-warning" aria-label="Sin firmar" />
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{duracionLegible(c.duracion_seg)}</td>
                      <td className="px-3 py-3">
                        <Insignia estado={c.estado} />
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {c.artefacto_nombre ? (
                          <>
                            {c.artefacto_nombre}
                            <br />
                            {tamanoLegible(c.artefacto_bytes)}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {c.estado === "ok" ? (
                            <Boton variante="suave" onClick={() => void pedirDescarga(c.id)} disabled={descargar.isPending}>
                              <Download className="size-4" /> Descargar
                            </Boton>
                          ) : null}
                          {c.url_run ? (
                            <a
                              href={c.url_run}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-primary/40"
                            >
                              Ver taller <ExternalLink className="size-3" />
                            </a>
                          ) : null}
                          {c.estado === "error" ? (
                            <Boton variante="suave" onClick={() => setErrorVisible(c)}>
                              Ver error
                            </Boton>
                          ) : null}
                          <Boton variante="suave" onClick={() => repetir(c)}>
                            Repetir
                          </Boton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <BloqueFirma
        proyectoId={proyectoId}
        proyectoNombre={proyecto?.nombre ?? null}
        firmas={firmas.filter((f) => f.proyecto_id === proyectoId)}
        guardando={guardarSecretos.isPending}
        onGuardar={async (plataforma, secretos) => {
          try {
            const respuesta = await guardarSecretos.mutateAsync({ proyectoId, plataforma, secretos });
            toast.success(`Guardados en GitHub: ${respuesta.puestos.join(", ") || "sin cambios"}.`);
          } catch (err) {
            toast.error(String((err as Error)?.message ?? err));
          }
        }}
      />

      <Dialogo
        abierto={Boolean(conflicto)}
        titulo="Esa versión ya está compilada"
        {...(conflicto?.mensaje ? { descripcion: conflicto.mensaje } : {})}
        onCerrar={() => setConflicto(null)}
        ancho="max-w-lg"
      >
        <p className="text-sm text-muted-foreground">
          ¿Quieres subir a la versión <strong>{conflicto?.propuesta}</strong>?
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Boton
            onClick={() => {
              if (!conflicto) return;
              setVersion(conflicto.propuesta);
              setConflicto(null);
              window.setTimeout(() => void compilar(false), 0);
            }}
          >
            Subir a {conflicto?.propuesta}
          </Boton>
          <Boton variante="suave" onClick={() => void compilar(true)}>
            Repetir igualmente
          </Boton>
        </div>
      </Dialogo>

      <Dialogo
        abierto={Boolean(errorVisible)}
        titulo="Detalle del error"
        onCerrar={() => setErrorVisible(null)}
        ancho="max-w-2xl"
      >
        <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-surface p-3 text-xs whitespace-pre-wrap">
          {errorVisible?.error ?? "Sin texto de error."}
          {errorVisible?.log_resumen ? `\n\n${errorVisible.log_resumen}` : ""}
        </pre>
      </Dialogo>
    </>
  );
}

function TarjetaPlantilla({
  plantilla,
  elegida,
  destacada,
  onElegir,
}: {
  plantilla: PlantillaCompilacionRow;
  elegida: boolean;
  destacada?: boolean;
  onElegir: () => void;
}) {
  const Icono = ICONO_PLATAFORMA[plantilla.plataforma] ?? Boxes;
  return (
    <button
      type="button"
      onClick={onElegir}
      className={`rounded-xl border p-4 text-left transition ${
        elegida ? "border-primary bg-primary/5" : destacada ? "border-primary/30 bg-surface" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icono className="size-4 text-primary" />
        <span className="font-medium">{plantilla.nombre}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{plantilla.descripcion}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip>{ETIQUETA_PLATAFORMA[plantilla.plataforma]}</Chip>
        {plantilla.minutos_estimados ? <Chip>~{plantilla.minutos_estimados} min</Chip> : null}
      </div>
      {plantilla.secretos_firma.length > 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Firma: {plantilla.secretos_firma.join(", ")}</p>
      ) : null}
    </button>
  );
}

function BloqueFirma({
  proyectoId,
  proyectoNombre,
  firmas,
  guardando,
  onGuardar,
}: {
  proyectoId: string;
  proyectoNombre: string | null;
  firmas: { plataforma: PlataformaCompilacion; secretos_puestos: string[] }[];
  guardando: boolean;
  onGuardar: (plataforma: PlataformaCompilacion, secretos: Record<string, string>) => void | Promise<void>;
}) {
  const [abierto, setAbierto] = React.useState(false);
  const [ayuda, setAyuda] = React.useState(false);
  const [valores, setValores] = React.useState<Record<string, string>>({});

  const puestos = (plataforma: PlataformaCompilacion) =>
    firmas.find((f) => f.plataforma === plataforma)?.secretos_puestos ?? [];

  const cargarArchivo = async (clave: string, archivo: File | undefined) => {
    if (!archivo) return;
    const base64 = await aBase64(archivo);
    setValores((v) => ({ ...v, [clave]: base64 }));
    toast.success(`${archivo.name} preparado.`);
  };

  const guardar = (plataforma: PlataformaCompilacion) => {
    const definicion = plataforma === "android" ? SECRETOS_ANDROID : SECRETOS_IOS;
    const secretos: Record<string, string> = {};
    for (const s of definicion) {
      const valor = valores[s.clave];
      if (valor) secretos[s.clave] = valor;
    }
    if (Object.keys(secretos).length === 0) {
      toast.error("Rellena al menos un dato de firma.");
      return;
    }
    void onGuardar(plataforma, secretos);
  };

  return (
    <section className="panel mb-5 p-5">
      <button type="button" onClick={() => setAbierto((v) => !v)} className="flex w-full items-center justify-between gap-2">
        <span className="font-display text-base font-semibold">Firma</span>
        <span className="text-sm text-muted-foreground">{abierto ? "Ocultar" : "Mostrar"}</span>
      </button>

      {abierto ? (
        !proyectoId ? (
          <p className="mt-3 text-sm text-muted-foreground">Elige antes un proyecto arriba.</p>
        ) : (
          <div className="mt-4 space-y-6">
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              Los secretos se guardan cifrados en tu repositorio de GitHub; NexDeveloper nunca los almacena.
            </p>
            <p className="text-xs text-muted-foreground">Proyecto: {proyectoNombre}</p>

            {(["android", "ios"] as PlataformaCompilacion[]).map((plataforma) => {
              const definicion = plataforma === "android" ? SECRETOS_ANDROID : SECRETOS_IOS;
              const yaPuestos = puestos(plataforma);
              return (
                <div key={plataforma} className="rounded-lg border border-border p-4">
                  <h3 className="font-medium">{ETIQUETA_PLATAFORMA[plataforma]}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {definicion.map((s) => (
                      <Chip key={s.clave} tono={yaPuestos.includes(s.clave) ? "verde" : "rojo"}>
                        {s.clave}
                      </Chip>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {definicion.map((s) => (
                      <Campo key={s.clave} etiqueta={s.etiqueta}>
                        {s.archivo ? (
                          <input
                            type="file"
                            className={claseCampo}
                            onChange={(e) => void cargarArchivo(s.clave, e.target.files?.[0])}
                          />
                        ) : (
                          <input
                            type={s.clave.includes("PASSWORD") ? "password" : "text"}
                            className={claseCampo}
                            value={valores[s.clave] ?? ""}
                            onChange={(e) => setValores((v) => ({ ...v, [s.clave]: e.target.value }))}
                          />
                        )}
                      </Campo>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Boton onClick={() => guardar(plataforma)} disabled={guardando}>
                      Guardar en GitHub
                    </Boton>
                  </div>
                </div>
              );
            })}

            <div>
              <button
                type="button"
                onClick={() => setAyuda((v) => !v)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {ayuda ? "Ocultar ayuda" : "Cómo obtener el almacén de claves o el certificado"}
              </button>
              {ayuda ? (
                <div className="mt-2 space-y-2 rounded-lg border border-border p-3 text-sm text-muted-foreground">
                  <p>
                    <strong>Android:</strong> en tu ordenador, con Java instalado, ejecuta{" "}
                    <code>keytool -genkey -v -keystore mi-app.keystore -alias mi-app -keyalg RSA -validity 10000</code>.
                    Te pedirá una contraseña: esa es la del almacén y la de la clave. Guarda el archivo en lugar seguro y
                    súbelo aquí.
                  </p>
                  <p>
                    <strong>iPhone y iPad:</strong> en la web de cuentas de desarrollador de Apple crea un certificado de
                    distribución, descárgalo, ábrelo en Acceso a Llaveros y expórtalo como .p12 con contraseña. Crea también
                    un perfil de aprovisionamiento (.mobileprovision) para tu identificador de aplicación. El Team ID
                    aparece arriba a la derecha en la cuenta de Apple.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )
      ) : null}
    </section>
  );
}
