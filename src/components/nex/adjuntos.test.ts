import { describe, expect, it } from "vitest";

import { motivoRechazo, resumenAdjuntos, rutaAdjunto, sanearNombre, tamanoLegible } from "./adjuntos";

describe("adjuntos de peticiones", () => {
  it("sanea el nombre y compone la ruta del propietario", () => {
    expect(sanearNombre("Captura pantalla ñ ó.png")).toBe("Captura-pantalla-n-o.png");
    expect(rutaAdjunto("usuario-1", "id-2", "informe final.pdf")).toBe("usuario-1/id-2-informe-final.pdf");
  });

  it("muestra el tamaño en unidades legibles", () => {
    expect(tamanoLegible(800)).toBe("800 B");
    expect(tamanoLegible(2048)).toBe("2 kB");
    expect(tamanoLegible(1.5 * 1024 * 1024)).toBe("1,5 MB");
  });

  it("rechaza lo que no cabe, lo que pesa de más y lo que no admite", () => {
    expect(motivoRechazo({ name: "a.png", size: 100, type: "image/png" }, 5)).toMatch(/5 ficheros/);
    expect(motivoRechazo({ name: "a.png", size: 21 * 1024 * 1024, type: "image/png" }, 0)).toMatch(/20 MB/);
    expect(motivoRechazo({ name: "virus.exe", size: 10, type: "application/x-msdownload" }, 0)).toMatch(/no es un tipo/);
    expect(motivoRechazo({ name: "notas.md", size: 10, type: "" }, 0)).toBeNull();
  });

  it("cita los adjuntos revisados", () => {
    expect(resumenAdjuntos([])).toBe("");
    expect(resumenAdjuntos(["error.png"])).toBe("He revisado el adjunto error.png.");
    expect(resumenAdjuntos(["error.png", "presupuesto.pdf"])).toBe(
      "He revisado los adjuntos error.png y presupuesto.pdf.",
    );
  });
});
