/** Los consumos pequeños no deben parecer gratuitos por redondeo. */
export function formatoCosteIA(valor: number) {
 if(valor>0 && valor<0.01)return '<0,01 €';
 return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(valor);
}
