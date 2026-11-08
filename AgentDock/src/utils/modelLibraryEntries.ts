export type ModelEntry={name:string;description:string;summary?:string;cloud?:boolean};
export function modelLibraryEntries(library:ModelEntry[],installed:ModelEntry[],filter:string,query:string){
 const merged=new Map<string,ModelEntry>();for(const model of installed)merged.set(model.name,model);for(const model of library)if(!merged.has(model.name))merged.set(model.name,model);
 const entries=filter==='installed'?installed:[...merged.values()];
 return entries.filter(model=>(model.name+' '+model.description).toLowerCase().includes(query.toLowerCase())).filter(model=>filter==='cloud'?!!model.cloud:filter==='local'?!model.cloud:true);
}
