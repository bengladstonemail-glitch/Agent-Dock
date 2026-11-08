import fs from 'fs';import path from 'path';import {execFile} from 'child_process';import type {Express} from 'express';
export class ProjectSelection {
 root:string;version=0;
 constructor(initial:string,private preferencesFile?:string){this.root=fs.realpathSync(initial);if(preferencesFile){try{const saved=JSON.parse(fs.readFileSync(preferencesFile,'utf8'));if(fs.statSync(saved.root).isDirectory())this.root=fs.realpathSync(saved.root);}catch{}}}
 select(input:unknown){if(typeof input!=='string')throw Error('Choose an absolute folder path');const cleaned=input.trim().replace(/^"(.*)"$/,'$1');if(!path.isAbsolute(cleaned))throw Error('Choose an absolute folder path');const root=fs.realpathSync(cleaned);if(!fs.statSync(root).isDirectory())throw Error('Choose a folder, not a file');if(this.preferencesFile){fs.mkdirSync(path.dirname(this.preferencesFile),{recursive:true});fs.writeFileSync(this.preferencesFile,JSON.stringify({root}));}this.root=root;this.version++;return {root:this.root,version:this.version};}
}
export function browseProjectFolders(input:string){
 const root=fs.realpathSync(input.trim().replace(/^"(.*)"$/,'$1'));
 if(!fs.statSync(root).isDirectory())throw Error('Choose a folder, not a file');
 const folders=fs.readdirSync(root,{withFileTypes:true}).flatMap(entry=>{
  if(entry.name.startsWith('.'))return [];
  const full=path.join(root,entry.name);
  try{if(!fs.statSync(full).isDirectory())return [];}catch{return [];}
  return [{name:entry.name,path:full}];
 }).sort((a,b)=>a.name.localeCompare(b.name));
 const parent=path.dirname(root);
 const drives=process.platform==='win32'?Array.from({length:26},(_,n)=>String.fromCharCode(65+n)+':\\').filter(d=>fs.existsSync(d)):['/'];
 return {path:root,parent:parent===root?null:parent,folders,drives};
}
export function registerProjects(app:Express,selection:ProjectSelection,onChange:(root:string)=>void){
 app.get('/api/project',(_req,res)=>res.json({root:selection.root,version:selection.version}));
 app.get('/api/project/browse',(req,res)=>{try{res.json(browseProjectFolders(typeof req.query.path==='string'?req.query.path:selection.root));}catch(error){res.status(400).json({error:String(error)});}});
 app.post('/api/project/open',(req,res)=>{try{const data=selection.select(req.body.path);onChange(data.root);res.json(data);}catch(e){res.status(400).json({error:String(e)});}});
 app.post('/api/project/pick',async(_req,res)=>{
  if(process.platform!=='win32'){res.status(400).json({error:'Native picker requires Windows. Use Enter path instead.'});return;}
  const script="Add-Type -AssemblyName System.Windows.Forms; $owner=New-Object System.Windows.Forms.Form; $owner.TopMost=$true; $dialog=New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description='Open a Agent Dock project folder'; if($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK){ [Console]::Write($dialog.SelectedPath) }; $dialog.Dispose(); $owner.Dispose()";
  execFile('powershell.exe',['-NoProfile','-STA','-NonInteractive','-Command',script],{windowsHide:true,timeout:300000},(error,stdout)=>{if(error){res.status(500).json({error:'Folder picker failed. Use Enter path instead.'});return;}res.json({path:stdout.trim(),cancelled:!stdout.trim()});});
 });
}
