import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import type {
  ContratoCliente,
  EstadoFacturaEvoluteia,
  FacturaEvoluteiaRow,
  FacturacionClienteRow,
  FacturacionConfigRow,
  HoraRegistroRow,
  LineaFacturaEvoluteia,
  OrigenHoras,
} from "../db-types";
import { supabase } from "../supabase";

export const clavesFacturacion = {
  estado: (mes: string) => ["facturacion", "estado", mes] as const,
  resumen: (mes: string) => ["facturacion", "resumen", mes] as const,
  config: ["facturacion_config"] as const,
  clientes: ["facturacion_clientes"] as const,
  horas: ["horas_registro"] as const,
  facturas: ["facturas_evoluteia"] as const,
  cronometro: ["facturacion", "cronometro"] as const,
  empresas: ["facturacion", "evoluteia", "empresas"] as const,
  terceros: (q: string) => ["facturacion", "evoluteia", "terceros", q] as const,
  contratos: (terceroId: string) => ["facturacion", "evoluteia", "contratos", terceroId] as const,
  sugerencias: ["facturacion", "evoluteia", "sugerencias"] as const,
};

/** Aviso permanente: esta integración es exclusiva del fabricante. */
export const AVISO_SOLO_FABRICANTE =
  "Esta forma de trabajar (NexDeveloper ↔ EvoluteIA) es exclusiva del fabricante: MODEONTECNO S.L. / Soluciones EvoluteIA. " +
  "Ningún cliente que compre EvoluteIA la tiene, salvo que se le venda también NexDeveloper o se enlace expresamente con algo suyo. " +
  "En EvoluteIA existe el módulo «NexDeveloper (solo fabricante)» en estado privado: si ese módulo no está activo en el espacio de trabajo, " +
  "la facturación no opera.";

export const ETIQUETA_CONTRATO: Record<ContratoCliente, string> = {
  horas: "Por horas",
  mensual: "Cuota mensual",
  fijo: "Precio cerrado",
  sin_facturar: "Sin facturar",
};

export const EXPLICACION_CONTRATO: Record<ContratoCliente, string> = {
  horas: "Se factura el tiempo dedicado según la tarifa por hora.",
  mensual: "Cuota fija cada mes; las horas incluidas no se cobran aparte.",
  fijo: "Importe cerrado por el trabajo acordado, sin contar horas.",
  sin_facturar: "Proyecto interno o de cortesía: no se generan facturas.",
};

export const CONTRATOS = Object.keys(ETIQUETA_CONTRATO) as ContratoCliente[];

export const ETIQUETA_ORIGEN_HORAS: Record<OrigenHoras, string> = {
  manual: "Manual",
  cronometro: "Cronómetro",
  tarea: "Tarea",
  ejecucion: "IA",
};

export const TONO_ORIGEN_HORAS: Record<OrigenHoras, string> = {
  manual: "border-border bg-muted text-muted-foreground",
  cronometro: "border-primary/40 bg-primary/10 text-primary",
  tarea: "border-success/40 bg-success/10 text-success",
  ejecucion: "border-warning/40 bg-warning/10 text-warning",
};

export const ETIQUETA_ESTADO_FACTURA: Record<string, string> = {
  borrador: "Borrador",
  emitido: "Emitida",
  enviado: "Enviada",
  cobrado: "Cobrada",
  vencido: "Vencida",
  anulado: "Anulada",
};

export const TONO_ESTADO_FACTURA: Record<string, string> = {
  borrador: "border-border bg-muted text-muted-foreground",
  emitido: "border-primary/40 bg-primary/10 text-primary",
  enviado: "border-warning/40 bg-warning/10 text-warning",
  cobrado: "border-success/40 bg-success/10 text-success",
  vencido: "border-destructive/40 bg-destructive/10 text-destructive",
  anulado: "border-border bg-muted text-muted-foreground line-through",
};

export const ESTADOS_FACTURA: EstadoFacturaEvoluteia[] = [
  "borrador",
  "emitido",
  "enviado",
  "cobrado",
  "vencido",
  "anulado",
];

export function etiquetaEstadoFactura(estado: string) {
  return ETIQUETA_ESTADO_FACTURA[estado] ?? estado;
}

export function tonoEstadoFactura(estado: string) {
  return TONO_ESTADO_FACTURA[estado] ?? "border-border bg-muted text-muted-foreground";
}

