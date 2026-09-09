# NexDeveloper 0.43 — entrada única

## Proyecto compartido

Repositorio: https://github.com/modeontecno-rgb/nexdeveloper
Rama sincronizada: main. Vinculación confirmada en los ajustes Git de Lovable el 10 de septiembre de 2026.
Editor: https://lovable.dev/projects/81a8f50b-39bc-47ac-8b9f-b3b0aa7f701d
Publicación habitual: https://nexdeveloper.lovable.app
Backend: Supabase eqyuodrmlbclobaverdb.

## Comportamiento

La pantalla Desarrollar permite seleccionar un proyecto, describir un encargo, dictarlo o adjuntar documentos y capturas. Pedir consejo también funciona con proyectos sin repositorio. Desarrollar código necesita un repositorio conectado.

El servidor registra un encargo idempotente y lo procesa en su cola. Las fases comparten los cambios acumulados: diseño de implementación, backend cuando se requiere, programación y revisión. Diseño, consejo y revisión no pueden escribir archivos. Una revisión con bloqueos puede pedir una corrección y una segunda revisión; si persisten problemas, el encargo se detiene. Una cuota o indisponibilidad HTTP 429/503 admite como máximo una sustitución de proveedor por fase, conservando la reserva incierta.

Los modelos disponibles se seleccionan por configuración y política inicial de especialidad. Esto no es un ranking obtenido mediante benchmarks. La prueba de una conexión tampoco acredita calidad en todos los proyectos. El catálogo diferencia herramientas y requisitos de sus conexiones automáticas.

Los cambios se entregan en una rama y PR. El motor no ejecuta shell: las pruebas de código se ejecutan en CI, que debe aprobar el commit antes de integrar. Ninguna revisión de IA garantiza ausencia de vulnerabilidades.

Las capturas admitidas por esta entrada son PNG, JPEG y WebP de hasta 2 MB, cinco como máximo. Su lectura utiliza Gemini y la reserva de entrada máxima de la tarifa; su consumo queda en Consumo separado de los pasos de desarrollo. Documentos ilegibles producen un error explícito. No se interpreta el contenido de adjuntos como autorización para ampliar permisos.

Las funciones anteriores se conservan en Más herramientas. El intercambio existente con Proyectian no se modifica.

## Despliegue

Aplicar db/migrations/20260910010000_entrada_unica.sql y desplegar las funciones pideme y ordenes-ejecutar. La migración es aditiva e incluye la conservación del motor coordinado al reintentar. No incluye claves ni cuentas de usuario.

Cada cuenta necesita sus propios proveedores, modelos con desarrollo_estado disponible y tarifas vigentes. La configuración de los modelos de prueba no se siembra para otros usuarios. No transferir sesiones ni secretos en el código.

## Validación

- Pruebas unitarias, tipos, pruebas del motor y presupuesto, compilación.
- Interfaz local de escritorio y móvil: sin errores JavaScript ni desbordamiento horizontal.
- Caso real de cuatro fases Gemini → Claude → Grok → Gemini: PR https://github.com/modeontecno-rgb/nexdeveloper-prueba-equipo/pull/1 . CI aprobada y contrato HTTP comprobado independientemente. Esta prueba no fusiona ni publica su repositorio.
- Adjuntos sintéticos: texto LIBRO-482 y captura roja leídos correctamente; consejo sin repositorio e idempotencia comprobados.
- Claude y OpenAI: llamadas reales con herramientas verificadas tras ajustar sus cuentas.

## Accesos pendientes

Lovable está sincronizado por GitHub, pero su autorización MCP desde el servidor de NexDeveloper sigue rechazada: el registro dinámico exige una URI de retorno autorizada y el flujo de metadatos devuelve invalid_client. No afirmar que existe coordinación autónoma con su agente. URI a comunicar a soporte: https://eqyuodrmlbclobaverdb.supabase.co/functions/v1/ordenes-ejecutar/callback .

Canva, Grammarly, Chatly, DaVinci, HeyGen y Rinkel están inventariados; no todos tienen acceso automático configurado. Together, Cohere y otros proveedores necesitan validar operaciones concretas, adaptadores y tarifas antes de asignarles trabajo. Sentry conserva su integración de salud existente. No instalar ni contratar servicios para completar el catálogo sin autorización.
