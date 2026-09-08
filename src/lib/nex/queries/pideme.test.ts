import { describe, expect, it } from "vitest";

import { cuerpoPedir, mensajeAmigable } from "./pideme";

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

describe("mensajeAmigable", () => {
  it("explica la tarifa no verificada", () => {
    expect(mensajeAmigable("Contexto demasiado grande o tarifa no verificada")).toContain("Consumo");
  });
  it("deja pasar otros mensajes", () => {
    expect(mensajeAmigable("Fallo raro")).toBe("Fallo raro");
  });
  it("explica el límite exacto que bloquea", () => {
    expect(mensajeAmigable("Llamada bloqueada: Límite diario superado")).toContain("límite diario");
    expect(mensajeAmigable("Llamada bloqueada: Máximo por llamada superado")).toContain("máximo por llamada");
  });
});
