import { createFileRoute } from "@tanstack/react-router";
import { Download, HardDriveDownload, RefreshCw, ShieldCheck } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import type { CopiaOrigenRow, CopiaRow, EstadoCopia, TipoOrigenCopia } from "@/lib/nex/db-types";
import { formatoFechaHora } from "@/lib/nex/labels";
import { PanelPruebas, PanelRestaurar } from "@/components/nex/restaurar";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  diasDesdeUltimaCorrecta,
  tamanoLegible,
  useConfigCopias,
  useDestinosCopias,
  useFirmarDescarga,
  useGuardarConfig,
  useGuardarDestino,
  useHistoricoCopias,
  useImportarProyectos,
  useLanzarCopias,
  useLoteCopias,
  useOrigenesCopias,
  useProbarDestino,
  useRefrescarOrigenes,
} from "@/lib/nex/queries/copias";

type Pestana = "copias" | "restaurar" | "pruebas";

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: "copias", etiqueta: "Copias" },
  { id: "restaurar", etiqueta: "Restaurar" },
  { id: "pruebas", etiqueta: "Pruebas" },
];

export const Route = createFileRoute("/copias")({
  validateSearch: (busqueda: Record<string, unknown>): { tab?: Pestana; copia?: string } => ({
    ...(busqueda["tab"] === "restaurar" || busqueda["tab"] === "pruebas" || busqueda["tab"] === "copias"
      ? { tab: busqueda["tab"] as Pestana }
      : {}),
    ...(typeof busqueda["copia"] === "string" ? { copia: busqueda["copia"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Copias de seguridad · NexDeveloper" },
      {
        name: "description",
        content: "Guarda copias de tus bases de datos y repositorios en tu propio almacén, a mano o de forma automática.",
      },
      { property: "og:title", content: "Copias de seguridad · NexDeveloper" },
      {
        property: "og:description",
        content: "Guarda copias de tus bases de datos y repositorios en tu propio almacén, a mano o de forma automática.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaCopias,
});

const ETIQUETA_ESTADO: Record<EstadoCopia, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  ok: "Correcta",
  error: "Error",
};

const TONO_ESTADO: Record<EstadoCopia, string> = {
  pendiente: "border-border bg-muted text-muted-foreground",
  en_curso: "border-primary/40 bg-primary/10 text-primary",
  ok: "border-success/40 bg-success/10 text-success",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

const ETIQUETA_TIPO: Record<TipoOrigenCopia, string> = {
  base_datos: "Base de datos",
  repositorio: "Repositorio",
};

const ETIQUETA_ORIGEN: Record<string, string> = {
  manual: "A mano",
  diaria: "Diaria",
  semanal: "Semanal",
};

function Insignia({ estado }: { estado: EstadoCopia }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${TONO_ESTADO[estado]}`}>
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}

function PantallaCopias() {
  const busqueda = Route.useSearch();
  const [pestana, setPestana] = React.useState<Pestana>(busqueda.tab ?? "copias");
  const { data: destinos = [] } = useDestinosCopias();
  const { data: config } = useConfigCopias();
  const { data: origenes = [] } = useOrigenesCopias();
  const { data: historico = [] } = useHistoricoCopias();
  const { data: proyectos = [] } = useProyectos();

  const guardarDestino = useGuardarDestino();
  const probar = useProbarDestino();
  const guardarConfig = useGuardarConfig();
  const refrescar = useRefrescarOrigenes();
  const importar = useImportarProyectos();
  const firmar = useFirmarDescarga();
  const lanzar = useLanzarCopias();

  const destino = destinos.find((d) => d.id === config?.destino_id) ?? destinos[0] ?? null;

  const [nombre, setNombre] = React.useState("");
  const [servidor, setServidor] = React.useState("");
  const [bucket, setBucket] = React.useState("copias");
  const [region, setRegion] = React.useState("eu-central-1");
  const [prefijo, setPrefijo] = React.useState("");
  const [accessKey, setAccessKey] = React.useState("");
  const [secreto, setSecreto] = React.useState("");
  const [reemplazar, setReemplazar] = React.useState(false);
  const [cargado, setCargado] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!destino || cargado === destino.id) return;
    setNombre(destino.nombre ?? "");
    setServidor(destino.url_servidor ?? "");
    setBucket(destino.bucket ?? "copias");
    setRegion(destino.region ?? "eu-central-1");
    setPrefijo(destino.ruta_prefijo ?? "");
    setAccessKey(destino.usuario ?? "");
    setSecreto("");
    setReemplazar(false);
    setCargado(destino.id);
  }, [destino, cargado]);

  const tieneSecreto = Boolean(destino?.tiene_secreto) && !reemplazar;

  const guardar = async () => {
    try {
      const id = await guardarDestino.mutateAsync({
        ...(destino ? { id: destino.id } : {}),
        nombre: nombre.trim() || "Almacén de copias",
        url_servidor: servidor.trim(),
        bucket: bucket.trim() || "copias",
        region: region.trim() || "eu-central-1",
        ruta_prefijo: prefijo.trim() || null,
        usuario: accessKey.trim(),
        ...(secreto ? { secreto } : {}),
      });
      setSecreto("");
      setReemplazar(false);
      setCargado(id);
      toast.success("Destino guardado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido guardar el destino.");
    }
  };

  const probarConexion = async () => {
    if (!destino) return;
    try {
      const res = await probar.mutateAsync(destino.id);
      toast.success(res.mensaje ?? "Conexión correcta.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido conectar.");
    }
  };

  const usarComoDestino = async () => {
    if (!destino) return;
    try {
      await guardarConfig.mutateAsync({ destino_id: destino.id });
      toast.success("Este almacén se usará para las copias.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido guardar.");
    }
  };

  const cambiarConfig = async (cambios: Record<string, unknown>) => {
    try {
      await guardarConfig.mutateAsync(cambios as never);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido guardar.");
    }
  };

  // ---- Qué se copia ----
  const bases = origenes.filter((o) => o.tipo === "base_datos");
  const repos = origenes.filter((o) => o.tipo === "repositorio");
  const nombreProyecto = (id: string | null) => proyectos.find((p) => p.id === id)?.nombre ?? null;

  const alternarSeleccion = (campo: "bases_datos_seleccion" | "repositorios_seleccion", objetivo: string) => {
    const actual = (config?.[campo] ?? []) as string[];
    const nueva = actual.includes(objetivo) ? actual.filter((x) => x !== objetivo) : [...actual, objetivo];
    void cambiarConfig({ [campo]: nueva });
  };

  // ---- Copiar ahora ----
  const [copiarBases, setCopiarBases] = React.useState(true);
  const [copiarRepos, setCopiarRepos] = React.useState(true);
  const [loteId, setLoteId] = React.useState<string | null>(null);
  const { data: lote = [] } = useLoteCopias(loteId);

  const copiarAhora = async () => {
    const tipos = [copiarBases ? "base_datos" : null, copiarRepos ? "repositorio" : null].filter(Boolean) as string[];
    if (tipos.length === 0) {
      toast.error("Marca al menos bases de datos o repositorios.");
      return;
    }
    try {
      const id = await lanzar.mutateAsync(tipos);
      setLoteId(id);
      toast.success("Copia en marcha. Verás el progreso aquí abajo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido lanzar la copia.");
    }
  };

  // ---- Histórico ----
  const [filtroTipo, setFiltroTipo] = React.useState<"todos" | TipoOrigenCopia>("todos");
  const [filtroEstado, setFiltroEstado] = React.useState<"todos" | EstadoCopia>("todos");
  const visibles = historico.filter(
    (c) => (filtroTipo === "todos" || c.tipo === filtroTipo) && (filtroEstado === "todos" || c.estado === filtroEstado),
  );

  const dias = diasDesdeUltimaCorrecta(historico);
  const avisoDias = config?.aviso_dias ?? 2;
  const hayAviso = dias === null || dias > avisoDias;

  const descargar = async (copia: CopiaRow) => {
    try {
      const res = await firmar.mutateAsync(copia.id);
      window.open(res.url, "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido preparar la descarga.");
    }
  };

  return (
    <>
      <Encabezado
        titulo="Copias de seguridad"
        descripcion="Guarda tus bases de datos y repositorios en tu propio almacén, a mano o de forma automática."
        acciones={
          <Boton onClick={() => void copiarAhora()} disabled={lanzar.isPending}>
            <HardDriveDownload className="size-4" /> Copiar ahora
          </Boton>
        }
      />

      {hayAviso ? (
        <div
          className={`panel mb-5 p-4 text-sm ${
            dias === null
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-warning/40 bg-warning/10 text-warning"
          }`}
        >
          {dias === null
            ? "Todavía no hay ninguna copia correcta guardada."
            : `La última copia correcta tiene ${dias} días (avisas a partir de ${avisoDias}).`}
        </div>
      ) : null}

      <div className="mb-5 inline-flex rounded-lg border border-border bg-surface p-1">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              pestana === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {pestana === "restaurar" ? <PanelRestaurar copiaInicial={busqueda.copia} /> : null}
      {pestana === "pruebas" ? <PanelPruebas /> : null}

      <div className={pestana === "copias" ? "" : "hidden"}>
      {/* a) Destino */}
      <section className="panel mb-5 p-5">
        <h2 className="font-display text-base font-semibold">Destino</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Almacén compatible con S3 donde se guardan las copias. La clave secreta nunca se muestra.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Campo etiqueta="Nombre">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Servidor" pista="Por ejemplo https://almacen.evoluteia.com">
            <input value={servidor} onChange={(e) => setServidor(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Bucket">
            <input value={bucket} onChange={(e) => setBucket(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Región">
            <input value={region} onChange={(e) => setRegion(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Carpeta base (opcional)">
            <input value={prefijo} onChange={(e) => setPrefijo(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Access key">
            <input value={accessKey} onChange={(e) => setAccessKey(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Secret key">
            {tieneSecreto ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs text-success">
                  Guardada
                </span>
                <Boton variante="suave" type="button" onClick={() => setReemplazar(true)}>
                  Reemplazar
                </Boton>
              </div>
            ) : (
              <input
                type="password"
                autoComplete="new-password"
                value={secreto}
                onChange={(e) => setSecreto(e.target.value)}
                className={claseCampo}
              />
            )}
          </Campo>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Boton onClick={() => void guardar()} disabled={guardarDestino.isPending}>
            Guardar destino
          </Boton>
          <Boton variante="suave" onClick={() => void probarConexion()} disabled={!destino || probar.isPending}>
            Probar conexión
          </Boton>
          <Boton variante="suave" onClick={() => void usarComoDestino()} disabled={!destino}>
            Usar como destino de las copias
          </Boton>
          {destino?.resultado_prueba ? (
            <span className="text-xs text-muted-foreground">
              Última prueba: {formatoFechaHora(destino.ultima_prueba)} · {destino.resultado_prueba}
            </span>
          ) : null}
        </div>
      </section>

      {/* b) Qué se copia */}
      <section className="panel mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold">Qué se copia</h2>
          <div className="flex flex-wrap gap-2">
            <Boton variante="suave" onClick={() => void refrescarLista()} disabled={refrescar.isPending}>
              <RefreshCw className={`size-4 ${refrescar.isPending ? "animate-spin" : ""}`} /> Actualizar lista
            </Boton>
            <Boton variante="suave" onClick={() => void crearFichas()} disabled={importar.isPending}>
              Crear fichas de proyecto que falten
            </Boton>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <BloqueOrigenes
            titulo="Bases de datos"
            origenes={bases}
            todas={config?.bases_datos_todas ?? true}
            seleccion={config?.bases_datos_seleccion ?? []}
            onTodas={(v) => void cambiarConfig({ bases_datos_todas: v })}
            onAlternar={(objetivo) => alternarSeleccion("bases_datos_seleccion", objetivo)}
            nombreProyecto={nombreProyecto}
          />
          <BloqueOrigenes
            titulo="Repositorios"
            origenes={repos}
            todas={config?.repositorios_todos ?? true}
            seleccion={config?.repositorios_seleccion ?? []}
            onTodas={(v) => void cambiarConfig({ repositorios_todos: v })}
            onAlternar={(objetivo) => alternarSeleccion("repositorios_seleccion", objetivo)}
            nombreProyecto={nombreProyecto}
          />
        </div>
      </section>

      {/* c) Copiar ahora */}
      <section className="panel mb-5 p-5">
        <h2 className="font-display text-base font-semibold">Copiar ahora</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={copiarBases}
              onChange={(e) => setCopiarBases(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Bases de datos
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={copiarRepos}
              onChange={(e) => setCopiarRepos(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Repositorios
          </label>
          <Boton onClick={() => void copiarAhora()} disabled={lanzar.isPending}>
            <HardDriveDownload className="size-4" /> Copiar ahora
          </Boton>
        </div>

        {loteId ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Tamaño</th>
                  <th className="px-3 py-2 font-medium">Tablas / filas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lote.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2">
                      {c.nombre}
                      {c.error ? <p className="mt-0.5 text-xs text-destructive">{c.error}</p> : null}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{ETIQUETA_TIPO[c.tipo]}</td>
                    <td className="px-3 py-2">
                      <Insignia estado={c.estado} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{tamanoLegible(c.bytes)}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {c.num_tablas ?? "—"} / {c.num_filas ?? "—"}
                    </td>
                  </tr>
                ))}
                {lote.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-muted-foreground">
                      Preparando el lote...
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* d) Automáticas */}
      <section className="panel mb-5 p-5">
        <h2 className="font-display text-base font-semibold">Automáticas</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={config?.auto_activa ?? false}
              onChange={(e) => void cambiarConfig({ auto_activa: e.target.checked })}
              className="size-4 rounded border-input accent-primary"
            />
            Copias automáticas
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={config?.diaria ?? false}
              onChange={(e) => void cambiarConfig({ diaria: e.target.checked })}
              className="size-4 rounded border-input accent-primary"
            />
            Diaria (a las 03:00)
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={config?.semanal ?? false}
              onChange={(e) => void cambiarConfig({ semanal: e.target.checked })}
              className="size-4 rounded border-input accent-primary"
            />
            Semanal (domingo)
          </label>
          <Campo etiqueta="Diarias que se conservan">
            <input
              type="number"
              min={1}
              value={config?.retener_diarias ?? 7}
              onChange={(e) => void cambiarConfig({ retener_diarias: Number(e.target.value) })}
              className={claseCampo}
            />
          </Campo>
          <Campo etiqueta="Semanales que se conservan">
            <input
              type="number"
              min={1}
              value={config?.retener_semanales ?? 4}
              onChange={(e) => void cambiarConfig({ retener_semanales: Number(e.target.value) })}
              className={claseCampo}
            />
          </Campo>
          <Campo etiqueta="Avisar si la última copia correcta tiene más de (días)">
            <input
              type="number"
              min={1}
              value={config?.aviso_dias ?? 2}
              onChange={(e) => void cambiarConfig({ aviso_dias: Number(e.target.value) })}
              className={claseCampo}
            />
          </Campo>
        </div>
        {config?.ultima_auto ? (
          <p className="mt-3 text-xs text-muted-foreground">Última automática: {formatoFechaHora(config.ultima_auto)}</p>
        ) : null}
      </section>

      {/* e) Histórico */}
      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold">Histórico</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}
              className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
            >
              <option value="todos">Todos los tipos</option>
              <option value="base_datos">Bases de datos</option>
              <option value="repositorio">Repositorios</option>
            </select>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
              className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_curso">En curso</option>
              <option value="ok">Correcta</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Origen</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Tamaño</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibles.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 text-muted-foreground">{formatoFechaHora(c.terminada_el ?? c.creado_el)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{ETIQUETA_ORIGEN[c.origen] ?? c.origen}</td>
                  <td className="px-3 py-2 text-muted-foreground">{ETIQUETA_TIPO[c.tipo]}</td>
                  <td className="px-3 py-2">
                    {c.nombre}
                    {c.error ? <p className="mt-0.5 text-xs text-destructive">{c.error}</p> : null}
                  </td>
                  <td className="px-3 py-2">
                    <Insignia estado={c.estado} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{tamanoLegible(c.bytes)}</td>
                  <td className="px-3 py-2 text-right">
                    {c.estado === "ok" ? (
                      <Boton variante="suave" onClick={() => void descargar(c)} disabled={firmar.isPending}>
                        <Download className="size-4" /> Descargar
                      </Boton>
                    ) : null}
                  </td>
                </tr>
              ))}
              {visibles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-muted-foreground">
                    Todavía no hay copias que mostrar.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      </div>
    </>
  );

  async function refrescarLista() {
    try {
      const res = await refrescar.mutateAsync();
      toast.success(`Lista actualizada: ${res.bases_datos} bases de datos y ${res.repositorios} repositorios.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido actualizar la lista.");
    }
  }

  async function crearFichas() {
    if (!window.confirm("Se crearán fichas de proyecto para las bases de datos que aún no tengan una. ¿Continuar?")) {
      return;
    }
    try {
      const res = await importar.mutateAsync();
      toast.success(res.creados > 0 ? `Se han creado ${res.creados} fichas de proyecto.` : "No faltaba ninguna ficha.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se han podido crear las fichas.");
    }
  }
}

function BloqueOrigenes({
  titulo,
  origenes,
  todas,
  seleccion,
  onTodas,
  onAlternar,
  nombreProyecto,
}: {
  titulo: string;
  origenes: CopiaOrigenRow[];
  todas: boolean;
  seleccion: string[];
  onTodas: (v: boolean) => void;
  onAlternar: (objetivo: string) => void;
  nombreProyecto: (id: string | null) => string | null;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{titulo}</h3>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={todas}
            onChange={(e) => onTodas(e.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          Todos
        </label>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{origenes.length} en la lista</p>
      {!todas ? (
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {origenes.map((o) => {
            const detalle = (o.detalle ?? {}) as Record<string, unknown>;
            const extras = [detalle["region"], detalle["rama"], detalle["estado"]]
              .filter((v) => typeof v === "string")
              .join(" · ");
            const proyecto = nombreProyecto(o.proyecto_id);
            return (
              <li key={o.id}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={seleccion.includes(o.objetivo)}
                    onChange={() => onAlternar(o.objetivo)}
                    className="mt-0.5 size-4 rounded border-input accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{o.nombre}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {o.objetivo}
                      {extras ? ` · ${extras}` : ""}
                      {proyecto ? ` · ${proyecto}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
          {origenes.length === 0 ? (
            <li className="text-sm text-muted-foreground">Nada en la lista. Pulsa «Actualizar lista».</li>
          ) : null}
        </ul>
      ) : null}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Las copias se guardan en tu propio almacén.
      </p>
    </div>
  );
}
