import * as pty from 'node-pty';
import type { Express } from 'express';
import fs from 'fs';
export function registerLiveTerminal(app: Express, baseDir: string|(()=>string)) {
 const sessions = new Map<string, {process: pty.IPty; output:string; start:number; exited:boolean}>();
 app.post('/api/live-terminal', (req,res) => {
  const id=req.body.id;
  if(typeof id !== 'string' || id.length>100){res.sendStatus(400);return;}
  if(sessions.has(id)){res.json({id});return;}
  try {
   const win=process.platform==='win32';
   const shell=win?(req.body.shell==='cmd'?'cmd.exe':'powershell.exe'):'/bin/bash';
   const cwd=typeof req.body.cwd==='string' && fs.existsSync(req.body.cwd)?req.body.cwd:(typeof baseDir==='function'?baseDir():baseDir);
   const proc=pty.spawn(shell,win && shell==='powershell.exe'?['-NoLogo','-NoProfile']:[],{name:'xterm-256color',cols:100,rows:24,cwd,env:process.env as Record<string,string>});
   const state={process:proc,output:'',start:0,exited:false};sessions.set(id,state);
   proc.onData(data=>{state.output+=data;if(state.output.length>2000000){const trim=state.output.length-1000000;state.output=state.output.slice(trim);state.start+=trim;}});
   proc.onExit(({exitCode})=>{state.exited=true;state.output+=`\r\n[Shell exited: ${exitCode}]\r\n`;});
   res.json({id});
  }catch(e){res.status(500).json({error:String(e)});}
 });
 app.get('/api/live-terminal/:id',(req,res)=>{const s=sessions.get(req.params.id);if(!s){res.sendStatus(404);return;}const offset=Math.max(s.start,Number(req.query.offset)||0);res.json({output:s.output.slice(offset-s.start),offset:s.start+s.output.length,exited:s.exited});});
 app.post('/api/live-terminal/:id/input',(req,res)=>{const s=sessions.get(req.params.id);if(!s||s.exited){res.sendStatus(404);return;}if(typeof req.body.data==='string')s.process.write(req.body.data);res.json({ok:true});});
 app.post('/api/live-terminal/:id/resize',(req,res)=>{const s=sessions.get(req.params.id);if(s&&!s.exited)s.process.resize(Math.min(500,Math.max(10,Number(req.body.cols)||80)),Math.min(200,Math.max(2,Number(req.body.rows)||24)));res.json({ok:true});});
 app.delete('/api/live-terminal/:id',(req,res)=>{const s=sessions.get(req.params.id);if(s){try{s.process.kill();}catch{}sessions.delete(req.params.id);}res.json({ok:true});});
}
