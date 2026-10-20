import test from 'node:test';
import assert from 'node:assert/strict';
import { encuadrar, TAMANO_BLOQUE } from '../js/camara.js';
import { EXTRA_MAPS } from '../js/extra-maps.js';

test('La cámara centra mapas pequeños sin reducir bloques', () => {
  assert.equal(TAMANO_BLOQUE, 32);
  assert.deepEqual(encuadrar(6, 8, [3, 4]), { x: 32, y: 32 });
});

test('La cámara sigue al jugador y se detiene en los cuatro bordes', () => {
  assert.deepEqual(encuadrar(32, 25, [0, 0]), { x: -0, y: 16 });
  assert.deepEqual(encuadrar(32, 25, [16, 12]), { x: -240, y: -400 });
  assert.deepEqual(encuadrar(32, 25, [31, 24]), { x: -480, y: -784 });
  // Regresar al estado anterior (deshacer/reiniciar) restaura el encuadre.
  assert.deepEqual(encuadrar(32, 25, [16, 12]), { x: -240, y: -400 });
});

test('En los 20 mapas adicionales, cualquier posición mantiene al jugador visible y respeta el HUD', () => {
  for (const nivel of EXTRA_MAPS) {
    const filas = nivel.texto.trimEnd().split('\n');
    const ancho = Math.max(...filas.map(f => f.length));
    for (let f = 0; f < filas.length; f++) for (let c = 0; c < ancho; c++) {
      const { x, y } = encuadrar(filas.length, ancho, [f, c]);
      const px = x + c * 32, py = y + f * 32;
      assert.ok(px >= 0 && px + 32 <= 320, nivel.nombre);
      assert.ok(py >= 16 && py + 32 <= 240, nivel.nombre);
      assert.ok(Number.isInteger(x) && Number.isInteger(y));
      if (ancho * 32 > 320) assert.ok(x <= 0 && x + ancho * 32 >= 320);
      if (filas.length * 32 > 224) assert.ok(y <= 16 && y + filas.length * 32 >= 240);
    }
  }
});
