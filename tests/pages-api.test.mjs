import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMembers, validatePermissions, toFields, docFields,
  memberView, secureOrigin, ApiError, initialPasswordForStudentId,
  canPerform, validateDetails, validateSessionsChange,
} from '../functions/_lib/shared.js';
import { onRequestPost as registerHandler } from '../functions/api/members/register.js';
import { onRequestPost as permissionHandler } from '../functions/api/members/permissions.js';
import { onRequestGet as listHandler } from '../functions/api/members/list.js';
import { onRequestGet as healthHandler } from '../functions/api/health.js';
import { onRequestPost as previewHandler } from '../functions/api/members/preview.js';
import { onRequestPost as sessionsHandler } from '../functions/api/members/sessions.js';
import { onRequestPost as detailsHandler } from '../functions/api/members/details.js';
import { onRequestPost as resetHandler } from '../functions/api/members/reset-password.js';
import { onRequestPost as deleteHandler } from '../functions/api/members/delete.js';
import { onRequestPost as purgeHandler, RESET_CONFIRMATION } from '../functions/api/members/purge.js';
import { requireFreshVersion, requireMutableTarget } from '../functions/_lib/google.js';

const alice = {
  studentId: '2026300001',
  name: '테스트 회원',
  generation: '27.5',
  sessions: ['보컬', '기타'],
  positions: ['보컬파트장'],
};

test('register validates allowed member payload', () => {
  assert.deepEqual(validateMembers([alice]), [alice]);
  assert.throws(() => validateMembers([]), /요청당/);
  assert.throws(() => validateMembers(Array.from({ length: 6 }, (_, i) => ({...alice,studentId:'202630000'+i}))), /5명/);
  assert.throws(() => validateMembers([alice, alice]), /중복 학번/);
  assert.throws(() => validateMembers([{...alice, sessions: ['바이올린']}]), /세션/);
  assert.throws(() => validateMembers([{...alice, studentId:'user@example.com'}]), /학번/);
  assert.throws(() => validateMembers([{...alice, name:''}]), /이름/);
});
test('role changes cannot add unknown privileges', () => {
  assert.deepEqual(validatePermissions({
    uid: 'abcdefghij_12',
    role: 'member',
    handoverAccess: true,
    expectedUpdateTime: '2026-10-14T12:00:00Z',
  }), {uid:'abcdefghij_12',role:'member',handoverAccess:true,expectedUpdateTime:'2026-10-14T12:00:00Z'});
  assert.throws(() => validatePermissions({uid:'abcdefghij_12',role:'superadmin',handoverAccess:true,expectedUpdateTime:'2026-10-14T12:00:00Z'}), /회원 권한/);
  assert.throws(() => validatePermissions({uid:'abcdefghij_12',role:'president',handoverAccess:'true',expectedUpdateTime:'2026-10-14T12:00:00Z'}), /인수인계/);
});
test('Firestore fields serialize sessions, booleans, and protected flag', () => {
  const fields = toFields({...alice, role:'president', handoverAccess:false, superadmin:true});
  const doc = {name:'projects/skku-myrock/databases/(default)/documents/users/uid-123',fields};
  assert.deepEqual(docFields(doc).sessions, alice.sessions);
  assert.equal(memberView(doc).protected,true);
  assert.equal(memberView(doc).handoverAccess,false);
  assert.equal(memberView(doc).role,'president');
});
test('cross-site Origin is blocked', () => {
  const ok = new Request('https://skku-myrock.pages.dev/api/members/register', {headers:{origin:'https://skku-myrock.pages.dev'}});
  assert.doesNotThrow(() => secureOrigin(ok));
  const bad = new Request('https://skku-myrock.pages.dev/api/members/register', {headers:{origin:'https://evil.example'}});
  assert.throws(() => secureOrigin(bad), error => error instanceof ApiError && error.status === 403);
});
test('all membership API routes reject requests without login', async () => {
  const get = new Request('https://skku-myrock.pages.dev/api/members/list');
  const post = new Request('https://skku-myrock.pages.dev/api/members/register', {
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({members:[alice]}),
  });
  const preview = new Request('https://skku-myrock.pages.dev/api/members/preview', {
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({members:[alice]}),
  });
  const permissions = new Request('https://skku-myrock.pages.dev/api/members/permissions', {
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({uid:'abcdefghij_12',role:'president',handoverAccess:false,positions:[]}),
  });
  for (const [handler, request] of [[listHandler,get],[previewHandler,preview],[registerHandler,post],[permissionHandler,permissions],[sessionsHandler,post],[detailsHandler,post],[resetHandler,post],[deleteHandler,post],[purgeHandler,post]]) {
    const response = await handler({request,env:{}});
    assert.equal(response.status,401);
    assert.equal(response.headers.get('cache-control'),'no-store');
  }
});

