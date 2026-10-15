import {failure,reject,secureOrigin,success} from '../../_lib/shared.js';
import {assertAccess} from '../../_lib/google.js';

const types=new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp'],['image/gif','gif']]);
const signatures={
  'image/jpeg':b=>b[0]===255&&b[1]===216&&b[2]===255,
  'image/png':b=>b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71,
  'image/webp':b=>b[0]===82&&b[1]===73&&b[2]===70&&b[3]===70&&b[8]===87&&b[9]===69&&b[10]===66&&b[11]===80,
  'image/gif':b=>b[0]===71&&b[1]===73&&b[2]===70
};
function encode64(bytes){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
export async function onRequestPost({request,env}){
  try{
    secureOrigin(request);
    await assertAccess(request,env,'staff');
    if(!env.GITHUB_IMAGES_TOKEN||!env.MYROCK_IMAGES_PUBLIC_BASE_URL)reject('GitHub 이미지 저장소의 서버 설정이 필요합니다.',503);
    if(Number(request.headers.get('content-length')??'0')>5500000)reject('이미지는 5MB 이하여야 합니다.',413);
    if(!request.headers.get('content-type')?.includes('multipart/form-data'))reject('이미지 파일만 업로드할 수 있습니다.',415);
    const form=await request.formData();
    const file=form.get('image');
    if(!file||typeof file.arrayBuffer!=='function')reject('이미지 파일을 선택해 주세요.');
    if(file.size===0||file.size>5000000||!types.has(file.type))reject('JPG, PNG, WebP, GIF 이미지 5MB 이하만 허용합니다.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(!signatures[file.type](bytes))reject('이미지 파일 형식이 올바르지 않습니다.');
    const path='site/'+crypto.randomUUID()+'.'+types.get(file.type);
    let base;
    try{base=new URL(env.MYROCK_IMAGES_PUBLIC_BASE_URL);if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw Error('bad');}
    catch{reject('이미지 공개 주소 설정이 올바르지 않습니다.',503);}
    const response=await fetch('https://api.github.com/repos/skku-myrock/myrock-images/contents/'+path,{
      method:'PUT',headers:{authorization:'Bearer '+env.GITHUB_IMAGES_TOKEN,accept:'application/vnd.github+json','content-type':'application/json','x-github-api-version':'2022-11-28','user-agent':'MYROCK-Website'},
      body:JSON.stringify({message:'assets(site): upload image',content:encode64(bytes),branch:'main'})
    });
    if(!response.ok){console.error('GitHub image upload failed',response.status);reject('GitHub 이미지 업로드에 실패했습니다. 서버 설정 및 권한을 확인해 주세요.',502);}
    const publicUrl=new URL(path,base.href.replace(/\/?$/,'/') ).href;
    return success({url:publicUrl,path,deployPending:true},201);
  }catch(error){return failure(error);}
}
