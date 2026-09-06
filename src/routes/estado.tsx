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
        saludInformes,
        saludProyectos,
        saludConfig,
        funcionSalud,
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
        gastoDiario,
        gastosManuales,
        presupuestosIa,
        gastoConfig,
        funcionGasto,
        cierresVersion,
        documentosNex,
        funcionDocumentar,
        tablaHabilidades,
        tablaHabilidadesUsos,
        tablaHabilidadesConfig,
        funcionHabilidades,
        tablaGuionesDemo,
        tablaLocuciones,
        tablaVozConfig,
        funcionVoz,
        tablaMesas,
        tablaMesaIntervenciones,
        tablaMesaValoraciones,
        funcionMesa,
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
        verificarTabla("salud_informes"),
        verificarTabla("salud_proyectos"),
        verificarTabla("salud_config"),
        verificarFuncion("salud"),
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
        verificarTabla("gasto_ia_diario"),
        verificarTabla("gastos_ia_manuales"),
        verificarTabla("presupuestos_ia"),
        verificarTabla("gasto_ia_config"),
        verificarFuncion("gasto-ia"),
        verificarTabla("cierres_version"),
        verificarTabla("documentos_nex"),
        verificarFuncion("documentar"),
        verificarTabla("habilidades"),
        verificarTabla("habilidades_usos"),
        verificarTabla("habilidades_config"),
        verificarFuncion("habilidades"),
        verificarTabla("guiones_demo"),
        verificarTabla("locuciones"),
        verificarTabla("voz_config"),
        verificarFuncion("voz"),
        verificarTabla("mesas"),
        verificarTabla("mesa_intervenciones"),
        verificarTabla("mesa_valoraciones"),
        verificarFuncion("mesa"),
      ]);
      const pingMesa = await (async () => {
        try {
          const { data } = await supabase.functions.invoke("mesa", { body: {} });
          const r = data as { minimo_ok?: boolean; proveedores?: string[] } | null;
          return { minimoOk: Boolean(r?.minimo_ok), proveedores: r?.proveedores ?? [] };
        } catch {
          return { minimoOk: false, proveedores: [] as string[] };
        }
      })();
      const pingVoz = await (async () => {
        try {
          const { data } = await supabase.functions.invoke("voz", { body: {} });
          const r = data as { elevenlabs?: boolean; almacen?: boolean } | null;
          return { elevenlabs: Boolean(r?.elevenlabs), almacen: Boolean(r?.almacen) };
        } catch {
          return { elevenlabs: false, almacen: false };
        }
      })();
      const pingHabilidades = await (async () => {
        try {
          const { data } = await supabase.functions.invoke("habilidades", { body: {} });
          const r = data as { repo_ok?: boolean; github?: boolean } | null;
          return { repoOk: Boolean(r?.repo_ok), github: Boolean(r?.github) };
        } catch {
          return { repoOk: false, github: false };
        }
      })();
      const pingDocumentar = await (async () => {
        try {
          const { data } = await supabase.functions.invoke("documentar", { body: {} });
          const r = data as { almacen?: boolean; proyectian?: boolean; github?: boolean } | null;
          return { almacen: Boolean(r?.almacen), proyectian: Boolean(r?.proyectian), github: Boolean(r?.github) };
        } catch {
          return { almacen: false, proyectian: false, github: false };
        }
      })();
      const pingGasto = await (async () => {
        try {
          const { data } = await supabase.functions.invoke("gasto-ia", { body: {} });
          const r = data as { anthropic_admin?: boolean; openai_admin?: boolean } | null;
          return { anthropic: Boolean(r?.anthropic_admin), openai: Boolean(r?.openai_admin) };
        } catch {
          return { anthropic: false, openai: false };
        }
      })();
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
        saludInformes,
        saludProyectos,
        saludConfig,
        funcionSalud,
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
        gastoDiario,
        gastosManuales,
        presupuestosIa,
        gastoConfig,
        funcionGasto,
        pingGasto,
        cierresVersion,
        documentosNex,
        funcionDocumentar,
        pingDocumentar,
        tablaHabilidades,
        tablaHabilidadesUsos,
        tablaHabilidadesConfig,
        funcionHabilidades,
        pingHabilidades,
        tablaGuionesDemo,
        tablaLocuciones,
        tablaVozConfig,
        funcionVoz,
        pingVoz,
        tablaMesas,
        tablaMesaIntervenciones,
        tablaMesaValoraciones,
        funcionMesa,
        pingMesa,
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
      nombre: "Tabla de informes de salud",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.saludInformes ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.saludInformes
          ? "Conectado / OK"
          : "No responde o falta (migración 021)",
    },
    {
      nombre: "Tabla de salud por proyecto",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.saludProyectos ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.saludProyectos
          ? "Conectado / OK"
          : "No responde o falta (migración 021)",
    },
    {
      nombre: "Configuración de salud",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.saludConfig ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.saludConfig
          ? "Conectado / OK"
          : "No responde o falta (migración 021)",
    },
    {
      nombre: "Función de salud",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.funcionSalud ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.funcionSalud
          ? "Responde correctamente"
          : "No responde (función «salud»)",
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
      nombre: "Tablas de vigilancia",
      nivel: verificaciones.isPending
        ? "aviso"
        : verificaciones.data?.vigilanciaConfig &&
            verificaciones.data?.vigilanciaLotes &&
            verificaciones.data?.vigilanciaHallazgos
          ? "ok"
          : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.vigilanciaConfig &&
            verificaciones.data?.vigilanciaLotes &&
            verificaciones.data?.vigilanciaHallazgos
          ? "Conectado / OK"
          : "No responden o faltan (migración 011)",
    },
    {
      nombre: "Tabla de competidores",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.competidores ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.competidores
          ? "Conectado / OK"
          : "No responde o falta (migración 011)",
    },
    {
      nombre: "Edge Function vigilar",
      nivel: verificaciones.isPending
        ? "aviso"
        : !verificaciones.data?.funcionVigilar
          ? "error"
          : verificaciones.data?.pingVigilar === null
            ? "aviso"
            : "ok",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : !verificaciones.data?.funcionVigilar
          ? "No encontrada"
          : verificaciones.data?.pingVigilar === null
            ? "Sin proveedor de búsqueda con clave"
            : `Conectado / OK (${verificaciones.data?.pingVigilar})`,
    },
    {
      nombre: "Tabla de resúmenes",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.tablaResumenes ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.tablaResumenes
          ? "Conectado / OK"
          : "No responde o falta (migración 014)",
    },
    {
      nombre: "Configuración de resúmenes",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.tablaResumenesConfig ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.tablaResumenesConfig
          ? "Conectado / OK"
          : "No responde o falta (migración 014)",
    },
    {
      nombre: "Edge Function resumenes",
      nivel: verificaciones.isPending ? "aviso" : verificaciones.data?.funcionResumenes ? "ok" : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.funcionResumenes
          ? "Conectado / OK"
          : "No encontrada",
    },
    {
      nombre: "Tablas de documentación",
      nivel: verificaciones.isPending
        ? "aviso"
        : verificaciones.data?.cierresVersion && verificaciones.data?.documentosNex
          ? "ok"
          : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.cierresVersion && verificaciones.data?.documentosNex
          ? "Conectado / OK"
          : "No responden o faltan (migración 016)",
    },
    {
      nombre: "Edge Function documentar",
      nivel: verificaciones.isPending
        ? "aviso"
        : !verificaciones.data?.funcionDocumentar
          ? "error"
          : verificaciones.data?.pingDocumentar?.almacen && verificaciones.data?.pingDocumentar?.proyectian
            ? "ok"
            : "aviso",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : !verificaciones.data?.funcionDocumentar
          ? "No encontrada"
          : verificaciones.data?.pingDocumentar?.almacen && verificaciones.data?.pingDocumentar?.proyectian
            ? "Conectado / OK (almacén y Proyectian)"
            : `Falta: ${[
                verificaciones.data?.pingDocumentar?.almacen ? null : "almacén",
                verificaciones.data?.pingDocumentar?.proyectian ? null : "Proyectian",
              ]
                .filter(Boolean)
                .join(" y ")}`,
    },
    {
      nombre: "Tablas de habilidades",
      nivel: verificaciones.isPending
        ? "aviso"
        : verificaciones.data?.tablaHabilidades &&
            verificaciones.data?.tablaHabilidadesUsos &&
            verificaciones.data?.tablaHabilidadesConfig
          ? "ok"
          : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.tablaHabilidades &&
            verificaciones.data?.tablaHabilidadesUsos &&
            verificaciones.data?.tablaHabilidadesConfig
          ? "Conectado / OK"
          : "No responden o faltan (migración 017)",
    },
    {
      nombre: "Edge Function habilidades",
      nivel: verificaciones.isPending
        ? "aviso"
        : verificaciones.data?.funcionHabilidades && verificaciones.data?.pingHabilidades?.repoOk
          ? "ok"
          : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : !verificaciones.data?.funcionHabilidades
          ? "No encontrada"
          : verificaciones.data?.pingHabilidades?.repoOk
            ? "Conectado / OK (repositorio accesible)"
            : "Sin acceso al repositorio de habilidades",
    },
    {
      nombre: "Tablas de la mesa de expertos",
      nivel: verificaciones.isPending
        ? "aviso"
        : verificaciones.data?.tablaMesas &&
            verificaciones.data?.tablaMesaIntervenciones &&
            verificaciones.data?.tablaMesaValoraciones
          ? "ok"
          : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.tablaMesas &&
            verificaciones.data?.tablaMesaIntervenciones &&
            verificaciones.data?.tablaMesaValoraciones
          ? "Conectado / OK"
          : "No responden o faltan (migración 019)",
    },
    {
      nombre: "Edge Function mesa",
      nivel: verificaciones.isPending
        ? "aviso"
        : verificaciones.data?.funcionMesa && verificaciones.data?.pingMesa?.minimoOk
          ? "ok"
          : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : !verificaciones.data?.funcionMesa
          ? "No encontrada"
          : verificaciones.data?.pingMesa?.minimoOk
            ? `Conectado / OK (${verificaciones.data?.pingMesa?.proveedores.length ?? 0} proveedores)`
            : "Sin proveedores de IA con clave",
    },
    {
      nombre: "Tablas de voz y demos",
      nivel: verificaciones.isPending
        ? "aviso"
        : verificaciones.data?.tablaGuionesDemo && verificaciones.data?.tablaLocuciones && verificaciones.data?.tablaVozConfig
          ? "ok"
          : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.tablaGuionesDemo && verificaciones.data?.tablaLocuciones && verificaciones.data?.tablaVozConfig
          ? "Conectado / OK"
          : "No responden o faltan (migración 018)",
    },
    {
      nombre: "Edge Function voz",
      nivel: verificaciones.isPending
        ? "aviso"
        : verificaciones.data?.funcionVoz && verificaciones.data?.pingVoz?.elevenlabs && verificaciones.data?.pingVoz?.almacen
          ? "ok"
          : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : !verificaciones.data?.funcionVoz
          ? "No encontrada"
          : verificaciones.data?.pingVoz?.elevenlabs && verificaciones.data?.pingVoz?.almacen
            ? "Conectado / OK (ElevenLabs y almacén)"
            : `Falta: ${[
                verificaciones.data?.pingVoz?.elevenlabs ? null : "clave de ElevenLabs",
                verificaciones.data?.pingVoz?.almacen ? null : "almacén",
              ]
                .filter(Boolean)
                .join(" y ")}`,
    },
    {
      nombre: "Tablas de gasto de IA",
      nivel: verificaciones.isPending
        ? "aviso"
        : verificaciones.data?.gastoDiario &&
            verificaciones.data?.gastosManuales &&
            verificaciones.data?.presupuestosIa &&
            verificaciones.data?.gastoConfig
          ? "ok"
          : "error",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : verificaciones.data?.gastoDiario &&
            verificaciones.data?.gastosManuales &&
            verificaciones.data?.presupuestosIa &&
            verificaciones.data?.gastoConfig
          ? "Conectado / OK"
          : "No responden o faltan (migración 015)",
    },
    {
      nombre: "Edge Function gasto-ia",
      nivel: verificaciones.isPending
        ? "aviso"
        : !verificaciones.data?.funcionGasto
          ? "error"
          : verificaciones.data?.pingGasto?.anthropic || verificaciones.data?.pingGasto?.openai
            ? "ok"
            : "aviso",
      detalle: verificaciones.isPending
        ? "Comprobando..."
        : !verificaciones.data?.funcionGasto
          ? "No encontrada"
          : verificaciones.data?.pingGasto?.anthropic || verificaciones.data?.pingGasto?.openai
            ? "Conectado / OK (coste real disponible)"
            : "Sin claves de administración: cifras estimadas",
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
