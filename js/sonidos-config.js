export function validarSonidos(data) {
  if (!data?.pistas || !data?.momentos || !Object.keys(data.pistas).length) throw new Error('Faltan pistas o momentos.');
  for (const pista of Object.values(data.pistas)) {
    const bpm = pista.bpm ?? 120;
    if (!Number.isFinite(bpm) || bpm < 30 || bpm > 240) throw new Error('BPM fuera de 30–240.');
    const acordes = pista.acordes ?? [{ notas: pista.notas, duracion: pista.duracion ?? 0.2 }];
    if (!Array.isArray(acordes) || !acordes.length) throw new Error('Una pista no tiene acordes.');
    for (const acorde of acordes) {
      if (!Number.isFinite(acorde.duracion) || acorde.duracion <= 0) throw new Error('Duración inválida.');
      if (!Array.isArray(acorde.notas) || acorde.notas.some(n => typeof n !== 'string' || !/^[A-G](#|b)?[0-8]$/.test(n))) throw new Error('Nota inválida.');
    }
  }
  for (const pista of Object.values(data.momentos)) if (!Object.hasOwn(data.pistas, pista)) throw new Error('Un momento apunta a una pista inexistente.');
  return data;
}
