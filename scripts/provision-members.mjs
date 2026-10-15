import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, mkdirSync, openSync, writeSync, closeSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const source = process.argv[2] ?? 'private/members.json';
const apply = process.argv.includes('--apply');
const resetExisting = process.argv.includes('--reset-existing');
const projectId = 'skku-myrock';
const allowed = ['보컬', '기타', '베이스', '드럼', '키보드'];
const members = JSON.parse(readFileSync(source, 'utf8'));
if (!Array.isArray(members) || !members.length) throw Error('멤버 JSON 배열이 필요합니다.');
const ids = new Set();
for (const m of members) {
  if (!/^\d{10}$/.test(m.studentId) || ids.has(m.studentId)) throw Error('학번 형식 또는 중복 오류');
  if (typeof m.name !== 'string' || !m.name.trim()) throw Error('이름 누락');
  if (!Array.isArray(m.sessions) || !m.sessions.length || m.sessions.some(s=>!allowed.includes(s)) || new Set(m.sessions).size !== m.sessions.length) throw Error('세션 오류: '+m.studentId);
  if (!Array.isArray(m.positions) || typeof m.generation !== 'string') throw Error('직책/기수 형식 오류');
  ids.add(m.studentId);
}
console.log(`${members.length}명 유효성 검사 완료. ${apply ? '실제 등록 모드' : '검증 전용 모드'}`);
if (!apply) { console.log('Firebase에 등록하려면: node scripts/provision-members.mjs private/members.json --apply'); process.exit(0); }

initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const db = getFirestore();
const out = resolve('private/initial-credentials.csv');
mkdirSync(dirname(out), {recursive: true});
if (existsSync(out)) throw Error(`${out} 파일이 이미 있습니다. 초기 비밀번호를 보관하거나 이름을 변경한 후 다시 실행하세요.`);
const fd = openSync(out, 'wx', 0o600);
const csv = value => `"${String(value).replaceAll('"','""')}"`;
writeSync(fd, 'studentId,name,initialPassword,status\n');
try {
  for (const m of members) {
    const email = `${m.studentId}@members.skku-myrock.firebaseapp.com`;
    let user;
    let password = '';
    let status = 'existing';
    try { user = await auth.getUserByEmail(email); }
    catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
      password = randomBytes(24).toString('base64url');
      user = await auth.createUser({email, password, displayName:m.name, emailVerified:false});
      status = 'created';
    }
    writeSync(fd,[m.studentId,m.name,password,status].map(csv).join(',')+'\n');
    // Never alter an existing account's role or password during routine import.
    const ref = db.collection('users').doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) await ref.create({
      studentId:m.studentId, name:m.name, generation:m.generation,
      sessions:m.sessions, positions:m.positions, role:'member',
      createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp(),
    });
    else if (resetExisting) console.warn(`${m.studentId}: 기존 프로필은 유지합니다. 비밀번호 재설정도 수행하지 않습니다.`);
    console.log(`${m.studentId}: ${status}`);
  }
} finally { closeSync(fd); }
console.log(`임시 비밀번호는 ${out}에만 저장했습니다. 절대 GitHub에 업로드하지 마세요.`);