/* ------------------------------ Llamada base ------------------------------ */

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("facturacion", { body: cuerpo });
  const respuesta = (data ?? null) as ({ ok?: boolean; error?: string } & T) | null;
  if (error) {
    let mensaje = (error as Error).message ?? "No se ha podido completar la operación.";
    const respuestaHttp = (error as unknown as { context?: Response }).context;
    if (respuestaHttp && typeof respuestaHttp.json === "function") {
      try {
        const cuerpoError = (await respuestaHttp.clone().json()) as { error?: string };
        if (cuerpoError?.error) mensaje = cuerpoError.error;
      } catch {
        /* sin cuerpo JSON */
      }
    }
    throw new Error(mensaje);
  }
  if (!respuesta || respuesta.ok === false) {
    throw new Error(respuesta?.error ?? "No se ha podido completar la operación.");
  }
  return respuesta;
}

/* --------------------------------- Tipos --------------------------------- */

export type TotalesFacturacion = {
  horas: number;
  horas_sin_facturar: number;
  facturado: number;
  cobrado: number;
  coste_ia: number;
  margen: number;
  pendiente_facturar: number;
  pendiente_cobro: number;
  vencidas: number;
  sin_enlazar: number;
};

export type ResumenProyectoFacturacion = {
  proyecto_id: string;
  nombre: string;
  slug?: string | null;
  color: string | null;
  enlazado: boolean;
  cliente: string | null;
  empresa?: string | null;
  tenant_id?: string | null;
  contrato: ContratoCliente;

  horas: number;
  horas_sin_facturar: number;
  facturado: number;
  cobrado: number;
  coste_ia: number;
  margen: number;
  pendiente_facturar: number;
  pendiente_cobro: number;
  borradores: number;
  vencidas: number;
};

export type ResumenFacturacion = {
  mes: string;
  desde?: string;
  hasta?: string;
  totales: TotalesFacturacion;
  proyectos: ResumenProyectoFacturacion[];
};

export type ConexionEvoluteia = {
  estado: "conectada" | "error" | "desconectada";
  cuenta?: string | null;
  ultimo_error?: string | null;
  ultima_comprobacion?: string | null;
};

/* --------------------------- Empresas emisoras ---------------------------- */

/** Solo estas dos empresas pueden facturar, aunque en EvoluteIA existan más. */
export const AVISO_EMPRESAS_PERMITIDAS =
  "Solo pueden facturar MODEONTECNO S.L. y SOLUCIONES EVOLUTEIA S.L.";

export type EmpresaEmisora = {
  tenant_id: string;
  nombre: string;
  nif?: string | null;
  por_defecto?: boolean;
  activa?: boolean;
  empresa_id?: string | null;
  sede_id?: string | null;
  forma_pago_id?: string | null;
  impuesto_id?: string | null;
};

export type PruebaEmpresa = {
  tenant_id: string;
  nombre: string;
  por_defecto?: boolean;
  modulo_activo?: boolean;
  empresa?: { razon_social?: string; nif?: string; verifactu_activo?: boolean; verifactu_modo?: string } | null;
  serie?: { codigo?: string; siguiente_num?: number; ejercicio?: number } | null;
  error?: string | null;
};

/** Color propio de cada empresa emisora, para distinguirlas de un vistazo. */
export function tonoEmpresa(nombre?: string | null) {
  if (!nombre) return "border-border bg-muted text-muted-foreground";
  return /modeon/i.test(nombre)
    ? "border-primary/40 bg-primary/10 text-primary"
    : "border-warning/40 bg-warning/10 text-warning";
}

/** Nombre corto de la empresa, para insignias estrechas. */
export function nombreCortoEmpresa(nombre?: string | null) {
  if (!nombre) return "Sin empresa";
  if (/modeon/i.test(nombre)) return "MODEONTECNO";
  if (/evoluteia/i.test(nombre)) return "EVOLUTEIA";
  return nombre;
}

export type EstadoFacturacion = {
  ok?: boolean;
  config?: FacturacionConfigRow | null;
  evoluteia?: ConexionEvoluteia | null;
  proyectian?: boolean;
  empresas?: EmpresaEmisora[];
  resumen?: ResumenFacturacion | null;
};

