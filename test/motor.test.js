// Las 11 pruebas del motor: 7 del cap. 4 §4.4 y 4 del cap. 6 §6.3.
//
// Se corren con:
//   node --test test/

import test from 'node:test';
import assert from 'node:assert/strict';

import { Motor } from '../js/motor.js';
import { Niveles } from '../js/niveles.js';
import { NORTE, SUR, ESTE, OESTE, DIRECCIONES } from '../js/direccion.js';
import {
  Movimiento, Empuje, Rechazo, Deshecho, NivelCompleto,
} from '../js/eventos.js';

const motor = new Motor();

// --- 7 pruebas de reglas (cap. 4 §4.4) ------------------------------

test('1. Movimiento valido', () => {
  const nivel = Niveles.parse(
    '#####\n' +
    '#   #\n' +
    '# @ #\n' +
    '#   #\n' +
    '#####\n'
  );
  const [nuevo, ev] = motor.jugar(nivel, NORTE);
  assert.ok(ev instanceof Movimiento);
  assert.deepEqual(nuevo.almacenero, [1, 2]);
  assert.deepEqual([...nuevo.cajas], [...nivel.cajas]);
});

test('2. Movimiento contra pared', () => {
  const nivel = Niveles.parse(
    '#####\n' +
    '#@. #\n' +
    '# $ #\n' +
    '#####\n'
  );
  const [nuevo, ev] = motor.jugar(nivel, OESTE);
  assert.ok(ev instanceof Rechazo);
  assert.equal(ev.motivo, 'pared');
  assert.deepEqual(nuevo.almacenero, nivel.almacenero);
});

test('3. Empuje valido', () => {
  const nivel = Niveles.parse(
    '######\n' +
    '# @$.#\n' +
    '######\n'
  );
  // Jugador (1,2) empuja caja (1,3) hacia ESTE hasta (1,4), destino.
  const [nuevo, ev] = motor.jugar(nivel, ESTE);
  assert.ok(ev instanceof NivelCompleto); // destino -> victoria inmediata
  assert.deepEqual(nuevo.almacenero, [1, 3]);
  assert.ok(nuevo.cajas.has('1,4'));
});

test('4. Empuje bloqueado por pared', () => {
  const nivel = Niveles.parse(
    '#####\n' +
    '#$@.#\n' +
    '#####\n'
  );
  const [nuevo, ev] = motor.jugar(nivel, OESTE);
  assert.ok(ev instanceof Rechazo);
  assert.equal(ev.motivo, 'caja_bloqueada');
  assert.deepEqual(nuevo.almacenero, nivel.almacenero);
});

test('5. Dos cajas en linea no se empujan', () => {
  const nivel = Niveles.parse(
    '########\n' +
    '# ..$$@#\n' +
    '########\n'
  );
  const [, ev] = motor.jugar(nivel, OESTE);
  assert.ok(ev instanceof Rechazo);
  assert.equal(ev.motivo, 'caja_bloqueada');
});

test('6. Victoria', () => {
  const nivel = Niveles.parse(
    '#####\n' +
    '#@$.#\n' +
    '#####\n'
  );
  const [nuevo, ev] = motor.jugar(nivel, ESTE);
  assert.ok(ev instanceof NivelCompleto);
  assert.equal(ev.movimientosRealizados, 1);
  assert.ok(motor.completo(nuevo));
});

test('7. Deshacer restaura estado anterior exacto', () => {
  const nivel = Niveles.parse(
    '#####\n' +
    '# . #\n' +
    '# @ #\n' +
    '# $ #\n' +
    '#####\n'
  );
  const [despuesMover, evMover] = motor.jugar(nivel, NORTE);
  assert.ok(evMover instanceof Movimiento);
  assert.deepEqual(despuesMover.almacenero, [1, 2]);
  const [restaurado, evDeshacer] = motor.deshacer(despuesMover);
  assert.ok(evDeshacer instanceof Deshecho);
  assert.deepEqual(restaurado.almacenero, nivel.almacenero);
  assert.equal(restaurado.movimientos, 0);
});

// --- 4 pruebas de motor (cap. 6 §6.3) ------------------------------

test('8. Reproducibilidad', () => {
  const txt =
    '######\n' +
    '#    #\n' +
    '# .  #\n' +
    '# $@ #\n' +
    '######\n';
  const secuencia = [NORTE, ESTE, SUR, OESTE, OESTE];
  const correr = () => {
    let estado = Niveles.parse(txt);
    for (const d of secuencia) [estado] = motor.jugar(estado, d);
    return estado;
  };
  const a = correr();
  const b = correr();
  assert.deepEqual(a.almacenero, b.almacenero);
  assert.deepEqual([...a.cajas].sort(), [...b.cajas].sort());
  assert.equal(a.movimientos, b.movimientos);
});

test('9. Simetria del deshacer', () => {
  const nivel = Niveles.parse(
    '######\n' +
    '# .  #\n' +
    '# $@ #\n' +
    '######\n'
  );
  for (const d of DIRECCIONES) {
    const [nuevo, ev] = motor.jugar(nivel, d);
    if (ev instanceof Movimiento || ev instanceof Empuje || ev instanceof NivelCompleto) {
      const [restaurado] = motor.deshacer(nuevo);
      assert.deepEqual(restaurado.almacenero, nivel.almacenero,
        `tras ${d.nombre}, no restaura almacenero`);
      assert.deepEqual([...restaurado.cajas].sort(), [...nivel.cajas].sort(),
        `tras ${d.nombre}, no restaura cajas`);
      assert.equal(restaurado.movimientos, 0);
    }
  }
});

test('10. Nivel ejemplar: completable con secuencia conocida', () => {
  const nivel = Niveles.parse(
    '######\n' +
    '#@$. #\n' +
    '######\n'
  );
  const [nuevo, ev] = motor.jugar(nivel, ESTE);
  assert.ok(ev instanceof NivelCompleto);
  assert.ok(motor.completo(nuevo));
  assert.equal(ev.movimientosRealizados, 1);
});

test('11. Nivel bloqueable y deshacer disponible', () => {
  const nivel = Niveles.parse(
    '######\n' +
    '# $@.#\n' +
    '######\n'
  );
  // OESTE empuja la caja a (1,1), contra pared N (fila 0) y O (col 0).
  const [atascado, ev] = motor.jugar(nivel, OESTE);
  assert.ok(ev instanceof Empuje);
  assert.ok(atascado.cajas.has('1,1'));
  // La caja no sale de la esquina con ninguna jugada:
  for (const d of DIRECCIONES) {
    const [siguiente] = motor.jugar(atascado, d);
    assert.ok(siguiente.cajas.has('1,1'),
      `la caja salio de (1,1) al mover ${d.nombre}`);
  }
  // Pero deshacer la devuelve.
  const [restaurado, evDeshacer] = motor.deshacer(atascado);
  assert.ok(evDeshacer instanceof Deshecho);
  assert.deepEqual([...restaurado.cajas].sort(), [...nivel.cajas].sort());
});
