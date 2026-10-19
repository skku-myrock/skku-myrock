import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('recovery email is a nonfunctional optional profile placeholder',async()=>{
  const [profile,panel]=await Promise.all([read('src/pages/SitePages.tsx'),read('src/RecoveryEmailSettings.tsx')]);
  assert.match(profile,/import RecoveryEmailSettings from '\.\.\/RecoveryEmailSettings'/);
  assert.match(profile,/<RecoveryEmailSettings\s*\/>/);
  assert.match(panel,/비밀번호 복구용 이메일/);
  assert.match(panel,/등록 안 함/);
  assert.match(panel,/등록은 선택사항/);
  assert.match(panel,/로그인은 계속 학번/);
  assert.match(panel,/type="email"[^>]+disabled/);
  assert.match(panel,/이메일 등록[^<]*<ArrowRight size=\{15\}\/>/);
  assert.doesNotMatch(panel,/verifyBeforeUpdateEmail|updateEmail|updateDoc|fetch\(/);
});

test('desktop sessions can stretch without changing shared heading offsets or stacked mobile sizing',async()=>{
  const [profile,css]=await Promise.all([read('src/pages/SitePages.tsx'),read('src/styles/base.css')]);
  assert.match(profile,/className="profile-panel profile-session-panel"/);
  assert.match(css,/@media\(min-width:621px\)\{[\s\S]*?\.profile-layout\{align-items:stretch\}/);
  assert.match(css,/\.profile-session-panel \.session-options\{flex:1;grid-auto-rows:minmax\(48px,1fr\);gap:14px\}/);
  assert.match(css,/@media\(max-width:620px\)\{[^\n]*\.profile-layout\{grid-template-columns:1fr/);
  assert.doesNotMatch(css.slice(css.lastIndexOf('\/\* Profile: align desktop')),/\.profile-title\s*\{/);
});
