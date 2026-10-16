import { failure,parseBody,secureOrigin,success } from '../../_lib/shared.js';
import { assertAccess } from '../../_lib/google.js';
import { getAccount,putAccount } from '../../_lib/financeTransactions.js';

export async function onRequestGet({request,env}){
  try {secureOrigin(request);await assertAccess(request,env,'member');const row=await getAccount(env);
    return success({account:{bank:row.bank,number:row.number,holder:row.holder}});
  }catch(error){return failure(error);}
}
export async function onRequestPost({request,env}){
  try {secureOrigin(request);await assertAccess(request,env,'president');
    const body=await parseBody(request);
    const account=await putAccount(env,body.account,body.expectedUpdateTime);
    return success({account});
  }catch(error){return failure(error);}
}
