export type TarifaComparacion={entrada_eur_millon:number;salida_eur_millon:number;max_entrada:number;max_salida:number;verificada_hasta:string};
export function compararCoste(t:TarifaComparacion,entrada:number,salida:number,llamadas:number,ahora=Date.now()){
 if(!Number.isFinite(Date.parse(t.verificada_hasta))||Date.parse(t.verificada_hasta)<=ahora)return null;
 if([entrada,salida,llamadas].some(n=>!Number.isSafeInteger(n)||n<1)||entrada>t.max_entrada||salida>t.max_salida)return null;
 if([t.entrada_eur_millon,t.salida_eur_millon].some(n=>!Number.isFinite(n)||n<0))return null;
 const estimado=llamadas*(entrada*t.entrada_eur_millon+salida*t.salida_eur_millon)/1000000;
 const reservaPorLlamada=(t.max_entrada*t.entrada_eur_millon+salida*t.salida_eur_millon)/1000000;
 return {estimado,reservaPorLlamada};
}
