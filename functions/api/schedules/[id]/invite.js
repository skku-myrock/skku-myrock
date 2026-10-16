import {failure,parseBody,reject,secureOrigin,success} from '../../../_lib/shared.js';
import {lookupAccount,getFirestoreDocument} from '../../../_lib/google.js';
import {callerProfile,commit,docData,getSchedule,getDocument,invitationDoc,requireOwner,requireStudentId,THROTTLES,toWrite} from '../../../_lib/schedules.js';

const GENERIC='초대 요청을 접수했습니다.';
async function requestId(scheduleId,studentId){
 // Identical, stable document identities for registered and unregistered student IDs.
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(scheduleId+':'+studentId));
 const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 return scheduleId+'_'+hash;
}
export async function onRequestPost({request,env,params}){
 try{
  secureOrigin(request);
  const caller=await callerProfile(request,env);
  const schedule=docData(await getSchedule(env,params.id));
  requireOwner(schedule,caller.uid);
  if(schedule.status!=='active')reject('종료된 시간표에는 초대할 수 없습니다.',409);
  const studentId=requireStudentId(await parseBody(request));
  // Count EVERY attempt, including invalid recipients. Unknown accounts cannot evade the limit.
  const throttleUrl=THROTTLES+'/'+encodeURIComponent(caller.uid);
  const throttle=await getDocument(env,throttleUrl);
  const now=Date.now(),old=throttle?.fields??{},start=Number(old.windowStart?.integerValue??0);
  const sameWindow=now-start<3600000&&now>=start;
  const count=sameWindow?Number(old.count?.integerValue??0):0;
  if(count>=20)reject('초대 요청은 한 시간에 최대 20번까지 가능합니다.',429);
  await commit(env,[{update:{name:throttleUrl,fields:{
    windowStart:{integerValue:String(sameWindow?start:now)},
    count:{integerValue:String(count+1)},
  }},currentDocument:throttle?{updateTime:throttle.updateTime}:{exists:false}}]);

  const id=await requestId(params.id,studentId);
  const url=invitationDoc(id);
  const existing=await getDocument(env,url);
  if(existing&&['pending','accepted'].includes(existing.fields?.status?.stringValue))return success({message:GENERIC});

  const account=await lookupAccount(env,studentId+'@members.skku-myrock.firebaseapp.com');
  const candidateUid=account?.localId??null;
  // Account existence, role, and already-a-member status must never affect the creator's visible result.
  const registered=candidateUid?await getFirestoreDocument(env,candidateUid):null;
  const eligible=Boolean(registered&&candidateUid!==caller.uid&&!schedule.participantUids?.includes(candidateUid));
  const recipientUid=eligible?candidateUid:'';

  // Historical invites were keyed by UID rather than the student ID digest.
  // Do not create a second deliverable invitation if an older active invite already exists.
  if(eligible){
   const legacy=await getDocument(env,invitationDoc(params.id+'_'+candidateUid));
   if(legacy?.fields?.status?.stringValue==='pending')return success({message:GENERIC});
  }
  const createdAt=new Date().toISOString();
  try{
   await commit(env,[toWrite(url,{
    scheduleId:params.id,studentId,recipientUid,inviterUid:caller.uid,
    status:'pending',createdAt,updatedAt:createdAt,
   },existing?{updateTime:existing.updateTime}:{exists:false})]);
  }catch(error){
   if(error.status!==409)throw error;
  }
  return success({message:GENERIC});
 }catch(error){return failure(error);}
}
