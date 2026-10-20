// Cámara sobre el mundo: casillas de 32×32, sin reducir los sprites.
export const TAMANO_BLOQUE = 32;

function origenEje(casillas, jugador, ventana) {
  const mundo = casillas * TAMANO_BLOQUE;
  if (mundo <= ventana) return Math.floor((ventana - mundo) / 2);
  const centroJugador = (jugador + 0.5) * TAMANO_BLOQUE;
  const desplazamiento = Math.max(0, Math.min(mundo - ventana,
    Math.floor(centroJugador - ventana / 2)));
  return -desplazamiento;
}

// Reserva 16 px superiores para el HUD. Los mapas pequeños se centran;
// los grandes siguen al jugador y se detienen en los límites del mapa.
export function encuadrar(filas, columnas, jugador, ancho = 320, alto = 240, hud = 16) {
  return {
    x: origenEje(columnas, jugador[1], ancho),
    y: hud + origenEje(filas, jugador[0], alto - hud),
  };
}
