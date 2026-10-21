# Sokoban — motor y herramientas

Código del juego pequeño que acompaña al libro **Orden, simetría y
armonía**, tercero de la serie de Luis Alfonso Salazar Vaca sobre diseño
de experiencia de usuario.

Un **Sokoban** —empujar cajas hasta sus marcas en un almacén— elegido por
su economía de reglas y de elementos en pantalla: con cuatro símbolos
sobre un tablero caben más decisiones de interfaz de las que caben en un
juego de respuestas rápidas.

## Stack

**Web nativa.** HTML para la estructura, CSS para el estilo y la
adaptación responsiva, JavaScript para la lógica y el dibujo. Nada de
servidores, nada de frameworks: todo corre en el navegador. Las
herramientas de contenido (editor de sprites, editor de sonido) viven en
el mismo repositorio como subdominios.

## Estructura del repositorio

| Ruta | Qué es |
|---|---|
| `index.html`, `css/`, `js/` | El juego. |
| `js/motor.js` + resto de `js/` | Motor del dominio, orientado a objetos (clases `Motor`, `Estado`, `Direccion`, `Jugada`, `Niveles` y jerarquía de `Evento`). |
| `test/` | 11 pruebas con `node:test` (7 del cap. 4 §4.4 del libro, 4 del cap. 6 §6.3). |
| `editor/` | Subdominio: editor de sprites. Produce `assets/sprites.txt`. |
| `editor-audio/` | Subdominio: editor de sonido. Produce `assets/sonidos.json`. |
| `assets/` | Archivos de contenido que el juego carga al arrancar. |
| `package.json` | Metadatos de Node y script `npm test`. |

## Jugar en el navegador

**En línea:** <https://luissalazarvaca1986.github.io/sokoban/> (GitHub
Pages publica la rama `main` en cada empuje; ver el workflow
`.github/workflows/pages.yml`).

**En local:** abrir `index.html` sirviéndolo con cualquier servidor
estático; los módulos ES exigen un origen HTTP:

```
npx serve .
```

Y entrar a la URL que imprime en consola.

### Las pruebas del motor

Con Node 20 o superior:

```
npm test
```

11 pruebas en verde. Cubren las 7 reglas del capítulo 4 y las 4
pruebas de motor del capítulo 6 del libro.

### Las herramientas

- Editor de sprites: `/editor/`
- Editor de sonido: `/editor-audio/`

Cada una exporta un archivo de texto plano (apéndice H del libro) que
el juego carga.

## Qué contiene y qué no reproduce

Esta implementación es original, escrita capítulo a capítulo junto al
libro. **No incluye, y no pretende reproducir**, el código fuente, los
niveles originales, los sprites, los recursos gráficos, los sonidos ni
la música del Sokoban original (Thinking Rabbit, 1982) ni de ninguna de
sus distribuciones posteriores. Las reglas se imitan solo en lo
necesario para ilustrar las ideas del libro.

La campaña incluye **23 mapas**. Los mapas personales del editor se
conservan aparte. Los bloques mantienen **32×32 píxeles lógicos**. Una cámara
sigue al jugador en los tableros grandes, se detiene en los bordes y deja
fijo el contador de movimientos. Los mapas pequeños se centran.

Los sprites y los sonidos se producen con las herramientas de este repositorio.

## Licencia

Código bajo licencia **MIT**. Ver [`LICENSE`](LICENSE).

## El libro

El libro vive en el taller de LaTeX del autor y se publica aparte; aquí
solo está la implementación. Capítulos del libro directamente
relacionados con este repositorio:

- Cap. 4-6: motor del juego (contrato del apéndice C).
- Cap. 7: las dos herramientas, su formato y por qué se construyen.
- Apéndice B: formato estándar de niveles (XSB).
- Apéndice C: contratos del motor.
- Apéndice H: formato de los archivos planos de sprites y sonidos.

## Marcas, mapas propios y sonido

El objetivo es resolver cada mapa con menos pasos; a igualdad de pasos,
mejor tiempo. El cronómetro empieza al intentar moverse y se detiene al
resolver. Solo cuentan los movimientos válidos; deshacer conserva el total
acumulado del intento y el tiempo transcurrido. Reiniciar o cambiar de mapa
empieza otro intento. Saltar un mapa no lo marca como completado.

**Mapas y marcas** permite consultar completados, mejor resultado y última
resolución, y jugar cualquier mapa. **Rendirme / saltar mapa** pasa al siguiente.
La campaña conserva sus 23 mapas y los mapas propios aparecen después.

