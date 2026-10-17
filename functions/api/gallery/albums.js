import {failure,parseBody,secureOrigin,success} from '../../_lib/shared.js';
import {assertAccess} from '../../_lib/google.js';
import {listGalleryAlbums,listGalleryFirstPage,readGalleryPage,createGalleryAlbum} from '../../_lib/gallery.js';

export async function onRequestGet({request,env}){
  try{
    secureOrigin(request);
    const query=new URL(request.url).searchParams;
    if(query.has('page')){
      const raw=query.get('page');
      if(!raw||!/^[1-9][0-9]*$/.test(raw))return failure({status:400,message:'갤러리 페이지 번호가 올바르지 않습니다.'});
      return success(await readGalleryPage(env,{page:Number(raw),category:query.get('category')??'전체'}));
    }
    return success({albums:await (query.get('preview')==='first12'?listGalleryFirstPage(env):listGalleryAlbums(env))});
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
