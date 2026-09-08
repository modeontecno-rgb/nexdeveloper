import {describe,it,expect} from 'vitest';
import {compararCoste} from './comparador-coste';
const t={entrada_eur_millon:1,salida_eur_millon:2,max_entrada:10000,max_salida:2000,verificada_hasta:'2026-09-09T00:00:00Z'};
const now=Date.parse('2026-09-08T00:00:00Z');
describe('simulador económico, tarifas ficticias',()=>{
 it('distingue estimación y reserva',()=>expect(compararCoste(t,1000,1000,10,now)).toEqual({estimado:.03,reservaPorLlamada:.012}));
 it('no presenta precio desconocido o caducado como gratuito',()=>{expect(compararCoste({...t,entrada_eur_millon:NaN},1000,1000,1,now)).toBeNull();expect(compararCoste(t,1000,1000,1,now+2*86400000)).toBeNull();});
 it('rechaza contexto superior al modelo y números inválidos',()=>{expect(compararCoste(t,20000,1000,1,now)).toBeNull();expect(compararCoste(t,1000,1000,NaN,now)).toBeNull();});
});
