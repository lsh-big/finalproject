import {APP_MODE} from './runtime-config.js';
export const IS_DEMO=APP_MODE==='demo';
export async function apiFetch(path,options={}){
 if(IS_DEMO){const {demoFetch}=await import('./demo-api.js');return demoFetch(path,options);}
 return fetch(path,options);
}
