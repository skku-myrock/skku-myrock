import {FIRESTORE_ROOT,docFields,reject,validateUid} from './shared.js';
import {getFirestoreDocument,googleRequest,verifyFirebaseToken} from './google.js';
import {commit,getDocument,toWrite} from './schedules.js';

// Notes belong to their author, not to the current holder of a position.
// Historical notes remain available after positions and office-holders change.
const NOTES=FIRESTORE_ROOT+'/handoverNotes';
const ROLE_LABELS={part_leader:'파트장',staff:'실무단',president:'회장단'};
const encoder=new TextEncoder();
function encodedPosition(position){
 const data=encoder.encode(position);
 return btoa(String.fromCharCode(...data)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
function checkedPosition(kind,position){
 if(kind!=='role'&&kind!=='common')reject('인수인계 종류가 올바르지 않습니다.');
 if(kind==='role'&&(typeof position!=='string'||!position.trim()||position.length>40))
  reject('인수인계 직책이 올바르지 않습니다.');
 return kind==='role'?position.trim():'';
}
export async function handoverCaller(request,env){
 const claims=await verifyFirebaseToken(request);
 const profile=await getFirestoreDocument(env,claims.sub);
 if(!profile)reject('등록된 회원만 사용할 수 있습니다.',403);
 const data=docFields(profile),role=data.role;
 const permitted=['part_leader','staff','president'].includes(role)||data.handoverAccess===true||(claims.superadmin===true&&data.superadmin===true);
 if(!permitted)reject('인수인계 접근 권한이 없습니다.',403);
 const positions=[...new Set((Array.isArray(data.positions)?data.positions:[])
  .filter(x=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=40).map(x=>x.trim()))];
 if(positions.length===0&&ROLE_LABELS[role])positions.push(ROLE_LABELS[role]);
 return {uid:claims.sub,positions,name:String(data.name??''),generation:String(data.generation??'')};
}
export function notePath(caller,kind,position,{authorUid=caller.uid,writing=false}={}){
 const normalized=checkedPosition(kind,position);
 const author=validateUid(authorUid);
 if(writing){
  if(author!==caller.uid)reject('다른 사람의 인수인계는 수정할 수 없습니다.',403);
  if(kind==='role'&&!caller.positions.includes(normalized))
   reject('본인의 직책에 해당하는 인수인계만 작성할 수 있습니다.',403);
 }
 return NOTES+'/'+(kind==='common'?'common_':'role_')+author+(kind==='role'?'_'+encodedPosition(normalized):'');
}
function legacyPath(kind,position){
 return NOTES+'/'+(kind==='common'?'common':'role_'+encodedPosition(position));
}
export async function readNote(env,name,{kind,position,authorUid}={}){
 const doc=await getDocument(env,name);
 if(doc){
  const data=docFields(doc);
  return {content:String(data.content??''),updateTime:doc.updateTime??'',doc};
 }
 // Migration-free compatibility for documents saved before notes were per-author.
 // Only the legacy document's actual writer may inherit that content.
 if(kind&&authorUid){
  const legacy=await getDocument(env,legacyPath(kind,position));
  const data=docFields(legacy);
  if(data.updatedBy===authorUid&&typeof data.content==='string')
   return {content:data.content,updateTime:'',doc:null};
 }
 return {content:'',updateTime:'',doc:null};
}
export async function saveNote(env,name,content,expectedUpdateTime,caller,kind,position){
 if(typeof content!=='string'||content.length>30000)reject('인수인계 내용은 30,000자까지 작성할 수 있습니다.');
 if(typeof expectedUpdateTime!=='string')reject('저장 기준 정보가 올바르지 않습니다.');
 const current=await readNote(env,name,{kind,position,authorUid:caller.uid});
 if(current.updateTime!==expectedUpdateTime)reject('인수인계가 변경되었습니다. 새로고침 후 다시 시도해 주세요.',409);
 if(current.content===content)return {updateTime:current.updateTime};
 await commit(env,[toWrite(name,{
  content,authorUid:caller.uid,authorName:caller.name,generation:caller.generation,
  positions:caller.positions,kind,position:kind==='role'?position:'',
  updatedAt:new Date().toISOString(),updatedBy:caller.uid,
 },current.doc?{updateTime:current.doc.updateTime}:{exists:false})]);
 const saved=await readNote(env,name,{kind,position,authorUid:caller.uid});
 return {updateTime:saved.updateTime};
}


// Build the archive from persisted notes only. Do not return private body text
// with list responses: a separate authenticated read is required per document.
function generationValue(generation){
 const match=String(generation??'').trim().match(/^(\d+(?:\.\d+)?)(?:기)?$/);
 return match?Number(match[1]):-Infinity;
}
function legacyRoleFromId(id){
 if(!id.startsWith('role_'))return '';
 try{
  const encoded=id.slice(5).replaceAll('-','+').replaceAll('_','/');
  const decoded=Uint8Array.from(atob(encoded),letter=>letter.charCodeAt(0));
  return new TextDecoder().decode(decoded);
 }catch{return '';}
}
async function listAllNoteDocuments(env){
 const documents=[];
 let token='';
 for(let page=0;page<100;page++){
  const url=new URL(NOTES);
  url.searchParams.set('pageSize','100');
  for(const field of ['content','kind','position','authorUid','updatedBy','authorName','generation','positions','updatedAt'])
   url.searchParams.append('mask.fieldPaths',field);
  if(token)url.searchParams.set('pageToken',token);
  const response=await googleRequest(env,url.toString());
  if(response.status===404)return documents;
  if(!response.ok)throw Error('인수인계 목록 조회 실패 '+response.status);
  documents.push(...(response.data.documents??[]));
  token=response.data.nextPageToken??'';
  if(!token)return documents;
 }
 throw Error('인수인계 목록이 너무 많습니다. 관리자에게 문의해 주세요.');
}
export async function listHandoverArchive(env){
 const documents=await listAllNoteDocuments(env);
 const authors=new Map();
 for(const document of documents){
  const data=docFields(document);
  if(typeof data.content!=='string'||!data.content.trim())continue;
  const id=document.name?.split('/').pop()??'';
  const legacy=id==='common'||(id.startsWith('role_')&&!data.authorUid);
  const kind=data.kind==='role'||data.kind==='common'?data.kind:legacy?(id==='common'?'common':'role'):null;
  const position=kind==='role'?(typeof data.position==='string'&&data.position.trim()?data.position.trim():legacyRoleFromId(id)):'';
  const authorUid=typeof data.authorUid==='string'?data.authorUid:data.updatedBy;
  if(!kind||!authorUid||!(/^[A-Za-z0-9_-]{10,128}$/.test(authorUid))||(kind==='role'&&!position))continue;
  const timestamp=typeof data.updatedAt==='string'?data.updatedAt:'';
  let author=authors.get(authorUid);
  if(!author){
   author={uid:authorUid,name:'',generation:'',positions:new Set(),notes:new Map(),metadataTime:''};
   authors.set(authorUid,author);
  }
  const generation=typeof data.generation==='string'?data.generation:'';
  if(data.authorName&&(!author.name||timestamp>=author.metadataTime))author.name=String(data.authorName);
  if(generation&&(generationValue(generation)>generationValue(author.generation)||!author.generation))author.generation=generation;
  if(timestamp>=author.metadataTime)author.metadataTime=timestamp;
  const savedPositions=Array.isArray(data.positions)?data.positions.filter(p=>typeof p==='string'&&p.trim()):[];
  for(const saved of savedPositions)author.positions.add(saved);
  if(kind==='role')author.positions.add(position);
  const key=kind+'|'+position;
  const old=author.notes.get(key);
  if(!old||old.legacy&&!legacy)
   author.notes.set(key,{kind,position,legacy});
 }
 // Old global-by-role documents do not contain author metadata. Resolve only
 // those authors from their Firestore profiles without exposing user directory data.
 await Promise.all([...authors.values()].filter(a=>!a.name||!a.generation).map(async a=>{
  const profile=await getFirestoreDocument(env,a.uid);
  if(!profile)return;
  const fields=docFields(profile);
  if(!a.name)a.name=String(fields.name??'');
  if(!a.generation)a.generation=String(fields.generation??'');
 }));
 return [...authors.values()].map(author=>({
  uid:author.uid,name:author.name||'이름 미확인',
  generation:author.generation,positions:[...author.positions],
  notes:[...author.notes.values()].map(({kind,position})=>({kind,position}))
    .sort((a,b)=>a.kind===b.kind?a.position.localeCompare(b.position,'ko'):a.kind==='role'?-1:1),
 })).sort((a,b)=>
  generationValue(b.generation)-generationValue(a.generation)
  ||a.name.localeCompare(b.name,'ko')||a.uid.localeCompare(b.uid));
}
