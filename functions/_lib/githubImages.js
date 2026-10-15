import {reject} from './shared.js';
import {siteManifestEntry} from './siteManifest.js';
const REPO='https://api.github.com/repos/skku-myrock/myrock-images/';
const FOLDERS=new Set(['site','notices']);
async function github(env,path,method='GET',body){
  if(!env.GITHUB_IMAGES_TOKEN)reject('GitHub 이미지 저장소 인증 Secret이 필요합니다.',503);
  const response=await fetch(REPO+path,{
    method,headers:{authorization:'Bearer '+env.GITHUB_IMAGES_TOKEN,accept:'application/vnd.github+json',
      'content-type':'application/json','x-github-api-version':'2022-11-28','user-agent':'MYROCK-Website'},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  if(!response.ok){
    console.error('MYROCK GitHub asset cleanup failed',path,response.status);
    reject('GitHub 이미지 저장소 정리에 실패했습니다. 저장소 권한과 상태를 확인해 주세요.',response.status===409||response.status===422?409:502);
  }
  return response.json();
}
/** Replace only the selected folder tree, leaving all sibling directories intact. */
export async function clearImageFolder(env,folder){
  if(!FOLDERS.has(folder))reject('허용되지 않은 이미지 폴더입니다.',400);
  const head=await github(env,'git/ref/heads/main');
  const commit=await github(env,'git/commits/'+head.object.sha);
  const empty=await github(env,'git/trees','POST',{tree:[{path:'.gitkeep',mode:'100644',type:'blob',content:''}]});
  const entries=[{path:folder,mode:'040000',type:'tree',sha:empty.sha}];
  if(folder==='site')entries.push(siteManifestEntry([]));
  // Update the live folder and its deployed allowlist in the same Git commit.
  const tree=await github(env,'git/trees','POST',{base_tree:commit.tree.sha,tree:entries});
  if(tree.sha===commit.tree.sha)return {changed:false,commit:null};
  const next=await github(env,'git/commits','POST',{message:'maintenance: clear '+folder+' image assets',tree:tree.sha,parents:[head.object.sha]});
  await github(env,'git/refs/heads/main','PATCH',{sha:next.sha,force:false});
  return {changed:true,commit:next.sha};
}
