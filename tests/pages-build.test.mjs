import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {buildPages,pagesFiles} from '../scripts/build-pages.mjs';
test('Pages build is explicitly demo-only, complete, relative and contains no private/backend files',async()=>{
 const out=await buildPages(),files=await readdir(out);assert.deepEqual(files.sort(),[...pagesFiles,'.nojekyll'].sort());assert.match(await readFile(path.join(out,'runtime-config.js'),'utf8'),/APP_MODE='demo'/);assert.match(await readFile(new URL('../public/runtime-config.js',import.meta.url),'utf8'),/APP_MODE='server'/);
 const visited=new Set();async function visit(name){if(visited.has(name))return;visited.add(name);const text=await readFile(path.join(out,name),'utf8');assert.doesNotMatch(text,/from ['"]node:|ADMIN_PASSWORD|users\.json|\.private\//);for(const m of text.matchAll(/\bimport\s+(?:[^;]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\(['"]([^'"]+)['"]\)/g)){const target=m[1]||m[2];assert.ok(target.startsWith('./'));await visit(path.posix.normalize(path.posix.join(path.posix.dirname(name),target)));}}
 for(const name of pagesFiles.filter(n=>n.endsWith('.js')))await visit(name);
 for(const file of pagesFiles.filter(n=>n.endsWith('.html'))){const html=await readFile(path.join(out,file),'utf8');for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){const target=m[1];if(target.startsWith('#'))continue;assert.ok((await stat(path.join(out,target.endsWith('/')?target+'index.html':target))).isFile());for(const base of ['https://example.github.io/','https://example.github.io/finalproject/'])assert.ok(new URL(target,base).pathname.startsWith(new URL(base).pathname));}}
});

