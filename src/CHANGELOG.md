# Historial de cambios

## 0.42.0 — Dictado fiable, adjuntos y trabajo visible

- El micrófono ya no se queda mudo: el botón está siempre disponible y avisa cuando el navegador no permite dictar.
- Si el navegador corta la escucha, se reanuda sola; solo se para cuando pulsas «Parar».
- Ves lo que dices mientras hablas, con onda del micrófono o barras animadas y sonido al empezar y al terminar.
- Campo de texto con dictado común para Pídeme, Personal, Mesa de expertos y Asistente.
- Puedes adjuntar capturas, PDF, Word, Excel, CSV o texto: se pegan con Ctrl/Cmd+V, se arrastran o se eligen.
- La IA lee esos adjuntos (texto extraído e imágenes) y cita cuáles ha tenido en cuenta.
- El panel «Trabajando…» es más visible, dice qué se está haciendo y muestra los trabajos en cola.

## 0.40.0 — Cuánto cuesta y cuánto se tarda de verdad

- Coste real en créditos, tokens, euros y tiempo en cada mesa de expertos.
- Resumen real por proyecto: créditos, tokens y tiempo de IA consumidos.
- Comparativa con programadores humanos: precio de mercado y plazo estimados.
- Etiquetas «Real» y «Estimado» para no confundir lo medido con lo calculado.
- Ajustes → Costes y comparativa de mercado: euros por crédito, tarifa por hora y factor humano.

## 0.39.0 — Siempre sabes que estoy trabajando

- Indicador global «Trabajando»: panel flotante con logo animado, paso actual, barra de progreso y tiempo transcurrido.
- Aviso «Trabajando» también en la cabecera, en cualquier pantalla.
- Sonidos discretos al empezar, al terminar bien y al fallar, activables en Ajustes.
- Pídeme: onda de audio en directo al dictar, tono de bienvenida y resultado con «Ir a verlo».
- Al lanzar un borrador se envía el proyecto elegido.

## 0.38.0 — Conexiones

- Conexiones: una sola pantalla con todo lo de fuera en verde o rojo, comprobado de verdad; sustituye a Integraciones.

## 0.37.0 — Auditoría, seguridad y autoría (7 de septiembre de 2026)

- Auditoría completa de la base de datos: 112 tablas, 130 claves foráneas y cero registros huérfanos.
- Se cierra una fuga: ocho vistas de resumen (gasto de IA, bandeja, dominios, vigilancia, habilidades y compilaciones) podían leerse sin iniciar sesión; ahora respetan los permisos de cada usuario.
- Ninguna función del servidor se puede ejecutar ya sin sesión (antes 38 podían lanzarse con la clave pública, incluidas las que consumen créditos de IA).
- Rendimiento: 108 políticas de seguridad optimizadas y 120 índices nuevos; las pantallas con muchas filas responden antes.
- Leyenda «Powered by» demostrable: en el pie, en «Acerca de» junto a la versión y en el código de la página; la sociedad se cambia desde configuración sin tocar código.
- La versión registrada en configuración vuelve a ser la real y el enlace de WhatsApp del pie ya lleva número.
- Las páginas de error («no encontrada» y «no se ha cargado») están ahora en español.

## 0.36.1 — Acceso privado (7 de septiembre de 2026)

- Se retira el registro público que se había añadido por error: NexDeveloper es una aplicación privada de un solo propietario.
- La pantalla «Revisores» solo la puede ver y abrir el propietario.

## 0.36.0 — Pídeme: borrador conversable (7 de septiembre de 2026)

- Antes de lanzar una petición, «Pídeme qué quieres» prepara un borrador con el que puedes conversar, aclarar y corregir; solo se lanza cuando tú lo confirmas.
- El diccionario de nombres aprende de tus correcciones y reconoce los alias de cada proyecto.

## 0.35.0 — Revisor de redacción de manuales (6 de septiembre de 2026)

