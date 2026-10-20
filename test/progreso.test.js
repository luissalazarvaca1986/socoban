import test from 'node:test';
import assert from 'node:assert/strict';
import { Intento, Progreso, formatoTiempo } from '../js/progreso.js';
import { descargarContenido } from '../js/almacen-local.js';

test('El intento empieza con el primer gesto y congela el tiempo al completar', () => {
  let ahora = 1000;
  const intento = new Intento(() => ahora);
  assert.equal(intento.tiempoMs, 0);
  intento.iniciar(); intento.avanzar();
  ahora = 2500; intento.avanzar();
  assert.equal(intento.tiempoMs, 1500);
  const marca = intento.terminar();
  ahora = 9000; intento.avanzar();
  assert.equal(intento.pasos, 2);
  assert.equal(intento.tiempoMs, marca.tiempoMs);
  assert.equal(new Intento().pasos, 0);
  assert.equal(formatoTiempo(125999), '02:05');
});

test('Prioriza pasos, desempata por tiempo y conserva progreso si no hay IndexedDB', async () => {
  const progreso = new Progreso(); await progreso.cargar();
  const nivel = { nombre: 'Prueba', texto: '#####\n#@$.#\n#####' };
  assert.equal(await progreso.guardar(nivel, { pasos: 10, tiempoMs: 1000 }), true);
  assert.equal(await progreso.guardar(nivel, { pasos: 11, tiempoMs: 10 }), false);
  assert.equal(await progreso.guardar(nivel, { pasos: 9, tiempoMs: 9000 }), true);
  assert.equal(await progreso.guardar(nivel, { pasos: 9, tiempoMs: 8000 }), true);
  assert.equal(await progreso.guardar(nivel, { pasos: 9, tiempoMs: 8500 }), false);
  assert.deepEqual(progreso.consultar(nivel).mejor, { pasos: 9, tiempoMs: 8000 });
  assert.deepEqual(progreso.consultar(nivel).ultimo, { pasos: 9, tiempoMs: 8500 });
  assert.equal(progreso.consultar({ ...nivel, texto: nivel.texto + '\n#' }), null);
  assert.equal(progreso.persistente, false);
});

test('La descarga rechaza marcas y exportaciones de base de datos', () => {
  assert.throws(() => descargarContenido('records', {}));
  assert.throws(() => descargarContenido('marcas', {}));
  assert.throws(() => descargarContenido('base', {}));
});


test('Los nueve nombres campania conservan las marcas anteriores sin mezclar tableros', async () => {
  const progreso = new Progreso(); await progreso.cargar();
  for (const numero of [7, 8, 9, 10, 11, 12, 13, 15, 20]) {
    const texto = '#####\n#@$.#\n#####';
    const anterior = { nombre: `AC_Easy_0${numero}`, texto };
    const actual = { nombre: `campania_${String(numero).padStart(2, '0')}`, texto };
    await progreso.guardar(anterior, { pasos: numero, tiempoMs: 1000 });
    assert.equal(progreso.consultar(actual).mejor.pasos, numero);
    await progreso.guardar(actual, { pasos: numero - 1, tiempoMs: 1200 });
    assert.equal(progreso.consultar(actual).completados, 2);
    const errata = { ...actual, nombre: `capania_${String(numero).padStart(2, '0')}` };
    assert.equal(progreso.consultar(errata).mejor.pasos, numero - 1);
    await progreso.guardar(errata, { pasos: numero - 2, tiempoMs: 900 });
    assert.equal(progreso.consultar(actual).completados, 3);
    assert.equal(progreso.consultar(actual).mejor.pasos, numero - 2);
    assert.equal(progreso.consultar({ ...actual, texto: texto + '\n#' }), null);
  }
});
