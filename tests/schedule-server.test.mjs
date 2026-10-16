import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {onRequestPost as create,onRequestGet as list} from '../functions/api/schedules/index.js';
import {onRequestGet as detail} from '../functions/api/schedules/[id]/index.js';
import {onRequestPost as invite} from '../functions/api/schedules/[id]/invite.js';
import {onRequestGet as ownerInvitations} from '../functions/api/schedules/[id]/invitations.js';
import {onRequestPost as cancelInvite} from '../functions/api/schedules/[id]/cancel-invite.js';
import {onRequestGet as inbox} from '../functions/api/schedule-invitations/index.js';
import {onRequestPost as respond} from '../functions/api/schedule-invitations/[id]/respond.js';
import {onRequestPost as save} from '../functions/api/schedules/[id]/availability.js';
import {onRequestPost as remove} from '../functions/api/schedules/[id]/members/[uid].js';
import {onRequestPost as leave} from '../functions/api/schedules/[id]/leave.js';
import {toFields} from '../functions/_lib/shared.js';

const root='https://firestore.googleapis.com/v1/projects/skku-myrock/databases/(default)/documents';
const base='https://myrock.test';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'test-key',alg:'RS256',use:'sig'};
const pem=privateKey.export({format:'pem',type:'pkcs8'}).toString();
const env={FIREBASE_SERVICE_ACCOUNT:JSON.stringify({
 project_id:'skku-myrock',client_email:'tester@skku-myrock.iam.gserviceaccount.com',private_key:pem,
})};
const alice='alice1234567890',bob='bob123456789012',eve='eve1234567890123';
const studentIds={2026300001:alice,2026300002:bob,2026300003:eve};
function token(uid){
 const p=Object.fromEntries([
  ['aud','skku-myrock'],['iss','https://securetoken.google.com/skku-myrock'],['sub',uid],
  ['iat',Math.floor(Date.now()/1000)-20],['exp',Math.floor(Date.now()/1000)+3600],
  ['auth_time',Math.floor(Date.now()/1000)-20],
 ]);
 const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url');
 const body=Buffer.from(JSON.stringify(p)).toString('base64url');
 const text=header+'.'+body;
 return text+'.'+createSign('RSA-SHA256').update(text).sign(privateKey).toString('base64url');
}
function setupMock(){
 const documents=new Map(),stats={writes:0},auth=Object.fromEntries(Object.entries(studentIds).map(([studentId,uid])=>[
  studentId+'@members.skku-myrock.firebaseapp.com',uid,
 ]));
 let version=0;
 const stamp=()=>new Date(Date.UTC(2026,9,16,1,0,0)+1000*(++version)).toISOString();
 const createDoc=(path,fields)=>documents.set(path,{name:path,fields,updateTime:stamp()});
 for(const [uid,name,studentId] of [[alice,'갑길동','2026300001'],[bob,'을길동','2026300002'],[eve,'병길동','2026300003']])
  createDoc(root+'/users/'+uid,toFields({name,studentId,role:'member'}));
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
 // The real Firestore REST API rejects HTTPS URLs in Write.update.name/Write.delete.
 const resourceBase='projects/skku-myrock/databases/(default)/documents/';
 const urlFromResource=name=>root+'/'+name.slice(resourceBase.length);
 function check(name,condition){
  const current=documents.get(name);
  if(condition?.exists===false&&current)return false;
  if(condition?.updateTime!==undefined&&current?.updateTime!==condition.updateTime)return false;
  return true;
 }
 globalThis.fetch=async(url,init={})=>{
  const raw=typeof url==='string'?url:url.toString(),method=init.method??'GET';
  if(raw.startsWith('https://www.googleapis.com/service_accounts/v1/jwk/'))return json({keys:[jwk]});
  if(raw.startsWith('https://oauth2.googleapis.com/token'))return json({access_token:'dummy',expires_in:3600});
  if(raw.includes('/accounts:lookup')){
   const request=JSON.parse(init.body),uid=auth[request.email?.[0]];
   return json(uid?{users:[{localId:uid}]}:{users:[]});
  }
  if(!raw.startsWith(root))throw Error('Unexpected external request '+raw);
  const pathname=raw.split('?')[0],body=init.body?JSON.parse(init.body):{};
  if(pathname===root+':commit'&&method==='POST'){
   for(const w of body.writes){
    const resource=w.update?.name??w.delete??w.verify;
    if(typeof resource!=='string'||!resource.startsWith(resourceBase))
     return json({error:{status:'INVALID_ARGUMENT',message:'Write document name must be a resource path'}},400);
    if(!check(urlFromResource(resource),w.currentDocument))return json({error:{status:'FAILED_PRECONDITION'}},412);
   }
   for(const w of body.writes){
    if(w.verify)continue;
    if(w.delete){documents.delete(urlFromResource(w.delete));stats.writes++;continue;}
    createDoc(urlFromResource(w.update.name),w.update.fields);stats.writes++;
   }
   return json({writeResults:[]});
  }
  if(pathname===root+':runQuery'&&method==='POST'){
   const query=body.structuredQuery,collection=query.from[0].collectionId;
   const field=query.where.fieldFilter,queryValue=field.value.stringValue;
   const prefix=root+'/'+collection+'/';
   const matches=[...documents.values()].filter(doc=>{
    if(!doc.name.startsWith(prefix)||doc.name.slice(prefix.length).includes('/'))return false;
    const f=doc.fields[field.field.fieldPath];
    return field.op==='EQUAL'?f?.stringValue===queryValue:
      field.op==='ARRAY_CONTAINS'&&f?.arrayValue?.values?.some(v=>v.stringValue===queryValue);
   });
   return json(matches.map(document=>({document})));
  }
  if(method==='GET'){
   const doc=documents.get(pathname);
   return doc?json(doc):json({error:{status:'NOT_FOUND'}},404);
  }
  if(method==='PATCH'){
   const current=documents.get(pathname);
   const expected=new URL(raw).searchParams.get('currentDocument.updateTime');
   if(!current||current.updateTime!==expected)return json({error:{status:'FAILED_PRECONDITION'}},412);
   const fields={...current.fields,...body.fields};
   createDoc(pathname,fields);stats.writes++;
   return json(documents.get(pathname));
  }
  throw Error('Unexpected firestore request '+method+' '+raw);
 };
 function registerStudent(studentId,uid,name){
  auth[studentId+'@members.skku-myrock.firebaseapp.com']=uid;
  createDoc(root+'/users/'+uid,toFields({name,studentId,role:'member'}));
 }
 return {documents,stats,registerStudent};
}
async function call(handler,uid,method,path,body,params={}){
 const request=new Request(base+path,{
  method,headers:{authorization:'Bearer '+token(uid),origin:base,...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),
 });
 const response=await handler({request,env,params});
 return {status:response.status,data:await response.json()};
}

