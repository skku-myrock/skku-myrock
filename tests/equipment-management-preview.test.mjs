import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('account dropdown is left anchored like other desktop navigation menus',async()=>{
 const css=await read('src/styles/base.css');
 assert.match(css,/\.account-menu\{left:-15px;right:auto;top:calc\(100% - 18px\)/);
 assert.match(css,/\.header-actions \.account-wrapper > \.account-menu \{[^}]*left: -15px;[^}]*right: auto;/s);
 assert.match(css,/\.nav-group \.more-menu\{top:60px;left:-15px;right:auto/);
});

test('equipment management is restricted to signed-in part leaders and higher',async()=>{
 const [app,routes,pages]=await Promise.all([read('src/App.tsx'),read('src/app/siteNavigation.ts'),read('src/pages/SitePages.tsx')]);
 assert.match(routes,/\{page:'equipment-manage',path:'\/equipment\/manage'\}/);
 assert.match(app,/'equipment': <Equipment notify=\{notify\} items=\{equipmentItems\} canManage=\{Boolean\(user&&!authPending&&currentLevel\)\} onManage=\{\(\)=>navigate\('equipment-manage'\)\}/);
 assert.match(app,/'equipment-manage': authPending\?/);
 assert.match(app,/user&&currentLevel\?<EquipmentManager/);
 assert.match(app,/장비 관리는 파트장 이상만 이용할 수 있습니다/);
 assert.match(pages,/\{canManage&&<button type="button" className="button button-secondary" onClick=\{onManage\}>장비 관리/);
});

test('equipment management changes only React state and approval is not operational',async()=>{
 const [manager,app,fixtures,css]=await Promise.all([read('src/EquipmentManager.tsx'),read('src/App.tsx'),read('src/equipmentDemo.ts'),read('src/styles/equipment.css')]);
 assert.match(app,/useState<EquipmentItem\[\]>\(demoEquipment\)/);
 assert.match(manager,/setItems\(previous=>\[\.\.\.previous,\{id:'local-'\+crypto\.randomUUID\(\),name,product,status:form.status\}\]\)/);
 assert.match(manager,/setItems\(previous=>previous\.map\(item=>item\.id===editingId/);
 assert.match(manager,/setItems\(previous=>previous\.filter\(entry=>entry\.id!==item\.id\)\)/);
 assert.match(manager,/disabled title="승인 기능은 아직 연결되지 않았습니다."/);
 assert.match(manager,/아래 장비와 대여 상태는 예시 데이터입니다/);
 assert.doesNotMatch(manager,/fetch\(|updateDoc\(|setDoc\(|deleteDoc\(|\/api\//);
 for(const status of ['대여 가능','대여 승인 대기중','대여중','반납 확인중'])assert.ok(fixtures.includes(status));
 assert.match(manager,/EQUIPMENT_STATUSES\.map\(status=>/);
 assert.match(css,/@media\(max-width:620px\)/);
});
