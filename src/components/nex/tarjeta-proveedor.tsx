import { ChevronDown, KeyRound, Link2, PlugZap, Star } from "lucide-react";
import * as React from "react";

import { Dialogo } from "@/components/nex/dialogo";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import type { ModeloIaRow, ProveedorIaRow } from "@/lib/nex/db-types";
import { CLASE_VELOCIDAD, ETIQUETA_TAREA_IA, ETIQUETA_VELOCIDAD, TAREAS_IA } from "@/lib/nex/enrutado";
import { formatoDinero } from "@/lib/nex/labels";
import {
  useConectarCanva,
  useGuardarClaveProveedor,
  useGuardarModelo,
  useGuardarProveedor,
  useProbarProveedor,
} from "@/lib/nex/queries/proveedores";
import { cn } from "@/lib/utils";

/** Una línea que explica para qué sirve cada proveedor. */
export const PARA_QUE_SIRVE: Record<string, string> = {
  anthropic: "Modelos Claude: programación, razonamiento largo y análisis de documentos.",
  openai: "Modelos GPT: uso general, visión y voz en un mismo proveedor.",
  google: "Modelos Gemini: contexto enorme, visión y generación de imágenes.",
  groq: "Modelos abiertos a mucha velocidad y precio bajo.",
  mistral: "Modelos europeos equilibrados, con Codestral para programar.",
  deepseek: "Razonamiento y programación a coste muy contenido.",
  xai: "Modelos Grok: razonamiento y programación con contexto amplio.",
  perplexity: "Búsqueda en internet con respuestas citadas y actualizadas.",
  cohere: "Modelos de empresa para clasificar, resumir y buscar documentos.",
  openrouter: "Pasarela única hacia cientos de modelos de otros proveedores.",
  together: "Modelos abiertos alojados, con buen precio por rendimiento.",
  elevenlabs: "Voz: locución natural, doblaje y clonación de voz.",
  fal: "Imagen y vídeo por generación rápida con modelos FLUX.",
  abacus: "Plataforma con enrutado propio incluido en la suscripción.",
  ollama: "Modelos ejecutados en tu propio equipo, sin coste por uso.",
  canva: "Diseños desde tus plantillas de marca, autorrelleno y exportación a PDF, PNG o MP4.",
};

const ETIQUETA_TIPO: Record<string, string> = {
  texto: "Texto",
  voz: "Voz",
  imagen: "Imagen",
  busqueda: "Búsqueda",
  multi: "Multiuso",
};

