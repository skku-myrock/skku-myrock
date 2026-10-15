import {reject} from './shared.js';
import {googleRequest} from './google.js';

export const PUBLIC_PAGE_SIZE=30;

/** Firestore listDocuments pagination, including a server-enforced response field mask. */
export async function firestorePage(env,collection,{request,fields,orderBy,limit=PUBLIC_PAGE_SIZE}){
  const url=new URL(request.url);
  const cursor=url.searchParams.get('pageToken')??'';
  if(cursor.length>4096||/[\r\n]/.test(cursor))reject('페이지 주소가 올바르지 않습니다.',400);
  const target=new URL(collection);
  target.searchParams.set('pageSize',String(limit));
  target.searchParams.set('orderBy',orderBy);
  for(const field of fields)target.searchParams.append('mask.fieldPaths',field);
  if(cursor)target.searchParams.set('pageToken',cursor);
  const response=await googleRequest(env,target.href);
  if(response.status===404)return {documents:[],nextPageToken:null};
  if(!response.ok)throw Error('Firestore 페이지 조회 실패 '+response.status);
  return {documents:response.data.documents??[],nextPageToken:response.data.nextPageToken??null};
}
