import {failure,secureOrigin,success} from '../../../_lib/shared.js';
import {callerProfile,docData,getSchedule,getDocument,isParticipant,participantDoc,requireMember} from '../../../_lib/schedules.js';
import {getFirestoreDocument} from '../../../_lib/google.js';

export async function onRequestGet({request,env,params}){
 try{
  secureOrigin(request);
  const caller=await callerProfile(request,env);
  const schedule=docData(await getSchedule(env,params.id));
  requireMember(schedule,caller.uid);
  const participantUids=schedule.participantUids??[];
  const people=await Promise.all(participantUids.map(async uid=>{
   const [availability,profile]=await Promise.all([
    getDocument(env,participantDoc(params.id,uid)),getFirestoreDocument(env,uid)
   ]);
   return {uid,name:String(profile?.fields?.name?.stringValue??'탈퇴한 회원'),
    availability:availability?.fields?.availability?.bytesValue??null,
    hasResponded:availability?.fields?.hasResponded?.booleanValue===true,
    updateTime:uid===caller.uid?(availability?.updateTime??''):undefined};
  }));
  return success({schedule:{
   id:schedule.id,title:schedule.title,dates:schedule.dates,startHour:Number(schedule.startHour),
   endHour:Number(schedule.endHour),createdBy:schedule.createdBy,status:schedule.status,
  },people,viewerUid:caller.uid});
 }catch(error){return failure(error);}
}
