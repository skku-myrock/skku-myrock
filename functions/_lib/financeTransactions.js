import { FIRESTORE_ROOT, docFields, reject, toFields } from './shared.js';
import { googleRequest } from './google.js';
import {firestorePage} from './firestorePages.js';

export const EXPENSES = FIRESTORE_ROOT + '/expenseTransactions';
export const ACCOUNT = FIRESTORE_ROOT + '/financeSettings/donationAccount';
export const DEFAULT_ACCOUNT = Object.freeze({ bank: '농협', number: '302-0000-0000-31', holder: '나재원' });

export function normalizeAccount(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) reject('후원 계좌 입력값을 확인해 주세요.');
  const bank = String(input.bank ?? '').trim();
  const number = String(input.number ?? '').trim();
  const holder = String(input.holder ?? '').trim();
  if (!bank || bank.length > 35 || !/^[0-9-]{7,35}$/.test(number) ||
      !holder || holder.length > 70) reject('은행, 계좌번호, 예금주를 확인해 주세요.');
  return { bank, number, holder };
}
export function normalizeTransaction(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) reject('거래 내역 형식을 확인해 주세요.');
  const dateTime = String(input.dateTime ?? '').trim();
  const type = String(input.type ?? '').trim();
  const amount = String(input.amount ?? '').replaceAll(',', '').trim();
  const balance = String(input.balance ?? '').replaceAll(',', '').trim();
  const description = String(input.description ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTime) ||
      Number.isNaN(Date.parse(dateTime + ':00Z')) ||
      new Date(dateTime + ':00Z').toISOString().slice(0,16) !== dateTime) reject('거래일시는 올바른 YYYY-MM-DD HH:mm 형식이어야 합니다.');
  if (!['입금','출금'].includes(type)) reject('거래구분은 입금 또는 출금이어야 합니다.');
  if (!/^\d{1,13}$/.test(amount) || BigInt(amount) <= 0n ||
      BigInt(amount) > 10000000000000n) reject('거래금액은 양의 정수여야 합니다.');
  if (!/^\d{1,13}$/.test(balance) ||
      BigInt(balance) > 10000000000000n) reject('거래 후 잔액은 0원 이상의 정수여야 합니다.');
  if (!description || description.length > 240) reject('거래내용은 1~240자여야 합니다.');
  return { dateTime, type, amount: String(BigInt(amount)),
    balance: String(BigInt(balance)), description };
}
export async function getAccount(env) {
  const response = await googleRequest(env, ACCOUNT);
  if (response.status === 404) return { ...DEFAULT_ACCOUNT, updateTime: null };
  if (!response.ok) throw Error('후원 계좌 조회에 실패했습니다.');
  return { ...normalizeAccount(docFields(response.data)), updateTime: response.data.updateTime ?? null };
}
export async function putAccount(env, input, expectedUpdateTime) {
  const account = normalizeAccount(input);
  const url = new URL(ACCOUNT);
  if (expectedUpdateTime) url.searchParams.set('currentDocument.updateTime',expectedUpdateTime);
  else url.searchParams.set('currentDocument.exists','false');
  const result = await googleRequest(env,url.toString(),{method:'PATCH',body:{fields:toFields(account)}});
  if ([409,412].includes(result.status)) reject('다른 운영진이 계좌를 수정했습니다. 새로고침해 주세요.',409);
  if (!result.ok) throw Error('후원 계좌 저장에 실패했습니다.');
  return { ...account,updateTime:result.data.updateTime ?? null };
}
/** Only page the public transaction timeline; manager CSV export retains all rows. */
export async function listPublicTransactionsPage(env,request){
  const {documents,nextPageToken}=await firestorePage(env,EXPENSES,{
    request,orderBy:'dateTime desc',
    fields:['dateTime','type','amount','balance','description']
  });
  return {
    records:documents.map(doc=>({id:doc.name.split('/').pop(),...normalizeTransaction(docFields(doc))})),
    nextPageToken
  };
}
export async function listTransactions(env) {
  const rows=[];let cursor=null;
  const seen=new Set();
  for(let i=0;i<40;i++){
    const url=new URL(EXPENSES);
    url.searchParams.set('pageSize','100');
    if(cursor)url.searchParams.set('pageToken',cursor);
    const result=await googleRequest(env,url.toString());
    if (!result.ok) throw Error('회비 거래 내역 조회에 실패했습니다.');
    for(const doc of result.data.documents ?? []){
      rows.push({id:String(doc.name).split('/').pop(),
        ...normalizeTransaction(docFields(doc)),updateTime:doc.updateTime??''});
    }
    cursor=result.data.nextPageToken??null;
    if(!cursor)return rows.sort((a,b)=>b.dateTime.localeCompare(a.dateTime)||a.id.localeCompare(b.id));
    if(seen.has(cursor))reject('거래 내역 페이지를 읽지 못했습니다.',503);
    seen.add(cursor);
  }
  reject('거래 내역이 너무 많아 조회하지 못했습니다.',503);
}
export async function putTransaction(env,input,id,expectedUpdateTime){
  const row=normalizeTransaction(input),key=id||crypto.randomUUID();
  if(!/^[a-f0-9-]{36}$/.test(key))reject('거래 내역 ID가 올바르지 않습니다.');
  const url=new URL(EXPENSES+'/'+key);
  if(id){
    if(!expectedUpdateTime)reject('수정할 거래 내역을 새로고침해 주세요.',409);
    url.searchParams.set('currentDocument.updateTime',expectedUpdateTime);
  }else url.searchParams.set('currentDocument.exists','false');
  const result=await googleRequest(env,url.toString(),{method:'PATCH',body:{fields:toFields(row)}});
  if([409,412].includes(result.status))reject('다른 운영진이 변경했습니다. 새로고침 후 다시 시도해 주세요.',409);
  if(!result.ok)throw Error('거래 내역 저장에 실패했습니다.');
  return {id:key,...row,updateTime:result.data.updateTime??''};
}


/* The Firestore commit writes are atomic within each batch. */
export async function appendTransactionBatch(env,rows){
  if(!Array.isArray(rows)||rows.length<1||rows.length>20)
    reject('회비 거래 CSV는 한 번에 최대 20건씩 등록할 수 있습니다.');
  const writes=rows.map(input=>{
    const record=normalizeTransaction(input);
    return {update:{
      name:EXPENSES.replace('https://firestore.googleapis.com/v1/','')+'/'+crypto.randomUUID(),
      fields:toFields(record),
    },currentDocument:{exists:false}};
  });
  const result=await googleRequest(env,FIRESTORE_ROOT+':commit',{method:'POST',body:{writes}});
  if(!result.ok)throw Error('회비 거래 CSV 저장에 실패했습니다: '+result.status);
  return rows.length;
}
