import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DUMMY_COUNTS,DUMMY_CONFIRMATION,selectFixtureAlbum} from '../functions/api/admin/dummy.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('dummy fixture totals match the requested pagination scenarios',()=>{
 assert.deepEqual(DUMMY_COUNTS,{notices:100,donations:100,expenses:100,gallery:150});
 assert.equal(DUMMY_CONFIRMATION,'더미 데이터 생성');
});
test('gallery test fixtures require 17 existing photos from Youth on Tape',()=>{
 const photos=Array.from({length:17},(_,i)=>'https://example.test/gallery/'+i+'.webp');
 const source={title:'2026. 08. 22. 소리사랑 x 모여락 여름 연합공연 "Youth on Tape"',photos};
 assert.equal(selectFixtureAlbum([{title:'Other',photos},source]),source);
 assert.throws(()=>selectFixtureAlbum([{title:'Other',photos}]),/Youth on Tape/);
 assert.throws(()=>selectFixtureAlbum([{title:source.title,photos:photos.slice(0,16)}]),/17장/);
});
test('dummy API checks signed superadmin and uses stable document IDs, batches and no image upload',async()=>{
 const s=await read('functions/api/admin/dummy.js');
 assert.match(s,/secureOrigin\(request\)/);
 assert.match(s,/assertAccess\(request,env,'president'\)/);
 assert.match(s,/if\(!caller.superadmin\)reject/);
 assert.match(s,/start%BATCH!==0/);
 assert.match(s,/BATCH=20/);
 assert.match(s,/documentId\(stage,index\)/);
 assert.match(s,/dummyBatch:'pagination-v1'/);
 assert.match(s,/validateGalleryAlbum/);
 assert.match(s,/getDummyGalleryFixtures/);
 assert.match(s,/ensureDummyGalleryFixtures/);
 assert.match(s,/photos\.slice\(rotate\)/);
 assert.doesNotMatch(s,/uploadImagesBatch|GITHUB_IMAGES_TOKEN|createGalleryAlbum\(/);
 const client=await read('src/adminResets.ts');
 assert.match(client,/generateDummyBatch/);
 assert.match(client,/confirmation,\.\.\.extra/);
});
test('both superadmin menus expose single fixture generator below four reset actions',async()=>{
 const app=await read('src/App.tsx');
 assert.equal((app.match(/onClick=\{\(\)=>void createDummyData\(\)\}>더미 데이터 생성/g)||[]).length,2);
 assert.equal(app.split("createDummyData()").length-1,3);
 for(const label of ['후원 회계 초기화','활동 초기화','나머지 초기화','완전 초기화'])
  assert.equal(app.split('>'+label).length-1,2);
 assert.match(app,/const stages=\[\['gallery',150\],\['notices',100\],\['donations',100\],\['expenses',100\]\]/);
 assert.match(app,/setDummyGenerating\(true\)/);
});
test('common disabled button palette loads after every existing screen CSS',async()=>{
 const [styles,colors]=await Promise.all([read('src/styles.css'),read('src/styles/button-states.css')]);
 assert.equal(styles.trim().split('\n').at(-1),"@import './styles/button-states.css';");
 assert.match(colors,/button:disabled,button\[aria-disabled="true"\]/);
 assert.match(colors,/background-color:#e4e9e5!important/);
 assert.match(colors,/color:#929d95!important/);
 assert.match(colors,/cursor:wait!important/);
});
test('every persisted edit path disables unchanged writes',async()=>{
 const paths=[
  ['src/AboutManagement.tsx',/disabled=\{busy\|\|loading\|\|!hasUnsavedChanges\}/],
  ['src/NoticeComposer.tsx',/disabled=\{busy\|\|Boolean\(initial&&!hasPersistedChanges\)\}/],
  ['src/GalleryUploadDialog.tsx',/disabled=\{busy\|\|!albumChanged/],
  ['src/EquipmentManager.tsx',/disabled=\{busy\|\|saving\|\|!equipmentChanged\}/],
  ['src/DonationManagement.tsx',/disabled=\{busy\|\|!editingChanged\}/],
  ['src/ExpenseManagement.tsx',/disabled=\{busy\|\|!editingChanged\}/],
  ['src/MemberManager.tsx',/disabled=\{busy \|\| !memberEditChanged/],
  ['src/HandoverNotes.tsx',/disabled=\{loading\|\|saving\|\|!dirty\}/],
  ['src/ScheduleRoom.tsx',/disabled=\{!dirty\|\|saving\}/],
  ['src/FinancePages.tsx',/disabled=\{busy\|\|!accountChanged\}/],
 ];
 for(const [path,pattern] of paths){
  assert.match(await read(path),pattern,path);
 }
});
test('async editors and full-page management operations opt into wait cursor state',async()=>{
 for(const path of ['src/AboutManagement.tsx','src/NoticeComposer.tsx','src/GalleryUploadDialog.tsx',
  'src/EquipmentManager.tsx','src/DonationManagement.tsx','src/ExpenseManagement.tsx',
  'src/MemberManager.tsx','src/ScheduleRoom.tsx','src/HandoverNotes.tsx','src/App.tsx']){
  assert.match(await read(path),/data-async-busy=\{/,'missing busy marker in '+path);
 }
});

test('gallery fixtures use GitHub blob references and survive ordinary gallery purge',async()=>{
 const [images,gallery]=await Promise.all([read('functions/_lib/githubImages.js'),read('functions/_lib/gallery.js')]);
 assert.match(images,/export async function getDummyGalleryFixtures/);
 assert.match(images,/export async function ensureDummyGalleryFixtures/);
 assert.match(images,/fixtures\/gallery/);
 assert.match(images,/sha\};/);
 assert.match(images,/const FOLDERS=new Set\(\['site','notices','gallery','equipment'\]\)/);
 assert.match(gallery,/fixtures\\\/gallery/);
});
