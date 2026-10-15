import { failure,secureOrigin,success } from '../../_lib/shared.js';
import { listPublicTransactionsPage } from '../../_lib/financeTransactions.js';
export async function onRequestGet({request,env}){
  try{secureOrigin(request);const rows=await listTransactions(env);
    return success({records:page.records.map(({id,dateTime,type,amount,balance,description})=>({id,dateTime,type,amount,balance,description})),nextPageToken:page.nextPageToken});
  }catch(error){return failure(error);}
}
