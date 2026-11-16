import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const basePath=process.env.BASE_PATH?'/'+process.env.BASE_PATH.replace(/^\/+|\/+$/g,''):'';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=http.createServer(async(req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(basePath){if(name===basePath){res.writeHead(302,{Location:basePath+'/'});res.end();return;}if(!name.startsWith(basePath+'/')){res.writeHead(404);res.end('Not found');return;}name=name.slice(basePath.length);}const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}});
const port=Number(process.env.PORT)||3000;
server.listen(port,'127.0.0.1',()=>console.log(`SAMIL INSIGHT: http://localhost:${port}${basePath}/`));

// test
