import os from 'os';
import {execFile} from 'child_process';
import type {Express} from 'express';
export function registerResourceMonitor(app:Express){
 let previous=os.cpus();let cpu:number|null=null;
 let gpu:number|null=null,gpuAt=0,gpuBusy=false;
 const cpuTimer=setInterval(()=>{const next=os.cpus();let idle=0,total=0;next.forEach((c,i)=>{const old=previous[i];if(!old)return;idle+=c.times.idle-old.times.idle;for(const key of Object.keys(c.times) as (keyof typeof c.times)[])total+=c.times[key]-old.times[key];});cpu=total>0?Math.min(100,Math.max(0,(1-idle/total)*100)):null;previous=next;},2000);cpuTimer.unref();
 function sampleGPU(){
  if(process.platform!=='win32'||gpuBusy||Date.now()-gpuAt<5000)return;
  gpuBusy=true;
  const script="$ErrorActionPreference='Stop'; $items=Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine; if (-not $items) { throw 'No GPU counters' }; $groups=$items | Group-Object { $_.Name -replace '^.*luid_', 'luid_' -replace '_engtype_.*$', '' }; $values=@($groups | ForEach-Object { ($_.Group | Measure-Object UtilizationPercentage -Sum).Sum }); [math]::Min(100, ($values | Measure-Object -Maximum).Maximum) | ConvertTo-Json -Compress";
  execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:8000},(error,stdout)=>{const value=Number(stdout.trim());gpu=!error&&stdout.trim()&&Number.isFinite(value)?Math.max(0,Math.min(100,value)):null;gpuAt=Date.now();gpuBusy=false;});
 }
 app.get('/api/resources',(_req,res)=>{sampleGPU();const total=os.totalmem(),used=total-os.freemem();res.json({cpu,ram:{used,total,percent:used/total*100},gpu:gpuAt&&Date.now()-gpuAt<20000?gpu:null,gpuMetric:'Busiest GPU engine (all processes)',sampledAt:Date.now()});});
}
