import {reject} from './shared.js';
import {getAbout} from './aboutContent.js';
import {listNotices} from './notices.js';
import {listGalleryAlbums} from './gallery.js';
import {listEquipment} from './equipment.js';
const REPO='https://api.github.com/repos/skku-myrock/myrock-images/';
const FOLDERS=new Set(['site','notices','gallery']);
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
  const tree=await github(env,'git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:folder,mode:'040000',type:'tree',sha:empty.sha}]});
  if(tree.sha===commit.tree.sha)return {changed:false,commit:null};
  const next=await github(env,'git/commits','POST',{message:'maintenance: clear '+folder+' image assets',tree:tree.sha,parents:[head.object.sha]});
  await github(env,'git/refs/heads/main','PATCH',{sha:next.sha,force:false});
  return {changed:true,commit:next.sha};
}

/** Remove only previously referenced generated site assets that no longer have live references.
 * Never delete URLs from another origin, notices/, gallery/, or unknown file names.
 * The stored Firestore content is re-read after the write so stale editor state cannot decide deletion.
 */
export async function deleteUnusedSiteImages(env,obsoleteUrls){
  if(!Array.isArray(obsoleteUrls)||!obsoleteUrls.length)return {deleted:0};
  if(!env.MYROCK_IMAGES_PUBLIC_BASE_URL)throw Error('이미지 공개 주소가 없어 이전 파일 정리를 건너뜁니다.');
  const base=new URL(env.MYROCK_IMAGES_PUBLIC_BASE_URL);
  if(base.protocol!=='https:'||base.pathname!=='/'||base.search||base.hash)throw Error('이미지 주소 설정을 확인해 주세요.');
  const toPath=value=>{
    if(typeof value!=='string')return null;
    let url;try{url=new URL(value);}catch{return null;}
    if(url.origin!==base.origin||url.search||url.hash)return null;
    const path=url.pathname.slice(1);
    // Upload API generates a random UUID per image. No other paths qualify for automatic deletion.
    return /^site\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(path)?path:null;
  };
  const candidates=new Map(obsoleteUrls.map(url=>[toPath(url),url]).filter(([path])=>Boolean(path)));
  if(!candidates.size)return {deleted:0};
  const {content}=await getAbout(env);
  const inUse=new Set([content.homeImage,content.heroImage,...content.officers.map(person=>person.photoUrl)]);
  for(const [path,url] of candidates)if(inUse.has(url))candidates.delete(path);
  if(!candidates.size)return {deleted:0};
  const notices=await listNotices(env);
  // listNotices has a 1,000-document scan limit; fail closed if the result could be incomplete.
  if(notices.length>=1000)throw Error('공지사항 참조 검사가 제한에 도달해 사진 정리를 건너뜁니다.');
  const noticeUrls=new Set(notices.flatMap(notice=>(notice.blocks??[]).flatMap(block=>
    block.kind==='image'?[block.url]:block.kind==='gallery'?(block.images??[]).map(photo=>photo.url):[])));
  for(const [path,url] of candidates)if(noticeUrls.has(url))candidates.delete(path);
  if(!candidates.size)return {deleted:0};
  for(let attempt=0;attempt<3;attempt++){
    const head=await github(env,'git/ref/heads/main');
    const previous=await github(env,'git/commits/'+head.object.sha);
    const entries=[...candidates.keys()].map(path=>({path,mode:'100644',type:'blob',sha:null}));
    const tree=await github(env,'git/trees','POST',{base_tree:previous.tree.sha,tree:entries});
    if(tree.sha===previous.tree.sha)return {deleted:0};
    const next=await github(env,'git/commits','POST',{message:'assets(site): remove '+entries.length+' replaced photos',tree:tree.sha,parents:[head.object.sha]});
    try{
      await github(env,'git/refs/heads/main','PATCH',{sha:next.sha,force:false});
      return {deleted:entries.length,commit:next.sha};
    }catch(error){
      if(error?.status!==409||attempt===2)throw error;
    }
  }
  return {deleted:0};
}

/** Clean generated gallery WebP assets only after the associated Firestore mutation succeeds.
 * Protect files referenced by other albums, introduction content, or notices.
 */
