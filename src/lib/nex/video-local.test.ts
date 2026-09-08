import {describe,it,expect} from 'vitest';
import {validarEscenas,validarAudioLocal} from './video-local';
describe('vídeo local',()=>{
 it('no recorta una locución que supera el vídeo',()=>{expect(()=>validarAudioLocal(1000,5,4)).toThrow();expect(()=>validarAudioLocal(1000,4,4)).not.toThrow();});
 it('rechaza audio vacío, excesivo o sin duración válida',()=>{expect(()=>validarAudioLocal(0,2,4)).toThrow();expect(()=>validarAudioLocal(10000001,2,4)).toThrow();expect(()=>validarAudioLocal(1000,NaN,4)).toThrow();});
 it('mide duración real solicitada',()=>expect(validarEscenas([{titulo:'Uno',texto:'Texto',segundos:3},{titulo:'Dos',texto:'Texto',segundos:4}])).toBe(7));
 it('rechaza duración desconocida y vídeos excesivos',()=>{expect(()=>validarEscenas([{titulo:'Uno',texto:'Texto',segundos:NaN}])).toThrow();expect(()=>validarEscenas(Array.from({length:20},()=>({titulo:'Uno',texto:'Texto',segundos:15})))).toThrow();});
 it('no recorta textos que no caben',()=>expect(()=>validarEscenas([{titulo:'Uno',texto:'a'.repeat(451),segundos:3}])).toThrow());
});
