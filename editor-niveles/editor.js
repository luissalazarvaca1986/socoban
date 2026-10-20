import { Sprites } from '../js/sprites.js?v=paleta16';
// Editor de niveles del Sokoban.
//
// Modelo: una matriz (filas x cols) de caracteres XSB.
//   '#' muro, ' ' suelo, '.' destino, '$' caja, '*' caja sobre destino,
//   '@' jugador, '+' jugador sobre destino.
//
// Interaccion: el usuario escoge un tile en la paleta y lo aplica
// pulsando una celda. "Borrar" vuelve la celda a suelo.
//
// Al colocar el jugador, se asegura que no quede otro en el mapa.
// Al guardar, se valida con niveles-almacen.validar().

import { listar, listarUsuario, guardar, eliminar, validar, validarNombreNuevo, cargarUsuario } from '../js/niveles-almacen.js?v=personalizados1';

const inputAncho = document.getElementById('ancho');
const inputAlto  = document.getElementById('alto');
const btnAplicar = document.getElementById('aplicar-tam');
const btnLimpiar = document.getElementById('limpiar');
const paleta     = document.getElementById('paleta');
const mapaEl     = document.getElementById('mapa');
const inputNombre= document.getElementById('nombre');
const btnGuardar = document.getElementById('btn-guardar');
const mensajeEl  = document.getElementById('mensaje');
const listaEl    = document.getElementById('lista');
const selector = document.getElementById('elegir-mapa');

let herramienta = '#';
let ancho = 10, alto = 8;
let mapa  = [];
let sprites;

// -------------------------------------------------------------------
// Mapa en memoria
// -------------------------------------------------------------------
function nuevoMapaVacio(w, h) {
  const m = [];
  for (let f = 0; f < h; f++) {
    const fila = [];
    for (let c = 0; c < w; c++) {
      // Marco de muros, interior suelo. Es el punto de partida mas
      // probable y evita que el usuario tenga que trazar un rectangulo.
      const borde = (f === 0 || f === h - 1 || c === 0 || c === w - 1);
      fila.push(borde ? '#' : ' ');
    }
    m.push(fila);
  }
  return m;
}

function redimensionar(w, h) {
  const anterior = mapa;
  mapa = nuevoMapaVacio(w, h);
  // Preserva lo que cabe
  for (let f = 0; f < Math.min(anterior.length, h); f++) {
    for (let c = 0; c < Math.min(anterior[f].length, w); c++) {
      if (f === 0 || c === 0 || f === h - 1 || c === w - 1) continue;
      mapa[f][c] = anterior[f][c];
    }
  }
  ancho = w; alto = h;
  pintar();
}

function pintar() {
  mapaEl.style.gridTemplateColumns = `repeat(${ancho}, var(--celda))`;
  mapaEl.innerHTML = '';
  for (let f = 0; f < alto; f++) {
    for (let c = 0; c < ancho; c++) {
      const celda = document.createElement('div');
      celda.className = 'celda';
      celda.dataset.ch = mapa[f][c];
      celda.dataset.f = String(f);
      celda.dataset.c = String(c);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 32;
      canvas.setAttribute('aria-hidden', 'true');
      celda.appendChild(canvas);
      dibujarCelda(celda);
      mapaEl.appendChild(celda);
    }
  }
}

// Composición nativa: suelo, destino y entidad, igual que en el juego.
function dibujarCelda(celda) {
  const ctx = celda.querySelector('canvas').getContext('2d');
  ctx.clearRect(0, 0, 32, 32);
  ctx.imageSmoothingEnabled = false;
  if (!sprites) return;
  const ch = celda.dataset.ch;
  sprites.dibujar(ctx, 'suelo', 0, 0);
  if ('.*+'.includes(ch)) sprites.dibujar(ctx, 'destino', 0, 0);
  const tile = { '#': 'muro', '$': 'caja', '*': 'caja_sobre_destino',
    '@': 'jugador_quieto_0', '+': 'jugador_quieto_0' }[ch];
  if (tile) sprites.dibujar(ctx, tile, 0, 0);
}

