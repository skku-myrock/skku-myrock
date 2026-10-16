import {failure,parseBody,secureOrigin,success,reject} from '../../_lib/shared.js';
import {callerProfile,commit,docData,emptyBits,queryBy,scheduleDoc,participantDoc,toWrite,validateScheduleInput} from '../../_lib/schedules.js';

export async function onRequestGet({request,env}){
 try{
  secureOrigin(request);
  const caller=await callerProfile(request,env);
  const docs=await queryBy(env,'schedules','participantUids','ARRAY_CONTAINS',caller.uid);
  return success({schedules:docs.map(docData).map(s=>({
   id:s.id,title:s.title,dates:s.dates,startHour:Number(s.startHour),
   endHour:Number(s.endHour),createdBy:s.createdBy,status:s.status,createdAt:s.createdAt,
   participantCount:s.participantUids?.length??0,
  })).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
 }catch(error){return failure(error);}
}
export async function onRequestPost({request,env}){
 try{
  secureOrigin(request);
  const caller=await callerProfile(request,env);
  const input=validateScheduleInput(await parseBody(request));
  const id=crypto.randomUUID(),createdAt=new Date().toISOString();
  const schedule={...input,startHour:String(input.startHour),endHour:String(input.endHour),
   slotMinutes:'30',createdBy:caller.uid,participantUids:[caller.uid],status:'active',createdAt};
  await commit(env,[
   toWrite(scheduleDoc(id),schedule,{exists:false}),
   {update:{name:participantDoc(id,caller.uid),fields:{
      availability:{bytesValue:emptyBits(input)},
      hasResponded:{booleanValue:false},
      updatedAt:{timestampValue:createdAt},
    }},currentDocument:{exists:false}},
  ]);
  return success({id},201);
 }catch(error){return failure(error);}
}
