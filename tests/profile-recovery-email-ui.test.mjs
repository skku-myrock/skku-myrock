import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('email settings and password change span both columns in the intended order',async()=>{
  const [profile,panel,css]=await Promise.all([read('src/pages/SitePages.tsx'),read('src/RecoveryEmailSettings.tsx'),read('src/styles/base.css')]);
  assert.match(profile,/<RecoveryEmailSettings user=\{user\}\/>\s*<PasswordChange user=\{user\}\/>/);
  assert.match(css,/\.recovery-email-panel\{grid-column:1\/-1\}/);
  assert.match(panel,/<h2>이메일 설정<\/h2>/);
  assert.match(panel,/비밀번호 복구용 이메일을 설정합니다\./);
});

test('verified and pending status labels reopen a prefilled edit dialog',async()=>{
  const panel=await read('src/RecoveryEmailSettings.tsx');
  assert.match(panel,/type EmailPreviewStatus = 'unregistered'\|'registered'\|'pending'/);
  assert.match(panel,/const editing = status !== 'unregistered'/);
  assert.match(panel,/setEmail\(registeredEmail\)/);
  assert.match(panel,/onClick=\{openDialog\}>등록하기<\/button>/);
  assert.match(panel,/className="recovery-email-status-button" type="button" onClick=\{openDialog\}/);
  assert.match(panel,/status==='pending'\?'인증 대기중':'등록 완료'/);
  assert.match(panel,/editing\?'비밀번호 복구용 이메일을 재설정합니다\.':'비밀번호 복구용 이메일을 설정합니다\.'/);
  assert.match(panel,/sent\?'재발송':editing\?'재설정하기':'등록하기'/);
  assert.match(panel,/setStatus\(editing\?'pending':'registered'\)/);
  assert.match(panel,/disabled=\{status!=='registered'\}/);
});

test('email editing requires an address different from the existing email before first submit',async()=>{
  const panel=await read('src/RecoveryEmailSettings.tsx');
  assert.match(panel,/email\.trim\(\) !== registeredEmail/);
  assert.match(panel,/\(sent \|\| !editing \|\| email\.trim\(\) !== registeredEmail\)/);
  assert.match(panel,/disabled=\{!canSubmit\}/);
  assert.match(panel,/onChange=\{event=>\{setEmail\(event\.target\.value\);setSent\(false\);clearFeedback\(\);\}\}/);
  assert.match(panel,/type="password" autoComplete="current-password"/);
  assert.match(panel,/type="email" inputMode="email" name="recovery-contact-address" autoComplete="off"/);
  assert.match(panel,/<form noValidate onSubmit=/);
  assert.match(panel,/이메일 형식이 올바르지 않습니다/);
});

test('register/reset becomes resend on success and stays disabled for one second',async()=>{
  const panel=await read('src/RecoveryEmailSettings.tsx');
  assert.match(panel,/reauthenticateWithCredential\(user,credential\)/);
  assert.match(panel,/setSent\(true\)/);
  assert.match(panel,/setCooldown\(true\)/);
  assert.match(panel,/window\.setTimeout\(\(\)=>setCooldown\(false\),1000\)/);
  assert.match(panel,/window\.clearTimeout\(timer\)/);
  assert.match(panel,/!busy && !cooldown/);
  assert.match(panel,/setFeedback\('해당 이메일로 인증 링크가 발송되었습니다\.'\)/);
  assert.match(panel,/feedbackType==='success'\?'recovery-email-success':'form-error'/);
  assert.match(panel,/role=\{feedbackType==='error'\?'alert':'status'\}/);
  const handler=panel.slice(panel.indexOf('async function register('),panel.indexOf('\n  return <>'));
  assert.doesNotMatch(handler,/setOpen\(false\)/);
  assert.doesNotMatch(panel,/verifyBeforeUpdateEmail|sendPasswordResetEmail|updateEmail|updateDoc|fetch\(|showToast\(/);
});

test('reset notice remains outside email box, and reset button rises without layout jump',async()=>{
  const [panel,css]=await Promise.all([read('src/RecoveryEmailSettings.tsx'),read('src/styles/base.css')]);
  assert.match(panel,/<\/div>\s*<div className="recovery-email-footer">\s*<p className="recovery-email-notice"/);
  assert.match(panel,/resetNotice\?'인증 메일을 발송했습니다':''/);
  assert.match(panel,/onClick=\{\(\)=>setResetNotice\(true\)\}/);
  assert.match(css,/\.recovery-email-footer\{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:21px;min-height:39px\}/);
  assert.match(css,/\.recovery-email-notice\{flex:1;min-width:0;min-height:18px;margin:0;/);
  assert.match(css,/\.recovery-email-actions\{display:flex;justify-content:flex-end;flex-shrink:0\}/);
  assert.match(css,/\.recovery-email-status-button\{border:0;background:transparent;/);
  assert.match(css,/\.profile-layout \.profile-save,\.profile-layout \.recovery-reset-button,\.profile-layout \.password-form button\{width:142px;min-width:142px;max-width:100%;padding-inline:13px\}/);
});

test('desktop session card stretch and stacked mobile layout remain unchanged',async()=>{
  const [profile,css]=await Promise.all([read('src/pages/SitePages.tsx'),read('src/styles/base.css')]);
  assert.match(profile,/className="profile-panel profile-session-panel"/);
  assert.match(css,/@media\(min-width:621px\)\{[\s\S]*?\.profile-layout\{align-items:stretch\}/);
  assert.match(css,/\.profile-session-panel \.session-options\{flex:1;grid-auto-rows:minmax\(48px,1fr\);gap:14px\}/);
  assert.match(css,/@media\(max-width:620px\)\{[^\n]*\.profile-layout\{grid-template-columns:1fr/);
  assert.doesNotMatch(css.slice(css.lastIndexOf('/\* Profile: align desktop')),/\.profile-title\s*\{/);
});