- Antes de publicar, NexDeveloper repasa la redacción del manual: ortografía, gramática, tratamiento de usted o de tú, frases más cortas y nombres de producto bien escritos, siguiendo tu perfil de estilo propio si lo tienes.
- La generación muestra un paso nuevo, «Revisando redacción», para que sepas en qué momento va.
- Los manuales ya publicados tienen un botón «Revisar redacción» para darles el repaso cuando quieras.
- Nueva configuración: activar o desactivar el repaso, elegir tratamiento (usted o tú), nivel de revisión (ligera, normal o exhaustiva), aplicar tu perfil de estilo y añadir un glosario de nombres que se deben respetar.
- Cada manual revisado enseña cuántas correcciones se han hecho, con ejemplos de «antes → después» y el nivel y tratamiento aplicados.
- Grammarly queda dado de alta como herramienta externa para el repaso final: desde los manuales tienes el enlace para abrirlo antes de entregar el documento al cliente.



## 0.34.0 — Sincronización con Proyectian (6 de septiembre de 2026)

- Nueva pantalla «Proyectian» en el menú: arriba se ve de un vistazo si la conexión funciona, con qué cuenta de GitHub entra y cuántos proyectos hay en Proyectian.
- Botones para traer los datos cuando quieras: todo de golpe, o solo versiones, salud, pantallas, reuniones o pendientes; cada uno te dice en un aviso qué ha traído.
- «Diagnóstico de repositorios»: tabla con cada proyecto, su repositorio, si existe, cuándo fue el último cambio y si tiene fichero de versión, marcando en rojo lo que lleva más de siete días parado o le falta la versión.
- «Historial de sincronización» con las últimas 200 sincronizaciones, filtro por tipo y por proyecto, insignia verde o roja, resumen, cuándo ocurrió y un desplegable para ver el detalle completo.
- En la ficha de cada proyecto hay un bloque «Versión» con la versión en uso, de dónde se ha leído, el código del último cambio con su fecha y cuándo se comprobó, además de un botón «Comprobar ahora».
- En Tareas se ven las pausas («pausada hasta» con su motivo) y las cancelaciones (fecha y motivo), y hay botones para pausar, cancelar o reanudar.
- Las tareas que vienen de Proyectian llevan su insignia, y las enlazadas muestran un icono de enlace con la fecha de la última sincronización.

## 0.33.0 — Menú por categorías y empresa emisora (6 de septiembre de 2026)

- El menú ya no es una lista interminable: arriba quedan fijos Inicio, Pídeme qué quieres, Bandeja y Avisos, y el resto se agrupa por temas que se abren de uno en uno.
- Buscador en el menú con la tecla rápida Ctrl/Cmd + K: escribe dos letras y encuentra cualquier pantalla o proyecto, y con Intro entras en el primero.
- El menú se puede encoger a una franja de iconos, y al pasar el ratón por un grupo se despliega su contenido.
- En el móvil hay barra inferior con cuatro accesos que eliges tú en Ajustes, un botón «Menú» que abre el menú completo con su buscador y un botón redondo para dictar con una mano.
- Todas las pantallas se ven bien en móvil y tableta: sin desplazamiento lateral, tablas anchas con desplazamiento propio y botones más cómodos de pulsar.
- Facturación: cada proyecto se factura desde MODEONTECNO S.L. o SOLUCIONES EVOLUTEIA S.L., con una empresa por defecto que se cambia en Configuración.
- Al enlazar un cliente eliges primero desde qué empresa se factura, y puedes pasar un proyecto a la otra empresa con un botón.
- Las facturas y el resumen muestran la empresa emisora, con filtro por empresa, y arriba tienes el semáforo de cada una con su serie y su Verifactu.



## 0.32.0 — Facturación con EvoluteIA

