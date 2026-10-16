import {failure,parseBody,reject,secureOrigin,success} from '../../_lib/shared.js';
import {callerForEquipment,equipmentId,mutateEquipment} from '../../_lib/equipment.js';

export async function onRequestPost({request,env}){
 try{
  secureOrigin(request);
  const caller=await callerForEquipment(request,env,{required:true});
  const body=await parseBody(request),id=equipmentId(body?.id),action=body?.action;
  if(!['apply','cancel','return'].includes(action))reject('지원하지 않는 대여 요청입니다.');
  const next=await mutateEquipment(env,id,item=>{
   const queued=item.queue.some(q=>q.uid===caller.uid);
   const borrowing=item.borrower?.uid===caller.uid;
   if(action==='apply'){
    if(queued||borrowing)reject('이미 신청했거나 대여 중인 장비입니다.',409);
    if(item.borrower)reject('대여 중인 장비는 신청을 받을 수 없습니다.',409);
    if(item.queue.length>=150)reject('대기 인원이 너무 많습니다. 운영진에게 문의해 주세요.',409);
    item.queue.push({uid:caller.uid,name:caller.name,studentId:caller.studentId,requestedAt:new Date().toISOString()});
   }else if(action==='cancel'){
    if(!queued)reject('취소할 대여 신청이 없습니다.',409);
    item.queue=item.queue.filter(q=>q.uid!==caller.uid);
   }else{
    if(!borrowing)reject('본인이 대여 중인 장비만 반납할 수 있습니다.',403);
    if(item.returnRequestedAt)reject('이미 반납 확인을 요청한 장비입니다.',409);
    item.returnRequestedAt=new Date().toISOString();
   }
   return item;
  });
  return success({success:true,status:next.borrower?(next.returnRequestedAt?'반납 확인중':'대여중'):next.queue.length?'대여 승인 대기중':'대여 가능'});
 }catch(error){return failure(error);}
}
