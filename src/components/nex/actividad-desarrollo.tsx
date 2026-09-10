import * as React from "react";
import { Activity, CheckCircle2, Clock3, FileCode2, AlertTriangle, RefreshCw } from "lucide-react";
import {
  estadoVisible,
  nombresFases,
  progresoEstimado,
  ultimasAcciones,
  type TrabajoActividad,
} from "@/lib/nex/actividad-desarrollo";

export function ActividadDesarrollo({
  trabajo,
  actualizar,
  actualizando,
}: {
  trabajo: TrabajoActividad;
  actualizar?: () => void;
  actualizando?: boolean;
}) {
  const [ahora, setAhora] = React.useState(Date.now);
  const [archivo, setArchivo] = React.useState<string | null>(null);
  const enCurso = !["completada", "esperando_aprobacion", "error", "cancelada"].includes(
    trabajo.estado,
  );
  React.useEffect(() => {
    if (!enCurso) return;
    const t = setInterval(() => setAhora(Date.now()), 10000);
    return () => clearInterval(t);
  }, [enCurso]);
  const porcentaje = progresoEstimado(trabajo);
  const acciones = ultimasAcciones(trabajo);
  const fases = trabajo.estado_agente?.equipo ?? [];
  const archivos = Object.entries(trabajo.cambios ?? {});
  const fecha = Date.parse(trabajo.actualizado_el ?? trabajo.creado_el ?? "");
  const segundos = Number.isFinite(fecha) ? Math.max(0, Math.floor((ahora - fecha) / 1000)) : null;
  const sinNovedades = enCurso && segundos !== null && segundos >= 120;
  const contenido = archivo ? trabajo.cambios?.[archivo] : undefined;
  return (
    <section
      aria-label="Seguimiento del trabajo"
      className="rounded-2xl border-2 border-primary/60 bg-surface p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-3 text-xl font-bold">
          <Activity aria-hidden="true" className="size-6 text-primary" /> Trabajo en directo
        </h3>
        <span className="rounded-full border border-border px-3 py-1 text-sm">
          {enCurso ? "Se actualiza cada 5 segundos" : "Registro del trabajo"}
        </span>
      </div>
      {actualizar ? (
        <button
          type="button"
          onClick={actualizar}
          disabled={actualizando}
          className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl border border-input bg-card px-4 py-2 text-lg font-medium disabled:opacity-60"
        >
          <RefreshCw
            className={`size-5 ${actualizando ? "animate-spin motion-reduce:animate-none" : ""}`}
          />
          {actualizando ? "Consultando…" : "Comprobar ahora"}
        </button>
      ) : null}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <p className="min-w-0 break-words text-lg font-semibold">{estadoVisible(trabajo)}</p>
        <p className="text-4xl font-bold tabular-nums text-primary">
          {porcentaje}
          <span className="ml-1 text-xl">%</span>
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Avance estimado del trabajo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentaje}
        aria-valuetext={`${porcentaje} por ciento estimado. ${estadoVisible(trabajo)}`}
        className="mt-3 h-5 overflow-hidden rounded-full border border-input bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Estimación por fases y acciones registradas; puede ajustarse al cambiar el plan. No es una
        cuenta atrás.
      </p>
      {trabajo.estado === "esperando_aprobacion" ? (
        <p className="mt-3 text-lg font-medium">
          El 100 % indica que la entrega está preparada. Todavía requiere tu revisión.
        </p>
      ) : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Dato titulo="Pasos registrados" valor={String(trabajo.pasos ?? 0)} />
        <Dato titulo="Archivos preparados" valor={String(archivos.length)} />
        <Dato
          titulo="Último registro"
          valor={
            segundos === null
              ? "Sin fecha disponible"
              : segundos < 60
                ? "Hace menos de 1 min"
                : `Hace ${Math.floor(segundos / 60)} min`
          }
        />
      </div>
      {sinNovedades ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-warning bg-warning/10 p-4 text-lg"
        >
          <Clock3 className="mr-2 inline size-5" />
          Sin nuevos registros desde hace {Math.floor(segundos! / 60)} minutos. Puede estar
          esperando al proveedor; todavía no hay confirmación de más avance.
        </p>
      ) : null}
      {fases.length ? (
        <ol className="mt-5 grid gap-2 sm:grid-cols-2">
          {fases.map((fase, i) => (
            <li
              key={i}
              className={`rounded-xl border p-3 ${fase.estado === "trabajando" && enCurso ? "border-primary bg-primary/10" : "border-border"}`}
            >
              <p className="font-semibold">
                {i + 1}. {nombresFases[fase.papel] ?? fase.papel}
              </p>
              <p className="text-sm">
                {fase.estado === "completada"
                  ? "Hecho"
                  : fase.estado === "trabajando"
                    ? enCurso
                      ? "En curso"
                      : "Interrumpida"
                    : enCurso
                      ? "Pendiente"
                      : "No realizada"}{" "}
                · <span className="break-all">{fase.modelo.identificador}</span>
              </p>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-2">
        <div className="min-w-0">
          <h4 className="mb-3 text-lg font-semibold">Actividad de esta fase</h4>
          {acciones.length ? (
            <ol className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-border p-3">
              {acciones.map((a) => (
                <li key={a.id} className="flex items-start gap-2">
                  {a.estado === "error" ? (
                    <AlertTriangle className="mt-1 size-5 shrink-0 text-warning" />
                  ) : a.estado === "hecho" ? (
                    <CheckCircle2 className="mt-1 size-5 shrink-0 text-success" />
                  ) : (
                    <Clock3 className="mt-1 size-5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p>{a.titulo}</p>
                    {a.ruta ? <p className="break-all text-sm font-medium">{a.ruta}</p> : null}
                    <p className="text-sm text-muted-foreground">
                      {a.estado === "error"
                        ? "La operación devolvió un error"
                        : a.estado === "hecho"
                          ? "Registrado"
                          : enCurso
                            ? "Solicitado; esperando resultado"
                            : "Sin resultado registrado"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              {trabajo.estado === "en_cola"
                ? "La petición está guardada. Aún no se han registrado operaciones."
                : "El servidor todavía no ha registrado operaciones de esta fase."}
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Últimas 15 operaciones disponibles de la fase actual.
          </p>
        </div>
        <div className="min-w-0">
          <h4 className="mb-3 text-lg font-semibold">Archivos preparados</h4>
          {archivos.length ? (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {archivos.map(([ruta, valor]) => (
                <li key={ruta}>
                  <button
                    type="button"
                    aria-pressed={archivo === ruta}
                    onClick={() => setArchivo(archivo === ruta ? null : ruta)}
                    className="flex w-full items-start gap-2 rounded-xl border border-border p-3 text-left hover:border-primary"
                  >
                    <FileCode2 className="mt-1 size-5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block break-all font-medium">{ruta}</span>
                      <span className="text-sm text-muted-foreground">
                        {valor === null ? "Marcado para eliminar" : "Ver código preparado"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Todavía no hay cambios de archivos guardados.
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Son cambios preparados para la entrega. No significan que la aplicación ya esté
            publicada.
          </p>
        </div>
      </div>
      {archivo ? (
        <div className="mt-5 min-w-0 rounded-xl border border-border p-3">
          <h4 className="break-all text-lg font-semibold">{archivo}</h4>
          {contenido === null ? (
            <p className="mt-3">Archivo marcado para eliminar en la entrega.</p>
          ) : (
            <>
              <pre
                tabIndex={0}
                aria-label={`Código preparado de ${archivo}`}
                className="mt-3 max-h-96 overflow-auto rounded-lg bg-background p-3 text-sm leading-relaxed"
              >
                <code>{contenido?.slice(0, 16000)}</code>
              </pre>
              {(contenido?.length ?? 0) > 16000 ? (
                <p className="mt-2 text-sm">
                  Se muestran los primeros 16.000 caracteres. El archivo completo se conserva en la
                  entrega.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <p className="mt-1 break-words text-xl font-bold tabular-nums">{valor}</p>
    </div>
  );
}
