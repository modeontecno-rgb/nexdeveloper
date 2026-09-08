import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/lib/nex/supabase';
import {compararCoste} from '@/lib/nex/comparador-coste';
import {Campo,claseCampo} from './campos';
const euros=(n:number)=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:6}).format(n);
export function ComparadorCoste(){
 const [entrada,setEntrada]=useState(5000),[salida,setSalida]=useState(1000),[llamadas,setLlamadas]=useState(1);
 const q=useQuery({queryKey:['comparacion_tarifas'],queryFn:async()=>{const [t,m]=await Promise.all([supabase.from('ia_tarifas').select('*'),supabase.from('modelos_ia').select('id,nombre,identificador').eq('activo',true)]);if(t.error)throw t.error;if(m.error)throw m.error;return {tarifas:t.data,modelos:m.data};}});
 return <details className="border-t pt-4"><summary className="cursor-pointer font-medium">Comparar costes antes de elegir modelo</summary><p className="my-3 text-sm text-muted-foreground">Simulación local con tus tarifas documentadas, sin enviar el trabajo a ningún proveedor. El precio no mide la calidad: comprueba el resultado con las mismas tareas antes de sustituir un modelo.</p><div className="grid gap-3 sm:grid-cols-3">{([['Tokens de entrada',entrada,setEntrada],['Tokens de salida',salida,setSalida],['Llamadas previstas, incluidos reintentos',llamadas,setLlamadas]] as const).map(([label,value,set])=><Campo key={label} etiqueta={label}><input className={claseCampo} type="number" min="1" value={Number.isFinite(value)?value:''} onChange={e=>set(e.target.valueAsNumber)}/></Campo>)}</div>
 {q.error?<p role="alert">No se pudieron consultar las tarifas.</p>:!q.data?.tarifas.length?<p className="mt-3 text-sm">Configura al menos una tarifa para comparar. Un precio desconocido no se muestra como gratuito.</p>:<div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Modelo</th><th>Estimado total</th><th>Reserva máxima por llamada</th></tr></thead><tbody>{q.data.tarifas.map(t=>{const m=q.data.modelos.find(m=>m.id===t.modelo_id);if(!m)return null;const c=compararCoste(t,entrada,salida,llamadas);return <tr key={t.modelo_id}><td className="py-2 pr-3">{m.nombre}</td><td>{c?euros(c.estimado):'Tarifa caducada o límites excedidos'}</td><td>{c?euros(c.reservaPorLlamada):'Sin estimación'}</td></tr>})}</tbody></table></div>}
 </details>;
}
