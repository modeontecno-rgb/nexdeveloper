import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCopy } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton } from "@/components/nex/campos";
import { useAuth } from "@/lib/nex/auth";
import { SQL_ACCIONES_Y_ATENCION } from "@/lib/nex/migracion-sql";
import {
  useAgentes,
  useAlertas,
  useCredenciales,
  useIntegraciones,
  useProyectos,
  useTareas,
} from "@/lib/nex/queries/datos";

export const Route = createFileRoute("/estado")({
  head: () => ({
    meta: [
      { title: "Estado del sistema · NexDeveloper" },
      { name: "description", content: "Semáforos de cada pieza del sistema e informe de estado en texto plano." },
      { property: "og:title", content: "Estado del sistema · NexDeveloper" },
      { property: "og:description", content: "Semáforos de cada pieza del sistema e informe de estado en texto plano." },
    ],
  }),
  component: EstadoSistema,
});

type Nivel = "ok" | "aviso" | "error";

function EstadoSistema() {
  const { sesion } = useAuth();
  const proyectos = useProyectos();
  const tareas = useTareas();
  const agentes = useAgentes();
  const integraciones = useIntegraciones();
  const credenciales = useCredenciales();
  const alertas = useAlertas();

  const piezas: { nombre: string; nivel: Nivel; detalle: string }[] = [
    {
      nombre: "Acceso y sesión",
      nivel: sesion ? "ok" : "error",
      detalle: sesion ? "Sesión válida" : "Sin sesión activa",
    },
    {
      nombre: "Base de datos",
      nivel: proyectos.isError ? "error" : proyectos.isPending ? "aviso" : "ok",
      detalle: proyectos.isError
        ? "No responde"
        : `${proyectos.data?.length ?? 0} proyectos, ${tareas.data?.length ?? 0} tareas`,
    },
    {
      nombre: "Datos en tiempo real",
      nivel: sesion ? "ok" : "aviso",
      detalle: sesion ? "Suscripción activa" : "Inactiva sin sesión",
    },
    {
      nombre: "Catálogo de agentes",
      nivel: (agentes.data?.length ?? 0) === 0 ? "aviso" : "ok",
      detalle: `${agentes.data?.filter((a) => a.conectado).length ?? 0} conectados de ${agentes.data?.length ?? 0}`,
    },
    {
      nombre: "Integraciones",
      nivel: (integraciones.data?.filter((i) => i.conectada).length ?? 0) === 0 ? "aviso" : "ok",
      detalle: `${integraciones.data?.filter((i) => i.conectada).length ?? 0} conectadas de ${integraciones.data?.length ?? 0}`,
    },
    {
      nombre: "Credenciales",
      nivel: (credenciales.data?.some((c) => !c.configurado) ?? false) ? "aviso" : "ok",
      detalle: `${credenciales.data?.filter((c) => c.configurado).length ?? 0} configuradas de ${credenciales.data?.length ?? 0}`,
    },
    {
      nombre: "Alertas abiertas",
      nivel: (alertas.data?.some((a) => a.nivel === "critico") ?? false)
        ? "error"
        : (alertas.data?.length ?? 0) > 0
          ? "aviso"
          : "ok",
      detalle: `${alertas.data?.length ?? 0} sin resolver`,
    },
  ];

  const copiar = async () => {
    const informe = [
      "Informe de estado de NexDeveloper",
      new Date().toLocaleString("es-ES"),
      "",
      ...piezas.map((p) => `- ${p.nombre}: ${etiquetaNivel(p.nivel)} (${p.detalle})`),
      "",
      "Nota: este informe nunca incluye contraseñas ni claves.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(informe);
      toast.success("Informe copiado al portapapeles.");
    } catch {
      toast.error("Tu navegador no ha permitido copiar el informe.");
    }
  };

  return (
    <>
      <Encabezado
        titulo="Estado del sistema"
        descripcion="Un semáforo por cada pieza. El informe no contiene nunca contraseñas ni claves."
        acciones={
          <Boton variante="suave" onClick={() => void copiar()}>
            <ClipboardCopy className="size-4" /> Copiar informe
          </Boton>
        }
      />

      <div className="grid gap-3 md:grid-cols-2">
        {piezas.map((p) => (
          <article key={p.nombre} className="panel flex items-center justify-between gap-3 p-4">
            <div>
              <h2 className="text-sm font-medium text-foreground">{p.nombre}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{p.detalle}</p>
            </div>
            <span className="flex items-center gap-2 text-xs">
              <span
                className={
                  p.nivel === "ok"
                    ? "size-2.5 rounded-full bg-success"
                    : p.nivel === "aviso"
                      ? "size-2.5 rounded-full bg-warning"
                      : "size-2.5 rounded-full bg-destructive"
                }
              />
              {etiquetaNivel(p.nivel)}
            </span>
          </article>
        ))}
      </div>

      <section className="panel mt-6 p-5">
        <h2 className="font-display text-sm font-semibold">Cambios que no se pueden hacer desde aquí</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Crear tablas o columnas nuevas, activar extensiones de la base de datos y publicar funciones de servidor son
          las únicas tareas que hay que hacer fuera de la aplicación. Todo lo demás (umbrales, claves, plantillas,
          moneda) se configura en Ajustes.
        </p>

        <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="text-sm text-warning">
            Si las acciones reales, el bloque «Requiere tu atención» o las vistas previas incrustadas aparecen vacíos,
            copia estas instrucciones y pégalas una sola vez en el editor de consultas de tu base de datos.
          </p>
          <Boton
            variante="suave"
            className="mt-3"
            onClick={() => {
              void navigator.clipboard.writeText(SQL_ACCIONES_Y_ATENCION);
              toast.success("Instrucciones copiadas.");
            }}
          >
            <ClipboardCopy className="size-4" /> Copiar instrucciones
          </Boton>
        </div>

        <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
          {SQL_ACCIONES_Y_ATENCION}
        </pre>
      </section>

    </>
  );
}

function etiquetaNivel(nivel: Nivel) {
  return nivel === "ok" ? "Correcto" : nivel === "aviso" ? "Atención" : "Fallo";
}
