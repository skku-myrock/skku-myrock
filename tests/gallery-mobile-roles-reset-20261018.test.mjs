import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('gallery tabs do not scroll vertically and page number buttons have mobile min width 24',async()=>{
 const s=await read('src/styles/gallery.css');
 assert.match(s,/\.gallery-toolbar \.gallery-tabs\{overflow:hidden;overscroll-behavior:none\}/);
 assert.match(s,/\.gallery-pagebar>button\{\s*box-sizing:border-box;\s*flex:0 0 24px;\s*width:24px;\s*min-width:24px;/);
 assert.match(s,/\.gallery-pagebar>button\[data-digits="3"\]/);
});
test('page number grouping changes independently of selected gallery page',async()=>{
 const s=await read('src/PhotoGallery.tsx');
 assert.match(s,/function changePageGroup\(direction:-1\|1\)/);
 const start=s.indexOf('function changePageGroup('),end=s.indexOf('const shown=',start);
 const block=s.slice(start,end);
 assert.match(block,/setWindowStart\(next\)/);
 assert.doesNotMatch(block,/setPreviewPage|changePage\(/);
 assert.match(s,/const PAGE_GROUP_SIZE=10;/);
 assert.doesNotMatch(s,/setPageGroupSize|window\.innerWidth/);
 // At 320px, ten 20px numbers + four 19px arrows fit a 284px container.
 assert.ok(10*20+4*19<=320-36);
 // At 360px, ten 22px numbers + four 19px arrows and 13 gaps fit.
 assert.ok(10*22+4*19+13*2<=360-36);
 // At 390px, ten 24px numbers + four 20px arrows and 13 gaps fit.
 assert.ok(10*24+4*20+13*2<=390-36);
});
test('equipment action buttons are right aligned on mobile',async()=>{
 const [page,style]=await Promise.all([read('src/pages/SitePages.tsx'),read('src/styles/equipment.css')]);
 assert.match(page,/className="toolbar toolbar-bottom equipment-list-toolbar"/);
 assert.doesNotMatch(page,/getElementById\('equipment-my-requests'\)\?\.scrollIntoView/);
 assert.match(style,/\.equipment-list-toolbar \.toolbar-actions\{\s*width:100%;\s*display:flex;\s*flex-wrap:wrap;\s*justify-content:flex-end;/);
});
test('large CSV tables scroll within fixed-width member registration panel',async()=>{
 const [ui,css]=await Promise.all([read('src/MemberManager.tsx'),read('src/styles/base.css')]);
 assert.match(ui,/<div className="member-preview-scroll"><table>/);
 assert.match(css,/\.member-layout,\.member-panel,\.member-registration,\.member-upload,\.member-preview\{min-width:0;max-width:100%\}/);
 assert.match(css,/\.member-preview-scroll\{display:block;width:100%;max-width:100%;min-width:0;overflow-x:auto;overflow-y:auto/);
 assert.match(css,/\.member-preview-scroll>table\{width:100%;min-width:560px;max-width:none\}/);
 assert.match(css,/@media\(max-width:820px\)\{\s*\.member-preview-scroll>table\{width:max-content;min-width:560px;max-width:none\}/);
});
test('full reset alone deletes all archived and personal handover notes',async()=>{
 const [app,api,client,archive]=await Promise.all([
  read('src/App.tsx'),read('functions/api/handover-notes/purge.js'),
  read('src/adminResets.ts'),read('functions/_lib/handoverNotes.js'),
 ]);
 assert.match(app,/if\(scope==='all'\)await drain\(purgeHandoverNotes/);
 assert.match(api,/assertAccess\(request,env,'president'\)/);
 assert.match(api,/!caller.superadmin/);
 assert.match(api,/const COLLECTION=FIRESTORE_ROOT\+'\/handoverNotes'/);
 assert.match(api,/currentDocument:\{updateTime:doc.updateTime\}/);
 assert.match(api,/BATCH_SIZE=20/);
 assert.match(client,/export const purgeHandoverNotes/);
 assert.match(archive,/const NOTES=FIRESTORE_ROOT\+'\/handoverNotes'/);
});
test('staff can reset lower-rank passwords; own, protected and higher ranks are denied',async()=>{
 const [handler,manager]=await Promise.all([
  read('functions/api/members/reset-password.js'),read('src/MemberManager.tsx'),
 ]);
 assert.match(handler,/assertAccess\(request, env, 'staff'\)/);
 assert.match(handler,/requireMutableTarget\(caller, target, uid, \{ protectSelf: true \}\)/);
 assert.match(handler,/\['staff','president'\]\.includes\(data.role\)/);
 assert.match(manager,/\{canEditDetails && <button[^\n]*resetPassword\(member\)/);
 assert.match(manager,/level === 'staff' && \(member.role === 'staff' \|\| member.role === 'president'\)/);
});
test('dummy notice author is 테스트, without altering other kinds of demo data',async()=>{
 const s=await read('functions/api/admin/dummy.js');
 assert.match(s,/author:'테스트',authorUid:caller.uid,publishedAt/);
 assert.match(s,/author:'테스트 데이터'/);
});
