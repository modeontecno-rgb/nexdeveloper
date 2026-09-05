# NexDEVELOPER

CREARME UN PROYECTO DENOMINADO NEXDEVELOPER CI¡ON EL SIGUIENTE PROMPT: Crea una aplicación web responsive llamada “NexDeveloper”.

NexDeveloper será un centro de control multiagente para gestionar más de veinte proyectos de IA desde un único lugar. Debe servir como entorno principal de trabajo, sustituyendo la dispersión de chats de herramientas como Lovable y Claude.

INFRAESTRUCTURA OBLIGATORIA

- No usar Lovable Cloud ni su base de datos.

- Conectar a un proyecto real de Supabase, solicitando autorización al usuario.

- Usar Supabase Auth, PostgreSQL, Storage y Realtime.

- Crear el esquema inicial de base de datos para: usuarios, proyectos, chats, mensajes, tareas, órdenes, agentes, actividad, estimaciones, presupuestos, integraciones, previews y referencias a credenciales.

- Configurar políticas de acceso para que cada usuario solo vea sus datos.

- Conectar GitHub mediante autorización del usuario, crear un repositorio privado llamado “nexdeveloper” y subir el código inicial.

- Nunca mostrar ni guardar claves o contraseñas en texto plano. Preparar la aplicación para conectarse a un vault de secretos cifrado.

TECNOLOGÍA

- TypeScript.

- Next.js.

- Supabase.

- Diseño responsive con prioridad para ordenador, iPad y móvil.

- Arquitectura modular basada en adaptadores para conectar agentes externos en fases posteriores.

OBJETIVO PRINCIPAL

El usuario debe poder:

- Ver todos sus proyectos, su estado, prioridades y alertas.

- Mantener todos los chats, órdenes, tareas, archivos y resultados organizados por proyecto.

- Enviar órdenes desde un único lugar.

- Saber qué agente está trabajando, cuánto puede costar y cuándo terminará.

- Consultar varios agentes y recibir una recomendación sobre quién debe realizar cada trabajo.

- Mantener una memoria compartida de cada proyecto al cambiar de dispositivo.

PANTALLAS PRINCIPALES

1. INICIO

- Resumen de todos los proyectos.

- Estados: pendiente, planificando, en cola, ejecutando, esperando revisión, bloqueado y completado.

- Alertas y decisiones pendientes.

- Filtros por estado, prioridad, agente y coste.

- Presupuesto consumido y estimado por proyecto.

- Vista rápida de agentes ocupados y capacidad disponible.

2. PROYECTO

- Chat central y persistente.

- Línea temporal con órdenes, resultados, decisiones, cambios y actividad.

- Tareas, subtareas, archivos, enlaces y previews.

- Agentes asignados.

- Coste, progreso y resumen automático del estado actual.

- Área para mostrar previews o enlaces de despliegue.

3. PLAN DE TRABAJO POR PROYECTO

- Mostrar una tabla siempre visible dentro de cada proyecto.

- El encabezado debe mostrar el nombre del proyecto.

- Cada fila debe incluir: tarea, estado, agente responsable, prioridad, fecha de envío, estimación de tiempo, tiempo restante, coste estimado y coste consumido.

- Estados visuales: pendiente, en cola, ejecutando, esperando revisión, bloqueada y completada.

- Las tareas completadas deben mostrar un check verde.

- Permitir marcar tareas como completadas manualmente, guardando quién lo hizo y cuándo.

- Debajo de la tabla, mostrar: total de tareas, completadas, pendientes, en ejecución, esfuerzo total estimado y previsión real de finalización.

- Si varias tareas se ejecutan en paralelo, mostrar tanto el esfuerzo acumulado como la fecha estimada real basada en la tarea que termine más tarde.

- Actualizar las estimaciones cuando una tarea avance, se bloquee o se complete.

4. NUEVA ORDEN

- Campo para escribir órdenes en lenguaje natural.

- Selector de proyecto.

- Propuesta de agente o equipo de agentes.

- Modos: económico, equilibrado y máxima calidad.

- Mostrar coste estimado, riesgo, calidad prevista y necesidad de aprobación.

- Botón para aprobar y enviar.

5. COLA DE TRABAJO

- Mostrar todas las tareas activas de todos los proyectos.

- Incluir responsable, estado, progreso, última actividad, coste y tiempo estimado.

- Permitir pausar, cancelar, cambiar prioridad y pedir revisión.

- Mostrar qué agentes están ocupados para distribuir trabajo sin saturarlos.

6. CATÁLOGO DE AGENTES

- Preparar agentes configurables: ChatGPT, Claude, Gemini, Lovable, Canva y Nano Banana.

- Para cada agente, registrar especialidades, coste relativo, calidad histórica, rapidez, permisos y disponibilidad.

- Recomendar el agente o equipo más adecuado según calidad, coste, rapidez, seguridad y resultados previos.

- No consultar a todos los agentes por defecto: activar una mesa de expertos solo para decisiones importantes o complejas.

- Permitir que un agente planifique, otro ejecute y otro revise.

7. INTEGRACIONES Y SEGURIDAD

- Mostrar qué cuentas e integraciones están conectadas.

- Indicar a qué proyectos tiene acceso cada integración.

- Gestionar secretos mediante referencias seguras, sin exponerlos.

- Solicitar aprobación humana para cambios sensibles, despliegues, accesos a credenciales o gastos altos.

ORGANIZACIÓN INTELIGENTE POR PROYECTO

- Todos los chats, órdenes, tareas, archivos, previews y resultados deben pertenecer a un proyecto.

- Si el usuario envía una orden desde un proyecto equivocado pero el contenido corresponde claramente a otro, detectar el proyecto correcto y reorganizarla automáticamente al finalizar.

- Conservar el registro de origen y de la reorganización.

- Si existe duda entre proyectos, no mover nada automáticamente: mostrar una alerta y pedir confirmación.

- Permitir mover manualmente chats, tareas y resultados.

- Crear una bandeja “Sin clasificar” solo para elementos sin asignación segura.

- La búsqueda global debe abrir siempre el contenido dentro de su proyecto correcto.

FLUJO “CREAR PROYECTO CON AGENTE”

- Al crear un proyecto, permitir asociar o preparar un repositorio y espacio de trabajo.

- Generar una orden inicial estructurada para Claude con objetivo, requisitos, tecnologías y repositorio.

- Incluir un botón “Enviar a Claude”.

- En esta primera versión, crear la interfaz, los estados y el registro de actividad; dejar preparado el adaptador para conectar la API real posteriormente.

- No permitir acciones no autorizadas ni creación de carpetas o repositorios sin control del usuario.

DISEÑO

- Interfaz premium, limpia, sobria y en modo oscuro.

- Navegación lateral: Inicio, Proyectos, Cola, Agentes, Integraciones y Ajustes.

- Crear datos de demostración para ocho proyectos y varios agentes.

- La aplicación debe ser completamente navegable desde el primer momento.

- Usar datos reales de Supabase cuando estén disponibles y datos de demostración solo para completar la experiencia inicial. USA LAS HABILIDADES CREADAS EN CLAUDE PARA OPTIMIZAR RECURSOS SI TE HACE FALTA ALGUNA

No conectes todavía APIs reales de Claude, ChatGPT, Gemini, Canva o Nano Banana. Deja sus adaptadores, pantallas y flujos preparados para conectarlos después mediante sus integraciones oficiales.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nexdeveloper.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/81a8f50b-39bc-47ac-8b9f-b3b0aa7f701d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
