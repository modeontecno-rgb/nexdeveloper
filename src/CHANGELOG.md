# Historial de cambios

## 0.10.0 — 6 de septiembre de 2026

- Nueva pantalla «Compilaciones»: genera la aplicación de cada proyecto para Android, iPhone y iPad, escritorio o web sin salir de aquí.
- Botón «Detectar» que revisa el repositorio y te dice con qué se puede compilar, la versión actual y si la firma está lista.
- Plantillas aconsejadas primero, con los minutos que suele tardar cada una y lo que necesita para firmar.
- Cada compilación sube el número de versión; si repites una ya hecha, la aplicación propone la siguiente.
- Bloque «En curso» con el tiempo transcurrido en vivo, enlace al taller de GitHub y botón para cancelar.
- Historial filtrable con estado, duración, tamaño del archivo, descarga directa y detalle del error.
- Los datos de firma (almacén de claves de Android, certificado y perfil de Apple) se guardan cifrados en tu repositorio de GitHub; NexDeveloper nunca los almacena.
- Aviso en cuanto una compilación termina correctamente, con botón para descargarla.
- En la ficha de cada proyecto, la última compilación de cada plataforma con enlace directo.

## 0.9.0 — 6 de septiembre de 2026

- Nueva pantalla «Copias»: guarda tus bases de datos y tus repositorios en tu propio almacén.
- Destino de las copias configurable desde la aplicación (servidor, bucket, región, carpeta y credenciales), con «Probar conexión»; la clave secreta se guarda cifrada y nunca se muestra.
- Eliges qué se copia: todas las bases de datos y repositorios, o solo los que marques, con la lista actualizable y un botón para crear las fichas de proyecto que falten.
- «Copiar ahora» muestra el progreso en vivo de cada copia, con estado, tamaño y tablas o filas.
- Copias automáticas diarias y semanales, con cuántas se conservan y aviso si la última correcta es demasiado antigua.
- Histórico con filtros y botón de descarga con enlace temporal.
- Estado del sistema: nueva tarjeta «Secretos y conexiones» y semáforos para las copias.
- La versión se ve de forma discreta en el pie del menú y en la pantalla de acceso; al pulsarla se copia.

## 0.8.0 — 5 de septiembre de 2026

- Nueva pantalla «Repositorios»: crea repositorios privados de GitHub en la cuenta modeontecno-rgb para cualquier proyecto, con un solo botón.
- «Crear y preparar» deja el repositorio con README (con la leyenda «Powered by Soluciones EvoluteIA S.L.»), taller de calidad y CHANGELOG inicial.
- «Subir carpeta»: eliges la carpeta del proyecto en tu ordenador y se sube por tandas con barra de progreso y enlace al envío.
- Nunca se suben carpetas generadas ni archivos con claves: se listan como omitidos por seguridad.
- «Enlazar existente» asocia a un proyecto un repositorio que ya tengas, y «Ya está conectado» marca los hechos con el editor web.
- Estado del sistema: semáforos nuevos para los repositorios, el historial de subidas y la función «github-repos».

## 0.7.0 — 5 de septiembre de 2026

- Nueva pantalla «Calidad»: semáforo verde, ámbar o rojo por proyecto y versión, con los doce controles automáticos y su historial.
- Revisión previa de cada orden: si el texto contiene algo que parece una clave o el proyecto no tiene repositorio, la orden no sale; los demás avisos se pueden aceptar y enviar igualmente.
- Insignia «Revisada» o «Bloqueada» en cada orden pendiente de aprobación.
- Batería de controles en GitHub Actions al cerrar cada tanda, con taller «calidad.yml» copiable desde la propia aplicación.
- Un proyecto no puede darse por terminado con el control de calidad en rojo, y en ámbar pide confirmación.
- Chip del semáforo de calidad junto al nombre en la ficha de cada proyecto.
- Estado del sistema: semáforos nuevos para las tablas de calidad y la función «calidad-github».

## 0.6.0 — 5 de septiembre de 2026

- Nueva pantalla «Expertos»: los tuyos, los encontrados en la red y los sugeridos, con buscador, filtros, valoración y contador de usos.
- Ficha de cada experto con todos sus datos editables, modelo aconsejado y botón «Usar en este proyecto», que abre una conversación nueva ya preparada.
- El selector de experto de las conversaciones agrupa por origen y solo muestra los adoptados.
- Barrido semanal de la red los lunes por la mañana: los hallazgos aparecen en «Requiere tu atención» para adoptarlos o descartarlos.
- Al adoptar un experto encontrado en la red, su ficha se publica en tu repositorio privado de GitHub.
- Estado del sistema: semáforos nuevos para el directorio de expertos, el barrido y la publicación.

## 0.5.0 — 5 de septiembre de 2026

- Catálogo de proveedores completo: se añade Canva y el modelo de imagen Nano Banana de Google; Anthropic, Google, Groq, ElevenLabs, fal y Canva vienen encendidos.
- Cada tarjeta de proveedor explica en una línea para qué sirve y muestra su tipo.
- Ollama: puedes cambiar la dirección de tu servidor, con aviso de que solo es accesible desde tu red.
- Nueva estrategia «Aprendido de mis consumos» y botón para rellenar la política con los modelos que mejor te han funcionado en los últimos 30 días, indicando en cuántos trabajos se basa.
- Conexión con Canva mediante autorización segura, sin pegar ninguna clave: la tarjeta indica con qué cuenta estás conectado.
- Estado del sistema: semáforos nuevos para el rendimiento de modelos y la conexión con Canva.



## 0.4.0 — 5 de septiembre de 2026

- Pantalla de proveedores de IA: enciendes los que uses, guardas su clave cifrada y la pruebas sin salir de la aplicación.
- Catálogo de modelos con precio por millón de tokens, velocidad, calidad y para qué sirve cada uno.
- Política de enrutado: eliges qué modelo hace cada tipo de trabajo, con recálculo automático por precio, rapidez o calidad.
- Trazabilidad: cada respuesta y cada tarea indican con qué IA, modelo y experto se hizo, con tokens y coste.
- Nueva pantalla «Referencia de uso» con lo que mejor te ha funcionado.
- Fecha y hora en cada mensaje de chat.



## 0.3.0 — 5 de septiembre de 2026

- Acciones reales: consultas y cambios en la base de datos, repositorios y llamadas web, siempre con aprobación previa.
- Las tareas se separan en «Requiere tu atención» y «Trabajo desatendido», con botón «Ya lo he hecho».
- Vistas previas incrustadas en una ventana flotante que se mueve, se ancla y recuerda su sitio.
- Integraciones que puedes crear, editar y borrar desde la aplicación, con los nombres de sus credenciales.



## 0.2.0 — 5 de septiembre de 2026

- Supabase propio (sin Lovable Cloud): la aplicación se conecta a tu proyecto de Supabase.
- Inicio de sesión con Supabase Auth y rutas protegidas.
- Todas las pantallas leen y escriben en la base de datos con actualización en vivo (Realtime).
- Organización inteligente: sugerencia de proyecto, reasignación automática según confianza o confirmación manual.
- Bandeja «Sin clasificar» para lo que aún no tiene proyecto.
- Mover órdenes, chats y tareas entre proyectos.
- Carga y borrado de datos de demostración desde Ajustes.
- Leyenda «Powered by» configurable y enlace de WhatsApp.
- Versión visible en Ajustes.

## 0.1.0 — 5 de septiembre de 2026

- Interfaz completa con datos de demostración en el navegador.
- Modo oscuro y claro.
- Circuito de aprobaciones con umbrales de coste, prioridad y riesgo.
