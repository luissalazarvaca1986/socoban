// Un paso por movimiento aceptado: cruce y apoyo, 120 ms por pose.
export class AnimacionJugador {
  direccion = 'sur';
  #inicio = null;
  #apoyo = 0;

  mover(direccion, ahora) {
    if (direccion !== this.direccion) this.#apoyo = 0;
    this.direccion = direccion;
    this.#apoyo = 1 - this.#apoyo;
    this.#inicio = ahora;
  }

  detener() { this.#inicio = null; }

  cuadro(sprites, ahora) {
    const quieto = 'jugador_quieto_0';
    if (this.#inicio === null) return quieto;
    const sec = sprites.animacion(`trotar_${this.direccion}`);
    if (!sec?.length) return quieto;
    const cruce = sec[1] ?? sec[0];
    const apoyo = sec[this.#apoyo ? 2 : 0] ?? sec[0];
    const tiempo = frame => Number.isFinite(frame[1]) && frame[1] > 0 ? frame[1] : 120;
    const duracionCruce = tiempo(cruce);
    const transcurrido = ahora - this.#inicio;
    if (transcurrido >= duracionCruce + tiempo(apoyo)) { this.detener(); return quieto; }
    // Solo cruce y un apoyo; los originales usan 120 ms por fotograma.
    return transcurrido < duracionCruce ? cruce[0] : apoyo[0];
  }
}
