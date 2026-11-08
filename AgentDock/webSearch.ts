import {search,SafeSearchType} from 'duck-duck-scrape';
export type WebResult={title:string;url:string;snippet:string;domain:string};
export function normalizeResults(items:any[]):WebResult[]{
 const seen=new Set<string>();
 const text=(value:unknown)=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
 return items.flatMap(item=>{try{const url=new URL(item.url);if(!['https:','http:'].includes(url.protocol)||seen.has(url.href))return [];seen.add(url.href);const title=text(item.title);if(!title)return [];return [{title,url:url.href,snippet:text(item.description||item.snippet).slice(0,1800),domain:url.hostname.replace(/^www\./,'')}];}catch{return [];}}).slice(0,8);
}
export function createSearchService(provider=search,now=Date.now){
 const cache=new Map<string,{at:number;results:WebResult[]}>();const pending=new Map<string,Promise<WebResult[]>>();
 return async(query:string):Promise<WebResult[]>=>{
  if(typeof query!=='string'||!query.trim()||query.length>1000)throw Error('Enter a search query between 1 and 1,000 characters.');
  const clean=query.trim(),key=clean.toLowerCase();const existing=cache.get(key);
  if(existing&&now()-existing.at<300000)return existing.results;
  if(pending.has(key))return pending.get(key)!;
  if(pending.size>=2)throw Error('Search is busy. Wait for the current searches to finish and try again.');
  const request=(async()=>{
   const raw=await provider(clean,{safeSearch:SafeSearchType.MODERATE,locale:'en-us'},{open_timeout:8000,response_timeout:12000,read_timeout:12000});
   const results=normalizeResults(raw.results||[]);
   if(cache.size>=200)cache.delete(cache.keys().next().value!);
   cache.set(key,{at:now(),results});return results;
  })();pending.set(key,request);
  try{return await request;}finally{pending.delete(key);}
 };
}
export const performFreeWebSearch=createSearchService();
