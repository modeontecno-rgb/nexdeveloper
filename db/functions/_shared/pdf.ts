import {PDFDocument,rgb} from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
/** Deterministic textual PDF, embedded font, bounded pages, never pretends HTML is PDF. */
export async function crearPDF(titulo:string,texto:string,fuente:Uint8Array):Promise<Uint8Array>{
 if(!titulo.trim()||!texto.trim()||titulo.length>300||texto.length>100000)throw new Error('Contenido PDF vacío o demasiado grande');
 const pdf=await PDFDocument.create();pdf.setTitle(titulo);pdf.setProducer('NexDeveloper');pdf.setCreationDate(new Date('2026-01-01T00:00:00Z'));pdf.setModificationDate(new Date('2026-01-01T00:00:00Z'));
 pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fuente,{subset:true});
 const chars=new Set(font.getCharacterSet());
 const clean=(s:string)=>s.normalize('NFC').replace(/\t/g,'    ').replace(/\r/g,'');
 texto=clean(texto);titulo=clean(titulo);
 for(const c of titulo+texto)if(c!=='\n'&&!chars.has(c.codePointAt(0)!))throw new Error(`La fuente no representa el carácter U+${c.codePointAt(0)!.toString(16)}. El texto original se conserva; añade una fuente compatible.`);
 const ancho=595.28,alto=841.89,margen=48;let page=pdf.addPage([ancho,alto]),y=alto-65;
 function newPage(){if(pdf.getPageCount()>=100)throw new Error('PDF supera 100 páginas');page=pdf.addPage([ancho,alto]);y=alto-65;}
 function line(t:string,size:number,color=rgb(.12,.18,.24)){if(y<66)newPage();page.drawText(t,{x:margen,y,font,size,color});y-=size*1.5;}
 function paragraph(t:string,size:number){
  let current='';const max=ancho-2*margen;
  // Wrap long identifiers as well as ordinary words, without dropping characters.
  for(const word of t.split(/(?<=\s)/u)){
   if(font.widthOfTextAtSize(current+word,size)<=max){current+=word;continue;}
   if(current){line(current.trimEnd(),size);current='';}
   for(const c of word){if(font.widthOfTextAtSize(current+c,size)>max){line(current,size);current='';}current+=c;}
  }
  if(current)line(current.trimEnd(),size);
 }
 paragraph(titulo,19);y-=14;
 for(const raw of texto.split('\n')){
  if(!raw.trim()){y-=8;continue;}
  const heading=/^#{1,3}\s/.test(raw);if(heading){y-=10;if(y<120)newPage();}
  paragraph(raw.replace(/^#{1,3}\s/,''),heading?13:10);if(heading)y-=5;
 }
 pdf.getPages().forEach((p,i)=>{p.drawLine({start:{x:margen,y:43},end:{x:ancho-margen,y:43},thickness:.5,color:rgb(.75,.8,.82)});p.drawText(`NexDeveloper | ${i+1} / ${pdf.getPageCount()}`,{x:margen,y:28,font,size:8,color:rgb(.4,.45,.5)});});
 return pdf.save();
}
