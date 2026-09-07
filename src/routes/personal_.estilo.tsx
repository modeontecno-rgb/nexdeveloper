import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Loader2, SpellCheck } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import { useEstadoManuales, useGuardarConfigManuales } from "@/lib/nex/queries/manuales";
import { useEstadoPersonal, useGuardarMuestrasEstilo, useGuardarPerfilEstilo } from "@/lib/nex/queries/personal";

const DESCRIPCION =
  "Define cómo escribes y qué nombres hay que respetar; los manuales se revisan con ese perfil y ese glosario.";

export const Route = createFileRoute("/personal_/estilo")({
  head: () => ({
    meta: [
      { title: "Editor de estilo · NexDeveloper" },
      { name: "description", content: DESCRIPCION },
      { property: "og:title", content: "Editor de estilo · NexDeveloper" },
      { property: "og:description", content: DESCRIPCION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditorEstilo,
});

function EditorEstilo() {
  const estadoPersonal = useEstadoPersonal();
  const estadoManuales = useEstadoManuales();
  const guardarPerfil = useGuardarPerfilEstilo();
  const guardarMuestras = useGuardarMuestrasEstilo();
  const guardarConfig = useGuardarConfigManuales();

  const [muestras, setMuestras] = React.useState<string[]>(["", "", ""]);
  const [perfil, setPerfil] = React.useState("");
  const [glosario, setGlosario] = React.useState("");
  const [usarEnManuales, setUsarEnManuales] = React.useState(true);

  React.useEffect(() => {
    const config = estadoPersonal.data?.config;
    if (!config) return;
    setPerfil(config.perfil_estilo ?? "");
    if (config.muestras_estilo?.length) setMuestras(config.muestras_estilo);
  }, [estadoPersonal.data?.config]);

  React.useEffect(() => {
    const cfg = estadoManuales.data?.config;
    if (!cfg) return;
    setGlosario((cfg.glosario ?? []).join("\n"));
    setUsarEnManuales(cfg.usar_perfil_estilo ?? true);
  }, [estadoManuales.data?.config]);

  const guardando = guardarPerfil.isPending || guardarConfig.isPending;

  const listaGlosario = () =>
    glosario
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter(Boolean);

  function guardarTodo() {
    guardarPerfil.mutate(perfil, {
      onSuccess: () => {
        guardarConfig.mutate(
          { usar_perfil_estilo: usarEnManuales, glosario: listaGlosario() },
          { onSuccess: () => toast.success("Estilo guardado y cargado en la revisión de los manuales.") },
        );
      },
    });
  }

  return (
    <>
      <Encabezado
        titulo="Editor de estilo"
        descripcion={DESCRIPCION}
        acciones={
          <Link to="/personal" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Volver a PERSONAL
          </Link>
        }
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="panel space-y-3 p-4">
          <h2 className="font-display text-sm font-semibold">Perfil de estilo</h2>
          <p className="text-sm text-muted-foreground">
            Este texto describe cómo escribes. Puedes redactarlo a mano o dejar que lo aprenda de ejemplos tuyos.
          </p>
          <textarea
            value={perfil}
            onChange={(e) => setPerfil(e.target.value)}
            rows={12}
            placeholder="Frases cortas, tono cercano pero profesional, tratamiento de usted…"
            className={claseCampo}
          />

          <div className="rounded-xl border border-border bg-surface p-3">
            <h3 className="text-sm font-semibold">Aprender de mis textos</h3>
            <p className="mt-1 text-xs text-muted-foreground">Pega entre 3 y 6 textos escritos por ti.</p>
            <div className="mt-3 space-y-2">
              {muestras.map((m, i) => (
                <textarea
                  key={`muestra-${i}`}
                  value={m}
                  onChange={(e) => setMuestras((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                  rows={3}
                  placeholder={`Texto ${i + 1}`}
                  className={claseCampo}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {muestras.length < 6 ? (
                <Boton variante="suave" onClick={() => setMuestras((p) => [...p, ""])}>
                  Añadir otro texto
                </Boton>
              ) : null}
              <Boton
                variante="suave"
                onClick={() => {
                  const limpias = muestras.map((m) => m.trim()).filter(Boolean);
                  if (limpias.length < 3) {
                    toast.error("Necesito al menos 3 textos tuyos.");
                    return;
                  }
                  guardarMuestras.mutate(limpias, { onSuccess: (r) => r.perfil_estilo && setPerfil(r.perfil_estilo) });
                }}
                disabled={guardarMuestras.isPending}
              >
                {guardarMuestras.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Aprender mi estilo
              </Boton>
            </div>
          </div>
        </section>

        <section className="panel space-y-3 p-4">
          <h2 className="font-display text-sm font-semibold">Glosario de nombres a respetar</h2>
          <Campo
            etiqueta="Nombres propios"
            pista="Un nombre por línea o separados por comas. El revisor nunca los cambiará."
          >
            <textarea
              value={glosario}
              onChange={(e) => setGlosario(e.target.value)}
              rows={12}
              placeholder={"NexDeveloper\nEvoluteIA\nNombre del cliente"}
              className={claseCampo}
            />
          </Campo>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={usarEnManuales}
              onChange={(e) => setUsarEnManuales(e.target.checked)}
            />
            Aplicar mi perfil de estilo al revisar los manuales
          </label>

          <div className="rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <SpellCheck className="size-4" /> En vigor ahora mismo
            </p>
            <p className="mt-1">
              Perfil de estilo: {estadoManuales.data?.perfil_estilo ? "guardado" : "sin guardar"} ·{" "}
              {(estadoManuales.data?.config?.glosario ?? []).length} nombre(s) en el glosario.
            </p>
          </div>

          <Boton onClick={guardarTodo} disabled={guardando}>
            {guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Guardar y usar en los manuales
          </Boton>
          <p className="text-xs text-muted-foreground">
            También puedes verlo desde{" "}
            <Link to="/manuales" className="text-primary hover:underline">
              Manuales
            </Link>
            .
          </p>
        </section>
      </div>
    </>
  );
}