- NexDeveloper ya no factura por su cuenta: las facturas de verdad viven en EvoluteIA. Aquí se registran las horas y el gasto de IA de cada proyecto, y con eso se preparan y se emiten los borradores en EvoluteIA.
- La pantalla «Facturación» pasa a ser un puente: enlazar cada proyecto con su cliente y su contrato de EvoluteIA, preparar la factura, emitirla, ver el estado de cobro y abrir cada factura en EvoluteIA con un enlace.
- Chip de conexión siempre visible con prueba en un clic: usuario, empresa, serie de numeración, Verifactu y facturas sincronizadas.
- Buscador de clientes de EvoluteIA, creación de clientes nuevos sin salir de aquí y «Sugerir enlaces» para emparejar proyectos y clientes por parecido.
- Las horas ya facturadas quedan bloqueadas y muestran el número de la factura, con enlace directo a EvoluteIA.
- Ficha de cada factura con líneas, base, IVA, total, vencimientos y registro de Verifactu.
- Aviso permanente: esta forma de trabajar es exclusiva del fabricante (MODEONTECNO S.L. / Soluciones EvoluteIA) y depende del módulo privado «NexDeveloper (solo fabricante)» en EvoluteIA.
- Estado del sistema actualizado con los semáforos de la nueva facturación.

## 0.31.0 — 6 de septiembre de 2026 — Mi IA

- Botón «Pídeme qué quieres» arriba del todo en la pantalla de inicio: escribe o dicta lo que necesitas y NexDeveloper decide solo si es de un proyecto o algo personal, y actúa. Atajo de teclado Ctrl/Cmd + J.
- Según lo que pidas te responde, te crea las tareas o te prepara una propuesta completa: resumen, recomendación con color, plan por pasos, requisitos, riesgos, decisiones que dependen de ti y la revisión de cada experto por áreas. Con un clic la apruebas (tal cual o con cambios) o la rechazas.
- Si se equivoca de destino, «No es eso» lo corrige y puedes guardar la palabra que usaste como nombre alternativo del proyecto para que la reconozca la próxima vez.
- Nueva pantalla «Pídeme qué quieres» con todo el historial, filtros y un apartado de propuestas pendientes (con contador rojo en el menú).
- Nuevo apartado «Personal», completamente separado de los proyectos: pregunta a varias IA a la vez y te da la mejor respuesta combinando todas, indicando qué IA han contestado, cuánto han tardado y cuánto ha costado, con la opción de ver cada respuesta por separado y en qué no coinciden.
- Desde cualquier conversación personal puedes crear un documento (informe, resumen, carta o lista): se guarda en tu carpeta PERSONAL, lo puedes ver, imprimir en PDF o abrir desde el almacén.
- «Editor de estilo propio»: pega entre tres y seis textos tuyos y aprende cómo escribes; luego puedes reescribir cualquier texto con tu voz, con la guía de estilo de un cliente, o pedir al tutor de redacción que te diga qué mejorar sin escribirlo por ti.
- Cada proyecto tiene ahora su «Guía de estilo para textos del cliente», que puedes escribir a mano o generar con IA.
- Nuevo botón «Plaud»: conectas tu grabadora una vez y traes las grabaciones con un clic (o cada media hora automáticamente). Pasan por el mismo clasificador, con transcripción, resumen y las tareas que salgan de ahí.
- El estado del sistema incluye los semáforos de todo lo nuevo.

## 0.30.0 — 6 de septiembre de 2026 — Control total de infraestructura

- Nueva pantalla «Infraestructura»: un semáforo grande que dice de un vistazo si todo funciona, con Mapa, Servicios, Incidencias, Sincronización, Ideas y Configuración.
- Se vigila cada diez minutos todo lo que tus proyectos necesitan: bases de datos, GitHub, la plataforma de desarrollo, los dominios y sus páginas, el almacén de archivos, los proveedores de IA, Sentry, Proyectian y las funciones de NexDeveloper.
- Cuando algo se cae se abre una incidencia que dice exactamente qué proyectos y qué partes de cada proyecto dejan de funcionar, con su tarea y su aviso al móvil.
- Mapa por proyecto: pulsas un proyecto y ves de qué servicios depende, cuáles son imprescindibles y qué parte se vería afectada.
- Cada hora se comprueba que GitHub, la base de datos y la copia del Mac van a la par: último commit, versión del repositorio frente a la de aquí, migraciones pendientes y funciones sin desplegar, con un botón para adoptar la versión del repositorio.
- Ficha de cada servicio con tiempo de respuesta, disponibilidad de las últimas horas, coste mensual y fecha de renovación (en rojo si queda menos de un mes), y el coste total de la infraestructura al pie.
- Puedes añadir a mano cualquier servidor o servicio que contrates en el futuro y decir a qué proyectos afecta.
- Apartado de ideas con sugerencias de qué más conviene vigilar.
- En la ficha del proyecto hay una tarjeta de infraestructura con sus dos semáforos, y en el inicio aparece una banda roja si hay algo caído.

