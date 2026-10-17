import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {toFields} from '../functions/_lib/shared.js';
import {onRequestGet as list} from '../functions/api/equipment/index.js';
import {onRequestPost as action} from '../functions/api/equipment/action.js';
import {onRequestPost as manage} from '../functions/api/equipment/manage.js';

const root='https://firestore.googleapis.com/v1/projects/skku-myrock/databases/(default)/documents';
const base='https://myrock.test';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'equipment-test-key',alg:'RS256',use:'sig'};
const pem=privateKey.export({format:'pem',type:'pkcs8'}).toString();
const env={FIREBASE_SERVICE_ACCOUNT:JSON.stringify({project_id:'skku-myrock',client_email:'equipment-test@skku-myrock.iam.gserviceaccount.com',private_key:pem})};
const users={
 alice:{uid:'equipAliceUser123',name:'나재원',studentId:'2025712558',role:'member'},
 bob:{uid:'equipBobUser12345',name:'김하늘',studentId:'2026300002',role:'member'},
 leader:{uid:'equipLeaderUser1',name:'파트장',studentId:'2026300003',role:'part_leader'},
 eve:{uid:'equipEveUser1234',name:'이철수',studentId:'2026300004',role:'member'},
};
function token(person){
 const uid=users[person].uid,now=Math.floor(Date.now()/1000);
 const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'equipment-test-key'})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({aud:'skku-myrock',iss:'https://securetoken.google.com/skku-myrock',sub:uid,iat:now-20,exp:now+3600,auth_time:now-20})).toString('base64url');
 const unsigned=header+'.'+payload;
 return unsigned+'.'+createSign('RSA-SHA256').update(unsigned).sign(privateKey).toString('base64url');
}
function mockFirestore(){
 const documents=new Map(),stats={writes:0};
 let revision=0;
 const stamp=()=>new Date(Date.UTC(2026,9,17,1,0,0)+1000*(++revision)).toISOString();
 const store=(name,fields)=>documents.set(name,{name,fields,updateTime:stamp()});
 for(const x of Object.values(users))store(root+'/users/'+x.uid,toFields(x));
 // Explicitly register one test-only equipment document; production no longer seeds defaults.
 store(root+'/equipment/test-guitar',toFields({
  name:'테스트 기타',product:'테스트 모델',imageUrl:'',queue:[],borrower:{},returnRequestedAt:'',archived:false
 }));
 store(root+'/equipment/demo-guitar',toFields({name:'기타',product:'바커스 BST-2-RSM',queue:[],borrower:{},returnRequestedAt:'',archived:false}));
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
 const prefix='projects/skku-myrock/databases/(default)/documents/';
 const toUrl=name=>root+'/'+name.slice(prefix.length);
 const previous=globalThis.fetch;
 globalThis.fetch=async(url,init={})=>{
  const raw=String(url),path=raw.split('?')[0],method=init.method??'GET';
  if(raw.includes('/service_accounts/v1/jwk/'))return json({keys:[jwk]});
  if(raw.startsWith('https://oauth2.googleapis.com/token'))return json({access_token:'equipment-mock-token',expires_in:3600});
  if(!raw.startsWith(root))throw Error('unexpected external call: '+raw);
  const body=init.body?JSON.parse(init.body):{};
  if(path===root+':runQuery'&&method==='POST'){
   const field=body.structuredQuery.where.fieldFilter;
   const matches=[...documents.values()].filter(doc=>doc.name.startsWith(root+'/users/')&&!doc.name.slice((root+'/users/').length).includes('/'))
    .filter(doc=>doc.fields?.[field.field.fieldPath]?.stringValue===field.value.stringValue)
    .slice(0,body.structuredQuery.limit??2);
   return json(matches.map(document=>({document})));
  }
  if(path===root+':commit'&&method==='POST'){
   for(const write of body.writes){
    const name=write.update?.name??write.delete??write.verify;
    if(!name.startsWith(prefix))return json({error:{status:'INVALID_ARGUMENT'}},400);
    const old=documents.get(toUrl(name)),pre=write.currentDocument??{};
    if(pre.exists===false&&old)return json({error:{status:'FAILED_PRECONDITION'}},412);
    if(pre.updateTime&&old?.updateTime!==pre.updateTime)return json({error:{status:'FAILED_PRECONDITION'}},412);
   }
   for(const write of body.writes){
    if(write.delete)documents.delete(toUrl(write.delete));
    else if(write.update)store(toUrl(write.update.name),write.update.fields);
    stats.writes++;
   }
   return json({writeResults:[]});
  }
  if(path===root+'/equipment'&&method==='GET'){
   const items=[...documents.values()].filter(d=>d.name.startsWith(root+'/equipment/')&&!d.name.slice((root+'/equipment/').length).includes('/'));
   return json({documents:items});
  }
  if(method==='GET')return documents.has(path)?json(documents.get(path)):json({error:{status:'NOT_FOUND'}},404);
  throw Error('unexpected firestore operation '+method+' '+raw);
 };
 return {documents,stats,restore:()=>{globalThis.fetch=previous;}};
}
async function invoke(handler,as,path,body){
 const request=new Request(base+'/api/equipment'+path,{
  method:body===undefined?'GET':'POST',
  headers:{origin:base,...(as?{authorization:'Bearer '+token(as)}:{}),...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),
 });
 const response=await handler({request,env});
 return {status:response.status,data:await response.json()};
}
const view=(as,manageView=false)=>invoke(list,as,manageView?'?manage=1':'');
const doAction=(as,id,operation)=>invoke(action,as,'/action',{id,action:operation});
const doManage=(as,id,operation,fields={})=>invoke(manage,as,'/manage',{id,action:operation,...fields});
const guitar='test-guitar';
const byId=(response,id=guitar)=>response.data.items.find(item=>item.id===id);

