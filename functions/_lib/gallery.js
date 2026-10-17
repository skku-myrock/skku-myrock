import {FIRESTORE_ROOT,docFields,toFields,reject,validateUpdateTime} from './shared.js';
import {googleRequest} from './google.js';

export const GALLERY_ROOT=FIRESTORE_ROOT+'/galleryAlbums';
const categories=new Set(['공연','행사','일상']);
const idPattern=/^[0-9a-f-]{36}$/i;

export function validateGalleryAlbum(input,publicBase){
  if(!input||typeof input!=='object'||Array.isArray(input))reject('갤러리 앨범 정보를 확인해 주세요.');
  const category=input.category;
  if(!categories.has(category))reject('갤러리 구분을 선택해 주세요.');
  const title=typeof input.title==='string'?input.title.trim():'';
  if(!title||title.length>150)reject('앨범 제목은 1~150자 사이여야 합니다.');
  if(!Array.isArray(input.photos)||input.photos.length<1||input.photos.length>50)reject('이미지는 앨범당 1~50장 등록할 수 있습니다.');
  let origin;
  try {
    const base=new URL(publicBase);
    if(base.protocol!=='https:'||base.pathname!=='/'||base.username||base.password||base.search||base.hash)throw Error('invalid');
    origin=base.origin;
  }catch{reject('이미지 저장소 공개 주소 설정이 올바르지 않습니다.',503);}
  const photos=input.photos.map(photo=>{
    if(typeof photo!=='string'||photo.length>1500)reject('사진 URL이 올바르지 않습니다.');
    let url;try{url=new URL(photo);}catch{reject('사진 URL이 올바르지 않습니다.');}
    if(url.origin!==origin||url.username||url.password||url.search||url.hash||
      !/^\/gallery\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i.test(url.pathname))reject('갤러리 저장소에 업로드한 WebP 사진만 등록할 수 있습니다.');
    return url.href;
  });
  if(new Set(photos).size!==photos.length)reject('중복 사진을 등록할 수 없습니다.');
  return {category,title,photos};
}

export function galleryFromDoc(doc){
  const fields=docFields(doc);
  return {id:doc.name.split('/').at(-1),category:fields.category,title:fields.title,photos:fields.photos,createdAt:fields.createdAt,...(doc.updateTime?{updateTime:doc.updateTime}:{})};
}

export async function listGalleryAlbums(env){
  const albums=[];let pageToken='';
  for(let page=0;page<10;page++){
    const url=new URL(GALLERY_ROOT);url.searchParams.set('pageSize','100');
    if(pageToken)url.searchParams.set('pageToken',pageToken);
    const response=await googleRequest(env,url.toString());
    if(response.status===404)return albums;
    if(!response.ok)throw Error('갤러리 목록 조회 실패 '+response.status);
    for(const doc of response.data.documents??[])albums.push(galleryFromDoc(doc));
    pageToken=response.data.nextPageToken??'';
    if(!pageToken)return albums.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }
  reject('갤러리 앨범 수가 조회 한도를 초과했습니다.',503);
}

export async function createGalleryAlbum(env,input,caller){
  const data=validateGalleryAlbum(input,env.MYROCK_IMAGES_PUBLIC_BASE_URL);
  const id=crypto.randomUUID(),createdAt=new Date().toISOString();
  const author=String(docFields(caller.profile).name??'운영진').slice(0,60);
  const body={...data,createdAt,author,authorUid:caller.uid};
  const url=new URL(GALLERY_ROOT+'/'+id);
  url.searchParams.set('currentDocument.exists','false');
  const response=await googleRequest(env,url.toString(),{method:'PATCH',body:{fields:toFields(body)}});
  if(!response.ok)throw Error('갤러리 앨범 등록 실패 '+response.status);
  return galleryFromDoc(response.data);
}

