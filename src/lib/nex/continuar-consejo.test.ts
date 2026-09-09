import { expect, it } from "vitest";
import { textoDesarrolloDesdeConsejo } from "./continuar-consejo";
it("conserva la petición, la entrega y las indicaciones que ya estaban escritas", () => {
  const texto = textoDesarrolloDesdeConsejo(
    { texto: "Cambiar la portada", respuesta: "Revisar el diseño" },
    "Conservar el logotipo",
  );
  expect(texto).toContain("Cambiar la portada");
  expect(texto).toContain("Revisar el diseño");
  expect(texto).toContain("Conservar el logotipo");
});
