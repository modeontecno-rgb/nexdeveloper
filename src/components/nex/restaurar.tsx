import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  GitBranch,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type { ModoRestauracion, RestauracionRow } from "@/lib/nex/db-types";
import { formatoFechaHora } from "@/lib/nex/labels";
import { tamanoLegible } from "@/lib/nex/queries/copias";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  ETIQUETA_ESTADO_RESTAURACION,
  ETIQUETA_MODO_RESTAURACION,
  ETIQUETA_TIPO_RESTAURACION,
  TONO_ESTADO_RESTAURACION,
  duracionRestauracion,
  estaEnMarcha,
  useCancelarRestauracion,
  useCopiasRestaurables,
  useEnlaceCopia,
  useEstadoRestauraciones,
  useGuardarConfigRestauracion,
  usePrepararRestauracion,
  useProbarRestauracionAhora,
  useRealtimeRestauraciones,
  useRestauraciones,
  useRestaurar,
  type CopiaRestaurable,
  type ResumenPreparar,
} from "@/lib/nex/queries/restauraciones";

/* ============================ Pestaña «Restaurar» ========================== */

export function PanelRestaurar({ copiaInicial }: { copiaInicial?: string | undefined }) {
  const { data: proyectos = [] } = useProyectos();
  const [objetivo, setObjetivo] = React.useState<string>("");
  const { data: copias = [], isPending } = useCopiasRestaurables(objetivo || undefined);
  const { data: restauraciones = [] } = useRestauraciones();
  const enlace = useEnlaceCopia();
  useRealtimeRestauraciones(true);

  const [copiaElegida, setCopiaElegida] = React.useState<CopiaRestaurable | null>(null);

  React.useEffect(() => {
    if (!copiaInicial) return;
    const c = copias.find((x) => x.id === copiaInicial);
    if (c) setCopiaElegida(c);
  }, [copiaInicial, copias]);

  const enMarcha = restauraciones.filter((r) => estaEnMarcha(r));
  const recientes = restauraciones.filter((r) => !estaEnMarcha(r)).slice(0, 3);

  const descargar = async (copia: CopiaRestaurable) => {
    const r = await enlace.mutateAsync(copia.id).catch(() => null);
    if (r?.url) window.open(r.url, "_blank", "noopener");
  };

  const objetivos = Array.from(new Set(copias.map((c) => c.objetivo)));

  return (
    <div className="space-y-5">
      {enMarcha.map((r) => (
        <TarjetaProgreso key={r.id} restauracion={r} />
      ))}
      {recientes.map((r) => (
        <TarjetaProgreso key={r.id} restauracion={r} />
      ))}

      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">Copias que puedes restaurar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Elige una copia correcta y te guiamos paso a paso antes de tocar nada.
            </p>
          </div>
          <select
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">Todos los proyectos</option>
            {objetivos.map((o) => (
              <option key={o} value={o}>
                {proyectos.find((p) => p.nombre === o)?.nombre ?? o}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Copia</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Tamaño</th>
                <th className="px-3 py-2 font-medium">Tablas / filas</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {copias.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      {c.tipo === "base_datos" ? (
                        <Database className="size-4 text-muted-foreground" />
                      ) : (
                        <GitBranch className="size-4 text-muted-foreground" />
                      )}
                      <span>
                        <span className="block">{c.nombre}</span>
                        <span className="block text-xs text-muted-foreground">{c.objetivo}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatoFechaHora(c.terminada_el)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{tamanoLegible(c.bytes)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.num_tablas ?? "—"} / {c.num_filas ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Boton
                        variante="suave"
                        className="px-2.5 py-1 text-xs"
                        onClick={() => void descargar(c)}
                        disabled={enlace.isPending}
                      >
                        <Download className="size-3.5" /> Descargar
                      </Boton>
                      <Boton className="px-2.5 py-1 text-xs" onClick={() => setCopiaElegida(c)}>
                        <RotateCcw className="size-3.5" /> Restaurar…
                      </Boton>
                    </div>
                  </td>
                </tr>
              ))}
              {copias.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-muted-foreground">
                    {isPending ? "Buscando copias…" : "Todavía no hay copias correctas que restaurar."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {copiaElegida ? <AsistenteRestauracion copia={copiaElegida} onCerrar={() => setCopiaElegida(null)} /> : null}
    </div>
  );
}

/* ============================== Asistente ================================== */

export function AsistenteRestauracion({ copia, onCerrar }: { copia: CopiaRestaurable; onCerrar: () => void }) {
  const preparar = usePrepararRestauracion();
  const restaurar = useRestaurar();
  const esBd = copia.tipo === "base_datos";

  const [paso, setPaso] = React.useState(1);
  const [destino, setDestino] = React.useState(copia.objetivo);
  const [modo, setModo] = React.useState<ModoRestauracion>(esBd ? "solo_datos" : "rama");
  const hoy = new Date().toISOString().slice(0, 10);
  const [rama, setRama] = React.useState(`restauracion-${hoy}`);
  const [confirmacion, setConfirmacion] = React.useState("");
  const [resumen, setResumen] = React.useState<ResumenPreparar | null>(null);

  React.useEffect(() => {
    preparar
      .mutateAsync({ copiaId: copia.id })
      .then(setResumen)
      .catch(() => setResumen(null));
    // Solo al abrir el asistente con una copia concreta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copia.id]);

  const lanzar = async () => {
    const r = await restaurar
      .mutateAsync({
        copiaId: copia.id,
        ...(destino.trim() ? { destino: destino.trim() } : {}),
        modo,
        ...(!esBd && rama.trim() ? { rama: rama.trim() } : {}),
      })
      .catch(() => null);
    if (r) onCerrar();
  };

  const puedeLanzar = modo === "simulada" || confirmacion.trim().toUpperCase() === "RESTAURAR";

  return (
    <Dialogo
      abierto
      titulo={`Restaurar «${copia.nombre}»`}
      descripcion={`Paso ${paso} de 3`}
      onCerrar={onCerrar}
      ancho="max-w-3xl"
    >
      <div className="space-y-5 text-sm">
        {paso === 1 ? (
          <section>
            <h3 className="font-display text-sm font-semibold">Qué contiene esta copia</h3>
            {preparar.isPending ? (
              <p className="mt-2 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Revisando la copia…
              </p>
            ) : resumen ? (
              <>
                <p className="mt-2 text-muted-foreground">
                  Copia del {formatoFechaHora(resumen.resumen?.fecha ?? copia.terminada_el)} ·{" "}
                  {tamanoLegible(resumen.resumen?.bytes ?? copia.bytes)} · {resumen.resumen?.filas ?? copia.num_filas ?? 0}{" "}
                  filas · {resumen.resumen?.funciones ?? 0} funciones · {resumen.resumen?.politicas ?? 0} reglas de
                  seguridad
                </p>
                {(resumen.resumen?.tablas ?? []).length > 0 ? (
                  <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-surface text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Tabla</th>
                          <th className="px-3 py-2 font-medium">Filas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(resumen.resumen?.tablas ?? []).map((t) => (
                          <tr key={t.tabla}>
                            <td className="px-3 py-1.5">{t.tabla}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{t.filas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                <h3 className="mt-4 font-display text-sm font-semibold">Cómo está el destino ahora mismo</h3>
                {resumen.destino?.error ? (
                  <p className="mt-1 text-destructive">{resumen.destino.error}</p>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    {resumen.destino?.ref ?? copia.objetivo} · {resumen.destino?.tablas ?? 0} tablas ·{" "}
                    {resumen.destino?.usuarios ?? 0} usuarios
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-destructive">No se ha podido leer la copia.</p>
            )}
          </section>
        ) : null}

        {paso === 2 ? (
          <section className="space-y-4">
            {esBd ? (
              <>
                <Campo
                  etiqueta="Proyecto de destino (referencia de Supabase)"
                  pista="Por defecto el proyecto original. Puedes poner el de pruebas para no tocar el bueno."
                >
                  <input value={destino} onChange={(e) => setDestino(e.target.value)} className={claseCampo} />
                </Campo>
                <div className="grid gap-2 sm:grid-cols-2">
                  <OpcionModo
                    activo={modo === "solo_datos"}
                    titulo="Solo datos"
                    texto="Vacía las tablas que ya existen y vuelve a meter los datos. Es lo recomendado sobre el proyecto original."
                    onClick={() => setModo("solo_datos")}
                  />
                  <OpcionModo
                    activo={modo === "esquema_y_datos"}
                    titulo="Estructura y datos"
                    texto="Crea las tablas, funciones y reglas y después mete los datos. Para un proyecto vacío."
                    onClick={() => setModo("esquema_y_datos")}
                  />
                </div>
              </>
            ) : (
              <>
                <Campo etiqueta="Repositorio de destino" pista="Por defecto el repositorio original (usuario/repositorio).">
                  <input value={destino} onChange={(e) => setDestino(e.target.value)} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Nombre de la rama nueva">
                  <input value={rama} onChange={(e) => setRama(e.target.value)} className={claseCampo} />
                </Campo>
              </>
            )}

            <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>Se sobrescribirán los datos del destino. Se guardará una copia previa automática.</span>
            </p>
          </section>
        ) : null}

        {paso === 3 ? (
          <section className="space-y-3">
            <p className="text-muted-foreground">
              Vas a restaurar <strong className="text-foreground">{copia.nombre}</strong> en{" "}
              <strong className="text-foreground">{destino || copia.objetivo}</strong> en modo{" "}
              <strong className="text-foreground">{ETIQUETA_MODO_RESTAURACION[modo]}</strong>
              {!esBd ? ` (rama ${rama})` : ""}.
            </p>
            <Campo etiqueta="Escribe RESTAURAR para confirmar">
              <input
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                placeholder="RESTAURAR"
                className={claseCampo}
              />
            </Campo>
          </section>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="suave" type="button" onClick={onCerrar}>
            Cancelar
          </Boton>
          {paso > 1 ? (
            <Boton variante="suave" type="button" onClick={() => setPaso((p) => p - 1)}>
              Atrás
            </Boton>
          ) : null}
          {paso < 3 ? (
            <Boton type="button" onClick={() => setPaso((p) => p + 1)}>
              Continuar
            </Boton>
          ) : (
            <Boton variante="peligro" type="button" disabled={!puedeLanzar || restaurar.isPending} onClick={() => void lanzar()}>
              {restaurar.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}{" "}
              Restaurar ahora
            </Boton>
          )}
        </div>
      </div>
    </Dialogo>
  );
}

function OpcionModo({
  activo,
  titulo,
  texto,
  onClick,
}: {
  activo: boolean;
  titulo: string;
  texto: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={
        activo
          ? "rounded-lg border border-primary/50 bg-primary/10 p-3 text-left"
          : "rounded-lg border border-border bg-surface p-3 text-left transition hover:border-primary/30"
      }
    >
      <span className={`block text-sm font-medium ${activo ? "text-primary" : "text-foreground"}`}>{titulo}</span>
      <span className="mt-1 block text-[11px] text-muted-foreground">{texto}</span>
    </button>
  );
}

/* ============================ Progreso en vivo ============================= */

export function TarjetaProgreso({ restauracion }: { restauracion: RestauracionRow }) {
  const cancelar = useCancelarRestauracion();
  const [verAvisos, setVerAvisos] = React.useState(false);
  const p = restauracion.progreso ?? {};
  const avisos = p.avisos ?? [];
  const resultado = (restauracion.resultado ?? {}) as Record<string, unknown>;
  const urlRama = typeof resultado["url"] === "string" ? (resultado["url"] as string) : null;
  const corriendo = estaEnMarcha(restauracion);

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">
            {ETIQUETA_TIPO_RESTAURACION[restauracion.tipo]} · {ETIQUETA_MODO_RESTAURACION[restauracion.modo]}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Destino: {restauracion.destino ?? "—"}
            {restauracion.rama ? ` · rama ${restauracion.rama}` : ""} ·{" "}
            {formatoFechaHora(restauracion.iniciada_el ?? restauracion.creado_el)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${TONO_ESTADO_RESTAURACION[restauracion.estado]}`}>
            {ETIQUETA_ESTADO_RESTAURACION[restauracion.estado]}
          </span>
          {corriendo ? (
            <Boton
              variante="suave"
              className="px-2.5 py-1 text-xs"
              disabled={cancelar.isPending}
              onClick={() => cancelar.mutate(restauracion.id)}
            >
              Cancelar
            </Boton>
          ) : null}
        </div>
      </div>

      {restauracion.paso ? <p className="mt-3 text-sm">{restauracion.paso}</p> : null}

      <div className="mt-3 space-y-2">
        {typeof p.tablas_total === "number" && p.tablas_total > 0 ? (
          <Barra titulo="Tablas" hechas={p.tablas_hechas ?? 0} total={p.tablas_total} />
        ) : null}
        {typeof p.filas_total === "number" && p.filas_total > 0 ? (
          <Barra titulo="Filas" hechas={p.filas_hechas ?? 0} total={p.filas_total} />
        ) : null}
        {typeof p.archivos_total === "number" && p.archivos_total > 0 ? (
          <Barra titulo="Archivos" hechas={p.archivos_hechos ?? 0} total={p.archivos_total} />
        ) : null}
      </div>

      {avisos.length > 0 ? (
        <div className="mt-3">
          <button type="button" onClick={() => setVerAvisos((v) => !v)} className="text-xs text-warning hover:underline">
            {avisos.length} avisos · {verAvisos ? "ocultar" : "ver"}
          </button>
          {verAvisos ? (
            <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
              {avisos.map((a, i) => (
                <li key={i}>· {a}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {restauracion.copia_previa ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Copia previa guardada en el almacén: <span className="text-foreground">{restauracion.copia_previa}</span>
        </p>
      ) : null}

      {restauracion.estado === "completada" ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="size-4" />
          Restauración terminada
          {typeof p.tablas_hechas === "number" ? `: ${p.tablas_hechas} tablas` : ""}
          {typeof p.filas_hechas === "number" ? ` y ${p.filas_hechas} filas` : ""} en{" "}
          {duracionRestauracion(restauracion)}.
          {urlRama ? (
            <a href={urlRama} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
              <ExternalLink className="size-3.5" /> Ver la rama en GitHub
            </a>
          ) : null}
        </p>
      ) : null}

      {restauracion.estado === "error" ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <XCircle className="size-4" /> {restauracion.error ?? "La restauración ha fallado."}
        </p>
      ) : null}
    </section>
  );
}

function Barra({ titulo, hechas, total }: { titulo: string; hechas: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (hechas / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{titulo}</span>
        <span>
          {hechas} de {total}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ============================= Pestaña «Pruebas» =========================== */

export function PanelPruebas() {
  const { data: estado } = useEstadoRestauraciones();
  const { data: restauraciones = [] } = useRestauraciones();
  const { data: proyectos = [] } = useProyectos();
  const probar = useProbarRestauracionAhora();
  const guardar = useGuardarConfigRestauracion();
  useRealtimeRestauraciones(true);

  const config = estado?.config ?? null;
  const [sandbox, setSandbox] = React.useState("");
  const [cargado, setCargado] = React.useState(false);

  React.useEffect(() => {
    if (!config || cargado) return;
    setSandbox(config.sandbox_ref ?? "");
    setCargado(true);
  }, [config, cargado]);

  const ultima = estado?.ultima_prueba ?? restauraciones.find((r) => r.tipo === "prueba") ?? null;
  const pruebas = restauraciones.filter((r) => r.tipo === "prueba");

  return (
    <div className="space-y-5">
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">Última prueba de restauración</h2>
            {ultima ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {formatoFechaHora(ultima.terminada_el ?? ultima.creado_el)} ·{" "}
                {ultima.modo === "simulada" ? "simulada" : "restaurada en el Supabase de pruebas"} ·{" "}
                {duracionRestauracion(ultima)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Todavía no se ha hecho ninguna prueba.</p>
            )}
          </div>
          <Boton onClick={() => probar.mutate()} disabled={probar.isPending}>
            {probar.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Probar
            ahora
          </Boton>
        </div>

        {ultima ? (
          ultima.estado === "completada" ? (
            <p className="mt-3 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
              Correcta: la copia sirve para restaurar
              {typeof ultima.progreso?.tablas_hechas === "number"
                ? ` (${ultima.progreso.tablas_hechas} tablas y ${ultima.progreso?.filas_hechas ?? 0} filas)`
                : ""}
              .
            </p>
          ) : ultima.estado === "error" ? (
            <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Falló: {ultima.error ?? "sin detalle"}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {ETIQUETA_ESTADO_RESTAURACION[ultima.estado]}
              {ultima.paso ? ` · ${ultima.paso}` : ""}
            </p>
          )
        ) : null}
      </section>

      <section className="panel p-5">
        <h2 className="font-display text-base font-semibold">Prueba automática</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={config?.prueba_mensual ?? false}
              onChange={(e) => guardar.mutate({ prueba_mensual: e.target.checked })}
              className="size-4 rounded border-input accent-primary"
            />
            Probar una copia cada mes (día 1 a las 05:00)
          </label>
          <Campo etiqueta="Proyecto que se usa para la prueba">
            <select
              value={config?.proyecto_prueba_id ?? ""}
              onChange={(e) => guardar.mutate({ proyecto_prueba_id: e.target.value || null })}
              className={claseCampo}
            >
              <option value="">El de la copia más pequeña</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <div className="md:col-span-2">
            <Campo
              etiqueta="Supabase de pruebas (referencia)"
              pista="Crea un proyecto vacío en Supabase para restauraciones de prueba y pega aquí su referencia; si lo dejas vacío la prueba será simulada."
            >
              <div className="flex flex-wrap gap-2">
                <input
                  value={sandbox}
                  onChange={(e) => setSandbox(e.target.value)}
                  className={`${claseCampo} max-w-md`}
                />
                <Boton
                  variante="suave"
                  onClick={() => {
                    guardar.mutate({ sandbox_ref: sandbox.trim() || null });
                    if (!sandbox.trim()) toast.message("Sin proyecto de pruebas, la prueba será simulada.");
                  }}
                  disabled={guardar.isPending}
                >
                  Guardar
                </Boton>
              </div>
            </Campo>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="font-display text-base font-semibold">Historial de pruebas y restauraciones</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Destino</th>
                <th className="px-3 py-2 font-medium">Modo</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Duración</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {restauraciones.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 text-muted-foreground">{formatoFechaHora(r.creado_el)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{ETIQUETA_TIPO_RESTAURACION[r.tipo]}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.destino ?? "—"}
                    {r.rama ? ` · ${r.rama}` : ""}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{ETIQUETA_MODO_RESTAURACION[r.modo]}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${TONO_ESTADO_RESTAURACION[r.estado]}`}>
                      {ETIQUETA_ESTADO_RESTAURACION[r.estado]}
                    </span>
                    {r.error ? <p className="mt-0.5 text-xs text-destructive">{r.error}</p> : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{duracionRestauracion(r)}</td>
                </tr>
              ))}
              {restauraciones.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-muted-foreground">
                    Todavía no hay restauraciones ni pruebas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {pruebas.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{pruebas.length} pruebas realizadas hasta ahora.</p>
        ) : null}
      </section>
    </div>
  );
}

/* ================== Botón para la ficha de cada proyecto =================== */

export function BotonRestaurarUltimaCopia({ objetivos }: { objetivos: string[] }) {
  const { data: copias = [] } = useCopiasRestaurables();
  const [abierto, setAbierto] = React.useState(false);
  const propias = copias.filter((c) => objetivos.includes(c.objetivo));
  const ultima = propias[0] ?? null;
  if (!ultima) return null;

  return (
    <>
      <Boton variante="suave" className="px-2.5 py-1 text-xs" onClick={() => setAbierto(true)}>
        <RotateCcw className="size-3.5" /> Restaurar última copia
      </Boton>
      {abierto ? <AsistenteRestauracion copia={ultima} onCerrar={() => setAbierto(false)} /> : null}
    </>
  );
}
