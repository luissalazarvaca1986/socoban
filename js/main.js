import { Progreso, Intento, formatoTiempo } from './progreso.js';
import { AnimacionJugador } from './animacion-jugador.js?v=duracion2';
import { encuadrar, TAMANO_BLOQUE } from './camara.js?v=bloques32-2';
// Orquestacion del juego en el navegador.
//
// Punto de entrada del index.html. Responsabilidades:
//   - cargar el nivel de maqueta,
//   - escuchar teclado, D-pad tactil y deslizamiento,
//   - delegar al Motor,
//   - redibujar el estado con sprites o repliegue de bloques,
//   - conectar el motor al modulo de sonido.
//
// Decisiones de diseño documentadas en el libro:
//   cap. 11: sprites, resolucion logica 320x240.
//   cap. 12 §3: D-pad discreto, no joystick; targets 60px+;
//               activacion en el gesto, no al soltar; sin repeticion
//               al mantener; vibracion haptica en moviles con soporte.

import { Motor } from './motor.js';
import { NORTE, SUR, ESTE, OESTE } from './direccion.js';
import { Movimiento, Empuje, Rechazo, NivelCompleto } from './eventos.js';
import { Sonido } from './sonido.js?v=marcas1';
import { Sprites } from './sprites.js?v=personalizados1';
import { listar as listarNiveles, cargarUsuario, listarUsuario } from './niveles-almacen.js?v=personalizados1';

const motor = new Motor();
const sonido = new Sonido();
const sprites = new Sprites();
let paso = 0;
let orientacion = 'sur';  // ultima direccion en la que miro el jugador

const animacionJugador = new AnimacionJugador();
const progreso = new Progreso();
await Promise.all([progreso.cargar(), cargarUsuario()]);
let intento = new Intento();

let niveles = [...listarNiveles(), ...listarUsuario()];
let indiceNivel = 0;
let nivelOriginalTxt = niveles[indiceNivel].texto;
let estado = motor.cargar(nivelOriginalTxt);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const info = document.getElementById('info');
const overlayCompletado = document.getElementById('overlay-completado');
const tituloCompletado  = document.getElementById('titulo-completado');
const textoCompletado   = document.getElementById('texto-completado');
const btnSiguiente      = document.getElementById('btn-siguiente');
const btnRepetir        = document.getElementById('btn-repetir');

function mostrarInfoNivel() {
  info.textContent = `Nivel ${indiceNivel + 1}/${niveles.length}: ${niveles[indiceNivel].nombre}`;
}
mostrarInfoNivel();

