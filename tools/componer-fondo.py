#!/usr/bin/env python3
"""Compone «Almacén en marcha»: fondo original de 32 compases, sin audio externo.

Energía rock mediante corcheas, síncopas y respuestas melódicas en re menor.
Cuatro secciones de ocho compases: motivo, respuesta, contraste y regreso.
Solo sustituye fondo; conserva efectos y formato del editor. 128 pulsos a
144 BPM = 53,33 s. El final sobre la dominante enlaza con el re inicial.
"""
import json
from pathlib import Path

# Cada frase suma cuatro pulsos; las duraciones no uniformes dan respiración.
FRASES = [
    [('D5', .5), ('A4', .5), ('F5', .5), ('G5', .25), ('F5', .25), ('D5', .5), ('C5', .5), ('A4', .5), ('C5', .5)],
    [('F5', .75), ('D5', .25), ('A4', .5), ('C5', .5), ('D5', .5), ('F5', .25), ('G5', .25), ('A5', .5), ('F5', .5)],
    [('D5', .5), ('F5', .5), ('Bb5', .5), ('A5', .5), ('F5', .75), ('D5', .25), ('C5', .5), ('D5', .5)],
    [('G5', .5), ('E5', .25), ('G5', .25), ('C6', .5), ('G5', .5), ('E5', .5), ('D5', .5), ('C5', .5), ('A4', .5)],
    [('A5', .5), ('F5', .5), ('D5', .5), ('F5', .5), ('G5', .25), ('A5', .25), ('G5', .5), ('F5', .5), ('D5', .5)],
    [('C6', .75), ('A5', .25), ('F5', .5), ('A5', .5), ('G5', .5), ('F5', .5), ('D5', .5), ('C5', .5)],
    [('Bb5', .5), ('G5', .5), ('D5', .5), ('G5', .25), ('A5', .25), ('Bb5', .5), ('A5', .5), ('G5', .5), ('F5', .5)],
    [('E5', .5), ('A5', .5), ('G5', .5), ('E5', .5), ('C#5', .5), ('E5', .25), ('G5', .25), ('E5', .5), ('C#5', .5)],
]
BAJOS = [('D3', 'A3'), ('D3', 'A3'), ('Bb2', 'F3'), ('C3', 'G3'),
         ('D3', 'A3'), ('F3', 'C4'), ('G2', 'D3'), ('A2', 'E3')]
acordes = []
for seccion in range(4):
    for compas, (raiz, quinta) in enumerate(BAJOS):
        frase = FRASES[compas]
        if seccion == 1:
            # Respuesta: cambia el punto de entrada y el contorno de la frase.
            frase = frase[3:] + frase[:3]
        elif seccion == 2:
            # Contraste: menos notas, registro más bajo y pulso reconocible.
            frase = [(n.replace('6', '5').replace('5', '4'), 1)
                     for n, _ in FRASES[compas][:4]]
        elif seccion == 3 and compas < 7:
            # Regreso: apertura con un pequeño acento ascendente.
            frase = [(n, d) for n, d in frase]
            n, d = frase[-1]
            frase[-1:] = [(n, d / 2), (FRASES[(compas + 1) % 8][0][0], d / 2)]
        pulso = 0
        assert sum(d for _, d in frase) == 4
        for nota, duracion in frase:
            notas = [nota]
            if pulso % 1 == 0:
                notas.insert(0, raiz if int(pulso) % 2 == 0 else quinta)
            if pulso == 0:
                notas.insert(1, quinta)
            acordes.append({'notas': list(dict.fromkeys(notas)), 'duracion': duracion})
            pulso += duracion

ruta = Path(__file__).resolve().parents[1] / 'assets/sonidos.json'
config = json.loads(ruta.read_text())
config['pistas']['fondo'] = {'bucle': True, 'bpm': 144, 'acordes': acordes}
ruta.write_text(json.dumps(config, indent=2) + '\n')
print(f'{len(acordes)} entradas, 128 pulsos, 144 BPM, 53,33 segundos por vuelta')
