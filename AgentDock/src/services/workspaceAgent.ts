import type {OllamaSettings} from '../types/chat';import type {StreamChunk} from './ollama';
let dirtyPaths: string[] = [];
export function setWorkspaceDraftPaths(paths:string[]){dirtyPaths=paths;}
export async function* runWorkspaceAgent(settings:OllamaSettings,messages:any[],system:string,signal?:AbortSignal):AsyncGenerator<StreamChunk>{
 const infoResponse=await fetch('/api/workspace-agent/tools',{signal});if(!infoResponse.ok)throw Error('Workspace tools unavailable');const info=await infoResponse.json();
 if(settings.baseProjectDir && settings.baseProjectDir.replace(/\\/g,'/').toLowerCase()!==info.root.replace(/\\/g,'/').toLowerCase())throw Error('The selected project changed. Restart the task in the current folder.');
 const tools=info.tools.map((t:any)=>({type:'function',function:{name:t.name,description:t.description,parameters:t.inputSchema}}));
 const history:any[]=[{role:'system',content:`You are Agent Dock Agent. Answer greetings and normal questions directly without unnecessary tools. When asked to create or edit a project, use the real workspace tools to DO the work, not just provide instructions. Filesystem root: ${info.root}. Use relative paths. Inspect existing files before changing them. Use revision from workspace_read to overwrite or edit existing files. Do not overwrite unrelated files. Delete only the paths the user requests using workspace_delete; read files or list folders first for their revision. Deleted items are recoverable using workspace_restore and the returned trashId. Create complete runnable files with requirements and run instructions where relevant. Verify files by reading them back. Never claim creation without successful tool results. Tools cannot execute programs, so don't claim tests ran. External MCP is separate from these built-in workspace tools. Team role and task instructions: ${system}\nProject instructions: ${settings.systemPrompt}`},...messages.slice(-12)];
 const wantsChanges=/\b(create|build|write|edit|change|make|update|replace|delete|remove|restore)\b/i.test([...messages].reverse().find(m=>m.role==='user')?.content||'');
 let changed=false,executed=0,retried=false;
 for(let round=0;round<24;round++){
  signal?.throwIfAborted();
  const response=await fetch('/ollama-api/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({model:settings.selectedModel,messages:history,tools,stream:false,options:{temperature:settings.temperature,top_p:settings.topP,num_ctx:settings.contextWindow}})});
  if(!response.ok)throw Error('Ollama Agent request failed: '+await response.text());
  const d=await response.json();if(!d.message)throw Error(d.error||'Empty model response');history.push(d.message);
  window.dispatchEvent(new CustomEvent('agentdock-generation',{detail:{count:d.eval_count,duration:d.eval_duration,model:settings.selectedModel,state:'Unavailable'}}));
  const calls=d.message.tool_calls||[];
  if(!calls.length){
   if(wantsChanges&&!changed&&!retried){retried=true;history.push({role:'user',content:'No filesystem changes have been verified. Use native workspace tools now to carry out the requested file/folder changes, including deletions; do not just describe them.'});continue;}
   if(wantsChanges&&!changed){yield {content:'No filesystem changes were verified. The model did not complete the requested changes. Any unsupported completion claim was hidden.'};return;}
   if(d.message.content)yield {content:d.message.content};
   if(changed)yield {content:'\n\n**Workspace changes verified on disk.** Programs were not automatically executed.'};
   else if(executed)yield {content:'\n\nNo files were changed.'};return;
  }
  for(const call of calls){
   signal?.throwIfAborted();const name=call.function?.name;
   if(!info.tools.some((t:any)=>t.name===name))throw Error('Unknown workspace tool '+name);
   let args=call.function.arguments||{};if(typeof args==='string')args=JSON.parse(args);
   const parts=(info.root+'/'+String(args.path||'')).replace(/\\/g,'/').split('/');
   const normalized:string[]=[];for(const part of parts){if(part==='..')normalized.pop();else if(part&&part!=='.')normalized.push(part);}
   const fullPath=normalized.join('/').toLowerCase();
   if(['workspace_write','workspace_edit','workspace_delete'].includes(name)&&dirtyPaths.some(p=>{const draft=p.replace(/\\/g,'/').toLowerCase();return draft===fullPath||(name==='workspace_delete'&&draft.startsWith(fullPath+'/'));})){
    const error='This file has unsaved editor changes. Save those edits before Agent modifies the file.';
    yield {content:error+'\n\n'};history.push({role:'tool',tool_name:name,content:JSON.stringify({error})});continue;
   }
   yield {content:`\n\n**${name}** · ${String(args.path||'Agent Dock')}\n\n`};
   const r=await fetch('/api/workspace-agent/call',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({name,arguments:args,root:info.root})});const result=await r.json();executed++;
   if(r.ok&&result.result?.verified){changed=true;window.dispatchEvent(new CustomEvent('agentdock-workspace-changed',{detail:result.result}));yield {content:`Verified: ${result.result.action} \`${result.result.path}\`${result.result.trashId?' · Recoverable trash ID: '+result.result.trashId:''}\n\n`};}
   else if(!r.ok)yield {content:`Tool error: ${result.error}\n\n`};
   history.push({role:'tool',tool_name:name,content:JSON.stringify(result)});
  }
 }
 yield {content:'\n\nStopped at the 24-round limit. Review completed file operations above.'};
}
