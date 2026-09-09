// @vitest-environment happy-dom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { EstudioDesarrollo } from "./estudio-desarrollo";
const datos = vi.hoisted(() => ({ trabajos: [] as any[], sonido: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: any) => <a>{children}</a> }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: datos.trabajos }),
  useQueryClient: () => ({}),
  useMutation: () => ({}),
}));
vi.mock("@/lib/nex/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/nex/queries/datos", () => ({
  useProyectos: () => ({
    data: [
      { id: "p", nombre: "Proyecto de prueba", repositorio: "https://github.com/example/demo" },
    ],
  }),
}));
vi.mock("@/lib/nex/queries/ejecucion", () => ({
  useCancelarEjecucion: () => ({}),
  useAprobarPublicar: () => ({}),
  ETIQUETA_ESTADO_EJECUCION: {},
}));
vi.mock("./dictado", () => ({
  CampoTextoConDictado: ({ valor, onValor }: { valor: string; onValor: (v: string) => void }) => (
    <textarea value={valor} onChange={(e) => onValor(e.target.value)} />
  ),
}));
vi.mock("./adjuntos", () => ({
  BotonAdjuntar: () => null,
  ListaAdjuntos: () => null,
  ZonaAdjuntos: ({ children }: any) => children,
  useAdjuntos: () => ({ ids: [], adjuntos: [] }),
}));
vi.mock("./app-shell", () => ({ Encabezado: () => null }));
vi.mock("@/lib/nex/sonidos", () => ({
  prepararSonido: vi.fn(),
  sonidoTrabajoTerminado: datos.sonido,
}));
afterEach(() => vi.unstubAllGlobals());
it("al terminar abre el resultado, avisa y baja a Tus trabajos una sola vez", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const scroll = vi.fn();
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
    cb();
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  Element.prototype.scrollIntoView = scroll;
  const node = document.createElement("div");
  document.body.appendChild(node);
  const root = createRoot(node);
  datos.trabajos = [{ id: "uno", proyecto_id: "p", texto: "Mi consulta", estado: "en_cola" }];
  await act(async () => root.render(<EstudioDesarrollo />));
  expect(node.querySelector('[role="status"]')).toBeNull();
  datos.trabajos = [
    {
      ...datos.trabajos[0],
      estado: "completada",
      respuesta: "Esta es la respuesta completa",
      estado_agente: {
        equipo: [
          {
            papel: "consejo",
            modelo: { proveedor: "openai", identificador: "prueba" },
            estado: "completada",
            motivo: "Prueba",
          },
        ],
      },
    },
  ];
  await act(async () => root.render(<EstudioDesarrollo />));
  expect(node.querySelector('[role="status"]')?.textContent).toContain("¡Trabajo terminado!");
  expect(node.querySelector('[aria-expanded="true"]')?.textContent).toContain("Mi consulta");
  expect(node.textContent).toContain("Esta es la respuesta completa");
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(datos.sonido).toHaveBeenCalledTimes(1);
  datos.trabajos = [...datos.trabajos];
  await act(async () => root.render(<EstudioDesarrollo />));
  expect(datos.sonido).toHaveBeenCalledTimes(1);
  await act(async () =>
    Array.from(node.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("Entendido"))!
      .click(),
  );
  expect(node.querySelector('[role="status"]')).toBeNull();
  expect(node.querySelector('[aria-expanded="true"]')).not.toBeNull();
  await act(async () =>
    Array.from(node.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("Desarrollar este consejo"))!
      .click(),
  );
  expect(node.querySelector("textarea")?.value).toContain("Mi consulta");
  expect(node.querySelector("textarea")?.value).toContain("Esta es la respuesta completa");
  expect(node.querySelector('[role="status"]')?.textContent).toContain("Desarrollo preparado");
  expect(
    Array.from(node.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Encargar desarrollo"),
    )?.disabled,
  ).toBe(false);
  await act(async () => root.unmount());
  node.remove();
});