const relojEl = document.getElementById('reloj');
const dialogoMapas = document.getElementById('mapas-dialogo');
const dialogoEditores = document.getElementById('editores-dialogo');
document.getElementById('btn-editar').addEventListener('click', () => dialogoEditores.showModal());
document.getElementById('cerrar-editores').addEventListener('click', () => dialogoEditores.close());
document.getElementById('toolbar').addEventListener('keydown', e => {
  const botones = [...e.currentTarget.querySelectorAll('button')];
  const i = botones.indexOf(document.activeElement);
  if (e.key === 'Escape') { canvas.focus(); e.stopPropagation(); return; }
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault(); e.stopPropagation();
  const siguiente = e.key === 'Home' ? 0 : e.key === 'End' ? botones.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + botones.length) % botones.length;
  botones[siguiente].focus();
});
const listaMapas = document.getElementById('lista-mapas');
const resumenProgreso = document.getElementById('resumen-progreso');
function marcaTexto(resultado) {
  return `${resultado.pasos} pasos · ${formatoTiempo(resultado.tiempoMs)}.${Math.floor(resultado.tiempoMs % 1000 / 100)}`;
}
function mostrarMapas() {
  listaMapas.replaceChildren();
  let completados = 0;
  niveles.forEach((nivel, i) => {
    const resultado = progreso.consultar(nivel);
    if (resultado) completados++;
    const fila = document.createElement('tr');
    if (resultado) fila.className = 'completado';
    const textos = [`${i + 1}. ${nivel.nombre}`, resultado ? '✓ Completado' : 'Pendiente',
      resultado ? marcaTexto(resultado.mejor) : '—', resultado ? marcaTexto(resultado.ultimo) : '—'];
    for (const texto of textos) {
      const celda = document.createElement('td'); celda.textContent = texto; fila.append(celda);
    }
    const celda = document.createElement('td');
    const boton = document.createElement('button');
    boton.type = 'button'; boton.className = 'btn';
    boton.textContent = i === indiceNivel ? 'Reintentar' : 'Jugar';
    boton.setAttribute('aria-label', `${boton.textContent}: ${nivel.nombre}`);
    boton.addEventListener('click', () => { dialogoMapas.close(); cargarNivel(i); });
    celda.append(boton); fila.append(celda); listaMapas.append(fila);
  });
  resumenProgreso.textContent = `${completados}/${niveles.length} mapas completados.`;
  document.getElementById('aviso-guardado').textContent = progreso.persistente
    ? 'Marcas guardadas en este navegador. Borrar sus datos elimina el progreso.'
    : 'El navegador no permite guardar: el progreso solo durará esta sesión.';
  dialogoMapas.showModal();
}
document.getElementById('btn-mapas').addEventListener('click', mostrarMapas);
document.getElementById('cerrar-mapas').addEventListener('click', () => dialogoMapas.close());
document.getElementById('btn-saltar').addEventListener('click', () => { cargarNivel(indiceNivel + 1); canvas.focus(); });

// Vibracion haptica breve. Silenciosa si el dispositivo no la soporta.
const vibrar = (ms) => { if (navigator.vibrate) navigator.vibrate(ms); };

// -------------------------------------------------------------------
// Sonido: subscripcion al motor + arranque tras primer gesto
// -------------------------------------------------------------------
motor.suscribir((ev) => {
  if (ev instanceof Movimiento) {
    paso += 1;
    sonido.disparar(paso % 2 === 0 ? 'al_dar_paso_par' : 'al_dar_paso_impar');
  } else if (ev instanceof Empuje) {
    paso += 1;
    sonido.disparar('al_empujar');
  } else if (ev instanceof Rechazo) {
    sonido.disparar('al_rechazar');
    vibrar(30);
  } else if (ev instanceof NivelCompleto) {
    sonido.disparar('al_completar_nivel');
    vibrar([60, 40, 60, 40, 180]);
  }
});

sonido.cargar('assets/sonidos.json?v=rock32').catch(e => console.warn('No se cargo sonidos.json:', e));
sprites.cargar('assets/sprites.txt?v=correcciones3').catch(e => console.warn('No se cargaron sprites:', e));

window.addEventListener('pointerdown', iniciarAudioSiHaceFalta, { passive: true });

function iniciarAudioSiHaceFalta() {
  if (!sonido.silenciado) {
    sonido.iniciar();
    sonido.iniciarFondo();
  }
}

// -------------------------------------------------------------------
// Jugada: unico punto de entrada para teclado, D-pad y swipe
// -------------------------------------------------------------------
const NOMBRE_ORIENTACION = new Map([
  [NORTE, 'norte'], [SUR, 'sur'], [ESTE, 'este'], [OESTE, 'oeste'],
]);
function mover(direccion) {
  if (intento.terminado || dialogoMapas.open || dialogoEditores.open) return;
  intento.iniciar();
  iniciarAudioSiHaceFalta();
  const nuevaOrient = NOMBRE_ORIENTACION.get(direccion) ?? orientacion;
  orientacion = nuevaOrient;
  const antes = motor.estadoActual(estado).cajasSobreDestino.size;
  const [nuevo, ev] = motor.jugar(estado, direccion);
  const avanzo = nuevo !== estado;
  if (avanzo) intento.avanzar();
  estado = nuevo;
  const despues = motor.estadoActual(estado).cajasSobreDestino.size;
  if (despues > antes) sonido.disparar('al_colocar_caja');

  if (avanzo) animacionJugador.mover(orientacion, performance.now());

  if (ev instanceof NivelCompleto) {
    mostrarCompletado(ev.movimientosRealizados);
  }
}

