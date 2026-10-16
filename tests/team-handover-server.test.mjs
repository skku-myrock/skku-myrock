import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {toFields,docFields} from '../functions/_lib/shared.js';
import {onRequestPost as createSchedule} from '../functions/api/schedules/index.js';
import {onRequestGet as searchTeam} from '../functions/api/schedule-team/search.js';
import {onRequestGet as readHandover,onRequestPost as saveHandover} from '../functions/api/handover-notes/index.js';

const root='https://firestore.googleapis.com/v1/projects/skku-myrock/databases/(default)/documents';
const host='https://myrock.test';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'team-note-key',alg:'RS256',use:'sig'};
const env={FIREBASE_SERVICE_ACCOUNT:JSON.stringify({
 project_id:'skku-myrock',
 client_email:'test-team@skku-myrock.iam.gserviceaccount.com',
 private_key:privateKey.export({format:'pem',type:'pkcs8'}).toString(),
})};
const persons={
 lead:{uid:'teamLeadUid001',name:'나재원',studentId:'2025712558',role:'part_leader',positions:['기타 파트장']},
 other:{uid:'teamOtherUid001',name:'김하늘',studentId:'2026300002',role:'member',positions:[]},
 staff:{uid:'teamStaffUid001',name:'박지민',studentId:'2026300003',role:'staff',positions:['기타 파트장']},
 different:{uid:'teamDiffUid001',name:'이민수',studentId:'2026300004',role:'staff',positions:['보컬 파트장']},
 ob:{uid:'teamOBUid00001',name:'OB',studentId:'2020300005',role:'member',positions:[],handoverAccess:true},
};
function token(person){
 const uid=persons[person].uid,now=Math.floor(Date.now()/1000);
 const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'team-note-key'})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({aud:'skku-myrock',iss:'https://securetoken.google.com/skku-myrock',sub:uid,iat:now-20,exp:now+3600,auth_time:now-20})).toString('base64url');
 const msg=header+'.'+payload;
 return msg+'.'+createSign('RSA-SHA256').update(msg).sign(privateKey).toString('base64url');
}
function setup(){
 const docs=new Map();let serial=0;
 const stamp=()=>new Date(Date.UTC(2026,9,17,2,0,0)+1000*(++serial)).toISOString();
 const put=(name,fields)=>docs.set(name,{name,fields,updateTime:stamp()});
 for(const person of Object.values(persons))put(root+'/users/'+person.uid,toFields(person));
 const previous=globalThis.fetch;
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
 const prefix='projects/skku-myrock/databases/(default)/documents/';
 globalThis.fetch=async(url,init={})=>{
  const raw=String(url),method=init.method??'GET';
  if(raw.includes('/service_accounts/v1/jwk/'))return json({keys:[jwk]});
  if(raw.startsWith('https://oauth2.googleapis.com/token'))return json({access_token:'dummy',expires_in:3600});
  const body=init.body?JSON.parse(init.body):null;
  if(raw===root+':runQuery'&&method==='POST'){
   const filter=body.structuredQuery.where.compositeFilter.filters[0].fieldFilter,field=filter.field.fieldPath;
   const prefixText=filter.value.stringValue;
   return json([...docs.values()].filter(doc=>doc.name.startsWith(root+'/users/')&&!doc.name.slice((root+'/users/').length).includes('/'))
     .filter(doc=>String(docFields(doc)[field]??'').startsWith(prefixText)).map(document=>({document})));
  }
  if(raw===root+':commit'&&method==='POST'){
   for(const w of body.writes){
    const resource=w.update?.name??w.delete??w.verify;
    if(!resource.startsWith(prefix))return json({error:{status:'INVALID_ARGUMENT'}},400);
    const key=root+'/'+resource.slice(prefix.length),old=docs.get(key);
    if(w.currentDocument?.exists===false&&old)return json({error:{status:'FAILED_PRECONDITION'}},412);
    if(w.currentDocument?.updateTime&&old?.updateTime!==w.currentDocument.updateTime)return json({error:{status:'FAILED_PRECONDITION'}},412);
   }
   for(const w of body.writes)if(w.update)put(root+'/'+w.update.name.slice(prefix.length),w.update.fields);
   return json({writeResults:[]});
  }
  if(method==='GET'){
   const doc=docs.get(raw);
   return doc?json(doc):json({error:{status:'NOT_FOUND'}},404);
  }
  throw Error('Unknown mock call '+method+' '+raw);
 };
 return {docs,restore:()=>{globalThis.fetch=previous;}};
}
async function call(handler,user,path,body){
 const request=new Request(host+'/api/'+path,{
  method:body===undefined?'GET':'POST',
  headers:{origin:host,authorization:'Bearer '+token(user),...(body===undefined?{}:{'content-type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
 });
 const response=await handler({request,env});
 return {status:response.status,data:await response.json()};
}
test('team member search is permission checked and returns only name/student ID',async()=>{
 const mock=setup();
 try{
  let result=await call(searchTeam,'lead','schedule-team/search?q='+encodeURIComponent('김'));
  assert.equal(result.status,200,JSON.stringify(result));
  assert.deepEqual(result.data.members,[{uid:persons.other.uid,name:'김하늘',studentId:'2026300002'}]);
  result=await call(searchTeam,'lead','schedule-team/search?q=2026');
  assert.equal(result.status,200);
  assert.ok(result.data.members.some(member=>member.studentId==='2026300002'));
  assert.equal((await call(searchTeam,'other','schedule-team/search?q=김')).status,403);
 }finally{mock.restore();}
});
test('team timetable creates all requested participants atomically, rejecting nonleaders and nonexistent UIDs',async()=>{
 const mock=setup();
 try{
  const body={title:'구성팀 합주',dates:['2026-10-21'],startHour:9,endHour:12,teamMemberUids:[persons.other.uid,persons.staff.uid]};
  assert.equal((await call(createSchedule,'other','schedules',body)).status,403);
  assert.equal((await call(createSchedule,'lead','schedules',{...body,teamMemberUids:['missing-user-000001']})).status,409);
  assert.equal((await call(createSchedule,'lead','schedules',{...body,teamMemberUids:[persons.lead.uid]})).status,400);
  const done=await call(createSchedule,'lead','schedules',body);
  assert.equal(done.status,201,JSON.stringify(done));
  const scheduleDoc=mock.docs.get(root+'/schedules/'+done.data.id);
  assert.deepEqual(docFields(scheduleDoc).participantUids,[persons.lead.uid,persons.other.uid,persons.staff.uid]);
  for(const uid of docFields(scheduleDoc).participantUids){
   const participant=mock.docs.get(root+'/schedules/'+done.data.id+'/participants/'+uid);
   assert.equal(participant.fields.hasResponded.booleanValue,false);
   assert.ok(participant.fields.availability.bytesValue);
  }
 }finally{mock.restore();}
});
test('role-only handover notes are scoped to current positions; common notes persist with optimistic concurrency',async()=>{
 const mock=setup();
 try{
  const noteKey='handover-notes?kind=role&position='+encodeURIComponent('기타 파트장');
  const commonKey='handover-notes?kind=common';
  assert.equal((await call(readHandover,'other',commonKey)).status,403);
  assert.equal((await call(readHandover,'different',noteKey)).status,403);
  assert.equal((await call(readHandover,'ob',noteKey)).status,403);
  let initial=await call(readHandover,'lead',noteKey);
  assert.equal(initial.status,200);assert.equal(initial.data.content,'');assert.equal(initial.data.updateTime,'');
  const saved=await call(saveHandover,'lead','handover-notes',{kind:'role',position:'기타 파트장',content:'기타 파트 업무',expectedUpdateTime:''});
  assert.equal(saved.status,200,JSON.stringify(saved));
  const peer=await call(readHandover,'staff',noteKey);
  assert.equal(peer.data.content,'기타 파트 업무');
  assert.equal((await call(saveHandover,'lead','handover-notes',{kind:'role',position:'기타 파트장',content:'오래된 저장',expectedUpdateTime:''})).status,409);
  assert.equal((await call(readHandover,'different',noteKey)).status,403);
  const common=await call(saveHandover,'ob','handover-notes',{kind:'common',position:'',content:'공통 인수인계',expectedUpdateTime:''});
  assert.equal(common.status,200,JSON.stringify(common));
  assert.equal((await call(readHandover,'lead',commonKey)).data.content,'공통 인수인계');
  assert.equal((await call(readHandover,'other',commonKey)).status,403);
 }finally{mock.restore();}
});