function actualizarCelda(f, c) {
  const el = mapaEl.querySelector(`.celda[data-f="${f}"][data-c="${c}"]`);
  if (!el) return;
  el.dataset.ch = mapa[f][c];
  dibujarCelda(el);
}

// -------------------------------------------------------------------
// Aplicar herramienta en una celda
// -------------------------------------------------------------------
function aplicarEn(f, c) {
  if (herramienta === 'borrar') {
    mapa[f][c] = ' ';
  } else if (herramienta === '@') {
    // Solo un jugador en el mapa; se elimina el anterior si estaba sobre
    // un destino, se preserva el destino.
    for (let yf = 0; yf < alto; yf++) {
      for (let yc = 0; yc < ancho; yc++) {
        if (mapa[yf][yc] === '@' || mapa[yf][yc] === '+') {
          mapa[yf][yc] = mapa[yf][yc] === '+' ? '.' : ' ';
          actualizarCelda(yf, yc);
        }
      }
    }
    // Si la celda destino tenia un destino, lo marcamos como '+'
    if (mapa[f][c] === '.') mapa[f][c] = '+';
    else mapa[f][c] = '@';
  } else if (herramienta === '$') {
    if (mapa[f][c] === '.') mapa[f][c] = '*';
    else mapa[f][c] = '$';
  } else if (herramienta === '*') {
    mapa[f][c] = '*';
  } else if (herramienta === '.') {
    if (mapa[f][c] === '$') mapa[f][c] = '*';
    else if (mapa[f][c] === '@') mapa[f][c] = '+';
    else mapa[f][c] = '.';
  } else {
    mapa[f][c] = herramienta;
  }
  actualizarCelda(f, c);
}

// -------------------------------------------------------------------
// Serializacion a XSB
// -------------------------------------------------------------------
function aTexto() {
  return mapa.map(fila => fila.join('')).join('\n') + '\n';
}

// -------------------------------------------------------------------
// Eventos: paleta
// -------------------------------------------------------------------
paleta.addEventListener('click', (e) => {
  const btn = e.target.closest('.tile-btn');
  if (!btn) return;
  for (const b of paleta.querySelectorAll('.tile-btn')) {
    b.classList.remove('seleccionado');
    b.setAttribute('aria-pressed', 'false');
  }
  btn.classList.add('seleccionado');
  btn.setAttribute('aria-pressed', 'true');
  herramienta = btn.dataset.ch;
});

// Eventos: pintado por arrastre (click y drag)
let pintando = false;
mapaEl.addEventListener('pointerdown', (e) => {
  const celda = e.target.closest('.celda');
  if (!celda) return;
  e.preventDefault();
  pintando = true;
  aplicarEn(parseInt(celda.dataset.f, 10), parseInt(celda.dataset.c, 10));
});
mapaEl.addEventListener('pointerover', (e) => {
  if (!pintando) return;
  const celda = e.target.closest('.celda');
  if (!celda) return;
  aplicarEn(parseInt(celda.dataset.f, 10), parseInt(celda.dataset.c, 10));
});
window.addEventListener('pointerup', () => { pintando = false; });

// Eventos: tamaño y vaciar
btnAplicar.addEventListener('click', () => {
  const w = Math.max(4, Math.min(30, parseInt(inputAncho.value, 10) || 10));
  const h = Math.max(4, Math.min(30, parseInt(inputAlto.value, 10)  || 8));
  inputAncho.value = w;
  inputAlto.value  = h;
  redimensionar(w, h);
});
btnLimpiar.addEventListener('click', () => {
  mapa = nuevoMapaVacio(ancho, alto);
  pintar();
});

// Eventos: guardar
btnGuardar.addEventListener('click', async () => {
  const nombre = inputNombre.value.trim();
  const errorNombre = validarNombreNuevo(nombre);
  if (errorNombre) {
    mostrarMensaje(errorNombre, 'error');
    inputNombre.focus();
    return;
  }
  const texto = aTexto();
  const error = validar(texto);
  if (error) {
    mostrarMensaje(error, 'error');
    return;
  }
  try { await guardar(nombre, texto); }
  catch (error) { mostrarMensaje(error.message || 'No se pudo guardar en este navegador.', 'error'); return; }
  mostrarMensaje(`Mapa ${listar().length + listarUsuario().length}: «${nombre}» guardado como nuevo.`, 'ok');
  renderLista();
});