async function mostrarCompletado() {
  const intentoCompletado = intento;
  const nivelCompletado = niveles[indiceNivel];
  const resultado = intento.terminar();
  const esUltimo = indiceNivel >= niveles.length - 1;
  const todos = niveles.every((nivel, i) => i === indiceNivel || progreso.consultar(nivel));
  tituloCompletado.textContent = todos ? '¡Campaña completada!' : '¡Nivel completado!';
  textoCompletado.textContent = `Resuelto en ${marcaTexto(resultado)}. Guardando marca…`;
  btnSiguiente.textContent = esUltimo ? 'Volver al primero' : 'Siguiente nivel →';
  overlayCompletado.classList.remove('oculto');
  btnSiguiente.focus();
  const record = await progreso.guardar(nivelCompletado, resultado);
  if (intento !== intentoCompletado) return;
  textoCompletado.textContent = `Resuelto en ${marcaTexto(resultado)}. ${record ? '¡Nueva mejor marca!' : 'Mejor marca: ' + marcaTexto(progreso.consultar(nivelCompletado).mejor) + '.'}${progreso.persistente ? '' : ' No se pudo guardar en este navegador; queda en esta sesión.'}`;
}
function ocultarCompletado() { overlayCompletado.classList.add('oculto'); }

function cargarNivel(indice) {
  // Si pedimos uno que no existe, volvemos al primero. Si se añadieron
  // niveles mientras jugabamos, los recogemos aqui.
  ocultarCompletado();
  intento = new Intento();
  niveles = [...listarNiveles(), ...listarUsuario()];
  indiceNivel = ((indice % niveles.length) + niveles.length) % niveles.length;
  nivelOriginalTxt = niveles[indiceNivel].texto;
  estado = motor.cargar(nivelOriginalTxt);
  paso = 0;
  orientacion = 'sur';
  animacionJugador.direccion = 'sur';
  animacionJugador.detener();
  mostrarInfoNivel();
}

btnSiguiente.addEventListener('click', () => {
  ocultarCompletado();
  cargarNivel(indiceNivel + 1);
});
btnRepetir.addEventListener('click', () => {
  ocultarCompletado();
  cargarNivel(indiceNivel);
});
function deshacer() {
  if (intento.terminado || dialogoMapas.open || dialogoEditores.open) return;
  iniciarAudioSiHaceFalta();
  const [nuevo] = motor.deshacer(estado);
  estado = nuevo;
  animacionJugador.detener();
}
function reiniciar() {
  iniciarAudioSiHaceFalta();
  cargarNivel(indiceNivel);
}

// -------------------------------------------------------------------
// Bucle de animacion. Siempre se dibuja en cada frame: la animacion
// del jugador avanza por tiempo, no por evento. Entre jugadas, la
// animacion sigue hasta terminar y luego el jugador queda en quieto.
// -------------------------------------------------------------------
function spriteJugador() {
  return animacionJugador.cuadro(sprites, performance.now());
}

function tick() {
  const textoReloj = `Tiempo: ${formatoTiempo(intento.tiempoMs)}`;
  if (relojEl.textContent !== textoReloj) relojEl.textContent = textoReloj;
  render();
  requestAnimationFrame(tick);
}

// -------------------------------------------------------------------
// Teclado
// -------------------------------------------------------------------
const TECLAS = {
  ArrowUp: NORTE, KeyW: NORTE,
  ArrowDown: SUR, KeyS: SUR,
  ArrowLeft: OESTE, KeyA: OESTE,
  ArrowRight: ESTE, KeyD: ESTE,
};
window.addEventListener('keydown', (e) => {
  if (dialogoMapas.open || dialogoEditores.open || !overlayCompletado.classList.contains('oculto') || e.target.closest?.('input, select, textarea, a, #toolbar')) return;
  if (e.repeat) return;              // sin repeticion al mantener
  if (e.code in TECLAS) { e.preventDefault(); mover(TECLAS[e.code]); return; }
  if (e.code === 'KeyZ') { e.preventDefault(); deshacer(); return; }
  if (e.code === 'KeyR') { e.preventDefault(); reiniciar(); return; }
  if (e.code === 'KeyM') { e.preventDefault(); alternarSonido(); return; }
});

