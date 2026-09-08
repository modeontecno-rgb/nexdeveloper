import {describe,it,expect} from 'vitest';
import {datosOrdenMesa,textoOrdenMesa} from './orden-desde-mesa';
describe('orden desde conclusión de mesa',()=>{
 it('conserva riesgo y no transforma alta en NaN',()=>{const r=datosOrdenMesa({coste_estimado:1,horas_estimadas:2,calidad_prevista:'alta',riesgo:'alto'});expect(r.riesgo).toBe('Alto');expect(r.calidadPrevista).toBeNull();});
 it('no anuncia un trabajo gratuito ante un coste desconocido',()=>{expect(()=>datosOrdenMesa({coste_estimado:'barato',horas_estimadas:2})).toThrow();});
 it('transfiere el plan y los requisitos junto a la síntesis',()=>{const texto=textoOrdenMesa('Resumen','Petición',{plan:[{titulo:'Validar',descripcion:'Antes de publicar'}],requisitos:['PDF']});expect(texto).toContain('Antes de publicar');expect(texto).toContain('PDF');expect(texto).toContain('Petición');});
});
