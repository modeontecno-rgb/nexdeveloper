import * as React from "react";
import { Boton, claseCampo } from "./campos";
import { textoParaContinuar, type EncargoExterno } from "@/lib/nex/continuar-fuera";
import { useCancelarEjecucion } from "@/lib/nex/queries/ejecucion";
import { supabase } from "@/lib/nex/supabase";
export function ContinuarFuera({
  e,
  nombre,
  repo,
}: {
  e: EncargoExterno;
  nombre: string;
  repo: string | null;
}) {
  const [abierto, setAbierto] = React.useState(false),
    [texto, setTexto] = React.useState(""),
    [error, setError] = React.useState(""),
    [copiado, setCopiado] = React.useState(false),
    [datos, setDatos] = React.useState(e),
    [ocupado, setOcupado] = React.useState(false);
  const cancelar = useCancelarEjecucion();
  const activo = ["en_cola", "enviando", "construyendo", "comprobando", "publicando"].includes(
    e.estado ?? "",
  );
  async function preparar() {
    setError("");
    setOcupado(true);
    try {
      let actual = e;
      if (e.id) {
        // Consultar el estado actual evita exportar silenciosamente una ejecución que arrancó en otro dispositivo.
        const r = await supabase.from("ejecuciones_orden").select("*").eq("id", e.id).single();
        if (r.error || !r.data)
          throw Error(
            "No se pudo verificar el estado del encargo. Reintenta antes de llevarlo fuera.",
          );
        actual = r.data as EncargoExterno;
        if (
          ["en_cola", "enviando", "construyendo", "comprobando", "publicando"].includes(
            actual.estado ?? "",
          )
        ) {
          await cancelar.mutateAsync(e.id);
          const final = await supabase
            .from("ejecuciones_orden")
            .select("*")
            .eq("id", e.id)
            .single();
          if (final.error || !final.data || final.data.estado !== "cancelada")
            throw Error(
              "Todavía no está confirmada la detención. Comprueba el estado antes de trabajar fuera.",
            );
          actual = final.data as EncargoExterno;
        }
      }
      setDatos(actual);
      setTexto(textoParaContinuar(actual, nombre, repo));
      setAbierto(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo preparar el traspaso");
    } finally {
      setOcupado(false);
    }
  }
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setError("Selecciona el texto de abajo y cópialo con el menú de tu dispositivo.");
    }
  }
  function descargar() {
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ encargo: datos.id, cambios: datos.cambios ?? {} }, null, 2)], {
        type: "application/json",
      }),
    );
    a.href = url;
    a.download = "nexdeveloper-cambios-preparados.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="rounded-xl border border-border p-4 space-y-3">
      <p className="text-lg font-semibold">Aprovechar mi cuenta de Codex u otra IA</p>
      <p className="text-sm">
        Para trabajo que tu herramienta pueda resolver con calidad equivalente, puedes llevarte el
        encargo a tu cuenta personal o Business. Preparar este texto no llama a ninguna IA ni
        consume API. Tu cuenta puede tener sus propios límites.
      </p>
      <Boton variante="suave" disabled={ocupado} onClick={() => void preparar()}>
        {ocupado
          ? "Preparando…"
          : activo
            ? "Detener aquí y preparar para otra IA"
            : "Preparar texto para otra IA"}
      </Boton>
      {activo ? (
        <p className="text-sm">
          Detiene nuevos pasos en NexDeveloper y conserva la entrega parcial. Una llamada ya enviada
          puede seguir consumiendo; no se reembolsa ni se reinicia automáticamente.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive break-words">
          {error}
        </p>
      ) : null}
      {abierto ? (
        <div className="space-y-3">
          <ol className="list-decimal pl-6 space-y-2 text-sm">
            <li>Copia el texto y pégalo en Codex o tu herramienta con acceso a este GitHub.</li>
            <li>Al acabar, conserva el enlace de la PR y el resumen de lo realizado.</li>
            <li>
              Vuelve a «Pedir consejo» y pega ese resumen para solicitar la revisión del repositorio
              actualizado. Esa revisión sí consume API.
            </li>
          </ol>
          <Boton onClick={() => void copiar()}>
            {copiado ? "Copiado" : "Copiar encargo completo"}
          </Boton>
          <textarea
            aria-label="Texto para continuar en otra IA"
            readOnly
            value={texto}
            rows={12}
            className={`${claseCampo} w-full text-base`}
          />
          {Object.keys(datos.cambios ?? {}).length ? (
            <Boton variante="suave" onClick={descargar}>
              Descargar archivos preparados (JSON)
            </Boton>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
