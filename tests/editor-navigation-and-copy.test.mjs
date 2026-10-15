import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const src=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('both editors have dirty-state guarded navigation and preserve saved exits',async()=>{
  const [about,composer,app,hook]=await Promise.all([
    src('src/AboutManagement.tsx'),src('src/NoticeComposer.tsx'),src('src/App.tsx'),src('src/useEditorLeaveGuard.ts')
  ]);
  assert.match(about,/JSON\.stringify\(content\)!==savedSnapshot.current/);
  assert.match(about,/savedSnapshot.current=JSON.stringify\(updated.content\)/);
  assert.match(about,/registerLeaveGuard\(null\);\s*onSaved\(\)/);
  assert.match(composer,/const originalDraft=useRef\(JSON.stringify\(\{title,category,blocks\}\)\)/);
  assert.match(composer,/registerLeaveGuard\(null\);\s*onSaved\(saved\)/);
  assert.match(about,/useEditorLeaveGuard\(hasUnsavedChanges\|\|busy,registerLeaveGuard\)/);
  assert.match(composer,/useEditorLeaveGuard\(hasUnsavedChanges\|\|busy,registerLeaveGuard\)/);
  assert.match(hook,/변경사항이 저장되지 않았습니다. 페이지를 나가시겠습니까\? 진행 상황은 저장되지 않습니다/);
  assert.match(hook,/beforeunload/);
  assert.match(app,/useBlocker\(/);
  assert.match(app,/blocker\.proceed\(\)/);
  assert.match(app,/blocker\.reset\(\)/);
  assert.doesNotMatch(app,/window\.history\.pushState/);
  assert.match(app,/registerLeaveGuard=\{registerEditorLeaveGuard\}/);
  assert.match(app,/setAboutSaveNotice\('변경 사항을 저장했습니다/);
  assert.match(app,/site-bottom-toast is-success/);
});
test('exact introduction/photo notices and no GitHub draft implementation detail',async()=>{
  const [about,composer]=await Promise.all([src('src/AboutManagement.tsx'),src('src/NoticeComposer.tsx')]);
  assert.match(about,/메인 페이지의 첫 화면에 표시되는 사진입니다. 외부 HTTPS 이미지 URL 또는 JPG\/PNG\/WebP 사진\(원본 30MB 이하\)을 사용할 수 있습니다/);
  assert.match(about,/동아리 소개 페이지에 표시되는 사진입니다. 외부 HTTPS 이미지 URL 또는 JPG\/PNG\/WebP 사진\(원본 30MB 이하\)을 사용할 수 있습니다/);
  const warning='업로드된 이미지는 원본을 대체하지 못하므로 원본 사진을 별도로 보관해 주세요.';
  assert.ok(about.includes('<strong>'+warning+'</strong>'));
  assert.ok(composer.includes('<strong>'+warning+'</strong>'));
  assert.doesNotMatch(composer,/선택한 이미지는 저장 전까지 GitHub에 커밋되지 않습니다/);
  assert.doesNotMatch(about,/image\/gif/);
  assert.doesNotMatch(composer,/image\/gif/);
});
test('account save button disabled for unchanged saved data, successful save shows dismissible toast',async()=>{
  const page=await src('src/FinancePages.tsx');
  assert.match(page,/const accountChanged=Boolean\(editing&&/);
  assert.match(page,/if\(!editing\|\|busy\|\|!accountChanged\)return/);
  assert.match(page,/disabled=\{busy\|\|!accountChanged\}/);
  assert.match(page,/setAccountMessage\('저장을 완료했습니다.'\)/);
  assert.match(page,/site-bottom-toast is-success/);
  assert.match(page,/onClick=\{\(\)=>setAccountMessage\(''\)\}/);
});
test('file uploads reject GIF on client and server, while public GIF URL compatibility is unchanged',async()=>{
  const [compress,server]=await Promise.all([src('src/imageCompression.ts'),src('functions/api/images/batch.js')]);
  assert.match(compress,/const types = new Set\(\['image\/jpeg','image\/png','image\/webp'\]\)/);
  assert.doesNotMatch(server,/image\/gif/);
  assert.match(server,/const extensions=\{'image\/jpeg':'jpg','image\/png':'png','image\/webp':'webp'\}/);
});
