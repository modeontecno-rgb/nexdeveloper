const fs=require('fs'),vm=require('vm'),path=require('path');
let ts;try{ts=require('typescript');}catch{ts=require('typescript');}
const source=fs.readFileSync(path.join(__dirname,'../../db/functions/desplegar-funcion/index.ts'),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',commit='a'.repeat(40);
async function attempt(o={}){
  let handler,calls=[],metadata=null;
  const env={SUPABASE_URL:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',CUENTA_SUPABASE_TOKEN:'fixture-account',GITHUB_TOKEN:'fixture-github',DEPLOY_OWNER_IDS:owner,DEPLOY_ALLOWED_FUNCTIONS:'fixture',...o.env};
  const user=o.user===undefined?{id:owner}:o.user;
  const context={exports:{},Request,Response,Blob,FormData,URL,AbortSignal,TextEncoder,console:{info(){}},
    Deno:{env:{get:k=>env[k]},serve:fn=>{handler=fn;}},
    require:specifier=>{if(specifier!=='npm:@supabase/supabase-js@2')throw Error('Unexpected import');return {createClient:()=>({rpc:async()=>{throw Error('General cron must not authorize deployments');},auth:{getUser:async()=>({data:{user},error:o.authError?{}:null})}})}},
    fetch:async(url,options={})=>{calls.push({url:String(url),method:options.method||'GET'});
      if(String(url).startsWith('https://api.github.com/'))return new Response(o.code??'// Synthetic source only. '.repeat(8),{status:o.githubStatus??200});
      if(String(url).startsWith('https://api.supabase.com/')){metadata=JSON.parse(options.body.get('metadata'));return new Response(o.upstreamBody??JSON.stringify({version:1}),{status:o.deployStatus??200});}
      throw Error('Unexpected mocked destination');}
  };
  vm.runInNewContext(js,context,{timeout:2000});
  const method=o.method??'POST';
  const req=new Request('https://fixture.invalid/',{method,headers:{'content-type':'application/json',Authorization:o.authorization??'Bearer fixture-session',...(o.cron?{'x-cron-token':'fixture-general-cron'}:{})},...(method==='POST'?{body:JSON.stringify({slug:'fixture',commit_sha:commit,verify_jwt:true,...o.body})}:{})});
  const res=await handler(req),body=await res.json();
  return {status:res.status,calls,metadata,body};
}
(async()=>{
 const tests=[];
 async function denied(name,options,status){const r=await attempt(options);tests.push({name,passed:r.status===status&&r.calls.length===0,observed:{status:r.status,mockedCalls:r.calls.length}});}
 await denied('E01 Missing session rejected',{user:null},401);
 await denied('E02 Ordinary authenticated user cannot deploy',{user:{id:other}},403);
 const ok=await attempt();tests.push({name:'E03 Configured owner deploys allowed function from exact commit',passed:ok.status===200&&ok.calls.length===2&&ok.calls[0].url.endsWith('?ref='+commit)&&ok.metadata.verify_jwt===true&&ok.body.commit_sha===commit});
 await denied('E04 General cron token grants no authority',{authorization:'',cron:true},401);
 await denied('E05 User metadata cannot grant owner permission',{user:{id:other,user_metadata:{role:'admin'},app_metadata:{role:'admin'}}},403);
 await denied('E06 Missing owner configuration fails closed',{env:{DEPLOY_OWNER_IDS:''}},503);
 await denied('E07 Unlisted destination rejected',{body:{slug:'another-function'}},403);
 await denied('E08 Alternate source path rejected',{body:{ruta:'elsewhere/index.ts'}},400);
 await denied('E09 Alternate repository rejected',{body:{repo:'other/repo'}},400);
 await denied('E10 Mutable branch instead of commit rejected',{body:{commit_sha:'main'}},400);
 await denied('E11 Legacy main branch cannot override exact commit',{body:{rama:'main'}},400);
 await denied('E12 Missing JWT setting rejected',{body:{verify_jwt:undefined}},400);
 await denied('E13 String boolean rejected',{body:{verify_jwt:'false'}},400);
 await denied('E14 Missing function allowlist fails closed',{env:{DEPLOY_ALLOWED_FUNCTIONS:''}},503);
 await denied('E15 Authentication error fails closed',{authError:true},401);
 const gh=await attempt({githubStatus:403,code:'fixture-upstream-private-detail'});tests.push({name:'E16 Source error prevents deployment and hides upstream body',passed:gh.status===502&&gh.calls.length===1&&!JSON.stringify(gh.body).includes('private-detail')});
 const fail=await attempt({deployStatus:500,upstreamBody:'fixture-upstream-private-detail'});tests.push({name:'E17 Failed deployment is reported without upstream body',passed:fail.status===502&&!JSON.stringify(fail.body).includes('private-detail')});
 await denied('E18 GET cannot deploy',{method:'GET'},405);
 const short=await attempt({code:'x'});tests.push({name:'E19 Empty source does not deploy',passed:short.status===400&&short.calls.length===1});
 const explicit=await attempt({body:{verify_jwt:false}});tests.push({name:'E20 Explicit false JWT setting remains boolean',passed:explicit.status===200&&explicit.metadata.verify_jwt===false});
 await denied('E21 Malformed owner allowlist fails closed',{env:{DEPLOY_OWNER_IDS:'not-an-id'}},503);
 for(const [name,code] of [['E22 Relative import requires full bundle',"import {x} from '../_shared/x.ts';"],['E23 Static font requires full bundle',"const font=await Deno.readFile('./font.woff');"],['E24 Side-effect import requires full bundle',"import '../_shared/setup.ts';"]]){const r=await attempt({code});tests.push({name,passed:r.status===409&&r.calls.length===1});}
 const result={environment:'VM with fake auth and intercepted fetch only; no real network or deployment',tests};

 console.log(JSON.stringify({...result,total:tests.length,passed:tests.filter(t=>t.passed).length,failed:tests.filter(t=>!t.passed)},null,2));
 if(tests.some(t=>!t.passed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
