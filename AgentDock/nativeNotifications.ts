import notifier from 'node-notifier';import {execFile} from 'child_process';import crypto from 'crypto';import type {Express} from 'express';
export type NotificationRecord={id:string;state:string;error?:string;created:number};
export function createNativeNotificationService(port:number,notify=notifier.notify.bind(notifier),open=(url:string)=>{if(process.platform==='win32')execFile('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true},()=>{});}){
 const records=new Map<string,NotificationRecord>();
 const send=(input:{title:string;message:string;sound:boolean;chatId?:string})=>{
  const id=crypto.randomUUID();const record:NotificationRecord={id,state:'submitted',created:Date.now()};records.set(id,record);
  if(records.size>100)records.delete(records.keys().next().value!);
  try{notify({title:input.title.slice(0,100),message:input.message.slice(0,300),sound:input.sound,wait:true},(error:any,response:any,metadata:any)=>{
   if(error){record.state='error';record.error=String(error);return;}
   const action=String(metadata?.activationType||response||'').toLowerCase();record.state=action||'finished';
   if(action==='activate'||action==='clicked'||action==='click')open(`http://localhost:${port}/?chat=${encodeURIComponent(input.chatId||'')}`);
  });}catch(error){record.state='error';record.error=String(error);}
  return record;
 };
 return {send,records};
}
export function registerNativeNotifications(app:Express,port:number){
 const service=createNativeNotificationService(port);
 app.post('/api/notifications/send',(req,res)=>{
  const {title,message,sound,chatId}=req.body;
  if(typeof title!=='string'||typeof message!=='string'||(chatId!==undefined&&typeof chatId!=='string')){res.status(400).json({error:'Invalid notification fields'});return;}
  const record=service.send({title,message,sound:sound!==false,chatId});
  res.status(record.state==='error'?500:202).json(record);
 });
 app.get('/api/notifications/:id',(req,res)=>{const record=service.records.get(req.params.id);if(!record){res.sendStatus(404);return;}res.json(record);});
}
