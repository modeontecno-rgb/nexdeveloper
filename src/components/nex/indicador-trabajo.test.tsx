import { describe, expect, it } from "vitest";

import {
  avanzarTrabajo,
  crearTrabajo,
  fallarTrabajo,
  porcentajeVisible,
  terminarTrabajo,
  textoPaso,
} from "./indicador-trabajo";

describe("indicador de trabajo", () => {
  const pasos = ["Cerrando el borrador", "Entendiendo lo que pides", "Preparando la propuesta", "Guardando"];

  it("iniciar, avanzar y terminar cambia texto, porcentaje y estado", () => {
    const inicial = crearTrabajo("Lanzar la tarea", pasos);
    expect(inicial.fase).toBe("activo");
    expect(textoPaso(inicial)).toBe("Paso 1 de 4 · Cerrando el borrador");

    const segundo = avanzarTrabajo(inicial, "Preparando la propuesta", 50);
    expect(textoPaso(segundo)).toBe("Paso 3 de 4 · Preparando la propuesta");
    expect(porcentajeVisible(segundo)).toBe(50);

    const fin = terminarTrabajo(segundo, "Tarea lanzada.");
    expect(fin.fase).toBe("ok");
    expect(porcentajeVisible(fin)).toBe(100);
    expect(textoPaso(fin)).toBe("Tarea lanzada.");
  });

  it("sin porcentaje real la barra no pasa del 90 %", () => {
    const trabajo = crearTrabajo("Importar de Plaud");
    expect(porcentajeVisible(trabajo, 200)).toBe(90);
  });

  it("fallar muestra el error", () => {
    const trabajo = fallarTrabajo(crearTrabajo("Probar la conexión"), "No hay clave configurada.");
    expect(trabajo.fase).toBe("error");
    expect(textoPaso(trabajo)).toBe("No hay clave configurada.");
  });
});
