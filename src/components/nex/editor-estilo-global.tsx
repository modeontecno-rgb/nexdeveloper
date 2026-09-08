import {useState} from 'react';
import {Loader2} from 'lucide-react';
import {toast} from 'sonner';
import {supabase} from '@/lib/nex/supabase';
import {useProyectos} from '@/lib/nex/queries/datos';
import {Dialogo} from './dialogo';
import {Boton,Campo,claseCampo} from './campos';
export function EditorEstiloGlobal(){
 const [abierto,setAbierto]=useState(false),[texto,setTexto]=useState(''),[resultado,setResultado]=useState<string|null>(null),[modo,setModo]=useState('desactivado'),[ambito,setAmbito]=useState(''),[ocupado,setOcupado]=useState(false);const proyectos=useProyectos();
 async function revisar(){if(ocupado)return;if(modo==='desactivado'){setResultado(texto);return;}if(!ambito){toast.error('Selecciona Personal o un proyecto.');return;}setOcupado(true);setResultado(null);
 try{const {data,error}=await supabase.functions.invoke('personal',{body:{accion:'reescribir',texto,modo,...(ambito==='personal'?{}:{proyecto_id:ambito})}});if(error||!data?.ok)throw new Error(data?.error??'No se ha confirmado la revisión. Consulta Consumo antes de repetir.');setResultado(data.texto_resultado);toast.success('Revisión guardada con su original.');}catch(e){toast.error((e as Error).message);}finally{setOcupado(false);}}
 return <><Boton variante="suave" onClick={()=>setAbierto(true)}>Revisar estilo</Boton><Dialogo abierto={abierto} titulo="Revisar el estilo de cualquier texto" descripcion="Pega un texto de tu trabajo. Conservamos el original; el resultado necesita tu revisión. No se garantiza superar detectores de IA." onCerrar={()=>{if(!ocupado)setAbierto(false);}}><div className="space-y-4">
 <Campo etiqueta="Ámbito del texto"><select className={claseCampo} disabled={ocupado} value={ambito} onChange={e=>setAmbito(e.target.value)}><option value="">Selecciona el destino</option><option value="personal">Personal · fuera de proyectos</option>{proyectos.data?.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Campo>
 <Campo etiqueta="Estilo seleccionable"><select className={claseCampo} disabled={ocupado} value={modo} onChange={e=>setModo(e.target.value)}><option value="desactivado">Desactivado · conservar original, sin IA</option><option value="natural">Natural y claro</option><option value="mi_voz">Mi voz · perfil personal</option><option value="marca" disabled={!ambito||ambito==='personal'}>Estilo del proyecto</option></select></Campo>
 <Campo etiqueta="Texto original"><textarea className={claseCampo} rows={8} maxLength={40000} value={texto} disabled={ocupado} onChange={e=>{setTexto(e.target.value);setResultado(null);}}/></Campo>
 <p className="text-xs text-muted-foreground">{modo==='desactivado'?'Sin llamadas a modelos.':'Se aplica la tarifa verificada y los límites de Consumo. Cifras, enlaces y bloques de código se comprueban automáticamente.'}</p>
 <Boton disabled={ocupado||!texto} onClick={()=>void revisar()}>{ocupado?<><Loader2 className="size-4 animate-spin"/>Revisando…</>:'Preparar resultado'}</Boton>
 {resultado!==null?<><Campo etiqueta="Resultado revisable"><textarea className={claseCampo} rows={8} value={resultado} onChange={e=>setResultado(e.target.value)}/></Campo><div className="flex flex-wrap gap-2"><Boton variante="suave" onClick={()=>setResultado(texto)}>Volver al original</Boton><Boton variante="suave" onClick={()=>void navigator.clipboard.writeText(resultado).then(()=>toast.success('Texto copiado.'),()=>toast.error('No se pudo copiar; selecciona el resultado.'))}>Copiar resultado</Boton></div></>:null}
 </div></Dialogo></>;
}
