import * as React from "react";

/**
 * Parámetros para traducir el gasto real de IA a créditos y para estimar
 * cuánto costaría el mismo trabajo con programadores humanos.
 * Se configuran desde Ajustes → Costes y comparativa de mercado.
 */
export type ParametrosCoste = {
  /** Cuántos euros vale un crédito de la plataforma. */
  eurosPorCredito: number;
  /** Tarifa de mercado de un programador, en euros por hora. */
  tarifaMercadoEurHora: number;
  /** Cuántas horas humanas equivalen a una hora de trabajo con IA. */
  factorHumano: number;
};

export const PARAMETROS_COSTE_POR_DEFECTO: ParametrosCoste = {
  eurosPorCredito: 0.1,
  tarifaMercadoEurHora: 45,
  factorHumano: 6,
};

const CLAVE = "nex.parametros-coste";

function saneado(valor: unknown, porDefecto: number) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : porDefecto;
}

export function normalizarParametros(entrada: unknown): ParametrosCoste {
  const datos = (entrada ?? {}) as Partial<ParametrosCoste>;
  return {
    eurosPorCredito: saneado(datos.eurosPorCredito, PARAMETROS_COSTE_POR_DEFECTO.eurosPorCredito),
    tarifaMercadoEurHora: saneado(datos.tarifaMercadoEurHora, PARAMETROS_COSTE_POR_DEFECTO.tarifaMercadoEurHora),
    factorHumano: saneado(datos.factorHumano, PARAMETROS_COSTE_POR_DEFECTO.factorHumano),
  };
}

export function leerParametrosCoste(): ParametrosCoste {
  if (typeof window === "undefined") return PARAMETROS_COSTE_POR_DEFECTO;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    return normalizarParametros(crudo ? JSON.parse(crudo) : null);
  } catch {
    return PARAMETROS_COSTE_POR_DEFECTO;
  }
}

export function guardarParametrosCoste(valores: ParametrosCoste) {
  const limpios = normalizarParametros(valores);
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(limpios));
    window.dispatchEvent(new CustomEvent(CLAVE));
  } catch {
    /* almacenamiento no disponible */
  }
  return limpios;
}

/** Lee los parámetros y se actualiza cuando cambian en Ajustes. */
export function useParametrosCoste(): ParametrosCoste {
  const [valores, setValores] = React.useState<ParametrosCoste>(PARAMETROS_COSTE_POR_DEFECTO);

  React.useEffect(() => {
    const leer = () => setValores(leerParametrosCoste());
    leer();
    window.addEventListener(CLAVE, leer);
    window.addEventListener("storage", leer);
    return () => {
      window.removeEventListener(CLAVE, leer);
      window.removeEventListener("storage", leer);
    };
  }, []);

  return valores;
}

/** Convierte euros gastados en créditos equivalentes. */
export function creditosDesdeEuros(euros: number, p: ParametrosCoste = PARAMETROS_COSTE_POR_DEFECTO) {
  const valor = Number(euros);
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  return valor / normalizarParametros(p).eurosPorCredito;
}

export function eurosDesdeCreditos(creditos: number, p: ParametrosCoste = PARAMETROS_COSTE_POR_DEFECTO) {
  const valor = Number(creditos);
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  return valor * normalizarParametros(p).eurosPorCredito;
}

export type EstimacionMercado = { horas: number; coste: number };

/**
 * Estimación de mercado: lo que costaría y tardaría el mismo trabajo
 * con programadores humanos.
 */
export function estimarMercado(horasIa: number, p: ParametrosCoste = PARAMETROS_COSTE_POR_DEFECTO): EstimacionMercado {
  const parametros = normalizarParametros(p);
  const base = Number(horasIa);
  if (!Number.isFinite(base) || base <= 0) return { horas: 0, coste: 0 };
  const horas = base * parametros.factorHumano;
  return { horas, coste: horas * parametros.tarifaMercadoEurHora };
}

/** Duración real en formato corto: 45 s, 12 min 30 s, 2 h 15 min. */
export function formatoDuracion(ms: number) {
  const total = Number(ms);
  if (!Number.isFinite(total) || total <= 0) return "—";
  const segundos = Math.round(total / 1000);
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `${minutos} min ${segundos % 60} s`;
  const horas = Math.floor(minutos / 60);
  return `${horas} h ${minutos % 60} min`;
}

/** Diferencia en milisegundos entre dos fechas ISO. */
export function duracionEntre(inicio?: string | null, fin?: string | null) {
  if (!inicio || !fin) return 0;
  const a = new Date(inicio).getTime();
  const b = new Date(fin).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return b - a;
}

export function horasDesdeMs(ms: number) {
  const total = Number(ms);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return total / 3600000;
}

/** Miles con separador español y abreviatura para cifras grandes. */
export function formatoTokens(valor: number | null | undefined) {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero) || numero <= 0) return "0";
  if (numero >= 1_000_000) return `${(numero / 1_000_000).toFixed(2).replace(".", ",")} M`;
  return numero.toLocaleString("es-ES");
}

export function formatoCreditos(valor: number) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return "0";
  return numero < 10 ? numero.toFixed(2).replace(".", ",") : Math.round(numero).toLocaleString("es-ES");
}
