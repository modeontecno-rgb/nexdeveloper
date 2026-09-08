import { Mic, MicOff } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Boton } from "@/components/nex/campos";
import { cn } from "@/lib/utils";

type ResultadoVoz = ArrayLike<{transcript?:string}> & {isFinal:boolean};
type Reconocimiento = {lang:string;continuous:boolean;interimResults:boolean;start:()=>void;stop:()=>void;abort:()=>void;onstart:(()=>void)|null;onend:(()=>void)|null;onerror:((e:{error?:string})=>void)|null;onresult:((e:{resultIndex:number;results:ArrayLike<ResultadoVoz>})=>void)|null};
/** Capture, waveform and recognition share one lifecycle. Audio is never stored. */
export function useDictado(alTexto:(texto:string)=>void){
 const [escuchando,setEscuchando]=React.useState(false),[iniciando,setIniciando]=React.useState(false),[soportado,setSoportado]=React.useState(false),[parcial,setParcial]=React.useState("");
 const lienzoOnda=React.useRef<HTMLCanvasElement|null>(null),textoRef=React.useRef(alTexto),rec=React.useRef<Reconocimiento|null>(null);
 textoRef.current=alTexto;
 const terminando=React.useRef(false), reconocimientoIniciado=React.useRef(false);
 const media=React.useRef<MediaStream|null>(null),audio=React.useRef<AudioContext|null>(null),frame=React.useRef(0),sesion=React.useRef(0),activo=React.useRef(false),montado=React.useRef(false),indices=React.useRef(new Set<number>());
 const limpiar=React.useCallback(()=>{
   activo.current=false; sesion.current++; cancelAnimationFrame(frame.current);
   media.current?.getTracks().forEach(t=>t.stop());media.current=null;
   void audio.current?.close();audio.current=null;
   if(montado.current){setEscuchando(false);setIniciando(false);setParcial("");}
 },[]);
 React.useEffect(()=>{
  montado.current=true;
  const w=window as unknown as {SpeechRecognition?:new()=>Reconocimiento;webkitSpeechRecognition?:new()=>Reconocimiento};
  const Ctor=w.SpeechRecognition??w.webkitSpeechRecognition;
  if(Ctor && typeof navigator.mediaDevices?.getUserMedia === "function"){
   setSoportado(true);const r=new Ctor();rec.current=r;r.lang="es-ES";r.continuous=true;r.interimResults=true;
   r.onstart=()=>{if(montado.current&&activo.current){setEscuchando(true);setIniciando(false);}};
   r.onend=()=>{terminando.current=false;reconocimientoIniciado.current=false;limpiar();};
   r.onerror=e=>{terminando.current=false;reconocimientoIniciado.current=false;limpiar();if(montado.current)toast.error(e.error==='not-allowed'?'No se concedió acceso al micrófono. Puedes escribir el texto.':'El dictado se ha detenido. Tu texto se conserva.');};
   r.onresult=e=>{if(!montado.current)return;let texto="",temporal="";for(let i=e.resultIndex;i<e.results.length;i++){const item=e.results[i];if(!item)continue;if(item.isFinal&&!indices.current.has(i)){indices.current.add(i);texto+=(item[0]?.transcript??"")+" ";}else if(!item.isFinal)temporal+=item[0]?.transcript??"";}if(texto.trim())textoRef.current(texto.trim());setParcial(temporal);};
  }
  return ()=>{montado.current=false;if(rec.current){rec.current.onresult=null;rec.current.onend=null;rec.current.onerror=null;rec.current.abort();}limpiar();};
 },[limpiar]);
 const alternar=async()=>{
  if(!rec.current || terminando.current)return;
  if(activo.current){terminando.current=reconocimientoIniciado.current;try{if(reconocimientoIniciado.current)rec.current.stop();}catch{terminando.current=false;}limpiar();return;}
  activo.current=true;setIniciando(true);indices.current.clear();const version=++sesion.current;
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   if(!montado.current||!activo.current||sesion.current!==version){stream.getTracks().forEach(t=>t.stop());return;}
   media.current=stream;
   const context=new AudioContext();audio.current=context;await context.resume();
   if(!activo.current||sesion.current!==version){stream.getTracks().forEach(t=>t.stop());void context.close();return;}
   const analyser=context.createAnalyser();analyser.fftSize=2048;context.createMediaStreamSource(stream).connect(analyser);
   const samples=new Uint8Array(analyser.frequencyBinCount);
   const draw=()=>{if(!activo.current)return;const canvas=lienzoOnda.current,ctx=canvas?.getContext('2d');if(canvas&&ctx){canvas.width=canvas.clientWidth||240;canvas.height=48;analyser.getByteTimeDomainData(samples);ctx.clearRect(0,0,canvas.width,48);ctx.strokeStyle=getComputedStyle(canvas).color;ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<samples.length;i++){const x=i*canvas.width/samples.length,y=24+(samples[i]!-128)/128*21;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}frame.current=requestAnimationFrame(draw);};
   reconocimientoIniciado.current=true;rec.current.start();draw();
  }catch{reconocimientoIniciado.current=false;limpiar();toast.error('No se pudo iniciar el dictado. Puedes seguir escribiendo.');}
 };
 return {escuchando,iniciando,soportado,alternar,parcial,lienzoOnda};
}

/** Une lo dictado al texto que ya hubiera escrito. */
export function unirDictado(actual: string, dicho: string) {
  const base = actual.trimEnd();
  return base ? `${base} ${dicho}` : dicho;
}

/** Botón de micrófono para dictar dentro de un campo de texto. */
export function BotonDictado({
  onTexto,
  etiqueta = "Dictar",
  className,
}: {
  onTexto: (t: string) => void;
  etiqueta?: string;
  className?: string;
}) {
  const { escuchando, iniciando, soportado, alternar, lienzoOnda } = useDictado(onTexto);
  return (
    <span className="inline-flex items-center gap-2">
    <Boton
      type="button"
      disabled={!soportado}
      title={!soportado ? "Dictado no disponible en este navegador; puedes escribir." : "El reconocimiento de voz depende del navegador. Revisa el texto antes de enviarlo."}
      variante="suave"
      aria-label={escuchando ? "Dejar de dictar" : etiqueta}
      onClick={alternar}
      className={cn("px-3 py-1.5 text-xs", escuchando && "border-primary/60 text-primary", className)}
    >
      {escuchando ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
      {iniciando ? "Iniciando…" : escuchando ? "Te escucho…" : etiqueta}
    </Boton>
    {escuchando && <canvas aria-label="Onda del micrófono en directo" ref={lienzoOnda} className="h-8 w-24 text-primary" />}
    </span>
  );
}
