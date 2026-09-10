// @vitest-environment happy-dom
import * as React from 'react';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {ContinuarFuera} from './continuar-fuera';
const f=vi.hoisted(()=>({single:vi.fn(),cancel:vi.fn()}));
vi.mock('@/lib/nex/supabase',()=>({supabase:{from:()=>({select:()=>({eq:()=>({single:f.single})})})}}));
vi.mock('@/lib/nex/queries/ejecucion',()=>({useCancelarEjecucion:()=>({mutateAsync:f.cancel})}));
it('no exporta el encargo si no puede confirmar su detención',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const n=document.createElement('div'),r=createRoot(n);
 f.single.mockResolvedValue({data:{id:'e',estado:'construyendo'},error:null});f.cancel.mockRejectedValue(new Error('No se pudo detener'));
 await act(async()=>r.render(<ContinuarFuera e={{id:'e',estado:'construyendo'}} nombre="App" repo="a/b"/>));
 await act(async()=>n.querySelector('button')!.click());
 expect(f.cancel).toHaveBeenCalledWith('e');expect(n.querySelector('textarea')).toBeNull();expect(n.textContent).toContain('No se pudo detener');
 await act(async()=>r.unmount());vi.unstubAllGlobals();
});
it('consulta de nuevo el trabajo detenido y exporta sin una llamada IA',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);f.single.mockReset();f.cancel.mockReset();
 f.single.mockResolvedValueOnce({data:{id:'e',estado:'construyendo'}}).mockResolvedValueOnce({data:{id:'e',estado:'cancelada',texto:'Continuar login',resumen:'Entrega preservada'}});f.cancel.mockResolvedValue({ok:true});
 const n=document.createElement('div'),r=createRoot(n);
 await act(async()=>r.render(<ContinuarFuera e={{id:'e',estado:'construyendo'}} nombre="App" repo="a/b"/>));
 await act(async()=>n.querySelector('button')!.click());
 expect(n.querySelector('textarea')?.value).toContain('Entrega preservada');expect(n.querySelector('textarea')?.value).toContain('cancelada');expect(f.single).toHaveBeenCalledTimes(2);
 await act(async()=>r.unmount());vi.unstubAllGlobals();
});
