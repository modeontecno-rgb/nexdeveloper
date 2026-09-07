import { describe, expect, it } from "vitest";

import type { InfraServicioRow, Semaforo, TipoServicioInfra } from "../db-types";
import { filasVisibles, resumenConexiones, textoEstado } from "./conexiones";

function fila(nombre: string, tipo: TipoServicioInfra, estado: Semaforo): InfraServicioRow {
  return {
    id: nombre,
    user_id: "u",
    nombre,
    tipo,
    proveedor: null,
    url: null,
    referencia: null,
    metodo: null,
    ambito: "global",
    critico: false,
    activo: true,
    origen: "manual",
    estado,
    fallos_seguidos: 0,
    ultimo_ms: null,
    ultimo_detalle: null,
    ultimo_error: null,
    comprobado_el: null,
    ultimo_verde_el: null,
    coste_mensual: null,
    renovacion_el: null,
    notas: null,
  };
}

describe("resumenConexiones", () => {
  it("cuenta cada semáforo", () => {
    const filas = [
      fila("a", "conexion", "verde"),
      fila("b", "proveedor_ia", "verde"),
      fila("c", "s3", "ambar"),
      fila("d", "sentry", "rojo"),
      fila("e", "proyectian", "gris"),
    ];
    expect(resumenConexiones(filas)).toEqual({ verdes: 2, ambar: 1, rojos: 1, grises: 1 });
  });
});

describe("textoEstado", () => {
  it("traduce los cuatro estados", () => {
    expect(textoEstado("verde")).toBe("Conectada");
    expect(textoEstado("ambar")).toBe("Atención");
    expect(textoEstado("rojo")).toBe("Caída");
    expect(textoEstado("gris")).toBe("Sin configurar");
  });
});

describe("filasVisibles", () => {
  it("deja fuera los tipos que no son de esta pantalla", () => {
    const filas = [
      fila("conexion", "conexion", "verde"),
      fila("web", "http", "verde"),
      fila("dns", "dns", "verde"),
      fila("funcion", "funcion", "verde"),
      fila("github", "github", "verde"),
      fila("supabase", "supabase", "verde"),
      fila("ia", "proveedor_ia", "verde"),
    ];
    expect(filasVisibles(filas).map((f) => f.nombre)).toEqual(["conexion", "ia"]);
  });
});
