import { leerContenido, guardarContenido } from '../../js/almacen-local.js';
import { parseSprites, validarSpritesJuego } from '../../js/formato-sprites.js';

// Editor de sprites. Produce el archivo plano del apendice H del libro.
//
// Clases:
//   Paleta       dicta que colores se pueden usar (deliberadamente limitada).
//   Tile         matriz 32x32 de indices a la paleta.
//   Animacion    lista nombrada de (tile, duracion_ms).
//   Documento    conjunto de tiles y animaciones; se exporta e importa.
//   Editor       controlador que une el documento con la UI.
//
// Patrones:
//   - Command (implicito): cada pincelada es un cambio puntual sobre el
//     tile actual; podria extenderse a undo/redo futuro.
//   - Observer: el Documento notifica cambios para que las vistas se
//     refresquen sin acoplarse al editor.

// ====================== Paleta ======================================
export class Paleta {
  // Constructor: lista de pares [caracter, color]. El '.' siempre existe
  // y significa "sin pintar" (transparente). Los demas colores se dibujan
  // tal cual.
  constructor(entradas) {
    this.entradas = [['.', null], ...entradas.filter(([k]) => k !== '.')];
    this.map = new Map(this.entradas);
  }
  colorDe(ch) { return this.map.get(ch) ?? null; }
  caracteres() { return this.entradas.map(([k]) => k); }
}

// Paleta de arranque; se sustituye por la paleta del documento — se puede sustituir luego.
export const PALETA_DEFECTO = new Paleta([
  ['#', '#1a1c2c'],  // negro
  ['O', '#111122'],  // contorno
  ['S', '#29366f'],  // sombra
  ['B', '#3b5dc9'],  // base
  ['H', '#41a6f6'],  // brillo
  ['A', '#73eff7'],  // acento
  ['V', '#38b764'],  // verde
  ['Y', '#ffcd75'],  // amarillo
  ['R', '#b13e53'],  // rojo
  ['P', '#a7f070'],  // verde claro
  ['M', '#94b0c2'],  // marmol claro
  ['N', '#566c86'],  // gris
  ['L', '#f4f4f4'],  // claro
  ['W', '#ffffff'],  // blanco
  ['T', '#8b5a2b'],  // marron (caja)
  ['Z', '#333c57'],  // azul oscuro
]);

// ====================== Tile ========================================
export class Tile {
  // Matriz 32x32 de caracteres (indices a paleta). El punto es
  // transparente. Nombre unico.
  constructor(nombre, filas = null) {
    this.nombre = nombre;
    this.filas = filas ?? Array.from({ length: 32 }, () => '.'.repeat(32));
  }
  get(f, c) { return this.filas[f][c]; }
  pinta(f, c, ch) {
    const fila = this.filas[f];
    this.filas[f] = fila.slice(0, c) + ch + fila.slice(c + 1);
  }
  clonar(nombre) { return new Tile(nombre, [...this.filas]); }
}

// ====================== Animacion ===================================
export class Animacion {
  constructor(nombre, fotogramas = []) {
    this.nombre = nombre;
    // Cada fotograma: { tile: <nombre>, duracionMs: <n> }.
    this.fotogramas = fotogramas;
  }
  anadir(tileNombre, duracionMs = 120) {
    this.fotogramas.push({ tile: tileNombre, duracionMs });
  }
  quitarUltimo() { this.fotogramas.pop(); }
}

// ====================== Documento ===================================
export class Documento {
  constructor(paleta = PALETA_DEFECTO) {
    this.paleta = paleta;
    this.tiles = new Map();          // nombre -> Tile
    this.animaciones = new Map();    // nombre -> Animacion
    this.suscriptores = new Set();
  }
  suscribir(fn) { this.suscriptores.add(fn); return () => this.suscriptores.delete(fn); }
  notificar() { for (const fn of this.suscriptores) fn(); }

  anadirTile(tile) { this.tiles.set(tile.nombre, tile); this.notificar(); return tile; }
  borrarTile(nombre) {
    this.tiles.delete(nombre);
    for (const a of this.animaciones.values()) {
      a.fotogramas = a.fotogramas.filter(f => f.tile !== nombre);
    }
    this.notificar();
  }
  anadirAnimacion(anim) { this.animaciones.set(anim.nombre, anim); this.notificar(); return anim; }

