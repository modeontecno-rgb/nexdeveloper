import type {Riesgo} from './db-types';
export function numeroEstimado(valor:unknown):number|null{
 if(typeof valor!=='number'||!Number.isFinite(valor)||valor<0)return null;
 return valor;
}
export function riesgoNormalizado(valor:unknown):Riesgo{
 const texto=String(valor??'').toLowerCase().trim();
 return texto==='bajo'?'Bajo':texto==='medio'?'Medio':'Alto';
}
export function datosOrdenMesa(recomendacion:Record<string,unknown>|null|undefined){
 const coste=numeroEstimado(recomendacion?.["coste_estimado"]??recomendacion?.["coste_estimado_eur"]);
 const horas=numeroEstimado(recomendacion?.["horas_estimadas"]);
 if(coste===null||horas===null)throw new Error('La conclusión no incluye una estimación numérica de coste y horas. Completa la propuesta antes de crear la orden.');
 const calidad=numeroEstimado(recomendacion?.["calidad_prevista"]);
 return {costeEstimado:coste,horasEstimadas:horas,riesgo:riesgoNormalizado(recomendacion?.["riesgo"]),calidadPrevista:calidad!==null&&calidad<=100?Math.round(calidad):null};
}
export function textoOrdenMesa(sintesis:string,pregunta:string,recomendacion:Record<string,unknown>|null|undefined){
 return `${sintesis.trim()||pregunta}\n\nPetición original:\n${pregunta}\n\nPlan y condiciones acordadas:\n${JSON.stringify(recomendacion??{},null,2)}`;
}
