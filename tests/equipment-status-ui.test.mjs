import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('unknown student ID uses a yellow warning triangle without changing success notifications',async()=>{
 const [room,styles]=await Promise.all([read('src/ScheduleRoom.tsx'),read('src/styles/schedule.css')]);
 assert.match(room,/setNotice\('존재하지 않는 학번입니다\.'\)/);
 assert.ok(room.includes('notice==="존재하지 않는 학번입니다."?<AlertTriangle size={17}/>:<Check size={17}/>'));
 assert.ok(room.includes('role={notice==="존재하지 않는 학번입니다."?"alert":"status"}'));
 assert.match(styles,/\.schedule-invite-warning>svg:first-child\{color:#e6b54b\}/);
});

test('equipment sample rows have concrete model names, compact spacing and accessible status dots',async()=>{
 const [pages,styles,data]=await Promise.all([read('src/pages/SitePages.tsx'),read('src/styles/base.css'),read('src/equipmentDemo.ts')]);
 for(const [name,product,status,tone] of [
  ['기타','바커스 BST-2-RSM','대여 가능','available'],
  ['마이크','슈어 SM98','대여 승인 대기중','pending'],
  ['DI 박스','래디얼 ProDI','대여중','borrowed'],
  ['마이크 스탠드','K&M 210/9','반납 확인중','returning'],
 ])assert.ok(data.includes(`name:'${name}',product:'${product}',status:'${status}'`));
 assert.ok(data.includes(`case '${status}':return '${tone}'`));
 assert.match(pages,/className=\{"equipment-status equipment-status-"\+equipmentStatusTone\(g\.status\)\}>\{g\.status\}<\/span>/);
 assert.doesNotMatch(data,/제품명 미등록/);
 assert.match(styles,/\.equipment-info h3\{font-size:15px;margin:0 0 5px\}/);
 assert.match(styles,/\.equipment-status::before\{content:'';width:8px;height:8px;border-radius:50%/);
 for(const [tone,color] of [['available','#208c56'],['pending','#dfab2e'],['borrowed','#d75050'],['returning','#939b9b']])
  assert.ok(styles.includes(`.equipment-status-${tone}::before{background:${color}}`));
});
