import { describe, it, expect } from "vitest";
import { progresoEstimado, ultimasAcciones, estadoVisible } from "./actividad-desarrollo";
import { textoParaContinuar } from "./continuar-fuera";
import { prepararEquipo, soloLectura } from "../../../db/functions/_shared/equipo";
const model = (proveedor: string, calidad = 4, uso = 0) => ({
  id: proveedor,
  proveedor_id: proveedor,
  proveedor,
  identificador: "test",
  calidad,
  coste: 1,
  tareas_aconsejadas: ["codigo"],
  llamadas_recientes: uso,
});
describe("progreso y traspaso", () => {
  it("no convierte pasos ni horas en una falsa finalización", () => {
    expect(progresoEstimado({ estado: "en_cola", pasos: 100 })).toBe(0);
    expect(
      progresoEstimado({ estado: "construyendo", pasos: 1000, actualizado_el: "2020-01-01" }),
    ).toBeLessThan(100);
    expect(progresoEstimado({ estado: "esperando_aprobacion" })).toBe(100);
    expect(
      estadoVisible({
        estado: "error",
        estado_agente: {
          equipo: [
            {
              papel: "diseno",
              estado: "trabajando",
              modelo: { proveedor: "anthropic", identificador: "x" },
            },
          ],
        },
      }),
    ).toBe("Detenido por un error");
  });
  it("muestra acciones comprobables sin exportar contenido interno", () => {
    const r = ultimasAcciones({
      estado: "construyendo",
      estado_agente: {
        mensajes: [
          null,
          {
            content: [
              { type: "text", text: "privado" },
              { type: "tool_use", id: "a", name: "leer_archivo", input: { ruta: "src/a.ts" } },
              { type: "tool_result", tool_use_id: "a", content: "ERROR: inaccesible" },
            ],
          },
        ],
      },
    });
    expect(r).toEqual([{ id: "a", titulo: "Leer archivo", ruta: "src/a.ts", estado: "error" }]);
    expect(JSON.stringify(r)).not.toContain("privado");
  });
  it("el traspaso identifica el estado git y conserva entregas sin secretos internos", () => {
    const s = textoParaContinuar(
      {
        texto: "Hacer login",
        rama: "feature/x",
        pr_url: "https://github.com/a/b/pull/1",
        estado_agente: {
          base_sha: "abc",
          equipo: [{ papel: "diseno", resumen: "Diseño existente" }],
        },
        cambios: { "src/x.ts": "contenido privado" },
      },
      "App",
      "a/b",
    );
    expect(s).toContain("feature/x");
    expect(s).toContain("abc");
    expect(s).toContain("Diseño existente");
    expect(s).toContain("src/x.ts");
    expect(s).not.toContain("contenido privado");
    expect(s).toContain("No reactives la ejecución antigua");
  });
});
describe("calidad y balance", () => {
  it("calidad prevalece sobre ahorro y menor uso", () => {
    expect(
      prepararEquipo([model("openai", 5, 100), model("anthropic", 4, 0)], "app").every(
        (f) => f.modelo.proveedor === "openai",
      ),
    ).toBe(true);
  });
  it("reparte a igual calidad por consumo reciente y asignaciones", () => {
    const f = prepararEquipo(
      [model("openai", 4, 0), model("anthropic", 4, 100), model("google", 4, 0)],
      "backend",
    );
    expect(f.filter((x) => x.modelo.proveedor === "anthropic")).toHaveLength(0);
    expect(f.filter((x) => x.modelo.proveedor === "openai")).toHaveLength(2);
    expect(f.filter((x) => x.modelo.proveedor === "google")).toHaveLength(2);
  });
  it("respeta la elección explícita por departamento", () => {
    expect(
      prepararEquipo([model("openai", 5), model("anthropic", 4, 100)], "app", false, {
        diseno: "anthropic",
      })[0]?.modelo.proveedor,
    ).toBe("anthropic");
  });
  it("las seis áreas de mejoras solo proponen y no escriben", () => {
    const f = prepararEquipo([model("openai")], "mejoras", true, {}, true);
    expect(f).toHaveLength(6);
    expect(f.every((x) => soloLectura(x.papel))).toBe(true);
  });
});
