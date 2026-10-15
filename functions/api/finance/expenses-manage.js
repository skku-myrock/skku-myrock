import { failure,parseBody,secureOrigin,success,reject } from '../../_lib/shared.js';
import { assertAccess } from '../../_lib/google.js';
import { listTransactions,putTransaction,appendTransactionBatch } from '../../_lib/financeTransactions.js';
export async function onRequestGet({request,env}){
  try{secureOrigin(request);await assertAccess(request,env,'staff');
    return success({records:await listTransactions(env)});
  }catch(error){return failure(error);}
}
export async function onRequestPost({request,env}){
  try{secureOrigin(request);await assertAccess(request,env,'staff');
    const body=await parseBody(request);
    if(body?.action==='save')return success({record:await putTransaction(env,body.record,body.id,body.expectedUpdateTime)});
    if(body?.action==='import')return success({added:await appendTransactionBatch(env,body.rows)});
    reject('지원하지 않는 회비 거래 관리 작업입니다.');
  }catch(error){return failure(error);}
}
