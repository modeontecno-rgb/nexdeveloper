const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../../db/functions/_shared/presupuesto.ts'),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
async function scenario(o={}){
 let sent=0,rpcs=[]; const ctx={exports:{},Response,URL,TextEncoder,AbortSignal,crypto:require('node:crypto').webcrypto,fetch:async()=>{sent++;if(o.transportError)throw Error('Network lost');return new Response(JSON.stringify(o.reply??{usage:{prompt_tokens:100,completion_tokens:50},choices:[{message:{content:'Fixture'}}]}),{status:o.status??200})}};
 vm.runInNewContext(js,ctx);
  const db={from(table){const q={select(){return q},eq(){return q},single:async()=>({error:o.missingPrice&&table==='ia_tarifas'?{}:null,data:table==='modelos_ia'?{id:'model',identificador:'fixture-model',proveedor_id:'provider'}:table==='proveedores_ia'?{clave_slug:o.provider??'deepseek'}:{max_entrada:10000}})};return q},async rpc(name,args){rpcs.push({name,args});if(name==='ia_reservar')return o.reserveError?{error:{message:o.reserveMessage}}:{data:{id:args.p_id,reservado:.1},error:null};return {data:{estado:args.p_entrada==null?'incierta':'liquidada',coste:.001},error:o.settleError?{}:null}}};
 let body,error;try{const response=await ctx.exports.fetchIA(db,{userId:'user',modeloId:'model',ambito:'personal',operacion:'test'},o.url??'https://api.deepseek.com/v1/chat/completions',{method:'POST',body:JSON.stringify({model:'fixture-model',max_tokens:100,...o.body})});body=await response.json()}catch(e){error=e.message}return {sent,rpcs,body,error};
}
(async()=>{let tests=[];async function t(name,o,p){let r=await scenario(o);tests.push({name,passed:!!p(r)});}
 await t('F01 Reservation failure prevents provider request',{reserveError:true},r=>r.sent===0&&r.error);
 await t('F02 Missing tariff prevents provider request',{missingPrice:true},r=>r.sent===0&&r.error);
 await t('F03 Provider mismatch prevents request',{url:'https://other.invalid/v1'},r=>r.sent===0&&r.error);
 await t('F04 Model mismatch prevents request',{body:{model:'other'}},r=>r.sent===0&&r.error);
 await t('F05 Unbounded output prevents request',{body:{max_tokens:null}},r=>r.sent===0&&r.error);
 await t('F06 Stream without usage adaptation prevents request',{body:{stream:true}},r=>r.sent===0&&r.error);
 await t('F07 Single request settled with observed usage',{},r=>r.sent===1&&r.body._nex_coste_eur===.001&&r.rpcs.length===2&&r.rpcs[1].args.p_entrada===100);
 await t('F08 Transport failure never refunds or retries',{transportError:true},r=>r.sent===1&&r.error&&r.rpcs[1].args.p_entrada===null);
 await t('F09 Missing usage retains reservation',{reply:{choices:[]}},r=>r.sent===1&&r.error&&r.rpcs.filter(x=>x.name==='ia_liquidar').every(x=>x.args.p_entrada===null));
 await t('F10 Accounting failure stops completion',{settleError:true},r=>r.sent===1&&r.error&&!r.body);
 await t('F11 Provider rejection is not retried',{status:429,reply:{error:'rate limit'}},r=>r.sent===1&&r.error);
 await t('F12 Excessive context blocked before request',{body:{messages:[{content:'x'.repeat(25000)}]}},r=>r.sent===0&&r.error);
 await t('F13 Truncated output is never presented as complete',{reply:{usage:{prompt_tokens:100,completion_tokens:100},choices:[{finish_reason:'length',message:{content:'cut off'}}]}},r=>r.sent===1&&r.error&&!r.body&&r.rpcs.some(x=>x.args.p_salida===100));
 await t('F14 Short prompts reserve estimated input, not full context',{},r=>{const x=r.rpcs.find(x=>x.name==='ia_reservar');return x&&x.args.p_entrada<10000&&x.args.p_entrada>=1024});
 await t('F15 Reservation exposes the database limit reason',{reserveError:true,reserveMessage:'Límite diario superado'},r=>r.error?.includes('Límite diario superado'));
 await t('F16 Google images reserve full verified input',{provider:'google',url:'https://generativelanguage.googleapis.com/v1beta/models/fixture-model:generateContent',body:{contents:[{parts:[{inlineData:{mimeType:'image/png',data:'AAAA'}}]}]}},r=>r.sent===1&&r.rpcs.find(x=>x.name==='ia_reservar')?.args.p_entrada===10000);
 await t('F17 Unsupported media rejected before charging',{provider:'google',url:'https://generativelanguage.googleapis.com/v1beta/models/fixture-model:generateContent',body:{contents:[{parts:[{inlineData:{mimeType:'audio/mp3',data:'AAAA'}}]}]}},r=>r.sent===0&&r.error);
 console.log(JSON.stringify(tests,null,2));if(tests.some(t=>!t.passed))process.exitCode=1;
})();
