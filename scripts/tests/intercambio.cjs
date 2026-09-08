const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript'),{webcrypto:crypto}=require('node:crypto');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../db/functions/intercambio-proyectian/index.ts'),'utf8').replace(/^import .*\n/,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const secret='fixture-only-not-a-real-key-'.repeat(2),enc=new TextEncoder();
async function sign(raw){const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Buffer.from(await crypto.subtle.sign('HMAC',k,enc.encode(raw))).toString('hex');}
async function scenario(o={}){let handler,sent=0,applied=0,requestSigned=false;const db={auth:{getUser:async()=>({data:{user:o.noAuth?null:{id:'owner'}},error:null})},from(t){const q={select(){return q},update(){return q},eq(){return q},not(){return q},order(){return q},single:async()=>({data:o.noLink?null:{id:'link',proyecto_id:'project'}}),limit:async()=>({data:o.tooMany?Array(501).fill({}):[],error:null})};return q},rpc:async()=>{applied++;return {data:{revision:1},error:o.sqlReject?{}:null}}};
 const env={SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture',INTERCAMBIO_DESTINOS:JSON.stringify({link:{secreto:secret,url:o.target??'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/intercambio-nex'}})};
 vm.runInNewContext(code,{exports:{},createClient:()=>db,Deno:{env:{get:k=>env[k]},serve:h=>handler=h},crypto,TextEncoder,TextDecoder,Uint8Array,URL,Response,AbortSignal,fetch:async(url,init)=>{sent++;requestSigned=init.headers['x-intercambio-firma']===await sign(init.body);const b=JSON.parse(init.body);const raw=JSON.stringify({nonce:o.wrongNonce?'foreign':b.nonce,contenido:{revision:1},entregas_recibidas:0});return new Response(raw,{headers:{'x-intercambio-firma':o.tamper?'0'.repeat(64):await sign(raw)}});}});
 const response=await handler(new Request('http://localhost/intercambio-proyectian',{method:'POST',headers:{authorization:'Bearer fixture','content-type':'application/json'},body:JSON.stringify({enlace_id:'link'})}));return {status:response.status,body:await response.json(),sent,applied,requestSigned};}
(async()=>{const tests=[];async function t(name,o,p){const r=await scenario(o);tests.push({name,passed:!!p(r)});}
await t('H01 No session prevents exchange',{noAuth:true},r=>r.status===401&&r.sent===0);
await t('H02 Unauthorized pair prevents exchange',{noLink:true},r=>r.status===403&&r.sent===0);
await t('H03 Server rejects arbitrary destination',{target:'https://attacker.invalid/functions/v1/intercambio-nex'},r=>r.status===409&&r.sent===0);
await t('H04 Tampered signed response never applied',{tamper:true},r=>r.applied===0&&r.status===409);
await t('H05 Foreign nonce never applied',{wrongNonce:true},r=>r.applied===0&&r.status===409);
await t('H06 Verified exchange applied once',{},r=>r.applied===1&&r.sent===1&&r.requestSigned&&r.status===200);
await t('H07 Too many artifacts are not silently truncated',{tooMany:true},r=>r.sent===0&&r.status===409);
await t('H08 Database refusal not reported as success',{sqlReject:true},r=>r.status===409&&!r.body.ok);
console.log(JSON.stringify(tests,null,2));if(tests.some(t=>!t.passed))process.exitCode=1;
})();
