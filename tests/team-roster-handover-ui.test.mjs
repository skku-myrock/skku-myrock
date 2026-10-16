import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('team members can be added before date or title, but create requires title, date and nonempty team',async()=>{
 const code=await read('src/ScheduleCreation.tsx');
 assert.match(code,/disabled=\{creating\} onClick=\{\(\)=>setMemberDialog\(true\)\}/);
 assert.match(code,/disabled=\{!title\.trim\(\)\|\|dates\.size===0\|\|creating\|\|\(teamMode&&teamMembers\.length===0\)\}/);
 assert.match(code,/함께 시간표를 사용할 부원을 직접 추가합니다\./);
 assert.doesNotMatch(code,/초대 수락은 필요하지 않습니다/);
});

test('right-side roster marks actual schedule creator regardless of viewer',async()=>{
 const code=await read('src/ScheduleRoom.tsx');
 assert.match(code,/<span>\{p\.name\}\{p\.uid===schedule\.createdBy\?' \(방장\)':(''|")\}<\/span>/);
});

test('each role is rendered as an independent editor with individually guarded save buttons',async()=>{
 const [view,api,server]=await Promise.all([
  read('src/HandoverNotes.tsx'),read('src/handoverNotesApi.ts'),
  read('functions/_lib/handoverNotes.js'),
 ]);
 assert.match(view,/positions\.map\(position=><NoteEditor key=\{'role-'\+position\}/);
 assert.match(view,/<NoteEditor key="common" kind="common"/);
 assert.doesNotMatch(view,/setPosition\(|<select value=\{position\}/);
 assert.match(view,/disabled=\{loading\|\|saving\|\|!dirty\}/);
 assert.match(view,/description=\{'후배 '\+position\+'에게 전달하고 싶은 내용을 작성해주세요\.'\}/);
 assert.match(view,/후배 운영진 모두에게 전달하고 싶은 내용을 작성해주세요/);
 assert.match(view,/현직 운영진과 OB 운영진 모두 작성된 인수인계를 확인할 수 있습니다/);
 assert.match(view,/const writerSubtitle=.*positions\.join\(' · '\).*name/);
 assert.match(api,/authorUid/);
 assert.match(server,/const NOTES=FIRESTORE_ROOT\+'\/handoverNotes'/);
 assert.match(server,/if\(writing\)/);
 assert.match(server,/authorUid:caller\.uid/);
});

test('handover archive is an explicitly labeled sample person list',async()=>{
 const view=await read('src/HandoverNotes.tsx');
 for(const sample of [
  "generation:'27기',positions:'보컬파트장',name:'나재원'",
  "generation:'28기',positions:'회장, 보컬파트장',name:'김서연'",
  "generation:'28기',positions:'공연부장, 기타파트장',name:'배은성'",
 ])assert.ok(view.includes(sample),sample);
 assert.match(view,/아래 목록과 열람 내용은 화면 구성 예시입니다/);
 assert.doesNotMatch(view,/실제 작성된 기록이 아닌 예시 내용입니다/);
 assert.match(view,/onClick=\{\(\)=>setSelectedIndex\(index\)\}/);
 assert.match(view,/selected&&<div className="handover-preview-backdrop"/);
 assert.match(view,/role="dialog" aria-modal="true" aria-labelledby="handover-preview-title"/);
 assert.match(view,/\{\[selected\.generation,selected\.positions\.split\(','\)\.map\(position=>position\.trim\(\)\)\.join\(' · '\),selected\.name\]\.join\(' '\)\}/);
 assert.doesNotMatch(view,/\{selected\.name\}의 인수인계/);
 assert.doesNotMatch(view,/\{selected\.generation\} · \{selected\.positions\}/);
 assert.doesNotMatch(view,/aria-describedby="handover-preview-description"/);
 assert.match(view,/selected\.notes\.map\(note=><section/);
 assert.match(view,/event\.key==='Escape'/);
 assert.doesNotMatch(view,/className="outline-action" disabled title="상세 열람은 추후 지원 예정입니다/);
});


test('writer generation subtitle drops fractional .5 and is visually near heading size',async()=>{
 const [view,css]=await Promise.all([read('src/HandoverNotes.tsx'),read('src/styles/handover-team.css')]);
 assert.match(view,/generationMatch=generation\.trim\(\)\.match\(\/\^/);
 assert.match(view,/generationLabel=generationMatch\?generationMatch\[1\]\+'기':generation\.trim\(\)/);
 assert.equal('27.5기'.match(/^(\d+)(?:\.\d+)?기?$/)?.[1]+'기','27기');
 assert.equal('28기'.match(/^(\d+)(?:\.\d+)?기?$/)?.[1]+'기','28기');
 assert.match(view,/<div className="page-heading container handover-writer-heading">/);
 assert.match(view,/<p className="handover-writer-subtitle">\{writerSubtitle\}<\/p>/);
 assert.match(view,/<p className="handover-writer-guidance">앞으로 모여락을 이끌어갈 후배 운영진들을 위해 선배 운영진 여러분의 경험을 공유해주세요\.<\/p>/);
 assert.match(css,/\.handover-writer-heading>\.handover-writer-subtitle\{font-size:28px;[^}]*color:#4b675f/);
 assert.match(css,/\.handover-writer-heading>\.handover-writer-guidance\{font-size:13px;/);
});

test('each illustrated writer opens their own notes without page navigation',async()=>{
 const view=await read('src/HandoverNotes.tsx');
 for(const heading of ['직책별 인수인계 · 보컬파트장','직책별 인수인계 · 회장','직책별 인수인계 · 공연부장','직책별 인수인계 · 기타파트장','운영진 공통 인수인계']){
  assert.ok(view.includes(heading),heading);
 }
 assert.match(view,/const selected=selectedIndex===null\?null:exampleArchive\[selectedIndex\]/);
 assert.match(view,/onMouseDown=\{event=>\{if\(event\.target===event\.currentTarget\)setSelectedIndex\(null\);\}\}/);
 assert.match(view,/onClick=\{\(\)=>setSelectedIndex\(null\)\}/);
 assert.doesNotMatch(view,/navigate\(|window\.location/);
});
