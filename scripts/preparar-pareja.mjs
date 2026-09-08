// Generates configuration files locally. Never connects to a database or deploys.
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
const [salida,nexUsuario,nexProyecto,proyUsuario,proyProyecto,proyRef]=process.argv.slice(2);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if(!salida||![nexUsuario,nexProyecto,proyUsuario,proyProyecto].every(x=>uuid.test(x??''))||!/^[a-z0-9]{20}$/.test(proyRef??''))throw new Error('Uso: node scripts/preparar-pareja.mjs carpeta NUEVO_USUARIO_NEX PROYECTO_NEX USUARIO_PROY PRODUCTO_PROY REF_SUPABASE_PROY. Usa UUID reales y una carpeta nueva.');
const out=resolve(salida);if(existsSync(out))throw new Error('La carpeta ya existe; no se sobrescribe una pareja anterior.');mkdirSync(out,{recursive:true,mode:0o700});
const id=randomUUID(),secret=randomBytes(32).toString('hex');
function guardar(nombre,texto){writeFileSync(resolve(out,nombre),texto,{mode:0o600,flag:'wx'});}
guardar('nex.sql',`BEGIN;\nINSERT INTO public.proyectian_enlaces(id,user_id,proyecto_id,origen_usuario,origen_proyecto,activo) VALUES ('${id}','${nexUsuario}','${nexProyecto}','${proyUsuario}','${proyProyecto}',false);\nCOMMIT;\n`);
guardar('proyectian.sql',`BEGIN;\nINSERT INTO public.nex_enlaces(id,user_id,proyecto_id,nex_usuario_id,nex_proyecto_id,activo) VALUES ('${id}','${proyUsuario}','${proyProyecto}','${nexUsuario}','${nexProyecto}',false);\nCOMMIT;\n`);
guardar('secretos-nex.env','INTERCAMBIO_DESTINOS='+JSON.stringify({[id]:{url:`https://${proyRef}.supabase.co/functions/v1/intercambio-nex`,secreto:secret}})+'\n');
guardar('secretos-proyectian.env','INTERCAMBIO_SECRETOS='+JSON.stringify({[id]:secret})+'\n');
guardar('LEEME.txt','Configuración preparada, no aplicada. Enlaces desactivados inicialmente. Revisa los cuatro identificadores antes de aplicar las dos transacciones en un entorno de pruebas. Los archivos secretos son privados: no subir a GitHub. Conserva el mismo ID y secreto en ambos servidores. La activación y el despliegue se realizan por separado, después de verificar las migraciones. Si ya existen otros enlaces, combinar sus mapas de secretos; no sustituirlos.\n');
console.log('Archivos privados preparados en '+out+'. No se ha conectado ni activado ningún entorno.');
