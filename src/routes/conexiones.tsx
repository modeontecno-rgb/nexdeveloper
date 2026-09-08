import {IntercambioProyectian} from '@/components/nex/intercambio-proyectian';
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock, RefreshCw } from "lucide-react";
import * as React from "react";

import { Encabezado } from "@/components/nex/app-shell";
import { Cargando } from "@/components/nex/badges";
import { Boton } from "@/components/nex/campos";
import { useConTrabajo } from "@/components/nex/indicador-trabajo";
import type { InfraServicioRow } from "@/lib/nex/db-types";
import { desde } from "@/lib/nex/labels";
import {
  CONFIGURACION_POR_TIPO,
  PUNTO_ESTADO,
  TONO_ESTADO,
  ordenarPorEstado,
  resumenConexiones,
  textoEstado,
  useComprobarConexion,
  useConexiones,
  useRealtimeConexiones,
} from "@/lib/nex/queries/conexiones";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conexiones")({
  head: () => ({
    meta: [
      { title: "Conexiones · NexDeveloper" },
      {
        name: "description",
        content: "Todo lo de fuera que usa NexDeveloper, comprobado de verdad cada diez minutos.",
      },
      { property: "og:title", content: "Conexiones · NexDeveloper" },
      {
        property: "og:description",
        content: "Todo lo de fuera que usa NexDeveloper, comprobado de verdad cada diez minutos.",
      },
    ],
  }),
  component: Conexiones,
});

type MetodoConexion = { donde?: string | null; ruta?: string | null; usos?: string[] | null };

function metodoDe(fila: InfraServicioRow): MetodoConexion {
  return (fila.metodo ?? {}) as MetodoConexion;
}

function dondeYRuta(fila: InfraServicioRow): { donde: string | null; ruta: string | null } {
  const metodo = metodoDe(fila);
  const fijo = CONFIGURACION_POR_TIPO[fila.tipo];
  return {
    donde: metodo.donde ?? fijo?.donde ?? null,
    ruta: metodo.ruta ?? fijo?.ruta ?? null,
  };
}

function Detalle({ texto, rojo }: { texto: string; rojo: boolean }) {
  const [abierto, setAbierto] = React.useState(false);
  return (
    <p className={cn("mt-1 text-xs", rojo ? "text-destructive" : "text-muted-foreground")}>
      <span className={abierto ? "" : "line-clamp-2"}>{texto}</span>
      {texto.length > 120 ? (
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="ml-1 underline hover:text-foreground"
        >
          {abierto ? "ver menos" : "ver más"}
        </button>
      ) : null}
    </p>
  );
}

function FilaConexion({ fila }: { fila: InfraServicioRow }) {
  const navigate = useNavigate();
  const comprobar = useComprobarConexion();
  const conTrabajo = useConTrabajo();
  const { donde, ruta } = dondeYRuta(fila);
  const usos = metodoDe(fila).usos ?? [];
  const problema = fila.estado === "rojo" || fila.estado === "ambar";
  const detalle = problema && fila.ultimo_error ? fila.ultimo_error : fila.ultimo_detalle;

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={cn("mt-1 size-3.5 shrink-0 rounded-full", PUNTO_ESTADO[fila.estado])} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            {fila.nombre}
            <span className={cn("text-xs", TONO_ESTADO[fila.estado])}>{textoEstado(fila.estado)}</span>
          </p>
          {detalle ? <Detalle texto={detalle} rojo={problema && Boolean(fila.ultimo_error)} /> : null}
          {donde ? <p className="mt-1 text-xs text-muted-foreground/80">Se configura en: {donde}</p> : null}
          {usos.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {usos.map((u) => (
                <li
                  key={u}
                  className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {u}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
        <span className="text-xs text-muted-foreground">
          {fila.comprobado_el ? `Comprobado ${desde(fila.comprobado_el)}` : "Sin comprobar todavía"}
        </span>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Boton
            variante="suave"
            className="w-full sm:w-auto"
            disabled={comprobar.isPending}
            onClick={() =>
              void conTrabajo(`Probando ${fila.nombre}`, async () => {
                await comprobar.mutateAsync(fila.id);
              }, { mensajeOk: "Comprobación terminada." })
            }
          >
            Probar
          </Boton>
          {fila.estado !== "verde" && ruta ? (
            <Boton
              className="w-full sm:w-auto"
              onClick={() => void navigate({ to: ruta })}
            >
              {fila.estado === "gris" ? "Conectar" : "Configurar"}
            </Boton>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function Bloque({ titulo, filas }: { titulo: string; filas: InfraServicioRow[] }) {
  if (filas.length === 0) return null;
  return (
    <section className="mb-6 min-w-0">
      <h2 className="mb-2 font-display text-sm font-semibold text-foreground">{titulo}</h2>
      <ul className="space-y-2">
        {filas.map((f) => (
          <FilaConexion key={f.id} fila={f} />
        ))}
      </ul>
    </section>
  );
}

function Conexiones() {
  const { data: filas = [], isPending } = useConexiones();
  const comprobar = useComprobarConexion();
  const conTrabajo = useConTrabajo();
  useRealtimeConexiones(true);

  const resumen = resumenConexiones(filas);

  if (isPending) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Conexiones"
        descripcion="Conexiones externas y fecha de su última comprobación"
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
              <span className="text-success">{resumen.verdes} en verde</span> ·{" "}
              <span className="text-warning">{resumen.ambar} en ámbar</span> ·{" "}
              <span className="text-destructive">{resumen.rojos} en rojo</span> · {resumen.grises} sin
              configurar
            </span>
            <Boton
              disabled={comprobar.isPending}
              onClick={() =>
                void conTrabajo("Comprobando todas las conexiones", async () => {
                  await comprobar.mutateAsync(undefined);
                }, { mensajeOk: "Comprobación terminada." })
              }
            >
              <RefreshCw className={cn("size-4", comprobar.isPending && "animate-spin")} />
              Comprobar todo ahora
            </Boton>
          </div>
        }
      />
      <IntercambioProyectian/>

      <div className="panel mb-6 flex items-start gap-3 p-4 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          Aquí no se escriben claves. Cada fila te dice dónde se configura y te lleva allí con un clic. Las
          claves nunca salen del servidor.
        </p>
      </div>

      <Bloque titulo="Cuentas y autorizaciones" filas={filas.filter((f) => f.tipo === "conexion")} />
      <Bloque
        titulo="Proveedores de IA"
        filas={ordenarPorEstado(filas.filter((f) => f.tipo === "proveedor_ia"))}
      />
      <Bloque
        titulo="Almacenes y datos"
        filas={filas.filter((f) => f.tipo === "s3" || f.tipo === "proyectian")}
      />
      <Bloque titulo="Vigilancia" filas={filas.filter((f) => f.tipo === "sentry")} />

      {filas.length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">
          Todavía no hay conexiones registradas. Pulsa «Comprobar todo ahora» para que el servidor las
          detecte.
        </p>
      ) : null}
    </>
  );
}
