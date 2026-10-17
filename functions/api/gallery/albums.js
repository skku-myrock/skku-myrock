import {failure,parseBody,secureOrigin,success} from '../../_lib/shared.js';
import {assertAccess} from '../../_lib/google.js';
import {listGalleryAlbums,listGalleryPage,createGalleryAlbum} from '../../_lib/gallery.js';

export async function onRequestGet({request,env}){
  try{
    secureOrigin(request);
    const url=new URL(request.url);
    // Legacy list mode is retained for existing cleanup/admin integrations.
    if(url.searchParams.get('mode')==='all')return success({albums:await listGalleryAlbums(env)});
    const rawPage=url.searchParams.get('page')??'1';
    if(!/^[1-9]\\d{0,5}$/.test(rawPage))return success({error:'페이지 번호가 올바르지 않습니다.'},400);
    return success(await listGalleryPage(env,{page:Number(rawPage),category:url.searchParams.get('category')??'전체'}));
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
