import {useProyectos} from '@/lib/nex/queries/datos';
import {PendientesProyectian} from './pendientes-proyectian';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {supabase} from '@/lib/nex/supabase';
import {Boton} from './campos';
export function IntercambioProyectian(){
 const qc=useQueryClient();const proyectos=useProyectos();
 const enlaces=useQuery({queryKey:['proyectian_enlaces'],queryFn:async()=>{const {data,error}=await supabase.from('proyectian_enlaces').select('*');if(error)throw error;return data;}});
 const sync=useMutation({mutationFn:async(id:string)=>{const {data,error}=await supabase.functions.invoke('intercambio-proyectian',{body:{enlace_id:id}});if(error||!data?.ok)throw new Error(data?.error??error?.message??'No se ha aplicado el intercambio');return data;},onSuccess:(r)=>{void qc.invalidateQueries({queryKey:['proyectian_enlaces']});void qc.invalidateQueries({queryKey:['proyectian_pendientes']});toast.success(`Copia actualizada. Proyectian confirmó ${r.entregas_recibidas??0} entregas de Nex.`);},onError:e=>{void qc.invalidateQueries({queryKey:['proyectian_enlaces']});toast.error(e.message)}});
 return <section className="panel mb-6 space-y-3 p-5"><h2 className="font-semibold">Intercambio con Proyectian</h2><p className="text-sm text-muted-foreground">Proyectian conserva la ficha de producto, líneas, versiones y materiales. Nex consulta su última copia confirmada y devuelve el registro de sus archivos verificados. Los originales se descargan desde Nex; no se cierran versiones automáticamente. Este intercambio no llama a modelos de IA.</p>
 {enlaces.isPending?<p role="status">Consultando enlaces…</p>:enlaces.error?<p role="alert">No se pudo consultar el intercambio. Estado desconocido.</p>:!enlaces.data?.length?<p className="text-sm">No hay parejas configuradas. Cada enlace necesita los identificadores de ambos proyectos y propietarios; nunca se emparejan por nombre.</p>:<ul className="space-y-3">{enlaces.data.map(e=><li key={e.id} className="rounded-lg border p-3"><p className="break-all text-sm">{proyectos.data?.find(p=>p.id===e.proyecto_id)?.nombre??'Proyecto vinculado'}</p><p className="text-sm">{e.activo?'Enlace activo':'Enlace desactivado'} · Revisión {e.revision} · {e.sincronizado_el?new Date(e.sincronizado_el).toLocaleString('es-ES'):'Sin intercambio confirmado'}</p>{e.ultimo_error?<p role="alert" className="mt-2 text-sm text-destructive">{e.ultimo_error}</p>:null}<Boton className="mt-2" disabled={!e.activo||sync.isPending} onClick={()=>sync.mutate(e.id)}>{sync.isPending&&sync.variables===e.id?'Recibiendo y comprobando…':'Intercambiar y comprobar'}</Boton></li>)}</ul>}
 <PendientesProyectian/>
 </section>;
}
