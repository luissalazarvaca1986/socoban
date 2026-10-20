import { abrirAlmacen } from './almacen-local.js';
// Resultados locales en IndexedDB: una marca y la última resolución por mapa.
// El texto forma parte de la identidad para no reutilizar marcas si cambia el mapa.
// Normaliza los nombres anteriores para conservar las marcas tras el renombrado.
const normalizarId = id => id.replace(/^(?:AC_Easy_0|capania_0?)(7|8|9|10|11|12|13|15|20)\n/,
  (_, numero) => `campania_${numero.padStart(2, '0')}\n`);
const idMapa = nivel => normalizarId(`${nivel.nombre}\n${nivel.texto.replace(/\r/g, '').trimEnd()}`);
const valido = r => r && Number.isInteger(r.pasos) && r.pasos > 0
  && Number.isFinite(r.tiempoMs) && r.tiempoMs >= 0;

export function formatoTiempo(ms) {
  const segundos = Math.floor(ms / 1000);
  return `${Math.floor(segundos / 60).toString().padStart(2, '0')}:${(segundos % 60).toString().padStart(2, '0')}`;
}

export class Intento {
  pasos = 0;
  #inicio = null;
  #fin = null;
  constructor(reloj = () => performance.now()) { this.reloj = reloj; }
  iniciar() { if (this.#inicio === null) this.#inicio = this.reloj(); }
  avanzar() { if (this.#fin === null) { this.iniciar(); this.pasos++; } }
  get terminado() { return this.#fin !== null; }
  get tiempoMs() { return this.#inicio === null ? 0 : Math.max(0, (this.#fin ?? this.reloj()) - this.#inicio); }
  terminar() {
    this.iniciar();
    if (this.#fin === null) this.#fin = this.reloj();
    return { pasos: this.pasos, tiempoMs: this.tiempoMs, fecha: new Date().toISOString() };
  }
}

export class Progreso {
  #datos = {};
  persistente = true;
  #db = null;
  async cargar() {
    try {
      this.#db = await abrirAlmacen();
      const tx = this.#db.transaction('marcas', 'readonly');
      const solicitud = tx.objectStore('marcas').getAll();
      const filas = await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(solicitud.result);
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
      for (const { id, ...valor } of filas) {
        if (valido(valor.mejor) && valido(valor.ultimo)) this.#datos[normalizarId(id)] = valor;
      }
      this.persistente = true;
    } catch { this.persistente = false; }
  }
  consultar(nivel) { return this.#datos[idMapa(nivel)] ?? null; }
  async guardar(nivel, resultado) {
    if (!valido(resultado)) throw new Error('Resultado inválido');
    const id = idMapa(nivel), previo = this.#datos[id];
    const record = !previo || resultado.pasos < previo.mejor.pasos
      || (resultado.pasos === previo.mejor.pasos && resultado.tiempoMs < previo.mejor.tiempoMs);
    this.#datos[id] = {
      mejor: record ? { ...resultado } : previo.mejor,
      ultimo: { ...resultado },
      completados: (previo?.completados ?? 0) + 1,
    };
    try {
      if (!this.#db) throw new Error('IndexedDB no disponible');
      const tx = this.#db.transaction('marcas', 'readwrite');
      tx.objectStore('marcas').put({ id, ...this.#datos[id] });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
      this.persistente = true;
    } catch { this.persistente = false; }
    return record;
  }
}
