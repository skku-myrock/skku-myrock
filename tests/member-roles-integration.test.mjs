import test from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { toFields, docFields } from '../functions/_lib/shared.js';
import { onRequestGet as list } from '../functions/api/members/list.js';
import { onRequestPost as sessions } from '../functions/api/members/sessions.js';
import { onRequestPost as details } from '../functions/api/members/details.js';
import { onRequestPost as permissions } from '../functions/api/members/permissions.js';
import { onRequestPost as resetPassword } from '../functions/api/members/reset-password.js';
import { onRequestPost as deleteMember } from '../functions/api/members/delete.js';
import { onRequestPost as register } from '../functions/api/members/register.js';
import { onRequestPost as purge, RESET_CONFIRMATION } from '../functions/api/members/purge.js';

test('signed tokens enforce role hierarchy through real handlers and Auth/Firestore stay in sync', async () => {
  const crypto = globalThis.crypto ?? webcrypto;
  if (!globalThis.crypto) globalThis.crypto = crypto;
  const keys = await crypto.subtle.generateKey({
    name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
    publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256',
  }, true, ['sign', 'verify']);
  const publicKey = {...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'test-firebase-key',alg:'RS256'};
  const privatePem = Buffer.from(await crypto.subtle.exportKey('pkcs8', keys.privateKey)).toString('base64');
  const env = { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    project_id:'skku-myrock',
    client_email:'tester@skku-myrock.iam.gserviceaccount.com',
    private_key:'-----BEGIN PRIVATE KEY-----\n'+privatePem+'\n-----END PRIVATE KEY-----\n',
  }) };
  const url64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const tokens = {};
  const actors = {
    part: {uid:'partLeader12345',role:'part_leader'},
    staff: {uid:'staffLeader12345',role:'staff'},
    president: {uid:'presidentLeader123',role:'president'},
    ob: {uid:'obFormerLeader123',role:'member',handoverAccess:true},
    super: {uid:'developerSuperadmin1',role:'president',superadmin:true},
  };
  for(const [name, actor] of Object.entries(actors)) {
    const header = url64({alg:'RS256',kid:'test-firebase-key'});
    const now = Math.floor(Date.now()/1000);
    const payload = url64({
      aud:'skku-myrock',iss:'https://securetoken.google.com/skku-myrock',
      sub:actor.uid,iat:now,exp:now+3600,auth_time:now-20,
      ...(actor.superadmin ? { superadmin: true } : {}),
    });
    const unsigned = header+'.'+payload;
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(unsigned));
    tokens[name] = unsigned+'.'+Buffer.from(signature).toString('base64url');
  }
  const root = 'projects/skku-myrock/databases/(default)/documents/users/';
  let nextTime = 1;
  const timestamp = () => '2026-10-14T12:00:'+String(nextTime++).padStart(2,'0')+'Z';
  const docs = new Map();
  const add = (uid, data) => docs.set(uid,{
    name:root+uid,fields:toFields(data),updateTime:timestamp(),
  });
  for(const actor of Object.values(actors))add(actor.uid,{
    studentId:'2026123456',name:'운영진',generation:'29',
    sessions:['기타'],positions:[],role:actor.role,handoverAccess:actor.handoverAccess===true,
    ...(actor.superadmin ? {superadmin: true} : {}),
  });
  const uid = 'testMember12345';
  add(uid,{
    studentId:'2026300001',name:'홍길동',generation:'29',
    sessions:['기타'],positions:[],role:'member',handoverAccess:false,
  });
  const accounts = new Map([[uid,{
    localId:uid,email:'2026300001@members.skku-myrock.firebaseapp.com',displayName:'홍길동',
  }]]);
  for (const actor of Object.values(actors)) {
    accounts.set(actor.uid, {
      localId: actor.uid,
      email: actor.uid + '@members.skku-myrock.firebaseapp.com',
      displayName: '운영진',
    });
  }
  for (const extraUid of ['extraRosterOne123','extraRosterTwo123','extraRosterThree123']) {
    add(extraUid,{studentId:'2026123999',name:'추가테스트',generation:'29',
      sessions:['기타'],positions:[],role:'member',handoverAccess:false});
    accounts.set(extraUid,{localId:extraUid,
      email:extraUid+'@members.skku-myrock.firebaseapp.com',displayName:'추가테스트'});
  }

  let lastResetPassword = null;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (rawUrl, options={}) => {
    const url = new URL(String(rawUrl));
    const body = typeof options.body === 'string' && options.body.startsWith('{') ? JSON.parse(options.body) : {};
    const response = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'max-age=900'}});
    if (url.pathname.includes('/service_accounts/v1/jwk/'))return response({keys:[publicKey]});
    if (url.hostname==='oauth2.googleapis.com')return response({access_token:'test-access-token',expires_in:3600});
    if (url.hostname==='firestore.googleapis.com') {
      const slash = url.pathname.lastIndexOf('/users');
      const suffix = url.pathname.slice(slash+'/users'.length);
      if (suffix==='') {
        if (url.searchParams.has('orderBy')) {
          assert.equal(url.searchParams.get('orderBy'),'name asc, __name__ asc');
          assert.equal(url.searchParams.get('pageSize'),'30');
        } else {
          assert.equal(url.searchParams.get('pageSize'),'20');
        }
        return response({documents:[...docs.values()],nextPageToken:null});
      }
      const selected = decodeURIComponent(suffix.slice(1));
      if (options.method === 'PATCH') {
        const old=docs.get(selected);
        if(!old)return response({error:{message:'NOT_FOUND'}},404);
        if(url.searchParams.get('currentDocument.updateTime')!==old.updateTime)return response({error:{message:'PRECONDITION'}},412);
        docs.set(selected,{...old,fields:{...old.fields,...body.fields},updateTime:timestamp()});
        return response(docs.get(selected));
      }
      if (options.method === 'DELETE') {
        const old=docs.get(selected);
        if (!old || old.updateTime!==url.searchParams.get('currentDocument.updateTime'))return response({error:{}},412);
        docs.delete(selected);return response({});
      }
      return docs.has(selected) ? response(docs.get(selected)) : response({error:{}},404);
    }
    if (url.hostname==='identitytoolkit.googleapis.com') {
      if (url.pathname.endsWith('/accounts:lookup')) {
        const matches=[...accounts.values()].filter(account=>
          (body.localId ?? []).includes(account.localId) ||
          (body.email ?? []).includes(account.email));
        return response({users:matches});
      }
      if (url.pathname.endsWith('/accounts:update')) {
        const record=accounts.get(body.localId);
        if (!record)return response({error:{message:'USER_NOT_FOUND'}},404);
        if(body.email)record.email=body.email;
        if(body.displayName!==undefined)record.displayName=body.displayName;
        if(body.password!==undefined)lastResetPassword=body.password;
        return response({localId:record.localId});
      }
      if (url.pathname.endsWith('/accounts:delete')) {
        accounts.delete(body.localId);return response({});
      }
    }
    throw Error('Unmocked network call '+url.href);
  };
  const get = (as) => new Request('https://skku-myrock.pages.dev/api/members/list',{headers:{authorization:'Bearer '+tokens[as]}});
  const post = (as,path,payload) => new Request('https://skku-myrock.pages.dev/api/members/'+path,{
    method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+tokens[as]},
    body:JSON.stringify(payload),
  });
  try {
    assert.equal((await list({request:get('ob'),env})).status,403);
    assert.equal((await list({request:get('part'),env})).status,200);
    const original = docs.get(uid).updateTime;
    assert.equal((await details({request:post('part','details',{
      uid,name:'새이름',studentId:'2026300002',generation:'30',positions:[],expectedUpdateTime:original,
    }),env})).status,403);
    assert.equal((await register({request:post('part','register',{members:[{
      studentId:'2026300002',name:'새이름',generation:'30',sessions:['기타'],positions:[],
    }]}),env})).status,403);
    assert.equal((await sessions({request:post('part','sessions',{
      uid,sessions:['보컬','기타'],expectedUpdateTime:original,
    }),env})).status,200);
    assert.deepEqual(docFields(docs.get(uid)).sessions,['보컬','기타']);
    assert.equal((await resetPassword({request:post('staff','reset-password',{uid}),env})).status,403);
    assert.equal((await permissions({request:post('staff','permissions',{
      uid,role:'president',handoverAccess:false,expectedUpdateTime:docs.get(uid).updateTime,
    }),env})).status,403);
    assert.equal((await deleteMember({request:post('staff','delete',{
      uid,expectedUpdateTime:docs.get(uid).updateTime,
    }),env})).status,403);
    assert.equal((await details({request:post('staff','details',{
      uid,name:'홍길순',studentId:'2026300002',generation:'29.5',positions:['홍보부장'],
      expectedUpdateTime:docs.get(uid).updateTime,
    }),env})).status,200);
    assert.equal(accounts.get(uid).email,'2026300002@members.skku-myrock.firebaseapp.com');
    assert.equal(accounts.get(uid).displayName,'홍길순');
    assert.equal(docFields(docs.get(uid)).studentId,'2026300002');
    assert.equal(docFields(docs.get(uid)).name,'홍길순');
    assert.equal((await permissions({request:post('president','permissions',{
      uid,role:'part_leader',handoverAccess:true,expectedUpdateTime:docs.get(uid).updateTime,
    }),env})).status,200);
    assert.equal(docFields(docs.get(uid)).role,'part_leader');
    assert.equal(docFields(docs.get(uid)).handoverAccess,false, 'non-members do not retain the OB-only flag');
    assert.equal((await permissions({request:post('president','permissions',{
      uid,role:'member',handoverAccess:true,expectedUpdateTime:docs.get(uid).updateTime,
    }),env})).status,200);
    assert.equal(docFields(docs.get(uid)).handoverAccess,true);
    assert.equal((await resetPassword({request:post('president','reset-password',{uid}),env})).status,200);
    assert.equal(lastResetPassword,'2026300002');
    assert.equal((await deleteMember({request:post('president','delete',{
      uid,expectedUpdateTime:docs.get(uid).updateTime,
    }),env})).status,200);
    assert.equal(docs.has(uid),false);
    assert.equal(accounts.has(uid),false);
    // The current president account cannot be deleted by themselves.
    assert.equal((await deleteMember({request:post('president','delete',{
      uid:actors.president.uid,expectedUpdateTime:docs.get(actors.president.uid).updateTime,
    }),env})).status,403);
    assert.equal((await purge({request:post('president','purge',{confirmation:RESET_CONFIRMATION}),env})).status,403);
    assert.equal((await purge({request:post('super','purge',{confirmation:'wrong'}),env})).status,400);
    let totalRemoved = 0;
    let completed = false;
    for (let iteration = 0; iteration < 10 && !completed; iteration++) {
      const response = await purge({request:post('super','purge',{confirmation:RESET_CONFIRMATION}),env});
      assert.equal(response.status,200);
      const data = await response.json();
      assert.equal(data.error,undefined);
      assert.ok(data.deleted >= 0 && data.deleted <= 5);
      totalRemoved += data.deleted;
      completed = data.done;
    }
    assert.equal(completed,true);
    assert.equal(totalRemoved,7);
    assert.deepEqual([...docs.keys()],[actors.super.uid]);
    assert.deepEqual([...accounts.keys()],[actors.super.uid]);

  } finally {
    globalThis.fetch = previousFetch;
  }
});


test('handover checkbox is only shown for a selected general member', async () => {
  const component = await readFile(new URL('../src/MemberManager.tsx', import.meta.url), 'utf8');
  assert.match(component, /\{editing\.role === 'member' && <label className="member-handover-check"/);
  assert.match(component, /인수인계 내용 접근 권한 설정/);
  assert.match(component, /권한에 'OB 운영진'이라고 표시됩니다/);
  assert.doesNotMatch(component, /OB 운영진 · 인수인계 접근/);
  assert.match(component, /handoverAccess: updated\.role === 'member' && updated\.handoverAccess/);
});