export function TarjetaProveedor({
  proveedor,
  modelos,
  gastoMes,
  moneda,
}: {
  proveedor: ProveedorIaRow;
  modelos: ModeloIaRow[];
  gastoMes: number;
  moneda: string;
}) {
  const [abierta, setAbierta] = React.useState(false);
  const [dialogoClave, setDialogoClave] = React.useState(false);
  const [clave, setClave] = React.useState("");
  const guardarProveedor = useGuardarProveedor();
  const guardarClave = useGuardarClaveProveedor();
  const probar = useProbarProveedor();
  const conectarCanva = useConectarCanva();
  const esCanva = proveedor.clave_slug === "canva";
  const esOllama = proveedor.clave_slug === "ollama";
  const [urlBase, setUrlBase] = React.useState(proveedor.url_base ?? "http://localhost:11434");

  return (
    <article className="panel p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 font-display text-sm font-semibold text-primary ring-1 ring-primary/30">
          {proveedor.nombre.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{proveedor.nombre}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground/80">
              {ETIQUETA_TIPO[proveedor.tipo] ?? proveedor.tipo}
            </span>
            <span>
              {esCanva
                ? proveedor.tiene_clave
                  ? `Conectado como ${proveedor.cuenta ?? "cuenta de Canva"}`
                  : "Sin conectar"
                : proveedor.tiene_clave
                  ? "Clave guardada"
                  : "Sin clave"}
            </span>
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={proveedor.activo}
            onChange={(e) => guardarProveedor.mutate({ id: proveedor.id, cambios: { activo: e.target.checked } })}
            className="size-4 rounded border-input accent-primary"
          />
          Activo
        </label>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{PARA_QUE_SIRVE[proveedor.clave_slug] ?? proveedor.notas ?? ""}</p>

      {esOllama ? (
        <div className="mt-3 space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor={`url-${proveedor.id}`}>
            Dirección de tu servidor
          </label>
          <input
            id={`url-${proveedor.id}`}
            value={urlBase}
            onChange={(e) => setUrlBase(e.target.value)}
            onBlur={() => guardarProveedor.mutate({ id: proveedor.id, cambios: { url_base: urlBase.trim() } })}
            className={claseCampo}
          />
          <p className="text-xs text-warning">
            Solo accesible desde tu red; la función de prueba del servidor no llega a tu equipo.
          </p>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        Gasto de este mes: <span className="font-medium text-foreground">{formatoDinero(gastoMes, moneda)}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {esCanva ? (
          <Boton variante="suave" disabled={conectarCanva.isPending} onClick={() => conectarCanva.mutate(proveedor.id)}>
            <Link2 className="size-4" /> {proveedor.tiene_clave ? "Volver a conectar" : "Conectar con Canva"}
          </Boton>
        ) : (
          <Boton variante="suave" onClick={() => setDialogoClave(true)}>
            <KeyRound className="size-4" /> Clave…
          </Boton>
        )}
        <Boton variante="suave" disabled={probar.isPending} onClick={() => probar.mutate(proveedor.id)}>
          <PlugZap className="size-4" /> Probar
        </Boton>
        <Boton variante="suave" onClick={() => setAbierta((v) => !v)}>
          <ChevronDown className={cn("size-4 transition-transform", abierta && "rotate-180")} />
          {modelos.length} modelos
        </Boton>
      </div>

      {abierta ? (
        <ul className="mt-4 space-y-3 border-t border-border pt-3">
          {modelos.map((m) => (
            <FilaModelo key={m.id} modelo={m} moneda={moneda} />
          ))}
          {modelos.length === 0 ? <li className="text-sm text-muted-foreground">Sin modelos.</li> : null}
        </ul>
      ) : null}

      <Dialogo
        abierto={dialogoClave}
        titulo={`Clave de ${proveedor.nombre}`}
        descripcion="Se cifra en el servidor al guardarla y no se vuelve a mostrar nunca."
        onCerrar={() => {
          setDialogoClave(false);
          setClave("");
        }}
      >
        <Campo etiqueta="Clave del proveedor">
          <input
            type="password"
            autoComplete="off"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="Pega aquí la clave"
            className={claseCampo}
          />
        </Campo>
        <div className="mt-4 flex justify-end gap-2">
          <Boton variante="suave" onClick={() => setDialogoClave(false)}>
            Cancelar
          </Boton>
          <Boton
            disabled={!clave.trim() || guardarClave.isPending}
            onClick={() =>
              guardarClave.mutate(
                { id: proveedor.id, clave: clave.trim() },
                {
                  onSuccess: () => {
                    setClave("");
                    setDialogoClave(false);
                  },
                },
              )
            }
          >
            Guardar clave
          </Boton>
        </div>
      </Dialogo>
    </article>
  );
}

function FilaModelo({ modelo, moneda }: { modelo: ModeloIaRow; moneda: string }) {
  const guardar = useGuardarModelo();
  const [entrada, setEntrada] = React.useState(String(modelo.coste_entrada ?? ""));
  const [salida, setSalida] = React.useState(String(modelo.coste_salida ?? ""));

  const numero = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={modelo.activo}
          onChange={(e) => guardar.mutate({ id: modelo.id, cambios: { activo: e.target.checked } })}
          aria-label={`Activar ${modelo.nombre}`}
          className="size-4 rounded border-input accent-primary"
        />
        <span className="text-sm font-medium text-foreground">{modelo.nombre}</span>
        <span className="font-mono text-xs text-muted-foreground">{modelo.identificador}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px]", CLASE_VELOCIDAD[modelo.velocidad])}>
          {ETIQUETA_VELOCIDAD[modelo.velocidad]}
        </span>
        <span className="flex items-center gap-0.5" aria-label={`Calidad ${modelo.calidad ?? 0} de 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={cn("size-3", n <= (modelo.calidad ?? 0) ? "fill-warning text-warning" : "text-muted-foreground/40")}
            />
          ))}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Entrada ({moneda}/M)
          <input
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onBlur={() => guardar.mutate({ id: modelo.id, cambios: { coste_entrada: numero(entrada) } })}
            className="mt-1 w-24 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Salida ({moneda}/M)
          <input
            value={salida}
            onChange={(e) => setSalida(e.target.value)}
            onBlur={() => guardar.mutate({ id: modelo.id, cambios: { coste_salida: numero(salida) } })}
            className="mt-1 w-24 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
          />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {TAREAS_IA.map((t) => {
          const puesta = modelo.tareas_aconsejadas.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() =>
                guardar.mutate({
                  id: modelo.id,
                  cambios: {
                    tareas_aconsejadas: puesta
                      ? modelo.tareas_aconsejadas.filter((x) => x !== t)
                      : [...modelo.tareas_aconsejadas, t],
                  },
                })
              }
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                puesta
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {ETIQUETA_TAREA_IA[t]}
            </button>
          );
        })}
      </div>

      {modelo.notas ? <p className="mt-2 text-xs text-muted-foreground">{modelo.notas}</p> : null}
    </li>
  );
}
