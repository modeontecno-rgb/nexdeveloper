import { ChevronDown, KeyRound, PlugZap, Star } from "lucide-react";
import * as React from "react";

import { Dialogo } from "@/components/nex/dialogo";
import { Boton, Campo, claseCampo } from "@/components/nex/campos";
import type { ModeloIaRow, ProveedorIaRow } from "@/lib/nex/db-types";
import { CLASE_VELOCIDAD, ETIQUETA_TAREA_IA, ETIQUETA_VELOCIDAD, TAREAS_IA } from "@/lib/nex/enrutado";
import { formatoDinero } from "@/lib/nex/labels";
import { useGuardarClaveProveedor, useGuardarModelo, useGuardarProveedor, useProbarProveedor } from "@/lib/nex/queries/proveedores";
import { cn } from "@/lib/utils";

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

  return (
    <article className="panel p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 font-display text-sm font-semibold text-primary ring-1 ring-primary/30">
          {proveedor.nombre.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{proveedor.nombre}</h3>
          <p className="text-xs text-muted-foreground">
            {proveedor.tipo} · {proveedor.tiene_clave ? "Clave guardada" : "Sin clave"}
          </p>
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

      <p className="mt-3 text-xs text-muted-foreground">
        Gasto de este mes: <span className="font-medium text-foreground">{formatoDinero(gastoMes, moneda)}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Boton variante="suave" onClick={() => setDialogoClave(true)}>
          <KeyRound className="size-4" /> Clave…
        </Boton>
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
