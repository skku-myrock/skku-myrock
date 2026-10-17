import {failure,parseBody,reject,secureOrigin,success,docFields,validateStudentId,validateUid} from '../../_lib/shared.js';
import {commit,queryBy} from '../../_lib/schedules.js';
import {callerForEquipment,equipmentDoc,equipmentId,itemWrite,mutateEquipment,validateEquipmentName,validateProduct,validateEquipmentImageUrl} from '../../_lib/equipment.js';
import {deleteUnusedEquipmentImages} from '../../_lib/githubImages.js';

const time=()=>new Date().toISOString();
async function resolveMember(env,value){
 const studentId=validateStudentId(value);
 const documents=await queryBy(env,'users','studentId','EQUAL',studentId,2);
 if(documents.length!==1)reject(documents.length?'동일 학번의 회원이 중복 등록되어 있습니다.':'명단에 존재하지 않는 학번입니다.',409);
 const data=docFields(documents[0]);
 const uid=validateUid(documents[0].name?.split('/').pop());
 const name=typeof data.name==='string'?data.name.trim():'';
 if(!name)reject('회원 이름을 확인할 수 없습니다.',409);
 return {uid,name,studentId};
}
export async function onRequestPost({request,env}){
 try{
  secureOrigin(request);
  await callerForEquipment(request,env,{manager:true});
  const body=await parseBody(request);
  const action=body?.action;
  if(action==='add'){
   const id=crypto.randomUUID(),name=validateEquipmentName(body?.name),product=validateProduct(body?.product);
   const imageUrl=validateEquipmentImageUrl(body?.imageUrl);
   await commit(env,[itemWrite({id,name,product,imageUrl,queue:[],borrower:null,returnRequestedAt:'',archived:false},null)]);
   return success({success:true,id},201);
  }
  const id=equipmentId(body?.id);
  const choices=['approve','confirm-return','edit','delete','force-loan','force-return','force-available','force-request-return','cancel-return','add-request','clear-queue'];
  if(!choices.includes(action))reject('지원하지 않는 관리 요청입니다.');
  // Student identity is resolved on the server, never from client-provided name/UID.
  const member=action==='force-loan'||action==='add-request'?await resolveMember(env,body?.studentId):null;
  let obsoleteImage='';
  const next=await mutateEquipment(env,id,item=>{
   if(action==='approve'){
    if(item.borrower)reject('이미 대여 중이거나 반납 확인중인 장비입니다.',409);
    if(!item.queue.length)reject('승인 대기자가 없습니다.',409);
    const first=item.queue.shift();
    item.borrower={...first,borrowedAt:time()};
    item.returnRequestedAt='';
   }else if(action==='confirm-return'){
    if(!item.borrower||!item.returnRequestedAt)reject('반납 확인을 기다리는 장비가 아닙니다.',409);
    item.borrower=null;item.returnRequestedAt='';
   }else if(action==='edit'){
    item.name=validateEquipmentName(body?.name);
    item.product=validateProduct(body?.product);
    if(Object.hasOwn(body,'imageUrl')){
     const imageUrl=validateEquipmentImageUrl(body.imageUrl);
     if(item.imageUrl!==imageUrl){obsoleteImage=item.imageUrl;item.imageUrl=imageUrl;}
    }
   }else if(action==='delete'){
    if(item.borrower||item.queue.length)reject('신청 또는 대여 기록이 진행 중인 장비는 삭제할 수 없습니다.',409);
    item.archived=true;
    obsoleteImage=item.imageUrl;
    item.imageUrl='';
   }else if(action==='force-return'){
    if(!item.borrower)reject('현재 대여 중인 부원이 없습니다.',409);
    item.borrower=null;item.returnRequestedAt='';
    // Existing FIFO waitlist stays: the resulting status will be pending.
   }else if(action==='force-available'){
    // Explicit administrative override: remove borrower, pending return and
    // every queued request in the same atomic Firestore update.
    if(!item.borrower&&!item.queue.length&&!item.returnRequestedAt)reject('이미 대여 가능한 상태입니다.',409);
    item.borrower=null;item.returnRequestedAt='';item.queue=[];
   }else if(action==='force-loan'){
    if(item.borrower)reject('현재 대여를 종료한 뒤 새 대여자를 지정해 주세요.',409);
    const existing=item.queue.find(q=>q.uid===member.uid);
    item.queue=item.queue.filter(q=>q.uid!==member.uid);
    item.borrower={...member,requestedAt:existing?.requestedAt??time(),borrowedAt:time()};
    item.returnRequestedAt='';
    // All other pending requests stay in their original order.
   }else if(action==='add-request'){
    if(item.borrower)reject('대여 중인 장비에 새 신청을 추가할 수 없습니다.',409);
    if(item.queue.some(q=>q.uid===member.uid))reject('이미 대기열에 등록된 부원입니다.',409);
    if(item.queue.length>=150)reject('대기 인원이 너무 많습니다.',409);
    item.queue.push({...member,requestedAt:time()});
   }else if(action==='clear-queue'){
    if(!item.queue.length)reject('삭제할 대기 신청이 없습니다.',409);
    item.queue=[];
   }else if(action==='force-request-return'){
    if(!item.borrower||item.returnRequestedAt)reject('반납 확인 요청으로 변경할 수 없습니다.',409);
    item.returnRequestedAt=time();
   }else if(action==='cancel-return'){
    if(!item.borrower||!item.returnRequestedAt)reject('취소할 반납 요청이 없습니다.',409);
    item.returnRequestedAt='';
   }
   return item;
  },{retry:['approve','confirm-return','force-loan','force-return','force-available','force-request-return','cancel-return','add-request','clear-queue'].includes(action)?1:3});
  let imageCleanup={pending:false};
  if(obsoleteImage){
   try{await deleteUnusedEquipmentImages(env,[obsoleteImage]);}
   catch(error){console.error('Equipment image cleanup deferred',error);imageCleanup={pending:true};}
  }
  return success({success:true,id:next.id,imageCleanup});
 }catch(error){return failure(error);}
}
