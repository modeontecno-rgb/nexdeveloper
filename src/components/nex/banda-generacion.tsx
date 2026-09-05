import { formatoDinero } from "@/lib/nex/labels";
import { useAgentes } from "@/lib/nex/queries/datos";
import { useConsumosIa, useModelosIa, useProveedoresIa } from "@/lib/nex/queries/proveedores";

/** Banda discreta que indica con qué IA, modelo y experto se generó algo. */
export function BandaGeneracion({
  proveedorId,
  modeloId,
  expertoId,
  chatId,
  tareaId,
  moneda = "EUR",
}: {
  proveedorId?: string | null;
  modeloId?: string | null;
  expertoId?: string | null;
  chatId?: string | null;
  tareaId?: string | null;
  moneda?: string;
}) {
  const { data: proveedores = [] } = useProveedoresIa();
  const { data: modelos = [] } = useModelosIa();
  const { data: agentes = [] } = useAgentes();
  const { data: consumos = [] } = useConsumosIa();

  const proveedor = proveedores.find((p) => p.id === proveedorId);
  const modelo = modelos.find((m) => m.id === modeloId);
  const experto = agentes.find((a) => a.id === expertoId);

  const propios = consumos.filter(
    (c) => (chatId && c.chat_id === chatId) || (tareaId && c.tarea_id === tareaId),
  );
  const tokens = propios.reduce((t, c) => t + Number(c.tokens_entrada) + Number(c.tokens_salida), 0);
  const coste = propios.reduce((t, c) => t + Number(c.coste), 0);

  if (!proveedor && !modelo && propios.length === 0) {
    return (
      <p className="rounded-md bg-surface px-2.5 py-1 text-[11px] text-muted-foreground">Sin datos de generación</p>
    );
  }

  return (
    <p className="rounded-md bg-surface px-2.5 py-1 text-[11px] text-muted-foreground">
      Generado con {proveedor?.nombre ?? "IA sin identificar"} · <span className="font-mono">{modelo?.identificador ?? "modelo sin identificar"}</span>{" "}
      · Experto: {experto?.nombre ?? "ninguno"} · {tokens.toLocaleString("es-ES")} tokens ·{" "}
      {formatoDinero(coste, moneda)}
    </p>
  );
}
