export type EscenaLocal={titulo:string;texto:string;segundos:number};
export function validarEscenas(escenas:EscenaLocal[]){
 if(!escenas.length||escenas.length>20)throw new Error('Usa entre 1 y 20 diapositivas.');
 let total=0;
 for(const e of escenas){if(!e.titulo.trim()||e.titulo.length>90||!e.texto.trim()||e.texto.length>450||!Number.isFinite(e.segundos)||e.segundos<2||e.segundos>15)throw new Error('Cada diapositiva admite título de 90 caracteres, texto de 450 y duración de 2 a 15 segundos.');total+=e.segundos;}
 if(total>120)throw new Error('El vídeo local admite hasta dos minutos.');
 return total;
}
export function validarAudioLocal(bytes:number,duracion:number,total:number){
 if(!Number.isFinite(bytes)||bytes<=0||bytes>10000000)throw new Error('La locución debe ocupar entre 1 byte y 10 MB.');
 if(!Number.isFinite(duracion)||duracion<=0||duracion>total)throw new Error('La locución debe durar como máximo lo mismo que el vídeo. Amplía las diapositivas para conservarla completa.');
}
export async function renderizarVideo(escenas:EscenaLocal[],onProgreso:(porcentaje:number)=>void,signal:AbortSignal,audio:File|null=null):Promise<Blob>{
 const total=validarEscenas(escenas);
 if(typeof MediaRecorder==='undefined'||typeof HTMLCanvasElement.prototype.captureStream!=='function')throw new Error('Este navegador no admite la creación de vídeo local.');
 const mime=(audio?['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus']:['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm']).find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw new Error('No hay codificador WebM disponible.');
 if(signal.aborted)throw new DOMException('Cancelado','AbortError');
 if(document.hidden)throw new Error('Mantén visible esta pantalla mientras se graba el vídeo.');
 const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
 const drawingContext=canvas.getContext('2d');if(!drawingContext)throw new Error('No se puede crear el lienzo.');const ctx:CanvasRenderingContext2D=drawingContext;
 const stream=canvas.captureStream(25);let recorder:MediaRecorder;
 let audioContext:AudioContext|null=null,source:AudioBufferSourceNode|null=null;
 const limpiarAudio=()=>{try{source?.stop();}catch{/* May not have started. */}source?.disconnect();if(audioContext)void audioContext.close();};
 try{
  if(audio){
   validarAudioLocal(audio.size,1,total);
   audioContext=new AudioContext();await audioContext.resume();
   const buffer=await audioContext.decodeAudioData(await audio.arrayBuffer());validarAudioLocal(audio.size,buffer.duration,total);
   if(audioContext.state!=='running')throw new Error('El navegador no ha activado el audio. Vuelve a pulsar Crear vídeo.');
   const destination=audioContext.createMediaStreamDestination();source=audioContext.createBufferSource();source.buffer=buffer;source.connect(destination);
   destination.stream.getAudioTracks().forEach(track=>stream.addTrack(track));
  }
  if(signal.aborted)throw new DOMException('Cancelado','AbortError');
  if(document.hidden)throw new Error('Mantén visible la pantalla mientras se graba.');
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1800000,audioBitsPerSecond:96000});
 }catch(e){limpiarAudio();stream.getTracks().forEach(t=>t.stop());throw e;}
 let frame=0;const chunks:Blob[]=[];let fallo:Error|null=null,bytes=0;
 const ended=new Promise<Blob>((resolve,reject)=>{
  recorder.ondataavailable=e=>{if(e.data.size){bytes+=e.data.size;if(bytes>20000000){fallo=new Error('El vídeo supera 20 MB. Reduce su duración.');if(recorder.state!=='inactive')recorder.stop();}else chunks.push(e.data);}};
  recorder.onerror=()=>{fallo=new Error('El navegador no pudo codificar el vídeo.');if(recorder.state!=='inactive')recorder.stop();else reject(fallo);};
  recorder.onstop=()=>{if(fallo)reject(fallo);else if(signal.aborted)reject(new DOMException('Cancelado','AbortError'));else if(!chunks.length)reject(new Error('No se han grabado fotogramas.'));else resolve(new Blob(chunks,{type:'video/webm'}));};
 });
 const visibilidad=()=>{if(document.hidden){fallo=new Error('Grabación detenida al ocultar la pantalla. El guion se conserva; vuelve a generar con la pantalla visible.');if(recorder.state!=='inactive')recorder.stop();}};document.addEventListener('visibilitychange',visibilidad);
 const abort=()=>{if(recorder.state!=='inactive')recorder.stop();};signal.addEventListener('abort',abort,{once:true});
 const draw=(elapsed:number)=>{
  let offset=0,index=escenas.length-1;for(let i=0;i<escenas.length;i++){offset+=escenas[i]!.segundos;if(elapsed<offset){index=i;break;}}
  const scene=escenas[index]!;
  ctx.fillStyle='#0f202a';ctx.fillRect(0,0,1280,720);ctx.fillStyle='#55d5c9';ctx.fillRect(70,62,54,7);
  function block(text:string,y:number,font:string,lineHeight:number){ctx.font=font;let line='';for(const word of text.split(/\s+/)){if(ctx.measureText(line+word).width>1120){if(y>615)throw new Error('La diapositiva no cabe: reduce el texto.');ctx.fillText(line,70,y);y+=lineHeight;line='';}for(const char of word+' '){if(ctx.measureText(line+char).width>1120){if(y>615)throw new Error('La diapositiva no cabe: reduce el texto.');ctx.fillText(line,70,y);y+=lineHeight;line='';}line+=char;}}if(line){if(y>615)throw new Error('La diapositiva no cabe: reduce el texto.');ctx.fillText(line,70,y);}}
  ctx.fillStyle='#ffffff';block(scene.titulo,135,'bold 38px sans-serif',48);ctx.fillStyle='#d2e3eb';block(scene.texto,275,'28px sans-serif',42);
  ctx.font='20px sans-serif';ctx.fillStyle='#91adb9';ctx.fillText(`${index+1} / ${escenas.length} · Vídeo de diapositivas`,70,660);
  ctx.fillStyle='#55d5c9';ctx.fillRect(70,683,1120*Math.min(1,elapsed/total),4);
 };
 let started=0;const requested=performance.now();
 const tick=()=>{if(recorder.state==='inactive')return;try{if(!started&&performance.now()-requested>10000)throw new Error('El codificador no ha arrancado. Vuelve a generar el vídeo.');const elapsed=started?(performance.now()-started)/1000:0;draw(elapsed);onProgreso(Math.min(99,Math.floor(elapsed/total*100)));if(elapsed>=total){recorder.stop();return;}frame=requestAnimationFrame(tick);}catch(e){fallo=e as Error;try{recorder.stop();}catch{ /* Already stopped. */ }}};
 recorder.onstart=()=>{started=performance.now();};
 try{draw(0);recorder.start(500);source?.start();frame=requestAnimationFrame(tick);const result=await ended;onProgreso(100);return result;}
 finally{limpiarAudio();document.removeEventListener('visibilitychange',visibilidad);cancelAnimationFrame(frame);signal.removeEventListener('abort',abort);if(recorder.state!=='inactive')recorder.stop();stream.getTracks().forEach(t=>t.stop());}
}
