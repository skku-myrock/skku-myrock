import {auth} from './firebase';
import type {PhotoAlbum,PhotoCategory} from './galleryData';
export async function listGalleryAlbums():Promise<PhotoAlbum[]>{
  const response=await fetch('/api/gallery/albums?preview=first12');
  const data=await response.json();
  if(!response.ok)throw Error(data?.error??'갤러리 목록 조회에 실패했습니다.');
  return data.albums as PhotoAlbum[];
}
export async function publishGalleryAlbum(category:PhotoCategory,title:string,photos:string[]):Promise<PhotoAlbum>{
  const token=await auth.currentUser?.getIdToken();
  if(!token)throw Error('로그인이 필요합니다.');
  const response=await fetch('/api/gallery/albums',{
    method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({category,title,photos}),
  });
  const data=await response.json();
  if(!response.ok)throw Error(data?.error??'갤러리 등록에 실패했습니다.');
  return data.album as PhotoAlbum;
}

export async function updateGalleryAlbum(album:PhotoAlbum,category:PhotoCategory,title:string,photos:string[]){
  if(!album.updateTime)throw Error('앨범의 수정 정보가 없습니다. 페이지를 새로고침해 주세요.');
  const token=await auth.currentUser?.getIdToken();
  if(!token)throw Error('로그인이 필요합니다.');
  const res=await fetch('/api/gallery/'+encodeURIComponent(album.id),{
    method:'PATCH',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({category,title,photos,expectedUpdateTime:album.updateTime}),
  });
  const data=await res.json();
  if(!res.ok)throw Error(data?.error??'갤러리 앨범 수정에 실패했습니다.');
  return data as {album:PhotoAlbum;cleanupPending:boolean};
}
export async function deleteGalleryAlbum(album:PhotoAlbum){
  if(!album.updateTime)throw Error('앨범의 수정 정보가 없습니다. 페이지를 새로고침해 주세요.');
  const token=await auth.currentUser?.getIdToken();
  if(!token)throw Error('로그인이 필요합니다.');
  const res=await fetch('/api/gallery/'+encodeURIComponent(album.id),{
    method:'DELETE',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({expectedUpdateTime:album.updateTime}),
  });
  const data=await res.json();
  if(!res.ok)throw Error(data?.error??'갤러리 앨범 삭제에 실패했습니다.');
  return data as {deleted:boolean;cleanupPending:boolean};
}
