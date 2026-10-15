import {failure,parseBody,secureOrigin,success} from '../../_lib/shared.js';
import {assertAccess} from '../../_lib/google.js';
import {listGalleryAlbums,createGalleryAlbum} from '../../_lib/gallery.js';

export async function onRequestGet({request,env}){
  try{
    secureOrigin(request);
    return success({albums:await listGalleryAlbums(env)});
  }catch(error){return failure(error);}
}
export async function onRequestPost({request,env}){
  try{
    secureOrigin(request);
    const caller=await assertAccess(request,env,'part_leader');
    const body=await parseBody(request);
    return success({album:await createGalleryAlbum(env,body,caller)},201);
  }catch(error){return failure(error);}
}
