import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { useNex } from "@/lib/nex/store";

export const Route = createFileRoute("/estado")({
  head: () => ({
    meta: [
      { title: "Estado del sistema · NexDeveloper" },
      { name: "description", content: "Semáforos de cada pieza del sistema e informe de estado en texto plano." },
      { property: "og:title", content: "Estado del sistema · NexDeveloper" },
      { property: "og:description", content: "Semáforos de cada pieza del sistema e informe copiable." },
    ],
  }),
  component: EstadoSistema,
});

type Nivel = "ok" | "aviso" | "error";

function EstadoSistema() {
  const { integraciones, tareas, origenDatos } = useNex();

  const piezas: { nombre: string; nivel: Nivel; detalle: string }[] = [
    {
      nombre: "Base de datos propia",
      nivel: "error",
      detalle: "Sin enlazar. Se muestran datos de demostración guardados en este navegador.",
    },
    {
      nombre: "Origen de datos activo",
      nivel: origenDatos === "demostracion" ? "aviso" : "ok",
      detalle: origenDatos === "demostracion" ? "Datos de demostración" : "Datos reales",
    },
    {
      nombre: "Almacenamiento de archivos",
      nivel: "error",
      detalle: "Disponible al enlazar la base de datos propia.",
    },
    {
      nombre: "Actualización en tiempo real",
      nivel: "error",
      detalle: "Disponible al enlazar la base de datos propia.",
    },
    {
      nombre: "Repositorio de código",
      nivel: "aviso",
      detalle: "Pendiente de autorizar GitHub y crear el repositorio privado «nexdeveloper».",
    },
    {
      nombre: "Adaptadores de agentes",
      nivel: "aviso",
      detalle: "Preparados y simulados. Ninguna API real conectada.",
    },
    {
      nombre: "Cola de trabajo",
      nivel: "ok",
      detalle: `${tareas.filter((t) => t.estado !== "completada").length} tareas activas.`,
    },
    {
      nombre: "Secretos",
      nivel: integraciones.some((i) => i.secretos.some((s) => s.configurado)) ? "ok" : "aviso",
      detalle: "Gestionados por referencia, nunca en texto plano.",
    },
  ];

  const informe = [
    "INFORME DE ESTADO — NexDeveloper",
    new Date().toLocaleString("es-ES"),
    "",
    ...piezas.map((p) => `- ${p.nombre}: ${p.nivel.toUpperCase()} — ${p.detalle}`),
    "",
    "Secretos:",
    ...integraciones.flatMap((i) =>
      i.secretos.map((s) => `- ${i.nombre} / ${s.referencia}: ${s.configurado ? "configurada" : "sin configurar"}`),
    ),
  ].join("\n");

  return (
    <>
      <Encabezado
        titulo="Estado del sistema"
        descripcion="Qué funciona, qué falta por configurar y qué está simulado."
        acciones={
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(informe);
                toast.success("Informe copiado");
              } catch {
                toast.error("No se ha podido copiar el informe");
              }
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Copiar informe
          </button>
        }
      />

      <div className="grid gap-3 md:grid-cols-2">
        {piezas.map((p) => (
          <div key={p.nombre} className="panel flex items-start gap-3 p-4">
            <span
              className={
                p.nivel === "ok"
                  ? "mt-1 size-2.5 shrink-0 rounded-full bg-success"
                  : p.nivel === "aviso"
                    ? "mt-1 size-2.5 shrink-0 rounded-full bg-warning"
                    : "mt-1 size-2.5 shrink-0 rounded-full bg-destructive"
              }
            />
            <div>
              <p className="text-sm font-medium">{p.nombre}</p>
              <p className="text-xs text-muted-foreground">{p.detalle}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="panel mt-6 p-4">
        <h2 className="font-display text-sm font-semibold">Informe en texto plano</h2>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 text-xs">{informe}</pre>
        <p className="mt-2 text-xs text-muted-foreground">El informe nunca incluye contraseñas ni claves.</p>
      </div>
    </>
  );
}
