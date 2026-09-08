# Operación de la revisión local R2

Esta revisión mantiene dos aplicaciones. Proyectian gestiona el producto, líneas, versiones, instalaciones y materiales. NexDeveloper prepara y ejecuta encargos, controla consumo y conserva sus archivos técnicos. Los datos de Personal no forman parte del intercambio.

## Preparación técnica

- Node 26; `npm ci`, `npm run typecheck`, `npm test`, `npm run test:edge`, `npm run build`.
- Configurar el backend de pruebas con `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_SUPABASE_PROJECT_ID` en un archivo local ignorado por Git. La compilación debe hacerse con las variables del destino elegido; las variables de desarrollo no convierten una compilación de producción en un entorno aislado.
- `db/migrations/20260908*.sql` son correcciones sobre la referencia recuperada. No son un volcado completo ni sustituyen las migraciones anteriores. En un backend existente, contrastar su historial y ejecutar en orden una sola vez. Primero los informes `db/checks/`; resolver relaciones anteriores incoherentes antes de validar las claves foráneas `NOT VALID`.
- `supabase/config.toml` indica los puntos de entrada reales en `db/functions/`. Los PDF necesitan los archivos de fuente y su licencia. No copiar únicamente `index.ts`. El despliegue desde la aplicación rechaza funciones que necesitan ese empaquetado.
- La configuración de empaquetado usa las opciones oficiales de [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/config). Mantiene los ajustes de JWT recuperados; los manejadores comprueban usuario/propiedad o token de servicio. El intercambio entrante de Proyectian usa HMAC, no una sesión de navegador.
- Los cron y secretos del entorno original no se copian al laboratorio. Los antiguos cron de sincronización amplia de Proyectian se retiran expresamente en la migración 19.

## Recorrido

1. Configurar una pareja con los dos propietarios y los dos proyectos exactos. `scripts/preparar-pareja.mjs` genera SQL y archivos privados de configuración sin conexiones de red. No sobrescribir mapas con otros enlaces existentes. Los enlaces se preparan desactivados.
2. En Intercambio con Proyectian, actualizar la copia. Un error conserva la última revisión y muestra que está pendiente. Reintentar no duplica la misma revisión ni los recibos.
3. Elegir un pendiente e instalación aplicable. Nex guarda una única orden, tarea y copia del contexto de origen. Revisarla en Aprobaciones. Un pendiente con transferencia histórica no conciliada se bloquea para no duplicarlo.
4. En Consumo, registrar tarifas EUR con fuente y caducidad, límites de tokens y límites económicos. El control parte desactivado y con límites cero. Una reserva incierta sigue contando hasta conciliarla. La aplicación no controla suscripciones ni herramientas contratadas fuera de Nex.
5. Ejecutar en modo plan o construcción. El plan no escribe código. La construcción trabaja con rama y PR. La publicación exige comprobaciones de GitHub Actions sobre el SHA exacto y confirmación del resultado. Una rama o PR por sí sola no es una publicación.
6. Añadir entregas obligatorias a la orden y adjuntar archivos verificados desde Documentación. La falta de archivos impide finalizarla, también en el servidor. Si el código ya terminó, la migración 21 conserva su resultado: adjuntar lo pendiente y pulsar «Comprobar entregas y finalizar» cierra la misma ejecución sin construir ni publicar otra vez.
7. Generar PDF de cambios/manuales o vídeo WebM local. Los archivos se guardan en un bucket privado por propietario y proyecto, con SHA-256. Los enlaces de descarga son temporales. La publicación de código y el cierre de la versión maestra de Proyectian son operaciones independientes.
8. Intercambiar de nuevo para que Proyectian reciba el registro de los archivos. Los recibos corresponden al producto; no asignan automáticamente una línea ni cierran versiones. El encargo conserva su contexto específico de línea/instalación.

## Personal, estilo y voz

Personal conserva conversaciones y memoria propia. La restauración de memoria añade una revisión, no elimina la anterior. “Revisar estilo” está disponible desde las pantallas: seleccionar ámbito, conservar original, revisar resultado y copiar explícitamente. Desactivado no usa IA. La comprobación de cifras, URLs y bloques de código no sustituye revisar el significado. No hay puntuaciones de “indetectable”.

El dictado requiere permiso del navegador: capta audio para mostrar ondas, permite editar la transcripción y no envía por sí solo. Se han probado sus estados con micrófonos simulados; no se ha validado el hardware físico de este ordenador. El vídeo local es de diapositivas y admite una locución propia de hasta 10 MB, procesada en el navegador e incorporada al WebM sin llamadas a proveedores. Se rechaza un audio más largo que el vídeo para no recortarlo. Sin locución es silencioso; requiere mantener visible la pantalla y se detiene si se oculta. No sustituye una grabación de la aplicación.

## Límites expresos

- Generación de voz de pago, búsquedas generativas y envíos de trabajos a Lovable permanecen desactivados hasta adaptar su medición. Abacus no se selecciona automáticamente por supuesta gratuidad. Los datos y audios previos se conservan.
- Las capturas automáticas nuevas de servicios externos no se generan. Pueden adjuntarse capturas existentes en los manuales; el PDF textual no incorpora esas imágenes todavía.
- No se ha probado calidad de modelos con llamadas reales ni se ha medido ahorro comercial. El comparador usa únicamente las tarifas configuradas y entradas del propietario.
- La cancelación invalida el trabajo local pendiente; una operación ya enviada a un sistema externo puede requerir conciliación. Reintentar no borra el intento anterior ni sus costes.
- No hay migración ni despliegue en producción en esta entrega. La adaptación de historiales reales y la activación de proveedores se validan en el entorno destino antes de publicar.

## Reversión

En local, conservar la rama y descartar únicamente el laboratorio desechable si se quiere empezar de nuevo. En un destino futuro, desactivar consumo/ejecutor e intercambio antes de cambiar de versión. Conservar reservas, intentos, documentos y recibos. Las migraciones añaden tablas/campos y cambian RPC; volver solo al frontend antiguo no revierte los contratos del servidor. Preparar una versión compatible o restaurar un respaldo completo en otro entorno, comprobarlo y cambiar de destino. No borrar tablas con historial ni bajar consumos para simular una reversión.
