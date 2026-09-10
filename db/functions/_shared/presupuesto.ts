/** One reservation per provider request. No retry, FX assumption or implicit fallback. */
type DB = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>; from: (name: string) => any };
export type ContextoIA = { userId: string; modeloId: string; ambito: 'personal' | 'proyecto' | 'cartera'; proyectoId?: string | null; ejecucionId?: string | null; bloqueoToken?: string | null; operacion: string };
const hosts: Record<string, string[]> = {
 anthropic: ['api.anthropic.com'], openai: ['api.openai.com'], google: ['generativelanguage.googleapis.com'],
 deepseek: ['api.deepseek.com'], groq: ['api.groq.com'], mistral: ['api.mistral.ai'], xai: ['api.x.ai'], openrouter: ['openrouter.ai'],
};
const paths: Record<string,RegExp> = {
 anthropic:/^\/v1\/messages$/,google:/^\/v1beta\/models\/[^/]+:generateContent$/,
 openai:/^\/v1\/chat\/completions$/,groq:/^\/openai\/v1\/chat\/completions$/,
 deepseek:/^(\/v1)?\/chat\/completions$/,mistral:/^\/v1\/chat\/completions$/,
 xai:/^\/v1\/chat\/completions$/,openrouter:/^\/api\/v1\/chat\/completions$/,
};
export async function fetchIA(sb: DB, ctx: ContextoIA, url: string, init: RequestInit): Promise<Response> {
 if (!ctx.userId || !ctx.modeloId || init.method !== 'POST' || typeof init.body !== 'string') throw new Error('Falta contexto para contabilizar la llamada');
 const endpoint = new URL(url);
 const { data: model, error: me } = await sb.from('modelos_ia').select('id,identificador,proveedor_id').eq('id',ctx.modeloId).eq('user_id',ctx.userId).single();
 if (me || !model) throw new Error('Modelo no autorizado');
 const { data: provider, error: pe } = await sb.from('proveedores_ia').select('clave_slug').eq('id',model.proveedor_id).eq('user_id',ctx.userId).single();
 if (pe || endpoint.protocol !== 'https:' || endpoint.port || !hosts[provider?.clave_slug]?.includes(endpoint.hostname)) throw new Error('Proveedor sin adaptación económica verificada');
 if(!paths[provider.clave_slug]?.test(endpoint.pathname) || endpoint.username || endpoint.password) throw new Error('Operación de proveedor no autorizada por el contador');
 const body = JSON.parse(init.body);
 if((body.n??1)!==1 || (body.generationConfig?.candidateCount??1)!==1 || body.modalities?.some((m:string)=>m!=='text')) throw new Error('Solo se admite una respuesta de texto por reserva');
 if(body.tools?.some((t:any)=>(t.type && t.type!=='function') || t.google_search || t.web_search)) throw new Error('Herramientas de pago adicionales sin tarifa verificada');
 const imagenes=provider.clave_slug==='google'?(body.contents??[]).flatMap((c:any)=>(c.parts??[]).filter((p:any)=>p.inlineData).map((p:any)=>p.inlineData)):[];
 if(imagenes.length>5||imagenes.some((i:any)=>!['image/png','image/jpeg','image/webp'].includes(i.mimeType)||typeof i.data!=='string'||i.data.length>2800000||!/^[A-Za-z0-9+/]*={0,2}$/.test(i.data)))throw Error('Usa hasta cinco imágenes PNG, JPEG o WebP de menos de 2 MB cada una.');
 if(body.messages?.some((m:any)=>Array.isArray(m.content)&&m.content.some((c:any)=>!['text','tool_use','tool_result'].includes(c.type))) || body.contents?.some((c:any)=>c.parts?.some((p:any)=>typeof p.text!=='string'&&!p.functionCall&&!p.functionResponse&&!(provider.clave_slug==='google'&&p.inlineData)))) throw new Error('Entrada multimedia pendiente de adaptación económica');
 const modelSent = body.model ?? (endpoint.pathname.match(/\/models\/([^:]+):/)?.[1]);
 if (modelSent !== model.identificador || body.stream) throw new Error('Modelo distinto o transmisión sin contador');
 const output = body.max_tokens ?? body.max_completion_tokens ?? body.generationConfig?.maxOutputTokens;
 if (!Number.isSafeInteger(output) || output<1) throw new Error('La petición necesita un límite explícito de salida');
 // Reserve the verified maximum input capacity; tokenizers/provider framing differ.
 const { data: price, error: te } = await sb.from('ia_tarifas').select('max_entrada').eq('modelo_id',ctx.modeloId).eq('user_id',ctx.userId).single();
 const bytesEntrada = new TextEncoder().encode(init.body).byteLength;
 // Reserve a conservative estimate of this request, not the model's entire
 // configured context window. Reserving max_entrada made a short prompt with a
 // 200k-token model look like a full 200k-token call and exhausted every limit.
 const entradaReservada = imagenes.length ? Number(price?.max_entrada??0) : Math.max(1, Math.ceil(bytesEntrada / 2) + 1024);
 if (te || !price) throw new Error('Tarifa no verificada');
 if (entradaReservada > price.max_entrada) throw new Error('Contexto demasiado grande para el máximo de entrada configurado');
 const id = crypto.randomUUID();
 const { data: reservation, error: re } = await sb.rpc('ia_reservar',{p_id:id,p_user_id:ctx.userId,p_modelo_id:ctx.modeloId,p_ambito:ctx.ambito,p_proyecto_id:ctx.proyectoId??null,p_operacion:ctx.operacion,p_entrada:entradaReservada,p_salida:output,p_ejecucion_id:ctx.ejecucionId??null});
 if (re || reservation?.id !== id) throw new Error(`Llamada bloqueada: ${re?.message ?? 'no se pudo reservar el presupuesto'}`);
 let emitida=false;let httpEstado:number|null=null;let detalleSeguro="";let corteContabilizado:{coste:number;entrada:number;salida:number}|null=null;
 try {
   if(ctx.ejecucionId){
     if(!ctx.bloqueoToken)throw new Error('Ejecución sin bloqueo');
     const {data:execution,error:ee}=await sb.from('ejecuciones_orden').select('estado,bloqueo_token,bloqueo_hasta').eq('id',ctx.ejecucionId).eq('user_id',ctx.userId).single();
     if(ee||!execution||execution.bloqueo_token!==ctx.bloqueoToken||(!Number.isFinite(Date.parse(execution.bloqueo_hasta))||Date.parse(execution.bloqueo_hasta)<=Date.now())||!['enviando','construyendo','comprobando'].includes(execution.estado))throw new Error('La ejecución ya no está activa');
   }
   const timeout = AbortSignal.timeout(60000);
   const signal = init.signal ? AbortSignal.any([timeout,init.signal]) : timeout;
   emitida=true;
   const response = await fetch(url,{...init,signal,redirect:'error'});
   httpEstado=response.status;
   const data = await response.clone().json();
   if(!response.ok)detalleSeguro=String(data.error?.status??data.error?.type??data.error?.code??"rechazo del proveedor").slice(0,80);
   const u = data.usage ?? data.usageMetadata;
   // Include cached prompt tokens and Google's thinking tokens conservatively.
   const input = u?.input_tokens != null ? u.input_tokens + (u.cache_creation_input_tokens??0) + (u.cache_read_input_tokens??0) : (u?.prompt_tokens ?? u?.promptTokenCount);
   const reportedOutput = u?.output_tokens ?? u?.completion_tokens ?? (u?.candidatesTokenCount != null ? u.candidatesTokenCount+(u.thoughtsTokenCount??0) : undefined);
   const total=u?.total_tokens??u?.totalTokenCount;
   const outputUsed=Number.isSafeInteger(total)&&Number.isSafeInteger(input)?Math.max(reportedOutput??0,total-input):reportedOutput;
   const valid = Number.isSafeInteger(input) && input>=0 && Number.isSafeInteger(outputUsed) && outputUsed>=0;
   const { data: settled, error: se } = await sb.rpc('ia_liquidar',{p_id:id,p_user_id:ctx.userId,p_entrada:valid?input:null,p_salida:valid?outputUsed:null});
   if (se || !settled) throw new Error('Respuesta recibida, pero el consumo queda pendiente de conciliación');
   if (!response.ok) throw new Error(`El proveedor respondió con error ${response.status}; la reserva se conserva si falta el consumo`);
   if (!valid || settled.estado !== 'liquidada') throw new Error('Proveedor sin uso verificable: consumo pendiente de conciliación');
   if(data.stop_reason==='max_tokens'||data.choices?.some((c:any)=>c.finish_reason==='length')||data.candidates?.some((c:any)=>c.finishReason==='MAX_TOKENS')){corteContabilizado={coste:Number(settled.coste),entrada:input,salida:outputUsed};throw new Error('Respuesta incompleta por límite de salida; consumo contabilizado');}
   return new Response(JSON.stringify({...data,_nex_coste_eur:Number(settled.coste),_nex_reserva:id}),{status:response.status,headers:{'content-type':'application/json'}});
 } catch (error) {
   // Unknown transport outcome is not a refund: the provider may have processed it.
   await sb.rpc('ia_liquidar',{p_id:id,p_user_id:ctx.userId,p_entrada:emitida?null:0,p_salida:emitida?null:0});
   const motivoSeguro=(error as Error)?.name === "TimeoutError" ? "El proveedor no respondió dentro del límite de espera de 60 segundos" : /Respuesta incompleta|consumo queda pendiente|Proveedor sin uso verificable|ejecución ya no está activa/.test(String((error as Error)?.message))?String((error as Error).message):"";
   const fallo = new Error(`${motivoSeguro?motivoSeguro+". ":""}La llamada no pudo confirmarse${httpEstado?` (HTTP ${httpEstado}${detalleSeguro?": "+detalleSeguro:""})`:""}. Revisa el consumo o reserva ${id} antes de repetirla.`);
   if(corteContabilizado && Number.isFinite(corteContabilizado.coste) && corteContabilizado.coste>=0)Object.assign(fallo,{codigo:"SALIDA_TRUNCADA_CONTABILIZADA",...corteContabilizado,reserva:id});
   throw fallo;
 }
}

