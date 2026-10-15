import { failure,reject,secureOrigin,success } from '../../_lib/shared.js';
import { assertAccess } from '../../_lib/google.js';
const keyPattern=/^about\/[a-f0-9-]{36}$/;
const types=new Set(['image/jpeg','image/png','image/webp','image/gif']);
export async function onRequestGet({request,env}){
  try{
    secureOrigin(request);
    const key=new URL(request.url).searchParams.get('key');
    if(!key||!keyPattern.test(key))reject('이미지 주소가 올바르지 않습니다.',404);
    if(!env.MYROCK_IMAGES)reject('이미지 저장소를 사용할 수 없습니다.',503);
    const object=await env.MYROCK_IMAGES.get(key);
    if(!object)reject('이미지를 찾을 수 없습니다.',404);
    const headers=new Headers({'content-type':object.httpMetadata?.contentType??'application/octet-stream',
      'cache-control':'public,max-age=86400','x-content-type-options':'nosniff'});
    return new Response(object.body,{headers});
  }catch(error){return failure(error);}
}
export {onRequestPost} from '../images/upload.js';
