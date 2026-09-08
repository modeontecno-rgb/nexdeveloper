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
export function ControlEconomico(){
 const qc=useQueryClient();
 const estado=useQuery({queryKey:clave,queryFn:async()=>{const {data,error}=await supabase.rpc('ia_resumen');if(error)throw error;return data;},refetchInterval:15000});
 const [form,setForm]=React.useState(inicial),[editando,setEditando]=React.useState(false);
 React.useEffect(()=>{if(!editando)setForm(estado.data?.config??inicial)},[estado.data,editando]);
 const guardar=useMutation({mutationFn:async()=>{
   if(Object.entries(form).some(([k,v])=>k!=='habilitado' && typeof v==='number' && (!Number.isFinite(v)||v<0)))throw new Error('Los límites deben ser importes válidos, desde cero.');
   const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw new Error('Vuelve a iniciar sesión.');
   const row:Partial<IaControlRow>&{user_id:string}={user_id:data.user.id,habilitado:form.habilitado,limite_dia:form.limite_dia,limite_mes:form.limite_mes,limite_personal_mes:form.limite_personal_mes,maximo_llamada:form.maximo_llamada,actualizado_el:new Date().toISOString()};
   const r=await supabase.from('ia_control').upsert(row).select('user_id').single();if(r.error)throw r.error;
 },onSuccess:()=>{setEditando(false);void qc.invalidateQueries({queryKey:clave});toast.success('Límites guardados.');},onError:(e)=>toast.error(e.message)});
 if(estado.isPending)return <div role="status" className="panel p-4"><Loader2 className="inline size-4 animate-spin motion-reduce:animate-none"/> Consultando límites y reservas…</div>;
 if(estado.error)return <div role="alert" className="panel p-4">No se ha podido consultar el control económico. El saldo es desconocido. <Boton onClick={()=>void estado.refetch()}>Reintentar</Boton></div>;
 const d=estado.data,restante=d?.config?Math.max(0,Number(d.config.limite_mes)-Number(d.calculado_mes)-Number(d.reservado)):null;
 return <section className="panel space-y-4 p-5" aria-labelledby="control-economico">
  <h2 id="control-economico" className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5"/> Límites y reservas antes de llamar a la IA</h2>
  <p className="text-sm text-muted-foreground">Consumo calculado con tokens y tarifas verificadas en euros. La factura del proveedor se concilia por separado. Las reservas sin respuesta no se devuelven automáticamente.</p>
  <div className="grid gap-3 sm:grid-cols-3">{[['Calculado este mes',d?.calculado_mes],['Reservado',d?.reservado],['Disponible mensual',restante]].map(([label,value])=><div key={String(label)} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value==null?'Sin configurar':formatoDinero(Number(value))}</p></div>)}</div>
  {!!d?.inciertas&&<p role="status" className="text-sm text-warning">{d.inciertas} llamadas pendientes de conciliar. Su importe sigue reservado.</p>}
  <form className="space-y-3" onSubmit={e=>{e.preventDefault();guardar.mutate();}}>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.habilitado} onChange={e=>{setEditando(true);setForm(f=>({...f,habilitado:e.target.checked}));}}/> Permitir llamadas que tengan tarifa verificada y reserva disponible</label>
   <div className="grid gap-3 sm:grid-cols-4">{([['limite_dia','Límite diario (€)'],['limite_mes','Límite mensual (€)'],['limite_personal_mes','Personal mensual (€)'],['maximo_llamada','Máximo por llamada (€)']] as const).map(([key,label])=><Campo key={key} etiqueta={label}><input className={claseCampo} type="number" min="0" step="0.000001" required value={Number.isFinite(form[key])?form[key]:""} onChange={e=>{setEditando(true);setForm(f=>({...f,[key]:e.target.valueAsNumber}));}}/></Campo>)}</div>
   <Boton type="submit" disabled={guardar.isPending}>{guardar.isPending?'Guardando…':'Guardar límites'}</Boton>
  </form>
  <TarifasVerificadas/>
  <ComparadorCoste/>
 </section>;
}

function TarifasVerificadas(){
 const qc=useQueryClient();
 const [modelo,setModelo]=React.useState(''),[entrada,setEntrada]=React.useState(''),[salida,setSalida]=React.useState(''),[fuente,setFuente]=React.useState(''),[hasta,setHasta]=React.useState(''),[maxEntrada,setMaxEntrada]=React.useState(''),[maxSalida,setMaxSalida]=React.useState('');
 const modelos=useQuery({queryKey:['modelos_para_tarifa'],queryFn:async()=>{const {data,error}=await supabase.from('modelos_ia').select('id,nombre,identificador').eq('activo',true).order('nombre');if(error)throw error;return data;}});
 const guardar=useMutation({mutationFn:async()=>{
   if(!modelo||!hasta||[entrada,salida,maxEntrada,maxSalida].some(v=>!v.trim()||!Number.isFinite(Number(v))))throw new Error('Completa modelo, importes, límites de tokens y fecha.');
   const {error}=await supabase.rpc('ia_configurar_tarifa',{p_modelo_id:modelo,p_entrada:Number(entrada),p_salida:Number(salida),p_fuente:fuente,p_hasta:new Date(hasta).toISOString(),p_max_entrada:Number(maxEntrada),p_max_salida:Number(maxSalida)});if(error)throw error;
 },onSuccess:()=>{void qc.invalidateQueries({queryKey:['comparacion_tarifas']});toast.success('Tarifa guardada con historial. Los límites de gasto siguen vigentes.');},onError:e=>toast.error(e.message)});
 return <details className="border-t pt-4"><summary className="cursor-pointer font-medium">Configurar una tarifa documentada</summary>
  <p className="my-3 text-sm text-muted-foreground">Introduce euros por millón de tokens y explica la fuente y la conversión, si procede. La vigencia máxima es de 31 días. No se considera gratuito un modelo por carecer de precio. Solo se admiten adaptadores de texto contabilizados; voz, búsqueda con recargos y créditos requieren su propio control.</p>
  {modelos.error?<p role="alert">No se pudieron consultar los modelos.</p>:<form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();guardar.mutate();}}>
   <Campo etiqueta="Modelo"><select required className={claseCampo} value={modelo} onChange={e=>setModelo(e.target.value)}><option value="">Selecciona</option>{modelos.data?.map(m=><option key={m.id} value={m.id}>{m.nombre} · {m.identificador}</option>)}</select></Campo>
   <Campo etiqueta="Válida hasta"><input required type="datetime-local" className={claseCampo} value={hasta} onChange={e=>setHasta(e.target.value)}/></Campo>
   {([['Entrada €/millón',entrada,setEntrada],['Salida €/millón',salida,setSalida],['Máximo tokens de entrada',maxEntrada,setMaxEntrada],['Máximo tokens de salida',maxSalida,setMaxSalida]] as const).map(([label,value,set])=><Campo key={label} etiqueta={label}><input required type="number" min="0" step={label.includes('tokens')?'1':'0.000001'} className={claseCampo} value={value} onChange={e=>set(e.target.value)}/></Campo>)}
   <Campo etiqueta="Fuente y conversión a euros"><textarea required minLength={12} maxLength={2000} className={claseCampo} value={fuente} onChange={e=>setFuente(e.target.value)}/></Campo>
   <div className="self-end"><Boton type="submit" disabled={guardar.isPending}>{guardar.isPending?'Guardando…':'Guardar tarifa documentada'}</Boton></div>
  </form>}
 </details>;
}
