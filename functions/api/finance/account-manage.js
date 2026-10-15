import { failure,secureOrigin,success } from '../../_lib/shared.js';
import { assertAccess } from '../../_lib/google.js';
import { getAccount } from '../../_lib/financeTransactions.js';
export async function onRequestGet({request,env}){
  try{secureOrigin(request);await assertAccess(request,env,'president');
    return success({account:await getAccount(env)});
  }catch(error){return failure(error);}
}
