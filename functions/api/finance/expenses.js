import { failure,secureOrigin,success } from '../../_lib/shared.js';
import { listTransactions } from '../../_lib/financeTransactions.js';
export async function onRequestGet({request,env}){
  try{secureOrigin(request);const rows=await listTransactions(env);
    return success({records:rows.map(({id,dateTime,type,amount,balance,description})=>({id,dateTime,type,amount,balance,description}))});
  }catch(error){return failure(error);}
}
