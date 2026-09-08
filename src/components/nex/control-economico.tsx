import {ComparadorCoste} from './comparador-coste';
import * as React from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {Loader2,ShieldCheck} from 'lucide-react';
import {toast} from 'sonner';
import {supabase} from '@/lib/nex/supabase';
import type {IaControlRow} from '@/lib/nex/db-types';
const formatoDinero=(v:number)=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:6}).format(v);
import {Boton,Campo,claseCampo} from './campos';
const clave=['ia_control_atomico'];
const inicial={habilitado:false,limite_dia:0,limite_mes:0,limite_personal_mes:0,maximo_llamada:0};
type LimitesIa=typeof inicial;
export function ControlEconomico(){
 const qc=useQueryClient();
 const estado=useQuery({queryKey:clave,queryFn:async()=>{const {data,error}=await supabase.rpc('ia_resumen');if(error)throw error;return data;},refetchInterval:15000});
 const [form,setForm]=React.useState(inicial),[editando,setEditando]=React.useState(false);
 React.useEffect(()=>{if(!editando)setForm(estado.data?.config??inicial)},[estado.data,editando]);
 const guardar=useMutation({mutationFn:async(limites:LimitesIa)=>{
    if(Object.entries(limites).some(([k,v])=>k!=='habilitado' && typeof v==='number' && (!Number.isFinite(v)||v<0)))throw new Error('Los límites deben ser importes válidos, desde cero.');
   const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw new Error('Vuelve a iniciar sesión.');
    const row:Partial<IaControlRow>&{user_id:string}={user_id:data.user.id,...limites,actualizado_el:new Date().toISOString()};
   const r=await supabase.from('ia_control').upsert(row).select('user_id').single();if(r.error)throw r.error;
  },onSuccess:(_r,limites)=>{setForm(limites);setEditando(false);void qc.invalidateQueries({queryKey:clave});toast.success('Consumo de IA activado y límites guardados.');},onError:(e)=>toast.error(e.message)});
 if(estado.isPending)return <div role="status" className="panel p-4"><Loader2 className="inline size-4 animate-spin motion-reduce:animate-none"/> Consultando límites y reservas…</div>;
 if(estado.error)return <div role="alert" className="panel p-4">No se ha podido consultar el control económico. El saldo es desconocido. <Boton onClick={()=>void estado.refetch()}>Reintentar</Boton></div>;
  const d=estado.data,restante=d?.config?Math.max(0,Number(d.config.limite_mes)-Number(d.calculado_mes)-Number(d.reservado)):null;
  const reservadoActual=Math.max(0,Number(d?.reservado??0));
  const configuracionBloqueada=!d?.config||!d.config.habilitado||Number(d.config.limite_dia)<=reservadoActual||Number(d.config.limite_mes)<=Number(d?.calculado_mes??0)+reservadoActual||Number(d.config.limite_personal_mes)<=reservadoActual||Number(d.config.maximo_llamada)<=0;
  const aplicarRecomendados=()=>{
    const reservado=reservadoActual;
    const recomendados={habilitado:true,limite_dia:Math.max(10,Math.ceil(reservado+10)),limite_mes:Math.max(100,Math.ceil(Number(d?.calculado_mes??0)+reservado+100)),limite_personal_mes:Math.max(20,Math.ceil(reservado+20)),maximo_llamada:5};
    guardar.mutate(recomendados);
  };
 return <section className="panel space-y-4 p-5" aria-labelledby="control-economico">
  <h2 id="control-economico" className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5"/> Límites y reservas antes de llamar a la IA</h2>
   <p className="text-sm text-muted-foreground">Consumo calculado con tokens y tarifas verificadas en euros. La factura del proveedor se concilia por separado. Las reservas sin respuesta no se devuelven automáticamente.</p>
    {configuracionBloqueada&&<div role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"><p className="font-medium text-warning">Las llamadas de IA están bloqueadas por la configuración o por reservas retenidas.</p><p className="mt-1 text-muted-foreground">Esta acción activa el consumo y guarda límites con margen suficiente sobre los {formatoDinero(reservadoActual)} que ya están reservados. No tendrás que guardar una segunda vez.</p><Boton type="button" variante="suave" className="mt-3" disabled={guardar.isPending} onClick={aplicarRecomendados}>{guardar.isPending?'Activando…':'Desbloquear con límites recomendados'}</Boton></div>}
  <div className="grid gap-3 sm:grid-cols-3">{[['Calculado este mes',d?.calculado_mes],['Reservado',d?.reservado],['Disponible mensual',restante]].map(([label,value])=><div key={String(label)} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value==null?'Sin configurar':formatoDinero(Number(value))}</p></div>)}</div>
  {!!d?.inciertas&&<p role="status" className="text-sm text-warning">{d.inciertas} llamadas pendientes de conciliar. Su importe sigue reservado.</p>}
   <form className="space-y-3" onSubmit={e=>{e.preventDefault();guardar.mutate(form);}}>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.habilitado} onChange={e=>{setEditando(true);setForm(f=>({...f,habilitado:e.target.checked}));}}/> Permitir llamadas que tengan tarifa verificada y reserva disponible</label>
   <div className="grid gap-3 sm:grid-cols-4">{([['limite_dia','Límite diario (€)'],['limite_mes','Límite mensual (€)'],['limite_personal_mes','Personal mensual (€)'],['maximo_llamada','Máximo por llamada (€)']] as const).map(([key,label])=><Campo key={key} etiqueta={label}><input className={claseCampo} type="number" min="0" step="0.000001" required value={Number.isFinite(form[key])?form[key]:""} onChange={e=>{setEditando(true);setForm(f=>({...f,[key]:e.target.valueAsNumber}));}}/></Campo>)}</div>
    <Boton type="submit" disabled={guardar.isPending}>{guardar.isPending?'Guardando…':'Guardar límites'}</Boton>
  </form>
  <TarifasVerificadas/>
  <ComparadorCoste/>
 </section>;
}