function mostrarMensaje(txt, clase) {
  mensajeEl.textContent = txt;
  mensajeEl.className = clase || '';
}

// -------------------------------------------------------------------
// Lista de niveles guardados
// -------------------------------------------------------------------
function renderLista() {
  renderSelector();
  const niveles = listarUsuario();
  listaEl.innerHTML = '';
  if (niveles.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Aun no has guardado ningun nivel.';
    li.style.listStyle = 'none'; li.style.marginLeft = '-20px';
    li.style.color = 'var(--tenue)';
    listaEl.appendChild(li);
    return;
  }
  niveles.forEach((n, i) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.className = 'nombre'; span.textContent = `${listar().length + i + 1}. ${n.nombre}`;
    const btnCargar = document.createElement('button');
    btnCargar.textContent = 'Cargar';
    btnCargar.addEventListener('click', () => cargarEnEditor(n));
    const btnEliminar = document.createElement('button');
    btnEliminar.textContent = 'Eliminar';
    btnEliminar.addEventListener('click', async () => {
      if (!confirm(`¿Eliminar «${n.nombre}»?`)) return;
      try { await eliminar(i); } catch { mostrarMensaje('No se pudo eliminar.', 'error'); return; }
      renderLista();
    });
    li.append(span, btnCargar, btnEliminar);
    listaEl.appendChild(li);
  });
}

function cargarEnEditor(nivel) {
  inputNombre.value = nivel.nombre;
  const lineas = nivel.texto.replace(/\r/g, '').split('\n').filter(l => l.length > 0);
  if (!lineas.length) return;
  const w = Math.max(...lineas.map(l => l.length));
  const h = lineas.length;
  mapa = [];
  for (let f = 0; f < h; f++) {
    const fila = [];
    for (let c = 0; c < w; c++) {
      fila.push(lineas[f][c] ?? ' ');
    }
    mapa.push(fila);
  }
  ancho = w; alto = h;
  inputAncho.value = w; inputAlto.value = h;
  pintar();
  mostrarMensaje('Cargado en el editor. Cambia el nombre y guarda para crear un mapa nuevo.', 'ok');
}

function renderSelector() {
  const valor = selector.value;
  selector.replaceChildren(new Option('Nuevo mapa', ''));
  for (const [titulo, niveles, prefijo, inicio] of [
    ['Campaña', listar(), 'camp', 1],
    ['Mis mapas', listarUsuario(), 'propio', listar().length + 1],
  ]) {
    const grupo = document.createElement('optgroup');
    grupo.label = titulo;
    niveles.forEach((n, i) => grupo.append(new Option(`${inicio + i}. ${n.nombre}`, `${prefijo}:${i}`)));
    selector.append(grupo);
  }
  if ([...selector.options].some(o => o.value === valor)) selector.value = valor;
}
selector.addEventListener('change', () => {
  if (!selector.value) {
    inputNombre.value = '';
    mapa = nuevoMapaVacio(ancho, alto);
    pintar();
    return;
  }
  const [tipo, indice] = selector.value.split(':');
  const nivel = (tipo === 'camp' ? listar() : listarUsuario())[Number(indice)];
  if (nivel) cargarEnEditor(nivel);
});

// -------------------------------------------------------------------
// Arranque
// -------------------------------------------------------------------
await cargarUsuario();
try {
  sprites = await new Sprites().cargar('../assets/sprites.txt?v=correcciones3');
  for (const canvas of paleta.querySelectorAll('canvas[data-sprite]')) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    sprites.dibujar(ctx, 'suelo', 0, 0);
    sprites.dibujar(ctx, canvas.dataset.sprite, 0, 0);
    canvas.closest('button').disabled = false;
  }
} catch {
  mostrarMensaje('No se pudieron cargar los tiles. Recarga el editor.', 'error');
}
mapa = nuevoMapaVacio(ancho, alto);
pintar();
renderLista();
