import {failure,parseBody,reject,secureOrigin,success} from '../../_lib/shared.js';
import {assertAccess,googleRequest} from '../../_lib/google.js';
import {SCHEDULES,INVITATIONS,THROTTLES,commit} from '../../_lib/schedules.js';

export const RESET_SCHEDULES_CONFIRMATION='활동 초기화';
const API_BASE='https://firestore.googleapis.com/v1/';
const BATCH_SIZE=20;
async function page(env,collection,size=BATCH_SIZE+1){
 const target=new URL(collection);target.searchParams.set('pageSize',String(size));
 const result=await googleRequest(env,target.href);
 if(result.status===404)return [];
 if(!result.ok)throw Error('합주 시간표 초기화 조회 실패 '+result.status);
 return result.data.documents??[];
}
function validateDocuments(documents,collection){
 const prefix=collection.slice(API_BASE.length)+'/';
 return documents.map(doc=>{
  if(typeof doc.name!=='string'||!doc.name.startsWith(prefix)||doc.name.slice(prefix.length).includes('/')||!doc.updateTime)
   reject('시간표 초기화 문서 검증에 실패했습니다.',503);
  return {delete:doc.name,currentDocument:{updateTime:doc.updateTime}};
 });
}
async function removePage(env,collection){
 const docs=await page(env,collection);
 const writes=validateDocuments(docs.slice(0,BATCH_SIZE),collection);
 if(writes.length)await commit(env,writes);
 return {deleted:writes.length,done:docs.length<=BATCH_SIZE&&!writes.length};
}
export async function onRequestPost({request,env}){
 try{
  secureOrigin(request);
  const caller=await assertAccess(request,env,'president');
  if(!caller.superadmin)reject('검증된 최고관리자만 초기화할 수 있습니다.',403);
  const input=await parseBody(request);
  if(input?.confirmation!==RESET_SCHEDULES_CONFIRMATION)reject('초기화 확인 문구가 올바르지 않습니다.',400);
  const schedules=await page(env,SCHEDULES,1);
  if(schedules.length){
   const schedule=schedules[0];
   validateDocuments([schedule],SCHEDULES);
   const participants=await removePage(env,API_BASE+schedule.name+'/participants');
   if(participants.deleted)return success({deleted:participants.deleted,done:false,stage:'participants'});
   await commit(env,validateDocuments([schedule],SCHEDULES));
   return success({deleted:1,done:false,stage:'schedules'});
  }
  for(const [collection,stage] of [[INVITATIONS,'invitations'],[THROTTLES,'throttles']]){
   const result=await removePage(env,collection);
   if(!result.done)return success({deleted:result.deleted,done:false,stage});
  }
  return success({deleted:0,done:true,stage:'complete'});
 }catch(error){return failure(error);}
}
