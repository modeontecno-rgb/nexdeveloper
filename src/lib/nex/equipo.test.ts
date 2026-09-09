import { describe, it, expect } from "vitest";
import {
  prepararEquipo,
  escrituraPermitida,
  solicitudModelo,
  respuestaModelo,
  soloLectura,
} from "../../../db/functions/_shared/equipo";
const modelo = (proveedor: string) => ({
  id: proveedor,
  proveedor_id: proveedor,
  proveedor,
  identificador: "fixture",
  calidad: 4,
  tareas_aconsejadas: ["codigo"],
  coste: 1,
});
describe("equipo de desarrollo", () => {
  it("reparte diseño, backend, programación y revisión sin activar todos los proveedores", () => {
    const f = prepararEquipo(
      ["anthropic", "openai", "google", "xai", "deepseek"].map(modelo),
      "Crear login y pantalla",
    );
    expect(f.map((x) => x.papel)).toEqual(["diseno", "backend", "interfaz", "revision"]);
    expect(f.map((x) => x.modelo.proveedor)).toEqual(["google", "anthropic", "openai", "xai"]);
  });
  it("un consejo no escribe código", () => {
    const f = prepararEquipo([modelo("anthropic")], "Qué hacer", true);
    expect(f).toHaveLength(1);
    expect(soloLectura(f[0]!.papel)).toBe(true);
  });
  it("no inventa una conexión ni elige proveedores sin adaptador", () => {
    expect(() => prepararEquipo([modelo("canva")], "programa")).toThrow();
    expect(() => prepararEquipo([], "programa")).toThrow();
  });
  it("permite otros proveedores cuando son los disponibles", () => {
    expect(
      prepararEquipo([modelo("deepseek")], "cambiar texto").every(
        (f) => f.modelo.proveedor === "deepseek",
      ),
    ).toBe(true);
  });
  it("protege secretos, workflow y rutas fuera del repositorio", () => {
    for (const p of [
      ".env",
      ".env.local",
      "a/../b",
      "/tmp/x",
      "a\\b",
      ".github/workflows/build.yml",
      ".git/config",
      "secret.pem",
    ])
      expect(escrituraPermitida(p)).toBe(false);
    expect(escrituraPermitida("src/auth.ts")).toBe(true);
  });
  it("serializa resultados de herramientas de OpenAI", () => {
    const r = solicitudModelo(
      "openai",
      "fixture",
      "system",
      [
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "123", name: "leer", content: "ok" }],
        },
      ],
      [],
    );
    expect(r.body.messages?.[1]).toEqual({ role: "tool", tool_call_id: "123", content: "ok" });
    expect(r.body.max_completion_tokens).toBe(8000);
  });
  it("conserva firmas nativas de Gemini y nombres de resultados", () => {
    const native = [{ functionCall: { name: "leer", args: {} }, thoughtSignature: "signed" }];
    const normalized = respuestaModelo("google", { candidates: [{ content: { parts: native } }] });
    const r = solicitudModelo(
      "google",
      "fixture",
      "system",
      [
        { role: "assistant", content: normalized.content, _native: normalized._native },
        { role: "user", content: [{ type: "tool_result", name: "leer", content: "file" }] },
      ],
      [],
    );
    expect(r.body.contents?.[0].parts).toEqual(native);
    expect(r.body.contents?.[1].parts[0].functionResponse.name).toBe("leer");
  });
  it("conserva reasoning_content de DeepSeek para el siguiente turno", () => {
    const m = {
      role: "assistant",
      content: null,
      reasoning_content: "reasoning",
      tool_calls: [{ id: "call", function: { name: "leer", arguments: "{}" } }],
    };
    const n = respuestaModelo("deepseek", { choices: [{ message: m }] });
    expect(
      solicitudModelo(
        "deepseek",
        "fixture",
        "system",
        [{ role: "assistant", content: n.content, _native: n._native }],
        [],
      ).body.messages?.[1],
    ).toEqual(m);
  });
  it("no envía campos ajenos al protocolo Anthropic", () => {
    const r = solicitudModelo(
      "anthropic",
      "fixture",
      "system",
      [
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "id", name: "leer", content: "ok" }],
        },
      ],
      [],
    );
    expect(r.body.messages?.[0].content[0]).not.toHaveProperty("name");
  });
});