test('persisted equipment supports FIFO cancellation, approval, return and next queue',async()=>{
 const mock=mockFirestore();
 try{
  let page=await view(null);
  assert.equal(page.status,200);
  assert.deepEqual(page.data.items.map(x=>x.status),['대여 가능']);
  assert.ok(page.data.items.every(x=>!('borrower'in x)&&!('queue'in x)));
  assert.equal((await doAction('alice','demo-guitar','apply')).status,404);

  assert.equal((await doAction('alice',guitar,'apply')).status,200);
  assert.equal(byId(await view('alice')).myPosition,1);
  assert.equal(byId(await view(null)).status,'대여 승인 대기중');
  assert.equal((await doAction('bob',guitar,'apply')).status,200);
  assert.equal(byId(await view('bob')).myPosition,2);
  assert.equal((await doAction('alice',guitar,'apply')).status,409);
  assert.equal((await doManage('bob',guitar,'approve')).status,403);
  assert.equal((await doAction('eve',guitar,'cancel')).status,409);

  assert.equal((await doAction('alice',guitar,'cancel')).status,200);
  assert.equal(byId(await view('bob')).myPosition,1);
  assert.equal((await doAction('alice',guitar,'apply')).status,200);
  assert.equal(byId(await view('alice')).myPosition,2);

  assert.equal((await doManage('leader',guitar,'approve')).status,200);
  page=await view('leader',true);
  assert.equal(byId(page).status,'대여중');
  assert.equal(byId(page).borrower.name,'김하늘');
  assert.equal(byId(page).borrower.studentId,'2026300002');
  assert.ok(byId(page).borrower.borrowedAt);
  assert.equal(byId(page).queue[0].name,'나재원');
  assert.equal(byId(await view('bob')).isBorrower,true);
  assert.equal(byId(await view('alice')).myPosition,1);
  assert.ok(!('borrower'in byId(await view('eve'))));
  assert.equal((await doManage('leader',guitar,'approve')).status,409);
  assert.equal((await doAction('eve',guitar,'return')).status,403);
  assert.equal((await doAction('bob',guitar,'return')).status,200);
  assert.equal(byId(await view(null)).status,'반납 확인중');
  assert.equal((await doAction('bob',guitar,'return')).status,409);
  assert.equal((await doManage('leader',guitar,'confirm-return')).status,200);
  assert.equal(byId(await view(null)).status,'대여 승인 대기중');
  assert.equal((await doManage('leader',guitar,'approve')).status,200);
  assert.equal(byId(await view('alice')).isBorrower,true);
  assert.equal((await doAction('alice',guitar,'return')).status,200);
  assert.equal((await doManage('leader',guitar,'confirm-return')).status,200);
  assert.equal(byId(await view(null)).status,'대여 가능');
 }finally{mock.restore();}
});

