import { leerContenido } from './almacen-local.js';
// Reproduccion de sonido con la Web Audio API.
//
// Lee assets/sonidos.json (apendice H del libro) y expone dos operaciones:
//
//   - disparar(momento): reproduce la pista asociada al momento.
//   - iniciarFondo():    arranca la musica de fondo en bucle.
//
// El navegador exige un gesto del usuario antes de que un AudioContext
// pueda sonar; por eso `iniciar()` se invoca desde el primer input.

const NOTAS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function frecuencia(nota) {
  // Notacion cientifica: letra, [#|b], octava. C4 = 261.63 Hz.
  const letra = nota[0];
  let i = 1;
  let semi = NOTAS[letra];
  if (nota[i] === '#') { semi += 1; i += 1; }
  else if (nota[i] === 'b') { semi -= 1; i += 1; }
  const octava = parseInt(nota.slice(i), 10);
  const semiA4 = (octava - 4) * 12 + semi - NOTAS.A;
  return 440 * Math.pow(2, semiA4 / 12);
}

export class Sonido {
  #ctx = null;
  #master = null;
  #masterFondo = null;
  #config = null;
  #fondoTimer = null;
  #iniciado = false;
  #silenciado = false;
  #fondoSolicitado = false;

  async cargar(ruta = 'assets/sonidos.json') {
    const personalizado = await leerContenido('sonidos').catch(() => null);
    const r = personalizado ? null : await fetch(ruta);
    if (r && !r.ok) throw new Error(`No se pudo cargar el sonido (${r.status}).`);
    this.#config = personalizado ?? await r.json();
    if (this.#fondoSolicitado && this.#iniciado) this.iniciarFondo();
  }

  // El AudioContext solo arranca tras un gesto del usuario.
  iniciar() {
    if (this.#iniciado) {
      if (this.#ctx.state === 'suspended') this.#ctx.resume().catch(() => {});
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.#ctx = new Ctx();
    this.#master = this.#ctx.createGain();
    this.#master.gain.value = this.#silenciado ? 0 : 0.5;
    this.#master.connect(this.#ctx.destination);
    this.#masterFondo = this.#ctx.createGain();
    this.#masterFondo.gain.value = 0.25;
    this.#masterFondo.connect(this.#master);
    this.#iniciado = true;
    if (this.#ctx.state === 'suspended') this.#ctx.resume().catch(() => {});
  }

  silenciar(valor) {
    this.#silenciado = valor;
    if (this.#master) {
      this.#master.gain.value = valor ? 0 : 0.5;
    }
  }

  get silenciado() { return this.#silenciado; }

  disparar(momento) {
    if (!this.#iniciado || !this.#config) return;
    const nombrePista = this.#config.momentos?.[momento];
    if (!nombrePista) return;
    const pista = this.#config.pistas?.[nombrePista];
    if (!pista) return;
    if (pista.bucle) {
      this.#reproducirBucle(pista);
    } else {
      this.#reproducirPista(pista, this.#master);
    }
  }

  iniciarFondo() {
    this.#fondoSolicitado = true;
    this.disparar('al_cargar_nivel');
  }

  // --- interno ------------------------------------------------------

  #reproducirBucle(pista) {
    if (this.#fondoTimer !== null) return;
    let siguiente = this.#ctx.currentTime + 0.03;
    const ejecutar = () => {
      siguiente = Math.max(siguiente, this.#ctx.currentTime);
      const duracionCiclo = this.#reproducirPista(pista, this.#masterFondo, siguiente);
      siguiente += duracionCiclo;
      this.#fondoTimer = setTimeout(ejecutar, Math.max(100, (siguiente - this.#ctx.currentTime - 0.15) * 1000));
    };
    ejecutar();
  }

  #reproducirPista(pista, destinoGain, inicio = this.#ctx.currentTime) {
    const ctx = this.#ctx;
    const bpm = pista.bpm ?? 120;
    const segundosPorPulso = 60 / bpm;
    let t = inicio;
    let total = 0;
    const acordes = pista.acordes ?? [{ notas: pista.notas, duracion: pista.duracion ?? 0.2 }];
    for (const acorde of acordes) {
      const d = acorde.duracion * segundosPorPulso;
      for (const nombre of acorde.notas) {
        const f = frecuencia(nombre);
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.7 / Math.sqrt(acorde.notas.length), t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + d);
        osc.connect(g);
        g.connect(destinoGain);
        osc.start(t);
        osc.stop(t + d + 0.02);
      }
      t += d;
      total += d;
    }
    return total;
  }
}
