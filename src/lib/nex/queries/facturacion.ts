import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import type {
  ContratoCliente,
  EstadoFactura,
  FacturaRow,
  FacturacionClienteRow,
  FacturacionConfigRow,
  HoraRegistroRow,
  LineaFactura,
  OrigenHoras,
} from "../db-types";
import { supabase } from "../supabase";

export const clavesFacturacion = {
  estado: (mes: string) => ["facturacion", "estado", mes] as const,
  resumen: (mes: string) => ["facturacion", "resumen", mes] as const,
  config: ["facturacion_config"] as const,
  clientes: ["facturacion_clientes"] as const,
  cliente: (proyectoId: string) => ["facturacion_clientes", proyectoId] as const,
  horas: ["horas_registro"] as const,
  facturas: ["facturas"] as const,
  cronometro: ["facturacion", "cronometro"] as const,
};

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

export const ETIQUETA_ESTADO_FACTURA: Record<EstadoFactura, string> = {
  borrador: "Borrador",
  emitida: "Emitida",
  enviada: "Enviada",
  pagada: "Pagada",
  vencida: "Vencida",
  anulada: "Anulada",
};

export const TONO_ESTADO_FACTURA: Record<EstadoFactura, string> = {
  borrador: "border-border bg-muted text-muted-foreground",
  emitida: "border-primary/40 bg-primary/10 text-primary",
  enviada: "border-warning/40 bg-warning/10 text-warning",
  pagada: "border-success/40 bg-success/10 text-success",
  vencida: "border-destructive/40 bg-destructive/10 text-destructive",
  anulada: "border-border bg-muted text-muted-foreground line-through",
};

export const ESTADOS_FACTURA = Object.keys(ETIQUETA_ESTADO_FACTURA) as EstadoFactura[];

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
};

export type ResumenProyectoFacturacion = {
  proyecto_id: string;
  nombre: string;
  color: string | null;
  contrato: ContratoCliente;
  horas: number;
  horas_facturables: number;
  horas_sin_facturar: number;
  facturado: number;
  cobrado: number;
  coste_ia: number;
  margen: number;
  pendiente_facturar: number;
  borradores: number;
};

export type ResumenFacturacion = {
  mes: string;
  totales: TotalesFacturacion;
  proyectos: ResumenProyectoFacturacion[];
};

export type EstadoFacturacion = {
  ok?: boolean;
  config?: FacturacionConfigRow | null;
  almacen?: boolean;
  proyectian?: boolean;
  resumen?: ResumenFacturacion | null;
};

export type CronometroEnMarcha = {
  id?: string;
  proyecto_id?: string;
  tarea_id?: string | null;
  descripcion?: string | null;
  inicio?: string;
} | null;

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
      const r = await llamar<{ resumen?: ResumenFacturacion }>({ accion: "resumen", mes });
      return (r.resumen ?? null) as ResumenFacturacion | null;
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

export function useGuardarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { proyecto_id: string } & Partial<Omit<FacturacionClienteRow, "id" | "user_id">>) =>
      llamar({ accion: "cliente_guardar", ...input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesFacturacion.clientes });
      void qc.invalidateQueries({ queryKey: ["facturacion"] });
    },
  });
}

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

export function useFacturas(filtro: { proyecto_id?: string; estado?: EstadoFactura; limite?: number } = {}) {
  return useQuery({
    queryKey: [...clavesFacturacion.facturas, filtro],
    queryFn: async () => {
      const r = await llamar<{ facturas?: FacturaRow[] }>({ accion: "facturas", ...filtro });
      return (r.facturas ?? []) as FacturaRow[];
    },
  });
}

export function useFactura(id: string | null) {
  return useQuery({
    queryKey: [...clavesFacturacion.facturas, "una", id ?? "ninguna"],
    enabled: Boolean(id),
    queryFn: async () => {
      const r = await llamar<{ factura?: FacturaRow }>({ accion: "factura", id });
      return (r.factura ?? null) as FacturaRow | null;
    },
  });
}

export type EntradaGenerar = {
  proyecto_id: string;
  desde?: string;
  hasta?: string;
  incluir_horas?: boolean;
  incluir_ia?: boolean;
  lineas_extra?: { concepto: string; detalle?: string; cantidad: number; unidad?: string; precio: number }[];
  notas?: string;
};

export function useGenerarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EntradaGenerar) => llamar<{ factura?: FacturaRow }>({ accion: "generar", ...input }),
    onSuccess: () => invalidarFacturacion(qc),
  });
}

export function useActualizarBorrador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      lineas?: LineaFactura[];
      cliente?: Record<string, unknown>;
      notas?: string;
      periodo_desde?: string;
      periodo_hasta?: string;
      iva_pct?: number;
      irpf_pct?: number;
    }) => llamar<{ factura?: FacturaRow }>({ accion: "actualizar_borrador", ...input }),
    onSuccess: () => invalidarFacturacion(qc),
  });
}

export function useEmitirFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => llamar<{ factura?: FacturaRow }>({ accion: "emitir", id }),
    onSuccess: () => invalidarFacturacion(qc),
  });
}

export function useMarcarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; estado: "enviada" | "pagada" | "anulada"; fecha?: string }) =>
      llamar({ accion: "marcar", ...input }),
    onSuccess: () => invalidarFacturacion(qc),
  });
}

export function useBorrarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => llamar({ accion: "borrar", id }),
    onSuccess: () => invalidarFacturacion(qc),
  });
}

export function useEnlaceFactura() {
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await llamar<{ url?: string }>({ accion: "enlace", id });
      return (r.url ?? null) as string | null;
    },
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
    canal.on("postgres_changes", { event: "*", schema: "public", table: "facturas" }, () => {
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

/** Abre el HTML de la factura en una pestaña nueva y lanza la impresión (PDF). */
export function imprimirFactura(html: string) {
  const ventana = window.open("", "_blank");
  if (!ventana) return false;
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
  ventana.setTimeout(() => ventana.print(), 500);
  return true;
}

export function estaVencida(factura: FacturaRow) {
  if (factura.estado === "pagada" || factura.estado === "anulada" || factura.estado === "borrador") return false;
  if (factura.estado === "vencida") return true;
  if (!factura.vence_el) return false;
  return new Date(factura.vence_el).getTime() < Date.now();
}
