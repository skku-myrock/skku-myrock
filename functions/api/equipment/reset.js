import {failure,parseBody,reject,secureOrigin,success,docFields} from '../../_lib/shared.js';
import {assertAccess,googleRequest} from '../../_lib/google.js';
import {EQUIPMENT_ROOT,itemWrite,equipmentId,resolvedItem} from '../../_lib/equipment.js';
import {commit} from '../../_lib/schedules.js';

export const RESET_EQUIPMENT_CONFIRMATION='활동 초기화';
const BATCH_SIZE=20;
export async function onRequestPost({request,env}){
 try{
  secureOrigin(request);
  const caller=await assertAccess(request,env,'president');
  if(!caller.superadmin)reject('검증된 최고관리자만 초기화할 수 있습니다.',403);
  const input=await parseBody(request);
  if(input?.confirmation!==RESET_EQUIPMENT_CONFIRMATION)reject('초기화 확인 문구가 올바르지 않습니다.',400);
  const writes=[];
  let token='';
  for(let page=0;page<100;page++){
   const url=new URL(EQUIPMENT_ROOT);url.searchParams.set('pageSize','100');
   if(token)url.searchParams.set('pageToken',token);
   const response=await googleRequest(env,url.href);
   if(response.status===404)break;
   if(!response.ok)throw Error('장비 대여 초기화 조회 실패 '+response.status);
   for(const doc of response.data.documents??[]){
    const prefix=EQUIPMENT_ROOT.replace('https://firestore.googleapis.com/v1/','')+'/';
    if(typeof doc.name!=='string'||!doc.name.startsWith(prefix)||!doc.updateTime)reject('장비 문서 검증에 실패했습니다.',503);
    const id=equipmentId(doc.name.split('/').pop());
    const item=resolvedItem({...docFields(doc),id});
    if(item.archived||(!item.borrower&&!item.queue.length&&!item.returnRequestedAt))continue;
    writes.push(itemWrite({...item,borrower:null,queue:[],returnRequestedAt:''},doc));
    if(writes.length===BATCH_SIZE)break;
   }
   if(writes.length===BATCH_SIZE)break;
   token=response.data.nextPageToken??'';
   if(!token)break;
   if(page===99)reject('장비 목록이 너무 많아 초기화를 중단했습니다.',503);
  }
  if(writes.length)await commit(env,writes);
  return success({updated:writes.length,done:writes.length===0});
 }catch(error){return failure(error);}
}
