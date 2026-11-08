import React,{useEffect,useState} from 'react';
type Stats={cpu:number|null;ram:{used:number;total:number;percent:number};gpu:number|null;gpuMetric:string};
export function ResourceBar(){
 const [stats,setStats]=useState<Stats|null>(null),[online,setOnline]=useState(false);
 const [rate,setRate]=useState<{value:number|null;state:string;model:string}>({value:null,state:'Idle',model:''});
 useEffect(()=>{
  let disposed=false,timer:ReturnType<typeof setTimeout>;const abort=new AbortController();
  const poll=async()=>{try{const r=await fetch('/api/resources',{signal:abort.signal});if(!r.ok)throw Error();const d=await r.json();if(!disposed){setStats(d);setOnline(true);}}catch{if(!disposed)setOnline(false);}if(!disposed)timer=setTimeout(poll,2500);};void poll();
  const onMetrics=(event:Event)=>{const d=(event as CustomEvent).detail;if(d.state==='generating')setRate({value:null,state:'Generating',model:d.model||''});else if(d.count>0&&d.duration>0)setRate({value:d.count/d.duration*1e9,state:'Last response',model:d.model||''});else setRate({value:null,state:d.state||'Unavailable',model:d.model||''});};
  const end=()=>setRate(r=>r.state==='Generating'?{value:null,state:'Unavailable',model:r.model}:r);
  window.addEventListener('agentdock-generation-end',end);
  window.addEventListener('agentdock-generation',onMetrics);
  return()=>{disposed=true;abort.abort();clearTimeout(timer);window.removeEventListener('agentdock-generation',onMetrics);window.removeEventListener('agentdock-generation-end',end);};
 },[]);
 const pct=(value:number|null|undefined)=>online&&typeof value==='number'?`${value.toFixed(0)}%`:'Unavailable';
 const gb=(value:number)=>(value/1024**3).toFixed(1);
 return <div className="shrink-0 flex flex-wrap items-center gap-x-5 gap-y-1 px-3 py-1.5 border-t border-[#30333c] bg-[#14171d] text-[11px] text-[#abb4c4]" role="status" aria-label="System resource monitor">
  <span title="Overall processor usage on the PC running Agent Dock">CPU <strong className="text-[#83c9ff]">{pct(stats?.cpu)}</strong></span>
  <span title="System memory used / total">RAM <strong className="text-[#83c9ff]">{online&&stats?`${gb(stats.ram.used)} / ${gb(stats.ram.total)} GB (${stats.ram.percent.toFixed(0)}%)`:'Unavailable'}</strong></span>
  <span title={stats?.gpuMetric||'GPU usage requires supported Windows counters'}>GPU <strong className="text-[#83c9ff]">{pct(stats?.gpu)}</strong></span>
  <span title={`${rate.model} · Actual Ollama generation timing, available after a response finishes. Cloud models report remote generation speed.`}>Tokens/sec <strong className="text-[#83c9ff]">{rate.value!==null?rate.value.toFixed(1):'—'}</strong> <span className="text-[#727f92]">{rate.state}</span></span>
 </div>;
}
