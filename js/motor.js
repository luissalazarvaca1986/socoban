// Motor del juego. Contrato del apendice C del libro: cinco metodos
// publicos, cinco (seis con SinCambios) eventos.
//
// Patrones de diseño aplicados y por que:
//
//   - Observer: suscribir/notificar en el propio motor evita que la
//     presentacion tenga que preguntar activamente despues de cada jugada.
//     Las jugadas internas (programaticas) tambien emiten, lo que permite
//     reutilizar la presentacion para pruebas visuales sin cambios.
//
//   - Command (implicito en Jugada): cada jugada aplicada se guarda en
//     la pila del Estado. deshacer() consume la cima. La estructura es
//     la que hace que deshacer sea "gratis": no se recomputa el estado
//     anterior desde cero, se restaura.
//
//   - Facade: el objeto Motor es la unica superficie publica. La
//     presentacion no necesita conocer Direccion, Evento, Estado por
//     separado, aunque los expone para quien quiera.
//
//   - Pureza: cada metodo recibe estado y devuelve estado nuevo.
//     No hay estado mutable interno del motor (la lista de suscriptores
//     es la unica excepcion, y es parte del contrato Observer).

import { Estado, Jugada, clavePos } from './estado.js';
import { Niveles } from './niveles.js';
import {
  Movimiento, Empuje, Rechazo, Deshecho, SinCambios, NivelCompleto
} from './eventos.js';

export class Motor {
  #suscriptores = new Set();

  // --- Observer -----------------------------------------------------
  suscribir(fn) {
    this.#suscriptores.add(fn);
    return () => this.#suscriptores.delete(fn);
  }

  #notificar(evento) {
    for (const fn of this.#suscriptores) fn(evento);
  }

  // --- 1. Cargar ----------------------------------------------------
  cargar(nivelTexto) {
    return Niveles.parse(nivelTexto);
  }

  // --- 2. Jugar -----------------------------------------------------
  jugar(estado, direccion) {
    const [f, c] = estado.almacenero;
    const [df, dc] = [direccion.df, direccion.dc];
    const destino = [f + df, c + dc];

    if (estado.esPared(destino[0], destino[1])) {
      const ev = new Rechazo('pared');
      this.#notificar(ev);
      return [estado, ev];
    }

    if (estado.hayCaja(destino[0], destino[1])) {
      const siguiente = [destino[0] + df, destino[1] + dc];
      if (estado.esPared(siguiente[0], siguiente[1]) ||
          estado.hayCaja(siguiente[0], siguiente[1])) {
        const ev = new Rechazo('caja_bloqueada');
        this.#notificar(ev);
        return [estado, ev];
      }
      // Empuje valido.
      const nuevasCajas = new Set(estado.cajas);
      nuevasCajas.delete(clavePos(destino[0], destino[1]));
      nuevasCajas.add(clavePos(siguiente[0], siguiente[1]));
      const jugada = new Jugada({
        direccion,
        posAlmaceneroAntes: estado.almacenero,
        huboEmpuje: true,
        posCajaAntes: destino,
        posCajaDespues: siguiente,
      });
      const nuevo = new Estado({
        paredes: estado.paredes,
        destinos: estado.destinos,
        almacenero: destino,
        cajas: nuevasCajas,
        pila: [...estado.pila, jugada],
        movimientos: estado.movimientos + 1,
      });
      if (nuevo.esEstadoCompleto()) {
        const ev = new NivelCompleto(nuevo.movimientos);
        this.#notificar(ev);
        return [nuevo, ev];
      }
      const ev = new Empuje(destino, siguiente);
      this.#notificar(ev);
      return [nuevo, ev];
    }

    // Movimiento sin empuje.
    const jugada = new Jugada({
      direccion,
      posAlmaceneroAntes: estado.almacenero,
      huboEmpuje: false,
      posCajaAntes: [0, 0],
      posCajaDespues: [0, 0],
    });
    const nuevo = new Estado({
      paredes: estado.paredes,
      destinos: estado.destinos,
      almacenero: destino,
      cajas: estado.cajas,
      pila: [...estado.pila, jugada],
      movimientos: estado.movimientos + 1,
    });
    const ev = new Movimiento(destino);
    this.#notificar(ev);
    return [nuevo, ev];
  }

  // --- 3. Deshacer --------------------------------------------------
  deshacer(estado) {
    if (!estado.pila.length) {
      const ev = new SinCambios();
      this.#notificar(ev);
      return [estado, ev];
    }
    const ultima = estado.pila[estado.pila.length - 1];
    let nuevasCajas = estado.cajas;
    if (ultima.huboEmpuje) {
      nuevasCajas = new Set(estado.cajas);
      nuevasCajas.delete(clavePos(ultima.posCajaDespues[0], ultima.posCajaDespues[1]));
      nuevasCajas.add(clavePos(ultima.posCajaAntes[0], ultima.posCajaAntes[1]));
    }
    const restaurado = new Estado({
      paredes: estado.paredes,
      destinos: estado.destinos,
      almacenero: ultima.posAlmaceneroAntes,
      cajas: nuevasCajas,
      pila: estado.pila.slice(0, -1),
      movimientos: estado.movimientos - 1,
    });
    const ev = new Deshecho(restaurado);
    this.#notificar(ev);
    return [restaurado, ev];
  }

  // --- 4. Estado actual (vista inmutable para la presentacion) ------
  estadoActual(estado) {
    return Object.freeze({
      paredes: estado.paredes,
      destinos: estado.destinos,
      almacenero: estado.almacenero,
      cajas: estado.cajas,
      cajasSobreDestino: new Set([...estado.cajas].filter(k => estado.destinos.has(k))),
      movimientos: estado.movimientos,
    });
  }

  // --- 5. Completo --------------------------------------------------
  completo(estado) {
    return estado.esEstadoCompleto();
  }
}
