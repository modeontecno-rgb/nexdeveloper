import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ExternalLink,
  Eye,
  FileText,
  Pencil,
  Play,
  Plus,
  Printer,
  Receipt,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, Selector, claseCampo } from "@/components/nex/campos";
import { BotonCronometroProyecto } from "@/components/nex/cronometro";
import { Dialogo } from "@/components/nex/dialogo";
import type {
  ContratoCliente,
  EstadoFactura,
  FacturaRow,
  FacturacionClienteRow,
  HoraRegistroRow,
  LineaFactura,
  ProyectoRow,
} from "@/lib/nex/db-types";
import { formatoDinero, formatoFecha } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  CONTRATOS,
  ESTADOS_FACTURA,
  ETIQUETA_CONTRATO,
  ETIQUETA_ESTADO_FACTURA,
  ETIQUETA_ORIGEN_HORAS,
  EXPLICACION_CONTRATO,
  TONO_ESTADO_FACTURA,
  TONO_ORIGEN_HORAS,
  estaVencida,
  formatoHoras,
  imprimirFactura,
  mesActualFacturacion,
  nombreMesFacturacion,
  transcurrido,
  ultimosMesesFacturacion,
  useActualizarBorrador,
  useActualizarHoras,
  useBorrarFactura,
  useBorrarHoras,
  useClientesFacturacion,
  useCronometro,
  useEmitirFactura,
  useEnlaceFactura,
  useFactura,
  useFacturacionConfig,
  useFacturas,
  useGenerarFactura,
  useGuardarCliente,
  useGuardarFacturacionConfig,
  useHoras,
  useIniciarCronometro,
  useMarcarFactura,
  usePararCronometro,
  useRealtimeFacturacion,
  useRegistrarHoras,
  useResumenFacturacion,
} from "@/lib/nex/queries/facturacion";

