import { describe, expect, it } from "vitest";

import { normalizarDestinoInterno } from "./navegacion";

describe("normalizarDestinoInterno", () => {
  it("lleva los enlaces antiguos de la Cola a Tareas y conserva la tarea", () => {
    expect(normalizarDestinoInterno("/cola?tarea=abc")).toBe("/tareas?tarea=abc");
    expect(normalizarDestinoInterno("/cola")).toBe("/tareas");
    expect(normalizarDestinoInterno("/tareas?tarea=abc")).toBe("/tareas?tarea=abc");
  });

  it("mantiene las demás rutas internas y rechaza destinos externos", () => {
    expect(normalizarDestinoInterno("/compilaciones?compilacion=abc")).toBe(
      "/compilaciones?compilacion=abc",
    );
    expect(normalizarDestinoInterno("https://example.com")).toBeNull();
    expect(normalizarDestinoInterno("//example.com")).toBeNull();
  });
});