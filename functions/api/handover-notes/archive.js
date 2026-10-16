import {failure,secureOrigin,success} from '../../_lib/shared.js';
import {handoverCaller,listHandoverArchive} from '../../_lib/handoverNotes.js';

export async function onRequestGet({request,env}){
 try{
  secureOrigin(request);
  await handoverCaller(request,env);
  return success({entries:await listHandoverArchive(env)});
 }catch(error){return failure(error);}
}
