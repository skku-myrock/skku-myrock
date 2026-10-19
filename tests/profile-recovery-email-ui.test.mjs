import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('recovery email settings use a full-width card above password change',async()=>{
  const [profile,panel,css]=await Promise.all([read('src/pages/SitePages.tsx'),read('src/RecoveryEmailSettings.tsx'),read('src/styles/base.css')]);
  assert.match(profile,/<RecoveryEmailSettings user=\{user\}\/>\s*<PasswordChange user=\{user\}\/>/);
  assert.match(css,/\.recovery-email-panel\{grid-column:1\/-1\}/);
  assert.match(panel,/<h2>이메일 설정<\/h2>/);
  assert.match(panel,/비밀번호 복구용 이메일을 설정합니다\./);
  assert.doesNotMatch(panel,/등록은 선택사항이며/);
  assert.doesNotMatch(panel,/htmlFor="recovery-email-input"/);
});

test('recovery email dialog verifies existing password without sending emails or saving data',async()=>{
  const panel=await read('src/RecoveryEmailSettings.tsx');
  assert.match(panel,/reauthenticateWithCredential\(user,credential\)/);
  assert.match(panel,/EmailAuthProvider\.credential\(user\.email,password\)/);
  assert.match(panel,/role="dialog" aria-modal="true"/);
  assert.match(panel,/type="email" autoComplete="email"/);
  assert.match(panel,/type="password" autoComplete="current-password"/);
  assert.match(panel,/이메일로 링크가 발송되었습니다\. 해당 이메일에서 인증을 완료해주세요/);
  assert.match(panel,/setRegisteredEmail\(email\.trim\(\)\)/);
  assert.match(panel,/setStatus\('registered'\)/);
  assert.doesNotMatch(panel,/verifyBeforeUpdateEmail|sendPasswordResetEmail|updateEmail|updateDoc|fetch\(/);
});

test('recovery status preview supports initial, registered and pending states',async()=>{
  const panel=await read('src/RecoveryEmailSettings.tsx');
  assert.match(panel,/useState<EmailPreviewStatus>\('unregistered'\)/);
  assert.match(panel,/registeredEmail\|\|'등록 안 함'/);
  assert.match(panel,/>등록하기<\/button>/);
  assert.match(panel,/status==='pending'\?'인증 대기중':'등록 완료'/);
  assert.match(panel,/비밀번호 재설정/);
  assert.match(panel,/onClick=\{\(\)=>setStatus\('pending'\)\}/);
});

test('desktop session card stretch leaves common title spacing and mobile layout unchanged',async()=>{
  const [profile,css]=await Promise.all([read('src/pages/SitePages.tsx'),read('src/styles/base.css')]);
  assert.match(profile,/className="profile-panel profile-session-panel"/);
  assert.match(css,/@media\(min-width:621px\)\{[\s\S]*?\.profile-layout\{align-items:stretch\}/);
  assert.match(css,/\.profile-session-panel \.session-options\{flex:1;grid-auto-rows:minmax\(48px,1fr\);gap:14px\}/);
  assert.match(css,/@media\(max-width:620px\)\{[^\n]*\.profile-layout\{grid-template-columns:1fr/);
  assert.doesNotMatch(css.slice(css.lastIndexOf('/\* Profile: align desktop')),/\.profile-title\s*\{/);
});