  tilesOrdenados() {
    return [...this.tiles].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }

  // Exporta a texto plano segun el apendice H.
  exportar() {
    const lineas = ['! paleta'];
    for (const [k, color] of this.paleta.entradas) {
      lineas.push(`${k}  ${color === null ? 'transparente' : color.replace('#', '')}`);
    }
    lineas.push('');
    for (const [, tile] of this.tilesOrdenados()) {
      lineas.push(`# ${tile.nombre}`);
      lineas.push(...tile.filas);
      lineas.push('');
    }
    for (const anim of this.animaciones.values()) {
      lineas.push(`@ ${anim.nombre}`);
      for (const f of anim.fotogramas) {
        lineas.push(`  ${f.tile} : ${f.duracionMs}`);
      }
      lineas.push('');
    }
    return lineas.join('\n');
  }

  // Importa desde texto plano. Reinicia el documento.
  static importar(texto) {
    const datos = parseSprites(texto);
    const doc = new Documento(new Paleta(Object.entries(datos.paleta)));
    for (const [nombre, filas] of Object.entries(datos.tiles)) doc.anadirTile(new Tile(nombre, filas));
    for (const [nombre, frames] of Object.entries(datos.animaciones)) {
      doc.anadirAnimacion(new Animacion(nombre, frames.map(([tile, duracionMs]) => ({ tile, duracionMs }))));
    }
    return doc;
  }
}

// ====================== Editor (controlador + vista) =================
class Editor {
  constructor(root) {
    this.doc = new Documento();
    this.tileActual = null;
    this.animActual = null;
    this.colorActual = '#';   // caracter de la paleta

    this.lienzo = root.getElementById('lienzo');
    this.ctxLienzo = this.lienzo.getContext('2d');
    this.listaTiles = root.getElementById('lista-tiles');
    this.listaAnim = root.getElementById('lista-animaciones');
    this.inputNombre = root.getElementById('input-nombre');
    this.inputDur = root.getElementById('input-duracion');
    this.paletaDiv = root.getElementById('paleta');
    this.nombreH2 = root.getElementById('nombre-actual');

    this.#montarPaleta();
    this.#montarAcciones(root);
    this.#montarLienzo();

    this.doc.suscribir(() => this.#refrescar());

    this.mensaje = root.getElementById('mensaje-sprites');
    this.guardarBtn = root.getElementById('btn-guardar-local');
    this.guardarBtn.disabled = true;
    this.#cargar();
  }

  #usarDocumento(doc) {
    this.doc = doc;
    this.tileActual = null;
    this.animActual = null;
    this.doc.suscribir(() => this.#refrescar());
    this.#montarPaleta();
    this.seleccionarTile(Object.keys(this.base.tiles).sort()[0]);
  }

  async #cargar(original = false) {
    try {
      const respuesta = await fetch('../assets/sprites.txt?v=correcciones3');
      if (!respuesta.ok) throw Error('No se pudieron cargar los tiles del juego.');
      const texto = await respuesta.text();
      this.base = parseSprites(texto);
      this.baseTexto = texto;
      let propio = null;
      let aviso = '';
      if (!original) {
        try { propio = await leerContenido('sprites'); }
        catch { aviso = ' No se pudo leer IndexedDB.'; }
      }
      if (propio) {
        try { validarSpritesJuego(propio, this.base); }
        catch { propio = null; aviso = ' La copia personalizada no es válida; se cargó el original.'; }
      }
      this.#usarDocumento(Documento.importar(propio || texto));
      this.mensaje.textContent = (propio ? 'Tiles personalizados cargados.' : 'Tiles actuales del juego cargados.') + aviso;
      this.guardarBtn.disabled = false;
    } catch (error) { this.mensaje.textContent = error.message; }
  }

