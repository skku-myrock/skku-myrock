import {FIRESTORE_ROOT,canPerform,docFields,reject,textField,toFields} from './shared.js';
import {getFirestoreDocument,googleRequest,verifyFirebaseToken} from './google.js';
import {commit,firestoreResourceName,getDocument} from './schedules.js';

// Each piece of equipment is a single compare-and-swap Firestore document.
// The FIFO queue and current loan change atomically, so a competing approval
// or cancellation cannot jump ahead or approve two borrowers.
export const EQUIPMENT_ROOT=FIRESTORE_ROOT+'/equipment';
export const DEFAULT_EQUIPMENT=[
 {id:'demo-guitar',name:'기타',product:'바커스 BST-2-RSM'},
 {id:'demo-mic',name:'마이크',product:'슈어 SM98'},
 {id:'demo-di',name:'DI 박스',product:'래디얼 ProDI'},
 {id:'demo-stand',name:'마이크 스탠드',product:'K&M 210/9'},
];
const defaultMap=new Map(DEFAULT_EQUIPMENT.map(item=>[item.id,item]));
const ID=/^[A-Za-z0-9_-]{8,128}$/;
export function equipmentId(value){
 if(typeof value!=='string'||!ID.test(value))reject('장비 식별자가 올바르지 않습니다.');
 return value;
}
export const equipmentDoc=id=>EQUIPMENT_ROOT+'/'+encodeURIComponent(equipmentId(id));
export const defaultItem=id=>defaultMap.get(id)?{
 ...defaultMap.get(id),queue:[],borrower:null,returnRequestedAt:null,archived:false,
}:null;
export async function readEquipment(env,id){
 const doc=await getDocument(env,equipmentDoc(id));
 if(doc)return {item:{...docFields(doc),id},doc};
 const fallback=defaultItem(id);
 if(!fallback)reject('장비를 찾지 못했습니다.',404);
 return {item:fallback,doc:null};
}
export function normalize(item){
 return {
  id:item.id,
  name:typeof item.name==='string'?item.name:'',
  product:typeof item.product==='string'?item.product:'',
  queue:Array.isArray(item.queue)?item.queue:[],
  borrower:item.borrower&&typeof item.borrower==='object'&&typeof item.borrower.uid==='string'?item.borrower:null,
  returnRequestedAt:typeof item.returnRequestedAt==='string'?item.returnRequestedAt:'',
  archived:item.archived===true,
 };
}
export function statusOf(raw){
 const item=normalize(raw);
 if(item.borrower)return item.returnRequestedAt?'반납 확인중':'대여중';
 return item.queue.length?'대여 승인 대기중':'대여 가능';
}
export async function listEquipment(env){
 const docs=[];
 let cursor='';
 for(let page=0;page<10;page++){
  const uri=new URL(EQUIPMENT_ROOT);
  uri.searchParams.set('pageSize','100');
  if(cursor)uri.searchParams.set('pageToken',cursor);
  const result=await googleRequest(env,uri.toString());
  if(result.status===404)break;
  if(!result.ok)throw new Error('장비 목록 조회 실패 '+result.status);
  docs.push(...(result.data.documents??[]));
  cursor=result.data.nextPageToken??'';
  if(!cursor)break;
  if(page===9)throw new Error('장비 목록이 너무 많습니다.');
 }
 const items=new Map(DEFAULT_EQUIPMENT.map(value=>[value.id,defaultItem(value.id)]));
 for(const doc of docs){
  const id=doc.name?.split('/').pop();
  if(id&&ID.test(id))items.set(id,{...docFields(doc),id});
 }
 return [...items.values()].map(normalize).filter(item=>!item.archived);
}
export function renderItem(raw,caller,manager=false){
 const item=normalize(raw),mine=caller?.uid??'';
 const position=item.queue.findIndex(q=>q.uid===mine);
 return {
  id:item.id,name:item.name,product:item.product,status:statusOf(item),
  queueLength:item.queue.length,
  myPosition:position<0?null:position+1,
  isBorrower:Boolean(mine&&item.borrower?.uid===mine),
  ...(manager?{
   queue:item.queue.map(({uid,name,studentId,requestedAt})=>({uid,name,studentId,requestedAt})),
   borrower:item.borrower,
   returnRequestedAt:item.returnRequestedAt||null,
  }:{})
 };
}
export async function callerForEquipment(request,env,{required=false,manager=false}={}){
 if(manager){
  const claims=await verifyFirebaseToken(request);
  const profile=await getFirestoreDocument(env,claims.sub);
  if(!profile)reject('등록된 부원만 사용할 수 있습니다.',403);
  const data=docFields(profile),caller={uid:claims.sub,role:data.role,superadmin:claims.superadmin===true&&data.superadmin===true};
  if(!canPerform(caller,'part_leader'))reject('장비 관리 권한이 없습니다.',403);
  return {...caller,name:String(data.name??''),studentId:String(data.studentId??'')};
 }
 if(!request.headers.get('authorization')){
  if(required)reject('장비 대여 신청은 로그인한 부원만 가능합니다.',401);
  return null;
 }
 const claims=await verifyFirebaseToken(request);
 const profile=await getFirestoreDocument(env,claims.sub);
 if(!profile)reject('등록된 부원만 사용할 수 있습니다.',403);
 const data=docFields(profile);
 if(!/^\d{10}$/.test(String(data.studentId??'')))reject('회원 학번을 확인할 수 없습니다.',403);
 return {uid:claims.sub,name:String(data.name??''),studentId:String(data.studentId)};
}
export const itemWrite=(item,doc)=>({
 update:{name:firestoreResourceName(equipmentDoc(item.id)),fields:toFields({
  name:item.name,product:item.product,queue:item.queue,borrower:item.borrower??{},
  returnRequestedAt:item.returnRequestedAt||'',archived:item.archived===true,
 })},
 currentDocument:doc?{updateTime:doc.updateTime}:{exists:false}
});
// Firestore document format cannot encode null through toFields: empty
// borrower object represents no current loan. normalize() handles that case.
export function resolvedItem(raw){
 const item=normalize(raw);
 if(item.borrower&&!item.borrower.uid)item.borrower=null;
 return item;
}
export async function mutateEquipment(env,id,change,{retry=3}={}){
 for(let attempt=0;attempt<retry;attempt++){
  const {item:raw,doc}=await readEquipment(env,id);
  const item=resolvedItem(raw);
  if(item.archived)reject('삭제된 장비입니다.',404);
  const next=change(item);
  try{await commit(env,[itemWrite(next,doc)]);return next;}
  catch(err){if(err?.status===409&&attempt<retry-1)continue;throw err;}
 }
 throw new Error('장비 정보가 여러 번 변경되어 처리하지 못했습니다.');
}
export const validateEquipmentName=value=>textField(value,'장비 이름',60);
export const validateProduct=value=>textField(value,'제품명',100);
