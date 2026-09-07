import { createFileRoute, Link } from "@tanstack/react-router";
import { Cpu, Database, Smartphone, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado, useAccesosMovil } from "@/components/nex/app-shell";
import { DiccionarioNombres } from "@/components/nex/diccionario-nombres";
import { TarjetaPlaudConexion } from "@/routes/pideme";
import { Cargando } from "@/components/nex/badges";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { useAuth } from "@/lib/nex/auth";
import { borrarDatosDemostracion, cargarDatosDemostracion } from "@/lib/nex/demo";
import { useAjustes, usePerfil } from "@/lib/nex/queries/datos";
import { useGuardarAjustes } from "@/lib/nex/queries/mutaciones";
import {
  ACCESOS_MOVIL_POR_DEFECTO,
  TODAS_LAS_PANTALLAS,
  guardarAccesosMovil,
  type RutaMenu,
} from "@/lib/nex/menu";
import { VERSION_APP } from "@/lib/nex/version";


export const Route = createFileRoute("/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes · NexDeveloper" },
      { name: "description", content: "Umbrales de aprobación, moneda, reorganización automática y datos de prueba." },
      { property: "og:title", content: "Ajustes · NexDeveloper" },
      {
        property: "og:description",
        content: "Umbrales de aprobación, moneda, reorganización automática y datos de prueba.",
      },
    ],
  }),
  component: Ajustes,
});

