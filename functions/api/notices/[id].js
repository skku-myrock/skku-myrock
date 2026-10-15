import {failure,secureOrigin,parseBody,success} from '../../_lib/shared.js';
import {assertAccess} from '../../_lib/google.js';
import {getNotice,updateNotice,deleteNotice} from '../../_lib/notices.js';
export async function onRequestGet({request,env,params}){
  try{secureOrigin(request);return success({notice:await getNotice(env,String(params.id))});}
  catch(error){return failure(error);}
}
export async function onRequestPut({request,env,params}){
  try{secureOrigin(request);await assertAccess(request,env,'part_leader');const input=await parseBody(request);return success({notice:await updateNotice(env,String(params.id),input)});}
  catch(error){return failure(error);}
}
export async function onRequestDelete({request,env,params}){
  try{secureOrigin(request);await assertAccess(request,env,'part_leader');const input=await parseBody(request);return success(await deleteNotice(env,String(params.id),input?.expectedUpdateTime));}
  catch(error){return failure(error);}
}