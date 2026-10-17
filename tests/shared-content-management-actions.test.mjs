import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('notices and gallery share centered icon edit and delete actions and downward-chevron management triggers',async()=>{
 const [pages,gallery,baseCss,galleryCss]=await Promise.all([
  read('src/pages/SitePages.tsx'),read('src/PhotoGallery.tsx'),read('src/styles/management.css'),read('src/styles/gallery.css')
 ]);
 for(const source of [pages,gallery]){
  assert.match(source,/className="outline-action content-manage-trigger"/);
  assert.match(source,/관리 <ChevronDown size=\{15\}/);
  assert.match(source,/className="content-manage-menu/);
  assert.match(source,/<Pencil size=\{15\}/);
  assert.match(source,/<Trash2 size=\{15\}/);
  assert.match(source,/className="content-manage-delete"/);
 }
 assert.match(baseCss,/\.content-manage-menu button\{[^\n]*justify-content:center/);
 assert.match(baseCss,/\.content-manage-menu\{[^\n]*min-width:104px;gap:2px;padding:4px/);
  assert.match(baseCss,/padding:7px 6px;text-align:center/);
  assert.match(baseCss,/\.notice-manage-menu\{min-width:104px/);
 assert.match(baseCss,/\.content-manage-trigger\{[^\n]*justify-content:center/);
 assert.doesNotMatch(gallery,/MoreHorizontal/);
 assert.doesNotMatch(galleryCss,/\.gallery-manage-menu button\{/);
 assert.doesNotMatch(baseCss,/\.notice-manage-menu button\{/);
});