export type PruebaEvoluteia = {
  ok?: boolean;
  usuario?: string | null;
  empresa?: { razon_social?: string; nif?: string; verifactu_activo?: boolean; verifactu_modo?: string } | null;
  serie?: { codigo?: string; siguiente_num?: number; ejercicio?: number } | null;
  empresas?: PruebaEmpresa[];
  facturas_sincronizadas?: number;
  error?: string;
};

export type OpcionEvoluteia = { id: string; nombre?: string; razon_social?: string; codigo?: string; [k: string]: unknown };


export type TerceroEvoluteia = {
  id: string;
  codigo?: string | null;
  razon_social: string;
  nombre_comercial?: string | null;
  nif?: string | null;
  email?: string | null;
  telefono?: string | null;
  poblacion?: string | null;
};

export type ContratoEvoluteia = {
  id: string;
  numero?: string | null;
  titulo?: string | null;
  cuota?: number | null;
  periodicidad?: string | null;
  estado?: string | null;
  tercero_id?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
};

export type SugerenciaEnlace = {
  proyecto_id: string;
  proyecto: string;
  candidatos: { id: string; codigo?: string | null; razon_social: string; nif?: string | null; puntos: number }[];
};

export type CronometroEnMarcha = {
  id?: string;
  proyecto_id?: string;
  tarea_id?: string | null;
  descripcion?: string | null;
  inicio?: string;
} | null;

export type DetalleFactura = {
  factura?: (FacturaEvoluteiaRow & {
    terceros?: { razon_social?: string; nif?: string } | null;
    documento_lineas?: LineaFacturaEvoluteia[] | null;
  }) | null;
  vencimientos?: { id?: string; fecha?: string; importe?: number; cobrado?: boolean; pendiente?: number }[];
  verifactu?: { registros?: Record<string, unknown>[]; envios?: Record<string, unknown>[] } | null;
  url?: string | null;
};

/* -------------------------------- Consultas ------------------------------- */

export function useEstadoFacturacion(mes: string) {
  return useQuery({
    queryKey: clavesFacturacion.estado(mes),
    queryFn: () => llamar<EstadoFacturacion>({ accion: "estado", mes }),
  });
}

export function useResumenFacturacion(mes: string) {
  return useQuery({
    queryKey: clavesFacturacion.resumen(mes),
    queryFn: async () => {
      const r = await llamar<{ resumen?: ResumenFacturacion } & ResumenFacturacion>({ accion: "resumen", mes });
      const resumen = (r.resumen ?? r) as ResumenFacturacion | null;
      return resumen && resumen.totales ? resumen : null;
    },
  });
}

export function useFacturacionConfig() {
  return useQuery({
    queryKey: clavesFacturacion.config,
    queryFn: async () => {
      const { data, error } = await supabase.from("facturacion_config").select("*").limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as FacturacionConfigRow | null;
    },
  });
}

export function useGuardarFacturacionConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cambios: Partial<Omit<FacturacionConfigRow, "id" | "user_id">>) =>
      llamar({ accion: "configurar", ...cambios }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesFacturacion.config });
      void qc.invalidateQueries({ queryKey: ["facturacion"] });
    },
  });
}

/* ------------------------------- EvoluteIA -------------------------------- */

export function useProbarEvoluteia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => llamar<PruebaEvoluteia>({ accion: "probar_evoluteia" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["facturacion"] }),
  });
}

export function useEmpresasEvoluteia() {
  return useQuery({
    queryKey: clavesFacturacion.empresas,
    queryFn: async () => {
      const r = await llamar<{
        empresas?: OpcionEvoluteia[];
        sedes?: OpcionEvoluteia[];
        formas_pago?: OpcionEvoluteia[];
        impuestos?: OpcionEvoluteia[];
      }>({ accion: "empresas" });
      return {
        empresas: r.empresas ?? [],
        sedes: r.sedes ?? [],
        formas_pago: r.formas_pago ?? [],
        impuestos: r.impuestos ?? [],
      };
    },
  });
}

export function useTercerosEvoluteia(q: string, activo = true) {
  return useQuery({
    queryKey: clavesFacturacion.terceros(q),
    enabled: activo,
    queryFn: async () => {
      const r = await llamar<{ terceros?: TerceroEvoluteia[] }>({ accion: "terceros", ...(q ? { q } : {}) });
      return r.terceros ?? [];
    },
  });
}

