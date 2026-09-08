/** Conservative checks supplement editorial review; they do not certify every factual claim. */
export function comprobarTextoProtegido(original:string,resultado:string){
 if(!resultado.trim())throw new Error('La reescritura está vacía; se conserva el original');
 const extraer=(s:string)=>[
  ...(s.match(/```[\s\S]*?```/g)??[]),
  ...(s.match(/https?:\/\/[^\s<>"')]+/g)??[]),
  ...(s.match(/\b\d+(?:[.,:/-]\d+)*\b/g)??[]),
 ].sort();
 if(JSON.stringify(extraer(original))!==JSON.stringify(extraer(resultado)))throw new Error('La reescritura cambió cifras, enlaces o bloques de código. Se conserva el original para revisión.');
}
