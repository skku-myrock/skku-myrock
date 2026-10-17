import {auth} from './firebase';
async function request<T>(path:string,confirmation:string,extra:Record<string,unknown>={}):Promise<T>{
  const token=await auth.currentUser?.getIdToken();
  if(!token)throw Error('로그인이 필요합니다.');
  const response=await fetch(path,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({confirmation,...extra})});
  const data=await response.json();
  if(!response.ok)throw Error(typeof data.error==='string'?data.error:'초기화 요청에 실패했습니다.');
  return data as T;
}
export const purgeNotices=()=>request<{deleted:number;done:boolean;imagesCleared?:boolean;commit?:string|null}>('/api/notices/purge','공지사항 초기화');
export const resetClubIntroduction=()=>request<{reset:boolean}>('/api/about/reset','모여락 소개 초기화');

export const resetSiteAssets=()=>request<{reset:boolean;changed:boolean;commit:string|null}>('/api/images/reset','에셋 초기화');
export const purgeGallery=()=>request<{deleted:number;done:boolean;imagesCleared:boolean;commit?:string|null}>('/api/gallery/purge','갤러리 초기화');

export const purgeSchedules=()=>request<{deleted:number;done:boolean;stage:string}>('/api/schedules/purge','활동 초기화');
export const resetEquipmentLoans=()=>request<{updated:number;done:boolean}>('/api/equipment/reset','활동 초기화');

export type DummyStage='gallery'|'notices'|'donations'|'expenses';
export const generateDummyBatch=(stage:DummyStage,start:number)=>request<{stage:DummyStage;processed:number;next:number;done:boolean;total:number}>('/api/admin/dummy','더미 데이터 생성',{stage,start});
