import { describe, expect, it } from "vitest";

import { cuerpoPedir } from "./pideme";

describe("cuerpoPedir", () => {
  it("envía el proyecto elegido cuando se le pasa", () => {
    expect(cuerpoPedir({ texto: "hola", origen: "texto", proyecto_id: "abc" })).toEqual({
      accion: "pedir",
      texto: "hola",
      origen: "texto",
      proyecto_id: "abc",
    });
  });

  it("no envía proyecto si no hay", () => {
    expect(cuerpoPedir({ texto: "hola" })).toEqual({ accion: "pedir", texto: "hola", origen: "texto" });
  });
});
