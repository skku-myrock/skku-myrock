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
 assert.doesNotMatch(view,/현직 운영진과 OB 운영진 모두 작성된 인수인계를 확인할 수 있습니다/);
 assert.match(view,/const writerSubtitle=.*positions\.join\(' · '\).*name/);
 assert.match(api,/authorUid/);
 assert.match(server,/const NOTES=FIRESTORE_ROOT\+'\/handoverNotes'/);
 assert.match(server,/if\(writing\)/);
 assert.match(server,/authorUid:caller\.uid/);
});

test('handover archive uses authenticated persisted author records instead of sample entries',async()=>{
 const [view,api,server,archive]=await Promise.all([
  read('src/HandoverNotes.tsx'),read('src/handoverNotesApi.ts'),
  read('functions/_lib/handoverNotes.js'),read('functions/api/handover-notes/archive.js'),
 ]);
 assert.doesNotMatch(view,/exampleArchive|const exampleArchive/);
 assert.doesNotMatch(view,/현직 운영진과 OB 운영진 모두 작성된 인수인계를 확인할 수 있습니다/);
 assert.match(view,/역대 운영진이 남긴 인수인계 내용을 확인할 수 있습니다/);
 assert.doesNotMatch(view,/선배 운영진이 남긴 인수인계 내용을 찾아볼 수 있습니다/);
 assert.match(view,/getHandoverArchive\(\)\.then\(result=>/);
 assert.match(view,/filtered\.map\(entry=><div className="handover-archive-row"/);
 assert.match(view,/기수, 이름 또는 직책 검색/);
 assert.match(view,/entry\.generation,archiveGeneration\(entry\.generation\),entry\.name,\.\.\.entry\.positions/);
 assert.match(view,/검색 결과가 없습니다/);
 assert.match(view,/저장된 인수인계가 없습니다/);
 assert.match(view,/onClick=\{\(\)=>setSelected\(entry\)\}/);
 assert.match(api,/getHandoverArchive/);
 assert.match(archive,/await handoverCaller\(request,env\)/);
 assert.match(server,/export async function listHandoverArchive\(env\)/);
 assert.match(server,/data\.content\.trim\(\)/);
 assert.match(server,/generationValue\(b\.generation\)-generationValue\(a\.generation\)/);
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

test('handover dialog loads real notes lazily and shows title/body divider',async()=>{
 const [view,css]=await Promise.all([read('src/HandoverNotes.tsx'),read('src/styles/handover-team.css')]);
 assert.match(view,/selected\.notes\.map\(async note=>/);
 assert.match(view,/getHandoverNote\(note\.kind,note\.position,selected\.uid\)/);
 assert.match(view,/Promise\.all\(selected\.notes\.map/);
 assert.match(view,/selected&&<div className="handover-preview-backdrop"/);
 assert.match(view,/role="dialog" aria-modal="true" aria-labelledby="handover-preview-title"/);
 assert.match(view,/notes\.map\(note=><section className="handover-preview-note"/);
 assert.match(view,/event\.key==='Escape'/);
 assert.match(view,/인수인계 내용을 불러오는 중입니다/);
 assert.match(css,/\.handover-preview-notes\{display:flex;flex-direction:column;margin-top:19px;border-top:1px solid var\(--border\)/);
 assert.doesNotMatch(view,/실제 작성된 기록이 아닌 예시 내용입니다/);
 assert.doesNotMatch(view,/navigate\(|window\.location/);
});