## 0.29.0 — 6 de septiembre de 2026 — Facturación y horas por proyecto

- Nueva pantalla «Facturación» con cinco apartados: Resumen, Horas, Facturas, Clientes y Configuración.
- Cronómetro siempre a mano: lo arrancas desde el proyecto o desde la pantalla de horas y se ve corriendo en cualquier parte de la aplicación; al pararlo, las horas se guardan solas y redondeadas.
- Registro de horas manual, con cronómetro y automático: cada tarea que cierras y cada trabajo de la IA suman su tiempo.
- Tabla de horas con filtros por proyecto, fechas y «sin facturar», editable directamente en la fila; las horas ya facturadas quedan bloqueadas.
- Ficha de cada cliente con sus datos fiscales y su tipo de contrato: por horas, cuota mensual, precio cerrado o sin facturar, cada uno explicado.
- Borradores de factura preparados solos el día 1 con las horas del mes, la cuota y el gasto de IA repercutido con su margen.
- Emisión con número correlativo: la factura se guarda imprimible en el almacén, queda registrada y se crea la tarea para enviarla.
- Control de cobros: marcas enviada, pagada o anulada, y las vencidas aparecen en rojo, también en el Panel principal.
- Resumen mensual con lo facturado, lo cobrado, lo pendiente, las horas, el coste de IA y el margen, con gráfico de facturado frente a coste de IA por proyecto.
- Configuración completa dentro de la aplicación: emisor, serie y numeración, IVA, IRPF, tarifa por hora, recargo de IA, vencimientos, redondeo y texto legal.
- Nuevos semáforos de facturación en «Estado del sistema».

## 0.28.0 — 6 de septiembre de 2026 — Modo cliente

- Nueva pantalla «Modo cliente»: crea para cada proyecto un enlace secreto que puedes enviar a tu cliente; entra sin contraseña y solo ve lo suyo.
- El cliente ve la versión que tiene en uso, las novedades de cada versión explicadas en su idioma, el estado del servicio con su semáforo y sus documentos y manuales listos para ver o descargar.
- Desde ese mismo portal puede enviarte peticiones, incidencias o preguntas, y ve el estado y tu respuesta a cada una.
- El portal lleva tu marca: nombre, color, logotipo, mensaje de bienvenida, correo de contacto y pie «Powered by».
- Eliges qué secciones se enseñan y puedes poner una fecha de caducidad al enlace.
- Por cada portal ves las visitas, el último acceso, el código QR para imprimir o compartir, y puedes copiarlo, abrirlo, desactivarlo, regenerarlo (el anterior deja de funcionar) o borrarlo.
- Bandeja con todas las peticiones de todos tus clientes: cambias el estado, escribes la respuesta que ellos ven y puedes convertir una petición en una orden para la IA.
- En la ficha del proyecto tienes la tarjeta «Portal del cliente» con el enlace, y en el Panel el aviso de peticiones nuevas.
- Si un enlace caduca o se sustituye, el cliente ve una página amable con tus datos de contacto.
- Nuevos semáforos del modo cliente en «Estado del sistema».


## 0.27.0 — 6 de septiembre de 2026 — Usuarios y accesos de los clientes

