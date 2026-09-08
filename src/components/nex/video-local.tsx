import {useProyectos} from '@/lib/nex/queries/datos';
import {useSubirDocumento,archivoABase64} from '@/lib/nex/queries/documentacion';
import {useEffect,useRef,useState} from 'react';
import {Loader2} from 'lucide-react';
import {toast} from 'sonner';
import {renderizarVideo} from '@/lib/nex/video-local';
import {Boton,Campo,claseCampo} from './campos';
export function VideoLocal(){
 const proyectos=useProyectos(),subir=useSubirDocumento();const [proyecto,setProyecto]=useState(''),[archivo,setArchivo]=useState<Blob|null>(null);
 const [audio,setAudio]=useState<File|null>(null);
 const [guion,setGuion]=useState(''),[segundos,setSegundos]=useState(5),[progreso,setProgreso]=useState<number|null>(null),[url,setUrl]=useState<string|null>(null);
 const controller=useRef<AbortController|null>(null),vivo=useRef(true);
 useEffect(()=>{vivo.current=true;return()=>{vivo.current=false;controller.current?.abort();}},[]);
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url)},[url]);
 async function generar(){if(controller.current)return;const c=new AbortController();controller.current=c;setProgreso(0);setUrl(null);setArchivo(null);
 try{const scenes=guion.split(/\n\s*\n/).map(b=>b.trim()).filter(Boolean).map((b,i)=>{const [titulo,...resto]=b.split('\n');return {titulo:resto.length?titulo!:`Diapositiva ${i+1}`,texto:resto.length?resto.join(' '):titulo!,segundos};});const blob=await renderizarVideo(scenes,p=>{if(vivo.current)setProgreso(p)},c.signal,audio);if(vivo.current){setArchivo(blob);setUrl(URL.createObjectURL(blob));toast.success('Vídeo WebM generado en este dispositivo.');}}
 catch(e){if(vivo.current)toast.error((e as Error).name==='AbortError'?'Creación de vídeo detenida.':(e as Error).message);}
 finally{controller.current=null;if(vivo.current)setProgreso(null);}}
 return <details className="panel mb-5 p-5"><summary className="cursor-pointer font-semibold">Crear vídeo de diapositivas en este dispositivo</summary><div className="mt-3 space-y-3"><p className="text-sm text-muted-foreground">Sin llamadas a IA. Cada bloque separado por una línea vacía es una diapositiva; su primera línea es el título. Puedes adjuntar una locución propia de hasta 10 MB; se procesa aquí y se incorpora al WebM. Sin archivo de audio, el vídeo será silencioso. Mantén esta pantalla visible durante la grabación.</p><Campo etiqueta="Guion del vídeo"><textarea className={claseCampo} rows={7} value={guion} onChange={e=>setGuion(e.target.value)} placeholder={'Título de la primera diapositiva\nExplicación breve.\n\nSegunda diapositiva\nSiguiente paso.'}/></Campo><Campo etiqueta="Segundos por diapositiva"><input className={claseCampo} type="number" min={2} max={15} value={Number.isFinite(segundos)?segundos:''} onChange={e=>setSegundos(e.target.valueAsNumber)}/></Campo>
 <Campo etiqueta="Locución opcional (archivo de audio)"><input className={claseCampo} type="file" accept="audio/*" disabled={progreso!==null} onChange={e=>setAudio(e.target.files?.[0]??null)}/></Campo><p className="text-xs text-muted-foreground">La locución debe caber completa en la duración del vídeo. Para quitarla, vacía el selector. El archivo original se conserva en tu dispositivo.</p>
 {progreso!==null?<div role="status" className="space-y-2"><p><Loader2 className="mr-2 inline size-4 animate-spin motion-reduce:animate-none"/>Grabando fotogramas: {progreso}%</p><progress className="w-full" max={100} value={progreso} aria-label="Grabación del vídeo"/><Boton variante="suave" onClick={()=>controller.current?.abort()}>Detener</Boton></div>:<Boton disabled={!guion.trim()} onClick={()=>void generar()}>Crear vídeo local</Boton>}
 {url?<div className="space-y-2"><video controls src={url} className="w-full rounded-lg"/><a className="text-primary underline" href={url} download="video-de-diapositivas.webm">Descargar vídeo WebM</a><Campo etiqueta="Guardar vídeo en un proyecto"><select className={claseCampo} value={proyecto} onChange={e=>setProyecto(e.target.value)}><option value="">Selecciona un proyecto</option>{proyectos.data?.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Campo><Boton disabled={!proyecto||!archivo||subir.isPending} onClick={()=>void (async()=>{try{if(!archivo)return;const contenido=await archivoABase64(new File([archivo],'video-de-diapositivas.webm',{type:'video/webm'}));await subir.mutateAsync({proyecto_id:proyecto,tipo:'video',titulo:'Vídeo de diapositivas',nombre_archivo:'video-de-diapositivas.webm',mime:'video/webm',contenido_base64:contenido});toast.success('Vídeo guardado y verificado en Documentación.');}catch(e){toast.error((e as Error).message);}})()}>{subir.isPending?'Guardando y verificando…':'Registrar vídeo en Documentación'}</Boton></div>:null}
 </div></details>;
}
