# Historial de cambios

## 0.21.0 — 6 de septiembre de 2026

- Nueva pantalla «Salud»: cada mañana a las 07:00 se revisan todos los proyectos y verás un semáforo por proyecto; solo tienes que mirar lo que esté en rojo.
- Resumen arriba con cuatro cifras grandes (correctos, para revisar, en rojo y sin datos), la hora de la revisión y si fue automática o a mano.
- Botón «Comprobar todo ahora» con el avance en vivo («x de N comprobados») y botón «Comprobar solo este» en cada proyecto.
- «Probar conexiones» comprueba de un vistazo si la cuenta de servidores y Sentry responden.
- Configuración desde la propia pantalla: activar la revisión diaria, avisar solo en rojo, incluir avisos de rendimiento, límites de tamaño de la base de datos y de errores, y la organización de Sentry.
- Tarjeta por proyecto con el estado del servidor (activo o pausado), avisos de seguridad, tablas sin proteger, errores de las últimas 24 horas, tamaño en MB, usuarios y los motivos del semáforo. Filtros por color y orden con lo urgente primero.
- Detalle de cada proyecto: servicios uno a uno, lista de avisos con enlace «Cómo arreglarlo», tablas sin protección, tamaño con barra de límite, errores por origen e incidencias de Sentry (o campo para indicar su proyecto en Sentry).
- Desde el detalle puedes crear la tarea de arreglo en un clic o llevar el caso a la mesa de expertos con los motivos ya escritos.
- Historial de revisiones anteriores y gráfico de cómo ha ido la cartera en los últimos días.
- Integrado en el resto de la aplicación: tarjeta «Salud de la cartera» en el panel principal, punto de color en la lista de proyectos y chip de salud en cada ficha.
- Estado del sistema: nuevos semáforos para las tablas de salud y para la revisión automática.



## 0.19.0 — 6 de septiembre de 2026

- Nueva pantalla «Mesa de expertos»: reúne a varios expertos para decidir un trabajo; uno lo planifica, otro lo ejecuta y otro lo revisa.
- «Nueva mesa»: eliges proyecto, escribes qué hay que decidir, añades el contexto y eliges el modo (económico, equilibrado o máxima calidad) con su coste orientativo.
- La mesa propone el equipo con el motivo de cada elección; puedes cambiar el experto, el papel, el proveedor y el modelo, y añadir o quitar participantes antes de empezar.
- Deliberación en directo: las intervenciones van apareciendo como una conversación de sala, con el papel de cada uno y su coste.
- Al terminar, la «Conclusión del coordinador» resume la decisión y muestra el equipo final, el plan paso a paso con responsable y horas, los riesgos, el coste y las horas estimadas, la calidad prevista y si necesita tu aprobación.
- Desde la conclusión puedes crear las tareas del plan en el proyecto, enviarla como orden, copiar el texto y puntuar la mesa de 1 a 5 con un comentario.
- Historial con todas las mesas por fecha, proyecto, modo, estado, coste y valoración, para volver a abrir cualquiera.
- Atajos: «Consultar a la mesa de expertos» en Nueva orden, «Convocar mesa» en la ficha de cada proyecto y «Pedir opinión a la mesa» en las tareas que requieren tu atención.
- Estado del sistema: nuevos semáforos para la mesa y sus proveedores de IA.

## 0.18.0 — 6 de septiembre de 2026

- Nueva pantalla «Voz y demos»: escribe el guion de la demostración de cualquier proyecto y ponle voz sin salir de la aplicación.
- «Nuevo guion» redacta las escenas solo: eliges proyecto, público (cliente, distribuidor o formación interna), duración (60, 120 o 180 segundos) y añades tus notas.
- Editor de escenas: cambias el título y el texto, ves los caracteres y los segundos estimados, eliges la pantalla desde tus vistas previas y ordenas las escenas arrastrándolas.
- Botones «Locutar escena» y «Locutar todo»; si el guion es largo, se locuta escena por escena mostrando el progreso.
- «Reproducir demo» abre la presentación a pantalla completa con la captura de cada pantalla, el título encima y la voz sonando, avanzando sola; con anterior, siguiente y pausa, y las instrucciones para grabarla con el Mac o el iPad.
- Pestaña «Locuciones» con todas las grabaciones: escucharlas, descargar el mp3, ver el texto o repetirlas, y el estado al momento mientras se generan.
- «Locutar texto libre» para cualquier frase suelta, con título, proyecto y voz.
- Configuración: eliges la voz (con filtro por idioma y género y botón para escucharla), el modelo, la estabilidad, la similitud, el estilo y la velocidad, y pruebas el resultado con un clic.
- En cada proyecto, bloque «Demo» con el último guion y su botón de reproducción.
- Estado del sistema: nuevos semáforos para la voz y las demostraciones.

