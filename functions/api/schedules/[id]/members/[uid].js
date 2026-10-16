import {failure,parseBody,reject,secureOrigin,success} from '../../../../_lib/shared.js';
import {callerProfile,commit,docData,getDocument,getSchedule,participantDoc,requireOwner,scheduleDoc,toWrite,invitationDoc} from '../../../../_lib/schedules.js';
export async function onRequestPost({request,env,params}){
 try{
  secureOrigin(request);
  const caller=await callerProfile(request,env);
  const scheduleDocument=await getSchedule(env,params.id),schedule=docData(scheduleDocument);
  requireOwner(schedule,caller.uid);
  if((await parseBody(request))?.action!=='remove')reject('명단 변경 요청이 올바르지 않습니다.');
  if(params.uid===caller.uid)reject('시간표 생성자는 제외할 수 없습니다.',403);
  if(!schedule.participantUids.includes(params.uid))reject('참여자가 아닙니다.',404);
  const participation=await getDocument(env,participantDoc(params.id,params.uid));
  if(!participation)reject('참여 정보를 찾을 수 없습니다.',404);
  const relatedInvitation=await getDocument(env,invitationDoc(params.id+'_'+params.uid));
  const writes=[
   toWrite(scheduleDoc(params.id),{
    title:schedule.title,dates:schedule.dates,startHour:schedule.startHour,
    endHour:schedule.endHour,slotMinutes:schedule.slotMinutes,
    createdBy:schedule.createdBy,participantUids:schedule.participantUids.filter(uid=>uid!==params.uid),
    status:schedule.status,createdAt:schedule.createdAt,
   },{updateTime:scheduleDocument.updateTime}),
   {delete:participantDoc(params.id,params.uid),currentDocument:{updateTime:participation.updateTime}},
  ];
  if(relatedInvitation)writes.push(toWrite(invitationDoc(params.id+'_'+params.uid),{
    scheduleId:params.id,recipientUid:params.uid,inviterUid:relatedInvitation.fields?.inviterUid?.stringValue??caller.uid,
    createdAt:relatedInvitation.fields?.createdAt?.stringValue??new Date().toISOString(),
    updatedAt:new Date().toISOString(),status:'removed',
  },{updateTime:relatedInvitation.updateTime}));
  await commit(env,writes);
  return success({success:true});
 }catch(error){return failure(error);}
}
