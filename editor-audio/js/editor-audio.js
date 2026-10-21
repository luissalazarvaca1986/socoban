import { leerContenido, guardarContenido, descargarContenido } from '../../js/almacen-local.js';
import { validarSonidos } from '../../js/sonidos-config.js';
// Editor de sonido. Produce el archivo sonidos.json del apendice H.
//
// Clases:
//   NotaPiano     frecuencia de una nota segun notacion cientifica.
//   Acorde        conjunto de notas con una duracion en pulsos.
//   Pista         secuencia de acordes a un BPM, con bandera de bucle.
//   Documento     conjunto de pistas + mapa momento->pista.
//   Reproductor   envoltura de Web Audio API; sintetiza piano simple.
//   Editor        controlador + UI.

// ====================== Nota ========================================
export class NotaPiano {
  // nombre: p.ej. "C4", "F#5", "Bb3"
  static freq(nombre) {
    const m = nombre.match(/^([A-G])(#|b)?(-?\d+)$/);
    if (!m) throw new Error(`Nota invalida: ${nombre}`);
    const [, letra, alt, oct] = m;
    const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letra];
    const alter = alt === '#' ? 1 : alt === 'b' ? -1 : 0;
    // MIDI note numbers: C4 = 60; A4 = 69. f = 440 * 2^((n-69)/12)
    const nMidi = (parseInt(oct, 10) + 1) * 12 + semis + alter;
    return 440 * Math.pow(2, (nMidi - 69) / 12);
  }
}

// ====================== Acorde ======================================
export class Acorde {
  constructor(notas = [], duracion = 1) {
    this.notas = notas;         // array de nombres cientificos
    this.duracion = duracion;   // en pulsos
  }
}

// ====================== Pista =======================================
export class Pista {
  constructor(nombre, { bpm = 120, bucle = false, acordes = [] } = {}) {
    this.nombre = nombre;
    this.bpm = bpm;
    this.bucle = bucle;
    this.acordes = acordes;
  }
  anadirAcorde(acorde) { this.acordes.push(acorde); }
  quitarUltimo() { this.acordes.pop(); }
  duracionTotalSeg() {
    const s = this.acordes.reduce((a, c) => a + c.duracion, 0);
    return s * 60 / this.bpm;
  }
}

// ====================== Documento ===================================
export class Documento {
  constructor() {
    this.pistas = new Map();           // nombre -> Pista
    this.momentos = new Map();         // nombre_momento -> nombre_pista
    this.suscriptores = new Set();
  }
  suscribir(fn) { this.suscriptores.add(fn); return () => this.suscriptores.delete(fn); }
  notificar() { for (const fn of this.suscriptores) fn(); }

  anadirPista(p) { this.pistas.set(p.nombre, p); this.notificar(); return p; }
  renombrarPista(viejo, nuevo) {
    if (viejo === nuevo || !nuevo || this.pistas.has(nuevo)) return false;
    const p = this.pistas.get(viejo);
    this.pistas.delete(viejo);
    p.nombre = nuevo;
    this.pistas.set(nuevo, p);
    for (const [k, v] of this.momentos) if (v === viejo) this.momentos.set(k, nuevo);
    this.notificar(); return true;
  }
  setMomento(nombreMomento, nombrePista) {
    this.momentos.set(nombreMomento, nombrePista);
    this.notificar();
  }

  exportar() {
    const pistas = {};
    for (const [n, p] of this.pistas) {
      pistas[n] = {
        bucle: p.bucle,
        bpm: p.bpm,
        acordes: p.acordes.map(a => ({ notas: a.notas, duracion: a.duracion })),
      };
    }
    const momentos = Object.fromEntries(this.momentos);
    return JSON.stringify({ pistas, momentos }, null, 2);
  }

