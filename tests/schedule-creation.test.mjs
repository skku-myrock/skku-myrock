import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

const code=await read('src/scheduleCreationModel.ts');
const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const model=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('calendar begins at current week and stacks future months without past dates',()=>{
 const months=model.futureCalendarMonths('2026-10-16',3);
 assert.equal(months.length,3);
 assert.deepEqual(months.map(month=>month.key),['2026-10','2026-11','2026-12']);
 const october=months[0];
 assert.equal(october.weeks[0][0],null);
 assert.equal(october.weeks[0][5].iso,'2026-10-16');
 assert.equal(october.weeks.at(-1)[6].iso,'2026-10-31');
 const november=months[1];
 assert.equal(november.weeks[0][0].iso,'2026-11-01');
 assert.equal(november.weeks.at(-1).flat().filter(Boolean).at(-1).iso,'2026-11-30');
 assert.equal(months[1].weeks[0][0].week,months[0].weeks.length);
 assert.equal(model.futureCalendarMonths('2026-12-31',2)[1].key,'2027-01');
 assert.equal(model.futureCalendarMonths('2026-10-16',4).length,4);
});

test('drag brush selects rectangle of cells from Oct 19 to Oct 30, not a date interval',()=>{
 const weeks=model.futureCalendarMonths('2026-10-16',1)[0].weeks;
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
 const weeks=model.futureCalendarMonths('2026-10-16',1)[0].weeks;
 const start=weeks[1][1],end=weeks[2][5];
 const baseline=new Set(['2026-10-19','2026-10-22','2026-10-24','2026-11-01']);
 const deselected=model.brushCalendarDays(baseline,weeks,start,end,false);
 assert.deepEqual([...deselected].sort(),['2026-10-24','2026-11-01']);
 const selected=model.brushCalendarDays(baseline,weeks,start,end,true);
 assert.ok(selected.has('2026-10-22'));
 assert.ok(selected.has('2026-10-30'));
 assert.ok(selected.has('2026-10-24'));
 // Past dates must remain unchanged even if crossed by a brush.
 // Past days are invisible; an existing selected day remains unaffected when brushing a different month.
 const extra=model.futureCalendarMonths('2026-10-16',2);
 const allWeeks=extra.flatMap(month=>month.weeks);
 const past=model.brushCalendarDays(new Set(['2026-10-16']),allWeeks,allWeeks[1][1],allWeeks[2][5],false);
 assert.ok(past.has('2026-10-16'));
});

test('candidate hour labels use Korean 12-hour notation followed by 24-hour time',()=>{
 assert.equal(model.candidateHourLabel(9),'오전 9시 (09:00)');
 assert.equal(model.candidateHourLabel(17),'오후 5시 (17:00)');
 assert.equal(model.candidateHourLabel(0),'오전 12시 (00:00)');
 assert.equal(model.candidateHourLabel(24),'오전 12시 (24:00)');
});


test('creating a schedule persists directly instead of navigating to a draft',async()=>{
 const [nav,app,component,api,css]=await Promise.all([
  read('src/app/siteNavigation.ts'),read('src/App.tsx'),
  read('src/ScheduleCreation.tsx'),read('src/scheduleApi.ts'),read('src/styles/schedule.css')]);
 assert.doesNotMatch(nav,/page:'schedule-draft'/);
 assert.match(nav,/page:'schedule-detail',path:'\/schedule\/:id'/);
 assert.match(component,/await createSchedule\(input\)/);
 assert.match(component,/onCreated\(result\.id\)/);
 assert.match(component,/disabled=\{!title\.trim\(\)\|\|dates\.size===0\|\|creating\|\|\(teamMode&&teamMembers\.length===0\)\}/);
 assert.match(component,/disabled=\{creating\} onClick=\{\(\)=>setMemberDialog\(true\)\}/);
 assert.match(component,/\(!title\.trim\(\)\|\|dates\.size===0\)&&<p>제목과 후보 날짜를 선택해 주세요\.<\/p>/);
 assert.doesNotMatch(component,/시간표를 생성하면 본인만 참여자로 등록됩니다\./);
 assert.doesNotMatch(component,/schedule-create-selection-summary|선택한 날짜.*일 ·|candidateCount|displayDates/);
 assert.doesNotMatch(css,/\.schedule-create-selection-summary\{/);
 assert.match(css,/\.schedule-create-footer button\{[^}]*margin-left:auto;opacity:1;cursor:pointer\}/);
 assert.match(css,/\.schedule-create-footer button:disabled\{opacity:\.5;cursor:not-allowed\}/);
 assert.match(app,/onCreated=\{openSchedule\}/);
 assert.match(api,/export const createSchedule/);
 assert.match(css,/\.schedule-create-columns/);
});
