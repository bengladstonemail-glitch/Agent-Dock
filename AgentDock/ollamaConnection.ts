import type {Express} from 'express';
export function normalizeOllamaUrl(value:string){
 let raw=value.trim();if(!/^https?:\/\//i.test(raw))raw='http://'+raw;
 const url=new URL(raw);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('Use an HTTP/HTTPS Ollama address without credentials or query parameters');
 if(url.hostname==='0.0.0.0')url.hostname='127.0.0.1';if(url.hostname==='[::]')url.hostname='[::1]';
 return url.href.replace(/\/$/,'');
}
export class OllamaConnection {
 configured:string;activeUrl:string;private cached:any=null;private cachedAt=0;private pending:Promise<any>|null=null;
 constructor(private request:typeof fetch=fetch,initial=process.env.OLLAMA_BASE_URL||process.env.OLLAMA_HOST||'http://127.0.0.1:11434'){this.configured=normalizeOllamaUrl(initial);this.activeUrl=this.configured;}
 configure(value:unknown){if(typeof value!=='string'||!value.trim())return;const requested=normalizeOllamaUrl(value);const defaultAddress=['http://localhost:11434','http://127.0.0.1:11434'].includes(requested);const chosen=defaultAddress&&(process.env.OLLAMA_BASE_URL||process.env.OLLAMA_HOST)?normalizeOllamaUrl(process.env.OLLAMA_BASE_URL||process.env.OLLAMA_HOST!):requested;if(chosen!==this.configured){this.configured=chosen;this.activeUrl=chosen;this.cached=null;this.pending=null;}}
 async snapshot(force=false):Promise<any>{
  if(!force&&this.cached&&Date.now()-this.cachedAt<2000)return this.cached;
  if(this.pending)return this.pending;
  const configured=this.configured;
  const urls=[configured];const parsed=new URL(configured);
  if(['127.0.0.1','localhost','[::1]'].includes(parsed.hostname))for(const host of ['127.0.0.1','localhost','[::1]']){const alternate=new URL(configured);alternate.hostname=host;if(!urls.includes(alternate.href.replace(/\/$/,'')))urls.push(alternate.href.replace(/\/$/,''));}
  const probe=(async()=>{
   const errors:string[]=[];
   for(const endpoint of urls){try{const r=await this.request(endpoint+'/api/tags',{signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(!Array.isArray(data.models))throw Error('Response is not an Ollama model list');const result={online:true,models:data.models,endpoint};if(this.configured===configured){this.activeUrl=endpoint;this.cached=result;this.cachedAt=Date.now();}return result;}catch(error){errors.push(endpoint+': '+String(error));}}
   return {online:false,models:[],endpoint:configured,error:'Could not read installed models. '+errors.join(' | ')};
  })();this.pending=probe;try{return await probe;}finally{if(this.pending===probe)this.pending=null;}
 }
}
export const ollamaConnection=new OllamaConnection();
export function registerOllamaConnection(app:Express){
 app.get('/api/ollama/models',async(req,res)=>{try{ollamaConnection.configure(req.query.baseUrl);const snapshot=await ollamaConnection.snapshot(req.query.refresh==='1');res.status(snapshot.online?200:503).json(snapshot);}catch(error){res.status(400).json({online:false,models:[],error:String(error)});}});
}
