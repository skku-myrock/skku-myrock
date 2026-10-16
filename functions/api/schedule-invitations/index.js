import {failure,secureOrigin,success} from '../../_lib/shared.js';
import {callerProfile,docData,getDocument,queryBy,scheduleDoc} from '../../_lib/schedules.js';
import {getFirestoreDocument} from '../../_lib/google.js';

export async function onRequestGet({request,env}){
 try{
  secureOrigin(request);
  const caller=await callerProfile(request,env);
  const docs=(await queryBy(env,'scheduleInvitations','recipientUid','EQUAL',caller.uid))
   .map(docData).filter(x=>x.status==='pending');
  const invitations=(await Promise.all(docs.map(async inv=>{
   const [schedule,inviter]=await Promise.all([
    getDocument(env,scheduleDoc(inv.scheduleId)),getFirestoreDocument(env,inv.inviterUid),
   ]);
   if(!schedule||schedule.fields?.status?.stringValue!=='active')return null;
   return {id:inv.id,scheduleId:inv.scheduleId,
    title:schedule.fields?.title?.stringValue??'시간표',
    inviterName:inviter?.fields?.name?.stringValue??'탈퇴한 회원',
    createdAt:inv.createdAt};
  }))).filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return success({invitations});
 }catch(error){return failure(error);}
}
