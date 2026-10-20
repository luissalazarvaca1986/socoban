#!/usr/bin/env python3
"""Reconstruye los cuadros del personaje de sprites.txt, sin editar otros tiles.

Usa las poses editables de tools/personaje-base.txt como referencia.
Cierra huecos internos, conserva cabeza/torso entre pasos y mueve piernas
un píxel en norte/sur y articula rodillas y botas en los perfiles. Añade un contorno negro de un píxel. Es idempotente; ejecutar desde cualquier carpeta.
"""
from pathlib import Path
from collections import deque
import re

TAMANO = 32
RUTA = Path(__file__).resolve().parents[1] / 'assets/sprites.txt'
BASES = Path(__file__).with_name('personaje-base.txt')
CORRECCIONES = Path(__file__).with_name('personaje-correcciones.txt')
PATRON = re.compile(r'(^# (jugador_\w+)\n)((?:[^\n]{32}\n){32})', re.M)


def solidificar(filas):
    """Rellena transparencias encerradas; respeta el exterior y huecos abiertos."""
    cuadricula = [list(f) for f in filas]
    exterior = set()
    cola = deque((y, x) for y in range(TAMANO) for x in range(TAMANO)
                 if (y in (0, 31) or x in (0, 31)) and cuadricula[y][x] == '.')
    while cola:
        y, x = cola.popleft()
        if (y, x) in exterior:
            continue
        exterior.add((y, x))
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < TAMANO and 0 <= xx < TAMANO and cuadricula[yy][xx] == '.' and (yy, xx) not in exterior:
                cola.append((yy, xx))
    solidos = [(y, x, c) for y, fila in enumerate(filas) for x, c in enumerate(fila) if c != '.']
    for y in range(TAMANO):
        for x in range(TAMANO):
            if cuadricula[y][x] == '.' and (y, x) not in exterior:
                # Color del vecino opaco más cercano, desde el original.
                cuadricula[y][x] = min(solidos, key=lambda p: abs(p[0] - y) + abs(p[1] - x))[2]
    return [''.join(f) for f in cuadricula]


def contornear(filas):
    """Colorea de negro el borde de 1 px, dentro del tile, sin engrosar la silueta."""
    resultado = [list(f) for f in filas]
    for y, fila in enumerate(filas):
        for x, color in enumerate(fila):
            if color == '.':
                continue
            vecinos = ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1))
            if any(yy < 0 or yy >= TAMANO or xx < 0 or xx >= TAMANO
                   or filas[yy][xx] == '.' for yy, xx in vecinos):
                resultado[y][x] = 'K'
    return [''.join(f) for f in resultado]


def paso(base, fase):
    """Cabeza/torso estables; alterna las piernas con un desplazamiento de 1 px."""
    resultado = [list(f) for f in base]
    for y in range(26, TAMANO):
        resultado[y] = ['.'] * TAMANO
    for y in range(26, TAMANO):
        for x, color in enumerate(base[y]):
            if color == '.':
                continue
            dy = -1 if (x < 16) == (fase == 'a') else 0
            yy = max(26, y + dy)
            resultado[yy][x] = color
    return solidificar([''.join(f) for f in resultado])


