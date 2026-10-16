import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {validateScheduleInput,emptyBits,validBits} from '../functions/_lib/schedules.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const source=await read('src/scheduleGrid.ts');
const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const grid=await import('data:text/javascript;base64,'+Buffer.from(javascript).toString('base64'));

test('bitset round trips a non-square hour-row/day-column grid',()=>{
 const dates=['2026-10-19','2026-10-20','2026-10-21'];
 const selected=new Set(['2026-10-19|540','2026-10-20|570','2026-10-21|600']);
 const packed=grid.encodeBits(selected,dates,9,11);
 assert.equal(atob(packed).length,2);
 assert.deepEqual([...grid.decodeBits(packed,dates,9,11)].sort(),[...selected].sort());
 assert.equal(grid.encodeBits(grid.decodeBits(packed,dates,9,11),dates,9,11),packed);
 const rectangular=grid.rectangleTimeSelection(new Set(),dates,[540,570,600],{day:0,slot:1},{day:2,slot:2},true);
 assert.equal(rectangular.size,6);
 const cleared=grid.rectangleTimeSelection(rectangular,dates,[540,570,600],{day:2,slot:2},{day:0,slot:1},false);
 assert.equal(cleared.size,0);
});
test('server limits input shape and validates bitset length and padding',()=>{
 const input=validateScheduleInput({title:' 합주 ',dates:['2026-10-20','2026-10-19'],startHour:9,endHour:11});
 assert.deepEqual(input.dates,['2026-10-19','2026-10-20']);
 assert.equal(input.title,'합주');
 assert.ok(validBits(emptyBits(input),input));
 assert.equal(validBits('ZmFrZQ==',input),false);
 assert.throws(()=>validateScheduleInput({...input,startHour:17,endHour:9}));
 assert.throws(()=>validateScheduleInput({...input,dates:['2026-02-30']}));
 assert.throws(()=>validateScheduleInput({...input,dates:['2026-10-19','2026-10-19']}));
 const odd={...input,dates:['2026-10-19','2026-10-20','2026-10-21']};
 assert.ok(validBits(grid.encodeBits(new Set(),odd.dates,9,11),odd));
 const corrupt=Uint8Array.from(atob(grid.encodeBits(new Set(),odd.dates,9,11)),c=>c.charCodeAt(0));
 corrupt[corrupt.length-1]|=1;
 assert.equal(validBits(btoa(String.fromCharCode(...corrupt)),odd),false);
});
test('live timetable only saves on explicit click and prompts on unsaved departure',async()=>{
 const [room,api,app,css]=await Promise.all([read('src/ScheduleRoom.tsx'),read('src/scheduleApi.ts'),read('src/App.tsx'),read('src/styles/schedule.css')]);
 assert.match(room,/const LEAVE_MESSAGE='페이지를 나가겠습니까\? 진행상황은 저장되지 않습니다'/);
 assert.match(room,/window\.confirm\(LEAVE_MESSAGE\)/);
 assert.match(room,/window\.addEventListener\('beforeunload'/);
 assert.match(room,/window\.removeEventListener\('beforeunload'/);
 assert.match(room,/const dirty=Boolean\(data\)&&bits!==savedBits/);
 assert.match(room,/await saveAvailability\(id,bits,version\)/);
 assert.match(room,/disabled=\{!dirty\|\|saving\} onClick=\{\(\)=>void save\(\)\}/);
 assert.match(room,/setVersion\(result\.updateTime\);setSavedBits\(bits\)/);
 assert.match(room,/registerLeaveGuard\(\(\)=>!dirtyRef\.current\|\|window\.confirm\(LEAVE_MESSAGE\)\)/);
 assert.match(api,/getIdToken\(\)/);
 assert.match(css,/\.schedule-draft-save-row/);
 assert.match(app,/useBlocker/);
});
test('only the viewer can paint their own selection and group filtering is read-only',async()=>{
 const room=await read('src/ScheduleRoom.tsx');
 assert.match(room,/const \[selected,setSelected\]=useState<Set<string>>/);
 assert.match(room,/paint\(active\.start,\{day,slot\},active\.baseline,active\.select\)/);
 assert.match(room,/visibleCount\(key\)/);
 assert.match(room,/decodedOthers\.get\(p\.uid\)/);
 assert.match(room,/selected\.has\(key\)/);
 assert.match(room,/mode==='all'\?available>0:available===total/);
 assert.match(room,/schedule\.createdBy===ownUid/);
 assert.match(room,/await inviteMember\(id,studentId\)/);
 assert.match(room,/await removeScheduleMember\(id,uid\)/);
 assert.doesNotMatch(room,/mockFindInvitee|DEMO_INVITATION/);
});
test('backend requests verify identities and separate consent from participant creation',async()=>{
 const [
  create,get,save,invite,inbox,respond,remove,helpers
 ]=await Promise.all([
  read('functions/api/schedules/index.js'),
  read('functions/api/schedules/[id]/index.js'),
  read('functions/api/schedules/[id]/availability.js'),
  read('functions/api/schedules/[id]/invite.js'),
  read('functions/api/schedule-invitations/index.js'),
  read('functions/api/schedule-invitations/[id]/respond.js'),
  read('functions/api/schedules/[id]/members/[uid].js'),
  read('functions/_lib/schedules.js'),
 ]);
 for(const file of [create,get,save,invite,inbox,respond,remove])
  assert.match(file,/callerProfile\(request,env\)/);
 assert.match(create,/participantUids:\[caller\.uid\]/);
 assert.match(save,/validBits\(body\?\.availability,schedule\)/);
 assert.match(save,/currentDocument\.updateTime/);
 assert.match(save,/url\.searchParams\.set\('currentDocument\.updateTime',current\.updateTime\)/);
 assert.match(invite,/const GENERIC='초대 요청을 접수했습니다\.'/);
 assert.match(invite,/getFirestoreDocument\(env,uid\)/);
 assert.match(invite,/count>=20/);
 assert.match(invite,/requireOwner\(schedule,caller\.uid\)/);
 assert.match(inbox,/recipientUid','EQUAL',caller\.uid/);
 assert.match(respond,/invitation\.recipientUid!==caller\.uid/);
 assert.match(respond,/invitation\.status!=='pending'/);
 assert.match(respond,/await commit\(env,writes\)/);
 assert.match(respond,/currentDocument:\{exists:false\}/);
 assert.match(remove,/requireOwner\(schedule,caller\.uid\)/);
 assert.match(helpers,/verifyFirebaseToken\(request\)/);
 assert.match(helpers,/getFirestoreDocument\(env,claims\.sub\)/);
});
