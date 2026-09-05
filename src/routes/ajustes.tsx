import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { useNex } from "@/lib/nex/store";

export const Route = createFileRoute("/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes · NexDeveloper" },
      { name: "description", content: "Datos de la organización, presupuestos, umbrales de aprobación y bandeja sin clasificar." },
      { property: "og:title", content: "Ajustes · NexDeveloper" },
      { property: "og:description", content: "Configura presupuestos, umbrales de aprobación y organización de tareas." },
    ],
  }),
  component: Ajustes,
});

const CLAVE_AJUSTES = "nexdeveloper-ajustes-v1";

interface Config {
  organizacion: string;
  moneda: string;
  umbralAprobacion: number;
  tareasParalelas: number;
  reorganizacionAutomatica: boolean;
  confianzaMinima: number;
}

const POR_DEFECTO: Config = {
  organizacion: "Mi organización",
  moneda: "EUR",
  umbralAprobacion: 150,
  tareasParalelas: 4,
  reorganizacionAutomatica: true,
  confianzaMinima: 80,
};

function Ajustes() {
  const nex = useNex();
  const [config, setConfig] = React.useState<Config>(POR_DEFECTO);

  React.useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(CLAVE_AJUSTES);
      if (bruto) setConfig({ ...POR_DEFECTO, ...JSON.parse(bruto) });
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  const guardar = () => {
    window.localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(config));
    toast.success("Ajustes guardados");
  };

  const sinClasificar = nex.tareas.filter((t) => !nex.proyectos.some((p) => p.id === t.proyectoId));

  return (
    <>
      <Encabezado titulo="Ajustes" descripcion="Todo se configura aquí dentro, sin salir de la aplicación." />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel p-4">
          <h2 className="font-display text-sm font-semibold">Organización y presupuesto</h2>
          <div className="mt-3 space-y-3">
            <Texto etiqueta="Nombre de la organización" valor={config.organizacion} onChange={(v) => setConfig({ ...config, organizacion: v })} />
            <Texto etiqueta="Moneda" valor={config.moneda} onChange={(v) => setConfig({ ...config, moneda: v })} />
            <Numero
              etiqueta="Aprobación obligatoria a partir de (€)"
              valor={config.umbralAprobacion}
              onChange={(v) => setConfig({ ...config, umbralAprobacion: v })}
            />
            <Numero
              etiqueta="Máximo de tareas en paralelo por agente"
              valor={config.tareasParalelas}
              onChange={(v) => setConfig({ ...config, tareasParalelas: v })}
            />
          </div>
        </section>

        <section className="panel p-4">
          <h2 className="font-display text-sm font-semibold">Organización inteligente</h2>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.reorganizacionAutomatica}
              onChange={(e) => setConfig({ ...config, reorganizacionAutomatica: e.target.checked })}
              className="size-4 accent-[oklch(0.78_0.13_188)]"
            />
            Recolocar automáticamente cuando el proyecto correcto sea evidente
          </label>
          <div className="mt-3">
            <Numero
              etiqueta="Confianza mínima para mover sin preguntar (%)"
              valor={config.confianzaMinima}
              onChange={(v) => setConfig({ ...config, confianzaMinima: v })}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Por debajo de esa confianza no se mueve nada: se avisa y se pide confirmación. Todo traslado queda
            registrado con su origen.
          </p>

          <h3 className="mt-5 font-display text-sm font-semibold">Bandeja «Sin clasificar»</h3>
          {sinClasificar.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No hay elementos sin asignación segura.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {sinClasificar.map((t) => (
                <li key={t.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                  {t.titulo}
                  <select
                    className="ml-2 rounded-md border border-input bg-surface px-2 py-1 text-xs"
                    defaultValue=""
                    onChange={(e) => e.target.value && nex.moverTarea(t.id, e.target.value)}
                  >
                    <option value="">Mover a…</option>
                    {nex.proyectos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-4 xl:col-span-2">
          <h2 className="font-display text-sm font-semibold">Datos y conexiones</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ahora mismo la aplicación funciona con datos de demostración guardados en este navegador. Para trabajar con
            tu base de datos propia y con GitHub hacen falta dos autorizaciones que solo puedes dar tú desde el propio
            editor del proyecto: enlazar tu cuenta de base de datos y autorizar GitHub para crear el repositorio privado
            «nexdeveloper». Después, esta pantalla permitirá gestionar el resto de parámetros sin salir de aquí.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={guardar} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Guardar ajustes
            </button>
            <button
              type="button"
              onClick={() => {
                nex.reiniciarDemo();
                toast.info("Datos de demostración restaurados");
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
            >
              Restaurar datos de demostración
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

function Texto({ etiqueta, valor, onChange }: { etiqueta: string; valor: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs text-muted-foreground">
      {etiqueta}
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground"
      />
    </label>
  );
}

function Numero({ etiqueta, valor, onChange }: { etiqueta: string; valor: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-xs text-muted-foreground">
      {etiqueta}
      <input
        type="number"
        value={valor}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground"
      />
    </label>
  );
}
