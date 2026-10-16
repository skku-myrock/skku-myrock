import {failure,parseBody,reject,secureOrigin,success} from '../../_lib/shared.js';
import {commit} from '../../_lib/schedules.js';
import {callerForEquipment,equipmentDoc,equipmentId,itemWrite,mutateEquipment,validateEquipmentName,validateProduct} from '../../_lib/equipment.js';

export async function onRequestPost({request,env}){
 try{
  secureOrigin(request);
  await callerForEquipment(request,env,{manager:true});
  const body=await parseBody(request);
  const action=body?.action;
  if(action==='add'){
   const id=crypto.randomUUID(),name=validateEquipmentName(body?.name),product=validateProduct(body?.product);
   await commit(env,[itemWrite({id,name,product,queue:[],borrower:null,returnRequestedAt:'',archived:false},null)]);
   return success({success:true,id},201);
  }
  const id=equipmentId(body?.id);
  if(!['approve','confirm-return','edit','delete'].includes(action))reject('지원하지 않는 관리 요청입니다.');
  const next=await mutateEquipment(env,id,item=>{
   if(action==='approve'){
    if(item.borrower)reject('이미 대여 중이거나 반납 확인중인 장비입니다.',409);
    if(!item.queue.length)reject('승인 대기자가 없습니다.',409);
    // The borrower is always the oldest request still in the queue.
    const first=item.queue.shift();
    item.borrower={...first,borrowedAt:new Date().toISOString()};
    item.returnRequestedAt='';
   }else if(action==='confirm-return'){
    if(!item.borrower||!item.returnRequestedAt)reject('반납 확인을 기다리는 장비가 아닙니다.',409);
    item.borrower=null;item.returnRequestedAt='';
    // If earlier requests remain, the item is pending again, not idle.
   }else if(action==='edit'){
    item.name=validateEquipmentName(body?.name);
    item.product=validateProduct(body?.product);
   }else if(action==='delete'){
    if(item.borrower||item.queue.length)reject('신청 또는 대여 기록이 진행 중인 장비는 삭제할 수 없습니다.',409);
    item.archived=true;
   }
   return item;
  },{retry:action==='approve'||action==='confirm-return'?1:3});
  return success({success:true,id:next.id});
 }catch(error){return failure(error);}
}
