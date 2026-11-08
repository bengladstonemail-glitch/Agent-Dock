import React,{useEffect,useRef,useState} from 'react';
export function shouldNotifyCompletion(active:string,finished:string,hidden:boolean,focused:boolean){return hidden||!focused||active!==finished;}
let audio:AudioContext|null=null;
export function primeNotificationSound(){try{audio??=new AudioContext();void audio.resume();}catch{}}
function sound(){try{if(localStorage.getItem('agentdock_notification_sound')==='off')return;if(!audio||audio.state!=='running')return;const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.setValueAtTime(660,audio.currentTime);oscillator.frequency.setValueAtTime(880,audio.currentTime+.12);gain.gain.setValueAtTime(.08,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.35);oscillator.start();oscillator.stop(audio.currentTime+.36);}catch{}}
export async function sendDesktopAlert(title:string,message:string,chatId:string,soundEnabled:boolean){
 const response=await fetch('/api/notifications/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,message,chatId,sound:soundEnabled}),signal:AbortSignal.timeout(8000)});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Native notification helper failed');return result;
}
export function NotificationSettings(){
 const [enabled,setEnabled]=useState(()=>localStorage.getItem('agentdock_notifications')!=='off');
 const [audioOn,setAudioOn]=useState(()=>localStorage.getItem('agentdock_notification_sound')!=='off');
 const [activeOn,setActiveOn]=useState(()=>localStorage.getItem('agentdock_notify_active')!=='off');
 const [status,setStatus]=useState('');
 useEffect(()=>{const update=(e:Event)=>setStatus(String((e as CustomEvent).detail));window.addEventListener('agentdock-notification-status',update);return()=>window.removeEventListener('agentdock-notification-status',update);},[]);
 const test=async()=>{
  setStatus('Sending native Windows notification…');
  try{const result=await sendDesktopAlert('Agent Dock notification test','If you see this and hear a sound, native alerts are working.',localStorage.getItem('agentdock_active_session_id')||'',audioOn);
   setStatus('Submitted to Windows. Check the banner or Win+N; submission does not guarantee a visible banner.');
   for(let n=0;n<5;n++){await new Promise(r=>setTimeout(r,1500));const response=await fetch('/api/notifications/'+result.id);const record=await response.json();if(record.error){setStatus('Notification error: '+record.error);break;}if(record.state!=='submitted'){setStatus('Windows helper status: '+record.state);break;}}
  }catch(error){setStatus(String(error));}
 };
 return <div className="p-3 rounded border border-[#343944] text-xs space-y-2"><strong>Windows notifications</strong><p>Native desktop alerts and Windows sound are sent by the Agent Dock server, without requiring browser notification permission. Agent Dock must remain running.</p><div className="flex flex-wrap gap-3"><label><input type="checkbox" checked={enabled} onChange={e=>{setEnabled(e.target.checked);localStorage.setItem('agentdock_notifications',e.target.checked?'on':'off');}}/> Desktop alerts</label><label><input type="checkbox" checked={audioOn} onChange={e=>{setAudioOn(e.target.checked);localStorage.setItem('agentdock_notification_sound',e.target.checked?'on':'off');primeNotificationSound();}}/> Windows sound</label><label><input type="checkbox" checked={activeOn} onChange={e=>{setActiveOn(e.target.checked);localStorage.setItem('agentdock_notify_active',e.target.checked?'on':'off');}}/> Notify even while viewing chat</label><button type="button" className="text-blue-400" onClick={test}>Test Windows alert + sound</button><button type="button" onClick={()=>{primeNotificationSound();setTimeout(sound,100);}}>Test browser sound</button></div><p role="status" className="break-words">{status}</p><p>If no banner appears: press Win+N, turn off Do Not Disturb, and enable banners/sounds for SnoreToast in Windows Settings → System → Notifications. Windows may identify the helper as SnoreToast. Click an alert to open the completed chat in your default browser.</p></div>;
}
export function useCompletionNotifications(activeId:string,onOpen:(id:string)=>void){
 const [unread,setUnread]=useState<Record<string,number>>(()=>{try{return JSON.parse(localStorage.getItem('agentdock_unread')||'{}');}catch{return {};}});
 const current=useRef(activeId);current.current=activeId;const open=useRef(onOpen);open.current=onOpen;
 const markRead=(id:string)=>setUnread(previous=>{if(!previous[id])return previous;const next={...previous};delete next[id];return next;});
 useEffect(()=>{const clear=()=>{if(!document.hidden&&document.hasFocus())markRead(current.current);};clear();window.addEventListener('focus',clear);document.addEventListener('visibilitychange',clear);return()=>{window.removeEventListener('focus',clear);document.removeEventListener('visibilitychange',clear);};},[activeId]);
 useEffect(()=>{localStorage.setItem('agentdock_unread',JSON.stringify(unread));const count=Object.values(unread).reduce((a,b)=>a+b,0);document.title=(count?`(${count}) `:'')+'Agent Dock';const nav=navigator as Navigator&{setAppBadge?:(n:number)=>Promise<void>;clearAppBadge?:()=>Promise<void>};if(count)void nav.setAppBadge?.(count).catch(()=>{});else void nav.clearAppBadge?.().catch(()=>{});},[unread]);
 const complete=(id:string,title:string,error=false)=>{
  const away=shouldNotifyCompletion(current.current,id,document.hidden,document.hasFocus());
  if(away)setUnread(previous=>({...previous,[id]:(previous[id]||0)+1}));
  if(!away&&localStorage.getItem('agentdock_notify_active')==='off')return;
  if(localStorage.getItem('agentdock_notifications')==='off')return;
  void sendDesktopAlert(error?'Agent Dock — task needs attention':'Agent Dock — response ready',title,id,localStorage.getItem('agentdock_notification_sound')!=='off').catch(async error=>{
   window.dispatchEvent(new CustomEvent('agentdock-notification-status',{detail:String(error)}));
   if(typeof Notification==='undefined'||Notification.permission!=='granted')return;
   try{sound();const notification=new Notification('Agent Dock — response ready',{body:title,tag:'agentdock-'+id,silent:true});notification.onclick=()=>{window.focus();open.current(id);markRead(id);notification.close();};}catch{}
  });
 };
 return {unread,complete,markRead};
}
