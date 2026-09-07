import { describe, expect, it } from "vitest";

import { planDeIntervencion, planDeSintesis } from "./mesa";

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

describe("planDeIntervencion", () => {
  it("convierte los pasos numerados del experto en un plan estructurado", () => {
    const texto = `## Pasos
**1. Auditoría UX (8h)**
- **Quién:** Javier + Experto UX
- Analizar los flujos actuales
- **Riesgo:** Copiar sin adaptar

**2. Prototipo (12h)**
- **Quién:** Lovable + Claude
- Preparar y validar el prototipo`;

    expect(planDeIntervencion(texto)).toEqual([
      {
        orden: 1,
        titulo: "Auditoría UX",
        descripcion: "Analizar los flujos actuales",
        responsable: "Javier + Experto UX",
        horas: 8,
        requiere_atencion: true,
      },
      {
        orden: 2,
        titulo: "Prototipo",
        descripcion: "Preparar y validar el prototipo",
        responsable: "Lovable + Claude",
        horas: 12,
        requiere_atencion: false,
      },
    ]);
  });
});