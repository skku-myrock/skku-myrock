import { failure,secureOrigin,success } from '../../_lib/shared.js';
import { assertAccess } from '../../_lib/google.js';
import { getAbout } from '../../_lib/aboutContent.js';
export async function onRequestGet({request,env}){
  try{secureOrigin(request);await assertAccess(request,env,'staff');return success(await getAbout(env));}
  catch(error){return failure(error);}
}
