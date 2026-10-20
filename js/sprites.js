// Carga y renderizado de los sprites del juego.
//
// Lee el archivo plano del apendice H (Codigo/assets/sprites.txt),
// parsea paleta, tiles y animaciones, y expone:
//
//   sprites.dibujar(ctx, nombre, x, y) - pinta un tile por nombre
//   sprites.animacion(nombre)          - devuelve [[tile, ms], ...]
//
// Las animaciones son nombres que empiezan por @ en el archivo: un
// nombre por linea, y una lista de "tile : ms" indentada debajo.

import { leerContenido } from './almacen-local.js';
import { TILE, parseSprites, validarSpritesJuego } from './formato-sprites.js';

function tileACanvas(filas, paleta) {
  const c = document.createElement('canvas');
  c.width = TILE; c.height = TILE;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(TILE, TILE);
  for (let f = 0; f < TILE; f++) {
    for (let col = 0; col < TILE; col++) {
      const ch = filas[f][col];
      const color = paleta[ch];
      const i = (f * TILE + col) * 4;
      if (!color) { img.data[i + 3] = 0; continue; }
      img.data[i] = parseInt(color.slice(1, 3), 16);
      img.data[i + 1] = parseInt(color.slice(3, 5), 16);
      img.data[i + 2] = parseInt(color.slice(5, 7), 16);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export class Sprites {
  tiles = {};
  animaciones = {};
  TILE = TILE;

  async cargar(ruta = 'assets/sprites.txt') {
    const r = await fetch(ruta);
    if (!r.ok) throw Error('No se pudieron cargar los sprites del juego.');
    const texto = await r.text();
    let datos = parseSprites(texto);
    const propios = await leerContenido('sprites').catch(() => null);
    if (propios) {
      try { datos = validarSpritesJuego(propios, datos); }
      catch (error) { console.warn('Sprites personalizados inválidos; se usa el original.', error); }
    }
    const { paleta, tiles, animaciones } = datos;
    this.tiles = {};
    for (const [n, filas] of Object.entries(tiles)) {
      this.tiles[n] = tileACanvas(filas, paleta);
    }
    this.animaciones = animaciones;
    return this;
  }

  dibujar(ctx, nombre, x, y) {
    const c = this.tiles[nombre];
    if (!c) return false;
    // Todos los elementos usan siempre la misma celda de 32×32.
    ctx.drawImage(c, x, y, TILE, TILE);
    return true;
  }

  animacion(nombre) { return this.animaciones[nombre] ?? null; }

  get listo() { return Object.keys(this.tiles).length > 0; }
}
