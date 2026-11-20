import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {buildPages} from './build-pages.mjs';
const root=await buildPages(),base='/finalproject',port=Number(process.env.PORT)||3020;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
http.createServer(async(req,res)=>{
 try{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name===base){res.writeHead(302,{Location:base+'/'});return res.end();}if(!name.startsWith(base+'/')){res.writeHead(404);return res.end('Not found');}name=name.slice(base.length);const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw Error('Invalid path');const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`GitHub Pages demo preview: http://127.0.0.1:${port}${base}/`));
