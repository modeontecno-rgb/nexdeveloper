import { describe, expect, it } from "vitest";

import {
  PARAMETROS_COSTE_POR_DEFECTO,
  creditosDesdeEuros,
  duracionEntre,
  estimarMercado,
  eurosDesdeCreditos,
  formatoDuracion,
  formatoTokens,
  normalizarParametros,
} from "./costes";

describe("costes", () => {
  it("convierte euros a créditos y al revés", () => {
    expect(creditosDesdeEuros(1, { ...PARAMETROS_COSTE_POR_DEFECTO, eurosPorCredito: 0.1 })).toBeCloseTo(10);
    expect(eurosDesdeCreditos(10, { ...PARAMETROS_COSTE_POR_DEFECTO, eurosPorCredito: 0.1 })).toBeCloseTo(1);
    expect(creditosDesdeEuros(-3)).toBe(0);
  });

  it("estima precio y plazo de mercado", () => {
    const mercado = estimarMercado(2, { eurosPorCredito: 0.1, tarifaMercadoEurHora: 50, factorHumano: 6 });
    expect(mercado.horas).toBe(12);
    expect(mercado.coste).toBe(600);
    expect(estimarMercado(0).coste).toBe(0);
  });

  it("normaliza parámetros inválidos", () => {
    expect(normalizarParametros({ eurosPorCredito: 0, tarifaMercadoEurHora: -5 })).toEqual(
      PARAMETROS_COSTE_POR_DEFECTO,
    );
  });

  it("calcula y formatea la duración real", () => {
    const ms = duracionEntre("2026-09-07T10:00:00Z", "2026-09-07T10:02:30Z");
    expect(ms).toBe(150000);
    expect(formatoDuracion(ms)).toBe("2 min 30 s");
    expect(formatoDuracion(45000)).toBe("45 s");
    expect(formatoDuracion(0)).toBe("—");
    expect(duracionEntre(null, "2026-09-07T10:00:00Z")).toBe(0);
  });

  it("formatea tokens", () => {
    expect(formatoTokens(0)).toBe("0");
    expect(formatoTokens(1500000)).toBe("1,50 M");
  });
});
