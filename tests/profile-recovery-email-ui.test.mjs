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
});

test('registration dialog copy, password-first input order, and saved-username autofill prevention',async()=>{
  const panel=await read('src/RecoveryEmailSettings.tsx');
  assert.match(panel,/<h2 id="recovery-email-heading">이메일 설정<\/h2>/);
  assert.match(panel,/<p>비밀번호 복구용 이메일을 설정합니다<\/p>/);
  const dialog=panel.slice(panel.indexOf('id="recovery-email-heading"'));
  assert.ok(dialog.indexOf('<label>현재 비밀번호')>=0);
  assert.ok(dialog.indexOf('<label>이메일')>dialog.indexOf('<label>현재 비밀번호'));
  assert.match(dialog,/type="password" autoComplete="current-password"/);
  assert.match(dialog,/type="email" inputMode="email" name="recovery-contact-address" autoComplete="off"/);
  assert.match(dialog,/<form noValidate onSubmit=/);
  assert.doesNotMatch(dialog,/autoComplete="username"/);
});

test('email is validated only upon submit and both errors and mock success display inline',async()=>{
  const panel=await read('src/RecoveryEmailSettings.tsx');
  assert.match(panel,/event\.preventDefault\(\)/);
  assert.match(panel,/이메일 형식이 올바르지 않습니다/);
  assert.match(panel,/비밀번호가 올바르지 않습니다\./);
  assert.match(panel,/reauthenticateWithCredential\(user,credential\)/);
  assert.match(panel,/EmailAuthProvider\.credential\(user\.email,password\)/);
  assert.match(panel,/setFeedback\('해당 이메일로 인증 링크가 발송되었습니다\.'\)/);
  assert.match(panel,/feedbackType==='success'\?'recovery-email-success':'form-error'/);
  assert.match(panel,/role=\{feedbackType==='error'\?'alert':'status'\}/);
  const register=panel.slice(panel.indexOf('async function register('),panel.indexOf('\n  return <>'));
  assert.doesNotMatch(register,/setOpen\(false\)/);
  assert.doesNotMatch(panel,/sendPasswordResetEmail|verifyBeforeUpdateEmail|updateEmail|updateDoc|fetch\(/);
});

test('registration status preview and hover style remain unchanged except underline',async()=>{
  const [panel,css]=await Promise.all([read('src/RecoveryEmailSettings.tsx'),read('src/styles/base.css')]);
  assert.match(panel,/useState<EmailPreviewStatus>\('unregistered'\)/);
  assert.match(panel,/registeredEmail\|\|'등록 안 함'/);
  assert.match(panel,/setRegisteredEmail\(address\)/);
  assert.match(panel,/setStatus\('registered'\)/);
  assert.match(panel,/<strong>등록 완료<\/strong>/);
  assert.doesNotMatch(panel,/인증 대기중|setStatus\('pending'\)/);
  assert.match(panel,/disabled=\{!registeredEmail\}/);
  assert.match(panel,/className="button button-primary recovery-reset-button"/);
  assert.match(panel,/onClick=\{\(\)=>showToast\('해당 이메일로 비밀번호 재설정 링크를 발송하였습니다','success'\)\}/);
  assert.match(css,/\.recovery-email-actions\{display:flex;justify-content:flex-end;margin-top:21px\}/);
  assert.match(css,/\.password-form button\{align-self:flex-end\}/);
  assert.match(css,/\.password-panel\{grid-column:1\/-1\}/);
  const buttonStates=await read('src/styles/button-states.css');
  assert.match(buttonStates,/button:disabled,button\[aria-disabled="true"\]/);
  assert.doesNotMatch(panel,/sendPasswordResetEmail|verifyBeforeUpdateEmail|fetch\(/);
  assert.match(css,/\.recovery-email-status \.recovery-email-register-link:hover\{text-decoration:none\}/);
});

test('desktop session card stretch leaves common title spacing and mobile layout unchanged',async()=>{
  const [profile,css]=await Promise.all([read('src/pages/SitePages.tsx'),read('src/styles/base.css')]);
  assert.match(profile,/className="profile-panel profile-session-panel"/);
  assert.match(css,/@media\(min-width:621px\)\{[\s\S]*?\.profile-layout\{align-items:stretch\}/);
  assert.match(css,/\.profile-session-panel \.session-options\{flex:1;grid-auto-rows:minmax\(48px,1fr\);gap:14px\}/);
  assert.match(css,/@media\(max-width:620px\)\{[^\n]*\.profile-layout\{grid-template-columns:1fr/);
  assert.doesNotMatch(css.slice(css.lastIndexOf('/\* Profile: align desktop')),/\.profile-title\s*\{/);
});
