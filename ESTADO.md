# Estado del repositorio

Dónde está el repositorio y qué hay por hacer. Primera lectura al abrirlo.

---

## 1. Qué es este repositorio

Código del juego **Sokoban** que acompaña al libro *Orden, simetría y
armonía*, tercero de la serie de Luis Alfonso Salazar Vaca sobre diseño
de experiencia de usuario.

**Stack:** web nativa (HTML + CSS + JavaScript). Nada de servidores. Nada
de frameworks. Todo corre en el navegador.

## 2. Dónde estamos hoy

**2026-10-18.** Stack oficial del libro: web nativa. Motor en
JavaScript con los 5 métodos y 5 eventos del apéndice C. Dos
herramientas de contenido como subdominios: editor de sprites y editor
de sonido. Punto de entrada del juego con renderizado provisional en
bloques.

**Lo que hay a esta fecha:**

| Ruta | Qué es |
|---|---|
| `index.html`, `css/estilos.css`, `js/main.js` | Juego: orquestación, HUD mínimo, teclado |
| `js/direccion.js` | Clase `Direccion` + constantes NORTE, SUR, ESTE, OESTE |
| `js/eventos.js` | Jerarquía de eventos (Movimiento, Empuje, Rechazo, Deshecho, SinCambios, NivelCompleto) |
| `js/estado.js` | Clase `Estado` inmutable + `Jugada` |
| `js/niveles.js` | Clase `Niveles`: parse XSB estándar, serializar, `maqueta()` |
| `js/motor.js` | Clase `Motor`: 5 métodos del apéndice C + Observer |
| `test/motor.test.js` | 11 pruebas con `node:test` (7 reglas + 4 motor) |
| `editor/` | Subdominio editor de sprites: lienzo 16×16, paleta, animaciones; exporta `sprites.txt` |
| `editor-audio/` | Subdominio editor de sonido: pistas, acordes de piano, bucles, momentos; exporta `sonidos.json` |
| `package.json` | type: module, script `npm test` |
| `README.md`, `LICENSE`, `.gitignore` | — |

**11 pruebas verdes.** `npm test`.

**Lo que NO hay a esta fecha:**

- **Carga de los archivos del editor en el juego.** El juego dibuja con
  bloques de color provisionales; el renderizador no lee aún `sprites.txt`
  ni el sistema de capas del apéndice B. Es el siguiente paso.
- **Reproducción de sonido en el juego.** El editor sintetiza y
  reproduce, pero el juego no consume `sonidos.json` todavía.
- **Cámara, controles táctiles, vista de mapa.** Las decisiones de la
  Parte III y IV del libro aún no están implementadas.
- **Niveles del libro.** Hay `Niveles.maqueta()`; los demás niveles por
  capítulo se diseñarán cuando se escriban las figuras antes/después.
- **Mediciones de usabilidad.** Pendientes de las pruebas con personas.

## 3. El libro al que acompaña este código

- **Título:** *Orden, simetría y armonía*
- **Subtítulo:** *Diseño de experiencia de usuario con base en el análisis
  del juego clásico Sokoban, para programadores y no programadores*
- **Autor:** Luis Alfonso Salazar Vaca
- **Lugar en la serie:** tercero de cuatro
- **El libro recoge** el encargo que *Invadiendo Espacios* dejó en su §27.4
  ---«otro libro de esta serie» sobre cómo se construye una interfaz
  visual y qué está bien hecho al construirla---.

## 4. Decisiones de diseño del código

Son las que aparecen en el libro, aplicadas aquí al pie de la letra.

- **Orientación a objetos con patrones justificados.** State para el
  estado del juego, Command para las jugadas (habilita deshacer), Observer
  para la presentación. Cada patrón vive en el fichero del motor con un
  comentario que lo justifica; no se añaden patrones por adelantado.
- **Dominio puro.** Las operaciones del motor son funciones puras:
  reciben estado y devuelven estado nuevo. El motor no muta ni guarda
  estado interno (salvo la lista de suscriptores Observer).
- **Pipeline de contenido.** El motor no habla con las herramientas: lee
  archivos de texto plano que las herramientas escriben. Si el formato se
  respeta, cualquier herramienta puede sustituir a cualquiera. Apéndice
  H del libro.
- **Sin dependencias en producción.** El juego corre con solo abrir el
  HTML. Las pruebas usan `node:test`, que viene con Node estándar.

## 5. Qué va a pasar después, por orden

1. **Dibujar con sprites reales.** El renderizador de `js/main.js` lee
   `assets/sprites.txt`, carga tiles y animaciones y los dibuja en el
   canvas en lugar de bloques de color.
2. **Reproducir sonido.** `js/sonido.js` lee `assets/sonidos.json` y
   responde a los eventos del motor con la pista del momento
   correspondiente.
3. **Capa de cámara y vista de mapa** para niveles grandes (cap. 13).
4. **Controles táctiles**: D-pad, swipe, botones de acción (cap. 12).
5. **Mediciones** que soporten las cifras de la Parte III y IV: tiempo
   hasta primera acción, errores de interacción, SUS.

