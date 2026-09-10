/** Validated, dependency-ordered work plan. Persisted alongside the execution lease. */
export type TareaCola = {
  id: string;
  titulo: string;
  papel: "backend" | "interfaz";
  depende_de: string[];
  aceptacion: string[];
};
export function validarPlan(entrada: unknown): TareaCola[] {
  if (!Array.isArray(entrada) || !entrada.length || entrada.length > 200)
    throw Error("Entrega un plan de 1 a 200 tareas con dependencias y criterios de aceptación.");
  const tareas = entrada.map((t: any) => {
    if (
      !t ||
      !/^[a-zA-Z0-9_-]{1,60}$/.test(t.id) ||
      typeof t.titulo !== "string" ||
      !t.titulo.trim() ||
      t.titulo.length > 500 ||
      !["backend", "interfaz"].includes(t.papel) ||
      !Array.isArray(t.depende_de) ||
      !t.depende_de.every((d: unknown) => typeof d === "string") ||
      !Array.isArray(t.aceptacion) ||
      !t.aceptacion.length ||
      t.aceptacion.length > 20 ||
      !t.aceptacion.every(
        (c: unknown) => typeof c === "string" && c.trim().length > 0 && c.length <= 2000,
      )
    )
      throw Error(
        "Cada tarea necesita id, título, departamento, depende_de y criterios de aceptación concretos.",
      );
    return {
      id: t.id,
      titulo: t.titulo.trim(),
      papel: t.papel,
      depende_de: [...new Set<string>(t.depende_de)],
      aceptacion: [...t.aceptacion],
    } as TareaCola;
  });
  const ids = new Set(tareas.map((t) => t.id));
  if (ids.size !== tareas.length) throw Error("Hay identificadores de tarea repetidos.");
  if (tareas.some((t) => t.depende_de.some((d) => !ids.has(d) || d === t.id)))
    throw Error("Hay dependencias inexistentes o de una tarea consigo misma.");
  const orden: TareaCola[] = [],
    hechas = new Set<string>();
  while (orden.length < tareas.length) {
    const siguiente = tareas.find(
      (t) => !hechas.has(t.id) && t.depende_de.every((d) => hechas.has(d)),
    );
    if (!siguiente) throw Error("El plan contiene un ciclo de dependencias.");
    orden.push(siguiente);
    hechas.add(siguiente.id);
  }
  return orden;
}
export function parcheExacto(original: string, antes: unknown, despues: unknown): string {
  if (typeof antes !== "string" || !antes || typeof despues !== "string")
    throw Error("El parche necesita antes no vacío y después como texto.");
  const i = original.indexOf(antes);
  if (i < 0 || original.indexOf(antes, i + 1) >= 0)
    throw Error(
      "El fragmento debe coincidir exactamente una sola vez. Lee el archivo actualizado y vuelve a preparar el parche.",
    );
  if (antes === despues) throw Error("El parche no modifica el archivo.");
  return original.slice(0, i) + despues + original.slice(i + antes.length);
}
export function fasesDelPlan(tareas: TareaCola[], equipo: any[]) {
  const revisor = equipo.find((f) => f.papel === "revision");
  if (!revisor) throw Error("Falta el departamento de revisión.");
  const fases = tareas.flatMap((tarea) => {
    const responsable = equipo.find((f) => f.papel === tarea.papel);
    if (!responsable) throw Error(`Falta un modelo para ${tarea.papel}.`);
    const crear = (base: any, revision: boolean) => ({
      papel: base.papel,
      modelo: base.modelo,
      motivo: base.motivo,
      estado: "pendiente",
      tarea,
      titulo: (revision ? "Revisar: " : "") + tarea.titulo,
    });
    return [crear(responsable, false), crear(revisor, true)];
  });
  return [
    ...fases,
    {
      papel: revisor.papel,
      modelo: revisor.modelo,
      motivo: revisor.motivo,
      estado: "pendiente",
      titulo: "Revisión integral del conjunto",
      tarea: undefined,
    },
  ];
}
