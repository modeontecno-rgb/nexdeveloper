import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import * as React from "react";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando } from "@/components/nex/badges";
import { claseCampo } from "@/components/nex/campos";
import { PoliticaEnrutado } from "@/components/nex/politica-enrutado";
import { TarjetaProveedor } from "@/components/nex/tarjeta-proveedor";
import { useAjustes } from "@/lib/nex/queries/datos";
import {
  useConsumosIa,
  useModelosIa,
  usePoliticaEnrutado,
  useProveedoresIa,
  useRendimientoModelos,
  useSembrarProveedores,
} from "@/lib/nex/queries/proveedores";

export const Route = createFileRoute("/ajustes_/proveedores")({
  head: () => ({
    meta: [
      { title: "Proveedores de IA · NexDeveloper" },
      {
        name: "description",
        content: "Activa proveedores de IA, guarda sus claves cifradas, ajusta precios y decide qué modelo hace cada trabajo.",
      },
      { property: "og:title", content: "Proveedores de IA · NexDeveloper" },
      {
        property: "og:description",
        content: "Activa proveedores de IA, guarda sus claves cifradas, ajusta precios y decide qué modelo hace cada trabajo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Proveedores,
});

function Proveedores() {
  const { data: proveedores = [], isPending } = useProveedoresIa();
  const { data: modelos = [] } = useModelosIa();
  const { data: politica = [] } = usePoliticaEnrutado();
  const { data: consumos = [] } = useConsumosIa();
  const { data: rendimiento = [] } = useRendimientoModelos();
  const { data: ajustes } = useAjustes();
  const [busqueda, setBusqueda] = React.useState("");
  const [soloActivos, setSoloActivos] = React.useState(false);

  useSembrarProveedores(!isPending && proveedores.length === 0);

  const moneda = ajustes?.moneda ?? "EUR";
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const gastoPorProveedor = React.useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of consumos) {
      if (!c.proveedor_id || c.created_at < inicioMes) continue;
      mapa.set(c.proveedor_id, (mapa.get(c.proveedor_id) ?? 0) + Number(c.coste));
    }
    return mapa;
  }, [consumos, inicioMes]);

  const visibles = proveedores.filter(
    (p) =>
      (!soloActivos || p.activo) && p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()),
  );

  if (isPending) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Proveedores de IA"
        descripcion="Enciende los proveedores que uses, guarda sus claves de forma cifrada y decide qué modelo se encarga de cada tipo de trabajo."
      />

      <Link to="/ajustes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Volver a Ajustes
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar proveedor"
          className={`${claseCampo} max-w-xs`}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          Solo los activos
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {visibles.map((p) => (
          <TarjetaProveedor
            key={p.id}
            proveedor={p}
            modelos={modelos.filter((m) => m.proveedor_id === p.id)}
            gastoMes={gastoPorProveedor.get(p.id) ?? 0}
            moneda={moneda}
          />
        ))}
        {visibles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay proveedores que coincidan con la búsqueda.</p>
        ) : null}
      </div>

      <div className="mt-6">
        <PoliticaEnrutado
          politica={politica}
          modelos={modelos}
          proveedores={proveedores}
          rendimiento={rendimiento}
        />
      </div>
    </>
  );
}
