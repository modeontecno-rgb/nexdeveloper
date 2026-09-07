import { describe, expect, it } from "vitest";

import { planDeSintesis } from "./mesa";

describe("planDeSintesis", () => {
  it("recupera los pasos completos de una conclusión JSON cortada", () => {
    const sintesis = `\`\`\`json
{"sintesis":"Conclusión","plan":[
  {"orden":1,"titulo":"Auditoría","descripcion":"Revisar el producto","responsable":"Javier","horas":8,"requiere_atencion":true},
  {"orden":2,"titulo":"Diseño","descripcion":"Preparar el prototipo","responsable":"experto","horas":12,"requiere_atencion":false},
  {"orden":3,"titulo":"Paso cortado"`;

    expect(planDeSintesis(sintesis)?.plan).toEqual([
      {
        orden: 1,
        titulo: "Auditoría",
        descripcion: "Revisar el producto",
        responsable: "Javier",
        horas: 8,
        requiere_atencion: true,
      },
      {
        orden: 2,
        titulo: "Diseño",
        descripcion: "Preparar el prototipo",
        responsable: "experto",
        horas: 12,
        requiere_atencion: false,
      },
    ]);
  });

  it("no inventa un plan cuando no hay ningún paso completo", () => {
    expect(planDeSintesis('{"sintesis":"Sin plan","plan":[{"orden":1')).toBeNull();
  });
});