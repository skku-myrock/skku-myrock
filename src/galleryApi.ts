import {auth} from './firebase';
import type {PhotoAlbum,PhotoCategory} from './galleryData';
export async function listGalleryAlbums():Promise<PhotoAlbum[]>{
  const response=await fetch('/api/gallery/albums');
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
