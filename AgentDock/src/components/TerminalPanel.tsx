import React,{useEffect,useRef,useState} from 'react';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
interface Props{isOpen:boolean;onClose:()=>void;baseProjectDir?:string;pythonBridgeUrl?:string;bridgeOnline?:boolean}
const sessionId=()=>`shell-${Date.now()}-${Math.random().toString(36).slice(2)}`;
function Shell({id,shell,cwd}:{id:string;shell:string;cwd?:string}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const term=new Terminal({cursorBlink:true,fontSize:12,theme:{background:'#111318'},convertEol:false});const fit=new FitAddon();term.loadAddon(fit);term.open(host.current!);
  let disposed=false,offset=0,timer:ReturnType<typeof setTimeout>;const controller=new AbortController();
  const send=async(url:string,body:unknown)=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});if(!r.ok)throw Error(await r.text());};
  let ready=false;let inputQueue=Promise.resolve();
  const input=term.onData(data=>{if(ready)inputQueue=inputQueue.then(()=>send(`/api/live-terminal/${id}/input`,{data})).catch(e=>{if(!disposed)term.writeln(String(e));});});
  const resize=()=>{if(disposed)return;fit.fit();if(ready)void send(`/api/live-terminal/${id}/resize`,{cols:term.cols,rows:term.rows}).catch(()=>{});};
  const observer=new ResizeObserver(resize);observer.observe(host.current!);
  const poll=async()=>{try{const r=await fetch(`/api/live-terminal/${id}?offset=${offset}`,{signal:controller.signal});if(!r.ok)throw Error('Terminal disconnected');const d=await r.json();if(disposed)return;term.write(d.output);offset=d.offset;if(d.exited)return;}catch(e){if(disposed)return;term.writeln(`\r\n${String(e)}`);}if(!disposed)timer=setTimeout(poll,100);};
  void send('/api/live-terminal',{id,shell,cwd}).then(()=>{if(!disposed){ready=true;resize();term.focus();void poll();}}).catch(e=>{if(!disposed)term.writeln(`Could not start terminal: ${e}`);});
  return()=>{disposed=true;controller.abort();clearTimeout(timer);observer.disconnect();input.dispose();term.dispose();};
 },[id,shell,cwd]);
 return <div ref={host} className="h-full w-full p-2 overflow-hidden"/>;
}
export function TerminalPanel({isOpen,onClose,baseProjectDir}:Props){
 const [tabs,setTabs]=useState(()=>[{id:sessionId(),shell:'powershell',cwd:baseProjectDir}]);const [active,setActive]=useState('');const [max,setMax]=useState(false);
 const previousRoot=useRef(baseProjectDir);
 useEffect(()=>{if(previousRoot.current!==baseProjectDir){previousRoot.current=baseProjectDir;const tab={id:sessionId(),shell:'powershell',cwd:baseProjectDir};setTabs(t=>[...t,tab]);setActive(tab.id);}},[baseProjectDir]);
 const selected=active||tabs[0]?.id;
 const add=(shell:string)=>{const tab={id:sessionId(),shell,cwd:baseProjectDir};setTabs(t=>[...t,tab]);setActive(tab.id);};
 const close=(id:string)=>{void fetch(`/api/live-terminal/${id}`,{method:'DELETE'});setTabs(t=>t.filter(x=>x.id!==id));if(active===id)setActive('');};
 return <div style={{display:isOpen?'flex':'none',height:max?'75vh':'320px'}} className="flex-col shrink-0 border-t border-[#30333c] bg-[#111318] text-[#bbb]">
 <div className="flex items-center gap-2 p-2 text-xs overflow-x-auto shrink-0"><strong>Terminal</strong>{tabs.map(t=><div className={selected===t.id?'text-blue-400':'text-gray-400'} key={t.id}><button onClick={()=>setActive(t.id)}>{t.shell}</button> <button aria-label="Close terminal tab" onClick={()=>close(t.id)}>×</button></div>)}<button onClick={()=>add('powershell')}>+ PowerShell</button><button onClick={()=>add('cmd')}>+ CMD</button><button onClick={()=>setMax(!max)}>Resize</button><button onClick={onClose}>Hide</button></div>
 {tabs.length===0&&<div className="p-3 text-xs">Choose + CMD or + PowerShell to open a terminal.</div>}
 <div className="flex-1 min-h-0">{tabs.map(t=><div key={t.id} className="h-full" style={{display:t.id===selected?'block':'none'}}><Shell id={t.id} shell={t.shell} cwd={t.cwd}/></div>)}</div>
 </div>;
}