- Nueva pantalla «Usuarios de clientes»: desde aquí ves quién tiene acceso a cada una de las aplicaciones de tus clientes, todo junto.
- Buscador global por correo, nombre o rol en todos los proyectos, y filtro por proyecto.
- Los usuarios se agrupan por aplicación, con su correo, nombre, rol, forma de entrar, si está confirmado o bloqueado, cuándo entró por última vez (en rojo si hace más de 90 días) y cuándo se dio de alta.
- Puedes crear un usuario nuevo con contraseña (o dejar que se genere una segura), invitarlo por correo, cambiarle la contraseña, editar sus datos, bloquearlo, desbloquearlo y borrarlo.
- Al crear un usuario o cambiar su contraseña se muestra una sola vez, con botón de copiar y un mensaje ya escrito para enviárselo al cliente por WhatsApp.
- La contraseña queda siempre reflejada en Proyectian; con el botón del ojo puedes consultar la que hay guardada allí.
- Botón «Sincronizar todo» para traer los usuarios de todas las aplicaciones, y «Ver en vivo» para refrescar los de una sola.
- Pestaña «Histórico» con todo lo que se ha hecho, marcando en rojo lo que ha fallado y su motivo.
- En la ficha de cada proyecto tienes la tarjeta «Usuarios» con el total, los últimos accesos y el acceso directo a gestionarlos.
- En «Salud» se avisa cuando una aplicación tiene personas que llevan más de 90 días sin entrar.
- Nuevos semáforos de usuarios en «Estado del sistema».


## 0.26.0 — 6 de septiembre de 2026 — Auditoría mensual con el Auditor jefe

- Nueva pantalla «Auditoría»: el día 2 de cada mes se revisan todos tus proyectos y cada uno recibe una nota de 0 a 100.
- Se miran seis cosas en cada proyecto: accesibilidad, rendimiento, seguridad, textos, código y datos, con su nota por separado.
- Resumen del mes: nota media de la cartera, cuántos proyectos están en verde, ámbar y rojo, hallazgos por gravedad, coste del lote y un gráfico ordenado de peor a mejor.
- Cada hallazgo viene con el problema, dónde está y la solución propuesta; con un botón puedes convertirlo en tarea, o ver la tarea si ya se creó sola.
- Puedes auditar toda la cartera cuando quieras (se avisa del coste aproximado y verás el avance en directo) o auditar un solo proyecto.
- Comparativa con el mes anterior: se indica si el proyecto ha subido o bajado de puntuación.
- Configuración propia: activar o desactivar la auditoría automática, día del mes, qué áreas se revisan, crear tareas solas, limitarlas a lo crítico y alto, máximo de hallazgos y proyectos excluidos.
- En la ficha de cada proyecto tienes el chip «Auditoría: 82/100» con la fecha, y en el Panel una tarjeta «Auditoría del mes» con la nota media y los proyectos en rojo.
- Nuevos semáforos de la auditoría en «Estado del sistema».


## 0.25.0 — 6 de septiembre de 2026 — Generador de manuales

- Nueva pantalla «Manuales»: NexDeveloper recorre las pantallas de un proyecto, las captura y redacta el manual entero por ti.
- Puedes elegir a quién va dirigido: usuario final, administrador o comercial, con el título y la versión que quieras.
- Mientras se escribe ves el avance en directo: leyendo pantallas, índice, redactando capítulo a capítulo, componiendo y publicado.
- Cada manual queda guardado en el almacén (carpeta 03-MANUALES), registrado en Proyectian y visible en Documentación como un documento más.
- Desde la lista puedes ver el manual, guardarlo como PDF (se abre y se imprime), descargarlo en Markdown, regenerarlo con la versión actual o borrarlo, con filtros por proyecto y por público.
- Editor del manual: vista previa a la izquierda y, a la derecha, los capítulos con su captura para cambiar el título, reescribir el texto, poner otra imagen o volver a redactar solo ese capítulo.
- Configuración propia: estilo claro o técnico, capturas sí o no, servicio de capturas y número máximo de capítulos.
- Cada semana se regeneran solos los manuales de los proyectos que hayan cambiado de versión (puedes desactivarlo).
- En la ficha de cada proyecto tienes el botón «Generar manual» y el último manual a mano; y al cerrar una versión puedes pedir que se rehaga el manual de usuario con la versión nueva.
- Nuevos semáforos de los manuales en «Estado del sistema».


## 0.24.0 — 6 de septiembre de 2026 — Asistente de cartera

