import {Link} from '@tanstack/react-router';
import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {supabase} from '@/lib/nex/supabase';
import {Boton,Campo,claseCampo} from './campos';
export function EntregasOrden({ordenId,proyectoId}:{ordenId:string;proyectoId:string}){
 const [titulo,setTitulo]=useState('');const qc=useQueryClient();
 const q=useQuery({queryKey:['entregas_orden',ordenId],queryFn:async()=>{const {data,error}=await supabase.from('entregas_requeridas').select('*').eq('orden_id',ordenId).order('creado_el');if(error)throw error;return data;}});
 const docs=useQuery({queryKey:['entregas_archivos',proyectoId],queryFn:async()=>{const {data,error}=await supabase.from('documentos_nex').select('id,titulo,version').eq('proyecto_id',proyectoId).eq('bucket','entregas').order('creado_el',{ascending:false}).limit(300);if(error)throw error;return data;}});
 const guardar=useMutation({mutationFn:async(v:{id?:string;doc?:string})=>{const {error}=await supabase.rpc('configurar_entrega',{p_orden:ordenId,p_titulo:titulo,...(v.id?{p_entrega:v.id,p_documento:v.doc}:{})});if(error)throw error;},onSuccess:()=>{setTitulo('');void qc.invalidateQueries({queryKey:['entregas_orden',ordenId]});toast.success('Entrega actualizada.');},onError:e=>toast.error(e.message)});
 return <section className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">Entregas obligatorias</h3><p className="text-sm text-muted-foreground">Define los PDF, manuales, vídeos u otros archivos que necesita esta orden. No podrá finalizar hasta que todos tengan un archivo verificado del mismo proyecto. Registra los archivos en Documentación.</p><Link to="/documentacion" search={{proyecto:proyectoId,pestana:"documentos"}} className="text-sm text-primary underline">Abrir documentación de este proyecto</Link>
 {q.isPending?<p role="status">Consultando entregas…</p>:q.error?<p role="alert">No se pudieron comprobar las entregas.</p>:!q.data?.length?<p className="text-sm">Sin requisitos documentales registrados para esta orden.</p>:q.data.map(r=><Campo key={r.id} etiqueta={r.titulo}><select className={claseCampo} value={r.documento_id??''} disabled={guardar.isPending||!!docs.error} onChange={e=>{if(e.target.value)guardar.mutate({id:r.id,doc:e.target.value});}}><option value="">Pendiente de archivo</option>{docs.data?.map(d=><option key={d.id} value={d.id}>{d.titulo}{d.version?` · v${d.version}`:' · Sin versión'}</option>)}</select></Campo>)}
 {docs.error?<p role="alert">No se pudo consultar el registro de archivos.</p>:null}
 <Campo etiqueta="Nueva entrega requerida"><input className={claseCampo} value={titulo} maxLength={160} onChange={e=>setTitulo(e.target.value)} placeholder="Por ejemplo: manual de usuario PDF"/></Campo><Boton variante="suave" disabled={!titulo.trim()||guardar.isPending} onClick={()=>guardar.mutate({})}>{guardar.isPending?'Guardando…':'Añadir requisito'}</Boton>
 </section>;
}
