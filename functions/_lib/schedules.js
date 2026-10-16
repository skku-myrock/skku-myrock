import {FIRESTORE_ROOT,docFields,reject,toFields,validateStudentId,validateUid} from './shared.js';
import {getFirestoreDocument,googleRequest,verifyFirebaseToken} from './google.js';

export const SCHEDULES=FIRESTORE_ROOT+'/schedules';
export const INVITATIONS=FIRESTORE_ROOT+'/scheduleInvitations';
export const THROTTLES=FIRESTORE_ROOT+'/scheduleInviteThrottles';
// Firestore REST endpoints use full HTTPS URLs, but commit Write.update.name
// and Write.delete require resource names ("projects/..."), not URLs.
const FIRESTORE_API_BASE='https://firestore.googleapis.com/v1/';
const DOCUMENT_RESOURCE=FIRESTORE_ROOT.slice(FIRESTORE_API_BASE.length)+'/';
export function firestoreResourceName(name){
 const resource=typeof name==='string'&&name.startsWith(FIRESTORE_API_BASE)
  ?name.slice(FIRESTORE_API_BASE.length):name;
 if(typeof resource!=='string'||!resource.startsWith(DOCUMENT_RESOURCE)||
  resource.length===DOCUMENT_RESOURCE.length)throw new Error('Firestore 문서 리소스 경로가 올바르지 않습니다.');
 return resource;
}
const ID_PATTERN=/^[A-Za-z0-9_-]{8,128}$/;
export const scheduleId=value=>{if(typeof value!=='string'||!ID_PATTERN.test(value))reject('시간표 ID가 올바르지 않습니다.');return value;};
export const inviteId=value=>{if(typeof value!=='string'||!ID_PATTERN.test(value))reject('초대 ID가 올바르지 않습니다.');return value;};
export const scheduleDoc=id=>SCHEDULES+'/'+encodeURIComponent(scheduleId(id));
export const participantDoc=(id,uid)=>scheduleDoc(id)+'/participants/'+encodeURIComponent(validateUid(uid));
export const invitationDoc=id=>INVITATIONS+'/'+encodeURIComponent(inviteId(id));
const err=(result,label)=>{
 if(result.status===409||result.status===412)reject('다른 곳에서 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.',409);
 throw new Error(label+' '+result.status);
};
export async function getDocument(env,name){
 const result=await googleRequest(env,name);
 if(result.status===404)return null;
 if(!result.ok)err(result,'Firestore document get');
 return result.data;
}
export async function getSchedule(env,id){const doc=await getDocument(env,scheduleDoc(id));if(!doc)reject('시간표를 찾지 못했습니다.',404);return doc;}
export async function callerProfile(request,env){
 const claims=await verifyFirebaseToken(request);
 const profile=await getFirestoreDocument(env,claims.sub);
 if(!profile)reject('등록된 회원만 사용할 수 있습니다.',403);
 return {uid:validateUid(claims.sub),name:String(docFields(profile).name??''),profile};
}
export const isParticipant=(schedule,uid)=>Array.isArray(schedule.participantUids)&&schedule.participantUids.includes(uid);
export const requireMember=(schedule,uid)=>{if(!isParticipant(schedule,uid))reject('시간표에 접근할 권한이 없습니다.',403);};
export const requireOwner=(schedule,uid)=>{if(schedule.createdBy!==uid)reject('시간표 관리자만 사용할 수 있습니다.',403);};
export function validateScheduleInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input))reject('시간표 입력값이 올바르지 않습니다.');
 const title=typeof input.title==='string'?input.title.trim():'';
 if(!title||title.length>100)reject('시간표 제목은 1~100자로 입력해 주세요.');
 const dates=input.dates;
 if(!Array.isArray(dates)||!dates.length||dates.length>366||dates.some(d=>{
  if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d))return true;
  const timestamp=Date.parse(d+'T00:00:00Z');
  return !Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==d;
 })||new Set(dates).size!==dates.length)reject('후보 날짜가 올바르지 않습니다.');
 if(!Number.isInteger(input.startHour)||!Number.isInteger(input.endHour)||
 input.startHour<0||input.endHour>24||input.startHour>=input.endHour)reject('시간 범위가 올바르지 않습니다.');
 return {title,dates:[...dates].sort(),startHour:input.startHour,endHour:input.endHour};
}
export function bitSize(schedule){
 const days=schedule.dates?.length??0,hours=Number(schedule.endHour)-Number(schedule.startHour);
 if(days<1||days>366||!Number.isInteger(hours)||hours<1||hours>24)throw new Error('Invalid schedule dimensions');
 return Math.ceil(days*hours*2/8);
}
export function emptyBits(schedule){return btoa(String.fromCharCode(...new Uint8Array(bitSize(schedule))));}
export function validBits(value,schedule){
 if(typeof value!=='string'||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))return false;
 try{
  const binary=atob(value),size=bitSize(schedule);
  if(binary.length!==size)return false;
  const active=schedule.dates.length*(Number(schedule.endHour)-Number(schedule.startHour))*2;
  const excess=size*8-active;
  return !excess||(binary.charCodeAt(size-1)&((1<<excess)-1))===0;
 }catch{return false;}
}
export const docData=doc=>({...docFields(doc),id:doc.name.split('/').pop(),updateTime:doc.updateTime??''});
export function fields(object){return toFields(object);}
export async function commit(env,writes){
 // Normalize all writes, including manually constructed bytesValue documents
 // and deletes, before calling the Google API.
 const normalized=writes.map(write=>({
  ...write,
  ...(write.update?{update:{...write.update,name:firestoreResourceName(write.update.name)}}:{}),
  ...(write.delete?{delete:firestoreResourceName(write.delete)}:{}),
 }));
 const result=await googleRequest(env,FIRESTORE_ROOT+':commit',{method:'POST',body:{writes:normalized}});
 if(!result.ok)err(result,'Firestore atomic commit');
 return result.data;
}
export async function queryBy(env,collection,field,op,value,limit=100){
 const result=await googleRequest(env,FIRESTORE_ROOT+':runQuery',{method:'POST',body:{
  structuredQuery:{from:[{collectionId:collection}],where:{fieldFilter:{field:{fieldPath:field},op,value:{stringValue:value}}},limit}
 }});
 if(!result.ok)err(result,'Firestore query');
 return (Array.isArray(result.data)?result.data:[]).map(item=>item.document).filter(Boolean);
}
export const toWrite=(name,object,precondition)=>({
 update:{name:firestoreResourceName(name),fields:fields(object)},...(precondition?{currentDocument:precondition}:{})
});
export function requireStudentId(body){return validateStudentId(body?.studentId);}
