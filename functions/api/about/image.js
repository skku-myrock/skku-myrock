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
export async function onRequestPost({request,env}){
  try{
    secureOrigin(request);
    await assertAccess(request,env,'staff');
    if(!env.MYROCK_IMAGES)reject('Cloudflare R2에 MYROCK_IMAGES 버킷 바인딩을 설정해야 이미지 파일을 올릴 수 있습니다.',503);
    if(Number(request.headers.get('content-length')??'0')>5500000)reject('이미지는 5MB 이하여야 합니다.',413);
    if(!request.headers.get('content-type')?.includes('multipart/form-data'))reject('이미지 파일만 업로드할 수 있습니다.',415);
    const form=await request.formData();
    const file=form.get('image');
    if(!file||typeof file.arrayBuffer!=='function')reject('이미지 파일을 선택해 주세요.');
    if(file.size>5000000||file.size===0||!types.has(file.type))reject('JPG, PNG, WebP, GIF 이미지 5MB 이하만 허용합니다.');
    const data=await file.arrayBuffer();
    const bytes=new Uint8Array(data);
    const signatures={
      'image/jpeg':bytes[0]===255&&bytes[1]===216&&bytes[2]===255,
      'image/png':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,
      'image/gif':bytes[0]===71&&bytes[1]===73&&bytes[2]===70,
      'image/webp':bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&
        bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80
    };
    if(!signatures[file.type])reject('이미지 파일 형식이 올바르지 않습니다.');
    const key='about/'+crypto.randomUUID();
    await env.MYROCK_IMAGES.put(key,data,{httpMetadata:{contentType:file.type}});
    return success({url:'/api/about/image?key='+key});
  }catch(error){return failure(error);}
}