export async function deleteGalleryPage(env,count=20){
  const url=new URL(GALLERY_ROOT);url.searchParams.set('pageSize',String(count+1));
  const response=await googleRequest(env,url.toString());
  if(response.status===404)return {deleted:0,remaining:false};
  if(!response.ok)throw Error('갤러리 초기화 목록 조회 실패 '+response.status);
  const docs=response.data.documents??[];
  let deleted=0;
  for(const doc of docs.slice(0,count)){
    if(typeof doc.name!=='string'||!doc.name.startsWith('projects/')||!idPattern.test(doc.name.split('/').at(-1))||!doc.updateTime)
      reject('갤러리 앨범 문서 검증에 실패했습니다.',503);
    const endpoint=new URL('https://firestore.googleapis.com/v1/'+doc.name);
    endpoint.searchParams.set('currentDocument.updateTime',doc.updateTime);
    const result=await googleRequest(env,endpoint.href,{method:'DELETE'});
    if(!result.ok)reject('갤러리 앨범 일부를 삭제하지 못했습니다. 다시 실행해 주세요.',503);
    deleted++;
  }
  return {deleted,remaining:docs.length>count};
}

export function validateAlbumId(id){
  if(typeof id!=='string'||!idPattern.test(id))reject('갤러리 앨범 식별자가 올바르지 않습니다.',400);
  return id;
}
export async function getGalleryAlbumDocument(env,id){
  const endpoint=GALLERY_ROOT+'/'+validateAlbumId(id);
  const result=await googleRequest(env,endpoint);
  if(result.status===404)reject('앨범을 찾을 수 없습니다.',404);
  if(!result.ok)reject('갤러리 앨범 조회에 실패했습니다.',503);
  return result.data;
}
export async function updateGalleryAlbum(env,id,input){
  validateAlbumId(id);
  const expectedUpdateTime=validateUpdateTime(input?.expectedUpdateTime);
  const data=validateGalleryAlbum(input,env.MYROCK_IMAGES_PUBLIC_BASE_URL);
  // Firestore enforces optimistic locking atomically; never overwrite someone else's update.
  const endpoint=new URL(GALLERY_ROOT+'/'+id);
  endpoint.searchParams.set('currentDocument.updateTime',expectedUpdateTime);
  for(const field of ['category','title','photos'])endpoint.searchParams.append('updateMask.fieldPaths',field);
  const response=await googleRequest(env,endpoint.href,{method:'PATCH',body:{fields:toFields(data)}});
  if(response.status===404)reject('앨범을 찾을 수 없습니다.',404);
  if(response.status===409||response.status===412)reject('다른 운영진이 앨범을 변경했습니다. 새로고침한 뒤 다시 시도해 주세요.',409);
  if(!response.ok)reject('갤러리 앨범 수정에 실패했습니다.',503);
  return galleryFromDoc(response.data);
}
export async function deleteGalleryAlbum(env,id,expectedTime){
  validateAlbumId(id);
  const expectedUpdateTime=validateUpdateTime(expectedTime);
  const endpoint=new URL(GALLERY_ROOT+'/'+id);
  endpoint.searchParams.set('currentDocument.updateTime',expectedUpdateTime);
  const result=await googleRequest(env,endpoint.href,{method:'DELETE'});
  if(result.status===404)reject('앨범을 찾을 수 없습니다.',404);
  if(result.status===409||result.status===412)reject('다른 운영진이 앨범을 변경했습니다. 새로고침한 뒤 다시 시도해 주세요.',409);
  if(!result.ok)reject('갤러리 앨범 삭제에 실패했습니다.',503);
  return {deleted:true};
}

/** Preview page: fetch just the 12 newest album metadata documents. */
export async function listGalleryFirstPage(env){
 const query={structuredQuery:{
  from:[{collectionId:'galleryAlbums'}],
  orderBy:[{field:{fieldPath:'createdAt'},direction:'DESCENDING'}],
  limit:12,
 }};
 const response=await googleRequest(env,FIRESTORE_ROOT+':runQuery',{method:'POST',body:query});
 if(!response.ok)throw Error('갤러리 첫 페이지 조회 실패 '+response.status);
 return (Array.isArray(response.data)?response.data:[])
  .filter(row=>row.document).map(row=>galleryFromDoc(row.document)).slice(0,12);
}
