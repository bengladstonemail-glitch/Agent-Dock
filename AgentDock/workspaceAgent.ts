import fs from 'fs';import path from 'path';import crypto from 'crypto';import type {Express} from 'express';
const schema=(properties:any,required:string[]=[])=>({type:'object',properties,required,additionalProperties:false});
const string={type:'string'};
export const workspaceTools=[
 {name:'workspace_list',description:'List real files/folders inside Agent Dock. Use a relative path; empty means root.',inputSchema:schema({path:string})},
 {name:'workspace_read',description:'Read file text and its revision hash before editing.',inputSchema:schema({path:string},['path'])},
 {name:'workspace_mkdir',description:'Create folders recursively inside Agent Dock.',inputSchema:schema({path:string},['path'])},
 {name:'workspace_write',description:'Create a new file with complete content. To overwrite an existing file, read it first and provide its revision. Parent folders are created automatically.',inputSchema:schema({path:string,content:string,revision:string},['path','content'])},
 {name:'workspace_delete',description:'Move a file or folder and its contents to recoverable Agent Dock trash. Read the file or list the folder first and supply its revision. Never deletes the Agent Dock root or internal metadata.',inputSchema:schema({path:string,revision:string},['path','revision'])},
 {name:'workspace_restore',description:'Restore an item previously deleted by workspace_delete using the returned trashId. Refuses to overwrite an existing path.',inputSchema:schema({trashId:string},['trashId'])},
 {name:'workspace_edit',description:'Replace one exact text occurrence in an existing file. Read first and provide its revision. Fails safely if text is missing or ambiguous.',inputSchema:schema({path:string,oldText:string,newText:string,revision:string},['path','oldText','newText','revision'])},
];
const hash=(text:string)=>crypto.createHash('sha256').update(text).digest('hex');
export function createWorkspaceExecutor(rootDir:string){
 const root=fs.realpathSync(rootDir);
 const inside=(p:string)=>{const rel=path.relative(root,p);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
 const resolve=(value:unknown)=>{
  if(typeof value!=='string'||value.includes('\0'))throw Error('A relative workspace path is required');
  if(path.isAbsolute(value)||/^[a-z]:/i.test(value))throw Error('Use a path relative to Agent Dock');
  const target=path.resolve(root,value);if(!inside(target))throw Error('Path leaves Agent Dock');
  let parent=target;while(!fs.existsSync(parent)){const next=path.dirname(parent);if(next===parent)throw Error('Invalid path');parent=next;}
  if(!inside(fs.realpathSync(parent)))throw Error('Path follows a link outside Agent Dock');
  if(target===root&&value.trim())throw Error('Root cannot be overwritten');return target;
 };
 const folderRevision=(folder:string):string=>{
  const entries:string[]=[];
  const walk=(dir:string)=>{for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const full=path.join(dir,item.name);const stat=fs.lstatSync(full);if(entries.length>=10000)throw Error('Folder is too large to snapshot for deletion');entries.push(`${path.relative(folder,full)}:${stat.size}:${stat.mtimeMs}:${stat.mode}`);if(item.isDirectory()&&!stat.isSymbolicLink())walk(full);}};
  walk(folder);return hash(entries.join('\n'));
 };
 return (name:string,args:any)=>{
  if(!workspaceTools.some(t=>t.name===name))throw Error('Unknown workspace tool');
  if(name==='workspace_restore'){
   if(typeof args.trashId!=='string'||!/^[a-f0-9-]{36}$/.test(args.trashId))throw Error('Valid trashId required');
   const container=resolve('.agentdock/trash/'+args.trashId);
   const info=JSON.parse(fs.readFileSync(path.join(container,'info.json'),'utf8'));
   const destination=resolve(info.originalPath);
   if(destination===root||info.originalPath.replace(/\\/g,'/').split('/')[0]==='.agentdock')throw Error('Protected destination');
   if(fs.existsSync(destination))throw Error('Restore destination already exists');
   fs.mkdirSync(path.dirname(destination),{recursive:true});fs.renameSync(path.join(container,'item'),destination);
   return {verified:fs.existsSync(destination),action:'restored',path:info.originalPath};
  }
  const target=resolve(args.path??'');
  if(name==='workspace_delete'){
   if(target===root)throw Error('Cannot delete the workspace root');
   const relative=path.relative(root,target);
   if(relative.split(path.sep)[0]==='.agentdock')throw Error('Internal Agent Dock metadata is protected');
   const stat=fs.lstatSync(target);if(stat.isSymbolicLink())throw Error('Linked folders/files cannot be deleted by Agent');
   const revision=stat.isDirectory()?folderRevision(target):hash(fs.readFileSync(target,'utf8'));
   if(!args.revision||args.revision!==revision)throw Error('Revision missing or stale. Read the file or list the folder again before deleting.');
   const trashId=crypto.randomUUID(),container=resolve('.agentdock/trash/'+trashId);
   fs.mkdirSync(container,{recursive:true});
   fs.writeFileSync(path.join(container,'info.json'),JSON.stringify({originalPath:relative,deletedAt:new Date().toISOString()}));
   fs.renameSync(target,path.join(container,'item'));
   return {verified:!fs.existsSync(target),action:'deleted',path:relative.replace(/\\/g,'/'),trashId,recoverable:true};
  }
  if(name==='workspace_list'){return {path:args.path||'',revision:target===root?undefined:folderRevision(target),entries:fs.readdirSync(target,{withFileTypes:true}).slice(0,1000).map(e=>({name:e.name,type:e.isDirectory()?'folder':'file'}))};}
  if(name==='workspace_mkdir'){fs.mkdirSync(target,{recursive:true});return {created:true,verified:fs.statSync(target).isDirectory(),action:'created',path:args.path};}
  if(name==='workspace_read'){if(fs.statSync(target).size>500000)throw Error('File too large for one read');const content=fs.readFileSync(target,'utf8');if(content.includes('\0'))throw Error('Binary files cannot be edited as text');return {path:args.path,content,revision:hash(content)};}
  if(target===root)throw Error('Cannot write to workspace root');
  const exists=fs.existsSync(target);let current='';
  if(exists){if(!fs.statSync(target).isFile())throw Error('Target is not a file');if(fs.statSync(target).size>500000)throw Error('File too large');current=fs.readFileSync(target,'utf8');if(!args.revision||args.revision!==hash(current))throw Error('Revision missing or stale. Read the file again before editing.');}
  let content=args.content;
  if(name==='workspace_edit'){
   if(!exists)throw Error('File does not exist');
   if(typeof args.oldText!=='string'||!args.oldText||typeof args.newText!=='string')throw Error('Exact oldText and newText required');
   const index=current.indexOf(args.oldText);if(index<0||current.indexOf(args.oldText,index+1)>=0)throw Error('Replacement is missing or ambiguous');
   content=current.slice(0,index)+args.newText+current.slice(index+args.oldText.length);
  }
  if(typeof content!=='string'||Buffer.byteLength(content)>500000)throw Error('Text content must be at most 500 KB');
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content,'utf8');
  const verified=fs.readFileSync(target,'utf8');if(verified!==content)throw Error('Write verification failed');
  return {verified:true,path:args.path,action:exists?'updated':'created',bytes:Buffer.byteLength(verified),revision:hash(verified)};
 };
}
export function registerWorkspaceAgent(app:Express,rootProvider:string|(()=>string)){
 const getRoot=()=>typeof rootProvider==='function'?rootProvider():rootProvider;
 app.get('/api/workspace-agent/tools',(_req,res)=>res.json({root:getRoot(),tools:workspaceTools}));
 app.post('/api/workspace-agent/call',(req,res)=>{try{
  const root=getRoot();
  if(req.body.root&&path.resolve(req.body.root)!==path.resolve(root)){res.status(409).json({error:'Project changed during this task. No action performed. Restart the task in the selected folder.'});return;}
  res.json({result:createWorkspaceExecutor(root)(req.body.name,req.body.arguments||{})});
 }catch(e){res.status(400).json({error:String(e)});}});
}
