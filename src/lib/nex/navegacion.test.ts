import { describe, expect, it } from "vitest";

import { normalizarDestinoInterno } from "./navegacion";

describe("normalizarDestinoInterno", () => {
  it("lleva los avisos antiguos de tareas a la Cola y conserva la tarea", () => {
    expect(normalizarDestinoInterno("/tareas?tarea=abc")).toBe("/cola?tarea=abc");
    expect(normalizarDestinoInterno("/tareas")).toBe("/cola");
  });

  it("mantiene las demás rutas internas y rechaza destinos externos", () => {
    expect(normalizarDestinoInterno("/compilaciones?compilacion=abc")).toBe(
      "/compilaciones?compilacion=abc",
    );
    expect(normalizarDestinoInterno("https://example.com")).toBeNull();
    expect(normalizarDestinoInterno("//example.com")).toBeNull();
  });
});