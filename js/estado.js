// Estado del juego.
//
// Estructura inmutable: toda operacion sobre un Estado devuelve uno
// nuevo. Los Sets internos se congelan al construir para que un callback
// descuidado no los mute por error. La pila de jugadas se gestiona
// aqui para habilitar deshacer sin exponer su estructura.

export class Jugada {
  // Lo minimo para deshacer una jugada aplicada. Interna del motor.
  constructor({ direccion, posAlmaceneroAntes, huboEmpuje, posCajaAntes, posCajaDespues }) {
    this.direccion = direccion;
    this.posAlmaceneroAntes = posAlmaceneroAntes;
    this.huboEmpuje = huboEmpuje;
    this.posCajaAntes = posCajaAntes;
    this.posCajaDespues = posCajaDespues;
    Object.freeze(this);
  }
}

// Clave canonica para un par (fila, columna) usada en Sets.
export const clavePos = (f, c) => `${f},${c}`;

export class Estado {
  constructor({ paredes, destinos, almacenero, cajas, pila = [], movimientos = 0 }) {
    this.paredes = Object.freeze(new Set(paredes));
    this.destinos = Object.freeze(new Set(destinos));
    this.almacenero = Object.freeze([...almacenero]);
    this.cajas = Object.freeze(new Set(cajas));
    this.pila = Object.freeze([...pila]);
    this.movimientos = movimientos;
    Object.freeze(this);
  }

  esPared(f, c) { return this.paredes.has(clavePos(f, c)); }
  esDestino(f, c) { return this.destinos.has(clavePos(f, c)); }
  hayCaja(f, c) { return this.cajas.has(clavePos(f, c)); }

  esEstadoCompleto() {
    // Victoria: cada caja esta sobre un destino.
    for (const k of this.cajas) if (!this.destinos.has(k)) return false;
    return this.cajas.size === this.destinos.size;
  }
}
