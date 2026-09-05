import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import * as React from "react";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando } from "@/components/nex/badges";
import { ETIQUETA_TAREA_IA } from "@/lib/nex/enrutado";
import { formatoDinero } from "@/lib/nex/labels";
import { useAgentes, useAjustes } from "@/lib/nex/queries/datos";
import { useConsumosIa, useModelosIa, useProveedoresIa } from "@/lib/nex/queries/proveedores";

export const Route = createFileRoute("/referencia")({
  head: () => ({
    meta: [
      { title: "Referencia de uso · NexDeveloper" },
      {
        name: "description",
        content: "Qué combinación de IA, modelo y experto te ha dado mejor resultado por coste en cada tipo de trabajo.",
      },
      { property: "og:title", content: "Referencia de uso · NexDeveloper" },
      {
        property: "og:description",
        content: "Qué combinación de IA, modelo y experto te ha dado mejor resultado por coste en cada tipo de trabajo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Referencia,
});

type Fila = {
  clave: string;
  trabajo: string;
  proveedor: string;
  modelo: string;
  experto: string;
  usos: number;
  correctos: number;
  tokens: number;
  coste: number;
};

function Referencia() {
  const { data: consumos = [], isPending } = useConsumosIa();
  const { data: modelos = [] } = useModelosIa();
  const { data: proveedores = [] } = useProveedoresIa();
  const { data: agentes = [] } = useAgentes();
  const { data: ajustes } = useAjustes();
  const moneda = ajustes?.moneda ?? "EUR";

  const filas = React.useMemo<Fila[]>(() => {
    const mapa = new Map<string, Fila>();
    for (const c of consumos) {
      const modelo = modelos.find((m) => m.id === c.modelo_id);
      const proveedor = proveedores.find((p) => p.id === c.proveedor_id);
      const experto = agentes.find((a) => a.id === c.experto_id);
      const trabajoCodigo = modelo?.tareas_aconsejadas[0] ?? "general";
      const clave = `${trabajoCodigo}|${c.modelo_id ?? "-"}|${c.experto_id ?? "-"}`;
      const fila =
        mapa.get(clave) ??
        {
          clave,
          trabajo: ETIQUETA_TAREA_IA[trabajoCodigo] ?? "General",
          proveedor: proveedor?.nombre ?? "Sin identificar",
          modelo: modelo?.nombre ?? "Sin identificar",
          experto: experto?.nombre ?? "Ninguno",
          usos: 0,
          correctos: 0,
          tokens: 0,
          coste: 0,
        };
      fila.usos += 1;
      if (c.resultado === "ok") fila.correctos += 1;
      fila.tokens += Number(c.tokens_entrada) + Number(c.tokens_salida);
      fila.coste += Number(c.coste);
      mapa.set(clave, fila);
    }
    return [...mapa.values()].sort((a, b) => b.usos - a.usos);
  }, [consumos, modelos, proveedores, agentes]);

  const mejor = React.useMemo(() => {
    const candidatas = filas.filter((f) => f.usos >= 3);
    return [...candidatas].sort((a, b) => {
      const ta = a.correctos / a.usos - a.coste / a.usos / 100;
      const tb = b.correctos / b.usos - b.coste / b.usos / 100;
      return tb - ta;
    })[0];
  }, [filas]);

  if (isPending) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Referencia de uso"
        descripcion="Lo que has usado de verdad: aciertos, tokens y coste por combinación de IA, modelo y experto."
      />

      {mejor ? (
        <section className="panel mb-6 flex items-start gap-3 p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-success/15 text-success ring-1 ring-success/30">
            <Trophy className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-sm font-semibold">Lo que mejor te ha funcionado</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Para {mejor.trabajo.toLowerCase()}: <span className="text-foreground">{mejor.proveedor}</span> con{" "}
              <span className="text-foreground">{mejor.modelo}</span> y el experto{" "}
              <span className="text-foreground">{mejor.experto}</span>.{" "}
              {Math.round((mejor.correctos / mejor.usos) * 100)}% de aciertos en {mejor.usos} usos, a una media de{" "}
              {formatoDinero(mejor.coste / mejor.usos, moneda)} por uso.
            </p>
          </div>
        </section>
      ) : null}

      <section className="panel overflow-x-auto p-1">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Tipo de trabajo</th>
              <th className="px-4 py-3 font-medium">IA</th>
              <th className="px-4 py-3 font-medium">Modelo</th>
              <th className="px-4 py-3 font-medium">Experto</th>
              <th className="px-4 py-3 text-right font-medium">Usos</th>
              <th className="px-4 py-3 text-right font-medium">Aciertos</th>
              <th className="px-4 py-3 text-right font-medium">Tokens</th>
              <th className="px-4 py-3 text-right font-medium">Coste</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave} className="border-t border-border">
                <td className="px-4 py-3">{f.trabajo}</td>
                <td className="px-4 py-3">{f.proveedor}</td>
                <td className="px-4 py-3">{f.modelo}</td>
                <td className="px-4 py-3">{f.experto}</td>
                <td className="px-4 py-3 text-right">{f.usos}</td>
                <td className="px-4 py-3 text-right">{Math.round((f.correctos / f.usos) * 100)}%</td>
                <td className="px-4 py-3 text-right">{f.tokens.toLocaleString("es-ES")}</td>
                <td className="px-4 py-3 text-right">{formatoDinero(f.coste, moneda)}</td>
              </tr>
            ))}
            {filas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Todavía no hay uso registrado. En cuanto trabajes con un modelo, aparecerá aquí.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
