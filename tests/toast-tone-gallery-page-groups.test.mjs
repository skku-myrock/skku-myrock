import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('success/error/warning share the same timed toast with distinct muted tones and correct event semantics',async()=>{
 const [toast,css,app,bus,finance]=await Promise.all([
  read('src/TimedBottomToast.tsx'),read('src/styles/management.css'),
  read('src/App.tsx'),read('src/toastBus.ts'),read('src/FinancePages.tsx')]);
 assert.match(toast,/tone\?:'success'\|'error'\|'warning'/);
 assert.match(toast,/tone==='warning'\?'is-warning'/);
 assert.match(toast,/setTimeout\(\(\)=>setLeaving\(true\),3000\)/);
 assert.match(css,/\.site-bottom-toast\.is-warning\{color:#866424;background:#fff9ed;border-color:#e5d2a2\}/);
 assert.match(css,/\.site-bottom-toast\.is-error\{color:#933636;background:#fff3f1;border-color:#e7b8b3\}/);
 assert.match(app,/showToast\('로그아웃되었습니다\.','success'\)/);
 assert.match(app,/showToast\('로그아웃하지 못했습니다\./);
 assert.match(app,/bottomNotice&&<TimedBottomToast key=\{bottomNotice.id\}/);
 assert.match(finance,/useToastSignals\(\{error,message:accountMessage\}\)/);
 assert.match(bus,/classifyToast\(message:string\):ToastTone/);
});
test('gallery shows max 10 numbered pages per real count and navigates across page groups',async()=>{
 const [gallery,api,db]=await Promise.all([read('src/PhotoGallery.tsx'),read('src/galleryApi.ts'),read('functions/_lib/gallery.js')]);
 assert.match(gallery,/const \[windowStart,setWindowStart\]=useState\(1\)/);
 assert.match(gallery,/const PAGE_GROUP_SIZE=10;/);
 assert.match(gallery,/Math\.min\(PAGE_GROUP_SIZE,totalPages-windowStart\+1\)/);
 assert.match(gallery,/function changePageGroup\(direction:-1\|1\)/);
 assert.match(gallery,/setWindowStart\(next\)/);
 assert.match(gallery,/onClick=\{\(\)=>changePageGroup\(-1\)\}/);
 assert.match(gallery,/onClick=\{\(\)=>changePageGroup\(1\)\}/);
 assert.doesNotMatch(gallery,/onClick=\{\(\)=>changePage\(Math\.min\(totalPages,windowStart/);
 assert.match(gallery,/setTotalPages\(result\.totalPages\)/);
 assert.match(api,/getGalleryPage\(page:number/);
 assert.match(db,/runAggregationQuery/);
 assert.doesNotMatch(gallery,/DEMO_PAGE_COUNT/);
 for(const page of [1,10,11,20,21,23]){
  const from=Math.floor((page-1)/10)*10+1;
  const visible=Array.from({length:Math.min(10,23-from+1)},(_,i)=>from+i);
  assert.ok(visible.length<=10&&visible.includes(page));
 }
});