## 0.17.0 — 6 de septiembre de 2026

- Nueva pantalla «Habilidades»: el catálogo con tus 82 habilidades propias, los 11 expertos y las encontradas en la red, todo en un sitio.
- Pestañas Propias, Expertos, Externas (activas, candidatas o archivadas) y Todas, con buscador, filtro por categoría, orden por nombre, uso o valoración, y vista en tarjetas o en lista.
- Ficha completa de cada habilidad: cuándo usarla, sus instrucciones, los archivos de la carpeta con enlace a GitHub, la muestra, el historial de usos y botón para copiar el SKILL.md.
- Botón «Usar» en cualquier habilidad: eliges proyecto, añades instrucciones, marcas si requiere tu atención y la prioridad, y se crea la tarea con el texto listo para copiar.
- «Nueva habilidad» para escribir la tuya en Markdown con vista previa; se guarda en el catálogo y en tu repositorio.
- Las habilidades encontradas en la red se pueden adoptar o descartar con un clic.
- Botones «Sincronizar» y «Buscar en la red», además del repaso automático de cada miércoles.
- En cada proyecto, botón «Aplicar habilidad»; en Nueva orden, «Añadir habilidad» añade la indicación al texto de la orden.
- Apartado de configuración con los repositorios, el interruptor de la búsqueda semanal y sus temas.
- Estado del sistema: nuevos semáforos para las habilidades.

## 0.16.0 — 6 de septiembre de 2026

- Nueva pantalla «Documentación» para cerrar cada versión y guardar los documentos de tus proyectos.
- «Preparar cierre» reúne solo lo hecho desde el último cierre (tareas, actividad, compilaciones, calidad y commits) y redacta un borrador que puedes corregir.
- Editas el título, el resumen, la lista de cambios (con su tipo, su importancia y el «por qué importa»), cómo probarlo, lo que tienes que hacer tú y el detalle técnico.
- Vista previa de la hoja de cambios mientras la escribes y botón para descargarla en PDF.
- Al cerrar, la hoja se sube al almacén propio, se registra la versión en Proyectian y, si quieres, se actualiza el CHANGELOG y se crea la etiqueta en GitHub; ves cada paso en verde o en rojo.
- Historial de cierres con versión, estado, si llegó a Proyectian y a GitHub, y quién lo redactó, con opción de retomar un borrador.
- Apartado «Documentos» por proyecto: manuales, entregables, material comercial, vídeos e imágenes, con su ruta en el Mac (con botón de copiar), descarga directa y subida de archivos de hasta 45 MB.
- En cada proyecto, bloque «Versión y documentos» con la versión actual, acceso directo a cerrar versión y los últimos cinco documentos.
- Estado del sistema: nuevos semáforos para la documentación, el almacén y Proyectian.

## 0.15.0 — 6 de septiembre de 2026

- Nueva pantalla «Gasto de IA»: cuánto te cuesta cada mes la inteligencia artificial, por proveedor y por proyecto.
- Cabecera con el gasto del mes, los tokens y las llamadas, el presupuesto global con barra de color y la proyección a fin de mes.
- Insignia «real facturado» cuando el importe viene directamente del proveedor; si no, la cifra es una estimación a partir de los tokens.
- Gráficos: gasto por día y proveedor, reparto por proveedor y los diez proyectos que más gastan, con sus tablas de detalle.
- Presupuestos mensuales globales, por proveedor o por proyecto, con aviso al porcentaje que elijas y opción de bloquear los trabajos de IA al superarlos.
- Apartado para apuntar a mano créditos comprados y suscripciones (mensuales o puntuales), con total del mes.
- Configuración del tipo de cambio dólar-euro y del precio del crédito, y aviso claro de qué hace falta para ver el coste real facturado.
- Botón «Sincronizar ahora» y sincronización automática cada día a las 07:30.
- En Inicio, tarjeta «Gasto de IA» con el gasto del mes, el presupuesto y la proyección; en cada proyecto, chip con su gasto del mes.
- Estado del sistema: nuevos semáforos para el gasto de IA.

