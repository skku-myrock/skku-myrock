import {auth} from './firebase';
export async function uploadImagesBatch(files:File[]):Promise<string[]>{
  if(!files.length)return [];
  const token=await auth.currentUser?.getIdToken();
  if(!token)throw Error('로그인이 필요합니다.');
  const urls:string[]=[];
  let batch:File[]=[],bytes=0;
  const flush=async()=>{
    if(!batch.length)return;
    const body=new FormData();batch.forEach(file=>body.append('images',file));
    const response=await fetch('/api/images/batch',{method:'POST',headers:{authorization:'Bearer '+token},body});
    const data=await response.json();
    if(!response.ok)throw Error(typeof data?.error==='string'?data.error:'사진 저장에 실패했습니다.');
    urls.push(...(data.urls as string[]));batch=[];bytes=0;
  };
  for(const file of files){
    if(file.size>5000000||file.size===0||!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw Error('사진은 JPG, PNG, WebP, GIF 형식의 5MB 이하만 가능합니다.');
    if(batch.length>=12||bytes+file.size>16000000)await flush();
    batch.push(file);bytes+=file.size;
  }
  await flush();return urls;
}
