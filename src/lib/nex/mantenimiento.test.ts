import { describe, expect, it } from "vitest";

import { detectarProblemas } from "./diagnostico";
import { BLOQUES_LIMPIEZA, confirmacionValida, tablasABorrar } from "./mantenimiento";

describe("tablasABorrar", () => {
  it("borra las mesas y peticiones antes que las tareas", () => {
    const tablas = tablasABorrar(BLOQUES_LIMPIEZA.map((b) => b.id));
    expect(tablas.indexOf("mesas")).toBeLessThan(tablas.indexOf("tareas"));
    expect(tablas.indexOf("mesa_intervenciones")).toBeLessThan(tablas.indexOf("mesas"));
    expect(tablas.indexOf("peticiones_mensajes")).toBeLessThan(tablas.indexOf("peticiones_directas"));
    expect(tablas.indexOf("infra_incidencias")).toBeLessThan(tablas.indexOf("tareas"));
    expect(new Set(tablas).size).toBe(tablas.length);
  });

  it("no devuelve nada si no se elige ningún bloque", () => {
    expect(tablasABorrar([])).toEqual([]);
  });
});

describe("confirmacionValida", () => {
  it("acepta la palabra en cualquier caja y con espacios", () => {
    expect(confirmacionValida(" borrar ")).toBe(true);
    expect(confirmacionValida("BORRAR")).toBe(true);
    expect(confirmacionValida("borra")).toBe(false);
  });
});

describe("detectarProblemas", () => {
  const ahora = new Date("2026-09-08T12:00:00Z");
  const base = {
    tareas: [],
    peticiones: [],
    avisos: [],
    incidencias: [],
    proyectos: [],
    mesasConError: [],
    ahora,
  };

  it("no encuentra nada cuando todo está limpio", () => {
    expect(detectarProblemas(base as never)).toEqual([]);
  });

  it("detecta una tarea parada más de un día y propone devolverla a la cola", () => {
    const problemas = detectarProblemas({
      ...base,
      proyectos: [{ id: "p1" }],
      tareas: [
        {
          id: "t1",
          proyecto_id: "p1",
          estado: "ejecutando",
          ultima_actividad: "2026-09-06T12:00:00Z",
          titulo: "Compilar",
        },
      ],
    } as never);
    expect(problemas[0]?.id).toBe("tareas-atascadas");
    expect(problemas[0]?.arreglo?.tipo).toBe("desbloquear_tareas");
    expect(problemas[0]?.arreglo?.ids).toEqual(["t1"]);
  });

  it("ordena primero lo urgente", () => {
    const avisos = Array.from({ length: 20 }, (_, i) => ({ id: `a${i}`, leido: false }));
    const problemas = detectarProblemas({
      ...base,
      avisos,
      incidencias: [{ id: "i1", estado: "abierta", titulo: "GitHub caído" }],
    } as never);
    expect(problemas[0]?.gravedad).toBe("alta");
    expect(problemas.at(-1)?.id).toBe("avisos-acumulados");
  });
});
