import * as React from "react";

import { Boton, Campo, Selector, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type { IntegracionRow, TipoIntegracion } from "@/lib/nex/db-types";
import { ETIQUETA_TIPO_INTEGRACION } from "@/lib/nex/labels";
import { codigoDesdeNombre, useGuardarIntegracion } from "@/lib/nex/queries/integraciones";

const TIPOS = Object.keys(ETIQUETA_TIPO_INTEGRACION) as TipoIntegracion[];

export function FormularioIntegracion({
  abierto,
  onCerrar,
  integracion,
}: {
  abierto: boolean;
  onCerrar: () => void;
  integracion?: IntegracionRow | undefined;
}) {
  const guardar = useGuardarIntegracion();
  const [nombre, setNombre] = React.useState(integracion?.nombre ?? "");
  const [tipo, setTipo] = React.useState<TipoIntegracion>(integracion?.tipo ?? "otro");
  const [descripcion, setDescripcion] = React.useState(integracion?.descripcion ?? "");
  const [urlPanel, setUrlPanel] = React.useState(integracion?.url_panel ?? "");
  const [urlDocs, setUrlDocs] = React.useState(integracion?.url_docs ?? "");
  const [capacidades, setCapacidades] = React.useState((integracion?.capacidades ?? []).join(", "));
  const [referencias, setReferencias] = React.useState("");
  const [aprobacion, setAprobacion] = React.useState(integracion?.requiere_aprobacion ?? true);

  React.useEffect(() => {
    if (!abierto) return;
    setNombre(integracion?.nombre ?? "");
    setTipo(integracion?.tipo ?? "otro");
    setDescripcion(integracion?.descripcion ?? "");
    setUrlPanel(integracion?.url_panel ?? "");
    setUrlDocs(integracion?.url_docs ?? "");
    setCapacidades((integracion?.capacidades ?? []).join(", "));
    setReferencias("");
    setAprobacion(integracion?.requiere_aprobacion ?? true);
  }, [abierto, integracion]);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    guardar.mutate(
      {
        id: integracion?.id,
        nombre: nombre.trim(),
        codigo: integracion?.codigo ?? codigoDesdeNombre(nombre),
        tipo,
        descripcion: descripcion.trim(),
        urlPanel: urlPanel.trim(),
        urlDocs: urlDocs.trim(),
        capacidades: capacidades
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        requiereAprobacion: aprobacion,
        referencias: referencias
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean),
      },
      { onSuccess: onCerrar },
    );
  };

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={integracion ? "Editar integración" : "Nueva integración"}
      descripcion="Aquí solo se guarda el nombre de cada credencial, nunca su valor."
    >
      <form onSubmit={enviar} className="space-y-4">
        <Campo etiqueta="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={claseCampo} />
        </Campo>

        <Selector
          etiqueta="Tipo"
          valor={tipo}
          onChange={(v) => setTipo(v as TipoIntegracion)}
          opciones={TIPOS.map((t) => ({ valor: t, texto: ETIQUETA_TIPO_INTEGRACION[t] }))}
        />

        <Campo etiqueta="Para qué sirve">
          <textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={claseCampo} />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Panel del servicio">
            <input value={urlPanel} onChange={(e) => setUrlPanel(e.target.value)} className={claseCampo} placeholder="https://" />
          </Campo>
          <Campo etiqueta="Documentación">
            <input value={urlDocs} onChange={(e) => setUrlDocs(e.target.value)} className={claseCampo} placeholder="https://" />
          </Campo>
        </div>

        <Campo etiqueta="Qué puede hacer" pista="Separa cada capacidad con una coma.">
          <input value={capacidades} onChange={(e) => setCapacidades(e.target.value)} className={claseCampo} />
        </Campo>

        <Campo
          etiqueta="Nombres de las credenciales que necesita"
          pista="Solo el nombre, separado por comas. El valor se guarda cifrado en el servidor."
        >
          <input value={referencias} onChange={(e) => setReferencias(e.target.value)} className={claseCampo} placeholder="GITHUB_TOKEN" />
        </Campo>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={aprobacion} onChange={(e) => setAprobacion(e.target.checked)} />
          Sus acciones necesitan mi aprobación
        </label>

        <div className="flex justify-end gap-2">
          <Boton variante="suave" type="button" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={!nombre.trim() || guardar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
