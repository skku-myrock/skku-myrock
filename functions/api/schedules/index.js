import {failure,parseBody,secureOrigin,success,reject} from '../../_lib/shared.js';
import {callerProfile,commit,docData,emptyBits,queryBy,scheduleDoc,participantDoc,toWrite,validateScheduleInput} from '../../_lib/schedules.js';
import {assertAccess,getFirestoreDocument} from '../../_lib/google.js';
import {docFields,validateUid} from '../../_lib/shared.js';

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
  const body=await parseBody(request);
  const input=validateScheduleInput(body);
  const team=Object.hasOwn(body,'teamMemberUids');
  let participants=[caller.uid];
  if(team){
   await assertAccess(request,env,'part_leader');
   if(!Array.isArray(body.teamMemberUids)||body.teamMemberUids.length<1||body.teamMemberUids.length>29)
    reject('구성팀에 본인 외 1~29명을 추가해 주세요.');
   const uids=body.teamMemberUids.map(validateUid);
   if(new Set(uids).size!==uids.length||uids.includes(caller.uid))reject('구성팀 명단에 중복된 부원이 있습니다.');
   const profiles=await Promise.all(uids.map(uid=>getFirestoreDocument(env,uid)));
   if(profiles.some((profile,index)=>!profile||!/^[0-9]{10}$/.test(String(docFields(profile).studentId??''))))
    reject('명단에 존재하지 않는 부원이 있습니다. 다시 검색해 주세요.',409);
   participants=[caller.uid,...uids];
  }
  const id=crypto.randomUUID(),createdAt=new Date().toISOString();
  const schedule={...input,startHour:String(input.startHour),endHour:String(input.endHour),
   slotMinutes:'30',createdBy:caller.uid,participantUids:participants,status:'active',createdAt,...(team?{team:true}:{})};
  await commit(env,[
   toWrite(scheduleDoc(id),schedule,{exists:false}),
   ...participants.map(uid=>({update:{name:participantDoc(id,uid),fields:{
    availability:{bytesValue:emptyBits(input)},
    hasResponded:{booleanValue:false},updatedAt:{timestampValue:createdAt},
   }},currentDocument:{exists:false}})),
  ]);
  return success({id},201);
 }catch(error){return failure(error);}
}
