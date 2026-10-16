import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { toFields, docFields } from '../functions/_lib/shared.js';
import { normalizeDonation, normalizeAnonymousPeople, publicDonation } from '../functions/_lib/donations.js';
import { onRequestGet as publicGet } from '../functions/api/donations/public.js';
import { onRequestGet as mineGet } from '../functions/api/donations/mine.js';
import { onRequestGet as manageGet,onRequestPost as managePost } from '../functions/api/donations/manage.js';
import { onRequestPost as purgePost, DONATIONS_RESET_CONFIRMATION } from '../functions/api/donations/purge.js';
import { DEFAULT_ABOUT,normalizeAbout } from '../functions/_lib/aboutContent.js';
import { onRequestGet as publicAboutGet,onRequestPost as aboutPost } from '../functions/api/about/content.js';
import { onRequestGet as manageAboutGet } from '../functions/api/about/manage.js';
import { onRequestPost as aboutImagePost } from '../functions/api/about/image.js';
import {onRequestPost as batchImagePost} from '../functions/api/images/batch.js';
import { normalizeAccount,normalizeTransaction,DEFAULT_ACCOUNT } from '../functions/_lib/financeTransactions.js';
import { onRequestGet as accountGet,onRequestPost as accountPost } from '../functions/api/finance/account.js';
import { onRequestGet as accountManageGet } from '../functions/api/finance/account-manage.js';
import { onRequestGet as expensesGet } from '../functions/api/finance/expenses.js';
import { onRequestGet as expensesManageGet,onRequestPost as expensesManagePost } from '../functions/api/finance/expenses-manage.js';

