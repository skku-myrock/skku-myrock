import {failure,parseBody,reject,secureOrigin,success,toFields} from '../../_lib/shared.js';
import {assertAccess,googleRequest} from '../../_lib/google.js';
import {ABOUT_DOC,DEFAULT_ABOUT} from '../../_lib/aboutContent.js';

export const RESET_ABOUT_CONFIRMATION='모여락 소개 초기화';
const REPO='https://api.github.com/repos/skku-myrock/myrock-images/';

async function github(env,path,method='GET',body){
  const response=await fetch(REPO+path,{
    method,headers:{
      authorization:'Bearer '+env.GITHUB_IMAGES_TOKEN,
      accept:'application/vnd.github+json',
      'content-type':'application/json',
      'x-github-api-version':'2022-11-28',
      'user-agent':'MYROCK-Website'
    },
    ...(body?{body:JSON.stringify(body)}:{})
  });
  if(!response.ok){
    console.error('MYROCK site image purge GitHub error',path,response.status);
    reject('GitHub 이미지 저장소 정리에 실패했습니다. 토큰 권한 및 GitHub 상태를 확인해 주세요.',502);
  }
  return response.json();
}
export async function clearSiteImages(env){
  if(!env.GITHUB_IMAGES_TOKEN)reject('GitHub 이미지 저장소 인증 Secret이 필요합니다.',503);
  const head=await github(env,'git/ref/heads/main');
  const commit=await github(env,'git/commits/'+head.object.sha);
  // Rebuild only site/ with a placeholder. gallery/ and other root paths remain untouched.
  const site=await github(env,'git/trees', 'POST', {tree:[{path:'.gitkeep',mode:'100644',type:'blob',content:''}]});
  const tree=await github(env,'git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:'site',mode:'040000',type:'tree',sha:site.sha}]});
  if(tree.sha===commit.tree.sha)return {changed:false};
  const next=await github(env,'git/commits','POST',{message:'maintenance: clear site images for club introduction reset',tree:tree.sha,parents:[head.object.sha]});
  await github(env,'git/refs/heads/main','PATCH',{sha:next.sha,force:false});
  return {changed:true,commit:next.sha};
}
export async function onRequestPost({request,env}){
  try{
    secureOrigin(request);
    const caller=await assertAccess(request,env,'president');
    if(!caller.superadmin)reject('검증된 최고관리자만 소개를 초기화할 수 있습니다.',403);
    const input=await parseBody(request);
    if(input?.confirmation!==RESET_ABOUT_CONFIRMATION)reject('초기화 확인 문구가 올바르지 않습니다.',400);

    // Clear the GitHub site subtree first. If this fails, Firestore remains unchanged.
    const githubResult=await clearSiteImages(env);
    const url=new URL(ABOUT_DOC);
    const original=await googleRequest(env,ABOUT_DOC);
    if(original.ok){
      if(!original.data.updateTime)reject('소개 정보 버전을 확인하지 못해 초기화를 중단했습니다.',409);
      url.searchParams.set('currentDocument.updateTime',original.data.updateTime);
    }else if(original.status===404)url.searchParams.set('currentDocument.exists','false');
    else throw Error('소개 조회 실패 '+original.status);
    const saved=await googleRequest(env,url.href,{method:'PATCH',body:{fields:toFields(DEFAULT_ABOUT)}});
    if([409,412].includes(saved.status))reject('다른 운영진이 소개 내용을 변경했습니다. 확인 후 다시 초기화해 주세요.',409);
    if(!saved.ok)reject('GitHub 이미지 정리는 완료되었지만 Firestore 소개 초기화에 실패했습니다. 다시 실행해 주세요.',503);
    return success({reset:true,imagesCleared:githubResult.changed,commit:githubResult.commit??null});
  }catch(error){return failure(error);}
}
