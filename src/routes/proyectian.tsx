import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/lib/nex/supabase';
import type {ProyectoRow} from '@/lib/nex/db-types';
import {createFileRoute,Link} from '@tanstack/react-router';
import {Encabezado} from '@/components/nex/app-shell';
import {IntercambioProyectian} from '@/components/nex/intercambio-proyectian';
export const Route=createFileRoute('/proyectian')({head:()=>({meta:[{title:'Intercambio con Proyectian · NexDeveloper'}]}),component:()=> <><Encabezado titulo="Intercambio con Proyectian" descripcion="Producto y fabricación en Proyectian; trabajo y archivos técnicos en Nex. Cada intercambio confirma su origen y destino."/><IntercambioProyectian/></>});

export function BloqueVersionProyecto({proyecto}:{proyecto:ProyectoRow}){
 const q=useQuery({queryKey:['version_producto',proyecto.id],queryFn:async()=>{const {data,error}=await supabase.from('proyectian_objetos').select('datos,revision').eq('proyecto_id',proyecto.id).eq('entidad','proyectos');if(error)throw error;return data;}});
 return <section className="panel mb-4 space-y-2 p-4"><h2 className="font-semibold">Versión del producto</h2><p>Referencia de Nex: {proyecto.version_actual??'Sin versión'}</p>{q.error?<p role="alert">No se pudo consultar la copia de Proyectian.</p>:q.isPending?<p role="status">Comprobando la última copia…</p>:q.data?.length?q.data.map((d,i)=><p key={i}>Proyectian: {String((d.datos as Record<string,unknown>)['version_actual']??'Sin versión')} · Revisión del intercambio {d.revision}</p>):<p className="text-sm text-muted-foreground">Sin versión de Proyectian confirmada.</p>}<Link to="/proyectian" className="text-primary underline">Abrir intercambio y comprobar</Link></section>;
}
