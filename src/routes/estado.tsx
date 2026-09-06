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
import { useComprobarSecretos } from "@/lib/nex/queries/copias";
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

const NOMBRES_SECRETOS = [
  "GITHUB_TOKEN",
  "CUENTA_SUPABASE_TOKEN",
  "SENTRY_DSN",
  "SENTRY_AUTH_TOKEN",
  "CANVA_CLIENT_ID",
  "CANVA_CLIENT_SECRET",
] as const;

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
        repositorios,
        repositorioSubidas,
        funcionRepos,
        copias,
        funcionCopias,
        compilaciones,
        plantillasCompilacion,
        funcionCompilar,
        dominios,
        dominiosHistorial,
        funcionDominios,
        bandejaEntradas,
        bandejaFuentes,
        funcionBandeja,
        vigilanciaConfig,
        vigilanciaLotes,
        vigilanciaHallazgos,
        competidores,
        funcionVigilar,
        tablaResumenes,
        tablaResumenesConfig,
        funcionResumenes,
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
        verificarTabla("repositorios"),
        verificarTabla("repositorio_subidas"),
        verificarFuncion("github-repos"),
        verificarTabla("copias"),
        verificarFuncion("copias-generar"),
        verificarTabla("compilaciones"),
        verificarTabla("plantillas_compilacion"),
        verificarFuncion("compilar-app"),
        verificarTabla("dominios"),
        verificarTabla("dominios_historial"),
        verificarFuncion("dominios-comprobar"),
        verificarTabla("bandeja_entradas"),
        verificarTabla("bandeja_fuentes"),
        verificarFuncion("bandeja"),
        verificarTabla("vigilancia_config"),
        verificarTabla("vigilancia_lotes"),
        verificarTabla("vigilancia_hallazgos"),
        verificarTabla("competidores"),
        verificarFuncion("vigilar"),
        verificarTabla("resumenes"),
        verificarTabla("resumenes_config"),
        verificarFuncion("resumenes"),
      ]);
      const pingVigilar = await (async () => {
        try {
          const { data } = await supabase.functions.invoke("vigilar", { body: {} });
          return (data as { buscador?: string | null } | null)?.buscador ?? null;
        } catch {
          return null;
        }
      })();
      const pingBandeja = await (async () => {
        try {
          const { data } = await supabase.functions.invoke("bandeja", { body: {} });
          const r = data as { google_oauth?: boolean; clasificador_ia?: string | null } | null;
          return { googleOauth: Boolean(r?.google_oauth), clasificador: r?.clasificador_ia ?? null };
        } catch {
          return { googleOauth: false, clasificador: null as string | null };
        }
      })();
      const pingCompilar = await (async () => {
        try {
          const { data } = await supabase.functions.invoke("compilar-app", { body: {} });
          return Boolean((data as { github?: boolean } | null)?.github);
        } catch {
          return false;
        }
      })();
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
        repositorios,
        repositorioSubidas,
        funcionRepos,
        copias,
        funcionCopias,
        compilaciones,
        plantillasCompilacion,
        funcionCompilar,
        dominios,
        dominiosHistorial,
        funcionDominios,
        bandejaEntradas,
        bandejaFuentes,
        funcionBandeja,
        vigilanciaConfig,
        vigilanciaLotes,
        vigilanciaHallazgos,
        competidores,
        funcionVigilar,
        pingVigilar,
        tablaResumenes,
        tablaResumenesConfig,
        funcionResumenes,
        pingBandeja,
        pingCompilar,
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
  const secretos = useComprobarSecretos(Boolean(sesion));

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
      nombre: "Tabla de dominios",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.dominios ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.dominios
          ? "Conectado / OK"
          : "No responde o falta (migración 012)",
    },
    {
      nombre: "Historial de dominios",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.dominiosHistorial ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.dominiosHistorial
          ? "Conectado / OK"
          : "No responde o falta (migración 012)",
    },
    {
      nombre: "Edge Function dominios-comprobar",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.funcionDominios ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.funcionDominios
          ? "Conectado / OK"
          : "No encontrada",
    },
    {
      nombre: "Tabla de la bandeja",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.bandejaEntradas ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.bandejaEntradas
          ? "Conectado / OK"
          : "No responde o falta (migración 013)",
    },
    {
      nombre: "Fuentes de la bandeja",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.bandejaFuentes ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.bandejaFuentes
          ? "Conectado / OK"
          : "No responde o falta (migración 013)",
    },
    {
      nombre: "Edge Function bandeja",
      nivel: verificaciones.isPending
        ? "aviso"
        : !verificaciones.data?.funcionBandeja
          ? "error"
          : verificaciones.data?.pingBandeja.clasificador === null || !verificaciones.data?.pingBandeja.googleOauth
            ? "aviso"
            : "ok",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : !verificaciones.data?.funcionBandeja
          ? "No encontrada"
          : verificaciones.data?.pingBandeja.clasificador === null
            ? "Sin clasificador de IA: se usa palabras clave"
            : !verificaciones.data?.pingBandeja.googleOauth
              ? "Gmail sin credenciales OAuth"
              : "Conectado / OK",
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
      nombre: "Repositorios de GitHub",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.repositorios ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.repositorios
          ? "Responde correctamente"
          : "Falta la tabla repositorios (migración 008)",
    },
    {
      nombre: "Historial de subidas",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.repositorioSubidas ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.repositorioSubidas
          ? "Responde correctamente"
          : "Falta la tabla repositorio_subidas (migración 008)",
    },
    {
      nombre: "Edge Function github-repos",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.funcionRepos ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.funcionRepos
          ? "Disponible"
          : "No encontrada",
    },
    {
      nombre: "Copias de seguridad",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.copias ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.copias
          ? "Responde correctamente"
          : "Falta la tabla copias (migración 009)",
    },
    {
      nombre: "Edge Function copias-generar",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.funcionCopias ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.funcionCopias
          ? "Disponible"
          : "No encontrada",
    },
    {
      nombre: "Compilaciones",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.compilaciones ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.compilaciones
          ? "Responde correctamente"
          : "Falta la tabla compilaciones (migración 010)",
    },
    {
      nombre: "Plantillas de compilación",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.plantillasCompilacion ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.plantillasCompilacion
          ? "Responde correctamente"
          : "Falta la tabla plantillas_compilacion (migración 010)",
    },
    {
      nombre: "Edge Function compilar-app",
      nivel: verificaciones.isPending
        ? "aviso"
        : verificaciones.data?.funcionCompilar && verificaciones.data?.pingCompilar
          ? "ok"
          : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : !verificaciones.data?.funcionCompilar
          ? "No encontrada"
          : verificaciones.data?.pingCompilar
            ? "Conectado / OK"
            : "Falta GITHUB_TOKEN con permisos repo y workflow",
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

      <section className="panel mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold">Secretos y conexiones</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Solo se indica si cada secreto está configurado; nunca se muestra su valor.
            </p>
          </div>
          <Boton variante="suave" onClick={() => void secretos.refetch()} disabled={secretos.isFetching}>
            Volver a comprobar
          </Boton>
        </div>

        {secretos.isPending ? (
          <p className="mt-3 text-sm text-muted-foreground">Comprobando...</p>
        ) : secretos.isError ? (
          <p className="mt-3 text-sm text-destructive">No se ha podido comprobar los secretos.</p>
        ) : (
          <>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {NOMBRES_SECRETOS.map((clave) => {
                const puesto = Boolean(secretos.data?.[clave]);
                return (
                  <div key={clave} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <span className="truncate text-sm">{clave}</span>
                    <span
                      className={
                        puesto
                          ? "inline-flex rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs text-success"
                          : "inline-flex rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                      }
                    >
                      {puesto ? "Configurada" : "Sin configurar"}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              GitHub: {secretos.data?.github?.ok ? (secretos.data.github.usuario ?? "conectado") : "sin conexión"} ·
              {" "}
              Supabase: {secretos.data?.supabase?.ok ? `${secretos.data.supabase.proyectos ?? 0} proyectos` : "sin conexión"}
            </p>
          </>
        )}
      </section>

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
