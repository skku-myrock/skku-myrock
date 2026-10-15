import {failure,parseBody,reject,secureOrigin,success} from '../../_lib/shared.js';
import {assertAccess} from '../../_lib/google.js';
import {clearImageFolder} from '../../_lib/githubImages.js';
import {deleteGalleryPage} from '../../_lib/gallery.js';

export const RESET_GALLERY_CONFIRMATION='갤러리 초기화';
const BATCH_SIZE=20;

export async function onRequestPost({request,env}){
  try{
    secureOrigin(request);
    const caller=await assertAccess(request,env,'president');
    if(!caller.superadmin)reject('검증된 최고관리자만 갤러리를 초기화할 수 있습니다.',403);
    const input=await parseBody(request);
    if(input?.confirmation!==RESET_GALLERY_CONFIRMATION)reject('초기화 확인 문구가 올바르지 않습니다.',400);
    if(!env.GITHUB_IMAGES_TOKEN)reject('갤러리 파일 정리를 위해 GitHub Secret이 필요합니다.',503);
    const result=await deleteGalleryPage(env,BATCH_SIZE);
    if(result.remaining)return success({deleted:result.deleted,done:false,imagesCleared:false});
    // A retry with zero documents still clears gallery/ if the previous GitHub request failed.
    const images=await clearImageFolder(env,'gallery');
    return success({deleted:result.deleted,done:true,imagesCleared:true,commit:images.commit});
  }catch(error){return failure(error);}
}
