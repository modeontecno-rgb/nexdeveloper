import { describe, it, expect } from "vitest";
import { validarPlan, fasesDelPlan, parcheExacto } from "../../../db/functions/_shared/cola";
const tarea = (id: string, depende_de: string[] = []) => ({
  id,
  titulo: "Implementar " + id,
  papel: "backend",
  depende_de,
  aceptacion: ["Prueba de aislamiento entre clientes"],
});
describe("Cola persistida de desarrollo", () => {
  it("ordena dependencias aunque el modelo las entregue al revés", () =>
    expect(validarPlan([tarea("ui", ["api"]), tarea("api")]).map((t) => t.id)).toEqual([
      "api",
      "ui",
    ]));
  it.each([
    [tarea("a", ["b"]), tarea("b", ["a"])],
    [tarea("a", ["x"])],
    [tarea("a"), tarea("a")],
    [tarea("a", ["a"])],
    [],
    [{ ...tarea("a"), aceptacion: [] }],
    [{ ...tarea("a"), papel: "administrador" }],
  ])("rechaza un plan inválido %j", (...plan) => expect(() => validarPlan(plan)).toThrow());
  it("valida 200 tareas encadenadas sin perder el orden", () => {
    const plan = Array.from({ length: 200 }, (_, i) => tarea("t" + i, i ? ["t" + (i - 1)] : []));
    expect(validarPlan(plan.reverse()).at(-1)?.id).toBe("t199");
  });
  it("no oculta el límite de capacidad", () =>
    expect(() => validarPlan(Array.from({ length: 201 }, (_, i) => tarea("t" + i)))).toThrow());
  it("intercala revisión independiente antes de la siguiente dependencia", () => {
    const equipo = [
      { papel: "backend", modelo: { id: "coder" } },
      { papel: "revision", modelo: { id: "reviewer" } },
    ];
    const fases = fasesDelPlan(validarPlan([tarea("a"), tarea("b", ["a"])]), equipo);
    expect(fases.map((f) => f.papel)).toEqual([
      "backend",
      "revision",
      "backend",
      "revision",
      "revision",
    ]);
    expect(fases[1]!.tarea!.id).toBe("a");
    expect(fases[2]!.tarea!.depende_de).toEqual(["a"]);
    expect(fases.every((f) => f.estado === "pendiente")).toBe(true);
    expect(JSON.parse(JSON.stringify(fases))).toEqual(fases);
  });
  it("rechaza un departamento sin responsable", () =>
    expect(() => fasesDelPlan(validarPlan([tarea("a")]), [{ papel: "revision" }])).toThrow());
});
describe("Cambios exactos", () => {
  it("conserva todo el archivo grande salvo el fragmento elegido", () => {
    const prefijo = "x".repeat(100000),
      sufijo = "y".repeat(100000);
    expect(parcheExacto(prefijo + "antiguo" + sufijo, "antiguo", "nuevo")).toBe(
      prefijo + "nuevo" + sufijo,
    );
  });
  it.each([
    ["abc", "x", "y"],
    ["abc abc", "abc", "d"],
    ["abc", "", "d"],
    ["abc", "abc", "abc"],
  ])("rechaza cambios ambiguos, obsoletos o vacíos", (original, antes, despues) =>
    expect(() => parcheExacto(original, antes, despues)).toThrow(),
  );
});
