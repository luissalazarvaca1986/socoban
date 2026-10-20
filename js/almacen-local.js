// Base local compartida; las marcas nunca forman parte de las descargas.
let apertura;
export function abrirAlmacen() {
  if (!apertura) apertura = new Promise((resolve, reject) => {
    const peticion = indexedDB.open('sokoban', 2);
    peticion.onupgradeneeded = () => {
      for (const nombre of ['marcas', 'contenido']) {
        if (!peticion.result.objectStoreNames.contains(nombre)) {
          peticion.result.createObjectStore(nombre, { keyPath: 'id' });
        }
      }
    };
    peticion.onerror = () => reject(peticion.error);
    peticion.onblocked = () => reject(new Error('Cierra las otras pestañas del juego para actualizar el almacenamiento.'));
    peticion.onsuccess = () => {
      const db = peticion.result;
      db.onversionchange = () => { db.close(); apertura = null; };
      resolve(db);
    };
  }).catch(error => { apertura = null; throw error; });
  return apertura;
}

export async function leerContenido(id) {
  const db = await abrirAlmacen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('contenido', 'readonly');
    const peticion = tx.objectStore('contenido').get(id);
    tx.oncomplete = () => resolve(peticion.result?.valor);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

export async function guardarContenido(id, valor) {
  const db = await abrirAlmacen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('contenido', 'readwrite');
    tx.objectStore('contenido').put({ id, valor });
    tx.oncomplete = resolve;
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

// Solo contenido creativo. No hay exportación de marcas ni de la base completa.
export function descargarContenido(tipo, contenido) {
  if (!['mapas', 'sonidos'].includes(tipo)) throw new Error('Solo se pueden descargar mapas y sonidos.');
  const url = URL.createObjectURL(new Blob([JSON.stringify(contenido, null, 2)], { type: 'application/json' }));
  const enlace = document.createElement('a');
  enlace.href = url; enlace.download = `${tipo}.json`;
  document.body.append(enlace); enlace.click(); enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
