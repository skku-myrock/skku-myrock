import {FIRESTORE_ROOT,docFields,reject} from './shared.js';
import {getFirestoreDocument,verifyFirebaseToken} from './google.js';
import {commit,getDocument,toWrite} from './schedules.js';

const NOTES=FIRESTORE_ROOT+'/handoverNotes';
const ROLE_LABELS={part_leader:'파트장',staff:'실무단',president:'회장단'};
const encoder=new TextEncoder();
function scopeId(kind,position){
 if(kind==='common')return 'common';
 const data=encoder.encode(position),base64=btoa(String.fromCharCode(...data)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 return 'role_'+base64;
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
 return {uid:claims.sub,positions};
}
export function notePath(caller,kind,position){
 if(kind!=='role'&&kind!=='common')reject('인수인계 종류가 올바르지 않습니다.');
 if(kind==='role'&&(!position||!caller.positions.includes(position)))reject('본인의 직책에 해당하는 인수인계만 수정하거나 열람할 수 있습니다.',403);
 return NOTES+'/'+scopeId(kind,kind==='common'?'':position);
}
export async function readNote(env,name){
 const doc=await getDocument(env,name);
 return {content:docFields(doc).content??'',updateTime:doc?.updateTime??'',doc};
}
export async function saveNote(env,name,content,expectedUpdateTime,uid){
 if(typeof content!=='string'||content.length>30000)reject('인수인계 내용은 30,000자까지 작성할 수 있습니다.');
 if(typeof expectedUpdateTime!=='string')reject('저장 기준 정보가 올바르지 않습니다.');
 const current=await readNote(env,name);
 if(current.updateTime!==expectedUpdateTime)reject('다른 운영진이 내용을 변경했습니다. 새로고침 후 다시 시도해 주세요.',409);
 if(current.content===content)return {updateTime:current.updateTime};
 await commit(env,[toWrite(name,{
  content,updatedAt:new Date().toISOString(),updatedBy:uid,
 },current.doc?{updateTime:current.doc.updateTime}:{exists:false})]);
 // We return the actual version from Firestore, not a predicted timestamp.
 const saved=await readNote(env,name);
 return {updateTime:saved.updateTime};
}
