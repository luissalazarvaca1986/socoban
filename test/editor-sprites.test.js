import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Documento, Tile } from '../editor/js/editor.js';
import { parseSprites, validarSpritesJuego } from '../js/formato-sprites.js';
import { validarNombreNuevo } from '../js/niveles-almacen.js';

const texto = readFileSync(new URL('../assets/sprites.txt', import.meta.url), 'utf8');
const base = parseSprites(texto);

test('El editor conserva los 18 tiles nativos, la paleta y las animaciones al importar/exportar', () => {
  const doc = Documento.importar(texto);
  assert.equal(doc.tiles.size, 18);
  assert.deepEqual(parseSprites(doc.exportar()), base);
  const tile = doc.tiles.get('suelo');
  tile.pinta(31, 31, 'K');
  assert.equal(parseSprites(doc.exportar()).tiles.suelo[31][31], 'K');
  assert.equal(new Tile('nuevo').filas.length, 32);
});

test('Una personalización inválida no sustituye recursos obligatorios del juego', () => {
  const doc = Documento.importar(texto);
  doc.borrarTile('suelo');
  assert.throws(() => validarSpritesJuego(doc.exportar(), base), /Conserva el tile/);
  assert.throws(() => parseSprites(texto.replace(base.tiles.suelo[0], 'x'.repeat(32))), /fuera de la paleta/);
  assert.throws(() => parseSprites(texto.replace(base.tiles.suelo[0], '.'.repeat(16))), /32×32/);
});

test('Las copias de mapas exigen nombre nuevo sin colisiones con la campaña', () => {
  assert.match(validarNombreNuevo('  TUTORIAL  '), /Cambia el nombre/);
  assert.ok(validarNombreNuevo('  '));
  assert.equal(validarNombreNuevo('Mi tutorial alternativo'), null);
});
