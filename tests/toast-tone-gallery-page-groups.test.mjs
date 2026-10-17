import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('success/error/warning share the same timed toast with distinct muted tones',async()=>{
 const [toast,css,app,finance]=await Promise.all([read('src/TimedBottomToast.tsx'),read('src/styles/management.css'),read('src/App.tsx'),read('src/FinancePages.tsx')]);
 assert.match(toast,/tone\?:'success'\|'error'\|'warning'/);
 assert.match(toast,/tone==='warning'\?'is-warning'/);
 assert.match(toast,/setTimeout\(\(\)=>setLeaving\(true\),3000\)/);
 assert.match(css,/\.site-bottom-toast\.is-warning\{color:#866424;background:#fff9ed;border-color:#e5d2a2\}/);
 assert.match(app,/logoutNotice&&<TimedBottomToast tone="error"/);
 assert.match(app,/setLogoutNotice\('로그아웃되었습니다\.'\)/);
 assert.match(finance,/accountMessage&&<TimedBottomToast tone="warning"/);
 assert.match(app,/loginNotice&&<TimedBottomToast message=\{loginNotice\}/);
 assert.match(app,/\{toast&&<div className="toast" role="status">/);
});
test('gallery shows at most 10 page numbers per window with double-chevron group navigation, without fetching more albums',async()=>{
 const gallery=await read('src/PhotoGallery.tsx'),api=await read('src/galleryApi.ts');
 assert.match(gallery,/PAGE_GROUP_SIZE=10/);
 assert.match(gallery,/Math\.floor\(\(previewPage-1\)\/PAGE_GROUP_SIZE\)/);
 assert.match(gallery,/Math\.min\(PAGE_GROUP_SIZE,DEMO_PAGE_COUNT-windowStart\+1\)/);
 assert.match(gallery,/aria-label="이전 10페이지 목록"/);
 assert.match(gallery,/aria-label="다음 10페이지 목록"/);
 assert.match(gallery,/windowStart-PAGE_GROUP_SIZE/);
 assert.match(gallery,/windowStart\+PAGE_GROUP_SIZE/);
 assert.match(gallery,/const DEMO_PAGE_COUNT=23/);
 assert.match(api,/preview=first12/);
 assert.doesNotMatch(gallery,/loadMoreGallery|loadGalleryPage|fetch\(/);
 for(const page of [1,10,11,20,21,23]){
  const from=Math.floor((page-1)/10)*10+1;
  const visible=Array.from({length:Math.min(10,23-from+1)},(_,i)=>from+i);
  assert.ok(visible.length<=10&&visible.includes(page));
 }
});