/** Adapter for legacy workflows that choose by provider/model slug. */
export async function fetchIADeUsuario(sb: DB,userId: string,proyectoId: string|null,operacion: string,url: string,init: RequestInit): Promise<Response> {
 if(typeof init.body!=='string') throw new Error('Formato de llamada de IA no compatible');
 const endpoint=new URL(url),body=JSON.parse(init.body);
 const slug=Object.keys(hosts).find(key=>hosts[key].includes(endpoint.hostname));
 if(!slug) throw new Error('Proveedor pendiente de verificación económica');
 const model=body.model??endpoint.pathname.match(/\/models\/([^:]+):/)?.[1];
 if(!model) throw new Error('Falta el modelo de la llamada');
 const {data:provider,error:pe}=await sb.from('proveedores_ia').select('id').eq('user_id',userId).eq('clave_slug',slug).eq('activo',true).single();
 if(pe || !provider) throw new Error('Proveedor no configurado de forma única');
 const {data:configured,error:me}=await sb.from('modelos_ia').select('id').eq('user_id',userId).eq('proveedor_id',provider.id).eq('identificador',model).eq('activo',true).single();
 if(me || !configured) throw new Error('Modelo no configurado de forma única');
 // Older classifiers omitted output limits. Set an explicit bounded output.
 if(slug==='google') body.generationConfig={...body.generationConfig,maxOutputTokens:body.generationConfig?.maxOutputTokens??1000};
 else if(body.max_tokens==null && body.max_completion_tokens==null) body.max_tokens=1000;
 return fetchIA(sb,{userId,modeloId:configured.id,ambito:proyectoId?'proyecto':'cartera',proyectoId,operacion},url,{...init,body:JSON.stringify(body)});
}
