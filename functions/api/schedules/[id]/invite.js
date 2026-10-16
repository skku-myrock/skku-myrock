import {failure,parseBody,reject,secureOrigin,success} from '../../../_lib/shared.js';
import {lookupAccount} from '../../../_lib/google.js';
import {callerProfile,commit,docData,getSchedule,getDocument,invitationDoc,requireOwner,requireStudentId,THROTTLES,toWrite} from '../../../_lib/schedules.js';

const GENERIC='초대 요청을 접수했습니다.';
export async function onRequestPost({request,env,params}){
 try{
  secureOrigin(request);
  const caller=await callerProfile(request,env);
  const schedule=docData(await getSchedule(env,params.id));
  requireOwner(schedule,caller.uid);
  if(schedule.status!=='active')reject('종료된 시간표에는 초대할 수 없습니다.',409);
  const studentId=requireStudentId(await parseBody(request));
  // Count every attempt, including unknown IDs, so enumeration never bypasses throttling.
  const throttleId=params.id+'_'+caller.uid;
  const throttleUrl=THROTTLES+'/'+encodeURIComponent(throttleId);
  const throttle=await getDocument(env,throttleUrl);
  const now=Date.now(),old=throttle?.fields??{},start=Number(old.windowStart?.integerValue??0);
  const sameWindow=now-start<3600000&&now>=start;
  const count=sameWindow?Number(old.count?.integerValue??0):0;
  if(count>=20)reject('초대 요청은 시간표당 한 시간에 최대 20번까지 가능합니다.',429);
  await commit(env,[{update:{name:throttleUrl,fields:{
    windowStart:{integerValue:String(sameWindow?start:now)},
    count:{integerValue:String(count+1)},
  }},currentDocument:throttle?{updateTime:throttle.updateTime}:{exists:false}}]);
  const account=await lookupAccount(env,studentId+'@members.skku-myrock.firebaseapp.com');
  if(!account?.localId||account.localId===caller.uid)return success({message:GENERIC});
  const uid=account.localId;
  if(schedule.participantUids?.includes(uid))return success({message:GENERIC});
  const id=params.id+'_'+uid,url=invitationDoc(id);
  const existing=await getDocument(env,url);
  if(existing&&existing.fields?.status?.stringValue!=='declined')return success({message:GENERIC});
  const createdAt=new Date().toISOString();
  try{
   await commit(env,[toWrite(url,{
    scheduleId:params.id,recipientUid:uid,inviterUid:caller.uid,status:'pending',
    createdAt,updatedAt:createdAt,
   },existing?{updateTime:existing.updateTime}:{exists:false})]);
  }catch(error){
   // A concurrent duplicate invite is indistinguishable from an already pending one.
   if(error.status!==409)throw error;
  }
  return success({message:GENERIC});
 }catch(error){return failure(error);}
}
