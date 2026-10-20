import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const texto = readFileSync(new URL('../assets/sprites.txt', import.meta.url), 'utf8');
const tiles = Object.fromEntries([...texto.matchAll(/^# (jugador_\w+)\n((?:[^\n]{32}\n){32})/gm)].map(m => [m[1], m[2].trimEnd().split('\n')]));

test('Las 13 poses mantienen 32×32 y el cuerpo no tiene huecos transparentes encerrados', () => {
  assert.equal(Object.keys(tiles).length, 13);
  for (const [nombre, filas] of Object.entries(tiles)) {
    assert.equal(filas.length, 32);
    assert.ok(filas.every(f => f.length === 32), nombre);
    const exterior = new Set();
    const pendientes = [];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if ((y === 0 || y === 31 || x === 0 || x === 31) && filas[y][x] === '.') pendientes.push([y, x]);
    }
    while (pendientes.length) {
      const [y, x] = pendientes.pop();
      const clave = `${y},${x}`;
      if (exterior.has(clave)) continue;
      exterior.add(clave);
      for (const [dy, dx] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < 32 && xx >= 0 && xx < 32 && filas[yy][xx] === '.' && !exterior.has(`${yy},${xx}`)) pendientes.push([yy, xx]);
      }
    }
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (filas[y][x] === '.') assert.ok(exterior.has(`${y},${x}`), `${nombre}: hueco en ${y},${x}`);
    }
    assert.equal(filas[0][0], '.', `${nombre}: se mantiene el fondo transparente`);
  }
});

test('Cabeza y torso permanecen estables entre pasos, sin cambiar de personaje ni invertirlo', () => {
  for (const dir of ['norte','sur','este','oeste']) {
    const base = tiles[`jugador_${dir}_0`];
    for (const fase of ['a','b']) {
      const lateral = ['este', 'oeste'].includes(dir);
      const cintura = lateral ? 19 : 26;
      assert.deepEqual(tiles[`jugador_${dir}_${fase}`].slice(0, cintura), base.slice(0, cintura), dir);
      if (lateral) {
        const pecho = filas => filas.slice(19, 22).map(f => (dir === 'oeste' ? f : [...f].reverse().join('')).slice(13, 19));
        assert.deepEqual(pecho(tiles[`jugador_${dir}_${fase}`]), pecho(base), `${dir}: pecho estable`);
      }
      assert.notDeepEqual(tiles[`jugador_${dir}_${fase}`], base, `${dir}: existe movimiento`);
    }
  }
  assert.deepEqual(tiles.jugador_sur_0, tiles.jugador_quieto_0);
  for (const [, tiempo] of texto.matchAll(/^\s+jugador_\w+\s*:\s*(\d+)/gm)) assert.equal(Number(tiempo), 120);
});

test('Todas las poses tienen un contorno negro de un píxel, incluidas las manos', () => {
  assert.match(texto, /^K\s+000000$/m);
  for (const [nombre, filas] of Object.entries(tiles)) {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (filas[y][x] === '.') continue;
      const borde = [[-1,0],[1,0],[0,-1],[0,1]].some(([dy,dx]) => {
        const yy = y + dy, xx = x + dx;
        return yy < 0 || yy >= 32 || xx < 0 || xx >= 32 || filas[yy][xx] === '.';
      });
      if (borde) assert.equal(filas[y][x], 'K', `${nombre}: borde en ${y},${x}`);
    }
  }
});

test('La marcha lateral alterna apoyo y cruce de piernas con zancada visible en ambos perfiles', () => {
  const anchoApoyo = filas => {
    const xs = filas.slice(30).flatMap(f => [...f].flatMap((ch, x) => ch === '.' ? [] : [x]));
    return Math.max(...xs) - Math.min(...xs) + 1;
  };
  for (const dir of ['este', 'oeste']) {
    const apoyo = tiles[`jugador_${dir}_a`], cruce = tiles[`jugador_${dir}_b`];
    assert.ok(anchoApoyo(apoyo) >= anchoApoyo(cruce) + 5, `${dir}: piernas abiertas y apoyo recogido`);
    assert.notDeepEqual(tiles[`jugador_${dir}_0`].slice(27), apoyo.slice(27), `${dir}: cambia la pierna adelantada`);
  }
  for (const fase of ['0', 'a', 'b']) {
    assert.deepEqual(tiles[`jugador_oeste_${fase}`],
      tiles[`jugador_este_${fase}`].map(f => [...f].reverse().join('')));
  }
});


test('Las correcciones del autor conservan camisa y eliminan el apéndice bajo el brazo', () => {
  assert.equal(tiles.jugador_oeste_0[20][20], 'L', 'Manga blanca en apoyo');
  assert.equal(tiles.jugador_oeste_b[19][22], 'L', 'Manga blanca durante el cruce');
  for (const fase of ['0', 'a', 'b']) {
    const espalda = tiles[`jugador_norte_${fase}`];
    assert.ok(espalda.slice(16, 19).every(f => !f.includes('X')), 'Camisa en vez de piel en la espalda');
    for (const dir of ['este', 'oeste']) {
      const filas = tiles[`jugador_${dir}_${fase}`];
      for (const fila of filas.slice(25)) {
        assert.ok((fila.match(/[^.]+/g) ?? []).length <= 2, `${dir}/${fase}: solo dos piernas, sin píxeles sueltos`);
      }
    }
  }
});