function Ajustes() {
  const { data: ajustes, isPending, refetch } = useAjustes();
  const { data: perfil } = usePerfil();
  const { usuario } = useAuth();
  const guardar = useGuardarAjustes();
  const [trabajando, setTrabajando] = React.useState(false);

  const [formulario, setFormulario] = React.useState({
    umbral_aprobacion_eur: 150,
    aprobar_si_prioridad_critica: true,
    aprobar_si_riesgo_alto: true,
    umbral_confianza_reorganizacion: 85,
    reorganizacion_automatica: true,
    mesa_expertos_solo_importantes: true,
    moneda: "EUR",
  });

  React.useEffect(() => {
    if (!ajustes) return;
    setFormulario({
      umbral_aprobacion_eur: Number(ajustes.umbral_aprobacion_eur),
      aprobar_si_prioridad_critica: ajustes.aprobar_si_prioridad_critica,
      aprobar_si_riesgo_alto: ajustes.aprobar_si_riesgo_alto,
      umbral_confianza_reorganizacion: Math.round(Number(ajustes.umbral_confianza_reorganizacion) * 100),
      reorganizacion_automatica: ajustes.reorganizacion_automatica,
      mesa_expertos_solo_importantes: ajustes.mesa_expertos_solo_importantes,
      moneda: ajustes.moneda,
    });
  }, [ajustes]);

  if (isPending) return <Cargando />;

  const conDemo = async (accion: () => Promise<unknown>, ok: string) => {
    setTrabajando(true);
    try {
      await accion();
      toast.success(ok);
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se ha podido completar la operación.");
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <>
      <Encabezado titulo="Ajustes" descripcion="Todo se configura aquí dentro, sin tocar la base de datos." />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Tu cuenta</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {perfil?.nombre_completo ?? "Sin nombre"} · {perfil?.email ?? usuario?.email ?? "—"}
          </p>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Proveedores de IA</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enciende los proveedores que uses, guarda sus claves de forma cifrada, ajusta precios y decide qué modelo
            se encarga de cada tipo de trabajo.
          </p>
          <Link
            to="/ajustes/proveedores"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            <Cpu className="size-4" /> Abrir proveedores de IA
          </Link>
        </section>

        <TarjetaPlaudConexion />

        <div className="xl:col-span-2">
          <DiccionarioNombres />
        </div>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Versión</h2>
          <p className="mt-2 text-sm text-muted-foreground">NexDeveloper {VERSION_APP}</p>
        </section>

        <AccesosRapidosMovil />



        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Aprobaciones</h2>
          <div className="mt-4 space-y-4">
            <Campo etiqueta="Pedir aprobación por encima de (importe)">
              <input
                type="number"
                min={0}
                step={10}
                value={formulario.umbral_aprobacion_eur}
                onChange={(e) =>
                  setFormulario((f) => ({ ...f, umbral_aprobacion_eur: Number(e.target.value) || 0 }))
                }
                className={claseCampo}
              />
            </Campo>
            <Interruptor
              etiqueta="Pedir aprobación siempre que la prioridad sea crítica"
              valor={formulario.aprobar_si_prioridad_critica}
              onChange={(v) => setFormulario((f) => ({ ...f, aprobar_si_prioridad_critica: v }))}
            />
            <Interruptor
              etiqueta="Pedir aprobación siempre que el riesgo sea alto"
              valor={formulario.aprobar_si_riesgo_alto}
              onChange={(v) => setFormulario((f) => ({ ...f, aprobar_si_riesgo_alto: v }))}
            />
            <Interruptor
              etiqueta="Consultar a varios agentes solo en decisiones importantes"
              valor={formulario.mesa_expertos_solo_importantes}
              onChange={(v) => setFormulario((f) => ({ ...f, mesa_expertos_solo_importantes: v }))}
            />
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Organización automática</h2>
          <div className="mt-4 space-y-4">
            <Interruptor
              etiqueta="Colocar cada orden en su proyecto automáticamente"
              valor={formulario.reorganizacion_automatica}
              onChange={(v) => setFormulario((f) => ({ ...f, reorganizacion_automatica: v }))}
            />
            <Campo
              etiqueta="Confianza mínima para mover algo sin preguntar (%)"
              pista="Por debajo de este porcentaje te preguntaremos antes de cambiar una orden de proyecto."
            >
              <input
                type="number"
                min={50}
                max={100}
                value={formulario.umbral_confianza_reorganizacion}
                onChange={(e) =>
                  setFormulario((f) => ({ ...f, umbral_confianza_reorganizacion: Number(e.target.value) || 0 }))
                }
                className={claseCampo}
              />
            </Campo>
            <Campo etiqueta="Moneda">
              <select
                value={formulario.moneda}
                onChange={(e) => setFormulario((f) => ({ ...f, moneda: e.target.value }))}
                className={claseCampo}
              >
                <option value="EUR">Euro (EUR)</option>
                <option value="USD">Dólar (USD)</option>
                <option value="GBP">Libra (GBP)</option>
              </select>
            </Campo>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Datos de demostración</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Carga ocho proyectos con tareas, agentes y actividad para ver la aplicación en funcionamiento. Puedes
            borrarlos cuando quieras: solo se eliminan los datos de ejemplo.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Boton
              variante="suave"
              disabled={trabajando}
              onClick={() => void conDemo(cargarDatosDemostracion, "Datos de demostración cargados.")}
            >
              <Database className="size-4" /> Cargar datos de demostración
            </Boton>
            <Boton
              variante="peligro"
              disabled={trabajando}
              onClick={() => void conDemo(borrarDatosDemostracion, "Datos de demostración borrados.")}
            >
              <Trash2 className="size-4" /> Borrar datos de demostración
            </Boton>
          </div>
        </section>
      </div>

      <div className="mt-6">
        <Boton
          disabled={guardar.isPending}
          onClick={() =>
            guardar.mutate(
              { ...formulario, umbral_confianza_reorganizacion: formulario.umbral_confianza_reorganizacion / 100 },
              { onSuccess: () => void refetch() },
            )
          }
        >
          Guardar ajustes
        </Boton>
      </div>
    </>
  );
}

function Interruptor({
  etiqueta,
  valor,
  onChange,
}: {
  etiqueta: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        checked={valor}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-input accent-primary"
      />
      <span className="text-muted-foreground">{etiqueta}</span>
    </label>
  );
}

/** Elige los cuatro accesos de la barra inferior del móvil. */
function AccesosRapidosMovil() {
  const actuales = useAccesosMovil();
  const [seleccion, setSeleccion] = React.useState<RutaMenu[]>(actuales);

  React.useEffect(() => {
    setSeleccion(actuales);
  }, [actuales]);

  const cambiar = (indice: number, ruta: RutaMenu) => {
    const copia = [...seleccion];
    copia[indice] = ruta;
    setSeleccion(copia);
  };

  return (
    <section className="panel p-5">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
        <Smartphone className="size-4" /> Accesos rápidos del móvil
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Elige las cuatro pantallas de la barra inferior del móvil. La quinta posición es siempre el botón «Menú».
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Campo key={i} etiqueta={`Acceso ${i + 1}`}>
            <select
              value={seleccion[i] ?? ""}
              onChange={(e) => cambiar(i, e.target.value as RutaMenu)}
              className={claseCampo}
            >
              {TODAS_LAS_PANTALLAS.map((p) => (
                <option key={p.to} value={p.to}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Boton
          onClick={() => {
            guardarAccesosMovil(seleccion);
            toast.success("Accesos rápidos guardados.");
          }}
        >
          Guardar accesos
        </Boton>
        <Boton
          variante="suave"
          onClick={() => {
            setSeleccion(ACCESOS_MOVIL_POR_DEFECTO);
            guardarAccesosMovil(ACCESOS_MOVIL_POR_DEFECTO);
            toast.success("Accesos rápidos restaurados.");
          }}
        >
          Restaurar los de fábrica
        </Boton>
      </div>
    </section>
  );
}