**IndexedDB**, en este navegador y dispositivo, guarda marcas, mapas propios
y sonidos personalizados, sin servidor. Se migran los mapas del almacenamiento
anterior. Si no se pueden guardar las marcas, se conserva la sesión y se avisa;
borrar los datos del navegador elimina el progreso.

El editor de mapas guarda copias en IndexedDB y no ofrece botones de descarga.
El editor de sonido permite guardar y usar la personalización en el juego,
restaurar la melodía original, importar y descargar `sonidos.json`.
**Las marcas no se exportan ni se importan.** Las descargas no incluyen la base.

Verificación adicional con Chromium: abrir `test/navegador.html` en un servidor
local; usa una base de prueba del origen local y reinicia sus datos para verificar
persistencia, migración, descargas y el juego. No ejecutarlo sobre el origen donde
se conservan partidas reales.

### Fotogramas del personaje

Los 13 tiles del personaje son de 32×32. Los intermedios se derivan de
las poses base: cabeza y torso estables, piernas alternadas y cuerpo sin
huecos transparentes encerrados. La transparencia exterior deja ver suelo
y destinos. Cada fotograma dura **120 ms**; cada movimiento aceptado anima un solo paso
de dos poses (**240 ms**) y termina mirando al frente.

`python3 tools/reparar-personaje.py` reconstruye esos cuadros en
`assets/sprites.txt` de forma idempotente, sin modificar los demás tiles.
Las poses base editables se conservan en `tools/personaje-base.txt`; el generador
añade un contorno negro de 1 píxel dentro de la silueta, incluidas las manos.
Esto mantiene el tamaño 32×32 sin engrosar el personaje en cada reconstrucción.

La pantalla se ordena en cabecera (Sokoban, nivel y tiempo), toolbar de una
sola fila (mapa con cronómetro, saltar, sonido y editores), tablero y controles
(flechas, deshacer y reiniciar). El menú del lápiz enlaza a los tres editores
mediante iconos con nombres accesibles; no hay ayuda ni enlaces bajo el mando.

Los botones de la toolbar miden 45×45 px CSS (25% menos por lado que los
60×60 anteriores). El lápiz queda al final; el cierre del menú de editores
es circular, rojo y está anclado a su esquina superior derecha.

### Música de fondo

El editor de sonido permite ocultar y volver a mostrar el panel de pistas y
momentos con el primer botón de su toolbar. La selección y las modificaciones
se conservan al alternarlo. La zona de la pista (parámetros, acordes y teclado)
se desplaza horizontalmente cuando no cabe, también con tacto o teclado.
`test/audio-interfaz.html` comprueba el panel, el ancho y la conservación de
la edición en vistas de 390 y 1280 px, sin guardar sonidos.

«Almacén en marcha»: composición original, energía rock en re menor, 32
compases y cuatro secciones, 144 BPM (53,33 segundos), en bucle continuo.
El sintetizador conserva la melodía por debajo de las señales del juego.
Se reconstruye con `python3 tools/componer-fondo.py`. Si hay sonidos propios
guardados, el juego usa esa personalización; «Restaurar original» en el editor
de sonidos permite escuchar esta versión incluida.

### Editores y contenido propio

Los tres editores tienen un botón gráfico de volver al juego, a la izquierda
del título. El editor de sprites carga los 18 tiles de 32×32 y su paleta real.
«Guardar y usar en el juego» conserva el documento personalizado en IndexedDB
(`contenido`, clave `sprites`); el juego da preferencia a esta versión.
«Eliminar personalización» restaura el tile seleccionado desde el original y
conserva las demás personalizaciones. También se puede restaurar el conjunto.

El editor de mapas permite escoger campaña y mapas propios. Guardar siempre
crea una copia con nombre nuevo, sin sobrescribir mapas existentes. La campaña
conserva sus 23 mapas y los propios se numeran desde el 24 en el editor y el
juego. Las marcas siguen separadas y no se exportan.

Prueba de integración real: servir este repositorio en localhost y abrir
`test/editores.html` en un perfil de prueba; reinicia los datos de ese origen.
Comprueba los tres retornos, tiles personalizados, restauración individual,
recarga y copias de mapas con renombrado obligatorio.

El catálogo del editor y la exportación ordenan los tiles por nombre.
`assets/sprites.txt` y la lámina de contactos del libro usan el mismo orden
alfabético, agrupando las poses de cada dirección.

En mapas, «Mapa Base» precede a la fila Nombre/Guardar con icono. Ancho,
Alto, Reescalar y Vaciar comparten otra fila; las acciones son SVG sin texto
visible. La paleta muestra los sprites reales (jugador en reposo frontal),
fuente de 32×32 con miniaturas CSS de 16×16 en siete botones de 32×32, en una
fila. Se eliminan los dos botones de descarga.