// -------------------------------------------------------------------
// D-pad y acciones: pointer events (unifica touch y mouse, sin double-fire)
// -------------------------------------------------------------------
const DIRECCIONES = { norte: NORTE, sur: SUR, este: ESTE, oeste: OESTE };

for (const [nombre, dir] of Object.entries(DIRECCIONES)) {
  const btn = document.querySelector(`[data-dir="${nombre}"]`);
  if (!btn) continue;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.classList.add('pulsado');
    vibrar(10);
    mover(dir);
  });
  const quitarPulsado = () => btn.classList.remove('pulsado');
  btn.addEventListener('pointerup', quitarPulsado);
  btn.addEventListener('pointerleave', quitarPulsado);
  btn.addEventListener('pointercancel', quitarPulsado);
}

function enlazarAccion(selector, fn) {
  const btn = document.querySelector(selector);
  if (!btn) return;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.classList.add('pulsado');
    vibrar(10);
    fn();
  });
  const quitar = () => btn.classList.remove('pulsado');
  btn.addEventListener('pointerup', quitar);
  btn.addEventListener('pointerleave', quitar);
  btn.addEventListener('pointercancel', quitar);
}
enlazarAccion('[data-accion="deshacer"]', deshacer);
enlazarAccion('[data-accion="reiniciar"]', reiniciar);

const btnSonido = document.querySelector('[data-accion="sonido"]');
function alternarSonido() {
  const silenciar = !sonido.silenciado;
  sonido.silenciar(silenciar);
  if (btnSonido) {
    btnSonido.setAttribute('aria-pressed', String(silenciar));
    btnSonido.setAttribute('aria-label', silenciar ? 'Activar sonido' : 'Silenciar sonido');
    btnSonido.title = silenciar ? 'Activar sonido' : 'Silenciar sonido';
    const icono = btnSonido.querySelector('.icono');
    if (icono) icono.textContent = silenciar ? '🔇' : '🔊';
  }
  if (!silenciar) iniciarAudioSiHaceFalta();
}
enlazarAccion('[data-accion="sonido"]', alternarSonido);

// -------------------------------------------------------------------
// Deslizamiento (swipe) sobre el canvas
// -------------------------------------------------------------------
let touchInicio = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  touchInicio = { x: e.clientX, y: e.clientY };
}, { passive: true });
canvas.addEventListener('pointerup', (e) => {
  if (!touchInicio || e.pointerType === 'mouse') { touchInicio = null; return; }
  const dx = e.clientX - touchInicio.x;
  const dy = e.clientY - touchInicio.y;
  const UMBRAL = 24;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < UMBRAL) { touchInicio = null; return; }
  vibrar(10);
  if (Math.abs(dx) > Math.abs(dy)) mover(dx > 0 ? ESTE : OESTE);
  else mover(dy > 0 ? SUR : NORTE);
  touchInicio = null;
}, { passive: true });

