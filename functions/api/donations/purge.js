import { failure,parseBody,reject,secureOrigin,success } from '../../_lib/shared.js';
import { assertAccess,googleRequest } from '../../_lib/google.js';
import { ANONYMOUS_DOC,LEDGER } from '../../_lib/donationStore.js';
import { EXPENSES } from '../../_lib/financeTransactions.js';

export const DONATIONS_RESET_CONFIRMATION='후원 · 회계 초기화';
async function deletePage(env,collection){
  const url=new URL(collection);url.searchParams.set('pageSize','21');
  const list=await googleRequest(env,url.toString());
  if(!list.ok)throw Error('회계 데이터 조회 실패: '+list.status);
  const docs=list.data.documents??[];
  let deleted=0;
  for(const doc of docs.slice(0,20)){
    const target=new URL(doc.name.replace(/^projects\//,'https://firestore.googleapis.com/v1/projects/'));
    if(doc.updateTime)target.searchParams.set('currentDocument.updateTime',doc.updateTime);
    const result=await googleRequest(env,target.toString(),{method:'DELETE'});
    if(!result.ok)reject('회계 내역 일부 삭제에 실패했습니다. 상태 확인 후 다시 시도해 주세요.',503);
    deleted++;
  }
  return {deleted,more:docs.length>20};
}
export async function onRequestPost({request,env}){
  try{
    secureOrigin(request);
    const caller=await assertAccess(request,env,'president');
    if(!caller.superadmin)reject('검증된 최고관리자만 초기화할 수 있습니다.',403);
    const input=await parseBody(request);
    if(input?.confirmation!==DONATIONS_RESET_CONFIRMATION)reject('초기화 확인 문구를 정확히 입력해 주세요.');
    const donations=await deletePage(env,LEDGER);
    if(donations.deleted>0||donations.more)return success({deleted:donations.deleted,deletedDonations:donations.deleted,deletedExpenses:0,done:false});
    const expenses=await deletePage(env,EXPENSES);
    if(expenses.deleted>0||expenses.more)return success({deleted:expenses.deleted,deletedDonations:0,deletedExpenses:expenses.deleted,done:false});
    const check=await googleRequest(env,new URL(LEDGER).toString());
    if(!check.ok)throw Error('후원 초기화 완료 확인 실패');
    if((check.data.documents??[]).length)return success({deleted:0,deletedDonations:0,deletedExpenses:0,done:false});
    const anonymous=await googleRequest(env,ANONYMOUS_DOC);
    if(anonymous.ok){
      const removed=await googleRequest(env,ANONYMOUS_DOC,{method:'DELETE'});
      if(!removed.ok)throw Error('익명자 명단 초기화 실패');
    }else if(anonymous.status!==404)throw Error('익명자 명단 조회 실패');
    return success({deleted:0,deletedDonations:0,deletedExpenses:0,done:true});
  }catch(error){return failure(error);}
}
