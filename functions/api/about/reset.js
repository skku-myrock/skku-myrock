import {failure,parseBody,reject,secureOrigin,success,toFields} from '../../_lib/shared.js';
import {assertAccess,googleRequest} from '../../_lib/google.js';
import {ABOUT_DOC,DEFAULT_ABOUT} from '../../_lib/aboutContent.js';

export const RESET_ABOUT_CONFIRMATION='모여락 소개 초기화';
export async function onRequestPost({request,env}){
  try{
    secureOrigin(request);
    const caller=await assertAccess(request,env,'president');
    if(!caller.superadmin)reject('검증된 최고관리자만 소개를 초기화할 수 있습니다.',403);
    const input=await parseBody(request);
    if(input?.confirmation!==RESET_ABOUT_CONFIRMATION)reject('초기화 확인 문구가 올바르지 않습니다.',400);
    const url=new URL(ABOUT_DOC);
    const original=await googleRequest(env,ABOUT_DOC);
    if(original.ok){
      if(!original.data.updateTime)reject('소개 정보 버전을 확인하지 못해 초기화를 중단했습니다.',409);
      url.searchParams.set('currentDocument.updateTime',original.data.updateTime);
    }else if(original.status===404)url.searchParams.set('currentDocument.exists','false');
    else throw Error('소개 조회 실패 '+original.status);
    const saved=await googleRequest(env,url.href,{method:'PATCH',body:{fields:toFields(DEFAULT_ABOUT)}});
    if([409,412].includes(saved.status))reject('다른 운영진이 소개 내용을 변경했습니다. 확인 후 다시 초기화해 주세요.',409);
    if(!saved.ok)reject('Firestore 소개 정보 초기화에 실패했습니다.',503);
    return success({reset:true});
  }catch(error){return failure(error);}
}
