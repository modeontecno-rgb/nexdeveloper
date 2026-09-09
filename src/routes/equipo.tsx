import { CATALOGO_EQUIPO } from "@/lib/nex/catalogo-equipo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/nex/supabase";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Encabezado } from "@/components/nex/app-shell";
import { useProveedoresIa } from "@/lib/nex/queries/proveedores";
export const Route = createFileRoute("/equipo")({ component: Equipo });
const reparto = [
  [
    "Coordinación y consejos",
    "OpenAI, Claude o Gemini",
    "Convertir tu petición en un resultado concreto y decidir la secuencia.",
  ],
  [
    "Diseño y arquitectura",
    "Gemini, Claude o OpenAI",
    "Leer referencias y definir pantallas, comportamiento y contrato de datos.",
  ],
  [
    "Backend y datos",
    "Claude, OpenAI o DeepSeek",
    "Implementar servidor, validaciones, permisos y datos.",
  ],
  [
    "Interfaz y programación",
    "OpenAI, Claude, DeepSeek o Grok",
    "Construir las pantallas y conectarlas al backend.",
  ],
  [
    "Revisión",
    "Grok, Gemini, Claude, OpenAI o DeepSeek",
    "Revisar el código acumulado; se prioriza un proveedor distinto al programador.",
  ],
  [
    "Otros modelos compatibles",
    "Mistral, Groq y OpenRouter",
    "Pueden cubrir los papeles anteriores si están configurados para código o razonamiento.",
  ],
  [
    "Diseño en Lovable",
    "Lovable + el repositorio compartido",
    "Su editor conserva la sincronización. El envío autónomo de encargos continúa pendiente de una conexión oficial operativa.",
  ],
  [
    "Recursos especializados",
    "Canva, imágenes, voz y otros servicios",
    "Conservados en Más herramientas. Solo deben intervenir cuando el encargo requiera su capacidad y exista un adaptador operativo.",
  ],
];
type EstadoModelo = {
  id: string;
  nombre: string;
  identificador: string;
  proveedor_id: string;
  desarrollo_estado: string;
  desarrollo_detalle: string | null;
  tarifa_vigente: boolean;
};
function modeloComprobable(modelos: EstadoModelo[] | undefined, id: string) {
  const candidatos = (modelos ?? []).filter((m) => m.proveedor_id === id && m.tarifa_vigente);
  return candidatos.find((m) => m.desarrollo_estado === "disponible") ?? candidatos[0];
}
function Equipo() {
  const qc = useQueryClient();
  const probar = useMutation({
    mutationFn: async (modelo_id: string) => {
      const r = await supabase.functions.invoke("ordenes-ejecutar", {
        body: { accion: "equipo_probar", modelo_id },
      });
      if (r.error || !r.data?.ok) {
        let detalle = r.data?.error;
        try {
          detalle ??= (await r.error?.context?.json())?.error;
        } catch {}
        throw Error(detalle ?? "No se pudo verificar la conexión");
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["equipo-estado"] });
    },
  });
  const proveedores = useProveedoresIa();
  const estado = useQuery({
    queryKey: ["equipo-estado"],
    queryFn: async () => {
      const r = await supabase.functions.invoke("ordenes-ejecutar", {
        body: { accion: "equipo_estado" },
      });
      if (r.error || !r.data?.ok) throw Error("No se pudo comprobar el equipo");
      return r.data.modelos as EstadoModelo[];
    },
  });
  return (
    <div className="mx-auto max-w-5xl">
      <Encabezado
        titulo="Tu equipo de desarrollo"
        descripcion="Todas tus herramientas tienen sitio. En cada encargo intervienen las que hacen falta."
      />
      <div className="panel mb-6 p-5 text-sm leading-relaxed">
        Las asignaciones son una política inicial de trabajo, no un ranking medido. El coordinador
        utiliza modelos activos con clave y tarifa vigente. Cada encargo conserva los agentes que
        realmente participaron. Las suscripciones Personal y Business no son dos programadores
        distintos ni acreditan acceso por API.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {reparto.map(([rol, agentes, trabajo]) => (
          <section key={rol} className="panel p-5">
            <h2 className="font-display font-semibold">{rol}</h2>
            <p className="mt-2 text-sm text-primary">{agentes}</p>
            <p className="mt-2 text-sm text-muted-foreground">{trabajo}</p>
          </section>
        ))}
      </div>
      <section className="panel mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-semibold">Tus proveedores registrados</h2>
          <Link to="/ajustes/proveedores" className="text-sm text-primary">
            Configurar conexiones ↗
          </Link>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Registrado no significa probado: una llamada real debe confirmar acceso, modelo y consumo.
        </p>
        {proveedores.isError ? <p role="alert">No se pudieron cargar las conexiones.</p> : null}
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {proveedores.data?.map((p) => (
            <li key={p.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              {p.nombre}
              <span className="ml-2 text-xs text-muted-foreground">
                {!p.activo
                  ? "Apartado"
                  : estado.data?.some(
                        (m) => m.proveedor_id === p.id && m.desarrollo_estado === "disponible",
                      )
                    ? "Probado"
                    : estado.data?.some(
                          (m) => m.proveedor_id === p.id && m.desarrollo_estado === "bloqueado",
                        )
                      ? "Bloqueado"
                      : p.tiene_clave
                        ? "Pendiente de prueba"
                        : "Sin conexión"}
              </span>
              <p className="mt-1 text-xs text-muted-foreground">
                {
                  (
                    estado.data?.find(
                      (m) => m.proveedor_id === p.id && m.desarrollo_estado === "disponible",
                    ) ??
                    estado.data?.find(
                      (m) => m.proveedor_id === p.id && m.desarrollo_estado === "bloqueado",
                    )
                  )?.desarrollo_detalle
                }
              </p>
              {modeloComprobable(estado.data, p.id) ? (
                <button
                  disabled={probar.isPending}
                  onClick={() => probar.mutate(modeloComprobable(estado.data, p.id)!.id)}
                  className="mt-2 text-xs text-primary disabled:opacity-50"
                >
                  {probar.isPending ? "Comprobando…" : "Comprobar API"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Comprobar API hace una llamada breve, con consumo registrado y sujeto a tus límites.
        </p>
        {probar.isError ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {probar.error.message}
          </p>
        ) : probar.isSuccess ? (
          <p role="status" className="mt-2 text-sm text-success">
            Conexión comprobada.
          </p>
        ) : null}
        {estado.isError ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            No se pudo comprobar el estado real del equipo.
          </p>
        ) : null}
      </section>
      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">Todas tus herramientas y su función</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Las siguientes funciones indican para qué recurrir a cada herramienta. Figurar aquí no
          significa que su ejecución automática esté conectada.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {CATALOGO_EQUIPO.map((h) => (
            <article key={h.slug} className="panel p-4">
              <h3 className="font-medium">{h.nombre}</h3>
              <p className="mt-2 text-sm">{h.papel}</p>
              <p className="mt-2 text-xs text-muted-foreground">{h.requisito}</p>
              <a
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-xs text-primary"
              >
                Abrir herramienta ↗
              </a>
            </article>
          ))}
        </div>
      </section>
      <p className="mt-6 text-sm text-muted-foreground">
        Proyectian conserva la ficha y la memoria del producto. NexDeveloper se ocupa de desarrollar
        y aconsejar; el intercambio sigue disponible en Conexiones y ajustes.
      </p>
    </div>
  );
}
