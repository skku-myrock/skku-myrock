import {auth} from './firebase';
export type HandoverNote={content:string;updateTime:string;positions:string[]};
export type HandoverIdentity={positions:string[];name:string;generation:string};

async function request<T>(kind?:'role'|'common',position='',body?:unknown,authorUid=''):Promise<T>{
 const current=auth.currentUser;
 if(!current)throw new Error('로그인이 필요합니다.');
 const token=await current.getIdToken();
 const query=kind?'?kind='+kind+(kind==='role'?'&position='+encodeURIComponent(position):'')+(authorUid?'&authorUid='+encodeURIComponent(authorUid):''):'';
 const response=await fetch('/api/handover-notes'+query,{
  method:body===undefined?'GET':'POST',
  headers:{authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
 });
 const data=await response.json().catch(()=>({error:'서버 응답을 확인할 수 없습니다.'}));
 if(!response.ok)throw new Error(data.error||'인수인계 요청에 실패했습니다.');
 return data as T;
}
export const getHandoverPositions=()=>request<HandoverIdentity>();
export const getHandoverNote=(kind:'role'|'common',position='',authorUid='')=>request<HandoverNote>(kind,position,undefined,authorUid);
export const saveHandoverNote=(kind:'role'|'common',position:string,content:string,expectedUpdateTime:string)=>
 request<{success:boolean;updateTime:string}>(kind,position,{kind,position,content,expectedUpdateTime});

export type HandoverArchiveEntry={
 uid:string;name:string;generation:string;positions:string[];
 notes:{kind:'role'|'common';position:string}[];
};
export const getHandoverArchive=async():Promise<HandoverArchiveEntry[]>=>{
 const current=auth.currentUser;
 if(!current)throw new Error('로그인이 필요합니다.');
 const token=await current.getIdToken();
 const response=await fetch('/api/handover-notes/archive',{
  headers:{authorization:'Bearer '+token},
  cache:'no-store',
 });
 const data=await response.json().catch(()=>({error:'인수인계 목록을 불러오지 못했습니다.'}));
 if(!response.ok)throw new Error(data.error||'인수인계 목록을 불러오지 못했습니다.');
 return data.entries as HandoverArchiveEntry[];
};
