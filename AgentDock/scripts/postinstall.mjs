import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const check=process.argv.includes('--check');
if(process.platform!=='win32'){console.log('Agent Dock desktop launcher is Windows-only. Use npm run dev on this OS.');process.exit(0);}
for(const file of ['scripts/AgentDockDesktop.cs','scripts/create-launcher.ps1','node_modules/vite/bin/vite.js'])if(!existsSync(path.join(root,file)))throw Error('Missing installation file: '+file);
if(!check){const built=spawnSync(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build'],{cwd:root,stdio:'inherit',windowsHide:true});if(built.status!==0)throw Error('Interface build failed; agentdock.exe was not created.');}
const shell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
const result=spawnSync(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/create-launcher.ps1')],{cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,AGENTDOCK_NODE_PATH:process.execPath,AGENTDOCK_LAUNCHER_CHECK:check?'1':'0'}});
if(result.status!==0)throw Error('Windows launcher generation failed. Close the running agentdock.exe and run npm install again.');
if(!check)console.log('Ready: double-click agentdock.exe. Keep it with this folder; no terminal commands are needed on each launch; keep Node installed.');
