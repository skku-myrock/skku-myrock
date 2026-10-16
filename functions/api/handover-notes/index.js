import {failure,parseBody,secureOrigin,success} from '../../_lib/shared.js';
import {handoverCaller,notePath,readNote,saveNote} from '../../_lib/handoverNotes.js';

export async function onRequestGet({request,env}){
 try{
  secureOrigin(request);
  const caller=await handoverCaller(request,env);
  const url=new URL(request.url),kind=url.searchParams.get('kind'),position=url.searchParams.get('position')??'';
  if(!kind)return success({positions:caller.positions});
  const name=notePath(caller,kind,position);
  const note=await readNote(env,name);
  return success({positions:caller.positions,content:note.content,updateTime:note.updateTime});
 }catch(error){return failure(error);}
}
export async function onRequestPost({request,env}){
 try{
  secureOrigin(request);
  const caller=await handoverCaller(request,env);
  const body=await parseBody(request,70000);
  const name=notePath(caller,body?.kind,body?.position);
  const result=await saveNote(env,name,body?.content,body?.expectedUpdateTime,caller.uid);
  return success({success:true,...result});
 }catch(error){return failure(error);}
}
