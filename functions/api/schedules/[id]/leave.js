import {failure,reject,secureOrigin,success} from '../../../_lib/shared.js';
import {callerProfile,commit,docData,firestoreResourceName,getDocument,getSchedule,invitationDoc,participantDoc,queryBy,requireMember,scheduleDoc,toWrite} from '../../../_lib/schedules.js';

export async function onRequestPost({request,env,params}){
 try{
  secureOrigin(request);
  const caller=await callerProfile(request,env);
  const current=await getSchedule(env,params.id),schedule=docData(current);
  requireMember(schedule,caller.uid);
  if(schedule.status!=='active')reject('종료된 시간표입니다.',409);
  const isOwner=schedule.createdBy===caller.uid;
  if(isOwner&&schedule.participantUids.length!==1)reject('다른 참여자가 있는 시간표는 방장이 나갈 수 없습니다. 먼저 다른 참여자를 명단에서 제외해 주세요.',409);
  const participant=await getDocument(env,participantDoc(params.id,caller.uid));
  if(!participant)reject('참여 기록을 찾을 수 없습니다.',409);
  const writes=[];
  if(isOwner){
   const invitations=await queryBy(env,'scheduleInvitations','scheduleId','EQUAL',params.id,300);
   if(invitations.length>=300)reject('초대 기록이 많아 자동 삭제할 수 없습니다. 관리자에게 문의해 주세요.',409);
   for(const doc of invitations)writes.push({delete:firestoreResourceName(doc.name),currentDocument:{updateTime:doc.updateTime}});
   writes.push({delete:firestoreResourceName(participantDoc(params.id,caller.uid)),currentDocument:{updateTime:participant.updateTime}});
   writes.push({delete:firestoreResourceName(scheduleDoc(params.id)),currentDocument:{updateTime:current.updateTime}});
  }else{
   const invitations=await queryBy(env,'scheduleInvitations','scheduleId','EQUAL',params.id,300);
   if(invitations.length>=300)reject('초대 기록이 많아 명단에서 나갈 수 없습니다. 관리자에게 문의해 주세요.',409);
   writes.push(toWrite(scheduleDoc(params.id),{
    title:schedule.title,dates:schedule.dates,startHour:schedule.startHour,endHour:schedule.endHour,
    slotMinutes:schedule.slotMinutes,createdBy:schedule.createdBy,
    participantUids:schedule.participantUids.filter(uid=>uid!==caller.uid),
    status:schedule.status,createdAt:schedule.createdAt,
   },{updateTime:current.updateTime}));
   writes.push({delete:firestoreResourceName(participantDoc(params.id,caller.uid)),currentDocument:{updateTime:participant.updateTime}});
   for(const doc of invitations){
    const item=docData(doc);
    if(item.recipientUid!==caller.uid||!['pending','accepted'].includes(item.status))continue;
    writes.push(toWrite(invitationDoc(item.id),{
     scheduleId:params.id,recipientUid:caller.uid,inviterUid:item.inviterUid,
     ...(item.studentId?{studentId:item.studentId}:{}),
     createdAt:item.createdAt,updatedAt:new Date().toISOString(),status:'removed',
    },{updateTime:doc.updateTime}));
   }
  }
  await commit(env,writes);
  return success({success:true,deleted:isOwner});
 }catch(error){return failure(error);}
}