// -------------------------------------------------------------------
// Escalado responsivo entero. Resolucion logica 320x240 (cap. 11).
// -------------------------------------------------------------------
// Mide la celda del tablero y escoge la mayor escala entera que cabe.
// El contenedor es #tablero: en vertical ocupa el ancho de pantalla,
// en horizontal queda entre el D-pad y las acciones. Medir el
// contenedor hace que el calculo valga para los tres layouts sin
// condicionales por orientacion.
const tablero = document.getElementById('tablero');
function ajustarEscala() {
  const marco = tablero.getBoundingClientRect();
  const anchoVista = Math.max(160, marco.width - 2);
  const altoVista = Math.max(120, marco.height - 2);
  const escala = Math.max(1, Math.floor(Math.min(anchoVista / 320, altoVista / 240)));
  canvas.style.width = (320 * escala) + 'px';
  canvas.style.height = (240 * escala) + 'px';
  canvas.width = 320; canvas.height = 240;
  ctx.imageSmoothingEnabled = false;
  render();
}
window.addEventListener('resize', ajustarEscala);
window.addEventListener('orientationchange', ajustarEscala);
new ResizeObserver(ajustarEscala).observe(tablero);
ajustarEscala();
requestAnimationFrame(tick);

// -------------------------------------------------------------------
// Renderizador: sprites si cargaron, bloques como repliegue.
// -------------------------------------------------------------------
function render(evento = null) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const vista = motor.estadoActual(estado);
  const todas = [...vista.paredes, ...vista.destinos, ...vista.cajas].map(k => k.split(',').map(Number));
  todas.push([vista.almacenero[0], vista.almacenero[1]]);
  const maxF = Math.max(...todas.map(([f]) => f)) + 1;
  const maxC = Math.max(...todas.map(([, c]) => c)) + 1;
  const TILE = TAMANO_BLOQUE;
  const { x: ox, y: oy } = encuadrar(maxF, maxC, vista.almacenero);

  // HUD mínima
  ctx.fillStyle = '#262838';
  ctx.fillRect(0, 0, 320, 16);
  ctx.fillStyle = '#f2f2f6';
  ctx.font = '10px sans-serif';
  ctx.fillText(`Pasos: ${intento.pasos}`, 6, 11);

  // El mundo se recorta al área de juego; nunca tapa el HUD.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 16, 320, 224);
  ctx.clip();

  const usarSprites = sprites.listo;
  const dibujar = (f, c, nombre, colorFallback) => {
    const x = ox + c * TILE, y = oy + f * TILE;
    if (x + TILE <= 0 || x >= 320 || y + TILE <= 16 || y >= 240) return;
    if (usarSprites && sprites.dibujar(ctx, nombre, x, y)) return;
    ctx.fillStyle = colorFallback;
    ctx.fillRect(x, y, TILE, TILE);
  };

  for (let f = 0; f < maxF; f++) for (let c = 0; c < maxC; c++) {
    const k = `${f},${c}`;
    if (vista.paredes.has(k)) {
      dibujar(f, c, 'muro', '#566c86');
    } else if (vista.destinos.has(k) && !vista.cajas.has(k)) {
      dibujar(f, c, 'suelo', '#1a1c2c');
      dibujar(f, c, 'destino', '#ffcd75');
    } else {
      dibujar(f, c, 'suelo', '#1a1c2c');
    }
  }
  for (const k of vista.cajas) {
    const [f, c] = k.split(',').map(Number);
    const esDestino = vista.destinos.has(k);
    dibujar(f, c, esDestino ? 'caja_sobre_destino' : 'caja',
            esDestino ? '#38b764' : '#8b5a2b');
  }
  const [pf, pc] = vista.almacenero;
  const nombreSprite = spriteJugador();
  let dibujoJugador = false;
  if (usarSprites) {
    dibujoJugador = sprites.dibujar(ctx, nombreSprite, ox + pc * TILE, oy + pf * TILE)
                 || sprites.dibujar(ctx, 'jugador_quieto_0', ox + pc * TILE, oy + pf * TILE);
  }
  if (!dibujoJugador) {
    ctx.fillStyle = '#73eff7';
    ctx.beginPath();
    ctx.arc(ox + pc * TILE + TILE / 2, oy + pf * TILE + TILE / 2, TILE / 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (evento instanceof Rechazo) {
    ctx.strokeStyle = '#b13e53'; ctx.lineWidth = 2;
    ctx.strokeRect(ox + pc * TILE, oy + pf * TILE, TILE, TILE);
  }
  ctx.restore();
}