test('simultaneous applicants serialize to distinct FIFO positions; missing authorization fails',async()=>{
 const mock=mockFirestore();
 try{
  const responses=await Promise.all([doAction('alice',guitar,'apply'),doAction('bob',guitar,'apply')]);
  assert.deepEqual(responses.map(x=>x.status),[200,200]);
  const listResult=await view('leader',true);
  assert.deepEqual(byId(listResult).queue.map(x=>x.uid).sort(),[users.alice.uid,users.bob.uid].sort());
  assert.deepEqual([byId(await view('alice')).myPosition,byId(await view('bob')).myPosition].sort(),[1,2]);
  assert.equal((await doAction(null,guitar,'apply')).status,401);
  assert.equal((await view('alice',true)).status,403);
 }finally{mock.restore();}
});

test('manager can edit and delete only idle equipment, and cannot force statuses',async()=>{
 const mock=mockFirestore();
 try{
  assert.equal((await doManage('alice',guitar,'edit',{name:'사용 금지',product:'test'})).status,403);
  assert.equal((await doManage('leader',guitar,'edit',{name:'기타 앰프',product:'Marshall DSL'})).status,200);
  assert.equal(byId(await view(null)).name,'기타 앰프');
  assert.equal((await doAction('bob',guitar,'apply')).status,200);
  assert.equal((await doManage('leader',guitar,'delete')).status,409);
  assert.equal((await doAction('bob',guitar,'cancel')).status,200);
  assert.equal((await doManage('leader',guitar,'delete')).status,200);
  assert.ok(!(await view(null)).data.items.some(x=>x.id===guitar));
  const added=await doManage('leader',undefined,'add',{name:'베이스 앰프',product:'Fender Rumble'});
  assert.equal(added.status,201,JSON.stringify(added));
  assert.equal((await view(null)).data.items.length,1);
  assert.equal(byId(await view(null),added.data.id).status,'대여 가능');
  assert.equal((await doManage('leader',added.data.id,'edit',{name:'앰프',product:'Fender Rumble 40',status:'대여중'})).status,200);
  assert.equal(byId(await view(null),added.data.id).status,'대여 가능');
 }finally{mock.restore();}
});


