import {failure,secureOrigin,parseBody,success} from '../../_lib/shared.js';
import {assertAccess} from '../../_lib/google.js';
import {listNotices,createNotice} from '../../_lib/notices.js';
export async function onRequestGet({request,env}){
  try{secureOrigin(request);return success({notices:await listNotices(env)});}
  catch(error){return failure(error);}
}
export async function onRequestPost({request,env}){
  try{secureOrigin(request);const caller=await assertAccess(request,env,'part_leader');const input=await parseBody(request);return success({notice:await createNotice(env,input,caller)},201);}
  catch(error){return failure(error);}
}