test('full Firestore invitation, consent and explicit bitset save lifecycle uses only mocked services',async()=>{
 const realFetch=globalThis.fetch;
 const {documents,stats,registerStudent}=setupMock();
 try{
  const scheduleInput={title:'실제 합주',dates:['2026-10-19','2026-10-20'],startHour:9,endHour:11};
  const created=await call(create,alice,'POST','/api/schedules',scheduleInput);
  assert.equal(created.status,201,JSON.stringify(created));
  const id=created.data.id;
  assert.equal((await call(list,alice,'GET','/api/schedules')).data.schedules.length,1);
  assert.equal((await call(list,bob,'GET','/api/schedules')).data.schedules.length,0);
  assert.equal((await call(detail,bob,'GET','/api/schedules/'+id,undefined,{id})).status,403);
  const initial=(await call(detail,alice,'GET','/api/schedules/'+id,undefined,{id})).data;
  assert.equal(initial.people.length,1);
  assert.equal(initial.people[0].name,'갑길동');
  assert.equal(initial.people[0].hasResponded,false);
  const nonexistent=await call(invite,alice,'POST','/api/schedules/'+id+'/invite',{studentId:'2026999999'},{id});
  const invited=await call(invite,alice,'POST','/api/schedules/'+id+'/invite',{studentId:'2026300002'},{id});
  assert.equal(invited.status,200,JSON.stringify(invited));
  assert.equal(nonexistent.status,200);
  assert.equal(nonexistent.data.message,'존재하지 않는 학번입니다.');
  assert.equal(nonexistent.data.status,'not_found');
  assert.equal(invited.data.status,'pending');
  const pending=(await call(ownerInvitations,alice,'GET','/api/schedules/'+id+'/invitations',undefined,{id})).data.invitations;
  assert.deepEqual(pending.map(item=>item.studentId).sort(),['2026300002']);
  assert.ok(pending.every(item=>!('name'in item)&&!('recipientUid'in item)));
  assert.deepEqual(pending.map(item=>[item.studentId,item.status]),[['2026300002','pending']]);
  // Later registration does not turn a failed attempt into a deliverable invitation.
  const laterUid='later1234567890';
  registerStudent('2026999999',laterUid,'후가입');
  assert.equal((await call(inbox,laterUid,'GET','/api/schedule-invitations')).data.invitations.length,0);
  const manualRetry=await call(invite,alice,'POST','/api/schedules/'+id+'/invite',{studentId:'2026999999'},{id});
  assert.equal(manualRetry.data.status,'pending');
  assert.equal((await call(inbox,laterUid,'GET','/api/schedule-invitations')).data.invitations.length,1);
  assert.equal((await call(ownerInvitations,bob,'GET','/api/schedules/'+id+'/invitations',undefined,{id})).status,403);
  const aliceBefore=(await call(detail,alice,'GET','/api/schedules/'+id,undefined,{id})).data;
  assert.equal(aliceBefore.people.length,1,'inviting must not reveal or add recipient');
  const received=(await call(inbox,bob,'GET','/api/schedule-invitations')).data.invitations;
  assert.equal(received.length,1);
  assert.equal(received[0].inviterName,'갑길동');
  assert.equal((await call(inbox,eve,'GET','/api/schedule-invitations')).data.invitations.length,0);
  const inviteId=received[0].id;
  assert.equal((await call(respond,eve,'POST','/api/schedule-invitations/'+inviteId+'/respond',{action:'accept'},{id:inviteId})).status,403);
  const accepted=await call(respond,bob,'POST','/api/schedule-invitations/'+inviteId+'/respond',{action:'accept'},{id:inviteId});
  assert.equal(accepted.status,200,JSON.stringify(accepted));
  assert.equal((await call(inbox,bob,'GET','/api/schedule-invitations')).data.invitations.length,0);
  assert.deepEqual((await call(ownerInvitations,alice,'GET','/api/schedules/'+id+'/invitations',undefined,{id})).data.invitations,[]);
  assert.equal((await call(cancelInvite,alice,'POST','/api/schedules/'+id+'/cancel-invite',{invitationId:inviteId},{id})).status,409);
  assert.equal((await call(list,bob,'GET','/api/schedules')).data.schedules.length,1);
  const details=(await call(detail,bob,'GET','/api/schedules/'+id,undefined,{id})).data;
  assert.deepEqual(details.people.map(p=>p.name).sort(),['갑길동','을길동']);
  const self=details.people.find(p=>p.uid===bob);
  assert.equal(self.hasResponded,false);
  const saved=await call(save,bob,'POST','/api/schedules/'+id+'/availability',{
   availability:'oA==',expectedUpdateTime:self.updateTime,
  },{id});
  assert.equal(saved.status,200,JSON.stringify(saved));
  const refreshed=(await call(detail,bob,'GET','/api/schedules/'+id,undefined,{id})).data;
  assert.equal(refreshed.people.find(p=>p.uid===bob).hasResponded,true);
  assert.equal(refreshed.people.find(p=>p.uid===bob).availability,'oA==');
  const stale=await call(save,bob,'POST','/api/schedules/'+id+'/availability',{
   availability:'AA==',expectedUpdateTime:self.updateTime,
  },{id});
  assert.equal(stale.status,409);
  const removed=await call(remove,alice,'POST','/api/schedules/'+id+'/members/'+bob,{action:'remove'},{id,uid:bob});
  assert.equal(removed.status,200,JSON.stringify(removed));
  assert.equal((await call(detail,bob,'GET','/api/schedules/'+id,undefined,{id})).status,403);
  assert.equal((await call(list,bob,'GET','/api/schedules')).data.schedules.length,0);
  assert.equal((await call(remove,alice,'POST','/api/schedules/'+id+'/members/'+alice,{action:'remove'},{id,uid:alice})).status,403);
  assert.equal((await call(invite,alice,'POST','/api/schedules/'+id+'/invite',{studentId:'2026300002'},{id})).status,200);
  assert.equal((await call(inbox,bob,'GET','/api/schedule-invitations')).data.invitations.length,1);
  assert.ok(stats.writes>1);
  assert.ok([...documents.keys()].some(key=>key.includes('/scheduleInvitations/')));
 }finally{globalThis.fetch=realFetch;}
});

