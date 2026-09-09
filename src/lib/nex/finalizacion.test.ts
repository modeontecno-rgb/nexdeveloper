import { describe, expect, it } from "vitest";
import { detectarFinalizados, tituloFinalizacion } from "./finalizacion";

describe("avisos al terminar", () => {
  it("no anuncia el historial ni repite un aviso en cada consulta", () => {
    const estados = new Map<string, string>();
    expect(
      detectarFinalizados(estados, [
        { id: "antiguo", estado: "completada" },
        { id: "nuevo", estado: "en_cola" },
      ]),
    ).toEqual([]);
    expect(detectarFinalizados(estados, [{ id: "nuevo", estado: "construyendo" }])).toEqual([]);
    expect(
      detectarFinalizados(estados, [{ id: "nuevo", estado: "esperando_aprobacion" }]),
    ).toHaveLength(1);
    expect(detectarFinalizados(estados, [{ id: "nuevo", estado: "esperando_aprobacion" }])).toEqual(
      [],
    );
  });
  it("detecta consejos rápidos, errores y varios resultados simultáneos", () => {
    const estados = new Map([
      ["consejo", "en_cola"],
      ["desarrollo", "comprobando"],
    ]);
    expect(
      detectarFinalizados(estados, [
        { id: "consejo", estado: "completada" },
        { id: "desarrollo", estado: "error" },
      ]).map((e) => e.id),
    ).toEqual(["consejo", "desarrollo"]);
    expect(tituloFinalizacion("error")).not.toContain("terminado");
    expect(tituloFinalizacion("esperando_aprobacion")).toContain("revisión");
  });
  it("avisa de nuevo cuando termina la publicación posterior a una aprobación", () => {
    const estados = new Map([["desarrollo", "esperando_aprobacion"]]);
    expect(detectarFinalizados(estados, [{ id: "desarrollo", estado: "publicando" }])).toEqual([]);
    expect(detectarFinalizados(estados, [{ id: "desarrollo", estado: "completada" }])).toHaveLength(
      1,
    );
  });
});
