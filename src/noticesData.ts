import {auth} from './firebase';
export type NoticeCategory='공지'|'행사'|'공연';
export type NoticeImage={kind:'image';url:string;name:string;width:number;height:number;ratioLocked:boolean;naturalWidth:number;naturalHeight:number};
export type NoticeBlock={kind:'text';text:string}|NoticeImage|{kind:'gallery';images:NoticeImage[]};
export type NoticePost={id:string;title:string;category:NoticeCategory;author:string;authorUid:string;publishedAt:string;date:string;description:string;body:string;images:string[];blocks:NoticeBlock[];updateTime:string};
export type NoticeInput={title:string;category:NoticeCategory;blocks:NoticeBlock[];expectedUpdateTime?:string};
async function request<T>(url:string,method='GET',body?:unknown):Promise<T>{
  const token=method!=='GET'?await auth.currentUser?.getIdToken():null;
  if(method!=='GET'&&!token)throw Error('로그인이 필요합니다.');
  const res=await fetch(url,{method,headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await res.json();
  if(!res.ok)throw Error(typeof data?.error==='string'?data.error:'공지사항 처리에 실패했습니다.');
  return data as T;
}
export type NoticePage={notices:NoticePost[];nextPageToken:string|null};
export const listNoticesPage=(pageToken:string|null=null)=>request<NoticePage>('/api/notices'+(pageToken?'?pageToken='+encodeURIComponent(pageToken):''));
export const listNotices=async()=> (await listNoticesPage()).notices;
export const getNotice=async(id:string)=>(await request<{notice:NoticePost}>('/api/notices/'+encodeURIComponent(id))).notice;
export const createNotice=async(input:NoticeInput)=>(await request<{notice:NoticePost}>('/api/notices','POST',input)).notice;
export const updateNotice=async(id:string,input:NoticeInput)=>(await request<{notice:NoticePost}>('/api/notices/'+encodeURIComponent(id),'PUT',input)).notice;
export const deleteNotice=(id:string,expectedUpdateTime:string)=>request<{deleted:boolean}>('/api/notices/'+encodeURIComponent(id),'DELETE',{expectedUpdateTime});
