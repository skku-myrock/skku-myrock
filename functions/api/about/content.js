import { failure,parseBody,secureOrigin,success } from '../../_lib/shared.js';
import { assertAccess } from '../../_lib/google.js';
import { getAbout,saveAbout } from '../../_lib/aboutContent.js';
export async function onRequestGet({request,env}){
  try {secureOrigin(request);const {content}=await getAbout(env);return success({content});}
  catch(error){return failure(error);}
}
export async function onRequestPost({request,env}){
  try{secureOrigin(request);await assertAccess(request,env,'staff');
    const body=await parseBody(request);
    return success(await saveAbout(env,body?.content,body?.expectedUpdateTime));
  }catch(error){return failure(error);}
}