- Nueva pantalla «Asistente»: un chat dentro de NexDeveloper que conoce todos tus proyectos y te responde con cifras reales.
- Pregúntale cosas como «¿qué le debo a Gericentro esta semana?», «¿cuánto llevo gastado en IA en QSVista?» o «¿qué dominios caducan antes de 30 días?».
- El asistente puede crear tareas, órdenes y avisos desde la propia conversación, y te deja el enlace para abrirlos.
- Bajo cada respuesta puedes desplegar «Cómo lo he comprobado» para ver qué ha consultado, además del coste y los tokens de esa respuesta.
- Conversaciones guardadas en una lista lateral con buscador, conversaciones fijadas arriba, y opciones de renombrar, fijar y borrar.
- Puedes dictar la pregunta con el micrófono (en los navegadores que lo permiten), elegir un proyecto en foco y, si tienes varios, el proveedor de IA.
- Tarjetas de ejemplo al empezar una conversación para no quedarte en blanco.
- Caja rápida «Pregúntale a NexDeveloper…» en el panel principal, botón «Preguntar al asistente» en la ficha de cada proyecto y atajo Ctrl/Cmd + K desde cualquier pantalla.
- En el móvil, «Asistente» está también en la barra inferior de accesos rápidos.
- Nuevos semáforos del asistente en «Estado del sistema».


## 0.23.0 — 6 de septiembre de 2026 — NexDeveloper en el móvil con avisos

- Ya puedes instalar NexDeveloper en el iPhone, el iPad, el Mac o el ordenador como si fuera una aplicación, con su propio icono y sin barra del navegador.
- Nueva pantalla «Avisos»: activa los avisos en cada dispositivo con un botón y envía un aviso de prueba para comprobar que llegan.
- Recibirás un aviso cuando termine una compilación, cuando un dominio esté a punto de caducar, cuando una tarea necesite tu aprobación, cuando se dispare un presupuesto de IA, cuando la salud de un proyecto se ponga en rojo y cuando pase algo con las copias o las ejecuciones.
- Puedes elegir qué avisos quieres recibir y fijar horas de silencio nocturno para que no suene nada de madrugada.
- Lista de dispositivos con la fecha del último aviso y un botón para quitar los que ya no uses.
- Bandeja de avisos en directo: al tocar un aviso vas directo a la pantalla correspondiente y queda marcado como leído; también puedes filtrar y marcarlos todos.
- En el móvil aparece una barra inferior con accesos rápidos (Panel, Tareas, Ejecución y Avisos), la campana con el contador en la cabecera y márgenes adaptados a las pantallas con muesca.
- En el panel principal tienes la tarjeta «Últimos avisos» con los que quedan sin leer, y en «Estado del sistema» los nuevos semáforos de los avisos y de la aplicación instalable.
- Aviso para iPhone y iPad: los avisos solo funcionan si añades NexDeveloper a la pantalla de inicio y la abres desde ahí.


## 0.22.0 — Restaurar copias con un clic

- La pantalla «Copias» tiene ahora tres pestañas: Copias, Restaurar y Pruebas.
- En «Restaurar» ves las copias correctas de todos los proyectos (o de uno solo), con fecha, tamaño y número de tablas y filas; puedes descargarlas o restaurarlas.
- Asistente de tres pasos antes de tocar nada: primero qué contiene la copia y cómo está el destino, después dónde y cómo restaurar, y al final escribir RESTAURAR para confirmar.
- Puedes restaurar la base de datos en el proyecto original o en uno de pruebas, solo los datos o también la estructura; los repositorios se restauran siempre como una rama nueva en GitHub.
- Antes de sobrescribir nada se guarda una copia previa automática.
- Avance en directo: estado, paso actual, barras de tablas, filas y archivos, avisos y botón para cancelar; al terminar ves el resumen o el error.
- Pestaña «Pruebas»: prueba mensual automática (día 1 a las 05:00) que comprueba que las copias sirven de verdad, botón «Probar ahora», elección del proyecto de prueba y del Supabase de pruebas, e historial completo.
- Botón «Restaurar última copia» en la ficha de cada proyecto y nuevos semáforos en «Estado del sistema».



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
