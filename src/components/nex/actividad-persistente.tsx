import {Link} from '@tanstack/react-router';
import {useQuery} from '@tanstack/react-query';
import {Loader2} from 'lucide-react';
import {useAuth} from '@/lib/nex/auth';
import {supabase} from '@/lib/nex/supabase';
export function ActividadPersistente(){
 const {usuario}=useAuth();
 const q=useQuery({queryKey:['actividad_persistente',usuario?.id],enabled:!!usuario,refetchInterval:10000,queryFn:async()=>{
  const {data,error}=await supabase.from('ejecuciones_orden').select('id,estado,texto,pasos,creado_el').eq('user_id',usuario!.id).in('estado',['en_cola','enviando','construyendo','comprobando','publicando','esperando_aprobacion']).order('creado_el',{ascending:false}).limit(20);if(error)throw error;return data;
 }});
 if(!usuario||q.isPending||(!q.error&&!q.data?.length))return null;
 if(q.error)return <p role="status" className="mb-4 rounded-lg border p-3 text-xs">No se puede comprobar la actividad del servidor. <button className="underline" onClick={()=>void q.refetch()}>Reintentar</button></p>;
 return <details className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3"><summary className="cursor-pointer text-sm"><Loader2 className="mr-2 inline size-4 animate-spin motion-reduce:animate-none"/>{q.data!.length===20?'20 o más':q.data!.length} trabajos activos o pendientes de revisión</summary><ul className="mt-2 space-y-2">{q.data!.map(e=><li key={e.id} className="text-sm"><Link to="/ejecucion" search={{ejecucion:e.id}} className="text-primary underline">{(e.texto??'Trabajo sin título').slice(0,90)}</Link><p className="text-xs text-muted-foreground">{e.estado.replaceAll('_',' ')} · {e.pasos} pasos registrados. Abre la ejecución para revisar o cancelar.</p></li>)}</ul><p className="mt-2 text-xs text-muted-foreground">Estado conservado en el servidor; se vuelve a consultar al abrir la aplicación. No se estima un porcentaje sin conocer el trabajo total.</p></details>;
}
