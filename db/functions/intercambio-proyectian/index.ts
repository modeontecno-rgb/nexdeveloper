import {createClient} from 'npm:@supabase/supabase-js@2';
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST,OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json'}});
const encoder=new TextEncoder();
async function key(secret:string){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function signature(secret:string,text:string){return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');}
async function verify(secret:string,text:string,hex:string){if(!/^[a-f0-9]{64}$/.test(hex))return false;return crypto.subtle.verify('HMAC',await key(secret),Uint8Array.from(hex.match(/../g)!,b=>parseInt(b,16)),encoder.encode(text));}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return json({ok:false,error:'Solo POST'},405);
 let sb:any=null;let enlaceConfirmado:string|null=null;
 try{
  sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:{user},error:authError}=await sb.auth.getUser((req.headers.get('authorization')??'').replace(/^Bearer\s+/i,''));
  if(authError||!user)return json({ok:false,error:'Sin sesión'},401);
  const body=await req.json();
  const {data:link,error:le}=await sb.from('proyectian_enlaces').select('id,proyecto_id').eq('id',String(body.enlace_id)).eq('user_id',user.id).eq('activo',true).single();
  if(le||!link)return json({ok:false,error:'Enlace no autorizado'},403);
  enlaceConfirmado=link.id;
  // Destination cannot come from the request or business data. Independent key per link.
  const config=JSON.parse(Deno.env.get('INTERCAMBIO_DESTINOS')??'{}')[link.id];
  if(!config||typeof config.secreto!=='string'||config.secreto.length<32)throw new Error('Config');
  const target=new URL(config.url);
  if(target.protocol!=='https:'||!target.hostname.match(/^[a-z0-9]{20}\.supabase\.co$/)||target.port||target.username||target.password||target.search||target.hash||target.pathname!=='/functions/v1/intercambio-nex')throw new Error('Destino');
  const {data:entregas,error:de}=await sb.from('documentos_nex').select('id,user_id,proyecto_id,titulo,tipo,version,mime,bytes,sha256').eq('user_id',user.id).eq('proyecto_id',link.proyecto_id).eq('bucket','entregas').not('sha256','is',null).order('id').limit(501);if(de||!entregas||entregas.length>500)throw new Error('Registro demasiado grande o no disponible');
  const nonce=crypto.randomUUID();const raw=JSON.stringify({enlace_id:link.id,fecha:Date.now(),nonce,entregas});
  const response=await fetch(target,{method:'POST',headers:{'content-type':'application/json','x-intercambio-firma':await signature(config.secreto,raw)},body:raw,redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Origen');
  // Limit streamed response memory as well as the committed JSON size.
  const reader=response.body?.getReader();if(!reader)throw new Error('Vacío');
  let length=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>5000000){await reader.cancel();throw new Error('Tamaño');}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const text=new TextDecoder().decode(bytes);
  if(!await verify(config.secreto,text,response.headers.get('x-intercambio-firma')??''))throw new Error('Firma');
  const envelope=JSON.parse(text);if(envelope.nonce!==nonce)throw new Error('Respuesta ajena');
  const {data,error}=await sb.rpc('proyectian_recibir',{p_enlace:link.id,p_contenido:envelope.contenido});
  if(error)throw new Error('Revisión rechazada');
  await sb.from('proyectian_enlaces').update({ultimo_error:null}).eq('id',link.id);
  return json({ok:true,...data,entregas_recibidas:envelope.entregas_recibidas});
 }catch{if(sb&&enlaceConfirmado)await sb.from('proyectian_enlaces').update({ultimo_error:'Intercambio pendiente de confirmar. Reintenta desde la última copia conservada.'}).eq('id',enlaceConfirmado);return json({ok:false,error:'No se ha aplicado el intercambio. Se conserva la última copia; revisa el enlace y vuelve a intentarlo.'},409);}
});
