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
 lead:{uid:'teamLeadUid001',name:'나재원',studentId:'2025712558',role:'part_leader',positions:['기타 파트장','회장'],generation:'27'},
 other:{uid:'teamOtherUid001',name:'김하늘',studentId:'2026300002',role:'member',positions:[]},
 staff:{uid:'teamStaffUid001',name:'박지민',studentId:'2026300003',role:'staff',positions:['기타 파트장'],generation:'28'},
 different:{uid:'teamDiffUid001',name:'이민수',studentId:'2026300004',role:'staff',positions:['보컬 파트장'],generation:'28'},
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
test('every authorised operator may read another author’s past role notes, but only write their own current roles',async()=>{
 const mock=setup();
 try{
  const authorUid=persons.lead.uid;
  const roleQuery='handover-notes?kind=role&position='+encodeURIComponent('기타 파트장')+'&authorUid='+authorUid;
  const commonQuery='handover-notes?kind=common&authorUid='+authorUid;
  assert.equal((await call(readHandover,'other',roleQuery)).status,403);
  assert.equal((await call(readHandover,'other',commonQuery)).status,403);

  const identity=await call(readHandover,'lead','handover-notes');
  assert.equal(identity.status,200);
  assert.deepEqual(identity.data.positions,['기타 파트장','회장']);
  assert.equal(identity.data.name,'나재원');
  assert.equal(identity.data.generation,'27');

  const initial=await call(readHandover,'lead',roleQuery);
  assert.equal(initial.status,200);
  assert.equal(initial.data.content,'');
  assert.equal(initial.data.updateTime,'');

  const first=await call(saveHandover,'lead','handover-notes',{
   kind:'role',position:'기타 파트장',content:'27기 기타파트 안내',expectedUpdateTime:'',
  });
  assert.equal(first.status,200,JSON.stringify(first));
  const second=await call(saveHandover,'lead','handover-notes',{
   kind:'role',position:'회장',content:'27기 회장 업무',expectedUpdateTime:'',
  });
  assert.equal(second.status,200,JSON.stringify(second));

  // Another position holder, including OB, can read notes irrespective of their own roles.
  for(const viewer of ['staff','different','ob']){
   const view=await call(readHandover,viewer,roleQuery);
   assert.equal(view.status,200,JSON.stringify(view));
   assert.equal(view.data.content,'27기 기타파트 안내');
  }
  assert.equal((await call(readHandover,'different',
   'handover-notes?kind=role&position='+encodeURIComponent('회장')+'&authorUid='+authorUid)).data.content,'27기 회장 업무');

  // Only the author’s own current role can be written.
  assert.equal((await call(saveHandover,'different','handover-notes',{
   kind:'role',position:'기타 파트장',content:'잘못된 수정',expectedUpdateTime:first.data.updateTime,
  })).status,403);
  assert.equal((await call(saveHandover,'staff','handover-notes',{
   kind:'role',position:'기타 파트장',authorUid,content:'새로운 담당자 기록',expectedUpdateTime:'',
  })).status,200);
  // A second holder writes their own independent record instead of overwriting the prior author.
  assert.equal((await call(readHandover,'staff',roleQuery)).data.content,'27기 기타파트 안내');
  assert.equal((await call(readHandover,'staff','handover-notes?kind=role&position='+encodeURIComponent('기타 파트장'))).data.content,'새로운 담당자 기록');
  assert.equal((await call(saveHandover,'lead','handover-notes',{
   kind:'role',position:'기타 파트장',content:'오래된 저장',expectedUpdateTime:'',
  })).status,409);

  const common=await call(saveHandover,'lead','handover-notes',{
   kind:'common',position:'',content:'27기 운영진 공통 안내',expectedUpdateTime:'',
  });
  assert.equal(common.status,200,JSON.stringify(common));
  assert.equal((await call(readHandover,'ob',commonQuery)).data.content,'27기 운영진 공통 안내');

  const obCommon=await call(saveHandover,'ob','handover-notes',{
   kind:'common',position:'',content:'OB의 공통 인수인계',expectedUpdateTime:'',
  });
  assert.equal(obCommon.status,200);
  assert.equal((await call(readHandover,'lead',commonQuery)).data.content,'27기 운영진 공통 안내');
  assert.equal((await call(readHandover,'lead','handover-notes?kind=common&authorUid='+persons.ob.uid)).data.content,'OB의 공통 인수인계');

  // Saved metadata includes historical author, generation and position snapshots.
  const noteDocs=[...mock.docs.values()].filter(doc=>doc.name.includes('/handoverNotes/'));
  assert.ok(noteDocs.some(doc=>docFields(doc).authorUid===authorUid&&docFields(doc).generation==='27'&&docFields(doc).position==='기타 파트장'));
 }finally{mock.restore();}
});

test('legacy notes migrate non-destructively for their original author',async()=>{
 const mock=setup();
 try{
  const bytes=new TextEncoder().encode('기타 파트장');
  const b64=Buffer.from(bytes).toString('base64url');
  mock.docs.set(root+'/handoverNotes/role_'+b64,{
   name:root+'/handoverNotes/role_'+b64,
   fields:toFields({content:'예전 작성 내용',updatedBy:persons.lead.uid}),
   updateTime:'2026-10-16T12:00:00.000Z',
  });
  const query='handover-notes?kind=role&position='+encodeURIComponent('기타 파트장');
  assert.equal((await call(readHandover,'lead',query)).data.content,'예전 작성 내용');
  assert.equal((await call(readHandover,'staff',query)).data.content,'');
  assert.equal((await call(saveHandover,'lead','handover-notes',{
   kind:'role',position:'기타 파트장',content:'이어 작성한 내용',expectedUpdateTime:'',
  })).status,200);
  assert.equal((await call(readHandover,'lead',query)).data.content,'이어 작성한 내용');
  assert.ok(mock.docs.has(root+'/handoverNotes/role_'+b64),'legacy content is not destroyed');
 }finally{mock.restore();}
});
