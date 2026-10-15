import {failure,parseBody,secureOrigin,success} from '../../_lib/shared.js';
import {assertAccess} from '../../_lib/google.js';
import {getGalleryAlbumDocument,galleryFromDoc,updateGalleryAlbum,deleteGalleryAlbum} from '../../_lib/gallery.js';
import {deleteUnusedGalleryImages} from '../../_lib/githubImages.js';

export async function onRequestPatch({request,env,params}){
  try{
    secureOrigin(request);
    await assertAccess(request,env,'part_leader');
    const input=await parseBody(request);
    const prior=galleryFromDoc(await getGalleryAlbumDocument(env,params.id));
    const album=await updateGalleryAlbum(env,params.id,input);
    const retained=new Set(album.photos);
    const obsolete=prior.photos.filter(url=>!retained.has(url));
    let cleanupPending=false;
    if(obsolete.length){
      try{await deleteUnusedGalleryImages(env,obsolete);}
      catch(error){
        console.error('Gallery image cleanup failed after album update',error);
        cleanupPending=true;
      }
    }
    return success({album,cleanupPending});
  }catch(error){return failure(error);}
}
export async function onRequestDelete({request,env,params}){
  try{
    secureOrigin(request);
    await assertAccess(request,env,'part_leader');
    const input=await parseBody(request);
    const prior=galleryFromDoc(await getGalleryAlbumDocument(env,params.id));
    await deleteGalleryAlbum(env,params.id,input?.expectedUpdateTime);
    let cleanupPending=false;
    try{await deleteUnusedGalleryImages(env,prior.photos);}
    catch(error){
      console.error('Gallery image cleanup failed after album deletion',error);
      cleanupPending=true;
    }
    return success({deleted:true,cleanupPending});
  }catch(error){return failure(error);}
}
