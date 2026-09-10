const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
let source=fs.readFileSync(path.join(__dirname,'../../db/functions/ordenes-ejecutar/index.ts'),'utf8');source+='\nglobalThis.engineTests={pasoAgente,publicarRama,verificarCI,conBloqueo};';
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function load(o={}){
 let calls=[],providerCalls=[],rpcCalls=[],updates=[],now=0;
 class Clock extends Date{static now(){return now}}
 const ctx={exports:{},Date:Clock,Response,Request,URL,Headers,TextEncoder,TextDecoder,AbortSignal,crypto:require('node:crypto').webcrypto,console,setTimeout,clearTimeout,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://fixture.invalid':k==='GITHUB_TOKEN'?'fixture':undefined},serve(){}},require(name){if(name.includes('equipo')||name.includes('mejoras')||name.includes('cola')){const out={exports:{},require:ctx.require};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../db/functions/_shared/'+(name.includes('equipo')?'equipo':name.includes('cola')?'cola':'mejoras')+'.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,out);return out.exports;}if(name.startsWith('npm:'))return {createClient(){}};if(name.includes('presupuesto'))return {fetchIA:async(_sb,_context,_url,init)=>{providerCalls.push(JSON.parse(init.body));if(o.response){if(providerCalls.length>4)throw Error('Fixture exhausted');return new Response(JSON.stringify({usage:{input_tokens:10,output_tokens:10},_nex_coste_eur:.001,content:o.response(providerCalls.length)}));}return new Response(JSON.stringify({usage:{input_tokens:10,output_tokens:10},_nex_coste_eur:.001,content:[{type:'tool_use',id:'bad',name:'escribir_archivo',input:{ruta:'danger.ts',contenido:'overwrite'}},{type:'tool_use',id:'done',name:'terminar',input:{resumen:'Plan fixture'}}]}))}};throw Error(name)},fetch:async(url,init={})=>{calls.push({url,method:init.method??'GET'});if(o.remote)return new Response(JSON.stringify(o.remote(url)));throw Error('Unexpected external operation')}};
 vm.runInNewContext(js,ctx);now=200000; // Simulates a warm runtime idle longer than its per-request budget.
 const e={id:'execution',user_id:'user',proyecto_id:'project',modo:'planificar',estado:'construyendo',bloqueo_token:'claim',bloqueo_hasta:'2099-01-01',estado_agente:{base:'main',base_sha:'a'.repeat(40),arbol:[],mensajes:[{role:'user',content:'Plan'}]},cambios:{}};
 const db={from(table){let columns='';const q={select(s){columns=s;return q},eq(){return q},gt(){return q},neq(){return q},update(value){updates.push(JSON.parse(JSON.stringify(value)));return q},maybeSingle:async()=>({data:table==='proveedores_ia'?{id:'provider'}:table==='modelos_ia'?{id:'model'}:{id:e.id},error:null}),single:async()=>({data:table==='proveedores_ia'?{id:'provider'}:table==='ejecuciones_orden'?{...e,estado:o.cancelled?'cancelada':e.estado}:null,error:null})};return q},async rpc(name,args){rpcCalls.push({name,args});return {data:name==='gasto_ia_permitido'?true:name==='descifrar_clave_proveedor'?'fixture-key':name==='reclamar_ejecucion'?!o.busy:true,error:null}}};
 return {f:ctx.engineTests,db,e,calls,providerCalls,rpcCalls,updates};
}
(async()=>{const tests=[];const add=(name,passed)=>tests.push({name,passed:!!passed});
 let a=load();let r=await a.f.pasoAgente(a.db,a.e,{repositorio:'fixture/repo'},{max_pasos:4,max_coste_ia:1});
 add('X01 Warm runtime still processes a new request',a.providerCalls.length===1);
 add('X02 Plan request excludes writing tools',a.providerCalls[0].tools.every(x=>!['escribir_archivo','borrar_archivo'].includes(x.name)));
 add('X03 Hallucinated write in plan cannot change files',Object.keys(r.cambios).length===0&&a.calls.length===0&&r.st.mensajes.at(-1).content[0].content.includes('ERROR'));
 a=load({cancelled:true});let rejected=false;try{await a.f.pasoAgente(a.db,a.e,{repositorio:'fixture/repo'},{})}catch{rejected=true}add('X04 Cancellation stops provider invocation',rejected&&a.providerCalls.length===0);
 a=load({remote:()=>({object:{sha:'b'.repeat(40)}})});rejected=false;try{await a.f.publicarRama(a.e,{repositorio:'fixture/repo'},a.e.estado_agente,{'x.ts':'old change'},'summary')}catch{rejected=true}add('X05 Changed base prevents all GitHub writes',rejected&&a.calls.length===1&&a.calls[0].method==='GET');
 a=load({busy:true});let worked=false;await a.f.conBloqueo(a.db,a.e,async()=>{worked=true});add('X06 Busy execution is not processed twice',!worked&&a.rpcCalls.length===1);
 a=load();try{await a.f.conBloqueo(a.db,a.e,async()=>{throw Error('fixture failure')})}catch{}add('X07 Worker releases its claim on failure',a.rpcCalls.at(-1).name==='liberar_ejecucion'&&a.rpcCalls.at(-1).args.p_token===a.rpcCalls[0].args.p_token);
 a=load({remote:url=>url.includes('check-runs')?{total_count:1,check_runs:[{name:'build-and-test',app:{slug:'github-actions'},head_sha:'a'.repeat(40),status:'completed',conclusion:'failure'}]}:{head:{sha:'a'.repeat(40)},state:'open',draft:false}});rejected=false;try{await a.f.verificarCI('fixture/repo',1,'a'.repeat(40))}catch{rejected=true}add('X08 Failed checks prevent publishing',rejected&&a.calls.every(c=>c.method==='GET'));

 const tool=(name,input)=>({type:'tool_use',id:name,name,input});
 const phase=(papel,tarea)=>({papel,tarea,modelo:{id:'model',proveedor_id:'provider',proveedor:'anthropic',identificador:'claude'},estado:'pendiente'});
 const task={id:'api',titulo:'API',papel:'backend',depende_de:[],aceptacion:['Tenant isolation tested']};
 const auto=(a,phases)=>{a.e.equipo_automatico=true;a.e.modo='construir';Object.assign(a.e.estado_agente,{equipo:phases,fase:0,cola_version:1});};
 a=load({response:()=>[tool('terminar',{resumen:'Plan completo',entrega:'Diseño con contrato de datos y criterios de aceptación para implementar.',tareas:[task]})]});auto(a,[phase('diseno'),phase('backend'),phase('interfaz'),phase('revision')]);
 r=await a.f.pasoAgente(a.db,a.e,{repositorio:'fixture/repo'},{max_pasos:4,max_coste_ia:1});
 add('Q01 Valid plan persists and hands off to first task',r===null&&a.updates.at(-1).estado_agente.fase===1&&a.updates.at(-1).estado_agente.equipo.length===4&&a.updates.at(-1).estado_agente.equipo[2].papel==='revision');
 a=load({response:()=>[tool('terminar',{resumen:'Ya está'})]});auto(a,[phase('backend',task)]);try{await a.f.pasoAgente(a.db,a.e,{repositorio:'fixture/repo'},{max_pasos:1,max_coste_ia:1})}catch{}
 add('Q02 Description without implementation cannot complete task',a.e.estado_agente.fase===0&&a.e.estado_agente.equipo[0].estado!=='completada'&&a.e.estado_agente.mensajes.at(-1).content[0].content.startsWith('ERROR:'));
 a=load({response:()=>[tool('terminar',{resumen:'Revisado',revision_ok:true,hallazgos:[]})]});auto(a,[phase('revision',task)]);a.e.cambios={'x.ts':'changed'};try{await a.f.pasoAgente(a.db,a.e,{repositorio:'fixture/repo'},{max_pasos:1,max_coste_ia:1})}catch{}
 add('Q03 Unread changed files prevent review approval',a.e.estado_agente.equipo[0].estado!=='completada');
 a=load({response:()=>[tool('leer_archivo',{ruta:'x.ts'}),tool('terminar',{resumen:'Error comprobado',revision_ok:false,hallazgos:['Tenant leak']})]});auto(a,[{...phase('backend',task),archivos:['x.ts'],estado:'completada'},phase('revision',task)]);a.e.estado_agente.fase=1;a.e.cambios={'x.ts':'changed'};
 r=await a.f.pasoAgente(a.db,a.e,{repositorio:'fixture/repo'},{max_pasos:4,max_coste_ia:1});
 add('Q04 Failed review queues correction and re-review before advancing',r===null&&a.e.estado_agente.fase===2&&a.e.estado_agente.equipo[2].papel==='backend'&&a.e.estado_agente.equipo[3].papel==='revision'&&a.e.estado_agente.equipo[2].archivos.length===0);
 a=load({response:()=>[tool('editar_archivo',{ruta:'x.ts',antes:'old',despues:'new'}),tool('terminar',{resumen:'Cambio aplicado'})]});auto(a,[phase('backend',task),phase('revision',task)]);a.e.cambios={'x.ts':'prefix old suffix'};
 r=await a.f.pasoAgente(a.db,a.e,{repositorio:'fixture/repo'},{max_pasos:4,max_coste_ia:1});
 add('Q05 Exact edit persists file evidence and advances to review',r===null&&a.e.cambios['x.ts']==='prefix new suffix'&&a.updates.at(-1).estado_agente.fase===1&&a.e.estado_agente.equipo[0].archivos[0]==='x.ts');
 a=load({response:()=>[tool('editar_archivo',{ruta:'x.ts',antes:'old',despues:'new'}),tool('terminar',{resumen:'Plan sin cambios'})]});a.e.cambios={'x.ts':'old'};
 r=await a.f.pasoAgente(a.db,a.e,{repositorio:'fixture/repo'},{max_pasos:4,max_coste_ia:1});
 add('Q06 Read-only runtime also blocks exact edits',a.e.cambios['x.ts']==='old'&&a.providerCalls[0].tools.every(t=>t.name!=='editar_archivo'));

 a=load({response:()=>[tool('leer_archivo',{ruta:'big.ts'}),tool('terminar',{resumen:'Revisado',revision_ok:true,hallazgos:[]})]});auto(a,[phase('revision',task)]);a.e.cambios={'big.ts':'x'.repeat(100000)};try{await a.f.pasoAgente(a.db,a.e,{repositorio:'fixture/repo'},{max_pasos:1,max_coste_ia:1})}catch{}
 add('Q07 First page alone cannot certify a large file',a.e.estado_agente.equipo[0].estado!=='completada'&&!a.e.estado_agente.equipo[0].leidos?.includes('big.ts'));
 a=load({response:()=>[tool('escribir_archivo',{ruta:'big.ts',contenido:'partial'}),tool('terminar',{resumen:'Cambio'})]});auto(a,[phase('backend',task)]);a.e.cambios={'big.ts':'x'.repeat(10000)};try{await a.f.pasoAgente(a.db,a.e,{repositorio:'fixture/repo'},{max_pasos:1,max_coste_ia:1})}catch{}
 add('Q08 Truncated full replacement preserves original file',a.e.cambios['big.ts'].length===10000&&a.e.estado_agente.equipo[0].estado!=='completada');

 a=load({response:()=>[tool('terminar',{resumen:'Todavía sin entrega'})]});auto(a,[{...phase('interfaz',task),leidos:Array.from({length:20},(_,i)=>`src/already-read-${i}.ts`)}]);try{await a.f.pasoAgente(a.db,a.e,{repositorio:'fixture/repo'},{max_pasos:1,max_coste_ia:1})}catch{}
 add('Q09 Provider retains read-file memory after conversation history is lost',a.providerCalls[0].system.includes('src/already-read-0.ts')&&a.providerCalls[0].system.includes('No repitas el inventario')&&a.providerCalls[0].system.includes('entrega concreta'));
 console.log(JSON.stringify(tests,null,2));if(tests.some(x=>!x.passed))process.exitCode=1;
})();
