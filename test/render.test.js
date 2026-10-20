import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Sprites } from '../js/sprites.js';
import { Motor } from '../js/motor.js';
import { EXTRA_MAPS } from '../js/extra-maps.js';
import { encuadrar, TAMANO_BLOQUE } from '../js/camara.js';
import { Rechazo } from '../js/eventos.js';

// Ejecuta la función real de dibujo con un canvas instrumentado.
const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const renderFuente = main.slice(main.indexOf('function render(evento = null)'));
const crearRender = new Function('ctx', 'canvas', 'motor', 'estado', 'sprites',
  'spriteJugador', 'encuadrar', 'TAMANO_BLOQUE', 'Rechazo', 'intento',
  renderFuente + '\nreturn render;');

test('El dibujo real conserva suelo, muros, destinos, cajas y jugador en 32×32 desde el mapa 4', () => {
  const motor = new Motor();
  for (const nivel of EXTRA_MAPS) {
    const llamadas = [];
    const sprites = new Sprites();
    for (const nombre of ['suelo', 'muro', 'destino', 'caja', 'caja_sobre_destino', 'jugador_quieto_0']) {
      sprites.tiles[nombre] = { nombre, width: 32, height: 32 };
    }
    const ctx = new Proxy({}, { get: (_, metodo) => (...args) => {
      llamadas.push([metodo, ...args]);
    }, set: () => true });
    const estado = motor.cargar(nivel.texto);
    const render = crearRender(ctx, { width: 320, height: 240 }, motor, estado,
      sprites, () => 'jugador_quieto_0', encuadrar, TAMANO_BLOQUE, Rechazo, { pasos: 0 });
    render();
    const dibujos = llamadas.filter(([metodo]) => metodo === 'drawImage');
    assert.ok(dibujos.some(([, tile]) => tile.nombre === 'jugador_quieto_0'), nivel.nombre);
    for (const [, tile, x, y, ancho, alto] of dibujos) {
      assert.equal(ancho, 32, `${nivel.nombre}: ${tile.nombre}`);
      assert.equal(alto, 32, `${nivel.nombre}: ${tile.nombre}`);
      assert.ok(Number.isInteger(x) && Number.isInteger(y));
      const jugador = dibujos.find(([, t]) => t.nombre === 'jugador_quieto_0');
      assert.equal((x - jugador[2]) % 32 || 0, 0);
      assert.equal((y - jugador[3]) % 32 || 0, 0);
    }
    assert.ok(llamadas.some(([m, x, y, w, h]) => m === 'rect' && x === 0 && y === 16 && w === 320 && h === 224));
    assert.equal(llamadas.at(-1)[0], 'restore');
  }
});
