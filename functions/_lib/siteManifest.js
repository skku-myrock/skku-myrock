import {reject} from './shared.js';

export const manifestPath='functions/_lib/siteManifest.js';
export const MANAGED_SITE_IMAGE=/^site\/[a-f0-9-]{36}\.(?:jpg|png|webp|gif)$/;

export function makeSiteManifest(paths){
  const sorted=[...new Set(paths)].sort();
  if(sorted.some(path=>!MANAGED_SITE_IMAGE.test(path)))reject('이미지 저장소 파일 목록이 올바르지 않습니다.',503);
  return '// Generated atomically with site image commits. Do not edit manually.\n'+
    'export const SITE_IMAGE_PATHS = new Set('+JSON.stringify(sorted.map(path=>'/'+path))+');\n';
}
export function siteManifestEntry(paths){
  return {path:manifestPath,mode:'100644',type:'blob',content:makeSiteManifest(paths)};
}
export async function currentSiteImagePaths(github,rootTreeSha){
  const root=await github('git/trees/'+rootTreeSha);
  const subtree=root.tree?.find(item=>item.path==='site'&&item.type==='tree');
  if(!subtree)reject('이미지 저장소의 site 폴더를 찾을 수 없습니다.',503);
  const site=await github('git/trees/'+subtree.sha+'?recursive=1');
  if(site.truncated)reject('이미지 저장소 파일 목록이 너무 많습니다.',503);
  const paths=(site.tree??[]).filter(item=>item.type==='blob'&&MANAGED_SITE_IMAGE.test('site/'+item.path))
    .map(item=>'site/'+item.path);
  // Reject unmanaged JPG/PNG/GIF/WebP files: silent omissions would make valid images 404.
  const unknown=(site.tree??[]).filter(item=>item.type==='blob'&&/\.(?:jpg|jpeg|png|webp|gif)$/i.test(item.path)
    &&!MANAGED_SITE_IMAGE.test('site/'+item.path));
  if(unknown.length)reject('site 폴더에 관리 대상이 아닌 이미지 파일이 있습니다. 관리자에게 확인해 주세요.',503);
  return paths;
}
