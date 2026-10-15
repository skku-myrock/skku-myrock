import {failure,parseBody,reject,secureOrigin,success} from '../../_lib/shared.js';
import {assertAccess} from '../../_lib/google.js';
import {listNotices} from '../../_lib/notices.js';
import {clearImageFolder} from '../../_lib/githubImages.js';
import {getAbout,saveAbout,withoutAboutPhotoUrls} from '../../_lib/aboutContent.js';

export const RESET_SITE_CONFIRMATION='에셋 초기화';
export async function onRequestPost({request,env}){
  try{
    secureOrigin(request);
    const caller=await assertAccess(request,env,'president');
    if(!caller.superadmin)reject('검증된 최고관리자만 에셋을 초기화할 수 있습니다.',403);
    const input=await parseBody(request);
    if(input?.confirmation!==RESET_SITE_CONFIRMATION)reject('초기화 확인 문구가 올바르지 않습니다.',400);
    if(!env.MYROCK_IMAGES_PUBLIC_BASE_URL)reject('이미지 공개 주소 설정이 필요합니다.',503);
    let base;
    try{base=new URL(env.MYROCK_IMAGES_PUBLIC_BASE_URL);if(base.protocol!=='https:')throw Error('invalid');}
    catch{reject('이미지 공개 주소 설정이 올바르지 않습니다.',503);}
    // Older notices may still reference photos uploaded into site/ before folder separation.
    // Do not silently break those notices; require the owner to migrate their URLs first.
    const legacyPrefix=new URL('site/',base).href;
    const notices=await listNotices(env);
    const referenced=notices.some(notice=>{
      const urls=(notice.blocks??[]).flatMap(block=>block.kind==='image'?[block.url]:block.kind==='gallery'?(block.images??[]).map(image=>image.url):[]);
      return urls.some(url=>typeof url==='string'&&url.startsWith(legacyPrefix));
    });
    if(referenced)reject('공지사항에 아직 site/ 사진을 참조하는 글이 있습니다. 해당 사진을 notices/로 이전한 후 에셋을 초기화해 주세요.',409);

    // Read before mutating GitHub. This preserves the current club description,
    // officer names/roles and history while clearing only their image references.
    const {content,updateTime}=await getAbout(env);
    const photosPresent=Boolean(content.homeImage||content.heroImage||content.officers.some(person=>person.photoUrl));
    const withoutPhotos=withoutAboutPhotoUrls(content);
    const cleaned=await clearImageFolder(env,'site');
    // GitHub and Firestore are independent systems. If the Firestore write fails,
    // return an error so a superadmin can retry this idempotent reset.
    if(photosPresent)await saveAbout(env,withoutPhotos,updateTime);
    return success({reset:true,...cleaned,photoUrlsCleared:photosPresent});
  }catch(error){return failure(error);}
}
