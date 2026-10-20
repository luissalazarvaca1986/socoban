// Jerarquia de eventos del motor.
//
// Patron: cada evento es una clase. La presentacion decide que hacer
// con cada tipo usando instanceof. Esto es mas robusto que un string
// discriminante: un typo en 'movimineto' falla silenciosamente, pero
// una clase inexistente da un error de referencia inmediato.

export class Evento {
  constructor() {
    if (new.target === Evento) {
      throw new TypeError('Evento es abstracta.');
    }
    // No se congela aqui: cada subclase decide sus campos y congela
    // tras asignarlos. Un freeze aqui impediria a las subclases añadir
    // propiedades (new.target != Evento).
  }
}

export class Movimiento extends Evento {
  constructor(nuevaPosAlmacenero) {
    super();
    this.tipo = 'movimiento';
    this.nuevaPosAlmacenero = nuevaPosAlmacenero;
    Object.freeze(this);
  }
}

export class Empuje extends Evento {
  constructor(nuevaPosAlmacenero, nuevaPosCaja) {
    super();
    this.tipo = 'empuje';
    this.nuevaPosAlmacenero = nuevaPosAlmacenero;
    this.nuevaPosCaja = nuevaPosCaja;
    Object.freeze(this);
  }
}

export class Rechazo extends Evento {
  constructor(motivo) {
    super();
    this.tipo = 'rechazo';
    this.motivo = motivo; // 'pared' | 'caja_bloqueada' | 'fuera_del_tablero'
    Object.freeze(this);
  }
}

export class Deshecho extends Evento {
  constructor(estadoRestaurado) {
    super();
    this.tipo = 'deshecho';
    this.estadoRestaurado = estadoRestaurado;
    Object.freeze(this);
  }
}

export class SinCambios extends Evento {
  constructor() {
    super();
    this.tipo = 'sin_cambios';
    Object.freeze(this);
  }
}

export class NivelCompleto extends Evento {
  constructor(movimientosRealizados) {
    super();
    this.tipo = 'nivel_completo';
    this.movimientosRealizados = movimientosRealizados;
    Object.freeze(this);
  }
}
