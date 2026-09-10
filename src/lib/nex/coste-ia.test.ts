import {it,expect} from 'vitest';
import {formatoCosteIA} from './coste-ia';
it('los céntimos y fracciones no se presentan como consumo cero',()=>{
 expect(formatoCosteIA(.209519)).toContain('0,21');
 expect(formatoCosteIA(.001)).toBe('<0,01 €');
 expect(formatoCosteIA(0)).toContain('0,00');
});
