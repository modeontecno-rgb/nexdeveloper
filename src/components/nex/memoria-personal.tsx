import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {supabase} from '@/lib/nex/supabase';
import {Boton,claseCampo} from './campos';
export function MemoriaPersonal(){
 const qc=useQueryClient(),[id,setId]=useState('');
 const versiones=useQuery({queryKey:['personal_memoria_historial'],queryFn:async()=>{const {data,error}=await supabase.from('personal_memoria_historial').select('*').order('id',{ascending:false}).limit(30);if(error)throw error;return data;}});
 const restaurar=useMutation({mutationFn:async()=>{const {error}=await supabase.rpc('personal_restaurar_memoria',{p_revision:Number(id)});if(error)throw error;},onSuccess:()=>{void qc.invalidateQueries({queryKey:['personal_memoria_historial']});void qc.invalidateQueries({queryKey:['personal_estado']});toast.success('Memoria restaurada. Se conserva el historial de revisiones.');},onError:e=>toast.error(e.message)});
 const fila=versiones.data?.find(v=>String(v.id)===id);
 return <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Historial de mi memoria e instrucciones</summary><p className="my-2 text-xs text-muted-foreground">Solo tus instrucciones y perfil de redacción. Los asistentes de proyectos no pueden consultar este historial.</p>
 {versiones.error?<p role="alert">No se pudo consultar el historial.</p>:<><select aria-label="Revisión de memoria" className={claseCampo} value={id} onChange={e=>setId(e.target.value)}><option value="">Selecciona una revisión</option>{versiones.data?.map(v=><option key={v.id} value={v.id}>{new Date(v.creada_el).toLocaleString('es-ES')} · #{v.id}</option>)}</select>{fila?<div className="mt-3 space-y-2"><p className="whitespace-pre-wrap text-sm">{fila.instrucciones||'Sin instrucciones'}</p><p className="whitespace-pre-wrap text-xs text-muted-foreground">{fila.perfil_estilo||'Sin perfil de estilo'}</p><Boton disabled={restaurar.isPending} onClick={()=>restaurar.mutate()}>Restaurar esta revisión</Boton></div>:null}</>}
 </details>;
}
