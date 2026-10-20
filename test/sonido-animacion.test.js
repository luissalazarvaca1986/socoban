import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Sonido } from '../js/sonido.js';
import { AnimacionJugador } from '../js/animacion-jugador.js';

const config = JSON.parse(readFileSync(new URL('../assets/sonidos.json', import.meta.url)));

test('El fondo arranca aunque el gesto preceda a la carga y reanuda audio suspendido sin duplicar bucles', async () => {
  const originales = { window: globalThis.window, fetch: globalThis.fetch, setTimeout: globalThis.setTimeout };
  let ctx, resolver;
  const inicios = [], timers = [];
  class Contexto {
    state = 'suspended'; currentTime = 0; destination = {};
    constructor() { ctx = this; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { return { frequency: {}, connect() {}, start(t) { inicios.push(t); }, stop() {} }; }
  }
  globalThis.window = { AudioContext: Contexto };
  const respuesta = new Promise(r => { resolver = r; });
  globalThis.fetch = () => respuesta;
  globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  try {
    const sonido = new Sonido();
    const carga = sonido.cargar();
    sonido.iniciar(); sonido.iniciarFondo();
    assert.equal(ctx.state, 'running');
    assert.equal(inicios.length, 0);
    resolver({ ok: true, json: async () => config }); await carga;
    assert.ok(inicios.length > 0);
    assert.equal(timers.length, 1);
    const notas = inicios.length;
    ctx.state = 'suspended'; sonido.iniciar(); sonido.iniciarFondo();
    assert.equal(ctx.state, 'running');
    assert.equal(inicios.length, notas);
    assert.equal(timers.length, 1);
    // La segunda vuelta se programa en el reloj de audio, sin hueco.
    const duracion = config.pistas.fondo.acordes.reduce((s, a) => s + a.duracion * 60 / config.pistas.fondo.bpm, 0);
    assert.ok(duracion > 40);
    ctx.currentTime = duracion - 0.12;
    timers[0].fn();
    assert.ok(Math.abs(inicios[notas] - (0.03 + duracion)) < 1e-8);
  } finally { Object.assign(globalThis, originales); }
});

test('Cada movimiento anima un solo paso de 240 ms, alterna apoyo y termina al frente', () => {
  const anim = new AnimacionJugador();
  const sprites = { animacion: () => [['jugador_oeste_0', 120], ['jugador_oeste_b', 120], ['jugador_oeste_a', 120], ['jugador_oeste_b', 120]] };
  anim.mover('oeste', 0);
  assert.equal(anim.cuadro(sprites, 0), 'jugador_oeste_b');
  assert.equal(anim.cuadro(sprites, 119), 'jugador_oeste_b');
  assert.equal(anim.cuadro(sprites, 120), 'jugador_oeste_a');
  assert.equal(anim.cuadro(sprites, 239), 'jugador_oeste_a');
  assert.equal(anim.cuadro(sprites, 240), 'jugador_quieto_0');
  assert.equal(anim.cuadro(sprites, 600), 'jugador_quieto_0');
  anim.mover('oeste', 700);
  assert.equal(anim.cuadro(sprites, 700), 'jugador_oeste_b');
  assert.equal(anim.cuadro(sprites, 820), 'jugador_oeste_0');
  assert.equal(anim.cuadro(sprites, 940), 'jugador_quieto_0');
  anim.mover('oeste', 1000);
  anim.mover('oeste', 1050);
  assert.equal(anim.cuadro(sprites, 1290), 'jugador_quieto_0');
  anim.detener();
  assert.equal(anim.cuadro(sprites, 1800), 'jugador_quieto_0');
});


test('Un paso respeta las duraciones personalizadas sin repetir la secuencia', () => {
  const anim = new AnimacionJugador();
  const sprites = { animacion: () => [['base', 120], ['cruce', 180], ['apoyo', 150]] };
  anim.mover('este', 0);
  assert.equal(anim.cuadro(sprites, 179), 'cruce');
  assert.equal(anim.cuadro(sprites, 180), 'apoyo');
  assert.equal(anim.cuadro(sprites, 329), 'apoyo');
  assert.equal(anim.cuadro(sprites, 330), 'jugador_quieto_0');
});
