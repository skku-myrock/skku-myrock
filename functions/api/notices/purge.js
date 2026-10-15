import {failure,parseBody,reject,secureOrigin,success,FIRESTORE_ROOT} from '../../_lib/shared.js';
import {assertAccess,googleRequest} from '../../_lib/google.js';

export const RESET_NOTICES_CONFIRMATION='공지사항 초기화';
const COLLECTION=FIRESTORE_ROOT+'/notices';
const BATCH_SIZE=20;

export async function onRequestPost({request,env}){
  try{
    secureOrigin(request);
    const caller=await assertAccess(request,env,'president');
    if(!caller.superadmin)reject('검증된 최고관리자만 공지사항을 초기화할 수 있습니다.',403);
    const input=await parseBody(request);
    if(input?.confirmation!==RESET_NOTICES_CONFIRMATION)reject('초기화 확인 문구가 올바르지 않습니다.',400);
    const url=new URL(COLLECTION);url.searchParams.set('pageSize',String(BATCH_SIZE+1));
    const listed=await googleRequest(env,url.toString());
    if(!listed.ok)throw Error('공지사항 초기화 조회 실패 '+listed.status);
    const docs=listed.data.documents??[];
    let deleted=0;
    for(const doc of docs.slice(0,BATCH_SIZE)){
      if(typeof doc.name!=='string'||!doc.name.startsWith('projects/')||!/^[-a-f0-9]{36}$/.test(doc.name.split('/').at(-1))||!doc.updateTime)reject('공지사항 문서 검증에 실패했습니다.',503);
      const target=new URL('https://firestore.googleapis.com/v1/'+doc.name);
      target.searchParams.set('currentDocument.updateTime',doc.updateTime);
      const result=await googleRequest(env,target.href,{method:'DELETE'});
      if(!result.ok)reject('공지사항 일부를 삭제하지 못했습니다. 진행 상태를 확인하고 다시 실행해 주세요.',503);
      deleted++;
    }
    return success({deleted,done:docs.length<=BATCH_SIZE});
  }catch(error){return failure(error);}
}
