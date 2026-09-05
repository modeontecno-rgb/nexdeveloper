import type { EstrategiaEnrutado, ModeloIaRow, PoliticaEnrutadoRow, ProveedorIaRow } from "./db-types";

export const TAREAS_IA = [
  "codigo",
  "razonamiento",
  "resumen",
  "traduccion",
  "clasificacion",
  "busqueda",
  "imagen",
  "voz",
  "vision",
] as const;

export const ETIQUETA_TAREA_IA: Record<string, string> = {
  codigo: "Código",
  razonamiento: "Razonamiento",
  resumen: "Resumen",
  traduccion: "Traducción",
  clasificacion: "Clasificación",
  busqueda: "Búsqueda",
  imagen: "Imagen",
  voz: "Voz",
  vision: "Visión",
};

export const ETIQUETA_ESTRATEGIA: Record<EstrategiaEnrutado, string> = {
  barato: "Más barato",
  rapido: "Más rápido",
  mejor: "Mejor calidad",
};

export const ETIQUETA_VELOCIDAD: Record<string, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  muy_alta: "Muy alta",
};

export const CLASE_VELOCIDAD: Record<string, string> = {
  baja: "bg-muted text-muted-foreground",
  media: "bg-primary/15 text-primary",
  alta: "bg-success/15 text-success",
  muy_alta: "bg-success/30 text-success",
};

const PESO_VELOCIDAD: Record<string, number> = { baja: 0, media: 1, alta: 2, muy_alta: 3 };

/** Modelos activos de proveedores activos que sirven para una tarea. */
export function modelosDisponibles(
  modelos: ModeloIaRow[],
  proveedores: ProveedorIaRow[],
  tarea?: string,
): ModeloIaRow[] {
  const activos = new Set(proveedores.filter((p) => p.activo).map((p) => p.id));
  return modelos.filter(
    (m) => m.activo && activos.has(m.proveedor_id) && (!tarea || m.tareas_aconsejadas.includes(tarea)),
  );
}

/** Ordena candidatos según la estrategia elegida. */
export function ordenarPorEstrategia(modelos: ModeloIaRow[], estrategia: EstrategiaEnrutado): ModeloIaRow[] {
  const lista = [...modelos];
  if (estrategia === "barato") {
    return lista
      .filter((m) => (m.calidad ?? 0) >= 3)
      .sort((a, b) => (a.coste_salida ?? Number.MAX_SAFE_INTEGER) - (b.coste_salida ?? Number.MAX_SAFE_INTEGER));
  }
  if (estrategia === "rapido") {
    return lista
      .filter((m) => (m.calidad ?? 0) >= 3)
      .sort((a, b) => (PESO_VELOCIDAD[b.velocidad] ?? 0) - (PESO_VELOCIDAD[a.velocidad] ?? 0));
  }
  return lista.sort((a, b) => (b.calidad ?? 0) - (a.calidad ?? 0));
}

/** Modelo (y proveedor) que la política asigna a una tarea, con respaldo. */
export function resolverModelo(
  tarea: string,
  politica: PoliticaEnrutadoRow[],
  modelos: ModeloIaRow[],
  proveedores: ProveedorIaRow[],
): { modelo_id: string; proveedor_id: string } | null {
  const disponibles = modelosDisponibles(modelos, proveedores);
  const fila = politica.find((p) => p.tarea === tarea);
  const porId = (id: string | null | undefined) => (id ? disponibles.find((m) => m.id === id) : undefined);
  const elegido =
    porId(fila?.modelo_preferido_id) ??
    porId(fila?.modelo_respaldo_id) ??
    ordenarPorEstrategia(
      modelosDisponibles(modelos, proveedores, tarea),
      fila?.estrategia ?? "mejor",
    )[0];
  return elegido ? { modelo_id: elegido.id, proveedor_id: elegido.proveedor_id } : null;
}

/** Coste de una llamada: tokens × precio por millón. */
export function calcularCoste(modelo: ModeloIaRow | undefined, entrada: number, salida: number): number {
  if (!modelo) return 0;
  const ce = Number(modelo.coste_entrada ?? 0);
  const cs = Number(modelo.coste_salida ?? 0);
  return (entrada * ce + salida * cs) / 1_000_000;
}
