import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const publicRoot=fileURLToPath(new URL('../public/',import.meta.url));

test('HTML assets and navigation stay under both root and project Pages URLs',async()=>{
  const html=await readFile(path.join(publicRoot,'index.html'),'utf8');
  const links=[...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1]);
  for(const base of ['https://example.github.io/','https://example.github.io/finalproject/','https://example.github.io/a-different-repo/']){
    for(const link of links){
      const target=new URL(link,base);
      assert.equal(target.origin,new URL(base).origin);
      assert.ok(target.pathname.startsWith(new URL(base).pathname),`${link} escapes ${base}`);
      if(link.startsWith('#'))continue;
      assert.ok((await stat(path.join(publicRoot,link))).isFile(),`${link} missing`);
    }
  }
});

test('browser modules use relative imports and no Node-only dependencies',async()=>{
  const visited=new Set();
  async function visit(name){
    if(visited.has(name))return;visited.add(name);
    const source=await readFile(path.join(publicRoot,name),'utf8');
    for(const match of source.matchAll(/\bimport\s+(?:[^;]*?\s+from\s+)?['"]([^'"]+)['"]/g)){
      assert.ok(match[1].startsWith('./')||match[1].startsWith('../'),`${name}: non-relative import ${match[1]}`);
      const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1]));
      assert.ok(!resolved.startsWith('../'));
      await visit(resolved);
    }
  }
  await visit('app.js');assert.ok(visited.size>=5);
});
