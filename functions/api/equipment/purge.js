import {failure,parseBody,reject,secureOrigin,success} from '../../_lib/shared.js';
import {assertAccess,googleRequest} from '../../_lib/google.js';
import {EQUIPMENT_ROOT} from '../../_lib/equipment.js';
import {commit,firestoreResourceName} from '../../_lib/schedules.js';


export const PURGE_EQUIPMENT_CONFIRMATION='나머지 초기화';
const BATCH_SIZE=20;

export async function onRequestPost({request,env}){
 try{
  secureOrigin(request);
  const caller=await assertAccess(request,env,'president');
  if(!caller.superadmin)reject('검증된 최고관리자만 장비 목록을 초기화할 수 있습니다.',403);
  const input=await parseBody(request);
  if(input?.confirmation!==PURGE_EQUIPMENT_CONFIRMATION)reject('장비 목록 초기화 확인값이 올바르지 않습니다.',400);
  const url=new URL(EQUIPMENT_ROOT);
  url.searchParams.set('pageSize',String(BATCH_SIZE));
  const response=await googleRequest(env,url.href);
  if(!response.ok&&response.status!==404)throw Error('장비 목록 초기화 조회 실패 '+response.status);
  const docs=response.ok?(response.data.documents??[]):[];
  if(docs.length){
   const writes=docs.map(doc=>{
    if(typeof doc.name!=='string'||!doc.name.startsWith(EQUIPMENT_ROOT.replace('https://firestore.googleapis.com/v1/','')+'/')
       ||!doc.updateTime)reject('삭제할 장비 문서의 식별 정보를 확인할 수 없습니다.',503);
    return {delete:firestoreResourceName(doc.name),currentDocument:{updateTime:doc.updateTime}};
   });
   await commit(env,writes);
   return success({deleted:writes.length,done:false});
  }
  // The composed other/full reset clears site/ after equipment documents
  // and other site references have been retired; never clear site/ here.
  return success({deleted:0,done:true});
 }catch(error){return failure(error);}
}
