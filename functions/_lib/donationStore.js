import { FIRESTORE_ROOT, docFields, reject, toFields } from './shared.js';
import { googleRequest } from './google.js';
import { donationFields, normalizeDonation } from './donations.js';
import {firestorePage} from './firestorePages.js';

export const LEDGER = FIRESTORE_ROOT + '/donations';
export const ANONYMOUS_DOC = FIRESTORE_ROOT + '/financeSettings/anonymousDonors';

export async function loadLedger(env) {
  const records = [];
  let cursor = null;
  const cursors = new Set();
  for (let i = 0; i < 40; i++) {
    const uri = new URL(LEDGER);
    uri.searchParams.set('pageSize','100');
    if (cursor) uri.searchParams.set('pageToken',cursor);
    const response = await googleRequest(env, uri.toString());
    if (!response.ok) throw Error('후원 기록 조회 실패: ' + response.status);
    for (const doc of response.data.documents ?? []) {
      records.push({ id: String(doc.name).split('/').pop(), ...normalizeDonation(docFields(doc)),
        updateTime: doc.updateTime ?? '' });
    }
    cursor = response.data.nextPageToken ?? null;
    if (!cursor) return records.sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    if (cursors.has(cursor)) reject('후원 데이터 목록 조회를 완료하지 못했습니다.',503);
    cursors.add(cursor);
  }
  reject('후원 기록이 너무 많아 조회하지 못했습니다. 관리자에게 문의해 주세요.',503);
}
/** Member view: Firestore's studentId index filters before documents are read. */
export async function loadDonationsByStudentId(env,studentId){
  if(!/^\d{10}$/.test(studentId))reject('본인 학번을 확인할 수 없습니다.',403);
  const result=await googleRequest(env,FIRESTORE_ROOT+':runQuery',{
    method:'POST',
    body:{structuredQuery:{
      from:[{collectionId:'donations'}],
      where:{fieldFilter:{field:{fieldPath:'studentId'},op:'EQUAL',value:{stringValue:studentId}}},
      select:{fields:[{fieldPath:'date'},{fieldPath:'amount'}]}
    }}
  });
  if(!result.ok)throw Error('본인 후원 기록 조회 실패: '+result.status);
  if(!Array.isArray(result.data))throw Error('후원 쿼리 응답 형식 오류');
  return result.data.filter(item=>item.document).map(item=>{
    const doc=item.document,d=docFields(doc);
    return {id:doc.name.split('/').pop(),date:String(d.date??''),amount:String(d.amount??'0')};
  }).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}

/** Public list: only limited visible rows, never expose private studentId fields. */
export async function loadPublicDonationPage(env,request){
  const {documents,nextPageToken}=await firestorePage(env,LEDGER,{
    request,orderBy:'date desc',fields:['date','donorName','studentId','amount','anonymous']
  });
  return {records:documents.map(doc=>({
    id:doc.name.split('/').pop(),...normalizeDonation(docFields(doc))
  })),nextPageToken};
}

export async function loadAnonymous(env) {
  const response = await googleRequest(env, ANONYMOUS_DOC);
  if (response.status === 404) return { people:[], updateTime:null };
  if (!response.ok) throw Error('익명자 명단 조회 실패: ' + response.status);
  const data = docFields(response.data);
  return { people: Array.isArray(data.people) ? data.people : [], updateTime: response.data.updateTime ?? null };
}
export async function writeLedgerEntry(env, record, id, expectedUpdateTime) {
  const normalized = normalizeDonation(record);
  const documentId = id || crypto.randomUUID();
  if (!/^[a-f0-9-]{36}$/.test(documentId)) reject('후원 기록 ID가 올바르지 않습니다.');
  const url = new URL(LEDGER + '/' + documentId);
  if (id) {
    if (!expectedUpdateTime) reject('수정 전 내역을 새로고침해 주세요.',409);
    url.searchParams.set('currentDocument.updateTime',expectedUpdateTime);
  } else url.searchParams.set('currentDocument.exists','false');
  const response = await googleRequest(env,url.toString(),{
    method:'PATCH',body:{ fields:toFields(donationFields(normalized)) },
  });
  if ([409,412].includes(response.status)) reject('다른 관리자가 변경했습니다. 새로고침 후 다시 시도해 주세요.',409);
  if (!response.ok) throw Error('후원 내역 저장 실패: ' + response.status);
  return { id:documentId,...normalized,updateTime:response.data.updateTime ?? '' };
}
export async function appendLedgerBatch(env, rows) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 40) reject('CSV는 한 번에 최대 40건씩 등록할 수 있습니다.');
  const writes = rows.map(raw => {
    const row = normalizeDonation(raw);
    return {update:{name:LEDGER.replace('https://firestore.googleapis.com/v1/','') + '/' + crypto.randomUUID(),fields:toFields(donationFields(row))},
      currentDocument:{exists:false}};
  });
  const response = await googleRequest(env,FIRESTORE_ROOT + ':commit',{method:'POST',body:{writes}});
  if (!response.ok) throw Error('후원 CSV 저장 실패: ' + response.status);
  return rows.length;
}
export async function saveAnonymous(env,people,expectedUpdateTime) {
  const url=new URL(ANONYMOUS_DOC);
  if (expectedUpdateTime) url.searchParams.set('currentDocument.updateTime',expectedUpdateTime);
  else url.searchParams.set('currentDocument.exists','false');
  const response=await googleRequest(env,url.toString(),{method:'PATCH',body:{fields:toFields({people})}});
  if ([409,412].includes(response.status)) reject('다른 관리자가 변경했습니다. 새로고침 후 다시 시도해 주세요.',409);
  if (!response.ok) throw Error('익명자 명단 저장 실패: ' + response.status);
  return response.data.updateTime ?? '';
}