test('manager corrective actions reconcile actual borrower, return flags and FIFO queue',async()=>{
 const mock=mockFirestore();
 try{
  assert.equal((await doManage('alice',guitar,'force-loan',{studentId:users.bob.studentId})).status,403);
  assert.equal((await doManage('leader',guitar,'force-loan',{studentId:'0000000000'})).status,409);
  assert.equal((await doManage('leader',guitar,'add-request',{studentId:users.alice.studentId})).status,200);
  assert.equal((await doManage('leader',guitar,'add-request',{studentId:users.bob.studentId})).status,200);
  assert.equal(byId(await view(null)).status,'대여 승인 대기중');
  assert.equal((await doManage('leader',guitar,'add-request',{studentId:users.bob.studentId})).status,409);
  assert.equal((await doManage('leader',guitar,'force-loan',{studentId:users.bob.studentId})).status,200);
  let item=byId(await view('leader',true));
  assert.equal(item.status,'대여중');
  assert.equal(item.borrower.uid,users.bob.uid);
  assert.equal(item.borrower.name,'김하늘');
  assert.equal(item.borrower.studentId,users.bob.studentId);
  assert.deepEqual(item.queue.map(x=>x.uid),[users.alice.uid]);
  assert.equal(byId(await view('bob')).isBorrower,true);
  assert.equal((await doManage('leader',guitar,'force-request-return')).status,200);
  assert.equal(byId(await view(null)).status,'반납 확인중');
  assert.equal((await doManage('leader',guitar,'cancel-return')).status,200);
  assert.equal(byId(await view(null)).status,'대여중');
  assert.equal((await doManage('leader',guitar,'force-return')).status,200);
  item=byId(await view('leader',true));
  assert.equal(item.status,'대여 승인 대기중');
  assert.equal(item.borrower,null);
  assert.equal(item.returnRequestedAt,null);
  assert.equal(item.queue[0].uid,users.alice.uid);
  assert.equal((await doManage('leader',guitar,'force-return')).status,409);
  assert.equal((await doManage('leader',guitar,'clear-queue')).status,200);
  assert.equal(byId(await view(null)).status,'대여 가능');
  assert.equal((await doManage('leader',guitar,'force-loan',{studentId:users.eve.studentId})).status,200);
  assert.equal((await doManage('leader',guitar,'force-available')).status,200);
  item=byId(await view('leader',true));
  assert.equal(item.status,'대여 가능');
  assert.equal(item.borrower,null);
  assert.equal(item.queue.length,0);
  assert.equal(item.returnRequestedAt,null);
  assert.equal(byId(await view('eve')).isBorrower,false);
  assert.equal((await doManage('leader',guitar,'force-available')).status,409);
 }finally{mock.restore();}
});

test('manual clearing all requests and borrower is atomic and cannot be achieved by editing status',async()=>{
 const mock=mockFirestore();
 try{
  assert.equal((await doAction('alice',guitar,'apply')).status,200);
  assert.equal((await doAction('bob',guitar,'apply')).status,200);
  assert.equal((await doManage('leader',guitar,'approve')).status,200);
  assert.equal((await doAction('alice',guitar,'return')).status,200);
  const before=mock.stats.writes;
  assert.equal((await doManage('leader',guitar,'force-available')).status,200);
  assert.equal(mock.stats.writes,before+1);
  const item=byId(await view('leader',true));
  assert.equal(item.status,'대여 가능');
  assert.equal(item.queue.length,0);
  assert.equal(item.borrower,null);
  assert.equal(item.returnRequestedAt,null);
  assert.equal((await doManage('leader',guitar,'edit',{name:'기타',product:'바커스',status:'대여중'})).status,200);
  assert.equal(byId(await view(null)).status,'대여 가능');
 }finally{mock.restore();}
});

test('manager stores equipment image urls, validates HTTPS and publishes image to public inventory',async()=>{
 const mock=mockFirestore();
 try{
  assert.equal((await doManage('alice',guitar,'edit',{name:'기타',product:'바커스',imageUrl:'https://image.example/item.webp'})).status,403);
  assert.equal((await doManage('leader',guitar,'edit',{name:'기타',product:'바커스',imageUrl:'javascript:alert(1)'})).status,400);
  assert.equal((await doManage('leader',guitar,'edit',{name:'기타',product:'바커스',imageUrl:'https://image.example/item.webp'})).status,200);
  assert.equal(byId(await view(null)).imageUrl,'https://image.example/item.webp');
  assert.equal((await doManage('leader',guitar,'edit',{name:'기타',product:'바커스',imageUrl:''})).status,200);
  assert.equal(byId(await view(null)).imageUrl,'');
  const created=await doManage('leader',undefined,'add',{name:'키보드',product:'Nord Stage',imageUrl:'https://image.example/keyboard.webp'});
  assert.equal(created.status,201);
  assert.equal(byId(await view(null),created.data.id).imageUrl,'https://image.example/keyboard.webp');
 }finally{mock.restore();}
});
