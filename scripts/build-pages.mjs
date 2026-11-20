import {mkdir,copyFile,writeFile,rm,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export const pagesFiles=['cad.css','cad-example.js','cad-engine.js','cad-workspace.js','index.html','login.html','admin.html','legacy.html','management.css','management.js','management-schema.js','management-domain.js','operations.js','industry-performance.js','document-workspace.js','document-domain.js','performance-public.json','operations-model.js','operations-domain.js','ledger.js','ledger-model.js','ledger-domain.js','client.js','runtime-config.js','demo-api.js','auth.js','auth.css','session.js','samil-logo.svg','style.css','easy.css','easy-ui.js','app.js','data.js','ai.css','ai-workspace.js','ai-engine.js'];
pagesFiles.push('orders.html','orders.css','orders.js','order-spec.js','order-demo.js','order-workbook.js','order-demo-data.json',
 ...['normal','conflict','missing'].flatMap(scenario =>
  ['po.pdf','po.jpg','tech.xlsx'].map(file => `order-demo-${scenario}-${file}`)));
export async function buildPages(){
 const dist=path.join(root,'dist'),out=path.join(dist,'pages');
 // Verify fixed workspace targets before replacing generated output on Windows or Linux.
 for(const target of [dist,out]){try{if((await lstat(target)).isSymbolicLink())throw Error('Refusing symlink build output: '+target);const resolved=await realpath(target);if(path.relative(root,resolved).startsWith('..'))throw Error('Build output escapes workspace.');}catch(e){if(e.code!=='ENOENT')throw e;}}
 if(path.relative(root,out)!==path.join('dist','pages'))throw Error('Unexpected Pages build target.');
 await mkdir(dist,{recursive:true});await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
 for(const name of pagesFiles)await copyFile(path.join(root,'public',name),path.join(out,name));
 await writeFile(path.join(out,'runtime-config.js'),"// Public demonstration only. No authentication or shared backend.\nexport const APP_MODE='demo';\n");
 await writeFile(path.join(out,'.nojekyll'),'');return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('GitHub Pages demo built: '+await buildPages());