test('pending invitation cancellation removes access before acceptance without revealing account presence',async()=>{
 const originalFetch=globalThis.fetch;
 setupMock();
 try{
  const result=await call(create,alice,'POST','/api/schedules',{
   title:'취소 확인',dates:['2026-10-21'],startHour:8,endHour:10,
  });
  assert.equal(result.status,201,JSON.stringify(result));
  const id=result.data.id;
  const known=await call(invite,alice,'POST','/api/schedules/'+id+'/invite',{studentId:'2026300002'},{id});
  const unknown=await call(invite,alice,'POST','/api/schedules/'+id+'/invite',{studentId:'2026999999'},{id});
  assert.equal(known.status,200);assert.equal(known.data.status,'pending');
  assert.equal(unknown.status,200);assert.equal(unknown.data.status,'not_found');
  assert.equal(unknown.data.message,'존재하지 않는 학번입니다.');
  const p=await call(ownerInvitations,alice,'GET','/api/schedules/'+id+'/invitations',undefined,{id});
  assert.equal(p.status,200,JSON.stringify(p));
  assert.deepEqual(p.data.invitations.map(x=>x.studentId),['2026300002']);
  assert.ok(p.data.invitations.every(x=>!Object.hasOwn(x,'recipientUid')&&!Object.hasOwn(x,'name')));
  assert.deepEqual(p.data.invitations.map(x=>[x.studentId,x.status]),[['2026300002','pending']]);
  assert.equal((await call(ownerInvitations,eve,'GET','/api/schedules/'+id+'/invitations',undefined,{id})).status,403);
  const knownId=p.data.invitations.find(x=>x.studentId==='2026300002').id;
  assert.ok(!p.data.invitations.some(x=>x.studentId==='2026999999'));
  assert.equal((await call(inbox,bob,'GET','/api/schedule-invitations')).data.invitations.length,1);
  assert.equal((await call(inbox,eve,'GET','/api/schedule-invitations')).data.invitations.length,0);
  assert.equal((await call(cancelInvite,bob,'POST','/api/schedules/'+id+'/cancel-invite',{invitationId:knownId},{id})).status,403);
  assert.equal((await call(cancelInvite,alice,'POST','/api/schedules/'+id+'/cancel-invite',{invitationId:knownId},{id})).status,200);
  assert.equal((await call(inbox,bob,'GET','/api/schedule-invitations')).data.invitations.length,0);
  assert.equal((await call(respond,bob,'POST','/api/schedule-invitations/'+knownId+'/respond',{action:'accept'},{id:knownId})).status,409);
  assert.deepEqual((await call(ownerInvitations,alice,'GET','/api/schedules/'+id+'/invitations',undefined,{id})).data.invitations,[]);
  assert.equal((await call(cancelInvite,alice,'POST','/api/schedules/'+id+'/cancel-invite',{invitationId:knownId},{id})).status,409);
  assert.equal((await call(invite,alice,'POST','/api/schedules/'+id+'/invite',{studentId:'2026300002'},{id})).status,200);
  const received=(await call(inbox,bob,'GET','/api/schedule-invitations')).data.invitations;
  assert.equal(received.length,1);
  assert.equal((await call(respond,bob,'POST','/api/schedule-invitations/'+received[0].id+'/respond',{action:'decline'},{id:received[0].id})).status,200);
  
  assert.deepEqual((await call(ownerInvitations,alice,'GET','/api/schedules/'+id+'/invitations',undefined,{id})).data.invitations,[]);
 }finally{globalThis.fetch=originalFetch;}
});

