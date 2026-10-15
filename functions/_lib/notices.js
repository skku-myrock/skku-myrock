import {FIRESTORE_ROOT,docFields,toFields,reject} from './shared.js';
import {googleRequest} from './google.js';
import {firestorePage} from './firestorePages.js';

const ROOT=FIRESTORE_ROOT+'/notices';
const categories=new Set(['공지','공연','행사']);
const idRegex=/^[a-f0-9-]{36}$/;
const requireText=(s,max,label)=>{if(typeof s!=='string'||!s.trim()||s.length>max)reject(label+'을(를) 확인해 주세요.');return s.trim();};
const safeUrl=value=>{
  if(typeof value!=='string'||value.length>1600)reject('이미지 주소가 올바르지 않습니다.');
  if(/^\/api\/about\/image\?key=about\/[a-f0-9-]{36}$/.test(value))return value;
  let parsed;try{parsed=new URL(value);}catch{reject('이미지 URL이 올바르지 않습니다.');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password)reject('HTTPS 이미지 URL만 사용할 수 있습니다.');
  return value;
};
const dimension=value=>{const n=Number(value);if(!Number.isInteger(n)||n<0||n>6000)reject('이미지 크기가 올바르지 않습니다.');return String(n);};
function normalizeImage(image){
  if(!image||typeof image!=='object')reject('이미지 정보가 올바르지 않습니다.');
  return {kind:'image',url:safeUrl(image.url),name:typeof image.name==='string'?image.name.slice(0,150):'',width:dimension(image.width??0),height:dimension(image.height??0),ratioLocked:image.ratioLocked!==false,naturalWidth:dimension(image.naturalWidth??0),naturalHeight:dimension(image.naturalHeight??0)};
}
export function validateNotice(input){
  if(!input||typeof input!=='object'||Array.isArray(input))reject('공지사항 정보가 올바르지 않습니다.');
  const title=requireText(input.title,150,'제목');
  if(!categories.has(input.category))reject('공지사항 분류가 올바르지 않습니다.');
  if(!Array.isArray(input.blocks)||!input.blocks.length||input.blocks.length>80)reject('본문 블록은 1~80개까지 등록할 수 있습니다.');
  const blocks=input.blocks.map(block=>{
    if(block?.kind==='text'){if(typeof block.text!=='string'||block.text.length>20000)reject('본문은 블록당 20,000자 이하로 작성해 주세요.');return {kind:'text',text:block.text};}
    if(block?.kind==='image')return normalizeImage(block);
    if(block?.kind==='gallery'){if(!Array.isArray(block.images)||!block.images.length||block.images.length>20)reject('슬라이드는 1~20장까지 가능합니다.');return {kind:'gallery',images:block.images.map(normalizeImage)};}
    reject('알 수 없는 본문 블록이 있습니다.');
  });
  if(!blocks.some(block=>block.kind==='text'&&block.text.trim()||block.kind!=='text'))reject('공지사항 내용을 입력해 주세요.');
  if(JSON.stringify(blocks).length>450000)reject('공지사항 내용이 너무 큽니다.');
  return {title,category:input.category,blocks};
}
const summarize=(data)=>{
  const text=data.blocks.filter(b=>b.kind==='text').map(b=>b.text).join('\n').trim();
  const images=data.blocks.flatMap(b=>b.kind==='image'?[b.url]:b.kind==='gallery'?b.images.map(x=>x.url):[]);
  return {body:text,description:text.replace(/\s+/g,' ').slice(0,160),images};
};
export function noticeFromDoc(doc){
  const d=docFields(doc);const id=doc.name.split('/').pop();
  const publishedAt=String(d.publishedAt??'');
  return {...d,id,publishedAt,date:publishedAt.slice(0,10).replace(/-/g,'. ')+'.',updateTime:doc.updateTime??'',blocks:Array.isArray(d.blocks)?d.blocks:[]};
}
export async function listNotices(env){
  const items=[];let pageToken='';
  for(let page=0;page<10;page++){
    const url=new URL(ROOT);url.searchParams.set('pageSize','100');
    if(pageToken)url.searchParams.set('pageToken',pageToken);
    const response=await googleRequest(env,url.toString());
    if(response.status===404)break;
    if(!response.ok)throw Error('공지사항 목록 조회 실패 '+response.status);
    items.push(...(response.data.documents??[]).map(noticeFromDoc));
    pageToken=response.data.nextPageToken??'';if(!pageToken)break;
  }
  return items.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
}
/** Public list: only metadata and searchable text, never image blocks or serialized galleries. */
export async function listNoticeSummariesPage(env,request){
  const {documents,nextPageToken}=await firestorePage(env,ROOT,{
    request,orderBy:'publishedAt desc',
    fields:['title','category','author','publishedAt','description']
  });
  return {notices:documents.map(noticeFromDoc),nextPageToken};
}
export async function getNotice(env,id){
  if(!idRegex.test(id))reject('잘못된 공지사항 주소입니다.',404);
  const response=await googleRequest(env,ROOT+'/'+id);
  if(response.status===404)reject('공지사항을 찾을 수 없습니다.',404);
  if(!response.ok)throw Error('공지사항 조회 실패 '+response.status);
  return noticeFromDoc(response.data);
}
export async function createNotice(env,input,caller){
  const data=validateNotice(input),id=crypto.randomUUID(),now=new Date().toISOString();
  const name=docFields(caller.profile).name||'운영진';
  const body={...data,...summarize(data),author:String(name).slice(0,60),authorUid:caller.uid,publishedAt:now};
  const url=new URL(ROOT+'/'+id);url.searchParams.set('currentDocument.exists','false');
  const response=await googleRequest(env,url.toString(),{method:'PATCH',body:{fields:toFields(body)}});
  if(!response.ok)throw Error('공지사항 발행 실패 '+response.status);
  return noticeFromDoc(response.data);
}
export async function updateNotice(env,id,input){
  const old=await getNotice(env,id);
  if(typeof input?.expectedUpdateTime!=='string'||input.expectedUpdateTime!==old.updateTime)reject('다른 운영진이 수정했습니다. 새로고침 후 다시 시도해 주세요.',409);
  const data=validateNotice(input),body={...data,...summarize(data),author:old.author,authorUid:old.authorUid,publishedAt:old.publishedAt};
  const url=new URL(ROOT+'/'+id);url.searchParams.set('currentDocument.updateTime',old.updateTime);
  const response=await googleRequest(env,url.toString(),{method:'PATCH',body:{fields:toFields(body)}});
  if([409,412].includes(response.status))reject('공지사항이 변경되었습니다. 새로고침 후 다시 시도해 주세요.',409);
  if(!response.ok)throw Error('공지사항 수정 실패 '+response.status);
  return noticeFromDoc(response.data);
}
export async function deleteNotice(env,id,expectedUpdateTime){
  const old=await getNotice(env,id);
  if(typeof expectedUpdateTime!=='string'||expectedUpdateTime!==old.updateTime)reject('공지사항이 변경되었습니다. 새로고침 후 다시 시도해 주세요.',409);
  const url=new URL(ROOT+'/'+id);url.searchParams.set('currentDocument.updateTime',old.updateTime);
  const response=await googleRequest(env,url.toString(),{method:'DELETE'});
  if([409,412].includes(response.status))reject('공지사항이 변경되었습니다. 새로고침 후 다시 시도해 주세요.',409);
  if(!response.ok)throw Error('공지사항 삭제 실패 '+response.status);
  return {deleted:true};
}
