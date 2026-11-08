import { OllamaService } from '../services/ollama';
import { modelLibraryEntries } from '../utils/modelLibraryEntries';
import React, {useEffect, useState, useRef} from 'react';
import {OllamaModel} from '../types/chat';
type Entry = {name:string; description:string; summary?:string; cloud?:boolean};
export function ModelLibrary({models,selected,onSelect}:{models:OllamaModel[];selected:string;onSelect:(name:string)=>void}) {
 const [library,setLibrary]=useState<Entry[]>([]), [query,setQuery]=useState(''), [error,setError]=useState(''), [loading,setLoading]=useState(false);
 const [details,setDetails]=useState<Record<string,{tags:string[];sizes:string[]}>>({});
 const [speed,setSpeed]=useState<Record<string,string>>(()=>{try{return JSON.parse(localStorage.getItem('agentdock_model_speeds')||'{}');}catch{return {};}});
 useEffect(()=>{localStorage.setItem('agentdock_model_speeds',JSON.stringify(Object.fromEntries(Object.entries(speed).filter(([,v])=>v.includes('tokens/sec measured')))));},[speed]);
 const [filter,setFilter]=useState('installed');
 const [installed,setInstalled]=useState<OllamaModel[]>(models);
 const [downloads,setDownloads]=useState<Record<string,{status:string;percent:number}>>({});
 const [chosen,setChosen]=useState<Record<string,string>>({});
 const controllers=useRef<Record<string,AbortController>>({});
 const [signin,setSignin]=useState('Checking Ollama sign-in…');
 const [installedError,setInstalledError]=useState('');
 useEffect(()=>{setInstalled(models);},[models]);
 const refreshInstalled=async()=>{try{let base='http://127.0.0.1:11434';try{base=JSON.parse(localStorage.getItem('cursor_ollama_settings')||'{}').baseUrl||base;}catch{}const actual=await OllamaService.getInstalledModels(base,'',true);setInstalled(actual);setInstalledError('');window.dispatchEvent(new CustomEvent('agentdock-models-changed'));}catch(error){setInstalledError(String(error));}};
 useEffect(()=>{void refreshInstalled();void fetch('/ollama-api/api/me').then(async r=>{if(r.ok){const d=await r.json();setSignin(d.name||d.email?`Signed in: ${d.name||d.email}`:'Sign-in status unavailable. Run ollama signin in Terminal.');}else setSignin('Run ollama signin in Terminal to enable cloud models.');}).catch(()=>setSignin('Ollama is offline. Start Ollama and refresh.'));return()=>{Object.values(controllers.current).forEach(c=>c.abort());};},[]);
 const pull=async(name:string)=>{
  if(controllers.current[name])return;
  const controller=new AbortController();controllers.current[name]=controller;
  setDownloads(p=>({...p,[name]:{status:'Connecting…',percent:0}}));
  try{
   const r=await fetch('/ollama-api/api/pull',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:name,stream:true}),signal:controller.signal});
   if(!r.ok||!r.body)throw Error(await r.text());
   const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='',success=false;
   const update=(line:string)=>{if(!line.trim())return;const d=JSON.parse(line);if(d.error)throw Error(d.error);if(d.status==='success')success=true;setDownloads(p=>({...p,[name]:{status:d.status||'Downloading',percent:d.total?Math.round(d.completed/d.total*100):d.status==='success'?100:0}}));};
   while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const lines=buffer.split('\n');buffer=lines.pop()||'';lines.forEach(update);if(done){if(buffer.trim())update(buffer);break;}}
   if(!success)throw Error('Download ended before completion. Retry to resume.');
   await refreshInstalled();
  }catch(e){setDownloads(p=>({...p,[name]:{status:controller.signal.aborted?'Cancelled — Download resumes partial layers':String(e),percent:0}}));}
  finally{delete controllers.current[name];}
 };
 const load=async()=>{setLoading(true);setError('');try{const r=await fetch('/api/model-library');const d=await r.json();if(!r.ok)throw Error(d.error);setLibrary(d.models);}catch(e){setError(String(e));}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 const detail=async(name:string)=>{try{const r=await fetch('/api/library-detail/'+encodeURIComponent(name));const d=await r.json();if(!r.ok)throw Error(d.error);setDetails(p=>({...p,[name]:d}));}catch(e){setError(String(e));}};
 const bench=async(name:string)=>{setSpeed(p=>({...p,[name]:'Measuring…'}));try{const r=await fetch('/api/model-benchmark',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:name})});const d=await r.json();if(!r.ok)throw Error(d.error);setSpeed(p=>({...p,[name]:d.tps?`${d.tps.toFixed(1)} tokens/sec measured`:'Timing unavailable'}));}catch(e){setSpeed(p=>({...p,[name]:String(e)}));}};
 const entries: Entry[] = modelLibraryEntries(library,installed,filter,query);
 return <div className="space-y-3 text-xs text-[#a4a8b2]">
  <div className="font-semibold text-white">Ollama model library</div>
  <p className="text-[10px]">{signin}</p>
  <div className="flex flex-wrap gap-2">{['all','installed','local','cloud'].map(f=><button key={f} onClick={()=>setFilter(f)} className={`px-2 py-1 rounded ${filter===f?'bg-blue-600 text-white':'bg-[#20232b]'}`}>{f}</button>)}</div>
  <input aria-label="Search models" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search models and capabilities" className="w-full bg-[#20232b] p-2 rounded" />
  <button onClick={()=>{void load();void refreshInstalled();}} className="text-blue-400">{loading?'Loading…':'Refresh library'}</button>
  <a className="block text-blue-400" href="https://ollama.com/library" target="_blank" rel="noreferrer">Open full official library ↗</a>
  <div className="p-2 bg-[#20232b] rounded">Cloud: sign in using Ollama on this PC, or run <code className="select-all">ollama signin</code> in Terminal. No API key needed through local Ollama.</div>
  <div>Your computer: speed depends on RAM, processor, model size and context. Benchmark an installed model below for actual generation speed. Cloud speed measures the remote service.</div>
  {error && filter!=='installed' && <p role="alert" className="text-amber-300">Library unavailable: {error}. Your installed models are still listed.</p>}
  <div>{installed.length} installed models · {library.length} library families</div>
  {installedError && <p role="alert" className="text-amber-300">Installed model connection: {installedError}</p>}
  {filter==='installed' && !installed.length && !installedError && <p>No installed models returned by Ollama. Refresh or check the Ollama address in Settings.</p>}
  {entries.map(m=>{
   const localModel=installed.find(i=>i.name===m.name);
   const d=details[m.name]; const cloud='cloud' in m && m.cloud;
   return <div key={m.name} className={`p-2 rounded border ${selected===m.name?'border-blue-400':'border-[#30333c]'} space-y-2`}>
    <div className="font-mono font-bold text-white break-all">{m.name} {cloud?'· Cloud':''}</div>
    <p>{m.description}</p><p>{m.summary}</p>
    <p>Storage: {localModel?.size || (cloud?'Cloud weights are hosted remotely':'Select details for available download sizes')}</p>
    <button className="text-blue-400" onClick={()=>detail(m.name)}>Load tags and storage sizes</button>
    {d && <><p>Published sizes: {d.sizes.join(', ') || 'See official tag page'}. Size varies by tag.</p><select aria-label={'Select tag for '+m.name} className="w-full bg-[#20232b] p-1" value={chosen[m.name]||""} onChange={e=>setChosen(p=>({...p,[m.name]:e.target.value}))}><option value="">Choose model tag…</option>{d.tags.map(t=><option key={t} value={t}>{t}</option>)}</select></>}
    <a className="block text-blue-400" target="_blank" rel="noreferrer" href={'https://ollama.com/library/'+encodeURIComponent(m.name)+'/tags'}>Official tags, sizes and context ↗</a>
    {localModel && <><button className="text-blue-400 block" onClick={()=>onSelect(localModel.name)}>Use {localModel.name}</button><button disabled={speed[localModel.name]==='Measuring…'} onClick={()=>bench(localModel.name)}>Benchmark {localModel.name}</button><p>{speed[localModel.name] || 'Speed: not measured'}</p></>}
    <div className="rounded bg-[#20232b] p-2 space-y-2">
      <div className="break-all">{chosen[m.name]||(m.name.includes(':')?m.name:m.name+':latest')}</div>
      <button className="px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-50" disabled={!!controllers.current[chosen[m.name]||(m.name.includes(':')?m.name:m.name+':latest')]} onClick={()=>pull(chosen[m.name]||(m.name.includes(':')?m.name:m.name+':latest'))}>Download / update</button>
      <button className="ml-2 text-blue-400" onClick={()=>onSelect(chosen[m.name]||(m.name.includes(':')?m.name:m.name+':latest'))}>Use model</button>
      {downloads[chosen[m.name]||(m.name.includes(':')?m.name:m.name+':latest')] && <><progress className="w-full" max={100} value={downloads[chosen[m.name]||(m.name.includes(':')?m.name:m.name+':latest')].percent}/><p role="status">{downloads[chosen[m.name]||(m.name.includes(':')?m.name:m.name+':latest')].status} {downloads[chosen[m.name]||(m.name.includes(':')?m.name:m.name+':latest')].percent}%</p><button onClick={()=>controllers.current[chosen[m.name]||(m.name.includes(':')?m.name:m.name+':latest')]?.abort()}>Cancel download</button></>}
     </div>
   </div>;
  })}
 </div>;
}
