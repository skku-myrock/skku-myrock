import {failure,parseBody,reject,secureOrigin,success,FIRESTORE_ROOT} from '../../_lib/shared.js';
import {assertAccess,googleRequest} from '../../_lib/google.js';
import {commit} from '../../_lib/schedules.js';

const COLLECTION=FIRESTORE_ROOT+'/handoverNotes';
const CONFIRMATION='완전 초기화';
const BATCH_SIZE=20;

/** Remove both current per-author notes and legacy role/common notes.
 * Called only within the composed superadmin full reset.
 */
export async function onRequestPost({request,env}){
 try{
  secureOrigin(request);
  const caller=await assertAccess(request,env,'president');
  if(!caller.superadmin)reject('검증된 최고관리자만 인수인계를 초기화할 수 있습니다.',403);
  const input=await parseBody(request);
  if(input?.confirmation!==CONFIRMATION)reject('완전 초기화 확인값이 올바르지 않습니다.',400);
  const url=new URL(COLLECTION);
  url.searchParams.set('pageSize',String(BATCH_SIZE+1));
  const found=await googleRequest(env,url.toString());
  if(!found.ok&&found.status!==404)throw Error('인수인계 초기화 조회 실패 '+found.status);
  const docs=found.ok?(found.data.documents??[]):[];
  const pathPrefix=COLLECTION.replace('https://firestore.googleapis.com/v1/','')+'/';
  const writes=docs.slice(0,BATCH_SIZE).map(doc=>{
   if(typeof doc.name!=='string'||!doc.name.startsWith(pathPrefix)
      ||doc.name.slice(pathPrefix.length).includes('/')||!doc.updateTime)
    reject('인수인계 문서 식별 정보가 올바르지 않습니다.',503);
   return {delete:doc.name,currentDocument:{updateTime:doc.updateTime}};
  });
  if(writes.length)await commit(env,writes);
  return success({deleted:writes.length,done:docs.length<=BATCH_SIZE});
 }catch(error){return failure(error);}
}
