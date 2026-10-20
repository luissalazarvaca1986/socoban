// Lectura y escritura de niveles en el formato estandar de Sokoban
// (apendice B del libro).
//
// Simbolos:
//   #  pared
//      suelo vacio (espacio)
//   .  destino
//   $  caja
//   *  caja sobre destino
//   @  almacenero
//   +  almacenero sobre destino

import { Estado, clavePos } from './estado.js';

export class Niveles {
  // parse: texto -> Estado inicial.
  // Lanza Error si no cumple el formato.
  static parse(texto) {
    const lineas = texto.split(/\r?\n/);
    while (lineas.length && !lineas[0].trim()) lineas.shift();
    while (lineas.length && !lineas[lineas.length - 1].trim()) lineas.pop();
    if (!lineas.length) throw new Error('Nivel vacio.');

    const paredes = new Set();
    const destinos = new Set();
    const cajas = new Set();
    let almacenero = null;

    for (let f = 0; f < lineas.length; f++) {
      const linea = lineas[f];
      for (let c = 0; c < linea.length; c++) {
        const ch = linea[c];
        const k = clavePos(f, c);
        switch (ch) {
          case '#': paredes.add(k); break;
          case ' ': break;
          case '.': destinos.add(k); break;
          case '$': cajas.add(k); break;
          case '*': cajas.add(k); destinos.add(k); break;
          case '@':
            if (almacenero) throw new Error('Mas de un almacenero.');
            almacenero = [f, c];
            break;
          case '+':
            if (almacenero) throw new Error('Mas de un almacenero.');
            almacenero = [f, c];
            destinos.add(k);
            break;
          default:
            throw new Error(`Caracter invalido '${ch}' en (${f},${c}).`);
        }
      }
    }
    if (!almacenero) throw new Error('No hay almacenero.');
    if (cajas.size !== destinos.size) {
      throw new Error(
        `Cajas (${cajas.size}) y destinos (${destinos.size}) no coinciden.`
      );
    }
    return new Estado({ paredes, destinos, almacenero, cajas });
  }

  // serializa: Estado -> texto (para pruebas y depuracion).
  static serializar(estado) {
    const ocupadas = [
      ...estado.paredes, ...estado.destinos, ...estado.cajas,
      clavePos(estado.almacenero[0], estado.almacenero[1])
    ];
    if (!ocupadas.length) return '';
    const coords = ocupadas.map(k => k.split(',').map(Number));
    const maxF = Math.max(...coords.map(([f]) => f));
    const maxC = Math.max(...coords.map(([, c]) => c));
    const filas = [];
    for (let f = 0; f <= maxF; f++) {
      let fila = '';
      for (let c = 0; c <= maxC; c++) {
        const esAlm = estado.almacenero[0] === f && estado.almacenero[1] === c;
        if (estado.esPared(f, c)) fila += '#';
        else if (esAlm && estado.esDestino(f, c)) fila += '+';
        else if (esAlm) fila += '@';
        else if (estado.hayCaja(f, c) && estado.esDestino(f, c)) fila += '*';
        else if (estado.hayCaja(f, c)) fila += '$';
        else if (estado.esDestino(f, c)) fila += '.';
        else fila += ' ';
      }
      filas.push(fila);
    }
    return filas.join('\n');
  }

  // nivelMaqueta: el nivel de referencia del libro (apendice B).
  static maqueta() {
    return Niveles.parse(
      '########\n' +
      '#      #\n' +
      '# .$   #\n' +
      '# .$@  #\n' +
      '# .$   #\n' +
      '########\n'
    );
  }
}
