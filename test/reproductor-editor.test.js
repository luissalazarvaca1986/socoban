import test from 'node:test';
import assert from 'node:assert/strict';
import { Reproductor, Pista, Acorde } from '../editor-audio/js/editor-audio.js';

function entorno(fn) {
  const originales = Object.fromEntries(['window','setTimeout','clearTimeout','setInterval','clearInterval'].map(k=>[k,globalThis[k]]));
  const tiempos = new Map(), seguimientos = new Map(), nodos = [];
  let id=0, ctx;
  class Contexto {
    state='running'; currentTime=0; destination={};
    constructor(){ ctx=this; }
    resume(){this.state='running';return Promise.resolve();}
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(destino){return destino;},disconnect(){}};}
    createOscillator(){const n={frequency:{},connect(g){return g;},start(){},stop(){this.detenido=true;},disconnect(){}};nodos.push(n);return n;}
  }
  globalThis.window={AudioContext:Contexto};
  globalThis.setTimeout=(f,ms)=>{const n=++id;tiempos.set(n,{f,ms});return n;};
  globalThis.clearTimeout=n=>tiempos.delete(n);
  globalThis.setInterval=f=>{const n=++id;seguimientos.set(n,f);return n;};
  globalThis.clearInterval=n=>seguimientos.delete(n);
  const avanzar=t=>{ctx.currentTime=t;for(const f of [...seguimientos.values()])f();};
  try {fn({avanzar,tiempos,seguimientos,nodos});} finally {Object.assign(globalThis,originales);}
}
const pista=(bucle=false)=>new Pista('Prueba',{bpm:120,bucle,acordes:[new Acorde(['C4'],1),new Acorde(['D4'],1)]});

test('El reproductor sigue el reloj de audio y detener limpia estado, acorde y programación',()=>entorno(({avanzar,seguimientos,tiempos,nodos})=>{
  const r=new Reproductor(),indices=[],estados=[];
  r.alCambiarEstado=v=>estados.push(v);r.alCambiarAcorde=i=>indices.push(i);
  r.tocarPista(pista(true));
  assert.equal(r.reproduciendo,true);
  avanzar(.1);assert.equal(r.acordeActual,0);
  avanzar(.6);assert.equal(r.acordeActual,1);
  r.detenerBucle();
  assert.equal(r.reproduciendo,false);assert.equal(r.acordeActual,null);
  assert.equal(seguimientos.size,0);assert.equal(tiempos.size,0);
  assert.ok(nodos.every(n=>n.detenido));
  assert.deepEqual(estados,[true,false]);assert.deepEqual(indices,[0,1,null]);
}));

test('La pista finita termina sola y vuelve al estado detenido',()=>entorno(({avanzar,seguimientos})=>{
  const r=new Reproductor();r.tocarPista(pista());
  avanzar(.1);assert.equal(r.acordeActual,0);
  avanzar(1.3);assert.equal(r.reproduciendo,false);assert.equal(r.acordeActual,null);
  assert.equal(seguimientos.size,0);
}));

test('Cambiar o detener una pista no deja un bucle anterior capaz de reactivarse',()=>entorno(({avanzar,tiempos})=>{
  const r=new Reproductor();r.tocarPista(pista(true));
  const bucleViejo=[...tiempos.values()][0].f;
  r.tocarPista(new Pista('Otra',{bpm:120,acordes:[new Acorde(['E4'],1)]}));
  assert.equal(tiempos.size,0);avanzar(.1);assert.equal(r.acordeActual,0);
  r.detenerBucle();bucleViejo();assert.equal(r.reproduciendo,false);assert.equal(tiempos.size,0);
}));
