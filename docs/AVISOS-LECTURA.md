# Avisos y lectura — 10 septiembre 2026

Proyecto: NexDeveloper. Repositorio y alojamiento existentes documentados en ENTRADA-UNICA.md.
Rama: codex/aviso-fin-trabajo-20260910, basada en origin/main a891eae.

La pantalla Desarrollar observa las transiciones de los encargos cada cinco segundos mientras está abierta. Al terminar, fallar, cancelarse o quedar listo para aprobación, presenta un aviso grande persistente con pulso lento, reproduce un sonido y abre el resultado. Varios resultados se conservan en una cola de avisos. La carga inicial no anuncia trabajos históricos. No aprueba ni publica encargos automáticamente.

El clic de envío prepara Web Audio; se respeta el ajuste de sonidos y la política de reproducción del navegador. El pulso respeta la preferencia de movimiento reducido. No se promete sonido con la página cerrada.

Tipografía Inter, base de 18 px según el tamaño predeterminado del navegador, texto secundario de 16,2 px, botones y texto principal de 18 px, entregas de 20,25 px. Contraste reforzado para textos secundarios y campos en ambos temas, etiquetas de menú con salto de línea.

Validación: 68 pruebas unitarias (incluida integración de aviso/sonido/apertura/desplazamiento y no duplicación), TypeScript, pruebas edge, build de producción. Comprobación visual local de acceso. Pendiente verificación de publicación y pantalla autenticada.

## Continuación y móvil

Se añade «Desarrollar este consejo» a las consultas completadas. Recupera petición, entrega y proyecto en un borrador revisable y conserva cualquier indicación escrita. El envío muestra el requisito pendiente cuando está desactivado. El selector de proyecto ocupa todo el ancho en móvil, separado del enlace de creación. Se comprueba la transición consejo → borrador habilitado sin ejecutar encargos reales.

Validación ampliada: 69 pruebas, TypeScript y build correctos. No se han lanzado desarrollos ni publicaciones de Vetia durante el diagnóstico.

El formulario y el aviso renderizados se comprobaron en 390, 820 y 1180 px (móvil e iPad en ambas orientaciones), sin desbordamiento horizontal. El aviso coloca el icono encima del título en pantallas estrechas.
