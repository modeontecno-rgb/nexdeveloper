import { describe, expect, it } from "vitest";

import { finDeMes } from "./gasto-ia";

describe("finDeMes", () => {
  it("devuelve el último día de septiembre", () => {
    expect(finDeMes("2026-09")).toBe("2026-09-30");
  });

  it("devuelve el último día de febrero en un año normal", () => {
    expect(finDeMes("2026-02")).toBe("2026-02-28");
  });

  it("devuelve el último día de febrero en un año bisiesto", () => {
    expect(finDeMes("2028-02")).toBe("2028-02-29");
  });

  it("devuelve el último día de diciembre", () => {
    expect(finDeMes("2026-12")).toBe("2026-12-31");
  });
});
