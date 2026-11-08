import React,{useState} from 'react';
import {OllamaModel} from '../types/chat';
export function BAgentControls({models,disabled}:{models:OllamaModel[];disabled:boolean}){
 const [roles,setRoles]=useState<Record<string,string>>(()=>{try{return JSON.parse(localStorage.getItem('agentdock_bagent_models')||'{}');}catch{return {};}});
 const update=(role:string,value:string)=>setRoles(previous=>{const next={...previous,[role]:value};localStorage.setItem('agentdock_bagent_models',JSON.stringify(next));return next;});
 return <div className="shrink-0 p-2 border-b border-[#30333c] bg-[#191622] text-[11px] space-y-2">
  <strong className="text-purple-200">bAgent team</strong>
  <p className="text-[#a4a8b2]">Planner → Coder → Reviewer. The coder creates real files; the reviewer reads and fixes them. Choose a vision model for the planner when attaching images.</p>
  {['planner','coder','reviewer'].map(role=><label key={role} className="flex flex-wrap gap-2 items-center"><span className="w-16 capitalize">{role}</span><input aria-label={`${role} model`} list="bagent-model-options" disabled={disabled} value={roles[role]||''} onChange={e=>update(role,e.target.value)} placeholder="Choose or enter exact Ollama model tag" className="flex-1 min-w-0 rounded p-1.5 bg-[#252431] text-white"/></label>)}
  <datalist id="bagent-model-options">{models.map(m=><option key={m.name} value={m.name}/>)}</datalist>
  <p className="text-[#8b909a]">Enable Web search below for planner research. File creation and edits run automatically in your selected project. Save unsaved edits before starting.</p>
 </div>;
}