  #montarPaleta() {
    this.paletaDiv.innerHTML = '';
    for (const [ch, color] of this.doc.paleta.entradas) {
      const b = document.createElement('button');
      b.className = 'swatch' + (color === null ? ' transparente' : '');
      if (color !== null) b.style.background = color;
      b.title = `${ch} (${color ?? 'transparente'})`;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', `Color ${ch}`);
      b.addEventListener('click', () => {
        this.colorActual = ch;
        [...this.paletaDiv.children].forEach(c => c.classList.toggle('sel', c === b));
      });
      if (ch === this.colorActual) b.classList.add('sel');
      this.paletaDiv.appendChild(b);
    }
  }

  #montarAcciones(root) {
    root.getElementById('btn-guardar-local').onclick = async () => {
      this.guardarBtn.disabled = true;
      try {
        if (!this.inputDur.disabled) {
          const duracion = Number(this.inputDur.value);
          if (!Number.isFinite(duracion) || duracion < 10) throw Error('La duración debe ser de al menos 10 ms.');
          for (const frame of this.#fotogramasSeleccionados()) frame.duracionMs = duracion;
        }
        const texto = this.doc.exportar();
        validarSpritesJuego(texto, this.base);
        await guardarContenido('sprites', texto);
        this.mensaje.textContent = 'Tiles guardados. Se usarán al volver al juego.';
      } catch (error) { this.mensaje.textContent = 'No se guardó: ' + error.message; }
      finally { this.guardarBtn.disabled = false; }
    };
    root.getElementById('btn-restaurar').onclick = async () => {
      try {
        await guardarContenido('sprites', null);
        await this.#cargar(true);
      } catch (error) { this.mensaje.textContent = 'No se restauró: ' + error.message; }
    };
    root.getElementById('btn-borrar').onclick = async () => {
      if (!this.tileActual || !this.base) return;
      const nombre = this.tileActual.nombre;
      try {
        const texto = await leerContenido('sprites');
        const guardado = Documento.importar(texto || this.baseTexto);
        if (Object.hasOwn(this.base.tiles, nombre)) {
          guardado.anadirTile(new Tile(nombre, [...this.base.tiles[nombre]]));
          for (const [animacion, frames] of Object.entries(this.base.animaciones)) {
            frames.forEach(([tile, duracionMs], i) => {
              if (tile === nombre) guardado.animaciones.get(animacion).fotogramas[i].duracionMs = duracionMs;
            });
          }
        } else guardado.borrarTile(nombre);
        const limpio = guardado.exportar();
        validarSpritesJuego(limpio, this.base);
        await guardarContenido('sprites', limpio);
        if (Object.hasOwn(this.base.tiles, nombre)) {
          this.doc.anadirTile(new Tile(nombre, [...this.base.tiles[nombre]]));
          for (const [animacion, frames] of Object.entries(this.base.animaciones)) {
            frames.forEach(([tile, duracionMs], i) => {
              if (tile === nombre) this.doc.animaciones.get(animacion).fotogramas[i].duracionMs = duracionMs;
            });
          }
          this.seleccionarTile(nombre);
        } else {
          this.doc.borrarTile(nombre);
          this.seleccionarTile(Object.keys(this.base.tiles).sort()[0]);
        }
        this.mensaje.textContent = 'Personalización eliminada. El tile original vuelve a estar disponible.';
      } catch (error) { this.mensaje.textContent = 'No se eliminó: ' + error.message; }
    };
    root.getElementById('btn-exportar').onclick = () => this.#exportar();
    root.getElementById('btn-importar').onclick = () => root.getElementById('file-importar').click();
    root.getElementById('file-importar').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const texto = await f.text();
      try {
        const importado = Documento.importar(texto);
        validarSpritesJuego(texto, this.base);
        if ([...importado.tiles.keys()].some(n => !Object.hasOwn(this.base.tiles, n)) || [...importado.animaciones.keys()].some(n => !Object.hasOwn(this.base.animaciones, n))) throw Error('Usa solo los tiles y animaciones del juego.');
        for (const [nombre, frames] of Object.entries(this.base.animaciones)) {
          if (JSON.stringify(importado.animaciones.get(nombre).fotogramas.map(f => f.tile)) !== JSON.stringify(frames.map(f => f[0]))) throw Error('Conserva los fotogramas de cada animación.');
        }
        this.#usarDocumento(importado);
        this.mensaje.textContent = 'Importado. Guarda para usarlo en el juego.';
      } catch (error) { this.mensaje.textContent = 'No se importó: ' + error.message; }
    };
  }

  #montarLienzo() {
    const pintarEn = (e, borrar) => {
      const r = this.lienzo.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) * 32 / r.width);
      const y = Math.floor((e.clientY - r.top) * 32 / r.height);
      if (x < 0 || y < 0 || x > 31 || y > 31 || !this.tileActual) return;
      this.tileActual.pinta(y, x, borrar ? '.' : this.colorActual);
      this.#pintarLienzo();
        this.#pintarListaTiles();
    };
    let pintando = false;
    let borrar = false;
    this.lienzo.addEventListener('pointerdown', (e) => {
      pintando = true; borrar = e.button === 2 || e.altKey;
      this.lienzo.setPointerCapture(e.pointerId);
      pintarEn(e, borrar);
    });
    this.lienzo.addEventListener('pointermove', (e) => { if (pintando) pintarEn(e, borrar); });
    this.lienzo.addEventListener('pointerup', () => pintando = false);
    this.lienzo.addEventListener('pointercancel', () => pintando = false);
    this.lienzo.addEventListener('lostpointercapture', () => pintando = false);
    this.lienzo.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  seleccionarTile(nombre) {
    this.tileActual = this.doc.tiles.get(nombre) ?? null;
    this.animActual = null;
    this.inputNombre.value = this.tileActual?.nombre ?? '';
    this.nombreH2.textContent = this.tileActual?.nombre ?? '—';
    this.#actualizarDuracion();
    this.#refrescar();
  }

  seleccionarAnim(nombre) {
    this.animActual = this.doc.animaciones.get(nombre) ?? null;
    this.nombreH2.textContent = this.animActual
      ? `${this.animActual.nombre}  (animación)`
      : (this.tileActual?.nombre ?? '—');
    this.#actualizarDuracion();
    this.#refrescar();
  }

  #fotogramasSeleccionados() {
    if (this.animActual) return this.animActual.fotogramas;
    return [...this.doc.animaciones.values()].flatMap(a => a.fotogramas).filter(f => f.tile === this.tileActual?.nombre);
  }

  #actualizarDuracion() {
    const frames = this.#fotogramasSeleccionados();
    this.inputDur.disabled = !frames.length;
    this.inputDur.value = frames[0]?.duracionMs ?? 120;
  }

  #refrescar() {
    this.#pintarLienzo();
    this.#pintarListaTiles();
    this.#pintarListaAnim();
  }

  #pintarLienzo() {
    this.ctxLienzo.clearRect(0, 0, 32, 32);
    if (!this.tileActual) return;
    for (let f = 0; f < 32; f++) for (let c = 0; c < 32; c++) {
      const col = this.doc.paleta.colorDe(this.tileActual.get(f, c));
      if (col) { this.ctxLienzo.fillStyle = col; this.ctxLienzo.fillRect(c, f, 1, 1); }
    }
  }

  #pintarListaTiles() {
    this.listaTiles.innerHTML = '';
    for (const [nombre, tile] of this.doc.tilesOrdenados()) {
      if (this.base && !Object.hasOwn(this.base.tiles, nombre)) continue;
      const li = document.createElement('li');
      li.title = nombre;
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.setAttribute('aria-label', nombre);
      li.addEventListener('keydown', e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); this.seleccionarTile(nombre); } });
      if (this.tileActual && nombre === this.tileActual.nombre) li.classList.add('sel');
      li.appendChild(this.#miniaturaTile(tile, 48));
      li.addEventListener('click', () => this.seleccionarTile(nombre));
      this.listaTiles.appendChild(li);
    }
  }

  #pintarListaAnim() {
    this.listaAnim.innerHTML = '';
    for (const [nombre] of this.doc.animaciones) {
      if (this.base && !Object.hasOwn(this.base.animaciones, nombre)) continue;
      const li = document.createElement('li');
      li.textContent = nombre;
      if (this.animActual && this.animActual.nombre === nombre) li.classList.add('sel');
      li.addEventListener('click', () => this.seleccionarAnim(nombre));
      this.listaAnim.appendChild(li);
    }
  }

  #miniaturaTile(tile, px) {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    c.style.width = `${px}px`; c.style.height = `${px}px`;
    c.style.imageRendering = 'pixelated';
    const g = c.getContext('2d');
    for (let f = 0; f < 32; f++) for (let x = 0; x < 32; x++) {
      const col = this.doc.paleta.colorDe(tile.get(f, x));
      if (col) { g.fillStyle = col; g.fillRect(x, f, 1, 1); }
    }
    return c;
  }

  #exportar() {
    const texto = this.doc.exportar();
    const blob = new Blob([texto], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sprites.txt';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
}

// Arranque: solo en navegador.
if (typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => new Editor(document));
}
