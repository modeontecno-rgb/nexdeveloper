import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  ExternalLink,
  Eye,
  Link2,
  Plus,
  RefreshCw,
  Receipt,
  ShieldCheck,
  Play,
  Square,
  Trash2,
  Unlink,
  Wand2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, Selector, claseCampo } from "@/components/nex/campos";
import { BotonCronometroProyecto } from "@/components/nex/cronometro";
import { Dialogo } from "@/components/nex/dialogo";
import type { ContratoCliente, HoraRegistroRow, ProyectoRow } from "@/lib/nex/db-types";
import { formatoDinero, formatoFecha } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  AVISO_EMPRESAS_PERMITIDAS,
  AVISO_SOLO_FABRICANTE,
  CONTRATOS,
  ESTADOS_FACTURA,
  ETIQUETA_CONTRATO,
  ETIQUETA_ORIGEN_HORAS,
  EXPLICACION_CONTRATO,
  TONO_ORIGEN_HORAS,
  etiquetaEstadoFactura,
  formatoHoras,
  mesActualFacturacion,
  nombreCortoEmpresa,
  nombreMesFacturacion,
  periodoMesAnterior,
  tonoEmpresa,
  tonoEstadoFactura,
  transcurrido,
  ultimosMesesFacturacion,
  useActualizarHoras,
  useBorrarHoras,
  useCambiarEmpresaCliente,
  useClientesFacturacion,
  useConfigurarEmpresa,
  useContratosEvoluteia,
  useCrearTercero,
  useCronometro,
  useDescartarBorrador,
  useDesenlazarCliente,
  useEmitirFactura,
  useEmpresasEvoluteia,
  useEnlazarCliente,
  useEstadoFacturacion,
  useFactura,
  useFacturacionConfig,
  useFacturas,
  useGuardarFacturacionConfig,
  useHoras,
  useIniciarCronometro,
  usePararCronometro,
  usePrepararFactura,
  useProbarEvoluteia,
  useRealtimeFacturacion,
  useRegistrarHoras,
  useResumenFacturacion,
  useSincronizarFacturas,
  useSugerirEnlaces,
  useTercerosEvoluteia,
  type ClienteFacturacion,
  type EmpresaEmisora,
  type PruebaEvoluteia,
  type SugerenciaEnlace,
  type TerceroEvoluteia,
} from "@/lib/nex/queries/facturacion";