export const Route = createFileRoute("/facturacion")({
  head: () => ({
    meta: [
      { title: "Facturación y horas · NexDeveloper" },
      {
        name: "description",
        content:
          "Registra horas, controla los contratos de cada cliente, emite facturas y mide la rentabilidad de cada proyecto.",
      },
      { property: "og:title", content: "Facturación y horas · NexDeveloper" },
      {
        property: "og:description",
        content:
          "Registra horas, controla los contratos de cada cliente, emite facturas y mide la rentabilidad de cada proyecto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaFacturacion,
});

type Pestana = "resumen" | "horas" | "facturas" | "clientes" | "config";

const PESTANAS: { valor: Pestana; texto: string }[] = [
  { valor: "resumen", texto: "Resumen" },
  { valor: "horas", texto: "Horas" },
  { valor: "facturas", texto: "Facturas" },
  { valor: "clientes", texto: "Clientes" },
  { valor: "config", texto: "Configuración" },
];

function Cifra({ titulo, valor, pie, tono }: { titulo: string; valor: React.ReactNode; pie?: React.ReactNode; tono?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`mt-1 font-display text-xl font-semibold ${tono ?? ""}`}>{valor}</p>
      {pie ? <div className="mt-1 text-xs text-muted-foreground">{pie}</div> : null}
    </div>
  );
}

function PantallaFacturacion() {
  const [pestana, setPestana] = React.useState<Pestana>("resumen");
  const [mes, setMes] = React.useState(mesActualFacturacion());
  useRealtimeFacturacion();

  return (
    <div>
      <Encabezado
        titulo="Facturación y horas"
        descripcion="Tiempo dedicado, contratos, facturas y rentabilidad de cada proyecto."
        acciones={
          pestana === "resumen" ? (
            <Selector
              etiqueta="Mes"
              valor={mes}
              onChange={setMes}
              opciones={ultimosMesesFacturacion().map((m) => ({ valor: m, texto: nombreMesFacturacion(m) }))}
            />
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {PESTANAS.map((p) => (
          <button
            key={p.valor}
            type="button"
            onClick={() => setPestana(p.valor)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              pestana === p.valor
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.texto}
          </button>
        ))}
      </div>

      {pestana === "resumen" ? <BloqueResumen mes={mes} /> : null}
      {pestana === "horas" ? <BloqueHoras /> : null}
      {pestana === "facturas" ? <BloqueFacturas /> : null}
      {pestana === "clientes" ? <BloqueClientes /> : null}
      {pestana === "config" ? <BloqueConfiguracion /> : null}
    </div>
  );
}

/* --------------------------------- Resumen -------------------------------- */

function BloqueResumen({ mes }: { mes: string }) {
  const { data: resumen, isPending } = useResumenFacturacion(mes);
  const [generarPara, setGenerarPara] = React.useState<string | null>(null);
  const totales = resumen?.totales;
  const proyectos = resumen?.proyectos ?? [];

  const datosGrafico = proyectos
    .filter((p) => p.facturado > 0 || p.coste_ia > 0)
    .map((p) => ({ nombre: p.nombre, Facturado: p.facturado, "Coste de IA": p.coste_ia }));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cifra titulo="Facturado" valor={formatoDinero(totales?.facturado ?? 0)} pie={nombreMesFacturacion(mes)} />
        <Cifra titulo="Cobrado" valor={formatoDinero(totales?.cobrado ?? 0)} />
        <Cifra
          titulo="Pendiente de cobro"
          valor={formatoDinero(totales?.pendiente_cobro ?? 0)}
          tono={(totales?.vencidas ?? 0) > 0 ? "text-destructive" : undefined}
          pie={
            (totales?.vencidas ?? 0) > 0 ? (
              <span className="text-destructive">{totales?.vencidas} factura(s) vencida(s)</span>
            ) : (
              "Sin vencidas"
            )
          }
        />
        <Cifra titulo="Pendiente de facturar" valor={formatoDinero(totales?.pendiente_facturar ?? 0)} />
        <Cifra
          titulo="Horas del mes"
          valor={formatoHoras(totales?.horas ?? 0)}
          pie={`Sin facturar: ${formatoHoras(totales?.horas_sin_facturar ?? 0)}`}
        />
        <Cifra titulo="Coste de IA" valor={formatoDinero(totales?.coste_ia ?? 0)} />
        <Cifra
          titulo="Margen"
          valor={formatoDinero(totales?.margen ?? 0)}
          tono={(totales?.margen ?? 0) >= 0 ? "text-success" : "text-destructive"}
          pie="Facturado menos coste de IA"
        />
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[68rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3">Proyecto</th>
              <th className="p-3">Contrato</th>
              <th className="p-3 text-right">Horas</th>
              <th className="p-3 text-right">Sin facturar</th>
              <th className="p-3 text-right">Facturado</th>
              <th className="p-3 text-right">Cobrado</th>
              <th className="p-3 text-right">Coste IA</th>
              <th className="p-3 text-right">Margen</th>
              <th className="p-3 text-right">Borradores</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={10} className="p-4 text-muted-foreground">
                  Cargando cifras...
                </td>
              </tr>
            ) : proyectos.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-4 text-muted-foreground">
                  Todavía no hay movimientos este mes.
                </td>
              </tr>
            ) : (
              proyectos.map((p) => (
                <tr key={p.proyecto_id} className="border-b border-border/60 last:border-0">
                  <td className="p-3">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: p.color ?? "hsl(220 9% 60%)" }}
                        aria-hidden
                      />
                      <Link to="/proyectos/$proyectoId" params={{ proyectoId: p.proyecto_id }} className="hover:underline">
                        {p.nombre}
                      </Link>
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{ETIQUETA_CONTRATO[p.contrato] ?? p.contrato}</td>
                  <td className="p-3 text-right tabular-nums">{formatoHoras(p.horas)}</td>
                  <td className="p-3 text-right tabular-nums">{formatoHoras(p.horas_sin_facturar)}</td>
                  <td className="p-3 text-right tabular-nums">{formatoDinero(p.facturado)}</td>
                  <td className="p-3 text-right tabular-nums">{formatoDinero(p.cobrado)}</td>
                  <td className="p-3 text-right tabular-nums">{formatoDinero(p.coste_ia)}</td>
                  <td className={`p-3 text-right tabular-nums ${p.margen >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatoDinero(p.margen)}
                  </td>
                  <td className="p-3 text-right tabular-nums">{p.borradores || "—"}</td>
                  <td className="p-3 text-right">
                    <Boton variante="suave" onClick={() => setGenerarPara(p.proyecto_id)}>
                      <Receipt className="size-3.5" /> Generar factura
                    </Boton>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="panel p-4">
        <h2 className="font-display text-sm font-semibold">Facturado frente a coste de IA</h2>
        {datosGrafico.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Sin datos suficientes para el gráfico.</p>
        ) : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatoDinero(Number(v))} />
                <Legend />
                <Bar dataKey="Facturado" fill="hsl(158 64% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Coste de IA" fill="hsl(24 90% 58%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <DialogoNuevaFactura
        proyectoId={generarPara}
        abierto={Boolean(generarPara)}
        onCerrar={() => setGenerarPara(null)}
      />
    </div>
  );
}

/* ---------------------------------- Horas --------------------------------- */

function BloqueHoras() {
  const { data: proyectos = [] } = useProyectos();
  const [filtroProyecto, setFiltroProyecto] = React.useState("todos");
  const [desde, setDesde] = React.useState("");
  const [hasta, setHasta] = React.useState("");
  const [soloSinFacturar, setSoloSinFacturar] = React.useState(false);
  const [nuevo, setNuevo] = React.useState(false);
  const [borrando, setBorrando] = React.useState<HoraRegistroRow | null>(null);

  const filtro = {
    ...(filtroProyecto !== "todos" ? { proyecto_id: filtroProyecto } : {}),
    ...(desde ? { desde } : {}),
    ...(hasta ? { hasta } : {}),
    ...(soloSinFacturar ? { sin_facturar: true } : {}),
    limite: 500,
  };
  const { data: horas = [], isPending } = useHoras(filtro);
  const actualizar = useActualizarHoras();
  const borrar = useBorrarHoras();

  const total = horas.reduce((t, h) => t + Number(h.horas ?? 0), 0);

  const guardar = async (id: string, cambios: Partial<HoraRegistroRow>) => {
    try {
      await actualizar.mutateAsync({ id, ...cambios });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <CronometroPanel />

      <div className="panel flex flex-wrap items-end gap-3 p-4">
        <Selector
          etiqueta="Proyecto"
          valor={filtroProyecto}
          onChange={setFiltroProyecto}
          opciones={[{ valor: "todos", texto: "Todos" }, ...proyectos.map((p) => ({ valor: p.id, texto: p.nombre }))]}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={claseCampo} />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={claseCampo} />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={soloSinFacturar}
            onChange={(e) => setSoloSinFacturar(e.target.checked)}
          />
          Solo sin facturar
        </label>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Total: {formatoHoras(total)}</span>
          <Boton onClick={() => setNuevo(true)}>
            <Plus className="size-3.5" /> Añadir horas
          </Boton>
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[60rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3">Fecha</th>
              <th className="p-3">Proyecto</th>
              <th className="p-3">Descripción</th>
              <th className="p-3">Origen</th>
              <th className="p-3 text-right">Horas</th>
              <th className="p-3">Facturable</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={7} className="p-4 text-muted-foreground">
                  Cargando horas...
                </td>
              </tr>
            ) : horas.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-muted-foreground">
                  No hay horas registradas con estos filtros.
                </td>
              </tr>
            ) : (
              horas.map((h) => {
                const bloqueada = Boolean(h.factura_id);
                const proyecto = proyectos.find((p) => p.id === h.proyecto_id);
                return (
                  <tr key={h.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3">
                      {bloqueada ? (
                        formatoFecha(h.fecha)
                      ) : (
                        <input
                          type="date"
                          defaultValue={h.fecha?.slice(0, 10)}
                          onBlur={(e) => e.target.value !== h.fecha?.slice(0, 10) && guardar(h.id, { fecha: e.target.value })}
                          className="rounded-md border border-input bg-surface px-2 py-1 text-sm"
                        />
                      )}
                    </td>
                    <td className="p-3">{proyecto?.nombre ?? "—"}</td>
                    <td className="p-3">
                      {bloqueada ? (
                        <span className="text-muted-foreground">{h.descripcion ?? "—"}</span>
                      ) : (
                        <input
                          defaultValue={h.descripcion ?? ""}
                          placeholder="Sin descripción"
                          onBlur={(e) =>
                            e.target.value !== (h.descripcion ?? "") && guardar(h.id, { descripcion: e.target.value })
                          }
                          className="w-full rounded-md border border-input bg-surface px-2 py-1 text-sm"
                        />
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${TONO_ORIGEN_HORAS[h.origen]}`}>
                        {ETIQUETA_ORIGEN_HORAS[h.origen]}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {bloqueada ? (
                        formatoHoras(Number(h.horas))
                      ) : (
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          defaultValue={Number(h.horas)}
                          onBlur={(e) =>
                            Number(e.target.value) !== Number(h.horas) && guardar(h.id, { horas: Number(e.target.value) })
                          }
                          className="w-24 rounded-md border border-input bg-surface px-2 py-1 text-right text-sm"
                        />
                      )}
                    </td>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        disabled={bloqueada}
                        checked={h.facturable}
                        onChange={(e) => guardar(h.id, { facturable: e.target.checked })}
                      />
                    </td>
                    <td className="p-3 text-right">
                      {bloqueada ? (
                        <span className="text-xs text-muted-foreground">Facturada</span>
                      ) : (
                        <button
                          type="button"
                          aria-label="Borrar horas"
                          onClick={() => setBorrando(h)}
                          className="rounded-md p-1.5 text-muted-foreground transition hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PanelNuevasHoras abierto={nuevo} onCerrar={() => setNuevo(false)} />

      <Dialogo
        abierto={Boolean(borrando)}
        titulo="Borrar el registro de horas"
        descripcion="Se eliminará de forma permanente."
        onCerrar={() => setBorrando(null)}
        ancho="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={() => setBorrando(null)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            disabled={borrar.isPending}
            onClick={async () => {
              if (!borrando) return;
              try {
                await borrar.mutateAsync(borrando.id);
                setBorrando(null);
                toast.success("Horas borradas.");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Borrar
          </Boton>
        </div>
      </Dialogo>
    </div>
  );
}

function CronometroPanel() {
  const { data: proyectos = [] } = useProyectos();
  const { data: enMarcha } = useCronometro();
  const iniciar = useIniciarCronometro();
  const parar = usePararCronometro();
  const [proyectoId, setProyectoId] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [, refrescar] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    if (!enMarcha) return;
    const id = window.setInterval(refrescar, 1000);
    return () => window.clearInterval(id);
  }, [enMarcha]);

  React.useEffect(() => {
    if (!proyectoId && proyectos[0]) setProyectoId(proyectos[0].id);
  }, [proyectos, proyectoId]);

  return (
    <div className="panel flex flex-wrap items-end gap-3 p-4">
      {enMarcha?.inicio ? (
        <>
          <div>
            <p className="text-xs text-muted-foreground">
              {proyectos.find((p) => p.id === enMarcha.proyecto_id)?.nombre ?? "Proyecto"}
            </p>
            <p className="font-display text-2xl font-semibold tabular-nums">{transcurrido(enMarcha.inicio)}</p>
          </div>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="¿En qué estás trabajando?"
            className={`${claseCampo} max-w-sm`}
          />
          <Boton
            variante="peligro"
            disabled={parar.isPending}
            onClick={async () => {
              try {
                await parar.mutateAsync(descripcion || undefined);
                setDescripcion("");
                toast.success("Cronómetro parado y horas registradas.");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Square className="size-3.5" /> Parar
          </Boton>
        </>
      ) : (
        <>
          <Selector
            etiqueta="Proyecto"
            valor={proyectoId}
            onChange={setProyectoId}
            opciones={proyectos.map((p) => ({ valor: p.id, texto: p.nombre }))}
          />
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="¿En qué vas a trabajar?"
            className={`${claseCampo} max-w-sm`}
          />
          <Boton
            disabled={!proyectoId || iniciar.isPending}
            onClick={async () => {
              try {
                await iniciar.mutateAsync({ proyecto_id: proyectoId, descripcion: descripcion || undefined });
                toast.success("Cronómetro en marcha.");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Play className="size-3.5" /> Iniciar cronómetro
          </Boton>
        </>
      )}
    </div>
  );
}

function PanelNuevasHoras({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { data: proyectos = [] } = useProyectos();
  const registrar = useRegistrarHoras();
  const [proyectoId, setProyectoId] = React.useState("");
  const [fecha, setFecha] = React.useState(new Date().toISOString().slice(0, 10));
  const [horas, setHoras] = React.useState("1");
  const [descripcion, setDescripcion] = React.useState("");
  const [facturable, setFacturable] = React.useState(true);

  React.useEffect(() => {
    if (abierto && !proyectoId && proyectos[0]) setProyectoId(proyectos[0].id);
  }, [abierto, proyectos, proyectoId]);

  return (
    <Dialogo abierto={abierto} titulo="Añadir horas" onCerrar={onCerrar} ancho="max-w-lg">
      <div className="space-y-3">
        <Campo etiqueta="Proyecto">
          <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={claseCampo}>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Fecha">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Horas">
            <input
              type="number"
              step="0.25"
              min="0"
              value={horas}
              onChange={(e) => setHoras(e.target.value)}
              className={claseCampo}
            />
          </Campo>
        </div>
        <Campo etiqueta="Descripción">
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={claseCampo} />
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={facturable} onChange={(e) => setFacturable(e.target.checked)} />
          Facturable
        </label>
        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            disabled={!proyectoId || registrar.isPending}
            onClick={async () => {
              try {
                await registrar.mutateAsync({
                  proyecto_id: proyectoId,
                  fecha,
                  horas: Number(horas),
                  descripcion: descripcion || undefined,
                  facturable,
                });
                toast.success("Horas registradas.");
                setDescripcion("");
                onCerrar();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Guardar
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

/* -------------------------------- Facturas -------------------------------- */

function BloqueFacturas() {
  const { data: proyectos = [] } = useProyectos();
  const [filtroEstado, setFiltroEstado] = React.useState("todos");
  const [filtroProyecto, setFiltroProyecto] = React.useState("todos");
  const filtro = {
    ...(filtroEstado !== "todos" ? { estado: filtroEstado as EstadoFactura } : {}),
    ...(filtroProyecto !== "todos" ? { proyecto_id: filtroProyecto } : {}),
    limite: 200,
  };
  const { data: facturas = [], isPending } = useFacturas(filtro);

  const [verId, setVerId] = React.useState<string | null>(null);
  const [editarId, setEditarId] = React.useState<string | null>(null);
  const [emitirId, setEmitirId] = React.useState<string | null>(null);
  const [borrarId, setBorrarId] = React.useState<string | null>(null);
  const [nueva, setNueva] = React.useState(false);

  const emitir = useEmitirFactura();
  const marcar = useMarcarFactura();
  const borrar = useBorrarFactura();
  const enlace = useEnlaceFactura();

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-end gap-3 p-4">
        <Selector
          etiqueta="Estado"
          valor={filtroEstado}
          onChange={setFiltroEstado}
          opciones={[
            { valor: "todos", texto: "Todos" },
            ...ESTADOS_FACTURA.map((e) => ({ valor: e, texto: ETIQUETA_ESTADO_FACTURA[e] })),
          ]}
        />
        <Selector
          etiqueta="Proyecto"
          valor={filtroProyecto}
          onChange={setFiltroProyecto}
          opciones={[{ valor: "todos", texto: "Todos" }, ...proyectos.map((p) => ({ valor: p.id, texto: p.nombre }))]}
        />
        <Boton className="ml-auto" onClick={() => setNueva(true)}>
          <Plus className="size-3.5" /> Nueva factura
        </Boton>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[64rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3">Número</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Proyecto</th>
              <th className="p-3">Periodo</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Vencimiento</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={8} className="p-4 text-muted-foreground">
                  Cargando facturas...
                </td>
              </tr>
            ) : facturas.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-muted-foreground">
                  Todavía no hay facturas.
                </td>
              </tr>
            ) : (
              facturas.map((f) => {
                const proyecto = proyectos.find((p) => p.id === f.proyecto_id);
                const vencida = estaVencida(f);
                return (
                  <tr key={f.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3 font-medium">{f.numero ?? "Borrador"}</td>
                    <td className="p-3">{f.cliente?.nombre_fiscal ?? "—"}</td>
                    <td className="p-3">{proyecto?.nombre ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">
                      {f.periodo_desde ? `${formatoFecha(f.periodo_desde)} – ${formatoFecha(f.periodo_hasta)}` : "—"}
                    </td>
                    <td className="p-3 text-right tabular-nums">{formatoDinero(Number(f.total ?? 0), f.moneda || "EUR")}</td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${TONO_ESTADO_FACTURA[f.estado]}`}>
                        {ETIQUETA_ESTADO_FACTURA[f.estado]}
                      </span>
                    </td>
                    <td className={`p-3 ${vencida ? "text-destructive" : "text-muted-foreground"}`}>
                      {f.vence_el ? formatoFecha(f.vence_el) : "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Boton variante="suave" onClick={() => setVerId(f.id)}>
                          <Eye className="size-3.5" /> Ver
                        </Boton>
                        {f.estado === "borrador" ? (
                          <>
                            <Boton variante="suave" onClick={() => setEditarId(f.id)}>
                              <Pencil className="size-3.5" /> Editar
                            </Boton>
                            <Boton onClick={() => setEmitirId(f.id)}>
                              <FileText className="size-3.5" /> Emitir
                            </Boton>
                            <Boton variante="peligro" onClick={() => setBorrarId(f.id)}>
                              <Trash2 className="size-3.5" /> Borrar
                            </Boton>
                          </>
                        ) : (
                          <>
                            {f.estado !== "pagada" && f.estado !== "anulada" ? (
                              <>
                                {f.estado !== "enviada" ? (
                                  <Boton
                                    variante="suave"
                                    onClick={() => marcar.mutate({ id: f.id, estado: "enviada" })}
                                  >
                                    <Send className="size-3.5" /> Enviada
                                  </Boton>
                                ) : null}
                                <Boton
                                  variante="suave"
                                  onClick={() =>
                                    marcar.mutate({
                                      id: f.id,
                                      estado: "pagada",
                                      fecha: new Date().toISOString().slice(0, 10),
                                    })
                                  }
                                >
                                  Pagada
                                </Boton>
                                <Boton variante="peligro" onClick={() => marcar.mutate({ id: f.id, estado: "anulada" })}>
                                  Anular
                                </Boton>
                              </>
                            ) : null}
                            <Boton
                              variante="suave"
                              onClick={async () => {
                                try {
                                  const url = await enlace.mutateAsync(f.id);
                                  if (url) window.open(url, "_blank", "noopener");
                                  else toast.error("Esta factura aún no está en el almacén.");
                                } catch (e) {
                                  toast.error((e as Error).message);
                                }
                              }}
                            >
                              <ExternalLink className="size-3.5" /> Enlace
                            </Boton>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <DialogoVerFactura id={verId} onCerrar={() => setVerId(null)} />
      <DialogoEditarBorrador id={editarId} onCerrar={() => setEditarId(null)} />
      <DialogoNuevaFactura proyectoId={null} abierto={nueva} onCerrar={() => setNueva(false)} />

      <Dialogo
        abierto={Boolean(emitirId)}
        titulo="Emitir la factura"
        descripcion="Se asignará un número correlativo y ya no podrá modificarse. Esta acción no se puede deshacer."
        onCerrar={() => setEmitirId(null)}
        ancho="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={() => setEmitirId(null)}>
            Cancelar
          </Boton>
          <Boton
            disabled={emitir.isPending}
            onClick={async () => {
              if (!emitirId) return;
              try {
                const r = await emitir.mutateAsync(emitirId);
                setEmitirId(null);
                toast.success(`Factura ${r.factura?.numero ?? ""} emitida.`);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Emitir
          </Boton>
        </div>
      </Dialogo>

      <Dialogo
        abierto={Boolean(borrarId)}
        titulo="Borrar el borrador"
        descripcion="Solo se pueden borrar facturas que aún no se han emitido."
        onCerrar={() => setBorrarId(null)}
        ancho="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={() => setBorrarId(null)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            disabled={borrar.isPending}
            onClick={async () => {
              if (!borrarId) return;
              try {
                await borrar.mutateAsync(borrarId);
                setBorrarId(null);
                toast.success("Borrador borrado.");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Borrar
          </Boton>
        </div>
      </Dialogo>
    </div>
  );
}

function DialogoVerFactura({ id, onCerrar }: { id: string | null; onCerrar: () => void }) {
  const { data: factura, isPending } = useFactura(id);
  return (
    <Dialogo
      abierto={Boolean(id)}
      titulo={factura?.numero ? `Factura ${factura.numero}` : "Vista previa de la factura"}
      onCerrar={onCerrar}
      ancho="max-w-4xl"
    >
      {isPending ? (
        <p className="text-sm text-muted-foreground">Cargando la factura...</p>
      ) : !factura?.html ? (
        <p className="text-sm text-muted-foreground">Esta factura todavía no tiene documento imprimible.</p>
      ) : (
        <div className="space-y-3">
          <iframe title="Factura" srcDoc={factura.html} className="h-[65vh] w-full rounded-lg border border-border bg-white" />
          <div className="flex justify-end">
            <Boton
              onClick={() => {
                if (!imprimirFactura(factura.html as string)) {
                  toast.error("El navegador ha bloqueado la ventana de impresión.");
                }
              }}
            >
              <Printer className="size-3.5" /> Descargar PDF
            </Boton>
          </div>
        </div>
      )}
    </Dialogo>
  );
}

const LINEA_VACIA: LineaFactura = {
  tipo: "otro",
  concepto: "",
  detalle: "",
  cantidad: 1,
  unidad: "ud.",
  precio: 0,
  importe: 0,
};

function DialogoEditarBorrador({ id, onCerrar }: { id: string | null; onCerrar: () => void }) {
  const { data: factura } = useFactura(id);
  const actualizar = useActualizarBorrador();
  const [lineas, setLineas] = React.useState<LineaFactura[]>([]);
  const [notas, setNotas] = React.useState("");
  const [ivaPct, setIvaPct] = React.useState(21);
  const [irpfPct, setIrpfPct] = React.useState(0);

  React.useEffect(() => {
    if (!factura) return;
    setLineas((factura.lineas ?? []).map((l) => ({ ...l })));
    setNotas(factura.notas ?? "");
    setIvaPct(Number(factura.iva_pct ?? 21));
    setIrpfPct(Number(factura.irpf_pct ?? 0));
  }, [factura]);

  const base = lineas.reduce((t, l) => t + Number(l.cantidad || 0) * Number(l.precio || 0), 0);
  const iva = (base * ivaPct) / 100;
  const irpf = (base * irpfPct) / 100;

  const cambiar = (i: number, cambios: Partial<LineaFactura>) =>
    setLineas((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        const nueva = { ...l, ...cambios };
        nueva.importe = Number(nueva.cantidad || 0) * Number(nueva.precio || 0);
        return nueva;
      }),
    );

  return (
    <Dialogo abierto={Boolean(id)} titulo="Editar el borrador" onCerrar={onCerrar} ancho="max-w-4xl">
      <div className="space-y-4">
        <div className="space-y-2">
          {lineas.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-12">
              <input
                value={l.concepto}
                placeholder="Concepto"
                onChange={(e) => cambiar(i, { concepto: e.target.value })}
                className={`${claseCampo} sm:col-span-4`}
              />
              <input
                value={l.detalle ?? ""}
                placeholder="Detalle"
                onChange={(e) => cambiar(i, { detalle: e.target.value })}
                className={`${claseCampo} sm:col-span-3`}
              />
              <input
                type="number"
                step="0.01"
                value={l.cantidad}
                onChange={(e) => cambiar(i, { cantidad: Number(e.target.value) })}
                className={`${claseCampo} sm:col-span-1`}
              />
              <input
                value={l.unidad ?? ""}
                placeholder="Unidad"
                onChange={(e) => cambiar(i, { unidad: e.target.value })}
                className={`${claseCampo} sm:col-span-1`}
              />
              <input
                type="number"
                step="0.01"
                value={l.precio}
                onChange={(e) => cambiar(i, { precio: Number(e.target.value) })}
                className={`${claseCampo} sm:col-span-2`}
              />
              <div className="flex items-center justify-between gap-2 sm:col-span-1">
                <span className="text-sm tabular-nums">
                  {formatoDinero(Number(l.cantidad || 0) * Number(l.precio || 0))}
                </span>
                <button
                  type="button"
                  aria-label="Borrar línea"
                  onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                  className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
          <Boton variante="suave" onClick={() => setLineas((prev) => [...prev, { ...LINEA_VACIA }])}>
            <Plus className="size-3.5" /> Añadir línea
          </Boton>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="IVA (%)">
            <input
              type="number"
              value={ivaPct}
              onChange={(e) => setIvaPct(Number(e.target.value))}
              className={claseCampo}
            />
          </Campo>
          <Campo etiqueta="IRPF (%)">
            <input
              type="number"
              value={irpfPct}
              onChange={(e) => setIrpfPct(Number(e.target.value))}
              className={claseCampo}
            />
          </Campo>
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="flex justify-between">
              <span className="text-muted-foreground">Base</span> <span className="tabular-nums">{formatoDinero(base)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">IVA</span> <span className="tabular-nums">{formatoDinero(iva)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">IRPF</span> <span className="tabular-nums">−{formatoDinero(irpf)}</span>
            </p>
            <p className="mt-1 flex justify-between border-t border-border pt-1 font-semibold">
              <span>Total</span> <span className="tabular-nums">{formatoDinero(base + iva - irpf)}</span>
            </p>
          </div>
        </div>

        <Campo etiqueta="Notas">
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className={claseCampo} />
        </Campo>

        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            disabled={!id || actualizar.isPending}
            onClick={async () => {
              if (!id) return;
              try {
                await actualizar.mutateAsync({
                  id,
                  lineas: lineas.map((l) => ({ ...l, importe: Number(l.cantidad || 0) * Number(l.precio || 0) })),
                  notas,
                  iva_pct: ivaPct,
                  irpf_pct: irpfPct,
                });
                toast.success("Borrador guardado.");
                onCerrar();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Guardar
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoNuevaFactura({
  proyectoId,
  abierto,
  onCerrar,
}: {
  proyectoId: string | null;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const { data: proyectos = [] } = useProyectos();
  const generar = useGenerarFactura();
  const [proyecto, setProyecto] = React.useState("");
  const [desde, setDesde] = React.useState("");
  const [hasta, setHasta] = React.useState("");
  const [incluirHoras, setIncluirHoras] = React.useState(true);
  const [incluirIa, setIncluirIa] = React.useState(true);
  const [notas, setNotas] = React.useState("");
  const [extras, setExtras] = React.useState<{ concepto: string; cantidad: number; unidad: string; precio: number }[]>([]);

  React.useEffect(() => {
    if (abierto) setProyecto(proyectoId ?? proyectos[0]?.id ?? "");
  }, [abierto, proyectoId, proyectos]);

  return (
    <Dialogo
      abierto={abierto}
      titulo="Nueva factura"
      descripcion="Si dejas el periodo vacío se usará el mes anterior."
      onCerrar={onCerrar}
      ancho="max-w-2xl"
    >
      <div className="space-y-3">
        <Campo etiqueta="Proyecto">
          <select value={proyecto} onChange={(e) => setProyecto(e.target.value)} className={claseCampo}>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Desde">
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Hasta">
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={claseCampo} />
          </Campo>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={incluirHoras} onChange={(e) => setIncluirHoras(e.target.checked)} />
            Incluir las horas
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={incluirIa} onChange={(e) => setIncluirIa(e.target.checked)} />
            Repercutir el gasto de IA
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Líneas extra</p>
          {extras.map((l, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-12">
              <input
                value={l.concepto}
                placeholder="Concepto"
                onChange={(e) =>
                  setExtras((p) => p.map((x, idx) => (idx === i ? { ...x, concepto: e.target.value } : x)))
                }
                className={`${claseCampo} sm:col-span-6`}
              />
              <input
                type="number"
                step="0.01"
                value={l.cantidad}
                onChange={(e) =>
                  setExtras((p) => p.map((x, idx) => (idx === i ? { ...x, cantidad: Number(e.target.value) } : x)))
                }
                className={`${claseCampo} sm:col-span-2`}
              />
              <input
                type="number"
                step="0.01"
                value={l.precio}
                onChange={(e) =>
                  setExtras((p) => p.map((x, idx) => (idx === i ? { ...x, precio: Number(e.target.value) } : x)))
                }
                className={`${claseCampo} sm:col-span-3`}
              />
              <button
                type="button"
                aria-label="Quitar línea"
                onClick={() => setExtras((p) => p.filter((_, idx) => idx !== i))}
                className="rounded-md p-1 text-muted-foreground hover:text-destructive sm:col-span-1"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <Boton
            variante="suave"
            onClick={() => setExtras((p) => [...p, { concepto: "", cantidad: 1, unidad: "ud.", precio: 0 }])}
          >
            <Plus className="size-3.5" /> Añadir línea extra
          </Boton>
        </div>

        <Campo etiqueta="Notas">
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={claseCampo} />
        </Campo>

        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            disabled={!proyecto || generar.isPending}
            onClick={async () => {
              try {
                await generar.mutateAsync({
                  proyecto_id: proyecto,
                  ...(desde ? { desde } : {}),
                  ...(hasta ? { hasta } : {}),
                  incluir_horas: incluirHoras,
                  incluir_ia: incluirIa,
                  ...(extras.length ? { lineas_extra: extras.filter((e) => e.concepto.trim()) } : {}),
                  ...(notas ? { notas } : {}),
                });
                toast.success("Borrador de factura creado.");
                onCerrar();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Crear borrador
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

/* -------------------------------- Clientes -------------------------------- */

function BloqueClientes() {
  const { data: proyectos = [] } = useProyectos();
  const { data: clientes = [] } = useClientesFacturacion();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {proyectos.map((p) => (
        <TarjetaCliente key={p.id} proyecto={p} cliente={clientes.find((c) => c.proyecto_id === p.id) ?? null} />
      ))}
    </div>
  );
}

function TarjetaCliente({ proyecto, cliente }: { proyecto: ProyectoRow; cliente: FacturacionClienteRow | null }) {
  const guardar = useGuardarCliente();
  const [abierto, setAbierto] = React.useState(false);
  const [datos, setDatos] = React.useState({
    nombre_fiscal: cliente?.nombre_fiscal ?? "",
    nif: cliente?.nif ?? "",
    direccion: cliente?.direccion ?? "",
    email: cliente?.email ?? "",
    telefono: cliente?.telefono ?? "",
    contrato: (cliente?.contrato ?? "horas") as ContratoCliente,
    cuota_mensual: String(cliente?.cuota_mensual ?? ""),
    horas_incluidas: String(cliente?.horas_incluidas ?? ""),
    importe_fijo: String(cliente?.importe_fijo ?? ""),
    tarifa_hora: String(cliente?.tarifa_hora ?? ""),
    dia_facturacion: String(cliente?.dia_facturacion ?? ""),
    notas: cliente?.notas ?? "",
  });

  const numero = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold">{proyecto.nombre}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {cliente?.nombre_fiscal ?? "Sin datos fiscales"} · {ETIQUETA_CONTRATO[datos.contrato]}
          </p>
        </div>
        <Boton variante="suave" onClick={() => setAbierto((v) => !v)}>
          <Pencil className="size-3.5" /> {abierto ? "Cerrar" : "Editar"}
        </Boton>
      </div>

      {abierto ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Nombre fiscal">
              <input
                value={datos.nombre_fiscal}
                onChange={(e) => setDatos({ ...datos, nombre_fiscal: e.target.value })}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="NIF / CIF">
              <input value={datos.nif} onChange={(e) => setDatos({ ...datos, nif: e.target.value })} className={claseCampo} />
            </Campo>
          </div>
          <Campo etiqueta="Dirección">
            <input
              value={datos.direccion}
              onChange={(e) => setDatos({ ...datos, direccion: e.target.value })}
              className={claseCampo}
            />
          </Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Correo">
              <input value={datos.email} onChange={(e) => setDatos({ ...datos, email: e.target.value })} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Teléfono">
              <input
                value={datos.telefono}
                onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
                className={claseCampo}
              />
            </Campo>
          </div>
          <Campo etiqueta="Tipo de contrato" pista={EXPLICACION_CONTRATO[datos.contrato]}>
            <select
              value={datos.contrato}
              onChange={(e) => setDatos({ ...datos, contrato: e.target.value as ContratoCliente })}
              className={claseCampo}
            >
              {CONTRATOS.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETA_CONTRATO[c]}
                </option>
              ))}
            </select>
          </Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Cuota mensual (€)">
              <input
                value={datos.cuota_mensual}
                onChange={(e) => setDatos({ ...datos, cuota_mensual: e.target.value })}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Horas incluidas">
              <input
                value={datos.horas_incluidas}
                onChange={(e) => setDatos({ ...datos, horas_incluidas: e.target.value })}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Importe cerrado (€)">
              <input
                value={datos.importe_fijo}
                onChange={(e) => setDatos({ ...datos, importe_fijo: e.target.value })}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Tarifa por hora (€)" pista="Vacío = la tarifa general">
              <input
                value={datos.tarifa_hora}
                onChange={(e) => setDatos({ ...datos, tarifa_hora: e.target.value })}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Día de facturación">
              <input
                value={datos.dia_facturacion}
                onChange={(e) => setDatos({ ...datos, dia_facturacion: e.target.value })}
                className={claseCampo}
              />
            </Campo>
          </div>
          <Campo etiqueta="Notas">
            <textarea
              value={datos.notas}
              onChange={(e) => setDatos({ ...datos, notas: e.target.value })}
              rows={2}
              className={claseCampo}
            />
          </Campo>
          <div className="flex justify-end">
            <Boton
              disabled={guardar.isPending}
              onClick={async () => {
                try {
                  await guardar.mutateAsync({
                    proyecto_id: proyecto.id,
                    nombre_fiscal: datos.nombre_fiscal || null,
                    nif: datos.nif || null,
                    direccion: datos.direccion || null,
                    email: datos.email || null,
                    telefono: datos.telefono || null,
                    contrato: datos.contrato,
                    cuota_mensual: numero(datos.cuota_mensual),
                    horas_incluidas: numero(datos.horas_incluidas),
                    importe_fijo: numero(datos.importe_fijo),
                    tarifa_hora: numero(datos.tarifa_hora),
                    dia_facturacion: numero(datos.dia_facturacion),
                    notas: datos.notas || null,
                  });
                  toast.success("Datos del cliente guardados.");
                  setAbierto(false);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Guardar
            </Boton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ Configuración ----------------------------- */

function BloqueConfiguracion() {
  const { data: config } = useFacturacionConfig();
  const guardar = useGuardarFacturacionConfig();
  const [datos, setDatos] = React.useState<Record<string, string>>({});
  const [interruptores, setInterruptores] = React.useState({ refacturar_ia: true, generar_borradores_mes: true });

  React.useEffect(() => {
    if (!config) return;
    const e = config.emisor ?? {};
    setDatos({
      nombre: e.nombre ?? "",
      nif: e.nif ?? "",
      direccion: e.direccion ?? "",
      cp: e.cp ?? "",
      ciudad: e.ciudad ?? "",
      email: e.email ?? "",
      telefono: e.telefono ?? "",
      iban: e.iban ?? "",
      logo_url: e.logo_url ?? "",
      pie: e.pie ?? "",
      serie: config.serie ?? "F",
      siguiente_numero: String(config.siguiente_numero ?? 1),
      iva_pct: String(config.iva_pct ?? 21),
      irpf_pct: String(config.irpf_pct ?? 0),
      tarifa_hora: String(config.tarifa_hora ?? 45),
      recargo_ia_pct: String(config.recargo_ia_pct ?? 20),
      dias_vencimiento: String(config.dias_vencimiento ?? 30),
      redondeo_min: String(config.redondeo_min ?? 15),
      texto_legal: config.texto_legal ?? "",
    });
    setInterruptores({
      refacturar_ia: Boolean(config.refacturar_ia),
      generar_borradores_mes: Boolean(config.generar_borradores_mes),
    });
  }, [config]);

  const campo = (clave: string, etiqueta: string, pista?: string) => (
    <Campo etiqueta={etiqueta} pista={pista}>
      <input
        value={datos[clave] ?? ""}
        onChange={(e) => setDatos({ ...datos, [clave]: e.target.value })}
        className={claseCampo}
      />
    </Campo>
  );

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h2 className="font-display text-sm font-semibold">Datos del emisor</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {campo("nombre", "Nombre o razón social")}
          {campo("nif", "NIF / CIF")}
          {campo("direccion", "Dirección")}
          {campo("cp", "Código postal")}
          {campo("ciudad", "Ciudad")}
          {campo("email", "Correo")}
          {campo("telefono", "Teléfono")}
          {campo("iban", "IBAN")}
          {campo("logo_url", "Dirección del logotipo")}
          {campo("pie", "Pie de la factura")}
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="font-display text-sm font-semibold">Numeración e importes</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {campo("serie", "Serie")}
          {campo("siguiente_numero", "Siguiente número")}
          {campo("iva_pct", "IVA (%)")}
          {campo("irpf_pct", "IRPF (%)")}
          {campo("tarifa_hora", "Tarifa por hora (€)")}
          {campo("recargo_ia_pct", "Recargo sobre el gasto de IA (%)")}
          {campo("dias_vencimiento", "Días de vencimiento")}
          {campo("redondeo_min", "Redondeo del cronómetro (minutos)")}
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={interruptores.refacturar_ia}
              onChange={(e) => setInterruptores({ ...interruptores, refacturar_ia: e.target.checked })}
            />
            Repercutir el gasto de IA a los clientes
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={interruptores.generar_borradores_mes}
              onChange={(e) => setInterruptores({ ...interruptores, generar_borradores_mes: e.target.checked })}
            />
            Preparar solo los borradores el día 1 de cada mes
          </label>
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="font-display text-sm font-semibold">Texto legal</h2>
        <textarea
          value={datos["texto_legal"] ?? ""}
          onChange={(e) => setDatos({ ...datos, texto_legal: e.target.value })}
          rows={4}
          className={`${claseCampo} mt-3`}
        />
      </div>

      <div className="flex justify-end">
        <Boton
          disabled={guardar.isPending}
          onClick={async () => {
            try {
              await guardar.mutateAsync({
                emisor: {
                  nombre: datos["nombre"] ?? "",
                  nif: datos["nif"] ?? "",
                  direccion: datos["direccion"] ?? "",
                  cp: datos["cp"] ?? "",
                  ciudad: datos["ciudad"] ?? "",
                  email: datos["email"] ?? "",
                  telefono: datos["telefono"] ?? "",
                  iban: datos["iban"] ?? "",
                  logo_url: datos["logo_url"] ?? "",
                  pie: datos["pie"] ?? "",
                },
                serie: datos["serie"] ?? "F",
                siguiente_numero: Number(datos["siguiente_numero"] ?? 1),
                iva_pct: Number(datos["iva_pct"] ?? 21),
                irpf_pct: Number(datos["irpf_pct"] ?? 0),
                tarifa_hora: Number(datos["tarifa_hora"] ?? 45),
                recargo_ia_pct: Number(datos["recargo_ia_pct"] ?? 20),
                dias_vencimiento: Number(datos["dias_vencimiento"] ?? 30),
                redondeo_min: Number(datos["redondeo_min"] ?? 15),
                texto_legal: datos["texto_legal"] ?? "",
                refacturar_ia: interruptores.refacturar_ia,
                generar_borradores_mes: interruptores.generar_borradores_mes,
              });
              toast.success("Configuración guardada.");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          Guardar la configuración
        </Boton>
      </div>
    </div>
  );
}

/* ------------------------- Piezas para otras pantallas -------------------- */

/** Tarjeta del panel principal: avisa de las facturas vencidas y del cobro pendiente. */
export function TarjetaCobrosPendientes() {
  const mes = mesActualFacturacion();
  const { data: resumen } = useResumenFacturacion(mes);
  const totales = resumen?.totales;
  if (!totales || (totales.vencidas ?? 0) === 0) return null;

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Cobros pendientes</h2>
        <span className="size-2.5 rounded-full bg-destructive" aria-hidden />
      </div>
      <p className="mt-3 text-sm">
        <span className="font-semibold text-destructive">{totales.vencidas}</span> factura(s) vencida(s) ·{" "}
        {formatoDinero(totales.pendiente_cobro)} pendiente de cobro.
      </p>
      <Link to="/facturacion" className="mt-3 inline-flex text-xs text-primary hover:underline">
        Ver la facturación
      </Link>
    </div>
  );
}

/** Tarjeta de facturación en la ficha de un proyecto. */
export function TarjetaFacturacionProyecto({ proyectoId }: { proyectoId: string }) {
  const mes = mesActualFacturacion();
  const { data: resumen } = useResumenFacturacion(mes);
  const { data: facturas = [] } = useFacturas({ proyecto_id: proyectoId, limite: 5 });
  const fila = resumen?.proyectos.find((p) => p.proyecto_id === proyectoId);
  const ultima = facturas[0];

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Facturación</h2>
        <span className="text-xs text-muted-foreground">{ETIQUETA_CONTRATO[fila?.contrato ?? "horas"]}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Horas del mes</p>
          <p className="font-medium tabular-nums">{formatoHoras(fila?.horas ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Sin facturar</p>
          <p className="font-medium tabular-nums">{formatoHoras(fila?.horas_sin_facturar ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Facturado</p>
          <p className="font-medium tabular-nums">{formatoDinero(fila?.facturado ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Última factura</p>
          <p className="font-medium">
            {ultima ? `${ultima.numero ?? "Borrador"} · ${ETIQUETA_ESTADO_FACTURA[ultima.estado]}` : "—"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <BotonCronometroProyecto proyectoId={proyectoId} />
        <Link to="/facturacion" className="text-xs text-primary hover:underline">
          Ver la facturación
        </Link>
      </div>
    </div>
  );
}

