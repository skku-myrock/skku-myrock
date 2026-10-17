import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('bottom toast tones are shared and actual success/error semantics are used',async()=>{
 const [toast,css,app,finance]=await Promise.all([read('src/TimedBottomToast.tsx'),read('src/styles/management.css'),read('src/App.tsx'),read('src/FinancePages.tsx')]);
 assert.match(toast,/tone\?:'success'\|'error'\|'warning'/);
 assert.match(css,/\.site-bottom-toast\.is-warning\{color:#866424;background:#fff9ed;border-color:#e5d2a2\}/);
 assert.match(app,/showToast\('로그아웃되었습니다\.','success'\)/);
 assert.match(app,/showToast\('로그아웃하지 못했습니다[\s\S]*?'error'\)/);
 assert.match(finance,/useToastFeedback\(accountMessage,'success'\)/);
});
test('gallery has up to ten numbered buttons, real page fetching and 12 album slots',async()=>{
 const gallery=await read('src/PhotoGallery.tsx'),api=await read('src/galleryApi.ts');
 assert.match(gallery,/PAGE_GROUP_SIZE=10/);
 assert.match(gallery,/Math\.floor\(\(previewPage-1\)\/PAGE_GROUP_SIZE\)/);
 assert.match(gallery,/Math\.min\(PAGE_GROUP_SIZE,totalPages-windowStart\+1\)/);
 assert.match(gallery,/aria-label="이전 10페이지 목록"/);
 assert.match(gallery,/aria-label="다음 10페이지 목록"/);
 assert.match(gallery,/listGalleryAlbums\(previewPage,filter\)/);
 assert.match(api,/page:String\(page\),category/);
 assert.match(gallery,/length:PAGE_SIZE-shown\.length/);
});
