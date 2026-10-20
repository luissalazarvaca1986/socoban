import { leerContenido, guardarContenido } from './almacen-local.js';
import { EXTRA_MAPS } from './extra-maps.js';

// Almacén de niveles propios en IndexedDB, con una campaña por omisión
// que incluye el nivel tutorial. El juego lo lee en orden; el editor
// lo escribe. Las dos piezas usan este modulo para no duplicar claves
// ni formato.
//
// Formato de cada entrada:
//   { nombre: string, texto: string (XSB), origen: 'tutorial'|'campania'|'usuario' }

const CLAVE = 'socoban_niveles_v1';

const NIVEL_TUTORIAL = {
  nombre: 'Tutorial',
  origen: 'tutorial',
  texto:
    '########\n' +
    '#      #\n' +
    '# .$   #\n' +
    '# .$@  #\n' +
    '# .$   #\n' +
    '########\n',
};

// Mapas tutoriales 2 y 3, después de Tutorial (mapa 1).
const NIVELES_EJEMPLO = [
  { nombre: 'Primer empuje', origen: 'tutorial', texto:
      '######\n' +
      '#    #\n' +
      '#@$ .#\n' +
      '#    #\n' +
      '######\n' },
  { nombre: 'Dos simetricas', origen: 'tutorial', texto:
      '########\n' +
      '#.    .#\n' +
      '#$    $#\n' +
      '#      #\n' +
      '#  @   #\n' +
      '########\n' },
];

let propios = [];
export async function cargarUsuario() {
  try {
    let guardados = await leerContenido('mapas');
    if (guardados === undefined) {
      // Migración única. La copia antigua se retiene por seguridad.
      guardados = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
      if (!Array.isArray(guardados)) guardados = [];
      await guardarContenido('mapas', guardados);
    }
    propios = (Array.isArray(guardados) ? guardados : [])
      .filter(n => n && typeof n.texto === 'string')
      .map(n => ({ nombre: String(n.nombre ?? 'Sin nombre'), texto: n.texto, origen: 'usuario' }));
  } catch {
    try { propios = JSON.parse(localStorage.getItem(CLAVE) ?? '[]'); } catch { propios = []; }
    if (!Array.isArray(propios)) propios = [];
  }
}
function leerUsuario() { return propios.map(n => ({ ...n, origen: 'usuario' })); }
async function escribirUsuario(arr) {
  const limpios = arr.map(n => ({ nombre: n.nombre, texto: n.texto }));
  await guardarContenido('mapas', limpios);
  propios = limpios;
}

export function listar() {
  // Campaña de 23 mapas: tutoriales 1–3 y retos 4–23.
  // El editor conserva sus mapas aparte de esta campaña.
  return [NIVEL_TUTORIAL, ...NIVELES_EJEMPLO, ...EXTRA_MAPS];
}

export function listarUsuario() {
  return leerUsuario();
}

export function validarNombreNuevo(nombre) {
  const clave = String(nombre ?? '').trim().toLocaleLowerCase('es');
  if (!clave) return 'Ponle un nombre al nivel antes de guardar.';
  if ([...listar(), ...listarUsuario()].some(n => n.nombre.trim().toLocaleLowerCase('es') === clave)) {
    return 'Cambia el nombre: cada copia debe tener un nombre nuevo y distinto de los mapas existentes.';
  }
  return null;
}

export async function guardar(nombre, texto) {
  const error = validarNombreNuevo(nombre);
  if (error) throw Error(error);
  nombre = nombre.trim();
  const actuales = leerUsuario();
  actuales.push({ nombre, texto });
  await escribirUsuario(actuales);
}

export async function reemplazar(indice, nombre, texto) {
  const actuales = leerUsuario();
  if (indice < 0 || indice >= actuales.length) return false;
  actuales[indice] = { nombre, texto };
  await escribirUsuario(actuales);
  return true;
}

export async function eliminar(indice) {
  const actuales = leerUsuario();
  if (indice < 0 || indice >= actuales.length) return false;
  actuales.splice(indice, 1);
  await escribirUsuario(actuales);
  return true;
}

export function validar(texto) {
  const lineas = texto.replace(/\r/g, '').split('\n');
  while (lineas.length && !lineas[0].trim()) lineas.shift();
  while (lineas.length && !lineas[lineas.length - 1].trim()) lineas.pop();
  if (!lineas.length) return 'El nivel esta vacio.';

  let cajas = 0, destinos = 0, almaceneros = 0;
  for (let f = 0; f < lineas.length; f++) {
    for (let c = 0; c < lineas[f].length; c++) {
      const ch = lineas[f][c];
      switch (ch) {
        case '#': case ' ': break;
        case '.': destinos += 1; break;
        case '$': cajas += 1; break;
        case '*': cajas += 1; destinos += 1; break;
        case '@': almaceneros += 1; break;
        case '+': almaceneros += 1; destinos += 1; break;
        default:
          return `Caracter invalido '${ch}' en la fila ${f + 1}, columna ${c + 1}.`;
      }
    }
  }
  if (almaceneros === 0) return 'Falta el jugador (@).';
  if (almaceneros > 1) return `Hay ${almaceneros} jugadores; solo puede haber uno.`;
  if (cajas === 0) return 'Un nivel debe tener al menos una caja.';
  if (cajas !== destinos) {
    return `Debe haber el mismo numero de cajas y destinos. Hay ${cajas} cajas y ${destinos} destinos.`;
  }
  return null;
}