export async function deleteUnusedGalleryImages(env,obsoleteUrls){
  if(!Array.isArray(obsoleteUrls)||obsoleteUrls.length===0)return {deleted:0};
  const base=new URL(env.MYROCK_IMAGES_PUBLIC_BASE_URL);
  if(base.protocol!=='https:'||base.pathname!=='/'||base.search||base.hash)throw Error('이미지 공개 주소 설정이 올바르지 않습니다.');
  const candidates=new Map();
  for(const value of obsoleteUrls){
    if(typeof value!=='string')continue;
    let url;try{url=new URL(value);}catch{continue;}
    const path=url.pathname.slice(1);
    if(url.origin===base.origin&&!url.search&&!url.hash&&
      /^gallery\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i.test(path))
      candidates.set(path,url.href);
  }
  if(!candidates.size)return {deleted:0};
  const albums=await listGalleryAlbums(env);
  const about=await getAbout(env);
  const notices=await listNotices(env);
  if(notices.length>=1000)throw Error('공지사항 참조 검사가 제한에 도달해 사진 정리를 건너뜁니다.');
  const refs=new Set([
    ...albums.flatMap(album=>album.photos),
    about.content.homeImage,about.content.heroImage,...about.content.officers.map(person=>person.photoUrl),
    ...notices.flatMap(notice=>(notice.blocks??[]).flatMap(block=>
      block.kind==='image'?[block.url]:block.kind==='gallery'?(block.images??[]).map(photo=>photo.url):[])),
  ]);
  for(const [path,url] of candidates)if(refs.has(url))candidates.delete(path);
  if(!candidates.size)return {deleted:0};
  for(let attempt=0;attempt<3;attempt++){
    const head=await github(env,'git/ref/heads/main');
    const previous=await github(env,'git/commits/'+head.object.sha);
    const existing=await github(env,'git/trees/'+previous.tree.sha+'?recursive=1');
    if(existing.truncated)throw Error('GitHub 트리 목록이 불완전하여 이미지 삭제를 건너뜁니다.');
    const names=new Set((existing.tree??[]).filter(entry=>entry.type==='blob').map(entry=>entry.path));
    const entries=[...candidates.keys()].filter(path=>names.has(path)).map(path=>({path,mode:'100644',type:'blob',sha:null}));
    if(!entries.length)return {deleted:0};
    const tree=await github(env,'git/trees','POST',{base_tree:previous.tree.sha,tree:entries});
    const next=await github(env,'git/commits','POST',{message:'assets(gallery): remove '+entries.length+' unreferenced photos',tree:tree.sha,parents:[head.object.sha]});
    try{
      await github(env,'git/refs/heads/main','PATCH',{sha:next.sha,force:false});
      return {deleted:entries.length,commit:next.sha};
    }catch(error){
      if(error?.status!==409||attempt===2)throw error;
    }
  }
  return {deleted:0};
}

/** Remove obsolete equipment photos after Firestore has been saved.
 * Only generated equipment/<uuid>.webp URLs can be deleted.
 * Re-read equipment documents before deleting to avoid removing live assets.
 */
export async function deleteUnusedEquipmentImages(env,obsoleteUrls){
 if(!Array.isArray(obsoleteUrls)||!obsoleteUrls.length)return {deleted:0};
 if(!env.MYROCK_IMAGES_PUBLIC_BASE_URL)throw Error('이미지 공개 주소 설정이 없습니다.');
 const base=new URL(env.MYROCK_IMAGES_PUBLIC_BASE_URL);
 if(base.protocol!=='https:'||base.pathname!=='/'||base.search||base.hash)throw Error('이미지 공개 주소 설정이 올바르지 않습니다.');
 const candidates=new Map();
 for(const value of obsoleteUrls){
  if(typeof value!=='string')continue;
  let url;try{url=new URL(value);}catch{continue;}
  const path=url.pathname.slice(1);
  if(url.origin===base.origin&&!url.search&&!url.hash&&
    /^equipment\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i.test(path))
   candidates.set(path,url.href);
 }
 if(!candidates.size)return {deleted:0};
 const items=await listEquipment(env);
 const referenced=new Set(items.map(item=>item.imageUrl).filter(Boolean));
 for(const [path,url] of candidates)if(referenced.has(url))candidates.delete(path);
 if(!candidates.size)return {deleted:0};
 for(let attempt=0;attempt<3;attempt++){
  const head=await github(env,'git/ref/heads/main');
  const previous=await github(env,'git/commits/'+head.object.sha);
  const treeListing=await github(env,'git/trees/'+previous.tree.sha+'?recursive=1');
  if(treeListing.truncated)throw Error('이미지 저장소 목록이 불완전하여 정리를 연기했습니다.');
  const names=new Set((treeListing.tree??[]).filter(entry=>entry.type==='blob').map(entry=>entry.path));
  const entries=[...candidates.keys()].filter(path=>names.has(path)).map(path=>({path,mode:'100644',type:'blob',sha:null}));
  if(!entries.length)return {deleted:0};
  const tree=await github(env,'git/trees','POST',{base_tree:previous.tree.sha,tree:entries});
  const commit=await github(env,'git/commits','POST',{message:'assets(equipment): remove '+entries.length+' replaced photos',tree:tree.sha,parents:[head.object.sha]});
  try{
   await github(env,'git/refs/heads/main','PATCH',{sha:commit.sha,force:false});
   return {deleted:entries.length,commit:commit.sha};
  }catch(error){if(error?.status!==409||attempt===2)throw error;}
 }
 return {deleted:0};
}