export function useContratosEvoluteia(terceroId: string | null) {
  return useQuery({
    queryKey: clavesFacturacion.contratos(terceroId ?? "ninguno"),
    enabled: Boolean(terceroId),
    queryFn: async () => {
      const r = await llamar<{ contratos?: ContratoEvoluteia[] }>({ accion: "contratos", tercero_id: terceroId });
      return r.contratos ?? [];
    },
  });
}

export function useCrearTercero() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      razon_social: string;
      nif?: string;
      nombre_comercial?: string;
      direccion?: string;
      poblacion?: string;
      provincia?: string;
      cp?: string;
      email?: string;
      telefono?: string;
    }) => llamar<{ tercero?: TerceroEvoluteia }>({ accion: "tercero_crear", ...input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["facturacion", "evoluteia", "terceros"] }),
  });
}

export function useSugerirEnlaces() {
  return useMutation({
    mutationFn: async () => {
      const r = await llamar<{ sugerencias?: SugerenciaEnlace[] }>({ accion: "sugerir_enlaces" });
      return r.sugerencias ?? [];
    },
  });
}

/* -------------------------------- Clientes -------------------------------- */

export function useClientesFacturacion() {
  return useQuery({
    queryKey: clavesFacturacion.clientes,
    queryFn: async () => {
      const { data, error } = await supabase.from("facturacion_clientes").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as FacturacionClienteRow[];
    },
  });
}

export function useEnlazarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      proyecto_id: string;
      tercero_id: string;
      contrato_id?: string;
      contrato: ContratoCliente;
      cuota_mensual?: number | null;
      horas_incluidas?: number | null;
      importe_fijo?: number | null;
      tarifa_hora?: number | null;
      refacturar_ia?: boolean;
      notas?: string;
    }) => llamar({ accion: "cliente_enlazar", ...input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesFacturacion.clientes });
      void qc.invalidateQueries({ queryKey: ["facturacion"] });
    },
  });
}

export function useDesenlazarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proyectoId: string) => llamar({ accion: "cliente_desenlazar", proyecto_id: proyectoId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesFacturacion.clientes });
      void qc.invalidateQueries({ queryKey: ["facturacion"] });
    },
  });
}

/* ---------------------------------- Horas --------------------------------- */

export type FiltroHoras = {
  proyecto_id?: string;
  desde?: string;
  hasta?: string;
  sin_facturar?: boolean;
  limite?: number;
};

export function useHoras(filtro: FiltroHoras) {
  return useQuery({
    queryKey: [...clavesFacturacion.horas, filtro],
    queryFn: async () => {
      const r = await llamar<{ horas?: HoraRegistroRow[] }>({ accion: "horas", ...filtro });
      return (r.horas ?? []) as HoraRegistroRow[];
    },
  });
}

export function useRegistrarHoras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      proyecto_id: string;
      tarea_id?: string;
      fecha?: string;
      horas: number;
      descripcion?: string;
      facturable?: boolean;
    }) => llamar({ accion: "horas_registrar", ...input }),
    onSuccess: () => invalidarFacturacion(qc),
  });
}

export function useActualizarHoras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string } & Partial<HoraRegistroRow>) =>
      llamar({ accion: "horas_actualizar", ...input }),
    onSuccess: () => invalidarFacturacion(qc),
  });
}

export function useBorrarHoras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => llamar({ accion: "horas_borrar", id }),
    onSuccess: () => invalidarFacturacion(qc),
  });
}

/* -------------------------------- Cronómetro ------------------------------ */

export function useCronometro() {
  return useQuery({
    queryKey: clavesFacturacion.cronometro,
    queryFn: async () => {
      const r = await llamar<{ en_marcha?: CronometroEnMarcha }>({ accion: "cronometro_estado" });
      return (r.en_marcha ?? null) as CronometroEnMarcha;
    },
    refetchOnWindowFocus: true,
  });
}

export function useIniciarCronometro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { proyecto_id: string; tarea_id?: string; descripcion?: string }) =>
      llamar({ accion: "cronometro_iniciar", ...input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesFacturacion.cronometro });
      invalidarFacturacion(qc);
    },
  });
}

export function usePararCronometro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (descripcion?: string) => llamar({ accion: "cronometro_parar", descripcion }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesFacturacion.cronometro });
      invalidarFacturacion(qc);
    },
  });
}

