# Cola de desarrollo — 0.45.0

El usuario entrega el encargo completo. Los nuevos trabajos de desarrollo con equipo automático piden al diseñador un plan estructurado, validan ids, departamentos, criterios y dependencias y rechazan ciclos. El plan se guarda en estado_agente dentro de la ejecución ya protegida por lease. Se procesa una tarea cada vez sobre el mismo conjunto de cambios; no hay escritores concurrentes sobre el mismo proyecto dentro de esta ejecución.

Cada tarea pasa al revisor antes de iniciar la siguiente. El motor exige cambios registrados para cerrar una tarea de implementación y lectura de los archivos modificados para cerrar la revisión. Una revisión fallida inserta corrección y nueva revisión antes del siguiente trabajo, con un máximo de dos ciclos por tarea. Hay una revisión integral final. Los archivos son evidencia de implementación, no una demostración de corrección: la publicación sigue exigiendo los checks configurados de GitHub Actions sobre el SHA exacto.

Los parches exactos conservan el resto del archivo y rechazan coincidencias inexistentes, repetidas o cambios vacíos. Las sustituciones completas que recortan más del 30% de un archivo mayor de 2000 caracteres se rechazan y se pide editar explícitamente. Las herramientas de escritura, incluidos los parches, se bloquean en tiempo de ejecución en fases de lectura. Se mantiene la lista de rutas protegidas.

## Alcance comprobado y límites

Esta versión es una primera cola secuencial, no un clúster distribuido ni una acreditación de capacidad masiva. Valida hasta 200 tareas por plan; se ha probado la ordenación de una cadena de 200 tareas en memoria, no la ejecución real de 200 llamadas IA. Mantiene el límite previo de 900 KB de cambios acumulados, lecturas de 60.000 caracteres, presupuesto y pasos configurados y timeout del proveedor. El límite de pasos ya no pide dividir el encargo; explica que está guardado y requiere ampliar el límite para continuar. Las reservas inciertas y los errores de proveedor conservan las protecciones contables anteriores.

Los trabajos existentes conservan su equipo y sus archivos; no se les impone retroactivamente un plan. Para grandes repositorios sigue pendiente trasladar los artefactos a almacenamiento versionado, lectura por rangos con cobertura verificable, planificación jerárquica, pruebas en runners aislados por tarea, realimentación automática del CI y pruebas de carga con interrupciones. No afirmar que las revisiones IA equivalen a pruebas ejecutadas, ni que todo programa grande ya puede completarse con el almacenamiento actual.

Validación: tests de plan inválido, ciclos, dependencias, límite y serialización; parches grandes sin pérdida; pruebas del motor con proveedores simulados para entrega persistida, fase sin código, lectura obligatoria, reparación, escritura y bloqueo de escritura en consejo. CI conserva las pruebas de lease, cancelación y publicación bloqueada si fallan los checks.