export const Route = createFileRoute("/facturacion")({
  head: () => ({
    meta: [
      { title: "Facturación con EvoluteIA · NexDeveloper" },
      {
        name: "description",
        content:
          "Registra horas y gasto de IA por proyecto, prepara los borradores de factura en EvoluteIA y sigue los cobros.",
      },
      { property: "og:title", content: "Facturación con EvoluteIA · NexDeveloper" },
      {
        property: "og:description",
        content:
          "Registra horas y gasto de IA por proyecto, prepara los borradores de factura en EvoluteIA y sigue los cobros.",
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

const URL_EVOLUTEIA_POR_DEFECTO = "https://evoluteia.lovable.app";

/* ---------------------------- Empresas emisoras --------------------------- */

/** Catálogo de las dos empresas que pueden facturar y cuál es la de por defecto. */
function useEmpresasEmisoras() {
  const { data } = useEmpresasEvoluteia();
  const catalogo = React.useMemo<EmpresaEmisora[]>(() => data?.catalogo ?? [], [data]);
  const porDefecto = catalogo.find((e) => e.por_defecto) ?? catalogo[0] ?? null;
  return { catalogo, porDefecto, opciones: data };
}

/** Insignia con la empresa emisora, con un color propio para cada una. */
function InsigniaEmpresa({ nombre, corto }: { nombre?: string | null; corto?: boolean }) {
  if (!nombre) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      title={nombre}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${tonoEmpresa(nombre)}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {corto ? nombreCortoEmpresa(nombre) : nombre}
    </span>
  );
}



function Cifra({
  titulo,
  valor,
  pie,
  tono,
}: {
  titulo: string;
  valor: React.ReactNode;
  pie?: React.ReactNode;
  tono?: string | undefined;
}) {
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
        titulo="Facturación con EvoluteIA"
        descripcion="NexDeveloper aporta las horas y el gasto de IA; las facturas se preparan y se emiten en EvoluteIA."
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

      <ChipConexionEvoluteia mes={mes} />

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

      {pestana === "resumen" ? <BloqueResumen mes={mes} onIrAClientes={() => setPestana("clientes")} /> : null}
      {pestana === "horas" ? <BloqueHoras /> : null}
      {pestana === "facturas" ? <BloqueFacturas /> : null}
      {pestana === "clientes" ? <BloqueClientes /> : null}
      {pestana === "config" ? <BloqueConfiguracion /> : null}
    </div>
  );
}

/* --------------------------- Conexión con EvoluteIA ----------------------- */

function ChipConexionEvoluteia({ mes }: { mes: string }) {
  const { data: estado } = useEstadoFacturacion(mes);
  const { data: config } = useFacturacionConfig();
  const { catalogo } = useEmpresasEmisoras();
  const probar = useProbarEvoluteia();
  const [prueba, setPrueba] = React.useState<PruebaEvoluteia | null>(null);

  const conexion = estado?.evoluteia;
  const conectada = conexion?.estado === "conectada";
  const url = config?.evoluteia_url || URL_EVOLUTEIA_POR_DEFECTO;
  const empresas = estado?.empresas?.length ? estado.empresas : catalogo;
  const pruebaDe = (tenantId: string) => prueba?.empresas?.find((e) => e.tenant_id === tenantId);

  return (
    <div className="panel mb-6 flex flex-wrap items-center gap-3 p-4">
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
          conectada
            ? "border-success/40 bg-success/10 text-success"
            : "border-destructive/40 bg-destructive/10 text-destructive"
        }`}
      >
        <span className={`size-2 rounded-full ${conectada ? "bg-success" : "bg-destructive"}`} aria-hidden />
        {conectada ? `EvoluteIA conectada${conexion?.cuenta ? ` · ${conexion.cuenta}` : ""}` : "EvoluteIA sin conexión"}
      </span>

      {empresas.map((e) => {
        const r = pruebaDe(e.tenant_id);
        const verde = r ? Boolean(r.modulo_activo) : conectada && e.activa !== false;
        return (
          <span
            key={e.tenant_id}
            title={r?.error ?? e.nombre}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap ${tonoEmpresa(e.nombre)}`}
          >
            <span className={`size-2 rounded-full ${verde ? "bg-success" : "bg-destructive"}`} aria-hidden />
            {nombreCortoEmpresa(e.nombre)}
            {e.por_defecto ? <span className="opacity-70">· por defecto</span> : null}
          </span>
        );
      })}

      {!conectada && conexion?.ultimo_error ? (
        <span className="text-xs text-destructive">{conexion.ultimo_error}</span>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Boton
          variante="suave"
          disabled={probar.isPending}
          onClick={async () => {
            try {
              const r = await probar.mutateAsync();
              setPrueba(r);
            } catch (e) {
              setPrueba({ ok: false, error: (e as Error).message });
            }
          }}
        >
          <ShieldCheck className="size-3.5" /> Probar
        </Boton>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ExternalLink className="size-3.5" /> Abrir EvoluteIA
        </a>
      </div>

      <Dialogo
        abierto={Boolean(prueba)}
        titulo="Prueba de conexión con EvoluteIA"
        descripcion={AVISO_EMPRESAS_PERMITIDAS}
        onCerrar={() => setPrueba(null)}
        ancho="max-w-lg"
      >
        {prueba?.ok === false ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {prueba.error ?? "No se ha podido conectar."}
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="rounded-lg border border-success/40 bg-success/10 p-3 text-success">Conexión correcta.</p>
            <p>
              <span className="text-muted-foreground">Usuario:</span> {prueba?.usuario ?? "—"}
            </p>
            {(prueba?.empresas ?? []).map((e) => (
              <div key={e.tenant_id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <InsigniaEmpresa nombre={e.nombre} />
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
                      e.modulo_activo
                        ? "border-success/40 bg-success/10 text-success"
                        : "border-destructive/40 bg-destructive/10 text-destructive"
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${e.modulo_activo ? "bg-success" : "bg-destructive"}`} />
                    {e.modulo_activo ? "Módulo activo" : "Módulo no activo"}
                  </span>
                  {e.por_defecto ? <span className="text-xs text-muted-foreground">Por defecto</span> : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {e.empresa?.razon_social ?? "—"}
                  {e.empresa?.nif ? ` · ${e.empresa.nif}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Serie {e.serie?.codigo ?? "—"} · siguiente número {e.serie?.siguiente_num ?? "—"}
                  {e.serie?.ejercicio ? ` (${e.serie.ejercicio})` : ""}
                </p>
                <p className="mt-1 text-xs">
                  <span className="text-muted-foreground">Verifactu:</span>{" "}
                  {e.empresa?.verifactu_activo ? (
                    <span className="text-success">
                      activo{e.empresa.verifactu_modo ? ` (${e.empresa.verifactu_modo})` : ""}
                    </span>
                  ) : (
                    <span className="text-warning">no activo</span>
                  )}
                </p>
                {e.error ? <p className="mt-1 text-xs text-destructive">{e.error}</p> : null}
              </div>
            ))}
            <p>
              <span className="text-muted-foreground">Facturas sincronizadas:</span>{" "}
              {prueba?.facturas_sincronizadas ?? 0}
            </p>
          </div>
        )}
      </Dialogo>
    </div>
  );
}


/* --------------------------------- Resumen -------------------------------- */

