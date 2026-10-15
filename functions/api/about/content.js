import { failure,parseBody,secureOrigin,success } from '../../_lib/shared.js';
import { assertAccess } from '../../_lib/google.js';
import { getAbout,saveAbout } from '../../_lib/aboutContent.js';
import {deleteUnusedSiteImages} from '../../_lib/githubImages.js';
export async function onRequestGet({request,env}){
  try {secureOrigin(request);const {content}=await getAbout(env);return success({content});}
  catch(error){return failure(error);}
}
export async function onRequestPost({request,env}){
  try{secureOrigin(request);await assertAccess(request,env,'staff');
    const body=await parseBody(request);
    const {content:previous}=await getAbout(env);
    const saved=await saveAbout(env,body?.content,body?.expectedUpdateTime);
    const before=[previous.homeImage,previous.heroImage,...previous.officers.map(person=>person.photoUrl)];
    const after=new Set([saved.content.homeImage,saved.content.heroImage,...saved.content.officers.map(person=>person.photoUrl)]);
    const obsolete=before.filter(url=>url&&!after.has(url));
    let siteCleanup={deleted:0,pending:false};
    if(obsolete.length){
      try{siteCleanup={...await deleteUnusedSiteImages(env,obsolete),pending:false};}
      catch(error){
        console.error('Site image cleanup deferred after successful Firestore save',error);
        siteCleanup={deleted:0,pending:true};
      }
    }
    return success({...saved,siteCleanup});
  }catch(error){return failure(error);}
}
