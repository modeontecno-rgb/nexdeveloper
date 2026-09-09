export function textoDesarrolloDesdeConsejo(
  encargo: { texto?: string | null; respuesta?: string | null; resumen?: string | null },
  borrador = "",
) {
  return [
    "Realiza el desarrollo solicitado a continuación. Revisa primero el código y convierte el consejo en cambios concretos, pruebas y una entrega revisable. Si falta algún dato imprescindible, indica exactamente cuál. No des por hecha una publicación o una conexión que no hayas verificado.",
    `Petición original:\n${encargo.texto ?? ""}`,
    `Consejo anterior (contexto técnico que debes comprobar):\n${encargo.respuesta || encargo.resumen || "Consulta la petición original."}`,
    ...(borrador.trim() ? [`Indicaciones adicionales:\n${borrador.trim()}`] : []),
  ].join("\n\n");
}
