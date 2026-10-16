import {failure,secureOrigin,success} from '../../../_lib/shared.js';
import {getFirestoreDocument} from '../../../_lib/google.js';
import {callerProfile,docData,getSchedule,queryBy,requireOwner} from '../../../_lib/schedules.js';

// Only the schedule creator may list pending requests. Never expose recipient UID,
// account presence or a real name before explicit acceptance.
export async function onRequestGet({request,env,params}){
 try{
  secureOrigin(request);
  const caller=await callerProfile(request,env);
  const schedule=docData(await getSchedule(env,params.id));
  requireOwner(schedule,caller.uid);
  const docs=await queryBy(env,'scheduleInvitations','scheduleId','EQUAL',params.id,300);
  const pending=docs.map(docData).filter(doc=>doc.status==='pending');
  const result=await Promise.all(pending.map(async invitation=>{
   let studentId=invitation.studentId;
   // Migration path for invites created before studentId was stored (no names leaked).
   if(!studentId&&invitation.recipientUid){
    const profile=await getFirestoreDocument(env,invitation.recipientUid);
    studentId=profile?.fields?.studentId?.stringValue??'학번 미기록';
   }
   return {id:invitation.id,studentId:studentId??'학번 미기록',createdAt:invitation.createdAt};
  }));
  result.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  return success({invitations:result});
 }catch(error){return failure(error);}
}
