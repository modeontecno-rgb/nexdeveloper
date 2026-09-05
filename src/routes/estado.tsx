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
import { VERSION_APP } from "@/lib/nex/version";

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
      const [
        acciones,
        plantillas,
        funcion,
        proveedores,
        modelos,
        consumos,
        funcionProveedor,
        rendimiento,
        funcionCanva,
        expertos,
        funcionBarrer,
        funcionPublicar,
        controles,
        ejecuciones,
        resultados,
        revisiones,
        funcionCalidad,
      ] = await Promise.all([
        verificarTabla("acciones"),
        verificarTabla("plantillas_accion"),
        verificarFuncion("ejecutar-accion"),
        verificarTabla("proveedores_ia"),
        verificarTabla("modelos_ia"),
        verificarTabla("consumos_ia"),
        verificarFuncion("probar-proveedor"),
        verificarTabla("v_rendimiento_modelos"),
        verificarFuncion("canva-oauth"),
        verificarTabla("expertos"),
        verificarFuncion("barrer-expertos"),
        verificarFuncion("publicar-experto"),
        verificarTabla("controles_calidad"),
        verificarTabla("ejecuciones_calidad"),
        verificarTabla("resultados_calidad"),
        verificarTabla("revisiones_orden"),
        verificarFuncion("calidad-github"),
      ]);
      return {
        acciones,
        plantillas,
        funcion,
        proveedores,
        modelos,
        consumos,
        funcionProveedor,
        rendimiento,
        funcionCanva,
        expertos,
        funcionBarrer,
        funcionPublicar,
        controles,
        ejecuciones,
        resultados,
        revisiones,
        funcionCalidad,
      };
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
    {
      nombre: "Catálogo de proveedores de IA",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.proveedores ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.proveedores
          ? "Responde correctamente"
          : "No responde o falta",
    },
    {
      nombre: "Catálogo de modelos",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.modelos ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.modelos
          ? "Responde correctamente"
          : "No responde o falta",
    },
    {
      nombre: "Registro de consumo",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.consumos ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.consumos
          ? "Responde correctamente"
          : "No responde o falta",
    },
    {
      nombre: "Edge Function probar-proveedor",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.funcionProveedor ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.funcionProveedor
          ? "Disponible"
          : "No encontrada",
    },
    {
      nombre: "Rendimiento de modelos",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.rendimiento ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.rendimiento
          ? "Responde correctamente"
          : "Falta la vista v_rendimiento_modelos",
    },
    {
      nombre: "Catálogo de controles de calidad",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.controles ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.controles
          ? "Responde correctamente"
          : "Falta la tabla controles_calidad (migración 007)",
    },
    {
      nombre: "Comprobaciones de calidad",
      nivel:
        verificaciones.isPending
          ? "aviso"
          : verificaciones.data?.ejecuciones && verificaciones.data?.resultados
            ? "ok"
            : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.ejecuciones && verificaciones.data?.resultados
          ? "Responde correctamente"
          : "Faltan ejecuciones_calidad o resultados_calidad",
    },
    {
      nombre: "Revisiones previas de órdenes",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.revisiones ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.revisiones
          ? "Responde correctamente"
          : "Falta la tabla revisiones_orden",
    },
    {
      nombre: "Edge Function calidad-github",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.funcionCalidad ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.funcionCalidad
          ? "Disponible"
          : "No encontrada",
    },
    {
      nombre: "Edge Function canva-oauth",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.funcionCanva ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.funcionCanva
          ? "Disponible"
          : "No encontrada",
    },
    {
      nombre: "Directorio de expertos",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.expertos ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.expertos
          ? "Responde correctamente"
          : "Falta la tabla expertos (migración 006)",
    },
    {
      nombre: "Barrido semanal de la red",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.funcionBarrer ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.funcionBarrer
          ? "Disponible; programado los lunes a las 07:00"
          : "Falta la función barrer-expertos",
    },
    {
      nombre: "Publicación de expertos en GitHub",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.funcionPublicar ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.funcionPublicar
          ? "Disponible"
          : "Falta la función publicar-experto",
    },
    {
      nombre: "Versión de la aplicación",
      nivel: "ok",
      detalle: `NexDeveloper ${VERSION_APP}`,
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
