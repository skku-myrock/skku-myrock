import {failure,parseBody,reject,secureOrigin,success} from '../../../_lib/shared.js';
import {callerProfile,commit,docData,getDocument,getSchedule,invitationDoc,inviteId,requireOwner,toWrite} from '../../../_lib/schedules.js';

export async function onRequestPost({request,env,params}){
 try{
  secureOrigin(request);
  const caller=await callerProfile(request,env);
  const schedule=docData(await getSchedule(env,params.id));
  requireOwner(schedule,caller.uid);
  const {invitationId}=await parseBody(request);
  const inviteDoc=await getDocument(env,invitationDoc(inviteId(invitationId)));
  if(!inviteDoc)reject('초대 요청을 찾을 수 없습니다.',404);
  const invitation=docData(inviteDoc);
  if(invitation.scheduleId!==params.id||invitation.inviterUid!==caller.uid)
   reject('초대 요청을 취소할 권한이 없습니다.',403);
  if(invitation.status!=='pending')reject('이미 처리된 초대 요청입니다.',409);
  await commit(env,[toWrite(invitationDoc(invitationId),{
   scheduleId:invitation.scheduleId,inviterUid:invitation.inviterUid,
   recipientUid:invitation.recipientUid??'',
   ...(invitation.studentId?{studentId:invitation.studentId}:{}),
   createdAt:invitation.createdAt,updatedAt:new Date().toISOString(),status:'cancelled',
  },{updateTime:inviteDoc.updateTime})]);
  return success({success:true});
 }catch(error){return failure(error);}
}
