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
 assert.match(app,/canManage=\{Boolean\(user&&!authPending&&currentLevel\)\} onManage=\{\(\)=>navigate\('equipment-manage'\)\}/);
 assert.match(app,/'equipment-manage': authPending\?/);
 assert.match(app,/user&&currentLevel\?<EquipmentManager/);
 assert.match(app,/장비 관리는 파트장 이상만 이용할 수 있습니다/);
 assert.match(pages,/\{canManage&&<button type="button" className="button button-secondary" onClick=\{onManage\}>장비 관리/);
});

test('equipment management uses protected server mutations instead of preview-only local state',async()=>{
 const [manager,app,fixtures,api,backend,css]=await Promise.all([
  read('src/EquipmentManager.tsx'),read('src/App.tsx'),read('src/equipmentDemo.ts'),
  read('src/equipmentApi.ts'),read('functions/api/equipment/manage.js'),read('src/styles/equipment.css')
 ]);
 assert.match(app,/getEquipment\(manage\)/);
 assert.match(app,/manageEquipment\(action,input\)/);
 assert.match(manager,/perform\('approve'/);
 assert.match(manager,/perform\('confirm-return'/);
 assert.match(manager,/perform\('delete'/);
 assert.match(manager,/creating\?'add':'edit'/);
 assert.match(manager,/queue\.map|item\.queue\?\?\[\]/);
 assert.match(manager,/item\.borrower\.name/);
 assert.match(api,/\/api\/equipment/);
 assert.match(backend,/callerForEquipment\(request,env,\{manager:true\}\)/);
 assert.doesNotMatch(manager,/setItems\(/);
 assert.match(fixtures,/status:'대여 가능'/);
 assert.match(css,/@media\(max-width:620px\)/);
});
