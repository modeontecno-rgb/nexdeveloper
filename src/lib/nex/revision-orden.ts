import type { Hallazgo } from "./db-types";

/**
 * Mismas reglas que la función `revisar_orden` de la base de datos, aplicadas
 * en la pantalla para avisar antes de crear la orden.
 */
export function revisarTextoOrden(texto: string, repositorio: string | null | undefined): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  const t = texto ?? "";
  const minus = t.toLowerCase();

  const parecenClaves =
    /sk-[A-Za-z0-9]{8,}/.test(t) ||
    /ghp_[A-Za-z0-9]{8,}/.test(t) ||
    /eyJ[A-Za-z0-9_\-.]{20,}/.test(t) ||
    /service_role/i.test(t) ||
    /SUPABASE_SERVICE/i.test(t) ||
    t.includes("-----BEGIN");
  if (parecenClaves) {
    hallazgos.push({
      codigo: "claves_en_texto",
      gravedad: "bloquea",
      mensaje: "El texto contiene algo que parece una clave o un token. Quítalo antes de enviar la orden.",
    });
  }

  if (!repositorio || repositorio.trim() === "") {
    hallazgos.push({
      codigo: "sin_repositorio",
      gravedad: "bloquea",
      mensaje: "El proyecto no tiene repositorio indicado. Añádelo en la ficha del proyecto.",
    });
  }

  if (!/\d+\.\d+\.\d+/.test(t)) {
    hallazgos.push({
      codigo: "sin_version",
      gravedad: "aviso",
      mensaje: "La orden no menciona una versión con el formato x.y.z.",
    });
  }

  if (!minus.includes("powered by") && !minus.includes("whatsapp") && !minus.includes("changelog")) {
    hallazgos.push({
      codigo: "sin_reglas_fabricante",
      gravedad: "aviso",
      mensaje: "La orden no menciona «Powered by», WhatsApp ni el CHANGELOG.",
    });
  }

  if (minus.includes("lovable cloud")) {
    hallazgos.push({
      codigo: "menciona_nube_ajena",
      gravedad: "aviso",
      mensaje: "La orden menciona una nube que no se usa en este proyecto.",
    });
  }

  if (!minus.includes("desatendid") && !minus.includes("requiere atención") && !minus.includes("requiere atencion")) {
    hallazgos.push({
      codigo: "sin_modo_trabajo",
      gravedad: "aviso",
      mensaje: "La orden no dice si el trabajo es desatendido o si requiere tu atención.",
    });
  }

  return hallazgos;
}

export const bloquea = (hallazgos: Hallazgo[]) => hallazgos.some((h) => h.gravedad === "bloquea");
