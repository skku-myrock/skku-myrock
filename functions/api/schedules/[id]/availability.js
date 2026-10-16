import {failure,parseBody,reject,secureOrigin,success} from '../../../_lib/shared.js';
import {callerProfile,getSchedule,getDocument,docData,participantDoc,requireMember,validBits} from '../../../_lib/schedules.js';
import {googleRequest} from '../../../_lib/google.js';

export async function onRequestPost({request,env,params}){
 try{
  secureOrigin(request);
  const caller=await callerProfile(request,env);
  const schedule=docData(await getSchedule(env,params.id));
  requireMember(schedule,caller.uid);
  const body=await parseBody(request,12000);
  if(!validBits(body?.availability,schedule))reject('체크 행렬 형식이 올바르지 않습니다.');
  const current=await getDocument(env,participantDoc(params.id,caller.uid));
  if(!current||typeof body.expectedUpdateTime!=='string'||body.expectedUpdateTime!==current.updateTime)
   reject('다른 기기에서 저장되었습니다. 새로고침 후 다시 시도해 주세요.',409);
  const updatedAt=new Date().toISOString();
  const url=new URL(participantDoc(params.id,caller.uid));
  url.searchParams.append('updateMask.fieldPaths','availability');
  url.searchParams.append('updateMask.fieldPaths','hasResponded');
  url.searchParams.append('updateMask.fieldPaths','updatedAt');
  url.searchParams.set('currentDocument.updateTime',current.updateTime);
  const result=await googleRequest(env,url.toString(),{method:'PATCH',body:{fields:{
   availability:{bytesValue:body.availability},hasResponded:{booleanValue:true},
   updatedAt:{timestampValue:updatedAt},
  }}});
  if(result.status===409||result.status===412)reject('다른 기기에서 저장되었습니다. 새로고침 후 다시 시도해 주세요.',409);
  if(!result.ok)throw new Error('Firestore availability update '+result.status);
  return success({updateTime:result.data.updateTime,availability:body.availability,hasResponded:true});
 }catch(error){return failure(error);}
}
