import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

const code=await read('src/scheduleCreationModel.ts');
const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const model=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('calendar begins at current week and shows three weeks, expandable to ten',()=>{
 const weeks=model.calendarWeeks('2026-10','2026-10-16',3);
 assert.equal(weeks.length,3);
 assert.equal(weeks[0][0].iso,'2026-10-11');
 assert.equal(weeks[2][6].iso,'2026-10-31');
 assert.equal(weeks[0][4].past,true);
 assert.equal(weeks[0][5].past,false);
 assert.equal(model.calendarWeeks('2026-10','2026-10-16',10).length,10);
 const future=model.calendarWeeks('2026-11','2026-10-16',3);
 assert.equal(future[0][0].iso,'2026-11-01');
});

test('drag brush selects rectangle of cells from Oct 19 to Oct 30, not a date interval',()=>{
 const weeks=model.calendarWeeks('2026-10','2026-10-16',3);
 const start=weeks[1][1],end=weeks[2][5];
 assert.equal(start.iso,'2026-10-19');
 assert.equal(end.iso,'2026-10-30');
 const selection=model.brushCalendarDays(new Set(),weeks,start,end,true);
 assert.deepEqual([...selection].sort(),[
  '2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23',
  '2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30'
 ]);
 assert.ok(!selection.has('2026-10-24'));
 assert.ok(!selection.has('2026-10-25'));
});

test('drag direction derives from starting day and does not toggle intermediate dates twice',()=>{
 const weeks=model.calendarWeeks('2026-10','2026-10-16',3);
 const start=weeks[1][1],end=weeks[2][5];
 const baseline=new Set(['2026-10-19','2026-10-22','2026-10-24','2026-11-01']);
 const deselected=model.brushCalendarDays(baseline,weeks,start,end,false);
 assert.deepEqual([...deselected].sort(),['2026-10-24','2026-11-01']);
 const selected=model.brushCalendarDays(baseline,weeks,start,end,true);
 assert.ok(selected.has('2026-10-22'));
 assert.ok(selected.has('2026-10-30'));
 assert.ok(selected.has('2026-10-24'));
 // Past dates must remain unchanged even if crossed by a brush.
 const past=model.brushCalendarDays(new Set(),weeks,weeks[0][5],weeks[0][0],true);
 assert.deepEqual([...past],['2026-10-16']);
});

test('candidate hour labels use Korean 12-hour notation followed by 24-hour time',()=>{
 assert.equal(model.candidateHourLabel(9),'오전 9시 (09:00)');
 assert.equal(model.candidateHourLabel(17),'오후 5시 (17:00)');
 assert.equal(model.candidateHourLabel(0),'오전 12시 (00:00)');
 assert.equal(model.candidateHourLabel(24),'오전 12시 (24:00)');
});

test('schedule creation route, responsive editor and intentionally inactive save action',async()=>{
 const [nav,app,component,style]=await Promise.all([
  read('src/app/siteNavigation.ts'),read('src/App.tsx'),
  read('src/ScheduleCreation.tsx'),read('src/styles/schedule.css')
 ]);
 assert.match(nav,/page:'schedule-create',path:'\/schedule\/create'/);
 assert.ok(nav.indexOf("page:'schedule-create'")<nav.indexOf("page:'schedule-detail'"));
 assert.match(app,/onCreate=\{\(\) => navigate\('schedule-create'\)\}/);
 assert.match(app,/'schedule-create': <ScheduleCreation onBack=\{\(\) => navigate\('schedule'\)\}/);
 assert.match(component,/id="schedule-create-title"/);
 assert.match(component,/onPointerDown=\{startBrush\}/);
 assert.match(component,/onPointerMove=\{moveBrush\}/);
 assert.match(component,/onPointerUp=\{endBrush\}/);
 assert.match(component,/onPointerCancel=\{endBrush\}/);
 assert.match(component,/role="group" aria-label="후보 날짜 달력"/);
 assert.match(component,/aria-pressed=\{dates\.has\(cell\.iso\)\}/);
 assert.match(component,/setPointerCapture\(event\.pointerId\)/);
 assert.match(component,/onClick=\{event=>\{if\(event\.detail===0/);
 assert.match(component,/aria-expanded=\{expanded\}/);
 assert.match(component,/후보 날짜 선택/);
 assert.match(component,/후보 시간대 선택/);
 assert.match(component,/<select id="schedule-start-hour"/);
 assert.match(component,/<select id="schedule-end-hour"/);
 assert.match(component,/disabled>시간표 생성 \(준비 중\)<\/button>/);
 assert.doesNotMatch(component,/fetch\(|addDoc\(|setDoc\(|onSubmit=/);
 assert.match(style,/\.schedule-create-columns\{display:grid;grid-template-columns:minmax\(0,1\.08fr\) minmax\(0,\.92fr\)/);
 assert.match(style,/@media\(max-width:740px\)/);
});
