import {auth} from './firebase';
import {prepareImageForUpload,MAX_UPLOAD_IMAGE_BYTES} from './imageCompression';
export async function uploadImagesBatch(files:File[],folder:'site'|'notices'|'gallery'='site'):Promise<string[]>{
  if(!files.length)return [];
  const token=await auth.currentUser?.getIdToken();
  if(!token)throw Error('로그인이 필요합니다.');
  const urls:string[]=[];
  let batch:File[]=[],bytes=0;
  const flush=async()=>{
    if(!batch.length)return;
    const body=new FormData();body.append('folder',folder);batch.forEach(file=>body.append('images',file));
    const response=await fetch('/api/images/batch',{method:'POST',headers:{authorization:'Bearer '+token},body});
    const data=await response.json();
    if(!response.ok)throw Error(typeof data?.error==='string'?data.error:'사진 저장에 실패했습니다.');
    urls.push(...(data.urls as string[]));batch=[];bytes=0;
  };
  for(const original of files){
    // Selection/preview remains local; compress only when saving the draft.
    const file=await prepareImageForUpload(original);
    if(file.size>MAX_UPLOAD_IMAGE_BYTES)throw Error('압축한 사진은 5MB 이하여야 합니다.');
    if(batch.length>=12||bytes+file.size>16000000)await flush();
    batch.push(file);bytes+=file.size;
  }
  await flush();return urls;
}