const TODOS = '__todos__';

function TarifasVerificadas(){
 const qc=useQueryClient();
 const [modelo,setModelo]=React.useState(TODOS),[entrada,setEntrada]=React.useState('3'),[salida,setSalida]=React.useState('15'),[fuente,setFuente]=React.useState(''),[hasta,setHasta]=React.useState(''),[maxEntrada,setMaxEntrada]=React.useState('200000'),[maxSalida,setMaxSalida]=React.useState('8000');
 const modelos=useQuery({queryKey:['modelos_para_tarifa'],queryFn:async()=>{const {data,error}=await supabase.from('modelos_ia').select('id,nombre,identificador').eq('activo',true).order('nombre');if(error)throw error;return data;}});
 const guardar=useMutation({mutationFn:async()=>{
   if(!modelo||!hasta||[entrada,salida,maxEntrada,maxSalida].some(v=>!v.trim()||!Number.isFinite(Number(v))))throw new Error('Completa modelo, importes, límites de tokens y fecha.');
   const destinos=modelo===TODOS?(modelos.data??[]).map(m=>m.id):[modelo];
   if(!destinos.length)throw new Error('No hay modelos activos a los que aplicar la tarifa.');
   const fallos:string[]=[];
   for(const id of destinos){
     const {error}=await supabase.rpc('ia_configurar_tarifa',{p_modelo_id:id,p_entrada:Number(entrada),p_salida:Number(salida),p_fuente:fuente,p_hasta:new Date(hasta).toISOString(),p_max_entrada:Number(maxEntrada),p_max_salida:Number(maxSalida)});
     if(error)fallos.push(`${(modelos.data??[]).find(m=>m.id===id)?.nombre??id}: ${error.message}`);
   }
   if(fallos.length===destinos.length)throw new Error(fallos[0]??'No se ha podido guardar la tarifa.');
   return {total:destinos.length,fallos};
 },onSuccess:(r)=>{void qc.invalidateQueries({queryKey:['comparacion_tarifas']});
   if(r.fallos.length)toast.warning(`Tarifa aplicada a ${r.total-r.fallos.length} de ${r.total} modelos. Sin aplicar: ${r.fallos.join(' · ')}`);
   else toast.success(r.total>1?`Tarifa aplicada a los ${r.total} modelos activos.`:'Tarifa guardada con historial. Los límites de gasto siguen vigentes.');
 },onError:e=>toast.error(e.message)});
 const dentroDe30Dias=()=>{const d=new Date();d.setDate(d.getDate()+30);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());setHasta(d.toISOString().slice(0,16));};
 return <details className="border-t pt-4" open><summary className="cursor-pointer font-medium">Configurar una tarifa documentada</summary>
  <p className="my-3 text-sm text-muted-foreground">Introduce euros por millón de tokens y explica la fuente y la conversión, si procede. Con «Todos los modelos activos» no tienes que ir uno a uno: se aplica la misma tarifa y los mismos máximos a todos de una vez, y luego puedes afinar los que quieras. La vigencia máxima es de 31 días. No se considera gratuito un modelo por carecer de precio. Solo se admiten adaptadores de texto contabilizados; voz, búsqueda con recargos y créditos requieren su propio control.</p>
  {modelos.error?<p role="alert">No se pudieron consultar los modelos.</p>:<form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();guardar.mutate();}}>
   <Campo etiqueta="Modelo"><select required className={claseCampo} value={modelo} onChange={e=>setModelo(e.target.value)}><option value={TODOS}>Todos los modelos activos ({modelos.data?.length??0})</option>{modelos.data?.map(m=><option key={m.id} value={m.id}>{m.nombre} · {m.identificador}</option>)}</select></Campo>
   <Campo etiqueta="Válida hasta"><div className="flex gap-2"><input required type="datetime-local" className={claseCampo} value={hasta} onChange={e=>setHasta(e.target.value)}/><Boton type="button" variante="suave" className="whitespace-nowrap px-3 text-xs" onClick={dentroDe30Dias}>30 días</Boton></div></Campo>
   {([['Entrada €/millón',entrada,setEntrada],['Salida €/millón',salida,setSalida],['Máximo tokens de entrada',maxEntrada,setMaxEntrada],['Máximo tokens de salida',maxSalida,setMaxSalida]] as const).map(([label,value,set])=><Campo key={label} etiqueta={label}><input required type="number" min="0" step={label.includes('tokens')?'1':'0.000001'} className={claseCampo} value={value} onChange={e=>set(e.target.value)}/></Campo>)}
   <Campo etiqueta="Fuente y conversión a euros"><textarea required minLength={12} maxLength={2000} className={claseCampo} placeholder="Ej.: precios públicos del proveedor a 8/09/2026, convertidos a euros al cambio del día." value={fuente} onChange={e=>setFuente(e.target.value)}/></Campo>
   <div className="self-end"><Boton type="submit" disabled={guardar.isPending}>{guardar.isPending?'Guardando…':modelo===TODOS?'Aplicar a todos los modelos':'Guardar tarifa documentada'}</Boton></div>
  </form>}
 </details>;
}

