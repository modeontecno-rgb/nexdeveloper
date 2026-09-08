import {PDFDocument} from 'npm:pdf-lib@1.17.1';
import {crearPDF} from './pdf.ts';
export async function guardarEntrega(sb:any,userId:string,proyectoId:string,tipo:string,titulo:string,nombre:string,mime:string,bytes:Uint8Array,version:string|null=null){
 if(!bytes.length||bytes.length>20000000)throw new Error('Archivo vacío o mayor de 20 MB');
 const firmas:Record<string,(b:Uint8Array)=>boolean>={
 'application/pdf':b=>new TextDecoder().decode(b.slice(0,5))==='%PDF-',
 'video/webm':b=>[0x1a,0x45,0xdf,0xa3].every((v,i)=>b[i]===v),
 'audio/mpeg':b=>(b[0]===0x49&&b[1]===0x44&&b[2]===0x33)||(b[0]===0xff&&(b[1]&0xe0)===0xe0),
 'text/markdown':b=>{try{new TextDecoder('utf-8',{fatal:true}).decode(b);return true;}catch{return false;}},
 };
 if(!firmas[mime]?.(bytes)||(tipo==='video'&&mime!=='video/webm')||(tipo==='manual'&&mime!=='application/pdf'&&mime!=='text/markdown'))throw new Error('El contenido no corresponde al formato permitido (PDF, WebM, MP3 o Markdown)');
 if(mime==='application/pdf'){try{const pdf=await PDFDocument.load(bytes);if(pdf.getPageCount()<1)throw new Error('Empty');}catch{throw new Error('El PDF no se puede abrir o no contiene páginas');}}
 const {data:p,error:pe}=await sb.from('proyectos').select('id').eq('id',proyectoId).eq('user_id',userId).single();if(pe||!p)throw new Error('Proyecto no autorizado');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer))).map(n=>n.toString(16).padStart(2,'0')).join('');
 const extension:Record<string,string>={'application/pdf':'pdf','video/webm':'webm','audio/mpeg':'mp3','text/markdown':'md'};
 const ruta=`${userId}/${proyectoId}/archivos/${hash}.${extension[mime]}`;
 const {error:ue}=await sb.storage.from('entregas').upload(ruta,bytes,{contentType:mime,upsert:false});
 if(ue){const {data:old,error:oe}=await sb.storage.from('entregas').download(ruta);if(oe||!old)throw new Error('No se pudo guardar el archivo');const h=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await old.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('');if(h!==hash)throw new Error('Archivo existente diferente');}
 const {data:id,error:re}=await sb.rpc('registrar_entrega',{p_usuario:userId,p_proyecto:proyectoId,p_tipo:tipo,p_titulo:titulo,p_nombre:nombre,p_mime:mime,p_ruta:ruta,p_sha:hash,p_bytes:bytes.length,p_version:version});
 if(re||!id)throw new Error('Archivo guardado; registro pendiente. Puedes reintentar sin duplicarlo.');
 return {id,ruta_remota:ruta,sha256:hash};
}
export async function guardarPDF(sb:any,userId:string,proyectoId:string,tipo:string,titulo:string,texto:string,nombre:string,version:string|null=null){
 const bytes=await crearPDF(titulo,texto,await Deno.readFile(new URL('./fonts/noto-sans.woff',import.meta.url)));
 return guardarEntrega(sb,userId,proyectoId,tipo,titulo,nombre,'application/pdf',bytes,version);
}
