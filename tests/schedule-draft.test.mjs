import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const src=await read('src/scheduleDraftModel.ts');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const model=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('preview uses candidate date/time data only and rejects missing or malformed drafts',()=>{
 const input={title:' A팀 합주 ',dates:['2026-10-19','2026-10-16'],startHour:9,endHour:17};
 assert.deepEqual(model.draftFromRoute(input),{
  title:'A팀 합주',dates:['2026-10-16','2026-10-19'],startHour:9,endHour:17,
 });
 assert.equal(model.draftFromRoute(undefined),null);
 assert.equal(model.draftFromRoute({...input,title:'  '}),null);
 assert.equal(model.draftFromRoute({...input,dates:[]}),null);
 assert.equal(model.draftFromRoute({...input,dates:[input.dates[0],input.dates[0]]}),null);
 assert.equal(model.draftFromRoute({...input,startHour:18,endHour:17}),null);
});

test('all draft cells start white and mouse/keyboard selection uses 30-minute rectangles',()=>{
 const dates=['2026-10-19','2026-10-20','2026-10-21'];
 const slots=[540,570,600,630];
 const initial=new Set();
 const result=model.rectangleTimeSelection(initial,dates,slots,{day:0,slot:1},{day:2,slot:2},true);
 assert.deepEqual([...result].sort(),[
  '2026-10-19|570','2026-10-19|600',
  '2026-10-20|570','2026-10-20|600',
  '2026-10-21|570','2026-10-21|600',
 ]);
 assert.ok(!result.has('2026-10-20|540'));
 const other=new Set([...result,'2026-10-21|630']);
 const removed=model.rectangleTimeSelection(other,dates,slots,{day:2,slot:2},{day:0,slot:1},false);
 assert.deepEqual([...removed],['2026-10-21|630']);
 const single=model.rectangleTimeSelection(new Set(),dates,slots,{day:1,slot:0},{day:1,slot:0},true);
 assert.deepEqual([...single],['2026-10-20|540']);
});

test('member list and student-ID search are local demonstration only',()=>{
 assert.deepEqual([...model.INITIAL_DRAFT_PARTICIPANTS],['갑길동','을길동','병길동','정길동']);
 assert.equal(model.mockFindInvitee('2027000001'),'무길동');
 assert.equal(model.mockFindInvitee(' 2027000001 '),'무길동');
 assert.equal(model.mockFindInvitee('2027000002'),null);
 assert.equal(model.mockFindInvitee(''),null);
});

test('draft view keeps 70px date width and 20px 30-minute slots, with accessible roster editor',async()=>{
 const [draft,creation,app,nav,landing,css]=await Promise.all([
  read('src/ScheduleDraft.tsx'),read('src/ScheduleCreation.tsx'),read('src/App.tsx'),
  read('src/app/siteNavigation.ts'),read('src/SchedulePages.tsx'),read('src/styles/schedule.css'),
 ]);
 assert.match(nav,/page:'schedule-draft',path:'\/schedule\/draft'/);
 assert.ok(nav.indexOf("page:'schedule-draft'")<nav.indexOf("page:'schedule-detail'"));
 assert.match(app,/'schedule-draft': <ScheduleDraft/);
 assert.match(app,/routerNavigate\(pathFor\('schedule-draft'\),\{state:\{draft\}\}\)/);
 assert.match(creation,/onPreview\(\{title:title\.trim\(\),dates:\[\.\.\.dates\]\.sort\(\),startHour,endHour\}\)/);
 assert.match(draft,/width:64\+dates\.length\*70/);
 assert.match(draft,/height:slots\.length\*20/);
 assert.match(draft,/getScheduleSlots\(/);
 assert.match(draft,/paintArea\(active\.baseline,active\.members,active\.start,\{day,slot\},active\.activate\)/);
 assert.match(draft,/aria-pressed=\{isSelected\}/);
 assert.match(draft,/role="dialog" aria-modal="true"/);
 assert.match(draft,/id="schedule-invite-id"/);
 assert.match(draft,/검색 결과가 없습니다/);
 assert.match(draft,/mockFindInvitee\(studentId\)/);
 assert.match(draft,/people\.includes\(searchResult\)/);
 assert.match(css,/\.schedule-draft-block\.is-selected\{background:color-mix\(in srgb,var\(--accent\) 58%,white\)/);
 assert.match(landing,/\{canCreateTeam && <button/);
 assert.doesNotMatch(landing,/<em>날짜·시간 설정 화면 열기<\/em>|<em>운영진 전용 · 기능 준비 중<\/em>/);
 assert.match(app,/canCreateTeam=\{Boolean\(user && !authPending && currentLevel\)\}/);
 assert.doesNotMatch(draft,/fetch\(|addDoc\(|setDoc\(|updateDoc\(/);
});

test('draft participant filters match the original all/everyone options and no block-count display',async()=>{
 const draft=await read('src/ScheduleDraft.tsx');
 const css=await read('src/styles/schedule.css');
 assert.match(draft,/const \[mode,setMode\]=useState<ViewMode>\('all'\)/);
 assert.match(draft,/const \[selectedNames,setSelectedNames\]=useState<string\[\]>/);
 assert.match(draft,/aria-pressed=\{mode==='all'\}/);
 assert.match(draft,/aria-pressed=\{mode==='everyone'\}/);
 assert.match(draft,/모임 전체<\/button>/);
 assert.match(draft,/모두 되는 시간<\/button>/);
 assert.match(draft,/checked=\{selectedNames\.includes\(name\)\}/);
 assert.match(draft,/onChange=\{\(\)=>togglePerson\(name\)\}/);
 assert.match(draft,/onClick=\{selectEveryone\}>모두 선택/);
 assert.match(draft,/availableCount\(key\)/);
 assert.match(draft,/mode==='all'\?available>0:available===total/);
 assert.doesNotMatch(draft,/칸 선택|selected\.size|schedule-draft-selected-count/);
 assert.match(css,/\.schedule-filter-options/);
});
test('roster removal requires explicit confirmation and updates filter selection',async()=>{
 const draft=await read('src/ScheduleDraft.tsx');
 assert.match(draft,/window\.confirm\(name\+'을 명단에서 제외하시겠습니까\?'\)/);
 assert.match(draft,/if\(!window\.confirm[^\n]+\)return;/);
 assert.match(draft,/setPeople\(current=>current\.filter\(person=>person!==name\)\)/);
 assert.match(draft,/setSelectedNames\(current=>current\.filter\(person=>person!==name\)\)/);
 assert.match(draft,/delete next\[name\]/);
});
