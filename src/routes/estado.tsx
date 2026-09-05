import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCopy } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton } from "@/components/nex/campos";
import { useAuth } from "@/lib/nex/auth";
import {
  useAgentes,
  useAlertas,
  useCredenciales,
  useIntegraciones,
  useProyectos,
  useTareas,
} from "@/lib/nex/queries/datos";
import { supabase } from "@/lib/nex/supabase";

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

async function verificarTabla(nombre: string): Promise<boolean> {
  const { error } = await supabase
    .from(nombre as "acciones")
    .select("*", { count: "exact", head: true })
    .limit(1);
  return !error;
}

async function verificarFuncion(nombre: string): Promise<boolean> {
  try {
    await supabase.functions.invoke(nombre, { body: {} });
    return true;
  } catch (err) {
    const mensaje = String((err as Error)?.message ?? err).toLowerCase();
    if (mensaje.includes("not found") || mensaje.includes("404") || mensaje.includes("no such function")) {
      return false;
    }
    return true;
  }
}

function useVerificacionesBackend(habilitado: boolean) {
  return useQuery({
    queryKey: ["verificaciones-backend"],
    enabled: habilitado,
    queryFn: async () => {
      const [acciones, plantillas, funcion] = await Promise.all([
        verificarTabla("acciones"),
        verificarTabla("plantillas_accion"),
        verificarFuncion("ejecutar-accion"),
      ]);
      return { acciones, plantillas, funcion };
    },
  });
}

function EstadoSistema() {
  const { sesion } = useAuth();
  const proyectos = useProyectos();
  const tareas = useTareas();
  const agentes = useAgentes();
  const integraciones = useIntegraciones();
  const credenciales = useCredenciales();
  const alertas = useAlertas();
  const verificaciones = useVerificacionesBackend(Boolean(sesion));

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
    {
      nombre: "Tabla de acciones",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.acciones ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.acciones
          ? "Responde correctamente"
          : "No responde o falta",
    },
    {
      nombre: "Tabla de plantillas",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.plantillas ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.plantillas
          ? "Responde correctamente"
          : "No responde o falta",
    },
    {
      nombre: "Edge Function ejecutar-accion",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.funcion ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.funcion
          ? "Disponible"
          : "No encontrada",
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
    </>
  );
}

function etiquetaNivel(nivel: Nivel) {
  return nivel === "ok" ? "Correcto" : nivel === "aviso" ? "Atención" : "Fallo";
}
