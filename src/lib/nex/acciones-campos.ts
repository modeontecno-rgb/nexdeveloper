import type { TipoAccion } from "./db-types";

export interface CampoAccion {
  clave: string;
  etiqueta: string;
  ayuda?: string;
  tipo: "texto" | "area" | "booleano";
  obligatorio?: boolean;
  /** Se pide aparte y nunca se guarda en la base de datos. */
  esSecreto?: boolean;
}

/** Qué datos hace falta rellenar para cada tipo de acción. */
export const CAMPOS_ACCION: Record<TipoAccion, CampoAccion[]> = {
  supabase_sql: [
    { clave: "sql", etiqueta: "Consulta", tipo: "area", obligatorio: true, ayuda: "Se ejecuta tal cual sobre tu base de datos." },
  ],
  supabase_migracion: [
    { clave: "nombre", etiqueta: "Nombre del cambio", tipo: "texto", obligatorio: true },
    { clave: "sql", etiqueta: "Instrucciones SQL", tipo: "area", obligatorio: true },
  ],
  supabase_listar_tablas: [],
  supabase_secreto: [
    { clave: "nombre", etiqueta: "Nombre del secreto", tipo: "texto", obligatorio: true },
    {
      clave: "valor",
      etiqueta: "Valor",
      tipo: "texto",
      obligatorio: true,
      esSecreto: true,
      ayuda: "No se guarda aquí: viaja cifrado y se almacena en la bóveda del servidor.",
    },
  ],
  github_crear_repo: [
    { clave: "nombre", etiqueta: "Nombre del repositorio", tipo: "texto", obligatorio: true },
    { clave: "descripcion", etiqueta: "Descripción", tipo: "texto" },
    { clave: "privado", etiqueta: "Repositorio privado", tipo: "booleano" },
  ],
  github_subir_archivo: [
    { clave: "repositorio", etiqueta: "Repositorio (usuario/nombre)", tipo: "texto", obligatorio: true },
    { clave: "ruta", etiqueta: "Ruta del archivo", tipo: "texto", obligatorio: true },
    { clave: "contenido", etiqueta: "Contenido", tipo: "area", obligatorio: true },
    { clave: "mensaje", etiqueta: "Mensaje del cambio", tipo: "texto" },
  ],
  github_crear_issue: [
    { clave: "repositorio", etiqueta: "Repositorio (usuario/nombre)", tipo: "texto", obligatorio: true },
    { clave: "titulo", etiqueta: "Título", tipo: "texto", obligatorio: true },
    { clave: "cuerpo", etiqueta: "Descripción", tipo: "area" },
  ],
  github_listar_ramas: [{ clave: "repositorio", etiqueta: "Repositorio (usuario/nombre)", tipo: "texto", obligatorio: true }],
  http_generica: [
    { clave: "url", etiqueta: "Dirección web", tipo: "texto", obligatorio: true },
    { clave: "metodo", etiqueta: "Método (GET, POST…)", tipo: "texto" },
    { clave: "cuerpo", etiqueta: "Contenido a enviar", tipo: "area" },
  ],
};

/** Acciones que cambian algo y por tanto conviene aprobar antes. */
export const ACCION_SENSIBLE: Record<TipoAccion, boolean> = {
  supabase_sql: true,
  supabase_migracion: true,
  supabase_listar_tablas: false,
  supabase_secreto: true,
  github_crear_repo: true,
  github_subir_archivo: true,
  github_crear_issue: false,
  github_listar_ramas: false,
  http_generica: true,
};
