// Direccion: valor inmutable con nombre y vector unitario (df, dc).
//
// Es intencionadamente una clase y no un enum literal: cuatro instancias
// unicas publicadas como constantes. Comparar direcciones es por identidad
// (===), lo que evita el error clasico de comparar strings o tuplas.

export class Direccion {
  #nombre;
  #df;
  #dc;

  constructor(nombre, df, dc) {
    this.#nombre = nombre;
    this.#df = df;
    this.#dc = dc;
    Object.freeze(this);
  }

  get nombre() { return this.#nombre; }
  get df() { return this.#df; }
  get dc() { return this.#dc; }

  toString() { return `Direccion(${this.#nombre})`; }
}

export const NORTE = new Direccion('norte', -1,  0);
export const SUR   = new Direccion('sur',    1,  0);
export const ESTE  = new Direccion('este',   0,  1);
export const OESTE = new Direccion('oeste',  0, -1);

export const DIRECCIONES = Object.freeze([NORTE, SUR, ESTE, OESTE]);