test('CSV semantics: only o is anonymous; unrecognized identifiers and same-name people are handled safely', () => {
  const sample={date:'2026-10-04',donorName:'홍길동',studentId:'2026300001',amount:'10000',anonymous:'o'};
  assert.equal(normalizeDonation({...sample,anonymous:'o'}).anonymous,'o');
  for(const flag of ['','x','NO','1','false','O'])assert.equal(normalizeDonation({...sample,anonymous:flag}).anonymous,'x');
  assert.equal(publicDonation({...sample,id:'donation1'},[]).donorName,'익명');
  assert.equal(publicDonation({...sample,id:'donation1',anonymous:'x'},[]).donorName,'홍길동');
  assert.equal(publicDonation({...sample,id:'donation1',anonymous:'x',studentId:''},[]).donorName,'익명');
  assert.equal(publicDonation({...sample,id:'donation1',anonymous:'x',donorName:''},[]).donorName,'익명');
  assert.throws(()=>normalizeAnonymousPeople([{donorName:'홍길동',studentId:''}]),/이름과 숫자 10자리 학번/);
  assert.throws(()=>normalizeAnonymousPeople([{donorName:'',studentId:'2026300001'}]),/이름과 숫자 10자리 학번/);
  assert.throws(()=>normalizeAnonymousPeople([{donorName:'홍길동',studentId:'20263'}]),/이름과 숫자 10자리 학번/);
  assert.equal(publicDonation({...sample,id:'donation1',anonymous:'x'},[{donorName:'',studentId:'2026300001'}]).donorName,'홍길동');
  assert.equal(publicDonation({...sample,id:'donation1',anonymous:'x'},[{donorName:'홍길동',studentId:''}]).donorName,'홍길동');
  const people=normalizeAnonymousPeople([{donorName:'홍길동',studentId:'2026300001'}]);
  assert.equal(publicDonation({...sample,id:'donation1',anonymous:'x'},people).donorName,'익명');
  assert.equal(publicDonation({...sample,id:'donation1',studentId:'2026300002',anonymous:'x'},people).donorName,'홍길동');
  assert.throws(()=>normalizeDonation({...sample,studentId:'not-an-id'}),/학번/);
  assert.throws(()=>normalizeDonation({...sample,amount:'-10'}),/후원금액/);
});
test('club introduction validates officer names, history and safe image URL schemes',()=>{
  assert.equal(normalizeAbout(DEFAULT_ABOUT).officers.length,8);
  assert.equal(normalizeAbout(DEFAULT_ABOUT).history.length,2);
  assert.throws(()=>normalizeAbout({...DEFAULT_ABOUT,heroImage:'javascript:alert(1)'}),/HTTPS/);
  assert.throws(()=>normalizeAbout({...DEFAULT_ABOUT,history:[{id:'x',year:'',description:'내용'}]}),/연혁 연도/);
  assert.throws(()=>normalizeAbout({...DEFAULT_ABOUT,officers:[{id:'x',name:'',position:'운영진',photoUrl:''}]}),/운영진 이름/);
  assert.throws(()=>normalizeAbout({...DEFAULT_ABOUT,officers:[{id:'dup',name:'A',position:'실무단',photoUrl:''}],
    history:[{id:'dup',year:'2026',description:'창단'}]}),/ID/);
});
test('CSV file parsing supports optional names and student IDs and safe re-export',async()=>{
  const ts=await readFile(new URL('../src/donationData.ts',import.meta.url),'utf8');
  const typescript=await import('typescript');
  const js=typescript.default.transpileModule(ts,{compilerOptions:{module:typescript.default.ModuleKind.ESNext,target:typescript.default.ScriptTarget.ES2022}}).outputText;
  const {parseDonationCsv,serializeDonationCsv,sumDonationAmounts,donationDateRange,displayAmount}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const input='\uFEFF후원일,후원자명,학번,후원금액,익명여부\r\n2026-01-01,홍길동,2026300001,10000,o\r\n2026-02-02,,,5000,\r\n2026-02-03,"홍,길동",,7000,X\r\n';
  const rows=parseDonationCsv(input);
  assert.equal(rows.length,3);
  assert.deepEqual(rows.map(r=>r.anonymous),['o','x','x']);
  assert.equal(rows[1].studentId,'');
  assert.equal(rows[2].donorName,'홍,길동');
  assert.equal(parseDonationCsv(serializeDonationCsv(rows)).length,3);
  assert.equal(sumDonationAmounts([{amount:'1234'},{amount:'8766'}]),'10000');
  assert.equal(sumDonationAmounts([{amount:'9007199254740993'},{amount:'7'}]),'9007199254741000');
  assert.equal(sumDonationAmounts([]),'0');
  assert.equal(displayAmount(sumDonationAmounts([{amount:'9007199254740993'},{amount:'7'}])),'9,007,199,254,741,000원');
  assert.deepEqual(donationDateRange([rows[2],rows[0],rows[1]]),{start:'2026-01-01',end:'2026-02-03'});
  assert.equal(donationDateRange([]),null);
  assert.throws(()=>parseDonationCsv('후원일,이름\n2026-01-01,홍길동'),/헤더/);
  assert.throws(()=>parseDonationCsv('후원일,후원자명,학번,후원금액,익명여부\n2026-01-01,홍길동,2,1000,x'),/학번/);
});
test('expense CSV template, preview and upload parser support quoted content and reject malformed data',async()=>{
  const ts=await import('typescript');
  const options={compilerOptions:{module:ts.default.ModuleKind.ESNext,target:ts.default.ScriptTarget.ES2022}};
  const donor=await readFile(new URL('../src/donationData.ts',import.meta.url),'utf8');
  const source=(await readFile(new URL('../src/financeTransactions.ts',import.meta.url),'utf8'))
    .replace("import { auth } from './firebase';",'')
    .replace("import { readCsv } from './donationData';",'');
  const js=ts.default.transpileModule(donor,options).outputText+'\n'+ts.default.transpileModule(source,options).outputText;
  const {parseTransactionCsv,transactionCsvExample,transactionCsvDateRange,downloadTransactions}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const template=transactionCsvExample();
  assert.match(template,/"거래일시","거래구분","거래금액","거래 후 잔액","거래내용"/);
  const sample=parseTransactionCsv(template);
  assert.equal(sample.length,2);
  assert.equal(sample[0].dateTime,'2026-10-14T09:30');
  assert.equal(sample[1].type,'출금');
  const quoted=downloadTransactions([{dateTime:'2026-10-14T18:45',type:'입금',amount:'3000',balance:'148000',description:'"합주, 저녁"'}]);
  assert.equal(parseTransactionCsv(quoted)[0].description,'"합주, 저녁"');
  assert.deepEqual(transactionCsvDateRange([sample[1],sample[0]]),{start:'2026-10-14 09:30',end:'2026-10-14 15:30'});
  assert.equal(transactionCsvDateRange([]),null);
  assert.throws(()=>parseTransactionCsv('거래일시,금액\n2026-10-14,100'),/CSV 헤더/);
  assert.throws(()=>parseTransactionCsv('거래일시,거래구분,거래금액,거래 후 잔액,거래내용\n2026-10-14,입금,10,50,수입'),/2026-10-14 15:30/);
  assert.throws(()=>parseTransactionCsv('거래일시,거래구분,거래금액,거래 후 잔액,거래내용\n2026-10-14 24:00,입금,10,50,수입'),/거래일시/);
  assert.throws(()=>parseTransactionCsv('거래일시,거래구분,거래금액,거래 후 잔액,거래내용\n2026-10-14 09:30,지출,10,50,사용'),/거래구분/);
  assert.throws(()=>parseTransactionCsv('거래일시,거래구분,거래금액,거래 후 잔액,거래내용\n2026-10-14 09:30,입금,0,50,수입'),/거래금액/);
});
test('transaction records validate complete bank activity and the requested default account',()=>{
  assert.deepEqual(DEFAULT_ACCOUNT,{bank:'농협',number:'302-0000-0000-31',holder:'나재원'});
  assert.deepEqual(normalizeAccount(DEFAULT_ACCOUNT),DEFAULT_ACCOUNT);
  const transaction={dateTime:'2026-10-15T12:30',type:'출금',amount:'10000',balance:'50000',description:'동아리 장비'};
  assert.deepEqual(normalizeTransaction(transaction),transaction);
  assert.throws(()=>normalizeTransaction({...transaction,dateTime:'2026-02-30T12:30'}),/거래일시/);
  assert.throws(()=>normalizeTransaction({...transaction,type:'수익'}),/거래구분/);
  assert.throws(()=>normalizeTransaction({...transaction,amount:'-10000'}),/거래금액/);
  assert.throws(()=>normalizeTransaction({...transaction,balance:'-100'}),/잔액/);
  assert.throws(()=>normalizeTransaction({...transaction,description:''}),/거래내용/);
});
test('private profile checks, role matrix, database writes and superadmin finance reset are enforced by real handlers',async()=>{
  if(!globalThis.crypto)globalThis.crypto=webcrypto;
  const keys=await globalThis.crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,
    publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk={...await globalThis.crypto.subtle.exportKey('jwk',keys.publicKey),kid:'donation-key',alg:'RS256'};
  const pem=Buffer.from(await globalThis.crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64');
  const env={FIREBASE_SERVICE_ACCOUNT:JSON.stringify({project_id:'skku-myrock',
    client_email:'tests@skku-myrock.iam.gserviceaccount.com',
    private_key:'-----BEGIN PRIVATE KEY-----\n'+pem+'\n-----END PRIVATE KEY-----\n'})};
  const actors={part:{uid:'donationPart1234',role:'part_leader',studentId:'2026300004'},member:{uid:'donationMember123',role:'member',studentId:'2026300001'},
    staff:{uid:'donationStaff1234',role:'staff',studentId:'2026300002'},
    super:{uid:'donationSuper1234',role:'member',studentId:'2026300003',superadmin:true}};
  const token={};
  for(const [key,actor] of Object.entries(actors)){
    const now=Math.floor(Date.now()/1000);
    const first=Buffer.from(JSON.stringify({alg:'RS256',kid:'donation-key'})).toString('base64url');
    const second=Buffer.from(JSON.stringify({aud:'skku-myrock',
      iss:'https://securetoken.google.com/skku-myrock',sub:actor.uid,iat:now,exp:now+1800,auth_time:now-60,
      ...(actor.superadmin?{superadmin:true}:{})})).toString('base64url');
    const payload=first+'.'+second;
    const signature=await globalThis.crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(payload));
    token[key]=payload+'.'+Buffer.from(signature).toString('base64url');
  }
  const root='projects/skku-myrock/databases/(default)/documents';
  const docs=new Map();
  let version=0;
  const now=()=>'2026-10-15T12:00:'+String(++version).padStart(2,'0')+'Z';
  const put=(path,values)=>docs.set(root+path,{name:root+path,fields:toFields(values),updateTime:now()});
  for(const actor of Object.values(actors))put('/users/'+actor.uid,{studentId:actor.studentId,role:actor.role,
    superadmin:actor.superadmin===true,name:'테스터'});
  put('/donations/11111111-1111-4111-8111-111111111111',{date:'2026-10-04',donorName:'홍길동',
    studentId:'2026300001',amount:'10000',anonymous:'x'});
  put('/donations/22222222-2222-4222-8222-222222222222',{date:'2026-10-03',donorName:'홍길동',
    studentId:'2026300002',amount:'20000',anonymous:'x'});
  put('/donations/33333333-3333-4333-8333-333333333333',{date:'2026-10-02',donorName:'',
    studentId:'',amount:'500',anonymous:'x'});
  put('/financeSettings/anonymousDonors',{people:[{donorName:'홍길동',studentId:'2026300001'}]});
  const previousFetch=globalThis.fetch;
  globalThis.fetch=async(raw,options={})=>{
    const uri=new URL(String(raw)),data=typeof options.body==='string'&&options.body.startsWith('{')?JSON.parse(options.body):null;
    const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
    if(uri.pathname.includes('/service_accounts/v1/jwk/'))return response({keys:[jwk]});
    if(uri.hostname==='oauth2.googleapis.com')return response({access_token:'test-access',expires_in:3600});
    if(uri.hostname==='api.github.com'&&uri.pathname.startsWith('/repos/skku-myrock/myrock-images/')){
      if(uri.pathname.endsWith('/git/ref/heads/main'))return response({object:{sha:'mock-main'}});
      if(uri.pathname.endsWith('/git/commits/mock-main'))return response({tree:{sha:'mock-tree'}});
      if(uri.pathname.endsWith('/git/blobs'))return response({sha:'mock-blob'});
      if(uri.pathname.endsWith('/git/trees'))return response({sha:'mock-new-tree'});
      if(uri.pathname.endsWith('/git/commits'))return response({sha:'mock-new-commit'});
      if(uri.pathname.endsWith('/git/refs/heads/main'))return response({});
      throw Error('unexpected GitHub image API '+uri.pathname);
    }
    if(uri.hostname==='firestore.googleapis.com'){
      let docPath=decodeURIComponent(uri.pathname.slice(uri.pathname.indexOf('/documents')+'/documents'.length));
      if(docPath===':commit'){
        for(const write of data.writes){docs.set(write.update.name,{name:write.update.name,fields:write.update.fields,updateTime:now()});}
        return response({writeResults:[]});
      }
      if(docPath===':runQuery'){
        const where=data?.structuredQuery?.where?.fieldFilter;
        assert.equal(where?.field?.fieldPath,'studentId');
        assert.equal(where?.op,'EQUAL');
        const matched=[...docs.values()].filter(doc=>doc.name.startsWith(root+'/donations/')&&docFields(doc).studentId===where.value.stringValue);
        return response(matched.map(doc=>({document:doc})));
      }
      const key=root+docPath;
      if(options.method==='PATCH'){
        const old=docs.get(key);
        if(uri.searchParams.get('currentDocument.exists')==='false'&&old)return response({error:{}},412);
        if(uri.searchParams.has('currentDocument.updateTime')&&uri.searchParams.get('currentDocument.updateTime')!==old?.updateTime)return response({error:{}},412);
        docs.set(key,{name:key,fields:data.fields,updateTime:now()});return response(docs.get(key));
      }
      if(options.method==='DELETE'){docs.delete(key);return response({});}
      if(docPath==='/expenseTransactions'){
        const found=[...docs.values()].filter(doc=>doc.name.startsWith(root+'/expenseTransactions/'));
        return response({documents:found});
      }
      if(docPath==='/donations'){
        const found=[...docs.values()].filter(doc=>doc.name.startsWith(root+'/donations/'));
        return response({documents:found});
      }
      return docs.has(key)?response(docs.get(key)):response({error:{}},404);
    }
    throw Error('unexpected external call '+uri.href);
  };
  const request=(as,path,body)=>new Request('https://skku-myrock.pages.dev/api/donations/'+path,{
    method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),
      ...(as?{authorization:'Bearer '+token[as]}:{})},body:body?JSON.stringify(body):undefined});
  try{
    const pub=await publicGet({request:request(null,'public'),env});
    assert.equal(pub.status,200);
    const publicBody=await pub.json();
    assert.deepEqual(publicBody.records.map(x=>x.donorName).sort(),['익명','익명','홍길동']);
    assert.ok(!JSON.stringify(publicBody).includes('2026300001'));
    assert.equal((await mineGet({request:request(null,'mine'),env})).status,401);
    const own=await mineGet({request:request('member','mine'),env});
    assert.equal(own.status,200);
    assert.deepEqual((await own.json()).records.map(x=>x.amount),['10000']);
    assert.equal((await manageGet({request:request('member','manage'),env})).status,403);
    assert.equal((await manageGet({request:request('staff','manage'),env})).status,200);
    const unauthorized=await managePost({request:request('member','manage',{action:'save',record:{date:'2026-10-05',
      donorName:'',studentId:'',amount:'5000',anonymous:''}}),env});
    assert.equal(unauthorized.status,403);
    const added=await managePost({request:request('staff','manage',{action:'save',record:{date:'2026-10-05',
      donorName:'',studentId:'',amount:'5000',anonymous:''}}),env});
    assert.equal(added.status,200);
    assert.equal((await added.json()).record.anonymous,'x');
    const recordsBefore=[...docs.values()].filter(doc=>doc.name.startsWith(root+'/donations/')).length;
    const imported=await managePost({request:request('staff','manage',{action:'import',rows:[{
      date:'2026-10-06',donorName:'',studentId:'',amount:'200',anonymous:'n',
    }]}),env});
    assert.equal(imported.status,200);
    assert.equal([...docs.values()].filter(doc=>doc.name.startsWith(root+'/donations/')).length,recordsBefore+1);
    const financeRequest=(as,path,body)=>new Request('https://skku-myrock.pages.dev/api/finance/'+path,{
      method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),
        ...(as?{authorization:'Bearer '+token[as]}:{})},body:body?JSON.stringify(body):undefined
    });
    const anonymousAccount=await accountGet({request:financeRequest(null,'account'),env});
    assert.equal(anonymousAccount.status,401);
    assert.ok(!JSON.stringify(await anonymousAccount.json()).includes(DEFAULT_ACCOUNT.number));
    const bank=await accountGet({request:financeRequest('member','account'),env});
    assert.equal(bank.status,200);
    assert.deepEqual((await bank.json()).account,DEFAULT_ACCOUNT);
    assert.equal((await accountManageGet({request:financeRequest('staff','account-manage'),env})).status,403);
    assert.equal((await accountPost({request:financeRequest('staff','account',{account:{bank:'농협',number:'302-0000-0000-31',holder:'나재원'},expectedUpdateTime:null}),env})).status,403);
    const changedAccount=await accountPost({request:financeRequest('super','account',{account:{bank:'농협',number:'302-0000-0000-31',holder:'나재원'},expectedUpdateTime:null}),env});
    assert.equal(changedAccount.status,200);
    assert.equal((await accountManageGet({request:financeRequest('super','account-manage'),env})).status,200);
    const bankVersion=(await changedAccount.json()).account.updateTime;
    assert.equal((await accountPost({request:financeRequest('super','account',{account:DEFAULT_ACCOUNT,expectedUpdateTime:'2026-10-15T00:00:01Z'}),env})).status,409);
    assert.equal((await accountPost({request:financeRequest('super','account',{account:DEFAULT_ACCOUNT,expectedUpdateTime:bankVersion}),env})).status,200);
    const aboutReq=(as,path,body)=>new Request('https://skku-myrock.pages.dev/api/about/'+path,{
      method:body?'POST':'GET',
      headers:{...(body?{'content-type':'application/json'}:{}),...(as?{authorization:'Bearer '+token[as]}:{})},
      body:body?JSON.stringify(body):undefined,
    });
    assert.equal((await publicAboutGet({request:aboutReq(null,'content'),env})).status,200);
    assert.equal((await manageAboutGet({request:aboutReq('member','manage'),env})).status,403);
    assert.equal((await manageAboutGet({request:aboutReq('staff','manage'),env})).status,200);
    assert.equal((await aboutPost({request:aboutReq('member','content',{content:DEFAULT_ABOUT}),env})).status,403);
    const stored=await aboutPost({request:aboutReq('staff','content',{content:DEFAULT_ABOUT,expectedUpdateTime:null}),env});
    assert.equal(stored.status,200);
    const storedVersion=(await stored.json()).updateTime;
    assert.equal((await aboutPost({request:aboutReq('staff','content',{content:DEFAULT_ABOUT,expectedUpdateTime:null}),env})).status,409);
    const modified={...DEFAULT_ABOUT,cohortLabel:'29기 운영진 소개'};
    assert.equal((await aboutPost({request:aboutReq('staff','content',{content:modified,expectedUpdateTime:storedVersion}),env})).status,200);
    assert.equal((await (await publicAboutGet({request:aboutReq(null,'content'),env})).json()).content.cohortLabel,'29기 운영진 소개');
    const imagePayload=new FormData();
    imagePayload.append('image',new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'}),'test.png');
    const publicFileRequest=await new Request('https://skku-myrock.pages.dev/api/about/image',{method:'POST',
      headers:{authorization:'Bearer '+token.member},body:imagePayload});
    assert.equal((await aboutImagePost({request:publicFileRequest,env})).status,403);
    const imageEnv={...env,GITHUB_IMAGES_TOKEN:'test-server-token',MYROCK_IMAGES_PUBLIC_BASE_URL:'https://myrock-images.pages.dev/'};
    const uploadPayload=new FormData();
    uploadPayload.append('image',new Blob([new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80])],{type:'image/webp'}),'test.webp');
    const uploadReq=new Request('https://skku-myrock.pages.dev/api/about/image',{method:'POST',
      headers:{authorization:'Bearer '+token.staff},body:uploadPayload});
    const uploaded=await aboutImagePost({request:uploadReq,env:imageEnv});
    assert.equal(uploaded.status,201);
    assert.match((await uploaded.json()).url,/^https:\/\/myrock-images\.pages\.dev\/site\//);
    // Staff may maintain site assets; part leaders may publish notice photos only.
    const imageBatchRequest=(actor,folder,type='image/webp')=>{
      const data=new FormData();
      data.append('folder',folder);
      data.append('images',new Blob([new Uint8Array(type==='image/gif'?[71,73,70,56,57,97]:[82,73,70,70,0,0,0,0,87,69,66,80])],{type}),type==='image/gif'?'animation.gif':'image.webp');
      return new Request('https://skku-myrock.pages.dev/api/images/batch',{method:'POST',headers:{authorization:'Bearer '+token[actor]},body:data});
    };
    assert.equal((await batchImagePost({request:imageBatchRequest('part','site'),env:imageEnv})).status,403);
    const noticeUploaded=await batchImagePost({request:imageBatchRequest('part','notices'),env:imageEnv});
    assert.equal(noticeUploaded.status,201);
    assert.match((await noticeUploaded.json()).urls[0],/^https:\/\/myrock-images\.pages\.dev\/notices\//);
    assert.equal((await batchImagePost({request:imageBatchRequest('part','notices','image/gif'),env:imageEnv})).status,400);
    const legacyGif=new FormData();
    legacyGif.append('image',new Blob([new Uint8Array([71,73,70,56,57,97])],{type:'image/gif'}),'animation.gif');
    assert.equal((await aboutImagePost({request:new Request('https://skku-myrock.pages.dev/api/about/image',{method:'POST',headers:{authorization:'Bearer '+token.staff},body:legacyGif}),env:imageEnv})).status,400);
    assert.equal((await expensesManageGet({request:financeRequest('member','expenses-manage'),env})).status,403);
    assert.equal((await expensesManageGet({request:financeRequest('staff','expenses-manage'),env})).status,200);
    const transaction={dateTime:'2026-10-15T12:30',type:'출금',amount:'10000',balance:'50000',description:'합주실 대여'};
    assert.equal((await expensesManagePost({request:financeRequest('member','expenses-manage',{action:'save',record:transaction}),env})).status,403);
    const expenseSaved=await expensesManagePost({request:financeRequest('staff','expenses-manage',{action:'save',record:transaction}),env});
    assert.equal(expenseSaved.status,200);
    const savedExpense=(await expenseSaved.json()).record;
    const publicExpenses=await expensesGet({request:financeRequest(null,'expenses'),env});
    assert.equal(publicExpenses.status,200);
    assert.equal((await publicExpenses.json()).records.length,1);
    assert.equal((await expensesManagePost({request:financeRequest('staff','expenses-manage',{action:'upload',rows:[]}),env})).status,400);
    assert.equal((await expensesManagePost({request:financeRequest('member','expenses-manage',{action:'import',rows:[transaction]}),env})).status,403);
    assert.equal((await expensesManagePost({request:financeRequest('staff','expenses-manage',{action:'import',rows:[]}),env})).status,400);
    const beforeInvalidBatch=[...docs.keys()].filter(k=>k.startsWith(root+'/expenseTransactions/')).length;
    assert.equal((await expensesManagePost({request:financeRequest('staff','expenses-manage',{action:'import',rows:[transaction,{...transaction,amount:'-1'}]}),env})).status,400);
    assert.equal([...docs.keys()].filter(k=>k.startsWith(root+'/expenseTransactions/')).length,beforeInvalidBatch);
    assert.equal((await expensesManagePost({request:financeRequest('staff','expenses-manage',{action:'import',rows:Array.from({length:21},()=>transaction)}),env})).status,400);
    const importedExpenses=await expensesManagePost({request:financeRequest('staff','expenses-manage',{action:'import',rows:[
      {...transaction,dateTime:'2026-10-14T08:10',type:'입금',amount:'5000',balance:'55000'},
      {...transaction,dateTime:'2026-10-14T15:30',type:'출금',amount:'3000',balance:'52000'},
    ]}),env});
    assert.equal(importedExpenses.status,200);
    assert.equal((await importedExpenses.json()).added,2);
    assert.equal((await (await expensesGet({request:financeRequest(null,'expenses'),env})).json()).records.length,3);
    assert.equal((await expensesManagePost({request:financeRequest('staff','expenses-manage',{action:'save',
      id:savedExpense.id,expectedUpdateTime:'2026-10-15T00:00:01Z',record:transaction}),env})).status,409);
    const editedExpense=await expensesManagePost({request:financeRequest('staff','expenses-manage',{action:'save',
      id:savedExpense.id,expectedUpdateTime:savedExpense.updateTime,record:{...transaction,description:'드럼 수리'}}),env});
    assert.equal(editedExpense.status,200);
    assert.equal((await editedExpense.json()).record.description,'드럼 수리');
    assert.equal((await purgePost({request:request('staff','purge',{confirmation:DONATIONS_RESET_CONFIRMATION}),env})).status,403);
    assert.equal((await purgePost({request:request('super','purge',{confirmation:'잘못된 확인'}),env})).status,400);
    let complete=false,removed=0;
    for(let attempt=0;attempt<12&&!complete;attempt++){
      const reset=await purgePost({request:request('super','purge',{confirmation:DONATIONS_RESET_CONFIRMATION}),env});
      assert.equal(reset.status,200);
      const result=await reset.json();
      complete=result.done;removed+=result.deleted;
    }
    assert.equal(complete,true);
    assert.ok(removed>=5);
    assert.equal([...docs.keys()].filter(key=>key.startsWith(root+'/donations/')).length,0);
    assert.equal([...docs.keys()].filter(key=>key.startsWith(root+'/expenseTransactions/')).length,0);
    assert.equal(docs.has(root+'/financeSettings/anonymousDonors'),false);
    assert.equal(docs.has(root+'/financeSettings/donationAccount'),true,'account details should be preserved');
    assert.equal(docs.has(root+'/users/'+actors.member.uid),true);
  }finally{globalThis.fetch=previousFetch;}
});