test('member may leave while owner must stay until alone; final owner exit removes schedule, participants and invitations',async()=>{
 const originalFetch=globalThis.fetch;
 const {documents}=setupMock();
 try{
  const created=await call(create,alice,'POST','/api/schedules',{title:'퇴장 테스트',dates:['2026-10-19'],startHour:10,endHour:12});
  assert.equal(created.status,201);const id=created.data.id;
  const inviteResult=await call(invite,alice,'POST','/api/schedules/'+id+'/invite',{studentId:'2026300002'},{id});
  assert.equal(inviteResult.status,200);
  const received=(await call(inbox,bob,'GET','/api/schedule-invitations')).data.invitations;
  assert.equal(received.length,1);
  assert.equal((await call(respond,bob,'POST','/api/schedule-invitations/'+received[0].id+'/respond',{action:'accept'},{id:received[0].id})).status,200);
  assert.equal((await call(leave,alice,'POST','/api/schedules/'+id+'/leave',{}, {id})).status,409);
  const exited=await call(leave,bob,'POST','/api/schedules/'+id+'/leave',{}, {id});
  assert.equal(exited.status,200,JSON.stringify(exited));assert.equal(exited.data.deleted,false);
  assert.equal((await call(list,bob,'GET','/api/schedules')).data.schedules.length,0);
  assert.equal((await call(leave,bob,'POST','/api/schedules/'+id+'/leave',{}, {id})).status,403);
  const deleted=await call(leave,alice,'POST','/api/schedules/'+id+'/leave',{}, {id});
  assert.equal(deleted.status,200,JSON.stringify(deleted));assert.equal(deleted.data.deleted,true);
  assert.equal((await call(list,alice,'GET','/api/schedules')).data.schedules.length,0);
  assert.equal((await call(detail,alice,'GET','/api/schedules/'+id,undefined,{id})).status,404);
  assert.ok(![...documents.keys()].some(key=>key.includes('/schedules/'+id)||key.includes('/scheduleInvitations/'+id+'_')));
 }finally{globalThis.fetch=originalFetch;}
});
