import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('unknown student ID uses shared warning tone without changing saved success notifications',async()=>{
 const [room,toast,styles]=await Promise.all([read('src/ScheduleRoom.tsx'),read('src/toastBus.ts'),read('src/styles/management.css')]);
 assert.match(room,/setNotice\('존재하지 않는 학번입니다\.'\)/);
 assert.match(room,/useToastSignals\(\{error,message:notice,warning:inviteFeedback\}\)/);
 assert.match(toast,/존재하지 않는 학번|없습니다/);
 assert.match(styles,/\.site-bottom-toast\.is-warning\{/);
});

test('equipment list shows only persisted items with accessible status dots',async()=>{
 const [pages,styles,data]=await Promise.all([read('src/pages/SitePages.tsx'),read('src/styles/base.css'),read('src/equipmentDemo.ts')]);
 assert.doesNotMatch(data,/demo-guitar|demo-mic|demo-di|demo-stand/);
 assert.match(pages,/className=\{"equipment-status equipment-status-"\+equipmentStatusTone\(g\.status\)\}>\{g\.status\}<\/span>/);
 assert.doesNotMatch(data,/제품명 미등록/);
 assert.match(styles,/\.equipment-info h3\{font-size:15px;margin:0 0 5px\}/);
 assert.match(styles,/\.equipment-status::before\{content:'';width:8px;height:8px;border-radius:50%/);
 for(const [tone,color] of [['available','#208c56'],['pending','#dfab2e'],['borrowed','#d75050'],['returning','#939b9b']])
  assert.ok(styles.includes(`.equipment-status-${tone}::before{background:${color}}`));
});
