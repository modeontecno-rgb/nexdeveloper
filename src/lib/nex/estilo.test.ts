import {describe,it,expect} from 'vitest';
import {comprobarTextoProtegido} from '../../../db/functions/_shared/estilo';
describe('reescritura conservadora',()=>{
 it('admite mejorar prosa conservando cifras',()=>expect(()=>comprobarTextoProtegido('Hemos realizado 12 cambios.','Realizamos 12 cambios.')).not.toThrow());
 it('rechaza alterar cifras',()=>expect(()=>comprobarTextoProtegido('Cuesta 12,50 €.','Cuesta 15,50 €.')).toThrow());
 it('rechaza cambiar código o fuentes',()=>{expect(()=>comprobarTextoProtegido('```ts\nconst n=2;\n```','```ts\nconst n=3;\n```')).toThrow();expect(()=>comprobarTextoProtegido('https://a.example/origen','https://b.example/otro')).toThrow();});
});
