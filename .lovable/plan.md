# Corregir acciones de la Mesa de expertos

## Objetivo
Evitar los errores «Sin sesión» y «new row violates row-level security policy for table ordenes» al usar las acciones de una mesa concluida.

## Cambios
- Asegurar que las llamadas de la Mesa esperan una sesión válida y envían explícitamente su token; si la sesión ha caducado, mostrar un mensaje claro en español sin provocar una caída general.
- Al crear una orden desde la conclusión, incluir la autoría del usuario autenticado en todas las filas relacionadas que la necesitan, respetando las políticas actuales.
- Hacer que «Crear tareas del plan» espere el resultado completo y presente el error dentro del flujo de trabajo, evitando promesas sueltas y avisos duplicados.
- Mantener intactas la base de datos y las funciones ya desplegadas.

## Verificación
- Ejecutar las pruebas relacionadas con Mesa y órdenes.
- Comprobar la pantalla con una sesión real: carga de la mesa, creación de tareas y envío como orden.
- Confirmar que la compilación queda sin errores.