## 6. Convenciones del repositorio

- **Ortografía del juego:** **«Sokoban» con K**, por decisión del autor
  del 2026-10-19.
- **Idioma del código:** español. `Motor.jugar`, `NORTE`, `Empuje`,
  `Niveles.maqueta`.
- **Idioma de los commits:** español, breves, en imperativo o
  descriptivo.
- **Licencia:** MIT.
- **Sin materiales del original.** Nada del Sokoban original de Thinking
  Rabbit (1982) ni de distribuciones posteriores entra aquí: ni niveles,
  ni sprites, ni recursos gráficos, ni música. Las reglas se imitan solo
  en lo necesario para ilustrar las ideas del libro.

## Actualización 2026-10-19 — campaña de 23 mapas

La campaña contiene 23 mapas: tres tutoriales y veinte retos. Se conserva
el formato de almacenamiento de los tableros; los mapas personales del editor
se mantienen aparte.
El renderizador ajusta el tamaño de las casillas para mostrar completos
los tableros grandes. Se añaden pruebas de carga, fidelidad al archivo
SLC y conservación de mapas personales.

Corrección: el mapa 6 conservado es **Dos simétricas**, según la versión
publicada anterior (`999bb6f`). La campaña siempre carga exactamente 23 mapas,
incluso si existen mapas personales guardados en el editor.

## Actualización — cámara con bloques de 32×32

Se sustituye la reducción de casillas por una cámara que sigue al jugador
y se limita al contorno del mapa. Las casillas conservan 32×32 píxeles
lógicos, el HUD queda fijo y los mapas pequeños se centran. La cámara
se calcula desde el estado actual, también al deshacer, reiniciar y cambiar de nivel.

## Actualización — música y animación

El audio reanuda su contexto suspendido con un gesto y recuerda la petición
de fondo si el archivo aún estaba cargando. El bucle se programa por reloj
de audio con anticipación. La melodía original pasa a 16 compases (unos
43 segundos a 90 bpm), con dos frases y variaciones.

La animación conserva orientación al detenerse, evita reiniciar la secuencia
en cada paso y limita las poses a un mínimo de 140 ms; los rechazos no
disparan la marcha. Se mantienen sprites de 32×32 y los recursos de dibujo.
Validación: 19 pruebas pasan, incluidos carga tardía de audio, reanudación,
continuidad del bucle y estabilidad de poses.

## Actualización — progreso local y contenido del jugador

IndexedDB almacena marcas, mapas propios y sonidos. Cronómetro desde el primer
intento de movimiento; contador de pasos acumulados que no se reduce al deshacer.
Reiniciar o cambiar de mapa empieza otra partida. Se guardan mejor resultado
(pasos primero, tiempo como desempate) y última resolución por mapa. Selector de
mapas y opción de rendirse/saltar, sin dar por completado un mapa abandonado.

Se migran mapas anteriores, se añaden al final de los 23 de campaña y pueden
descargarse desde el editor. El editor de audio guarda la personalización para
el juego y descarga solo sonidos; ninguna opción exporta marcas. Deshacer,
reiniciar y sonido muestran solo iconos con nombres accesibles.

Por nueva instrucción del autor, la animación vuelve al retrato frontal al
terminar un ciclo y cada pose dura como mínimo 240 ms.

## Actualización — silueta sólida y animación de 120 ms

Se corrigen los fotogramas dispersos y el sur invertido en el archivo nativo
de sprites. Se conservan 32×32, cabeza y torso entre cuadros; las piernas
alternan sin ruido de transparencia. Se rellenan huecos interiores, dejando
transparencia fuera del cuerpo. Por instrucción del autor se fijan todos los
fotogramas a 120 ms y se conserva el final mirando al frente. Herramienta
reproducible: `tools/reparar-personaje.py`. Se inspeccionó la lámina de las
13 poses sobre un fondo cuadriculado.

## Actualización — contorno negro

Las 13 poses del personaje llevan un borde negro puro de 1 píxel, incluidas
las manos, para separarlas del piso. Se aplica sobre el borde interior de
la silueta, conservando 32×32, transparencia exterior y fotogramas de 120 ms.
Las referencias editables viven en `tools/personaje-base.txt` y la herramienta
las reconstruye sin acumular bordes. Lámina de poses revisada visualmente.

## Actualización — toolbar y menú de editores

Cabecera con título, nivel y tiempo; toolbar de iconos en una fila con mapas
y marcas (mapa y cronómetro), lápiz, saltar y sonido. Debajo, tablero y
controles de movimiento, deshacer y reiniciar. Se elimina el pie con texto.
El lápiz abre un diálogo con enlaces de iconos a mapas, sonidos y sprites.

## Ajuste de la toolbar

Orden: mapas/marcas, saltar, sonido, lápiz. Botones de 45×45 px CSS
(reducción del 25% por lado), icono de mapa de 24×24. El cierre del
diálogo de editores se ancla a su esquina superior izquierda.