function BloqueResumen({ mes, onIrAClientes }: { mes: string; onIrAClientes: () => void }) {
  const { data: resumen, isPending } = useResumenFacturacion(mes);
  const [prepararPara, setPrepararPara] = React.useState<string | null>(null);
  const totales = resumen?.totales;
  const proyectos = resumen?.proyectos ?? [];
  const sinEnlazar = totales?.sin_enlazar ?? 0;

  return (
    <div className="space-y-6">
      {sinEnlazar > 0 ? (
        <div className="panel flex flex-wrap items-center gap-3 border-warning/40 bg-warning/5 p-4">
          <p className="text-sm">
            <span className="font-semibold text-warning">{sinEnlazar}</span> proyecto(s) sin cliente en EvoluteIA: no se
            pueden preparar sus facturas.
          </p>
          <Boton variante="suave" className="ml-auto" onClick={onIrAClientes}>
            <Link2 className="size-3.5" /> Enlazar clientes
          </Boton>
        </div>
      ) : null}

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
        <table className="w-full min-w-[76rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3">Proyecto</th>
              <th className="p-3">Cliente en EvoluteIA</th>
              <th className="p-3">Empresa</th>
              <th className="p-3">Contrato</th>

              <th className="p-3 text-right">Horas</th>
              <th className="p-3 text-right">Sin facturar</th>
              <th className="p-3 text-right">Facturado</th>
              <th className="p-3 text-right">Cobrado</th>
              <th className="p-3 text-right">Coste IA</th>
              <th className="p-3 text-right">Margen</th>
              <th className="p-3 text-right">Borradores</th>
              <th className="p-3 text-right">Vencidas</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={13} className="p-4 text-muted-foreground">
                  Cargando cifras...
                </td>
              </tr>
            ) : proyectos.length === 0 ? (
              <tr>
                <td colSpan={13} className="p-4 text-muted-foreground">
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
                  <td className="p-3">
                    {p.enlazado ? (
                      <span>{p.cliente ?? "Cliente enlazado"}</span>
                    ) : (
                      <span className="text-warning">Sin enlazar</span>
                    )}
                  </td>
                  <td className="p-3">
                    <InsigniaEmpresa nombre={p.empresa} corto />
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
                  <td className={`p-3 text-right tabular-nums ${p.vencidas ? "text-destructive" : ""}`}>
                    {p.vencidas || "—"}
                  </td>
                  <td className="p-3 text-right">
                    <Boton variante="suave" disabled={!p.enlazado} onClick={() => setPrepararPara(p.proyecto_id)}>
                      <Receipt className="size-3.5" /> Preparar factura en EvoluteIA
                    </Boton>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DialogoPreparar
        proyectoId={prepararPara}
        abierto={Boolean(prepararPara)}
        onCerrar={() => setPrepararPara(null)}
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
  const { data: facturas = [] } = useFacturas({ limite: 200 });
  const actualizar = useActualizarHoras();
  const borrar = useBorrarHoras();

  const total = horas.reduce((t, h) => t + Number(h.horas ?? 0), 0);
  const urlDocumento = (documentoId: string | null) =>
    facturas.find((f) => f.documento_id === documentoId)?.url ?? null;

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
          <input type="checkbox" checked={soloSinFacturar} onChange={(e) => setSoloSinFacturar(e.target.checked)} />
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
        <table className="w-full min-w-[68rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3">Fecha</th>
              <th className="p-3">Proyecto</th>
              <th className="p-3">Descripción</th>
              <th className="p-3">Origen</th>
              <th className="p-3 text-right">Horas</th>
              <th className="p-3">Facturable</th>
              <th className="p-3">Factura</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={8} className="p-4 text-muted-foreground">
                  Cargando horas...
                </td>
              </tr>
            ) : horas.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-muted-foreground">
                  No hay horas registradas con estos filtros.
                </td>
              </tr>
            ) : (
              horas.map((h) => {
                const bloqueada = Boolean(h.evoluteia_numero || h.evoluteia_documento_id);
                const proyecto = proyectos.find((p) => p.id === h.proyecto_id);
                const url = urlDocumento(h.evoluteia_documento_id);
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
                    <td className="p-3 text-xs">
                      {h.evoluteia_numero ? (
                        url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {h.evoluteia_numero}
                          </a>
                        ) : (
                          h.evoluteia_numero
                        )
                      ) : h.evoluteia_documento_id ? (
                        url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            Borrador en EvoluteIA
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Borrador en EvoluteIA</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {bloqueada ? (
                        <span className="text-xs text-muted-foreground">Bloqueada</span>
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
                await iniciar.mutateAsync({ proyecto_id: proyectoId, ...(descripcion ? { descripcion } : {}) });
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
                  ...(descripcion ? { descripcion } : {}),
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
  const { catalogo } = useEmpresasEmisoras();
  const [filtroEstado, setFiltroEstado] = React.useState("todos");
  const [filtroProyecto, setFiltroProyecto] = React.useState("todos");
  const [filtroEmpresa, setFiltroEmpresa] = React.useState("todas");
  const filtro = {
    ...(filtroEstado !== "todos" ? { estado: filtroEstado } : {}),
    ...(filtroProyecto !== "todos" ? { proyecto_id: filtroProyecto } : {}),
    ...(filtroEmpresa !== "todas" ? { tenant_id: filtroEmpresa } : {}),
    limite: 200,
  };

  const { data: facturas = [], isPending } = useFacturas(filtro);

  const [verId, setVerId] = React.useState<string | null>(null);
  const [emitirId, setEmitirId] = React.useState<string | null>(null);
  const [descartarId, setDescartarId] = React.useState<string | null>(null);

  const emitir = useEmitirFactura();
  const descartar = useDescartarBorrador();
  const sincronizar = useSincronizarFacturas();

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-end gap-3 p-4">
        <Selector
          etiqueta="Estado"
          valor={filtroEstado}
          onChange={setFiltroEstado}
          opciones={[
            { valor: "todos", texto: "Todos" },
            ...ESTADOS_FACTURA.map((e) => ({ valor: e, texto: etiquetaEstadoFactura(e) })),
          ]}
        />
        <Selector
          etiqueta="Proyecto"
          valor={filtroProyecto}
          onChange={setFiltroProyecto}
          opciones={[{ valor: "todos", texto: "Todos" }, ...proyectos.map((p) => ({ valor: p.id, texto: p.nombre }))]}
        />
        <Selector
          etiqueta="Empresa"
          valor={filtroEmpresa}
          onChange={setFiltroEmpresa}
          opciones={[
            { valor: "todas", texto: "Todas" },
            ...catalogo.map((e) => ({ valor: e.tenant_id, texto: e.nombre })),
          ]}
        />

        <Boton
          className="ml-auto"
          variante="suave"
          disabled={sincronizar.isPending}
          onClick={async () => {
            try {
              await sincronizar.mutateAsync();
              toast.success("Facturas sincronizadas con EvoluteIA.");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          <RefreshCw className="size-3.5" /> Sincronizar con EvoluteIA
        </Boton>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[74rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3">Número</th>
              <th className="p-3">Fecha</th>
              <th className="p-3">Proyecto</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Empresa</th>
              <th className="p-3 text-right">Base</th>
              <th className="p-3 text-right">Total</th>

              <th className="p-3 text-right">Pendiente</th>
              <th className="p-3">Estado</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={10} className="p-4 text-muted-foreground">
                  Cargando facturas...
                </td>
              </tr>
            ) : facturas.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-4 text-muted-foreground">
                  Todavía no hay facturas en EvoluteIA para estos filtros.
                </td>
              </tr>
            ) : (
              facturas.map((f) => (
                <tr key={f.documento_id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {f.numero ?? "Borrador"}
                      {f.verifactu ? <BadgeCheck className="size-3.5 text-success" aria-label="Registrada en Verifactu" /> : null}
                      {f.origen === "nexdeveloper" ? (
                        <Wand2 className="size-3.5 text-primary" aria-label="Preparada desde NexDeveloper" />
                      ) : null}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{f.fecha ? formatoFecha(f.fecha) : "—"}</td>
                  <td className="p-3">{f.proyectos?.nombre ?? proyectos.find((p) => p.id === f.proyecto_id)?.nombre ?? "—"}</td>
                  <td className="p-3">{f.cliente ?? "—"}</td>
                  <td className="p-3">
                    <InsigniaEmpresa nombre={f.empresa} corto />
                  </td>

                  <td className="p-3 text-right tabular-nums">{formatoDinero(Number(f.base ?? 0))}</td>
                  <td className="p-3 text-right tabular-nums">{formatoDinero(Number(f.total ?? 0))}</td>
                  <td className={`p-3 text-right tabular-nums ${f.vencido ? "text-destructive" : ""}`}>
                    {formatoDinero(Number(f.pendiente ?? 0))}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${tonoEstadoFactura(f.estado)}`}>
                      {etiquetaEstadoFactura(f.estado)}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Boton variante="suave" onClick={() => setVerId(f.documento_id)}>
                        <Eye className="size-3.5" /> Ver
                      </Boton>
                      {f.estado === "borrador" ? (
                        <>
                          <Boton onClick={() => setEmitirId(f.documento_id)}>
                            <Receipt className="size-3.5" /> Emitir en EvoluteIA
                          </Boton>
                          <Boton variante="peligro" onClick={() => setDescartarId(f.documento_id)}>
                            <Trash2 className="size-3.5" /> Descartar
                          </Boton>
                        </>
                      ) : null}
                      {f.url ? (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                        >
                          <ExternalLink className="size-3.5" /> Abrir en EvoluteIA
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DialogoVerFactura documentoId={verId} onCerrar={() => setVerId(null)} />

      <Dialogo
        abierto={Boolean(emitirId)}
        titulo="Emitir la factura en EvoluteIA"
        descripcion="Se numerará en la serie de EvoluteIA, se registrará en Verifactu si la empresa lo tiene activo y las horas quedarán bloqueadas."
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
                const r = await emitir.mutateAsync({ documento_id: emitirId });
                setEmitirId(null);
                toast.success(
                  `Factura ${r.numero ?? ""} emitida${r.verifactu ? " y registrada en Verifactu" : " (sin Verifactu)"}.`,
                );
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
        abierto={Boolean(descartarId)}
        titulo="Descartar el borrador"
        descripcion="Se borrará el borrador en EvoluteIA y las horas quedarán libres otra vez."
        onCerrar={() => setDescartarId(null)}
        ancho="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={() => setDescartarId(null)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            disabled={descartar.isPending}
            onClick={async () => {
              if (!descartarId) return;
              try {
                await descartar.mutateAsync(descartarId);
                setDescartarId(null);
                toast.success("Borrador descartado.");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Descartar
          </Boton>
        </div>
      </Dialogo>
    </div>
  );
}

function DialogoVerFactura({ documentoId, onCerrar }: { documentoId: string | null; onCerrar: () => void }) {
  const { data, isPending } = useFactura(documentoId);
  const factura = data?.factura ?? null;
  const lineas = factura?.documento_lineas ?? [];
  const vencimientos = data?.vencimientos ?? [];
  const registros = data?.verifactu?.registros ?? [];

  return (
    <Dialogo
      abierto={Boolean(documentoId)}
      titulo={factura?.numero ? `Factura ${factura.numero}` : "Borrador de factura"}
      {...(factura?.terceros?.razon_social ? { descripcion: factura.terceros.razon_social } : {})}
      onCerrar={onCerrar}
      ancho="max-w-3xl"
    >
      {isPending ? (
        <p className="text-sm text-muted-foreground">Cargando la factura...</p>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-2">Concepto</th>
                  <th className="p-2 text-right">Cantidad</th>
                  <th className="p-2 text-right">Precio</th>
                  <th className="p-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {lineas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-2 text-muted-foreground">
                      Sin líneas.
                    </td>
                  </tr>
                ) : (
                  lineas.map((l, i) => (
                    <tr key={l.id ?? i} className="border-b border-border/60 last:border-0">
                      <td className="p-2">{l.concepto ?? l.descripcion ?? "—"}</td>
                      <td className="p-2 text-right tabular-nums">{Number(l.cantidad ?? 0)}</td>
                      <td className="p-2 text-right tabular-nums">{formatoDinero(Number(l.precio ?? 0))}</td>
                      <td className="p-2 text-right tabular-nums">
                        {formatoDinero(Number(l.importe ?? l.base ?? 0))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Base</p>
              <p className="tabular-nums">{formatoDinero(Number(factura?.base ?? 0))}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">IVA</p>
              <p className="tabular-nums">{formatoDinero(Number(factura?.cuota_iva ?? 0))}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-semibold tabular-nums">{formatoDinero(Number(factura?.total ?? 0))}</p>
            </div>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold">Vencimientos</h3>
            {vencimientos.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">Sin vencimientos registrados.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {vencimientos.map((v, i) => (
                  <li key={v.id ?? i} className="flex justify-between rounded-md border border-border px-3 py-1.5">
                    <span>{v.fecha ? formatoFecha(v.fecha) : "—"}</span>
                    <span className="tabular-nums">
                      {formatoDinero(Number(v.importe ?? 0))}{" "}
                      <span className={v.cobrado ? "text-success" : "text-muted-foreground"}>
                        {v.cobrado ? "cobrado" : "pendiente"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold">Verifactu</h3>
            {registros.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">Sin registros de Verifactu.</p>
            ) : (
              <p className="mt-1 text-xs text-success">{registros.length} registro(s) enviados correctamente.</p>
            )}
          </div>

          {data?.url ? (
            <div className="flex justify-end">
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
              >
                <ExternalLink className="size-3.5" /> Abrir en EvoluteIA (PDF y envío)
              </a>
            </div>
          ) : null}
        </div>
      )}
    </Dialogo>
  );
}

/* ------------------------------ Preparar factura -------------------------- */

function DialogoPreparar({
  proyectoId,
  abierto,
  onCerrar,
}: {
  proyectoId: string | null;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const { data: proyectos = [] } = useProyectos();
  const preparar = usePrepararFactura();
  const [proyecto, setProyecto] = React.useState("");
  const periodo = React.useMemo(() => periodoMesAnterior(), []);
  const [desde, setDesde] = React.useState(periodo.desde);
  const [hasta, setHasta] = React.useState(periodo.hasta);
  const [incluirHoras, setIncluirHoras] = React.useState(true);
  const [incluirIa, setIncluirIa] = React.useState(true);
  const [notas, setNotas] = React.useState("");
  const [extras, setExtras] = React.useState<{ concepto: string; cantidad: number; precio: number }[]>([]);
  const [resultado, setResultado] = React.useState<
    { documento_id?: string; numero_previsto?: string; horas?: number; coste_ia?: number; url?: string } | null
  >(null);

  React.useEffect(() => {
    if (abierto) {
      setProyecto(proyectoId ?? proyectos[0]?.id ?? "");
      setResultado(null);
    }
  }, [abierto, proyectoId, proyectos]);

  return (
    <Dialogo
      abierto={abierto}
      titulo="Preparar factura en EvoluteIA"
      descripcion="Se creará un borrador en EvoluteIA con las horas, la cuota del contrato y el gasto de IA del periodo."
      onCerrar={onCerrar}
      ancho="max-w-2xl"
    >
      {resultado ? (
        <div className="space-y-3 text-sm">
          <p className="rounded-lg border border-success/40 bg-success/10 p-3 text-success">
            Borrador preparado en EvoluteIA{resultado.numero_previsto ? ` · número previsto ${resultado.numero_previsto}` : ""}.
          </p>
          <p>
            <span className="text-muted-foreground">Horas incluidas:</span> {formatoHoras(resultado.horas ?? 0)}
          </p>
          <p>
            <span className="text-muted-foreground">Gasto de IA:</span> {formatoDinero(resultado.coste_ia ?? 0)}
          </p>
          <div className="flex justify-end gap-2">
            {resultado.url ? (
              <a
                href={resultado.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
              >
                <ExternalLink className="size-3.5" /> Ver en EvoluteIA
              </a>
            ) : null}
            <Boton onClick={onCerrar}>Cerrar</Boton>
          </div>
        </div>
      ) : (
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
                  onChange={(e) => setExtras((p) => p.map((x, idx) => (idx === i ? { ...x, concepto: e.target.value } : x)))}
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
            <Boton variante="suave" onClick={() => setExtras((p) => [...p, { concepto: "", cantidad: 1, precio: 0 }])}>
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
              disabled={!proyecto || preparar.isPending}
              onClick={async () => {
                try {
                  const r = await preparar.mutateAsync({
                    proyecto_id: proyecto,
                    ...(desde ? { desde } : {}),
                    ...(hasta ? { hasta } : {}),
                    incluir_horas: incluirHoras,
                    incluir_ia: incluirIa,
                    ...(extras.length ? { lineas_extra: extras.filter((e) => e.concepto.trim()) } : {}),
                    ...(notas ? { notas } : {}),
                  });
                  setResultado(r);
                  toast.success("Borrador preparado en EvoluteIA.");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              {preparar.isPending ? "Preparando..." : "Preparar en EvoluteIA"}
            </Boton>
          </div>
        </div>
      )}
    </Dialogo>
  );
}

/* -------------------------------- Clientes -------------------------------- */

function BloqueClientes() {
  const { data: proyectos = [] } = useProyectos();
  const { data: clientes = [] } = useClientesFacturacion();
  const { catalogo, porDefecto } = useEmpresasEmisoras();
  const sugerir = useSugerirEnlaces();
  const [sugerencias, setSugerencias] = React.useState<SugerenciaEnlace[] | null>(null);
  const [empresaSugerir, setEmpresaSugerir] = React.useState<string>("");

  const tenantSugerir = empresaSugerir || porDefecto?.tenant_id || "";

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <p className="text-sm text-muted-foreground">
          Cada proyecto se enlaza con un cliente («tercero») de EvoluteIA. Los datos fiscales se leen de EvoluteIA.
        </p>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <Campo etiqueta="Buscar en">
            <select
              value={tenantSugerir}
              onChange={(e) => setEmpresaSugerir(e.target.value)}
              className={claseCampo}
            >
              {catalogo.map((e) => (
                <option key={e.tenant_id} value={e.tenant_id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Boton
            variante="suave"
            disabled={sugerir.isPending}
            onClick={async () => {
              try {
                setSugerencias(await sugerir.mutateAsync(tenantSugerir || null));
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Wand2 className="size-3.5" /> Sugerir enlaces
          </Boton>
        </div>
      </div>

      {sugerencias ? (
        <PanelSugerencias
          sugerencias={sugerencias}
          tenantId={tenantSugerir || null}
          onCerrar={() => setSugerencias(null)}
        />
      ) : null}


      <div className="grid gap-4 lg:grid-cols-2">
        {proyectos.map((p) => (
          <TarjetaCliente key={p.id} proyecto={p} cliente={clientes.find((c) => c.proyecto_id === p.id) ?? null} />
        ))}
      </div>
    </div>
  );
}

function PanelSugerencias({
  sugerencias,
  tenantId,
  onCerrar,
}: {
  sugerencias: SugerenciaEnlace[];
  tenantId: string | null;
  onCerrar: () => void;
}) {
  const enlazar = useEnlazarCliente();


  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Enlaces sugeridos</h2>
        <Boton variante="suave" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
      {sugerencias.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No se ha encontrado ningún parecido claro.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {sugerencias.map((s) => (
            <li key={s.proyecto_id} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{s.proyecto}</p>
              <ul className="mt-2 space-y-1.5">
                {s.candidatos.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{c.razon_social}</span>
                    {c.nif ? <span className="text-xs text-muted-foreground">{c.nif}</span> : null}
                    <span className="text-xs text-muted-foreground">{c.puntos} puntos</span>
                    <Boton
                      className="ml-auto"
                      variante="suave"
                      disabled={enlazar.isPending}
                      onClick={async () => {
                        try {
                          await enlazar.mutateAsync({
                            proyecto_id: s.proyecto_id,
                            tercero_id: c.id,
                            contrato: "horas",
                            ...(tenantId ? { tenant_id: tenantId } : {}),

                          });
                          toast.success("Proyecto enlazado con EvoluteIA.");
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Link2 className="size-3.5" /> Enlazar
                    </Boton>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaCliente({ proyecto, cliente }: { proyecto: ProyectoRow; cliente: ClienteFacturacion | null }) {
  const [abierto, setAbierto] = React.useState(false);
  const [cambiar, setCambiar] = React.useState(false);
  const desenlazar = useDesenlazarCliente();
  const cambiarEmpresa = useCambiarEmpresaCliente();
  const { catalogo } = useEmpresasEmisoras();
  const enlazado = Boolean(cliente?.tercero_id);
  const empresaActual = catalogo.find((e) => e.tenant_id === cliente?.evoluteia_tenant_id) ?? null;
  const otraEmpresa = catalogo.find((e) => e.tenant_id !== empresaActual?.tenant_id) ?? null;

  return (

    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-sm font-semibold">{proyecto.nombre}</h2>
            {enlazado ? <InsigniaEmpresa nombre={empresaActual?.nombre} corto /> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">

            {enlazado ? (
              <>
                {cliente?.nombre_fiscal ?? "Cliente de EvoluteIA"}
                {cliente?.nif ? ` · ${cliente.nif}` : ""}
                {cliente?.tercero_codigo ? ` · ${cliente.tercero_codigo}` : ""}
              </>
            ) : (
              <span className="text-warning">Sin enlazar</span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ETIQUETA_CONTRATO[(cliente?.contrato ?? "horas") as ContratoCliente]}
            {cliente?.cuota_mensual ? ` · ${formatoDinero(Number(cliente.cuota_mensual))}/mes` : ""}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Boton variante="suave" onClick={() => setAbierto(true)}>
            <Link2 className="size-3.5" /> {enlazado ? "Cambiar enlace" : "Enlazar con EvoluteIA"}
          </Boton>
          {enlazado ? (
            <Boton
              variante="peligro"
              disabled={desenlazar.isPending}
              onClick={async () => {
                try {
                  await desenlazar.mutateAsync(proyecto.id);
                  toast.success("Proyecto desenlazado.");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <Unlink className="size-3.5" /> Desenlazar
            </Boton>
          ) : null}
        </div>
      </div>

      {enlazado ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <dt>Correo</dt>
            <dd className="text-foreground">{cliente?.email ?? "—"}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd className="text-foreground">{cliente?.telefono ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt>Dirección</dt>
            <dd className="text-foreground">{cliente?.direccion ?? "—"}</dd>
          </div>
        </dl>
      ) : null}

      <DialogoEnlazar
        proyecto={proyecto}
        cliente={cliente}
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
      />
    </div>
  );
}

function DialogoEnlazar({
  proyecto,
  cliente,
  abierto,
  onCerrar,
}: {
  proyecto: ProyectoRow;
  cliente: FacturacionClienteRow | null;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const [modo, setModo] = React.useState<"buscar" | "crear">("buscar");
  const [busqueda, setBusqueda] = React.useState("");
  const [terceroId, setTerceroId] = React.useState<string | null>(cliente?.tercero_id ?? null);
  const [contratoId, setContratoId] = React.useState<string>(cliente?.contrato_id ?? "");
  const [contrato, setContrato] = React.useState<ContratoCliente>((cliente?.contrato ?? "horas") as ContratoCliente);
  const [cuota, setCuota] = React.useState(String(cliente?.cuota_mensual ?? ""));
  const [horasIncluidas, setHorasIncluidas] = React.useState(String(cliente?.horas_incluidas ?? ""));
  const [importeFijo, setImporteFijo] = React.useState(String(cliente?.importe_fijo ?? ""));
  const [tarifa, setTarifa] = React.useState(String(cliente?.tarifa_hora ?? ""));
  const [refacturarIa, setRefacturarIa] = React.useState(cliente?.refacturar_ia ?? true);
  const [nuevo, setNuevo] = React.useState({ razon_social: "", nif: "", email: "", telefono: "", poblacion: "" });

  const { data: terceros = [], isFetching } = useTercerosEvoluteia(busqueda, abierto && modo === "buscar");
  const { data: contratos = [] } = useContratosEvoluteia(abierto ? terceroId : null);
  const crear = useCrearTercero();
  const enlazar = useEnlazarCliente();

  const numero = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <Dialogo
      abierto={abierto}
      titulo={`Enlazar «${proyecto.nombre}» con EvoluteIA`}
      descripcion="Elige el cliente de EvoluteIA y cómo se factura este proyecto."
      onCerrar={onCerrar}
      ancho="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          {(["buscar", "crear"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                modo === m
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "buscar" ? "Buscar cliente" : "Crear nuevo en EvoluteIA"}
            </button>
          ))}
        </div>

        {modo === "buscar" ? (
          <div className="space-y-2">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o NIF"
              className={claseCampo}
            />
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {isFetching ? (
                <p className="text-sm text-muted-foreground">Buscando en EvoluteIA...</p>
              ) : terceros.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ningún cliente encontrado.</p>
              ) : (
                terceros.map((t: TerceroEvoluteia) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTerceroId(t.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                      terceroId === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span>
                      {t.razon_social}
                      {t.nif ? <span className="ml-2 text-xs text-muted-foreground">{t.nif}</span> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.codigo ?? ""}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Razón social">
              <input
                value={nuevo.razon_social}
                onChange={(e) => setNuevo({ ...nuevo, razon_social: e.target.value })}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="NIF / CIF">
              <input value={nuevo.nif} onChange={(e) => setNuevo({ ...nuevo, nif: e.target.value })} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Correo">
              <input value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Teléfono">
              <input
                value={nuevo.telefono}
                onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })}
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Población">
              <input
                value={nuevo.poblacion}
                onChange={(e) => setNuevo({ ...nuevo, poblacion: e.target.value })}
                className={claseCampo}
              />
            </Campo>
            <div className="flex items-end">
              <Boton
                disabled={!nuevo.razon_social.trim() || crear.isPending}
                onClick={async () => {
                  try {
                    const r = await crear.mutateAsync({
                      razon_social: nuevo.razon_social,
                      ...(nuevo.nif ? { nif: nuevo.nif } : {}),
                      ...(nuevo.email ? { email: nuevo.email } : {}),
                      ...(nuevo.telefono ? { telefono: nuevo.telefono } : {}),
                      ...(nuevo.poblacion ? { poblacion: nuevo.poblacion } : {}),
                    });
                    if (r.tercero?.id) setTerceroId(r.tercero.id);
                    setModo("buscar");
                    toast.success("Cliente creado en EvoluteIA.");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                Crear cliente
              </Boton>
            </div>
          </div>
        )}

        <Campo etiqueta="Contrato de EvoluteIA" pista="Opcional: si el cliente ya tiene un contrato con cuota.">
          <select value={contratoId} onChange={(e) => setContratoId(e.target.value)} className={claseCampo}>
            <option value="">Sin contrato</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {[c.numero, c.titulo].filter(Boolean).join(" · ") || c.id}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Tipo de contrato en NexDeveloper" pista={EXPLICACION_CONTRATO[contrato]}>
          <select value={contrato} onChange={(e) => setContrato(e.target.value as ContratoCliente)} className={claseCampo}>
            {CONTRATOS.map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CONTRATO[c]}
              </option>
            ))}
          </select>
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Cuota mensual (€)">
            <input value={cuota} onChange={(e) => setCuota(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Horas incluidas">
            <input value={horasIncluidas} onChange={(e) => setHorasIncluidas(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Importe cerrado (€)">
            <input value={importeFijo} onChange={(e) => setImporteFijo(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Tarifa por hora (€)" pista="Vacío = la tarifa general">
            <input value={tarifa} onChange={(e) => setTarifa(e.target.value)} className={claseCampo} />
          </Campo>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={refacturarIa} onChange={(e) => setRefacturarIa(e.target.checked)} />
          Repercutir el gasto de IA a este cliente
        </label>

        <div className="flex justify-end gap-2">
          <Boton variante="suave" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            disabled={!terceroId || enlazar.isPending}
            onClick={async () => {
              if (!terceroId) return;
              try {
                await enlazar.mutateAsync({
                  proyecto_id: proyecto.id,
                  tercero_id: terceroId,
                  ...(contratoId ? { contrato_id: contratoId } : {}),
                  contrato,
                  cuota_mensual: numero(cuota),
                  horas_incluidas: numero(horasIncluidas),
                  importe_fijo: numero(importeFijo),
                  tarifa_hora: numero(tarifa),
                  refacturar_ia: refacturarIa,
                });
                toast.success("Proyecto enlazado con EvoluteIA.");
                onCerrar();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Enlazar
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

/* ------------------------------ Configuración ----------------------------- */

/** Aviso permanente: la integración con EvoluteIA es exclusiva del fabricante. */
export function TarjetaSoloFabricante() {
  return (
    <div className="panel border-warning/40 bg-warning/5 p-4">
      <h2 className="font-display text-sm font-semibold text-warning">Solo fabricante</h2>
      <p className="mt-2 text-sm text-muted-foreground">{AVISO_SOLO_FABRICANTE}</p>
    </div>
  );
}

function BloqueConfiguracion() {
  const { data: config } = useFacturacionConfig();
  const guardar = useGuardarFacturacionConfig();
  const { data: opciones } = useEmpresasEvoluteia();
  const probar = useProbarEvoluteia();
  const [datos, setDatos] = React.useState<Record<string, string>>({});
  const [interruptores, setInterruptores] = React.useState({ refacturar_ia: true, generar_borradores_mes: true });

  React.useEffect(() => {
    if (!config) return;
    setDatos({
      tarifa_hora: String(config.tarifa_hora ?? 45),
      recargo_ia_pct: String(config.recargo_ia_pct ?? 20),
      redondeo_min: String(config.redondeo_min ?? 15),
      evoluteia_usuario: config.evoluteia_usuario ?? "",
      evoluteia_url: config.evoluteia_url ?? URL_EVOLUTEIA_POR_DEFECTO,
      evoluteia_empresa_id: config.evoluteia_empresa_id ?? "",
      evoluteia_sede_id: config.evoluteia_sede_id ?? "",
      evoluteia_forma_pago_id: config.evoluteia_forma_pago_id ?? "",
      evoluteia_impuesto_id: config.evoluteia_impuesto_id ?? "",
    });
    setInterruptores({
      refacturar_ia: Boolean(config.refacturar_ia),
      generar_borradores_mes: Boolean(config.generar_borradores_mes),
    });
  }, [config]);

  const campo = (clave: string, etiqueta: string, pista?: string) => (
    <Campo etiqueta={etiqueta} {...(pista ? { pista } : {})}>
      <input
        value={datos[clave] ?? ""}
        onChange={(e) => setDatos({ ...datos, [clave]: e.target.value })}
        className={claseCampo}
      />
    </Campo>
  );

  const desplegable = (
    clave: string,
    etiqueta: string,
    lista: { id: string; nombre?: string; razon_social?: string; codigo?: string }[],
  ) => (
    <Campo etiqueta={etiqueta}>
      <select
        value={datos[clave] ?? ""}
        onChange={(e) => setDatos({ ...datos, [clave]: e.target.value })}
        className={claseCampo}
      >
        <option value="">Sin elegir</option>
        {lista.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre ?? o.razon_social ?? o.codigo ?? o.id}
          </option>
        ))}
      </select>
    </Campo>
  );

  return (
    <div className="space-y-4">
      <TarjetaSoloFabricante />

      <div className="panel p-4">
        <h2 className="font-display text-sm font-semibold">Horas y gasto de IA</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {campo("tarifa_hora", "Tarifa por hora (€)")}
          {campo("recargo_ia_pct", "Recargo sobre el gasto de IA (%)")}
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
            Preparar los borradores en EvoluteIA el día 1 de cada mes
          </label>
        </div>
      </div>

      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold">EvoluteIA</h2>
          <Boton
            variante="suave"
            disabled={probar.isPending}
            onClick={async () => {
              try {
                const r = await probar.mutateAsync();
                toast.success(`Conexión correcta con ${r.empresa?.razon_social ?? "EvoluteIA"}.`);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <ShieldCheck className="size-3.5" /> Probar conexión
          </Boton>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          La conexión se hace con la sesión del propio Javier y se guarda cifrada: no hay que pegar ninguna clave.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {campo("evoluteia_usuario", "Usuario de EvoluteIA")}
          {campo("evoluteia_url", "Dirección de EvoluteIA")}
          {desplegable("evoluteia_empresa_id", "Empresa", opciones?.empresas ?? [])}
          {desplegable("evoluteia_sede_id", "Sede", opciones?.sedes ?? [])}
          {desplegable("evoluteia_forma_pago_id", "Forma de pago", opciones?.formas_pago ?? [])}
          {desplegable("evoluteia_impuesto_id", "Impuesto", opciones?.impuestos ?? [])}
        </div>
      </div>

      <div className="flex justify-end">
        <Boton
          disabled={guardar.isPending}
          onClick={async () => {
            try {
              await guardar.mutateAsync({
                tarifa_hora: Number(datos["tarifa_hora"] ?? 45),
                recargo_ia_pct: Number(datos["recargo_ia_pct"] ?? 20),
                redondeo_min: Number(datos["redondeo_min"] ?? 15),
                evoluteia_usuario: datos["evoluteia_usuario"] ?? "",
                evoluteia_url: datos["evoluteia_url"] ?? URL_EVOLUTEIA_POR_DEFECTO,
                evoluteia_empresa_id: datos["evoluteia_empresa_id"] || null,
                evoluteia_sede_id: datos["evoluteia_sede_id"] || null,
                evoluteia_forma_pago_id: datos["evoluteia_forma_pago_id"] || null,
                evoluteia_impuesto_id: datos["evoluteia_impuesto_id"] || null,
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

/** Tarjeta del panel principal: cobros pendientes y facturas vencidas en EvoluteIA. */
export function TarjetaCobrosPendientes() {
  const { data: facturas = [] } = useFacturas({ limite: 100 });
  const pendientes = facturas.filter((f) => Number(f.pendiente ?? 0) > 0 && f.estado !== "anulado");
  const vencidas = pendientes.filter((f) => f.vencido);
  const total = pendientes.reduce((t, f) => t + Number(f.pendiente ?? 0), 0);

  if (pendientes.length === 0) return null;

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Cobros pendientes</h2>
        <span className={`size-2.5 rounded-full ${vencidas.length ? "bg-destructive" : "bg-warning"}`} aria-hidden />
      </div>
      <p className="mt-3 text-sm">
        {formatoDinero(total)} pendiente de cobro
        {vencidas.length ? (
          <>
            {" · "}
            <span className="font-semibold text-destructive">{vencidas.length} vencida(s)</span>
          </>
        ) : null}
        .
      </p>
      <ul className="mt-2 space-y-1 text-xs">
        {pendientes.slice(0, 3).map((f) => (
          <li key={f.documento_id} className="flex items-center justify-between gap-2">
            <span className={f.vencido ? "text-destructive" : "text-muted-foreground"}>
              {f.numero ?? "Borrador"} · {f.proyectos?.nombre ?? "—"}
            </span>
            {f.url ? (
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Abrir en EvoluteIA
              </a>
            ) : null}
          </li>
        ))}
      </ul>
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
  const { data: facturas = [] } = useFacturas({ proyecto_id: proyectoId, limite: 10 });
  const { data: clientes = [] } = useClientesFacturacion();
  const [preparar, setPreparar] = React.useState(false);

  const fila = resumen?.proyectos.find((p) => p.proyecto_id === proyectoId);
  const cliente = clientes.find((c) => c.proyecto_id === proyectoId) ?? null;
  const enlazado = Boolean(cliente?.tercero_id);
  const borradores = facturas.filter((f) => f.estado === "borrador").length;
  const pendienteCobro = facturas.reduce((t, f) => t + Number(f.pendiente ?? 0), 0);
  const ultima = facturas[0];

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Facturación</h2>
        <span className="text-xs text-muted-foreground">
          {ETIQUETA_CONTRATO[(cliente?.contrato ?? fila?.contrato ?? "horas") as ContratoCliente]}
        </span>
      </div>
      <p className="mt-2 text-xs">
        {enlazado ? (
          <span className="text-muted-foreground">
            Cliente en EvoluteIA: <span className="text-foreground">{cliente?.nombre_fiscal ?? "enlazado"}</span>
          </span>
        ) : (
          <Link to="/facturacion" className="text-warning hover:underline">
            Sin cliente en EvoluteIA · enlazar
          </Link>
        )}
      </p>
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
          <p className="text-xs text-muted-foreground">Borradores</p>
          <p className="font-medium tabular-nums">{borradores || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pendiente de cobro</p>
          <p className="font-medium tabular-nums">{formatoDinero(pendienteCobro)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <BotonCronometroProyecto proyectoId={proyectoId} />
        <Boton variante="suave" disabled={!enlazado} onClick={() => setPreparar(true)}>
          <Receipt className="size-3.5" /> Preparar factura en EvoluteIA
        </Boton>
        {ultima?.url ? (
          <a
            href={ultima.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" /> Ver en EvoluteIA
          </a>
        ) : null}
        <Link to="/facturacion" className="text-xs text-primary hover:underline">
          Ver la facturación
        </Link>
      </div>

      <DialogoPreparar proyectoId={proyectoId} abierto={preparar} onCerrar={() => setPreparar(false)} />
    </div>
  );
}
