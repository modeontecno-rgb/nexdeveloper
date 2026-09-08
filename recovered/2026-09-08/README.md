# Referencia recuperada de Supabase · 8 de septiembre de 2026

Recuperación de lectura, guardada en la rama local `codex/l0-reproduccion`. Nada subido a GitHub ni desplegado.

`edge/` conserva las versiones desplegadas, incluidas diferencias respecto al código original. No sustituye las funciones del proyecto. `functions-reference.sql` contiene definiciones extraídas, no una migración ordenada. `schema-reference.json` es el catálogo leído; no contiene filas de negocio ni valores de claves. Las funciones de extensiones también pueden aparecer en el catálogo.

La reconstrucción estructural se ensayó en un PostgreSQL local de Supabase dentro de una transacción terminada con ROLLBACK. No hubo cron locales ni ejecución de proveedores. Esto no certifica equivalencia de permisos, propietarios, datos, configuración Edge ni funcionamiento completo.

Los límites enteros grandes de secuencias necesitan exportación como texto para evitar redondeo del navegador. No aplicar este catálogo como migración automática. No copiar claves de producción al entorno local. Los originales de GitHub se mantienen para resolver las diferencias mediante revisión.