  static importar(texto) {
    const doc = new Documento();
    const data = validarSonidos(JSON.parse(texto));
    for (const [n, p] of Object.entries(data.pistas || {})) {
      const pista = new Pista(n, {
        bpm: p.bpm ?? 120,
        bucle: !!p.bucle,
        acordes: (p.acordes ?? [{ notas: p.notas, duracion: p.duracion ?? 0.2 }]).map(a => new Acorde(a.notas, a.duracion)),
      });
      doc.anadirPista(pista);
    }
    for (const [k, v] of Object.entries(data.momentos || {})) doc.setMomento(k, v);
    return doc;
  }
}

// ====================== Reproductor =================================
// Sintesis de piano muy simple: una onda triangular + envolvente ADSR
// corta. Suficiente para evaluar acordes sin cargar samples.
export class Reproductor {
  constructor() {
    this.ctx = null;
    this.enCurso = [];
    this.reproduciendo = false;
    this.acordeActual = null;
    this.alCambiarEstado = () => {};
    this.alCambiarAcorde = () => {};
    this._linea = [];
  }
  #asegurarCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  #estado(valor) {
    if (this.reproduciendo === valor) return;
    this.reproduciendo = valor;
    this.alCambiarEstado(valor);
  }
  #acorde(indice) {
    if (this.acordeActual === indice) return;
    this.acordeActual = indice;
    this.alCambiarAcorde(indice);
  }
  detener() { this.detenerBucle(); }
  detenerBucle() {
    clearTimeout(this._bucle);
    clearInterval(this._seguimiento);
    for (const n of this.enCurso) try { n.stop(); } catch {}
    this.enCurso = [];
    this._linea = [];
    this._pista = null;
    this.#acorde(null);
    this.#estado(false);
  }
  #tocarAcorde(acorde, segundosPorPulso, cuando) {
    const ctx = this.ctx;
    const dur = acorde.duracion * segundosPorPulso;
    for (const nombre of acorde.notas) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = NotaPiano.freq(nombre);
      const t0 = cuando, r = Math.max(0.05, dur * 0.2);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.2, t0 + 0.01);
      gain.gain.linearRampToValueAtTime(0.06, t0 + Math.min(0.11, dur));
      gain.gain.setValueAtTime(0.06, t0 + dur);
      gain.gain.linearRampToValueAtTime(0, t0 + dur + r);
      osc.connect(gain).connect(ctx.destination);
      osc.onended = () => { this.enCurso = this.enCurso.filter(n => n !== osc); osc.disconnect(); gain.disconnect(); };
      osc.start(t0);
      osc.stop(t0 + dur + r + 0.05);
      this.enCurso.push(osc);
    }
  }
  #programar(inicio) {
    if (!this._pista || !this.reproduciendo) return;
    const pista = this._pista;
    const segundosPorPulso = 60 / pista.bpm;
    this._linea = this._linea.filter(a => a.fin > this.ctx.currentTime - 1);
    let t = inicio;
    pista.acordes.forEach((a, indice) => {
      const fin = t + a.duracion * segundosPorPulso;
      this._linea.push({ indice, inicio: t, fin });
      this.#tocarAcorde(a, segundosPorPulso, t);
      t = fin;
    });
    const ultima = pista.acordes.at(-1).duracion * segundosPorPulso;
    this._fin = t + Math.max(0.05, ultima * 0.2) + 0.05;
    if (pista.bucle) {
      this._bucle = setTimeout(() => { if (this._pista === pista) this.#programar(t); }, Math.max(25, (t - this.ctx.currentTime - 0.15) * 1000));
    }
  }
  tocarPista(pista) {
    this.detenerBucle();
    if (!pista.acordes.length) return false;
    if (!Number.isFinite(pista.bpm) || pista.bpm <= 0 || pista.acordes.some(a => !Number.isFinite(a.duracion) || a.duracion <= 0)) throw Error('Tempo o duración inválidos.');
    const ctx = this.#asegurarCtx();
    this._pista = { bpm: pista.bpm, bucle: pista.bucle, acordes: pista.acordes.map(a => ({ notas: [...a.notas], duracion: a.duracion })) };
    this.#estado(true);
    this.#programar(ctx.currentTime + 0.05);
    this._seguimiento = setInterval(() => {
      if (ctx.state !== 'running') { this.#acorde(null); return; }
      const ahora = ctx.currentTime;
      this.#acorde(this._linea.find(a => a.inicio <= ahora && ahora < a.fin)?.indice ?? null);
      if (!this._pista.bucle && ahora >= this._fin) this.detenerBucle();
    }, 25);
    return true;
  }
}

// ====================== Editor (UI) =================================
class Editor {
  constructor(root) {
    this.doc = new Documento();
    this.pistaActual = null;
    this.acordeIdx = -1;
    this.rep = new Reproductor();

    this.listaPistas = root.getElementById('lista-pistas');
    this.listaMom = root.getElementById('lista-momentos');
    this.inputNombre = root.getElementById('input-nombre-pista');
    this.inputBpm = root.getElementById('input-bpm');
    this.inputBucle = root.getElementById('input-bucle');
    this.cuerpoAcordes = root.getElementById('cuerpo-acordes');
    this.teclado = root.getElementById('teclado');
    this.btnReproduccion = root.getElementById('btn-reproducir');
    this.indicesReproduccion = null;
    this.rep.alCambiarEstado = activo => this.#estadoReproduccion(activo);
    this.rep.alCambiarAcorde = indice => this.#marcarAcorde(indice);
    this.#estadoReproduccion(false);

    this.#montarTeclado();
    this.#montarAcciones(root);
    this.doc.suscribir(() => this.#refrescar());

    this.#cargar(root);
  }

  async #cargar(root) {
    root.getElementById('btn-guardar-local').disabled = true;
    try {
      const guardado = await leerContenido('sonidos').catch(() => null);
      const data = guardado ?? await (await fetch('../assets/sonidos.json?v=rock32')).json();
      this.doc = Documento.importar(JSON.stringify(data));
      this.doc.suscribir(() => this.#refrescar());
      this.seleccionarPista(this.doc.pistas.keys().next().value);
      root.getElementById('mensaje-audio').textContent = guardado ? 'Sonido personalizado cargado.' : 'Melodía del juego cargada.';
    } catch (error) { root.getElementById('mensaje-audio').textContent = error.message; }
    root.getElementById('btn-guardar-local').disabled = false;
  }

  #montarAcciones(root) {
    const botonPanel = root.getElementById('btn-panel-pistas');
    const panelPistas = root.getElementById('panel-pistas');
    botonPanel.onclick = () => {
      const mostrar = panelPistas.hidden;
      if (!mostrar && panelPistas.contains(root.activeElement)) botonPanel.focus();
      panelPistas.hidden = !mostrar;
      panelPistas.closest('.area').classList.toggle('panel-colapsado', !mostrar);
      botonPanel.setAttribute('aria-expanded', String(mostrar));
      const nombre = mostrar ? 'Ocultar pistas y momentos' : 'Mostrar pistas y momentos';
      botonPanel.title = nombre;
      botonPanel.setAttribute('aria-label', nombre);
      root.getElementById('flecha-panel-pistas').setAttribute('d', mostrar ? 'm17 9-3 3 3 3' : 'm14 9 3 3-3 3');
    };
    root.getElementById('btn-nueva-pista').onclick = () => {
      const n = this.#nuevoNombre('pista');
      this.doc.anadirPista(new Pista(n));
      this.seleccionarPista(n);
    };
    root.getElementById('btn-anadir-acorde').onclick = () => {
      if (!this.pistaActual) return;
      this.pistaActual.anadirAcorde(new Acorde(['C4'], 1));
      this.acordeIdx = this.pistaActual.acordes.length - 1;
      this.doc.notificar();
    };
    root.getElementById('btn-quitar-acorde').onclick = () => {
      if (!this.pistaActual || !this.pistaActual.acordes.length) return;
      this.pistaActual.quitarUltimo();
      this.acordeIdx = Math.min(this.acordeIdx, this.pistaActual.acordes.length - 1);
      this.doc.notificar();
    };
    this.btnReproduccion.onclick = () => {
      if (this.rep.reproduciendo) this.rep.detenerBucle();
      else if (this.pistaActual) this.#reproducir(this.pistaActual);
    };
    root.getElementById('btn-guardar-local').onclick = async () => {
      try {
        const data = validarSonidos(JSON.parse(this.doc.exportar()));
        await guardarContenido('sonidos', data);
        root.getElementById('mensaje-audio').textContent = 'Sonido guardado. Se usará al volver a abrir el juego.';
      } catch (error) { root.getElementById('mensaje-audio').textContent = 'No se guardó: ' + error.message; }
    };
    root.getElementById('btn-restaurar').onclick = async () => {
      try {
        await guardarContenido('sonidos', null);
        await this.#cargar(root);
      } catch (error) { root.getElementById('mensaje-audio').textContent = error.message; }
    };
    root.getElementById('btn-exportar').onclick = () => this.#exportar();
    root.getElementById('btn-importar').onclick = () => root.getElementById('file-importar').click();
    root.getElementById('file-importar').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const texto = await f.text();
      try { this.doc = Documento.importar(texto); }
      catch (error) { root.getElementById('mensaje-audio').textContent = 'Archivo inválido: ' + error.message; return; }
      this.doc.suscribir(() => this.#refrescar());
      const p0 = this.doc.pistas.keys().next().value;
      if (p0) this.seleccionarPista(p0); else this.#refrescar();
    };
    this.inputNombre.oninput = (e) => {
      if (!this.pistaActual) return;
      this.doc.renombrarPista(this.pistaActual.nombre, e.target.value.trim());
    };
    this.inputBpm.oninput = (e) => {
      if (!this.pistaActual) return;
      this.pistaActual.bpm = Number(e.target.value) || 120;
    };
    this.inputBucle.onchange = (e) => {
      if (!this.pistaActual) return;
      this.pistaActual.bucle = e.target.checked;
    };
    root.getElementById('btn-nuevo-momento').onclick = () => {
      const n = prompt('Nombre del momento (p. ej. al_colocar_caja):');
      if (!n) return;
      const primeraPista = this.doc.pistas.keys().next().value;
      if (primeraPista) this.doc.setMomento(n.trim(), primeraPista);
    };
  }

  #montarTeclado() {
    // Dos octavas: C3..B4. Las teclas negras se superponen a la derecha
    // de las blancas correspondientes.
    const blancas = ['C','D','E','F','G','A','B'];
    const negrasTras = new Set(['C','D','F','G','A']);
    const anchoTecla = 40;
    let x = 0;
    for (let oct = 3; oct <= 4; oct++) {
      for (const letra of blancas) {
        const b = this.#crearTecla(letra, oct, false, x);
        this.teclado.appendChild(b);
        if (negrasTras.has(letra)) {
          const n = this.#crearTecla(letra, oct, true, x + anchoTecla - 12);
          this.teclado.appendChild(n);
        }
        x += anchoTecla;
      }
    }
    this.teclado.style.width = (x) + 'px';
  }

  #crearTecla(letra, oct, negra, x) {
    const b = document.createElement('button');
    b.className = 'tecla ' + (negra ? 'negra' : 'blanca');
    b.style.left = negra ? x + 'px' : '';
    const nombre = negra ? `${letra}#${oct}` : `${letra}${oct}`;
    b.dataset.nota = nombre;
    b.textContent = negra ? '' : nombre;
    b.onclick = () => {
      // Tocar siempre al pulsar; si hay acorde seleccionado, añadir/quitar.
      this.#tocarPreview(nombre);
      if (this.pistaActual && this.acordeIdx >= 0) {
        const a = this.pistaActual.acordes[this.acordeIdx];
        const i = a.notas.indexOf(nombre);
        if (i >= 0) a.notas.splice(i, 1);
        else a.notas.push(nombre);
        this.doc.notificar();
      }
    };
    return b;
  }

  #tocarPreview(nombre) {
    this.#reproducir(new Pista('_preview', {
      bpm: 240, acordes: [new Acorde([nombre], 1)]
    }), []);
  }

  seleccionarPista(nombre) {
    this.rep.detenerBucle();
    this.pistaActual = this.doc.pistas.get(nombre) ?? null;
    this.acordeIdx = this.pistaActual && this.pistaActual.acordes.length ? 0 : -1;
    this.#refrescar();
  }

  #refrescar() {
    this.#pintarListaPistas();
    this.#pintarListaMomentos();
    this.#pintarEncabezado();
    this.#pintarAcordes();
  }

  #pintarListaPistas() {
    this.listaPistas.innerHTML = '';
    for (const [n] of this.doc.pistas) {
      const li = document.createElement('li');
      li.textContent = n;
      if (this.pistaActual && n === this.pistaActual.nombre) li.classList.add('sel');
      li.onclick = () => this.seleccionarPista(n);
      this.listaPistas.appendChild(li);
    }
  }

  #pintarListaMomentos() {
    this.listaMom.innerHTML = '';
    for (const [m, p] of this.doc.momentos) {
      const li = document.createElement('li');
      const span = document.createElement('span'); span.textContent = m + '  →  ';
      const sel = document.createElement('select');
      for (const [n] of this.doc.pistas) {
        const o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o);
      }
      sel.value = p;
      sel.onchange = () => this.doc.setMomento(m, sel.value);
      li.appendChild(span); li.appendChild(sel);
      this.listaMom.appendChild(li);
    }
  }

  #pintarEncabezado() {
    if (!this.pistaActual) {
      this.inputNombre.value = ''; this.inputBpm.value = 90; this.inputBucle.checked = false;
      return;
    }
    this.inputNombre.value = this.pistaActual.nombre;
    this.inputBpm.value = this.pistaActual.bpm;
    this.inputBucle.checked = this.pistaActual.bucle;
  }

  #pintarAcordes() {
    this.cuerpoAcordes.innerHTML = '';
    if (!this.pistaActual) return;
    this.pistaActual.acordes.forEach((a, i) => {
      const tr = document.createElement('tr');
      tr.dataset.indice = i;
      if (i === this.acordeIdx) tr.classList.add('sel');
      tr.onclick = () => { this.acordeIdx = i; this.doc.notificar(); };

      const tdI = document.createElement('td'); tdI.textContent = (i + 1).toString();
      const tdN = document.createElement('td');
      a.notas.forEach(n => {
        const chip = document.createElement('span');
        chip.className = 'notas-chip'; chip.textContent = n;
        tdN.appendChild(chip);
      });
      const tdD = document.createElement('td');
      const inp = document.createElement('input'); inp.type = 'number'; inp.min = 0.1; inp.step = 0.1;
      inp.value = a.duracion;
      inp.oninput = (e) => { a.duracion = Number(e.target.value) || 1; };
      tdD.appendChild(inp);
      const tdB = document.createElement('td');
      const btn = document.createElement('button'); btn.textContent = '▶';
      btn.title = 'Reproducir solo este acorde';
      btn.onclick = (e) => { e.stopPropagation(); this.#reproducir(
        new Pista('_a', { bpm: this.pistaActual.bpm, acordes: [a] }), [i]); };
      tdB.appendChild(btn);

      tr.appendChild(tdI); tr.appendChild(tdN); tr.appendChild(tdD); tr.appendChild(tdB);
      this.cuerpoAcordes.appendChild(tr);
    });
    this.#marcarAcorde(this.rep.acordeActual);
  }

  #reproducir(pista, indices = null) {
    this.indicesReproduccion = indices;
    try { this.rep.tocarPista(pista); }
    catch (error) {
      this.rep.detenerBucle();
      document.getElementById('mensaje-audio').textContent = error.message;
    }
  }

  #estadoReproduccion(activo) {
    const nombre = activo ? 'Detener' : 'Reproducir';
    this.btnReproduccion.title = nombre;
    this.btnReproduccion.setAttribute('aria-label', nombre);
    this.btnReproduccion.setAttribute('aria-pressed', String(activo));
    this.btnReproduccion.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${activo ? '<rect x="4" y="4" width="16" height="16" rx="1"/>' : '<path d="m7 3 14 9-14 9V3Z"/>'}</svg>`;
    if (!activo) this.#marcarAcorde(null);
  }

  #marcarAcorde(indice) {
    const activo = indice === null ? null : (this.indicesReproduccion === null ? indice : this.indicesReproduccion[indice]);
    for (const fila of this.cuerpoAcordes.children) {
      const coincide = activo !== null && activo !== undefined && Number(fila.dataset.indice) === activo;
      fila.classList.toggle('reproduciendo', coincide);
      if (coincide) fila.setAttribute('aria-current', 'true');
      else fila.removeAttribute('aria-current');
    }
  }

  #nuevoNombre(prefijo) {
    let n = 1;
    while (this.doc.pistas.has(`${prefijo}_${n}`)) n++;
    return `${prefijo}_${n}`;
  }

  #exportar() {
    descargarContenido('sonidos', JSON.parse(this.doc.exportar()));
  }
}

if (typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => new Editor(document));
}
