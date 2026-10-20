import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listar, guardar, listarUsuario, validar, cargarUsuario } from '../js/niveles-almacen.js';
import { Motor } from '../js/motor.js';

const datos = new Map();
globalThis.localStorage = {
  getItem: clave => datos.get(clave) ?? null,
  setItem: (clave, valor) => datos.set(clave, valor),
};

test('Campaña: tutoriales 1–3 y retos 4–23 en el formato conservado', () => {
  datos.clear();
  const niveles = listar();
  assert.equal(niveles.length, 23);
  assert.deepEqual(niveles.slice(0, 3).map(n => n.nombre),
    ['Tutorial', 'Primer empuje', 'Dos simetricas']);
  assert.equal(niveles[2].texto, '########\n#.    .#\n#$    $#\n#      #\n#  @   #\n########\n');
  const xml = readFileSync(new URL('../assets/niveles/extra-maps.slc.txt', import.meta.url), 'utf8');
  const originales = [...xml.matchAll(/<Level Id="([^"]+)"[^>]*>([\s\S]*?)<\/Level>/g)];
  assert.equal(originales.length, 20);
  originales.forEach(([, nombre, contenido], i) => {
    const texto = [...contenido.matchAll(/<L>(.*?)<\/L>/g)].map(m => m[1]).join('\n') + '\n';
    assert.equal(niveles[i + 3].nombre, nombre);
    assert.equal(niveles[i + 3].texto, texto, nombre);
  });
  const motor = new Motor();
  for (const nivel of niveles) {
    assert.equal(validar(nivel.texto), null, nivel.nombre);
    assert.doesNotThrow(() => motor.cargar(nivel.texto), nivel.nombre);
  }
});

test('Los mapas del editor no alteran los 23 mapas de la campaña', async () => {
  datos.clear();
  const texto = '#####\n#@$.#\n#####\n';
  datos.set('socoban_niveles_v1', JSON.stringify([{ nombre: 'Personal', texto }]));
  await cargarUsuario();
  assert.equal(listar().length, 23);
  assert.equal(listarUsuario()[0].texto, texto);
  datos.clear();
});