test('Pages health route reports deployment and presence of encrypted binding only', async () => {
  const response = healthHandler({ env: { FIREBASE_SERVICE_ACCOUNT: 'present' } });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data, {
    service: 'myrock-pages-api',
    deployed: true,
    firebaseSecretConfigured: true,
  });
  assert.equal(JSON.stringify(data).includes('present'), false);
});

test('new account initial password matches the exact 10-digit student ID', () => {
  assert.equal(initialPasswordForStudentId('2026300001'), '2026300001');
  assert.equal(initialPasswordForStudentId('0123456789'), '0123456789');
  assert.throws(() => initialPasswordForStudentId('202630001'), /10자리/);
  assert.throws(() => initialPasswordForStudentId('20263000001'), /10자리/);
  assert.throws(() => initialPasswordForStudentId('abcdef0123'), /10자리/);
});

test('privilege matrix is monotonic and OB handover alone never grants member access', () => {
  const roles = ['member', 'part_leader', 'staff', 'president'];
  for (let i = 0; i < roles.length; i++) {
    const caller = { role: roles[i], superadmin: false };
    assert.equal(canPerform(caller, 'part_leader'), i >= 1);
    assert.equal(canPerform(caller, 'staff'), i >= 2);
    assert.equal(canPerform(caller, 'president'), i >= 3);
  }
  assert.equal(canPerform({role:'member',handoverAccess:true},'part_leader'), false);
  assert.equal(canPerform({role:'member',superadmin:true},'president'), true);
});
test('staff detail and part-leader session payloads use explicit fields and versions', () => {
  const t = '2026-10-14T12:00:00Z';
  assert.deepEqual(validateSessionsChange({uid:'abcdefghij_12',sessions:['보컬','기타'],expectedUpdateTime:t}),
    {uid:'abcdefghij_12',sessions:['보컬','기타'],expectedUpdateTime:t});
  assert.deepEqual(validateDetails({uid:'abcdefghij_12',name:'홍길동',studentId:'2026300001',generation:'29',positions:['파트장'],expectedUpdateTime:t}),
    {uid:'abcdefghij_12',name:'홍길동',studentId:'2026300001',generation:'29',positions:['파트장'],expectedUpdateTime:t});
  assert.throws(() => validateSessionsChange({uid:'abcdefghij_12',sessions:['unknown'],expectedUpdateTime:t}),/세션/);
  assert.throws(() => validateDetails({uid:'abcdefghij_12',name:'홍길동',studentId:'1',generation:'29',positions:[],expectedUpdateTime:t}),/학번/);
  assert.throws(() => validateDetails({uid:'abcdefghij_12',name:'홍길동',studentId:'2026300001',generation:'29',positions:[],expectedUpdateTime:'stale'}),/다시 조회/);
});
test('protected admin account and stale versions cannot be modified by others', () => {
  const caller = {uid:'abcdefghij_12',role:'president',superadmin:false};
  const target = {updateTime:'2026-10-14T12:00:00Z',fields:{superadmin:{booleanValue:true}}};
  assert.throws(() => requireMutableTarget(caller,target,'protected-member'), /시스템 관리자/);
  assert.throws(() => requireMutableTarget(caller,{fields:{}},caller.uid,{protectSelf:true}), /본인/);
  assert.throws(() => requireFreshVersion(target,'2026-10-14T13:00:00Z'),/새로고침/);
  assert.doesNotThrow(() => requireFreshVersion(target,target.updateTime));
});

test('development reset route requires a signed login before accepting confirmation', async () => {
  const request = new Request('https://skku-myrock.pages.dev/api/members/purge', {
    method: 'POST', headers: {'content-type':'application/json'},
    body: JSON.stringify({confirmation: RESET_CONFIRMATION}),
  });
  const response = await purgeHandler({request,env:{}});
  assert.equal(response.status,401);
  assert.equal(response.headers.get('cache-control'),'no-store');
});
