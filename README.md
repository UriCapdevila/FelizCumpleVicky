# Para Vicky

Una experiencia web privada de cumpleaños: cuenta regresiva hasta el 9 de octubre, recorrido visual y tres cartas-regalo interactivas.

La música ambiental se reproduce en loop durante toda la experiencia. Si el navegador bloquea el inicio automático con sonido, comienza con la primera interacción o desde el botón musical; el mismo control permite pausarla y recuerda esa preferencia. Al abrir el cofre bonus, la música cambia a la canción de One Piece y vuelve a la principal al regresar.

## Cambiar los textos

Todo el contenido personal está en `content.js`. Ahí podés editar:

- la fecha de apertura;
- los textos de cada escena;
- el título, motivo y detalle de cada regalo;
- el mensaje final.

No cambies los nombres que están antes de los dos puntos. Editá solamente el texto entre comillas.

## Probar antes del cumpleaños

La página normal permanece bloqueada hasta la fecha configurada. Para probar la experiencia completa antes, agregá `?preview=1` al final de la dirección.

Ejemplo local: `http://localhost:8888/?preview=1`

Para revisar directamente el regalo sorpresa y su entrada de diez segundos, usá `?preview=bonus`. Durante el desarrollo también se puede agregar `&skipBonusIntro=1` para ver las cartas sin esperar la animación. Los diseños comparativos de las cartas se pueden abrir con `&bonusDesign=a`, `&bonusDesign=b` o `&bonusDesign=c`; el selector visual solamente aparece en este preview.

La elección de una carta bonus se guarda en el navegador y es definitiva para esa instalación. Después de elegir, la ganadora queda destacada y los demás caminos se pueden consultar sin volver a participar.

## Comparar tipografías

Abrí `fonts.html` para probar cinco estilos de títulos sobre el mismo texto: Cormorant Garamond, Playfair Display, Cinzel Decorative, Marcellus y Parisienne. La selección es solamente visual; la tipografía principal se cambia cuando esté elegida la opción final.

## Publicar en Netlify

El proyecto no necesita build ni servidor. En Netlify, conectá este repositorio y dejá vacío el comando de build. El directorio de publicación es `.` (la raíz), ya configurado en `netlify.toml`.

La fecha usa explícitamente la zona horaria de Buenos Aires (`-03:00`), así que se abrirá a las 00:00 de Argentina aunque Vicky esté usando otro dispositivo.

## Archivos importantes

- `index.html`: estructura de la experiencia.
- `styles.css`: estética, responsive y animaciones.
- `app.js`: cuenta regresiva e interacciones.
- `content.js`: tus textos y regalos.
- `assets/`: ilustraciones que forman parte del recorrido.
- `music/`: canción ambiental de la experiencia.
