import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Coins, Loader2, Lock, Plus, RefreshCw, Trash2 } from "lucide-react";
import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type {
  AccionPresupuestoIa,
  AmbitoPresupuestoIa,
  GastoIaManualRow,
  PeriodicidadGastoIa,
  PresupuestoIaRow,
  ProveedorGastoIa,
} from "@/lib/nex/db-types";
import { formatoDinero, formatoFecha } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  COLOR_PROVEEDOR,
  ETIQUETA_PROVEEDOR_GASTO,
  PROVEEDORES_GASTO,
  diasDelMes,
  mesActual,
  nombreMes,
  proyeccionMes,
  tonoPresupuesto,
  ultimosMeses,
  useBorrarGastoManual,
  useBorrarPresupuestoIa,
  useEstadoPresupuestos,
  useGastoDiario,
  useGastoIaConfig,
  useGastoPorProveedor,
  useGastoPorProyecto,
  useGastosManuales,
  useGuardarGastoIaConfig,
  useGuardarGastoManual,
  useGuardarPresupuestoIa,
  usePingGastoIa,
  usePresupuestosIa,
  useRealtimeGastoIa,
  useSincronizarGastoIa,
} from "@/lib/nex/queries/gasto-ia";

export const Route = createFileRoute("/gasto-ia")({
  head: () => ({
    meta: [
      { title: "Gasto de IA · NexDeveloper" },
      {
        name: "description",
        content: "Control del gasto real de inteligencia artificial por proveedor y proyecto, con presupuestos y avisos.",
      },
      { property: "og:title", content: "Gasto de IA · NexDeveloper" },
      {
        property: "og:description",
        content: "Control del gasto real de inteligencia artificial por proveedor y proyecto, con presupuestos y avisos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaGastoIa,
});

const ETIQUETA_AMBITO: Record<AmbitoPresupuestoIa, string> = {
  global: "Global",
  proveedor: "Por proveedor",
  proyecto: "Por proyecto",
};

const TONO_BARRA = {
  ok: "bg-success",
  aviso: "bg-warning",
  error: "bg-destructive",
} as const;

function Barra({ pct, tono }: { pct: number; tono: "ok" | "aviso" | "error" }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-[width] ${TONO_BARRA[tono]}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

function Cifra({ titulo, valor, pie }: { titulo: string; valor: React.ReactNode; pie?: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 font-display text-xl font-semibold">{valor}</p>
      {pie ? <div className="mt-1 text-xs text-muted-foreground">{pie}</div> : null}
    </div>
  );
}

function PantallaGastoIa() {
  const [mes, setMes] = React.useState(mesActual());
  const [pestana, setPestana] = React.useState<"resumen" | "presupuestos" | "manuales" | "config">("resumen");
  useRealtimeGastoIa();

  const { data: diario = [] } = useGastoDiario(mes);
  const { data: porProveedor = [] } = useGastoPorProveedor(mes);
  const { data: porProyecto = [] } = useGastoPorProyecto(mes);
  const { data: estados = [] } = useEstadoPresupuestos();
  const { data: ping } = usePingGastoIa();
  const sincronizar = useSincronizarGastoIa();

  const gastoMes = porProveedor.reduce((t, p) => t + Number(p.coste ?? 0), 0);
  const tokens = porProveedor.reduce((t, p) => t + Number(p.tokens ?? 0), 0);
  const llamadas = porProveedor.reduce((t, p) => t + Number(p.llamadas ?? 0), 0);
  const hayReal = porProveedor.some((p) => p.real_facturado);
  const global = estados.find((e) => e.ambito === "global");
  const pctGlobal = global && global.limite_mensual > 0 ? (global.gastado_mes / global.limite_mensual) * 100 : 0;
  const bloqueados = estados.filter((e) => e.bloqueado);
  const proyeccion = proyeccionMes(mes, gastoMes);

  // Barras apiladas por día y proveedor
  const proveedoresPresentes = Array.from(new Set(diario.map((d) => d.proveedor))) as ProveedorGastoIa[];
  const porDia = React.useMemo(() => {
    const mapa = new Map<string, Record<string, number | string>>();
    for (let d = 1; d <= diasDelMes(mes); d += 1) {
      const fecha = `${mes}-${String(d).padStart(2, "0")}`;
      mapa.set(fecha, { dia: String(d) });
    }
    for (const fila of diario) {
      const punto = mapa.get(fila.fecha);
      if (!punto) continue;
      punto[fila.proveedor] = Number(punto[fila.proveedor] ?? 0) + Number(fila.coste ?? 0);
    }
    return Array.from(mapa.values());
  }, [diario, mes]);

  const donut = porProveedor
    .filter((p) => Number(p.coste ?? 0) > 0)
    .map((p) => ({ nombre: ETIQUETA_PROVEEDOR_GASTO[p.proveedor] ?? p.proveedor, valor: Number(p.coste), clave: p.proveedor }));

  const topProyectos = [...porProyecto]
    .sort((a, b) => Number(b.coste ?? 0) - Number(a.coste ?? 0))
    .slice(0, 10)
    .map((p) => ({ nombre: p.proyecto ?? "Sin proyecto", coste: Number(p.coste ?? 0) }));

  const lanzarSincronizacion = async () => {
    try {
      const r = await sincronizar.mutateAsync();
      toast.success(`Sincronizado: ${r.agregados ?? 0} días agregados, ${r.avisos ?? 0} avisos.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <>
      <Encabezado
        titulo="Gasto de IA"
        descripcion="Cuánto cuesta cada proveedor y cada proyecto, con presupuestos mensuales y avisos automáticos."
        acciones={
          <>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              aria-label="Mes"
              className="rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground"
            >
              {ultimosMeses().map((m) => (
                <option key={m} value={m}>
                  {nombreMes(m)}
                </option>
              ))}
            </select>
            <Boton onClick={() => void lanzarSincronizacion()} disabled={sincronizar.isPending}>
              {sincronizar.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Sincronizar ahora
            </Boton>
          </>
        }
      />

      {sincronizar.isError ? (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(sincronizar.error as Error).message}
        </p>
      ) : null}
      {sincronizar.isSuccess ? (
        <p className="mb-4 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          Última sincronización correcta.
        </p>
      ) : null}

      {bloqueados.length > 0 ? (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <Lock className="size-4" />
          Hay {bloqueados.length} presupuesto{bloqueados.length === 1 ? "" : "s"} bloqueado
          {bloqueados.length === 1 ? "" : "s"}: los trabajos de IA afectados no se lanzarán.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Cifra
          titulo="Gasto del mes"
          valor={formatoDinero(gastoMes)}
          pie={
            hayReal ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-success">
                Real facturado
              </span>
            ) : (
              "Estimado a partir de los tokens"
            )
          }
        />
        <Cifra titulo="Tokens" valor={tokens.toLocaleString("es-ES")} />
        <Cifra titulo="Llamadas" valor={llamadas.toLocaleString("es-ES")} />
        <div className="panel p-4">
          <p className="text-xs text-muted-foreground">Presupuesto global</p>
          <p className="mt-1 font-display text-xl font-semibold">
            {global ? `${formatoDinero(global.gastado_mes)} de ${formatoDinero(global.limite_mensual)}` : "Sin definir"}
          </p>
          {global ? (
            <div className="mt-2">
              <Barra pct={pctGlobal} tono={tonoPresupuesto(pctGlobal, global.aviso_pct)} />
              <p className="mt-1 text-xs text-muted-foreground">{Math.round(pctGlobal)} % consumido</p>
            </div>
          ) : null}
        </div>
        <Cifra titulo="Proyección a fin de mes" valor={formatoDinero(proyeccion)} pie="Al ritmo actual" />
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["resumen", "Resumen"],
            ["presupuestos", "Presupuestos"],
            ["manuales", "Gastos manuales y suscripciones"],
            ["config", "Configuración"],
          ] as const
        ).map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            onClick={() => setPestana(clave)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              pestana === clave
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {pestana === "resumen" ? (
        <section className="mt-4 space-y-4">
          <div className="panel p-4">
            <h2 className="font-display text-sm font-semibold">Gasto por día y proveedor</h2>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip
                    formatter={(v: number, n: string) => [formatoDinero(Number(v)), ETIQUETA_PROVEEDOR_GASTO[n as ProveedorGastoIa] ?? n]}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  {proveedoresPresentes.map((p) => (
                    <Bar key={p} dataKey={p} stackId="gasto" fill={COLOR_PROVEEDOR[p] ?? COLOR_PROVEEDOR.otro} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel p-4">
              <h2 className="font-display text-sm font-semibold">Reparto por proveedor</h2>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donut} dataKey="valor" nameKey="nombre" innerRadius={55} outerRadius={90}>
                      {donut.map((d) => (
                        <Cell key={d.clave} fill={COLOR_PROVEEDOR[d.clave as ProveedorGastoIa] ?? COLOR_PROVEEDOR.otro} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v: number) => formatoDinero(Number(v))}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel p-4">
              <h2 className="font-display text-sm font-semibold">Gasto por proyecto</h2>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProyectos} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis type="category" dataKey="nombre" width={120} tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip
                      formatter={(v: number) => formatoDinero(Number(v))}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="coste" fill="hsl(var(--primary))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel overflow-x-auto p-4">
              <h2 className="font-display text-sm font-semibold">Por proveedor</h2>
              <table className="mt-3 w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1.5 text-left">Proveedor</th>
                    <th className="text-right">Coste</th>
                    <th className="text-right">Tokens</th>
                    <th className="text-right">Llamadas</th>
                    <th className="text-right">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {porProveedor.map((p) => (
                    <tr key={p.proveedor} className="border-t border-border">
                      <td className="py-1.5">{ETIQUETA_PROVEEDOR_GASTO[p.proveedor] ?? p.proveedor}</td>
                      <td className="text-right">{formatoDinero(Number(p.coste ?? 0))}</td>
                      <td className="text-right">{Number(p.tokens ?? 0).toLocaleString("es-ES")}</td>
                      <td className="text-right">{Number(p.llamadas ?? 0).toLocaleString("es-ES")}</td>
                      <td className="text-right text-xs">
                        {p.real_facturado ? <span className="text-success">Real</span> : "Estimado"}
                      </td>
                    </tr>
                  ))}
                  {porProveedor.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-muted-foreground">
                        Sin gasto registrado este mes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="panel overflow-x-auto p-4">
              <h2 className="font-display text-sm font-semibold">Por proyecto</h2>
              <table className="mt-3 w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1.5 text-left">Proyecto</th>
                    <th className="text-right">Coste</th>
                    <th className="text-right">Tokens</th>
                    <th className="text-right">Llamadas</th>
                  </tr>
                </thead>
                <tbody>
                  {porProyecto.map((p) => (
                    <tr key={p.proyecto_id ?? "sin"} className="border-t border-border">
                      <td className="py-1.5">{p.proyecto ?? "Sin proyecto"}</td>
                      <td className="text-right">{formatoDinero(Number(p.coste ?? 0))}</td>
                      <td className="text-right">{Number(p.tokens ?? 0).toLocaleString("es-ES")}</td>
                      <td className="text-right">{Number(p.llamadas ?? 0).toLocaleString("es-ES")}</td>
                    </tr>
                  ))}
                  {porProyecto.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-muted-foreground">
                        Sin gasto por proyecto este mes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {pestana === "presupuestos" ? <PestanaPresupuestos estados={estados} /> : null}
      {pestana === "manuales" ? <PestanaManuales mes={mes} /> : null}
      {pestana === "config" ? (
        <PestanaConfig anthropic={Boolean(ping?.anthropic_admin)} openai={Boolean(ping?.openai_admin)} />
      ) : null}
    </>
  );
}

function PestanaPresupuestos({ estados }: { estados: { presupuesto_id: string; gastado_mes: number }[] }) {
  const { data: presupuestos = [] } = usePresupuestosIa();
  const { data: proyectos = [] } = useProyectos();
  const guardar = useGuardarPresupuestoIa();
  const borrar = useBorrarPresupuestoIa();
  const [editando, setEditando] = React.useState<PresupuestoIaRow | "nuevo" | null>(null);

  const gastadoDe = (id: string) => estados.find((e) => e.presupuesto_id === id)?.gastado_mes ?? 0;
  const nombreProyecto = (id: string | null) => proyectos.find((p) => p.id === id)?.nombre ?? "Proyecto";

  const referenciaLegible = (p: PresupuestoIaRow) =>
    p.ambito === "global"
      ? "Todos los proveedores y proyectos"
      : p.ambito === "proveedor"
        ? (ETIQUETA_PROVEEDOR_GASTO[p.referencia as ProveedorGastoIa] ?? p.referencia ?? "Proveedor")
        : nombreProyecto(p.referencia);

  return (
    <section className="mt-4 space-y-4">
      <div className="flex justify-end">
        <Boton onClick={() => setEditando("nuevo")}>
          <Plus className="size-4" />
          Nuevo presupuesto
        </Boton>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {presupuestos.map((p) => {
          const gastado = gastadoDe(p.id);
          const pct = p.limite_mensual > 0 ? (gastado / p.limite_mensual) * 100 : 0;
          const tono = tonoPresupuesto(pct, p.aviso_pct);
          return (
            <div key={p.id} className="panel p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-sm font-semibold">{ETIQUETA_AMBITO[p.ambito]}</p>
                  <p className="text-xs text-muted-foreground">{referenciaLegible(p)}</p>
                </div>
                {p.bloqueado ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                    <Lock className="size-3" /> Bloqueado
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm">
                {formatoDinero(gastado)} de {formatoDinero(p.limite_mensual)}{" "}
                <span className="text-muted-foreground">({Math.round(pct)} %)</span>
              </p>
              <Barra pct={pct} tono={tono} />
              <p className="mt-2 text-xs text-muted-foreground">
                Avisa al {p.aviso_pct} % · {p.accion === "bloquear" ? "Bloquea el gasto" : "Solo avisa"} ·{" "}
                {p.activo ? "Activo" : "Desactivado"}
              </p>
              <div className="mt-3 flex gap-2">
                <Boton variante="suave" onClick={() => setEditando(p)}>
                  Editar
                </Boton>
                <Boton
                  variante="peligro"
                  onClick={() => {
                    borrar.mutate(p.id, {
                      onSuccess: () => toast.success("Presupuesto borrado."),
                      onError: (e) => toast.error((e as Error).message),
                    });
                  }}
                >
                  <Trash2 className="size-4" />
                </Boton>
              </div>
            </div>
          );
        })}
        {presupuestos.length === 0 && (
          <p className="panel p-6 text-sm text-muted-foreground">Todavía no hay presupuestos definidos.</p>
        )}
      </div>

      <DialogoPresupuesto
        valor={editando}
        onCerrar={() => setEditando(null)}
        onGuardar={async (cambios, id) => {
          try {
            await guardar.mutateAsync(id ? { id, cambios } : { cambios });
            toast.success("Presupuesto guardado.");
            setEditando(null);
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
      />
    </section>
  );
}

function DialogoPresupuesto({
  valor,
  onCerrar,
  onGuardar,
}: {
  valor: PresupuestoIaRow | "nuevo" | null;
  onCerrar: () => void;
  onGuardar: (cambios: Partial<Omit<PresupuestoIaRow, "user_id" | "id">>, id?: string) => void | Promise<void>;
}) {
  const { data: proyectos = [] } = useProyectos();
  const existente = valor && valor !== "nuevo" ? valor : null;
  const [ambito, setAmbito] = React.useState<AmbitoPresupuestoIa>("global");
  const [referencia, setReferencia] = React.useState("");
  const [limite, setLimite] = React.useState("100");
  const [aviso, setAviso] = React.useState("80");
  const [accion, setAccion] = React.useState<AccionPresupuestoIa>("avisar");
  const [activo, setActivo] = React.useState(true);

  React.useEffect(() => {
    if (!valor) return;
    setAmbito(existente?.ambito ?? "global");
    setReferencia(existente?.referencia ?? "");
    setLimite(String(existente?.limite_mensual ?? 100));
    setAviso(String(existente?.aviso_pct ?? 80));
    setAccion(existente?.accion ?? "avisar");
    setActivo(existente?.activo ?? true);
  }, [valor, existente]);

  return (
    <Dialogo
      abierto={Boolean(valor)}
      titulo={existente ? "Editar presupuesto" : "Nuevo presupuesto"}
      descripcion="Define cuánto puedes gastar al mes y qué debe pasar cuando se acerque al límite."
      onCerrar={onCerrar}
      ancho="max-w-xl"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Ámbito">
          <select
            className={claseCampo}
            value={ambito}
            onChange={(e) => {
              setAmbito(e.target.value as AmbitoPresupuestoIa);
              setReferencia("");
            }}
          >
            <option value="global">Global</option>
            <option value="proveedor">Por proveedor</option>
            <option value="proyecto">Por proyecto</option>
          </select>
        </Campo>
        {ambito === "proveedor" ? (
          <Campo etiqueta="Proveedor">
            <select className={claseCampo} value={referencia} onChange={(e) => setReferencia(e.target.value)}>
              <option value="">Elige un proveedor</option>
              {PROVEEDORES_GASTO.map((p) => (
                <option key={p} value={p}>
                  {ETIQUETA_PROVEEDOR_GASTO[p]}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
        {ambito === "proyecto" ? (
          <Campo etiqueta="Proyecto">
            <select className={claseCampo} value={referencia} onChange={(e) => setReferencia(e.target.value)}>
              <option value="">Elige un proyecto</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
        <Campo etiqueta="Límite mensual (€)">
          <input className={claseCampo} inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)} />
        </Campo>
        <Campo etiqueta="Avisar al (%)">
          <input className={claseCampo} inputMode="numeric" value={aviso} onChange={(e) => setAviso(e.target.value)} />
        </Campo>
        <Campo etiqueta="Cuando se supera">
          <select className={claseCampo} value={accion} onChange={(e) => setAccion(e.target.value as AccionPresupuestoIa)}>
            <option value="avisar">Solo avisar</option>
            <option value="bloquear">Bloquear los trabajos de IA</option>
          </select>
        </Campo>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Activo
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Boton variante="suave" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton
          onClick={() =>
            void onGuardar(
              {
                ambito,
                referencia: ambito === "global" ? null : referencia || null,
                limite_mensual: Number(limite.replace(",", ".")) || 0,
                aviso_pct: Number(aviso) || 80,
                accion,
                activo,
              },
              existente?.id,
            )
          }
        >
          Guardar
        </Boton>
      </div>
    </Dialogo>
  );
}

function PestanaManuales({ mes }: { mes: string }) {
  const { data: gastos = [] } = useGastosManuales();
  const { data: proyectos = [] } = useProyectos();
  const guardar = useGuardarGastoManual();
  const borrar = useBorrarGastoManual();
  const [abierto, setAbierto] = React.useState(false);
  const [editando, setEditando] = React.useState<GastoIaManualRow | null>(null);

  const delMes = gastos.filter((g) => g.fecha.startsWith(mes) || g.periodicidad === "mensual");
  const totalMes = delMes.reduce((t, g) => t + Number(g.importe ?? 0), 0);

  return (
    <section className="mt-4 space-y-4">
      <div className="flex justify-end">
        <Boton
          onClick={() => {
            setEditando(null);
            setAbierto(true);
          }}
        >
          <Plus className="size-4" />
          Añadir gasto
        </Boton>
      </div>

      <div className="panel overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1.5 text-left">Fecha</th>
              <th className="text-left">Proveedor</th>
              <th className="text-left">Concepto</th>
              <th className="text-left">Proyecto</th>
              <th className="text-right">Créditos</th>
              <th className="text-right">Importe</th>
              <th className="text-left">Tipo</th>
              <th className="text-left">Notas</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id} className="border-t border-border">
                <td className="py-1.5">{formatoFecha(g.fecha)}</td>
                <td>{ETIQUETA_PROVEEDOR_GASTO[g.proveedor] ?? g.proveedor}</td>
                <td>
                  <button type="button" className="text-primary hover:underline" onClick={() => { setEditando(g); setAbierto(true); }}>
                    {g.concepto}
                  </button>
                </td>
                <td>{proyectos.find((p) => p.id === g.proyecto_id)?.nombre ?? "—"}</td>
                <td className="text-right">{Number(g.creditos ?? 0).toLocaleString("es-ES")}</td>
                <td className="text-right">{formatoDinero(Number(g.importe ?? 0))}</td>
                <td>{g.periodicidad === "mensual" ? "Suscripción" : "Puntual"}</td>
                <td className="max-w-48 truncate text-muted-foreground">{g.notas ?? ""}</td>
                <td className="text-right">
                  <button
                    type="button"
                    aria-label="Borrar"
                    className="text-muted-foreground transition hover:text-destructive"
                    onClick={() =>
                      borrar.mutate(g.id, {
                        onSuccess: () => toast.success("Gasto borrado."),
                        onError: (e) => toast.error((e as Error).message),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {gastos.length === 0 && (
              <tr>
                <td colSpan={9} className="py-3 text-muted-foreground">
                  Todavía no has apuntado ningún gasto manual.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border text-sm font-medium">
              <td className="py-2" colSpan={5}>
                Total del mes (incluye suscripciones)
              </td>
              <td className="text-right">{formatoDinero(totalMes)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      <DialogoGastoManual
        abierto={abierto}
        gasto={editando}
        onCerrar={() => setAbierto(false)}
        onGuardar={async (cambios, id) => {
          try {
            await guardar.mutateAsync(id ? { id, cambios } : { cambios });
            toast.success("Gasto guardado.");
            setAbierto(false);
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
      />
    </section>
  );
}

function DialogoGastoManual({
  abierto,
  gasto,
  onCerrar,
  onGuardar,
}: {
  abierto: boolean;
  gasto: GastoIaManualRow | null;
  onCerrar: () => void;
  onGuardar: (
    cambios: Partial<Omit<GastoIaManualRow, "user_id" | "id">> & {
      fecha: string;
      proveedor: ProveedorGastoIa;
      concepto: string;
    },
    id?: string,
  ) => void | Promise<void>;
}) {
  const { data: proyectos = [] } = useProyectos();
  const [fecha, setFecha] = React.useState(new Date().toISOString().slice(0, 10));
  const [proveedor, setProveedor] = React.useState<ProveedorGastoIa>("otro");
  const [concepto, setConcepto] = React.useState("");
  const [proyectoId, setProyectoId] = React.useState("");
  const [creditos, setCreditos] = React.useState("0");
  const [importe, setImporte] = React.useState("0");
  const [periodicidad, setPeriodicidad] = React.useState<PeriodicidadGastoIa>("unico");
  const [notas, setNotas] = React.useState("");

  React.useEffect(() => {
    if (!abierto) return;
    setFecha(gasto?.fecha ?? new Date().toISOString().slice(0, 10));
    setProveedor(gasto?.proveedor ?? "otro");
    setConcepto(gasto?.concepto ?? "");
    setProyectoId(gasto?.proyecto_id ?? "");
    setCreditos(String(gasto?.creditos ?? 0));
    setImporte(String(gasto?.importe ?? 0));
    setPeriodicidad(gasto?.periodicidad ?? "unico");
    setNotas(gasto?.notas ?? "");
  }, [abierto, gasto]);

  return (
    <Dialogo
      abierto={abierto}
      titulo={gasto ? "Editar gasto" : "Nuevo gasto"}
      descripcion="Apunta créditos comprados, suscripciones y cualquier gasto que no llegue por sí solo."
      onCerrar={onCerrar}
      ancho="max-w-2xl"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Fecha">
          <input type="date" className={claseCampo} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        <Campo etiqueta="Proveedor">
          <select className={claseCampo} value={proveedor} onChange={(e) => setProveedor(e.target.value as ProveedorGastoIa)}>
            {PROVEEDORES_GASTO.map((p) => (
              <option key={p} value={p}>
                {ETIQUETA_PROVEEDOR_GASTO[p]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Concepto">
          <input className={claseCampo} value={concepto} onChange={(e) => setConcepto(e.target.value)} />
        </Campo>
        <Campo etiqueta="Proyecto">
          <select className={claseCampo} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
            <option value="">Sin proyecto</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Créditos">
          <input className={claseCampo} inputMode="decimal" value={creditos} onChange={(e) => setCreditos(e.target.value)} />
        </Campo>
        <Campo etiqueta="Importe (€)">
          <input className={claseCampo} inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} />
        </Campo>
        <Campo etiqueta="Periodicidad">
          <select
            className={claseCampo}
            value={periodicidad}
            onChange={(e) => setPeriodicidad(e.target.value as PeriodicidadGastoIa)}
          >
            <option value="unico">Gasto puntual</option>
            <option value="mensual">Suscripción mensual</option>
          </select>
        </Campo>
        <Campo etiqueta="Notas">
          <input className={claseCampo} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Campo>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Boton variante="suave" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton
          disabled={!concepto.trim()}
          onClick={() =>
            void onGuardar(
              {
                fecha,
                proveedor,
                concepto: concepto.trim(),
                proyecto_id: proyectoId || null,
                creditos: Number(creditos.replace(",", ".")) || 0,
                importe: Number(importe.replace(",", ".")) || 0,
                periodicidad,
                notas: notas.trim() || null,
              },
              gasto?.id,
            )
          }
        >
          Guardar
        </Boton>
      </div>
    </Dialogo>
  );
}

function PestanaConfig({ anthropic, openai }: { anthropic: boolean; openai: boolean }) {
  const { data: config } = useGastoIaConfig();
  const guardar = useGuardarGastoIaConfig();
  const [cambio, setCambio] = React.useState("");
  const [credito, setCredito] = React.useState("");

  React.useEffect(() => {
    if (!config) return;
    setCambio(String(config.tipo_cambio_usd ?? ""));
    setCredito(config.precio_credito_lovable === null ? "" : String(config.precio_credito_lovable));
  }, [config]);

  return (
    <section className="mt-4 space-y-4">
      {!anthropic || !openai ? (
        <div className="panel border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Para ver el coste real facturado, pon ANTHROPIC_ADMIN_KEY / OPENAI_ADMIN_KEY en los secretos de Supabase
            (Edge Functions → Secrets). Hasta entonces las cifras son estimadas a partir de los tokens y los precios del
            catálogo.
          </p>
        </div>
      ) : null}

      <div className="panel p-4">
        <h2 className="font-display text-sm font-semibold">Conversión y precios</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Tipo de cambio $ → € (euros por dólar)" pista="Se usa para convertir el coste de los proveedores en dólares.">
            <input className={claseCampo} inputMode="decimal" value={cambio} onChange={(e) => setCambio(e.target.value)} />
          </Campo>
          <Campo etiqueta="Precio del crédito (€ por crédito)" pista="Déjalo vacío si no compras créditos.">
            <input className={claseCampo} inputMode="decimal" value={credito} onChange={(e) => setCredito(e.target.value)} />
          </Campo>
        </div>
        <div className="mt-4">
          <Boton
            disabled={!config || guardar.isPending}
            onClick={() => {
              if (!config) return;
              guardar.mutate(
                {
                  id: config.id,
                  cambios: {
                    tipo_cambio_usd: Number(cambio.replace(",", ".")) || 0,
                    precio_credito_lovable: credito.trim() ? Number(credito.replace(",", ".")) : null,
                  },
                },
                {
                  onSuccess: () => toast.success("Configuración guardada."),
                  onError: (e) => toast.error((e as Error).message),
                },
              );
            }}
          >
            Guardar configuración
          </Boton>
        </div>
      </div>

      <div className="panel p-4 text-sm text-muted-foreground">
        <h2 className="font-display text-sm font-semibold text-foreground">Coste real facturado</h2>
        <ul className="mt-2 space-y-1">
          <li>Anthropic: {anthropic ? "clave de administración configurada" : "sin clave de administración"}</li>
          <li>OpenAI: {openai ? "clave de administración configurada" : "sin clave de administración"}</li>
        </ul>
      </div>
    </section>
  );
}

/** Tarjeta de Inicio con el gasto del mes, el presupuesto global y la proyección. */
export function TarjetaGastoIa() {
  const mes = mesActual();
  const { data: porProveedor = [] } = useGastoPorProveedor(mes);
  const { data: estados = [] } = useEstadoPresupuestos();
  const gasto = porProveedor.reduce((t, p) => t + Number(p.coste ?? 0), 0);
  const global = estados.find((e) => e.ambito === "global");
  const pct = global && global.limite_mensual > 0 ? (global.gastado_mes / global.limite_mensual) * 100 : 0;
  const alerta = estados.some((e) => e.bloqueado || (e.limite_mensual > 0 && e.gastado_mes >= e.limite_mensual));
  const tono = global ? tonoPresupuesto(pct, global.aviso_pct) : "ok";

  return (
    <div className={`panel p-4 ${alerta ? "border-destructive/40" : ""}`}>
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
        <Coins className="size-4" />
        Gasto de IA
      </h2>
      <p className="mt-2 text-lg font-semibold">{formatoDinero(gasto)}</p>
      {global ? (
        <div className="mt-2">
          <Barra pct={pct} tono={alerta ? "error" : tono} />
          <p className="mt-1 text-xs text-muted-foreground">
            {Math.round(pct)} % de {formatoDinero(global.limite_mensual)} este mes
          </p>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">Sin presupuesto global definido.</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Proyección a fin de mes: {formatoDinero(proyeccionMes(mes, gasto))}
      </p>
      {alerta ? <p className="mt-2 text-xs text-destructive">Hay presupuestos superados o bloqueados.</p> : null}
      <Link to="/gasto-ia" className="mt-3 inline-flex text-xs text-primary hover:underline">
        Ver el gasto de IA
      </Link>
    </div>
  );
}

/** Chip con el gasto de IA del mes de un proyecto. */
export function ChipGastoIa({ proyectoId }: { proyectoId: string }) {
  const { data: porProyecto = [] } = useGastoPorProyecto(mesActual());
  const fila = porProyecto.find((p) => p.proyecto_id === proyectoId);
  if (!fila || Number(fila.coste ?? 0) <= 0) return null;
  return (
    <Link
      to="/gasto-ia"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-muted-foreground transition hover:opacity-80"
    >
      <Coins className="size-3" />
      {formatoDinero(Number(fila.coste))} de IA este mes
    </Link>
  );
}
