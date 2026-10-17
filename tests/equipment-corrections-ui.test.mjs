import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('equipment manager exposes protected, data-aware manual corrections and real pictures',async()=>{
 const [ui,api,backend,core,publicPage,upload]=await Promise.all([
  read('src/EquipmentManager.tsx'),read('src/equipmentApi.ts'),
  read('functions/api/equipment/manage.js'),read('functions/_lib/equipment.js'),
  read('src/pages/SitePages.tsx'),read('src/imageUpload.ts'),
 ]);
 for(const action of ['force-loan','force-return','force-available','force-request-return','cancel-return','add-request','clear-queue'])
  assert.ok(ui.includes(action)&&api.includes(action)&&backend.includes(action),action);
 assert.match(backend,/resolveMember\(env,body\?\.studentId\)/);
 assert.match(backend,/callerForEquipment\(request,env,\{manager:true\}\)/);
 assert.match(backend,/item\.borrower=null;item\.returnRequestedAt='';item\.queue=\[\]/);
 assert.match(ui,/uploadImagesBatch\(\[imageFile\],'equipment'\)/);
 assert.match(ui,/validateSourceImage\(file\)/);
 assert.match(ui,/이미지 제거/);
 assert.match(publicPage,/g\.imageUrl\?<ImageShimmer key=\{g\.imageUrl\} className="equipment-photo"/);
 assert.match(core,/imageUrl:item\.imageUrl/);
 assert.match(upload,/\|'equipment'='site'/);
});
test('equipment photo uploads require manager rights and store under a separate image folder',async()=>{
 const [server,lib,uiCss]=await Promise.all([
  read('functions/api/images/batch.js'),read('functions/_lib/githubImages.js'),read('src/styles/equipment.css'),
 ]);
 assert.match(server,/folder!=='equipment'/);
 assert.match(server,/folder==='site'\?'staff':'part_leader'/);
 assert.match(lib,/export async function deleteUnusedEquipmentImages\(env,obsoleteUrls\)/);
 assert.match(lib,/\^equipment\\\//);
 assert.match(uiCss,/\.equipment-row>\.equipment-photo/);
 assert.match(uiCss,/\.equipment-correction-form/);
});
