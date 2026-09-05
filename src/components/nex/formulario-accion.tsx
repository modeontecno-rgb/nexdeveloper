import * as React from "react";

import { Boton, Campo, Selector, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import { ACCION_SENSIBLE, CAMPOS_ACCION } from "@/lib/nex/acciones-campos";
import type { Json, TipoAccion } from "@/lib/nex/db-types";
import { ETIQUETA_TIPO_ACCION } from "@/lib/nex/labels";
import { useCrearAccion } from "@/lib/nex/queries/acciones";
import { usePlantillasAccion } from "@/lib/nex/queries/datos";

const TIPOS = Object.keys(ETIQUETA_TIPO_ACCION) as TipoAccion[];

/** Crea una acción real (base de datos, repositorio, llamada web) desde la propia aplicación. */
export function FormularioAccion({
  abierto,
  onCerrar,
  proyectoId,
  tareaId = null,
}: {
  abierto: boolean;
  onCerrar: () => void;
  proyectoId: string | null;
  tareaId?: string | null;
}) {
  const { data: plantillas = [] } = usePlantillasAccion();
  const crear = useCrearAccion();

  const [tipo, setTipo] = React.useState<TipoAccion>("supabase_listar_tablas");
  const [titulo, setTitulo] = React.useState("");
  const [valores, setValores] = React.useState<Record<string, string>>({});
  const [aprobacion, setAprobacion] = React.useState(true);

  const campos = CAMPOS_ACCION[tipo];

  const cambiarTipo = (nuevo: TipoAccion) => {
    setTipo(nuevo);
    setValores({});
    setAprobacion(ACCION_SENSIBLE[nuevo]);
    if (!titulo.trim()) setTitulo(ETIQUETA_TIPO_ACCION[nuevo]);
  };

  const aplicarPlantilla = (id: string) => {
    const plantilla = plantillas.find((p) => p.id === id);
    if (!plantilla) return;
    setTipo(plantilla.tipo);
    setTitulo(plantilla.nombre);
    setAprobacion(plantilla.requiere_aprobacion);
    const previos = (plantilla.parametros_por_defecto ?? {}) as Record<string, unknown>;
    const texto: Record<string, string> = {};
    for (const [k, v] of Object.entries(previos)) texto[k] = typeof v === "string" ? v : JSON.stringify(v);
    setValores(texto);
  };

  const faltan = campos.filter((c) => c.obligatorio && !(valores[c.clave] ?? "").trim());

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (faltan.length > 0) return;
    const parametros: Record<string, Json> = {};
    for (const campo of campos) {
      // Los secretos no se guardan: se envían aparte en el momento de ejecutar.
      if (campo.esSecreto) continue;
      const bruto = valores[campo.clave] ?? "";
      parametros[campo.clave] = campo.tipo === "booleano" ? bruto === "si" : bruto;
    }
    crear.mutate(
      {
        proyectoId,
        tareaId,
        tipo,
        titulo: titulo.trim() || ETIQUETA_TIPO_ACCION[tipo],
        parametros,
        requiereAprobacion: aprobacion,
      },
      {
        onSuccess: () => {
          setValores({});
          setTitulo("");
          onCerrar();
        },
      },
    );
  };

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Nueva acción"
      descripcion="Define qué debe hacerse. Las acciones que cambian algo se ejecutan solo después de tu aprobación."
    >
      <form onSubmit={enviar} className="space-y-4">
        {plantillas.length > 0 ? (
          <Selector
            etiqueta="Partir de una plantilla"
            valor=""
            onChange={aplicarPlantilla}
            opciones={[{ valor: "", texto: "Sin plantilla" }, ...plantillas.map((p) => ({ valor: p.id, texto: p.nombre }))]}
          />
        ) : null}

        <Selector
          etiqueta="Tipo de acción"
          valor={tipo}
          onChange={(v) => cambiarTipo(v as TipoAccion)}
          opciones={TIPOS.map((t) => ({ valor: t, texto: ETIQUETA_TIPO_ACCION[t] }))}
        />

        <Campo etiqueta="Título">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={claseCampo} placeholder="Para reconocerla luego" />
        </Campo>

        {campos.map((campo) => (
          <Campo key={campo.clave} etiqueta={campo.etiqueta} {...(campo.ayuda ? { pista: campo.ayuda } : {})}>
            {campo.tipo === "area" ? (
              <textarea
                rows={5}
                value={valores[campo.clave] ?? ""}
                onChange={(e) => setValores((v) => ({ ...v, [campo.clave]: e.target.value }))}
                className={`${claseCampo} font-mono text-xs`}
              />
            ) : campo.tipo === "booleano" ? (
              <Selector
                etiqueta=""
                valor={valores[campo.clave] ?? "si"}
                onChange={(v) => setValores((val) => ({ ...val, [campo.clave]: v }))}
                opciones={[
                  { valor: "si", texto: "Sí" },
                  { valor: "no", texto: "No" },
                ]}
              />
            ) : (
              <input
                type={campo.esSecreto ? "password" : "text"}
                value={valores[campo.clave] ?? ""}
                onChange={(e) => setValores((v) => ({ ...v, [campo.clave]: e.target.value }))}
                className={claseCampo}
              />
            )}
          </Campo>
        ))}

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={aprobacion} onChange={(e) => setAprobacion(e.target.checked)} />
          Pedir mi aprobación antes de ejecutarla
        </label>

        <div className="flex justify-end gap-2">
          <Boton variante="suave" type="button" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={faltan.length > 0 || crear.isPending}>
            Crear acción
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
