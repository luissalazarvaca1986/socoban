export const TILE = 32;

// Formato común a juego y editor. Rechaza documentos parciales o corruptos.
export function parseSprites(texto) {
  if (typeof texto !== 'string') throw Error('El documento de sprites debe ser texto.');
  const paleta = Object.create(null), tiles = Object.create(null), animaciones = Object.create(null);
  let modo, nombre, filas = [];
  const cerrar = () => {
    if (modo === 'tile') {
      if (filas.length !== TILE) throw Error(`El tile «${nombre}» debe medir 32×32.`);
      tiles[nombre] = filas;
    }
    filas = [];
  };
  for (const linea of texto.split(/\r?\n/)) {
    if (!linea.trim()) { cerrar(); modo = null; continue; }
    if (linea === '! paleta') { cerrar(); modo = 'paleta'; continue; }
    if ((modo !== 'paleta' && linea.startsWith('# ')) || linea.startsWith('@ ')) {
      cerrar(); modo = linea[0] === '#' ? 'tile' : 'anim'; nombre = linea.slice(2).trim();
      const tabla = modo === 'tile' ? tiles : animaciones;
      if (!nombre || Object.hasOwn(tabla, nombre)) throw Error('Nombre de recurso vacío o repetido.');
      if (modo === 'anim') animaciones[nombre] = [];
      continue;
    }
    if (modo === 'paleta') {
      const m = linea.match(/^(\S)\s+(transparente|[0-9a-fA-F]{6})\s*$/);
      if (!m) throw Error('Color de paleta inválido.');
      paleta[m[1]] = m[2] === 'transparente' ? null : '#' + m[2];
    } else if (modo === 'tile') {
      if (linea.length !== TILE) throw Error(`El tile «${nombre}» debe medir 32×32.`);
      filas.push(linea);
    } else if (modo === 'anim') {
      const m = linea.trim().match(/^(\S+)\s*:\s*(\d+)$/);
      if (!m || Number(m[2]) <= 0) throw Error('Fotograma o duración inválidos.');
      animaciones[nombre].push([m[1], Number(m[2])]);
    } else throw Error('Línea fuera de un recurso.');
  }
  cerrar();
  if (!Object.keys(tiles).length) throw Error('No hay tiles en el documento.');
  if (!Object.hasOwn(paleta, '.') || paleta['.'] !== null) throw Error('Falta el color transparente.');
  for (const filas of Object.values(tiles)) for (const fila of filas) for (const ch of fila) {
    if (!Object.hasOwn(paleta, ch)) throw Error(`Color «${ch}» fuera de la paleta.`);
  }
  for (const frames of Object.values(animaciones)) for (const [tile] of frames) {
    if (!Object.hasOwn(tiles, tile)) throw Error(`El fotograma «${tile}» no existe.`);
  }
  return { paleta, tiles, animaciones };
}

export function validarSpritesJuego(texto, base) {
  const datos = parseSprites(texto);
  for (const nombre of Object.keys(base.tiles)) {
    if (!Object.hasOwn(datos.tiles, nombre)) throw Error(`Conserva el tile «${nombre}» que usa el juego.`);
  }
  for (const nombre of Object.keys(base.animaciones)) {
    if (!datos.animaciones[nombre]?.length) throw Error(`Conserva la animación «${nombre}» del juego.`);
  }
  return datos;
}
