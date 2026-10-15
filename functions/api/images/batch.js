import {failure,reject,secureOrigin,success} from '../../_lib/shared.js';
import {assertAccess} from '../../_lib/google.js';

const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
function validSignature(type,b){return type==='image/jpeg'?b[0]===255&&b[1]===216&&b[2]===255:type==='image/png'?b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71:type==='image/webp'?b[0]===82&&b[1]===73&&b[2]===70&&b[3]===70&&b[8]===87&&b[9]===69&&b[10]===66&&b[11]===80:false;}
function base64(bytes){let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result);}
async function github(path,token,method='GET',body){
  const response=await fetch('https://api.github.com/repos/skku-myrock/myrock-images/'+path,{method,headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json','content-type':'application/json','x-github-api-version':'2022-11-28','user-agent':'MYROCK-Website'},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok){console.error('GitHub images request failed',path,method,response.status);reject('GitHub 이미지 저장 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.',response.status===409||response.status===422?409:502);}
  return response.json();
}
export async function onRequestPost({request,env}){
  try{
    secureOrigin(request);await assertAccess(request,env,'part_leader');
    if(!env.GITHUB_IMAGES_TOKEN||!env.MYROCK_IMAGES_PUBLIC_BASE_URL)reject('GitHub 이미지 저장소 서버 설정이 필요합니다.',503);
    let publicBase;
    try{publicBase=new URL(env.MYROCK_IMAGES_PUBLIC_BASE_URL);if(publicBase.protocol!=='https:'||publicBase.username||publicBase.password||publicBase.search||publicBase.hash||publicBase.pathname!=='/')throw Error('invalid');}
    catch{reject('이미지 공개 주소 설정이 올바르지 않습니다.',503);}
    if(Number(request.headers.get('content-length')??0)>17000000)reject('한 번에 업로드할 수 있는 총 용량은 16MB입니다.',413);
    if(!request.headers.get('content-type')?.includes('multipart/form-data'))reject('이미지 파일만 업로드할 수 있습니다.',415);
    const form=await request.formData();
    const folder=form.get('folder')??'site';
    if(folder!=='site'&&folder!=='notices')reject('지원하지 않는 이미지 폴더입니다.',400);
    const files=form.getAll('images');
    if(!files.length||files.length>12)reject('한 번에 1~12장의 이미지를 업로드할 수 있습니다.');
    let total=0;
    const checked=[];
    for(const file of files){
      if(!file||typeof file.arrayBuffer!=='function'||!extensions[file.type]||file.size===0||file.size>5000000)reject('JPG, PNG, WebP 형식의 5MB 이하 이미지만 등록할 수 있습니다.');
      total+=file.size;if(total>16000000)reject('사진 총합이 16MB를 넘었습니다.',413);
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(!validSignature(file.type,bytes))reject('올바르지 않은 이미지 파일입니다.');
      checked.push({bytes,type:file.type});
    }
    const token=env.GITHUB_IMAGES_TOKEN;
    const head=await github('git/ref/heads/main',token);
    const commit=await github('git/commits/'+head.object.sha,token);
    const entries=[];
    const urls=[];
    for(const image of checked){
      const blob=await github('git/blobs',token,'POST',{content:base64(image.bytes),encoding:'base64'});
      const path=folder+'/'+crypto.randomUUID()+'.'+extensions[image.type];
      entries.push({path,mode:'100644',type:'blob',sha:blob.sha});
      urls.push(new URL(path,publicBase).href);
    }
    const tree=await github('git/trees',token,'POST',{base_tree:commit.tree.sha,tree:entries});
    const next=await github('git/commits',token,'POST',{message:'assets('+folder+'): upload '+files.length+' images',tree:tree.sha,parents:[head.object.sha]});
    await github('git/refs/heads/main',token,'PATCH',{sha:next.sha,force:false});
    return success({urls,deployPending:true,commit:next.sha},201);
  }catch(error){return failure(error);}
}
