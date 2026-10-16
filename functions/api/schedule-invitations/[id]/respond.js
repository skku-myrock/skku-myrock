import {failure,parseBody,reject,secureOrigin,success} from '../../../_lib/shared.js';
import {callerProfile,commit,docData,emptyBits,getDocument,getSchedule,invitationDoc,participantDoc,scheduleDoc,toWrite} from '../../../_lib/schedules.js';

export async function onRequestPost({request,env,params}){
 try{
  secureOrigin(request);
  const caller=await callerProfile(request,env);
  const body=await parseBody(request);
  if(body?.action!=='accept'&&body?.action!=='decline')reject('수락 또는 거절을 선택해 주세요.');
  const url=invitationDoc(params.id);
  const current=await getDocument(env,url);
  if(!current)reject('초대를 찾을 수 없습니다.',404);
  const invitation=docData(current);
  if(invitation.recipientUid!==caller.uid)reject('본인의 초대만 처리할 수 있습니다.',403);
  if(invitation.status!=='pending')reject('이미 처리한 초대입니다.',409);
  const scheduleDocValue=await getSchedule(env,invitation.scheduleId);
  const schedule=docData(scheduleDocValue);
  if(schedule.status!=='active')reject('종료된 시간표입니다.',409);
  const now=new Date().toISOString();
  const writes=[toWrite(url,{
    scheduleId:invitation.scheduleId,recipientUid:invitation.recipientUid,
    inviterUid:invitation.inviterUid,createdAt:invitation.createdAt,
    status:body.action==='accept'?'accepted':'declined',updatedAt:now,
  },{updateTime:current.updateTime})];
  if(body.action==='accept'){
   if(schedule.participantUids.includes(caller.uid))reject('이미 참여 중인 시간표입니다.',409);
   if(schedule.participantUids.length>=40)reject('시간표 참여 인원이 가득 찼습니다.',409);
   writes.push(toWrite(scheduleDoc(invitation.scheduleId),{
    ...Object.fromEntries(Object.entries(schedule).filter(([key])=>!['id','updateTime'].includes(key))),
    participantUids:[...schedule.participantUids,caller.uid],
   },{updateTime:scheduleDocValue.updateTime}));
   writes.push({update:{name:participantDoc(invitation.scheduleId,caller.uid),fields:{
    availability:{bytesValue:emptyBits(schedule)},hasResponded:{booleanValue:false},
    updatedAt:{timestampValue:now},
   }},currentDocument:{exists:false}});
  }
  await commit(env,writes);
  return success({success:true,scheduleId:invitation.scheduleId});
 }catch(error){return failure(error);}
}
