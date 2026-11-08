import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import type {Express} from 'express';
import fs from 'fs';import path from 'path';import os from 'os';
export class RobloxBridge {
 client:Client|null=null; transport:StdioClientTransport|null=null; tools:any[]=[]; selectedStudio=''; connecting:Promise<void>|null=null;
 async connect(){
  if(this.client)return;
  if(this.connecting)return this.connecting;
  this.connecting=(async()=>{
   let command='';
   if(process.platform==='win32'){
    const root=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'Roblox');
    const batch=path.join(root,'mcp.bat');
    if(fs.existsSync(batch)){const match=fs.readFileSync(batch,'utf8').match(/"([^"\r\n]*StudioMCP\.exe)"/i);if(match&&fs.existsSync(match[1]))command=match[1];}
    if(!command){const versions=path.join(root,'Versions');if(fs.existsSync(versions)){const candidates=fs.readdirSync(versions).map(v=>path.join(versions,v,'StudioMCP.exe')).filter(p=>fs.existsSync(p)).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs);command=candidates[0]||'';}}
   }else if(process.platform==='darwin')command='/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP';
   if(!command||!fs.existsSync(command))throw Error('Roblox Studio MCP executable not found. Update Studio and enable Studio as MCP server in Assistant > Manage MCP Servers.');
   const transport=new StdioClientTransport({command,args:[],stderr:'pipe'});
   const client=new Client({name:'Agent Dock',version:'8.0.0'});
   try{await client.connect(transport,{timeout:20000});const result=await client.listTools();if(!result.tools.length)throw Error('Studio MCP started but exposed no tools. Open a place, enable Studio as MCP server, then reconnect.');this.client=client;this.transport=transport;this.tools=[...result.tools];
   if(result.tools.some(t=>t.name==='execute_luau'))this.tools.unshift({name:'agentdock_create_part',description:'Actually create and verify an anchored Part in the selected Studio Edit workspace. Defaults to red, 4x2x4 studs, next to SpawnLocation or above the baseplate. No coordinates needed. Returns a verified instance path and actual position.',inputSchema:{type:'object',properties:{name:{type:'string'},x:{type:'number'},y:{type:'number'},z:{type:'number'}},additionalProperties:false}});client.onclose=()=>{this.client=null;this.tools=[];this.selectedStudio='';};}catch(e){await transport.close();throw e;}
  })();
  try{await this.connecting;}finally{this.connecting=null;}
 }
 async call(name:string,args:Record<string,unknown>):Promise<any>{
  if(!this.client)throw Error('Connect Roblox Studio first.');
  if(!this.tools.some(t=>t.name===name))throw Error('Unknown Roblox tool: '+name);
  if(name!=='list_roblox_studios'&&!this.selectedStudio)throw Error('Choose the target Studio instance before editing.');
  if(name==='agentdock_create_part'){
   const coordinates=['x','y','z'].map(k=>args[k]);
   const hasPosition=coordinates.some(v=>v!==undefined);
   if(hasPosition&&!coordinates.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<1000000))throw Error('Provide all three finite coordinates, or omit them to place beside spawn.');
   const label=typeof args.name==='string'?args.name.slice(0,80):'AgentDockRedPart';
   const safeLabel=label.replace(/[^a-zA-Z0-9 _.-]/g,'_')||'AgentDockRedPart';
   const position=hasPosition?`Vector3.new(${coordinates.join(',')})`:"(spawn and spawn.Position + Vector3.new(spawn.Size.X/2 + 4, 3, 0) or Vector3.new(0, 5, 0))";
   const code=`local workspace = game:GetService("Workspace")
local spawn = workspace:FindFirstChildWhichIsA("SpawnLocation", true)
local p = Instance.new("Part")
p.Name = "${safeLabel}"
p.Anchored = true
p.Size = Vector3.new(4, 2, 4)
p.Color = Color3.fromRGB(255, 0, 0)
p.Position = ${position}
p.Parent = workspace
assert(p.Parent == workspace and workspace:FindFirstChild(p.Name), "Part verification failed")
local result = "AGENTDOCK_VERIFIED_PART | " .. p:GetFullName() .. " | Position=" .. tostring(p.Position) .. " | Anchored=" .. tostring(p.Anchored)
print(result)
return result`;
   const result=await this.call('execute_luau',{code,datamodel_type:'Edit'});
   const text=JSON.stringify(result);
   if(result.isError || !text.includes('AGENTDOCK_VERIFIED_PART'))return {isError:true,content:[{type:'text',text:'Creation was not verified. Studio response: '+text}]};
   return {isError:false,content:[{type:'text',text:'Verified by Studio: '+text}]};
  }
  const tool=this.tools.find(t=>t.name===name);
  const actual={...args};if(name!=='list_roblox_studios' && tool.inputSchema?.properties?.studio_id)actual.studio_id=this.selectedStudio;
  return this.client.callTool({name,arguments:actual},undefined,{timeout:120000});
 }
}
export const roblox=new RobloxBridge();
export function registerRoblox(app:Express){
 app.get('/api/roblox/status',(_req,res)=>res.json({connected:!!roblox.client,tools:roblox.tools,selectedStudio:roblox.selectedStudio}));
 app.post('/api/roblox/connect',async(_req,res)=>{try{await roblox.connect();const studios=roblox.tools.some(t=>t.name==='list_roblox_studios')?await roblox.call('list_roblox_studios',{}):null;res.json({connected:true,tools:roblox.tools,studios});}catch(e){res.status(503).json({error:String(e)});}});
 app.post('/api/roblox/select',(req,res)=>{if(typeof req.body.studioId!=='string'||!req.body.studioId.trim()){res.status(400).json({error:'Studio ID required'});return;}roblox.selectedStudio=req.body.studioId.trim();res.json({ok:true});});
 app.post('/api/roblox/call',async(req,res)=>{try{if(req.body.studioId && req.body.studioId!==roblox.selectedStudio)throw Error('Studio target changed during this task. Start the request again.');const result=await roblox.call(req.body.name,req.body.arguments||{});res.json({result});}catch(e){res.status(502).json({error:String(e)});}});
 app.post('/api/roblox/disconnect',async(_req,res)=>{try{await roblox.client?.close();roblox.client=null;roblox.tools=[];roblox.selectedStudio='';res.json({ok:true});}catch(e){res.status(500).json({error:String(e)});}});
}