## 0.14.0 — 6 de septiembre de 2026

- Nueva pantalla «Resúmenes»: cada mañana a las 08:00 recibes el parte del día y los lunes el informe semanal de toda tu cartera.
- Cabecera con las cifras que importan (lo que requiere tu atención, avisos técnicos, novedades y mensajes, y gasto de IA) y si el resumen se envió bien o no.
- Informe ilustrado listo para imprimir, con pestaña «Texto» y botón «Descargar PDF».
- Botones «Generar ahora» (diario o semanal, con opción de enviarlo) y «Enviar de nuevo».
- Historial de todos los resúmenes con su fecha, si se envió, quién lo redactó y marca de leído.
- Configuración desde la propia aplicación: activar diario y semanal, elegir correo y WhatsApp, poner destinatarios, decidir qué apartados se incluyen y si la apertura la redacta la IA, con «Enviar prueba ahora».
- En Inicio, tarjeta «Resumen de hoy» con las cuatro cifras y la entradilla, o botón para generarlo.
- Estado del sistema: nuevos semáforos para los resúmenes.

## 0.13.0 — 6 de septiembre de 2026

- Nueva pantalla «Bandeja»: tus correos de Gmail, los mensajes de WhatsApp Business y las notas de voz de Plaud, todo en un mismo sitio.
- Cada mensaje llega ya resumido y asignado al proyecto que le corresponde, con un indicador de lo segura que es esa asignación.
- Puedes cambiar el proyecto a mano, ajustar el título, la prioridad y las instrucciones, y crear la tarea con un clic.
- Botones para reclasificar, archivar o descartar, y acciones en bloque cuando seleccionas varias entradas.
- Panel de fuentes: conectar Gmail con Google, configurar WhatsApp Business (con la dirección del webhook y el token listos para copiar) y ver cuántas notas de Plaud han llegado.
- Palabras clave por proyecto: define las tuyas y los mensajes se reparten solos.
- «Añadir texto» para pegar o dictar cualquier nota y que entre en la bandeja.
- En Inicio, tarjeta con lo último sin revisar; en cada proyecto, sus mensajes; y un contador en el menú lateral.
- Estado del sistema: nuevos semáforos para la bandeja y su clasificador.

## 0.12.0 — 6 de septiembre de 2026

- Nueva pantalla «Dominios»: todos tus dominios y subdominios en una tabla, con su estado de un vistazo.
- Semáforo por dominio: verde si responde bien, ámbar si algo caduca pronto y rojo si falla.
- Muestra el tiempo de respuesta, el emisor del certificado y los días que quedan para que caduquen certificado y dominio.
- Botón «Comprobar todos» con progreso en vivo, y «Comprobar ahora» dominio a dominio con el resultado al instante.
- Puedes añadir, editar y borrar dominios, asignarles proyecto y decidir con cuántos días de antelación quieres el aviso.
- Historial de las últimas 30 comprobaciones de cada dominio, con un pequeño gráfico del tiempo de respuesta.
- Comprobación automática todos los días a las 08:00: si algo falla o caduca pronto, aparece una tarea «Requiere tu atención».
- En Inicio, tarjeta «Dominios y certificados» con los que necesitan atención; en cada proyecto, un aviso con el estado de sus dominios.
- Estado del sistema: nuevos semáforos para los dominios y su comprobador.

## 0.11.0 — 6 de septiembre de 2026

- Nueva pantalla «Vigilancia»: cada lunes busca en internet las novedades que afectan a cada proyecto (versiones, seguridad, funciones, precios, fin de soporte, IA) y explica «qué te afecta» y qué hacer.
- Radar de competencia mensual: descubre y sigue a los competidores de cada proyecto con precios, planes, puntos fuertes y débiles, y los cambios del mes.
- Cada hallazgo se puede convertir en tarea, marcar como visto o descartar; los importantes aparecen en «Requiere tu atención».
- Configuración por proyecto (tecnologías, temas, sector, competidores conocidos) e historial de cada ejecución con proveedor, tokens y coste.
- Tarjeta en Inicio, aviso en la ficha del proyecto y semáforos nuevos en Estado del sistema.

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