def paso_lateral(base, fase, direccion):
    """Perfil proporcionado: cadera fija, piernas completas y botas compactas.

    Guía visual del autor: material/referencia-marcha-lateral.jpg del libro.
    Se dibuja en la rejilla nativa; no se estira ni se recorta una pierna
    pegada al torso anterior. La cabeza y los brazos proceden de la base original, sin reescalado.
    """
    lienzo = [['.'] * TAMANO for _ in range(TAMANO)]

    def trazo(puntos, color, radio):
        for (x0, y0), (x1, y1) in zip(puntos, puntos[1:]):
            vx, vy = x1-x0, y1-y0
            for y in range(TAMANO):
                for x in range(TAMANO):
                    t = max(0, min(1, ((x-x0)*vx+(y-y0)*vy)/(vx*vx+vy*vy)))
                    if (x-x0-t*vx)**2+(y-y0-t*vy)**2 <= radio**2:
                        lienzo[y][x] = color

    # Un ciclo cambia qué pierna avanza, conservando longitud y cadera.
    if fase == '0':
        lejana, cercana = [(17,22),(17,26),(19,29)], [(15,22),(13,26),(12,29)]
        botas = [(18,30,21,30), (11,30,14,30)]
    elif fase == 'a':
        lejana, cercana = [(17,22),(14,26),(12,29)], [(15,22),(18,26),(19,29)]
        botas = [(11,30,14,30), (18,30,21,30)]
    else:
        lejana, cercana = [(17,22),(12,25),(14,27)], [(15,22),(16,26),(16,29)]
        botas = [(13,27,16,27), (15,30,18,30)]
    for puntos, bota, color in [(lejana, botas[0], 'Z'), (cercana, botas[1], 'B')]:
        trazo(puntos, 'K', 2)
        trazo(puntos, color, 1)
        x0,y0,x1,y1 = bota
        trazo([(x0,y0),(x1,y1)], 'K', 1.5)
        trazo([(x0,y0),(x1,y1)], 'T', .5)

    # Recuperar cabeza, torso y brazos originales, sin reescalar sus píxeles.
    # Las piernas aprobadas se conservan debajo de la cadera.
    for y in range(23):
        lienzo[y] = list(base[y])
    for y in range(23, 26):
        for x, color in enumerate(base[y]):
            if (x < 11 or x > 20) and color != '.':
                lienzo[y][x] = color
    filas = solidificar([''.join(f) for f in lienzo])
    return [f[::-1] for f in filas] if direccion == 'oeste' else filas


def reparar(texto):
    """Devuelve el documento con poses consistentes y animaciones a 120 ms."""
    originales = {m[2]: m[3].splitlines() for m in PATRON.finditer(BASES.read_text(encoding='utf-8'))}
    frente = solidificar(originales['jugador_quieto_0'])
    norte = originales['jugador_norte_0'][:15] + [f.replace('Q', 'X').replace('Y', 'T') for f in frente[15:17]] + frente[17:]
    bases = {'sur': frente, 'norte': solidificar(norte),
             'oeste': solidificar(originales['jugador_oeste_0']),
             'este': solidificar(originales['jugador_este_0'])}
    nuevos = {'jugador_quieto_0': frente}
    for direccion, base in bases.items():
        lateral = direccion in ('este', 'oeste')
        nuevos[f'jugador_{direccion}_0'] = paso_lateral(bases['este'], '0', direccion) if lateral else base
        for fase in ('a', 'b'):
            nuevos[f'jugador_{direccion}_{fase}'] = paso_lateral(bases['este'], fase, direccion) if lateral else paso(base, fase)
    # Correcciones del autor transcritas de las rejillas 32×32 del editor.
    correcciones = {m[2]: m[3].splitlines() for m in PATRON.finditer(CORRECCIONES.read_text())}
    for fase in ('0', 'a', 'b'):
        n = f'jugador_norte_{fase}'
        nuevos[n] = correcciones['jugador_norte_0'][:26] + nuevos[n][26:]
    for fase in ('0', 'a', 'b'):
        if fase in ('0', 'b'):
            oeste = correcciones[f'jugador_oeste_{fase}']
        else:
            oeste = [f[::-1] for f in nuevos['jugador_este_a']]
            # Camisa y brazo corto de la pose base; mantener su propia pierna.
            oeste[:22] = correcciones['jugador_oeste_0'][:22]
            for y in range(22, 26):
                fila = list(oeste[y])
                for x in range(21, 32):
                    fila[x] = correcciones['jugador_oeste_0'][y][x]
                if y == 25:
                    fila[10] = '.'
                oeste[y] = ''.join(fila)
        oeste = solidificar(oeste)
        nuevos[f'jugador_oeste_{fase}'] = oeste
        nuevos[f'jugador_este_{fase}'] = [f[::-1] for f in oeste]
    nuevos = {nombre: contornear(filas) for nombre, filas in nuevos.items()}
    if not re.search(r'^K\s+000000$', texto, re.M):
        texto = texto.replace('! paleta\n', '! paleta\nK  000000\n', 1)
    texto = PATRON.sub(lambda m: m[1] + '\n'.join(nuevos[m[2]]) + '\n', texto)
    return re.sub(r'(^\s+jugador_\w+\s*:\s*)\d+', r'\g<1>120', texto, flags=re.M)


if __name__ == '__main__':
    RUTA.write_text(reparar(RUTA.read_text(encoding='utf-8')), encoding='utf-8')