/* --------------------------------- Facturas ------------------------------- */

export function useFacturas(
  filtro: { proyecto_id?: string; estado?: string; limite?: number; sincronizar?: boolean } = {},
) {
  return useQuery({
    queryKey: [...clavesFacturacion.facturas, filtro],
    queryFn: async () => {
      const r = await llamar<{ facturas?: FacturaEvoluteiaRow[] }>({ accion: "facturas", ...filtro });
      return (r.facturas ?? []) as FacturaEvoluteiaRow[];
    },
  });
}

export function useFactura(documentoId: string | null) {
  return useQuery({
    queryKey: [...clavesFacturacion.facturas, "una", documentoId ?? "ninguna"],
    enabled: Boolean(documentoId),
    queryFn: () => llamar<DetalleFactura>({ accion: "factura", documento_id: documentoId }),
  });
}

export type EntradaPreparar = {
  proyecto_id: string;
  desde?: string;
  hasta?: string;
  incluir_horas?: boolean;
  incluir_ia?: boolean;
  lineas_extra?: { concepto: string; cantidad: number; precio: number }[];
  notas?: string;
};

export type ResultadoPreparar = {
  documento_id?: string;
  numero_previsto?: string;
  horas?: number;
  coste_ia?: number;
  lineas?: LineaFacturaEvoluteia[];
  de_contrato?: boolean;
  url?: string;
};

export function usePrepararFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EntradaPreparar) => llamar<ResultadoPreparar>({ accion: "preparar", ...input }),
    onSuccess: () => invalidarFacturacion(qc),
  });
}

export function useEmitirFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { documento_id: string; forma_pago_id?: string }) =>
      llamar<{ numero?: string; verifactu?: boolean; url?: string }>({ accion: "emitir", ...input }),
    onSuccess: () => invalidarFacturacion(qc),
  });
}

export function useDescartarBorrador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentoId: string) => llamar({ accion: "descartar_borrador", documento_id: documentoId }),
    onSuccess: () => invalidarFacturacion(qc),
  });
}

export function useSincronizarFacturas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => llamar({ accion: "sincronizar" }),
    onSuccess: () => invalidarFacturacion(qc),
  });
}

/* -------------------------------- Realtime -------------------------------- */

function invalidarFacturacion(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: clavesFacturacion.horas });
  void qc.invalidateQueries({ queryKey: clavesFacturacion.facturas });
  void qc.invalidateQueries({ queryKey: ["facturacion"] });
}

export function useRealtimeFacturacion() {
  const qc = useQueryClient();
  React.useEffect(() => {
    const canal = supabase.channel("nexdeveloper-facturacion");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "horas_registro" }, () => {
      void qc.invalidateQueries({ queryKey: clavesFacturacion.horas });
      void qc.invalidateQueries({ queryKey: clavesFacturacion.cronometro });
      void qc.invalidateQueries({ queryKey: ["facturacion"] });
    });
    canal.on("postgres_changes", { event: "*", schema: "public", table: "facturas_evoluteia" }, () => {
      void qc.invalidateQueries({ queryKey: clavesFacturacion.facturas });
      void qc.invalidateQueries({ queryKey: ["facturacion"] });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [qc]);
}

/* -------------------------------- Utilidades ------------------------------ */

export function mesActualFacturacion() {
  const ahora = new Date();
  const d = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 7);
}

export function ultimosMesesFacturacion(cantidad = 12) {
  const salida: string[] = [];
  const base = new Date();
  for (let i = 0; i < cantidad; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    salida.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return salida;
}

export function nombreMesFacturacion(mes: string) {
  const [anio, m] = mes.split("-");
  const fecha = new Date(Number(anio), Number(m) - 1, 1);
  const texto = fecha.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Horas con dos decimales y sufijo: 3,25 h */
export function formatoHoras(horas: number) {
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(horas || 0)} h`;
}

/** Duración transcurrida desde el inicio del cronómetro: 01:23:45 */
export function transcurrido(inicioIso: string | null | undefined, ahora = Date.now()) {
  if (!inicioIso) return "00:00:00";
  const ms = Math.max(0, ahora - new Date(inicioIso).getTime());
  const s = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** Primer y último día del mes anterior, para preparar los borradores. */
export function periodoMesAnterior() {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { desde: iso(inicio), hasta: iso(fin) };
}
