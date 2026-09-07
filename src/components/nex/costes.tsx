import { Clock, Coins, Users } from "lucide-react";

import {
  creditosDesdeEuros,
  estimarMercado,
  formatoCreditos,
  formatoDuracion,
  formatoTokens,
  horasDesdeMs,
  useParametrosCoste,
} from "@/lib/nex/costes";
import { formatoEuros } from "@/lib/nex/labels";
import { useCostesProyecto } from "@/lib/nex/queries/costes";

/** Distingue de un vistazo lo medido de lo estimado. */
export function EtiquetaDato({ tipo }: { tipo: "real" | "estimado" }) {
  return tipo === "real" ? (
    <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
      Real
    </span>
  ) : (
    <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      Estimado
    </span>
  );
}

function Celda({
  titulo,
  valor,
  detalle,
  tipo,
}: {
  titulo: string;
  valor: string;
  detalle?: string | undefined;
  tipo: "real" | "estimado";
}) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <EtiquetaDato tipo={tipo} />
      </div>
      <p className="mt-1 font-display text-lg font-semibold">{valor}</p>
      {detalle ? <p className="text-xs text-muted-foreground">{detalle}</p> : null}
    </div>
  );
}

export type PanelCostesProps = {
  titulo?: string;
  /** Gasto real en euros ya facturado por los modelos. */
  costeEur?: number | null;
  tokensEntrada?: number | null;
  tokensSalida?: number | null;
  /** Tiempo real que ha tardado, en milisegundos. */
  duracionMs?: number | null;
  /** Horas reales ya consumidas (si el trabajo las registra). */
  horasReales?: number | null;
  /** Horas estimadas del plan, para la comparativa de mercado. */
  horasEstimadas?: number | null;
  /** Coste estimado del plan, en euros. */
  costeEstimado?: number | null;
};

/**
 * Muestra lo que ha costado de verdad (créditos, tokens, euros y tiempo)
 * y, al lado, lo que costaría en la calle con programadores humanos.
 */
export function PanelCostes({
  titulo = "Coste real y comparativa",
  costeEur,
  tokensEntrada,
  tokensSalida,
  duracionMs,
  horasReales,
  horasEstimadas,
  costeEstimado,
}: PanelCostesProps) {
  const parametros = useParametrosCoste();
  const coste = Number(costeEur ?? 0);
  const creditos = creditosDesdeEuros(coste, parametros);
  const tokens = Number(tokensEntrada ?? 0) + Number(tokensSalida ?? 0);
  const horasIaReales = horasReales ?? horasDesdeMs(Number(duracionMs ?? 0));
  const baseMercado = Number(horasEstimadas ?? 0) > 0 ? Number(horasEstimadas) : horasIaReales;
  const mercado = estimarMercado(baseMercado, parametros);
  const ahorro = mercado.coste - coste;

  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold">{titulo}</h3>
        <p className="text-xs text-muted-foreground">
          Las cifras «Real» son medidas; las «Estimado» son cálculos con tus parámetros de Ajustes.
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Celda
          titulo="Créditos consumidos"
          valor={formatoCreditos(creditos)}
          detalle={`${formatoEuros(coste)} · ${parametros.eurosPorCredito.toFixed(2).replace(".", ",")} € por crédito`}
          tipo="real"
        />
        <Celda
          titulo="Tokens"
          valor={formatoTokens(tokens)}
          detalle={`${formatoTokens(tokensEntrada)} de entrada · ${formatoTokens(tokensSalida)} de salida`}
          tipo="real"
        />
        <Celda
          titulo="Tiempo real"
          valor={duracionMs ? formatoDuracion(Number(duracionMs)) : horasIaReales ? `${horasIaReales.toFixed(1)} h` : "—"}
          detalle="Desde que empezó hasta que terminó"
          tipo="real"
        />
        <Celda
          titulo="Coste estimado del plan"
          valor={costeEstimado != null ? formatoEuros(Number(costeEstimado)) : "—"}
          detalle={horasEstimadas != null ? `${Number(horasEstimadas).toFixed(1)} h previstas` : undefined}
          tipo="estimado"
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Celda
          titulo="Con programadores humanos"
          valor={formatoEuros(mercado.coste)}
          detalle={`${parametros.tarifaMercadoEurHora} €/h de mercado`}
          tipo="estimado"
        />
        <Celda
          titulo="Plazo humano"
          valor={mercado.horas > 0 ? `${mercado.horas.toFixed(1)} h` : "—"}
          detalle={`${parametros.factorHumano}× las horas del plan`}
          tipo="estimado"
        />
        <Celda
          titulo="Diferencia"
          valor={ahorro > 0 ? `−${formatoEuros(ahorro)}` : formatoEuros(0)}
          detalle="Lo que te ahorras frente al mercado"
          tipo="estimado"
        />
      </div>

      <ul className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <li className="inline-flex items-center gap-1">
          <Coins className="size-3" /> Créditos y tokens medidos en cada llamada
        </li>
        <li className="inline-flex items-center gap-1">
          <Clock className="size-3" /> Tiempo medido de principio a fin
        </li>
        <li className="inline-flex items-center gap-1">
          <Users className="size-3" /> Precio de mercado configurable en Ajustes
        </li>
      </ul>
    </section>
  );
}

/** Resumen real de créditos, tokens y tiempo de IA de un proyecto. */
export function PanelCostesProyecto({
  proyectoId,
  horasEstimadas,
  costeEstimado,
}: {
  proyectoId: string;
  horasEstimadas?: number | null;
  costeEstimado?: number | null;
}) {
  const { data } = useCostesProyecto(proyectoId);
  return (
    <PanelCostes
      titulo="Coste real del proyecto y comparativa de mercado"
      costeEur={data?.coste ?? 0}
      tokensEntrada={data?.tokensEntrada ?? 0}
      tokensSalida={data?.tokensSalida ?? 0}
      duracionMs={data?.duracionMs ?? 0}
      horasEstimadas={horasEstimadas ?? null}
      costeEstimado={costeEstimado ?? null}
    />
  );
}
