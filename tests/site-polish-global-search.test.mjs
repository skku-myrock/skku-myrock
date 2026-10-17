import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const raw=await read('functions/_lib/notices.js');
const source=raw.replace(
 "import {FIRESTORE_ROOT,docFields,toFields,reject} from './shared.js';",
 "const FIRESTORE_ROOT='https://firestore.googleapis.com/v1/projects/example/databases/(default)/documents'; const docFields=doc=>doc.fields; const toFields=x=>x; const reject=(msg,status)=>{const e=new Error(msg);e.status=status;throw e;};")
 .replace("import {googleRequest} from './google.js';","const googleRequest=()=>{throw Error('unexpected request')};")
 .replace("import {firestorePage} from './firestorePages.js';","const firestorePage=(env,root,options)=>globalThis.__noticeSearchPage(root,options);");
const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const docs=Array.from({length:105},(_,i)=>({
 name:'projects/example/databases/(default)/documents/notices/id'+i,
 updateTime:'2026-10-17T01:00:00Z',
 fields:{title:i%3===0?'모여락 공연 '+i:'모여락 정기 활동 '+i,
 category:i%2===0?'공연':'공지',author:'테스트',publishedAt:new Date(Date.UTC(2026,9,17,0,0,0)-i*60000).toISOString(),description:'본문 공연 검색을 제외해야 합니다'}
}));
function mocked(){
 const calls=[];
 globalThis.__noticeSearchPage=async(root,options)=>{
  const url=new URL(options.request.url),offset=Number(url.searchParams.get('pageToken')??0);
  calls.push({offset,fields:options.fields,limit:options.limit});
  return {documents:docs.slice(offset,offset+30),nextPageToken:offset+30<docs.length?String(offset+30):null};
 };
 return calls;
}
const request=(search,category='전체',pageToken=null)=>{
 const q=new URLSearchParams({search,category});if(pageToken)q.set('pageToken',pageToken);
 return {url:'https://myrock.test/api/notices?'+q};
};
test('notice search checks title across the complete collection, not just first 30 notices',async()=>{
 const calls=mocked();
 try{
  const page1=await mod.listNoticeSummariesPage({},request('공연','공연'));
  assert.equal(page1.notices.length,18);
  assert.equal(page1.nextPageToken,null);
  assert.ok(page1.notices.some(d=>d.title==='모여락 공연 102'));
  assert.ok(calls.length>=4);
  assert.ok(calls.every(c=>c.fields.every(f=>f!=='blocks'&&f!=='body')));
 }finally{delete globalThis.__noticeSearchPage;}
});
test('notice search only matches titles, never description or body',async()=>{
 mocked();
 try{
  const rows=await mod.listNoticeSummariesPage({},request('본문'));
  assert.deepEqual(rows.notices,[]);
  assert.equal(rows.nextPageToken,null);
 }finally{delete globalThis.__noticeSearchPage;}
});
test('notice search rejects invalid category and long search phrases',async()=>{
 await assert.rejects(()=>mod.listNoticeSummariesPage({},request('a','없는분류')),/분류/);
 await assert.rejects(()=>mod.listNoticeSummariesPage({},request('a'.repeat(101))),/1~100/);
});
test('search input changes do not issue requests until submit; manual pagination is independent',async()=>{
 const ui=await read('src/pages/SitePages.tsx');
 assert.match(ui,/onChange=\{e=>setQuery\(e.target.value\)\}/);
 assert.match(ui,/role="search" onSubmit=\{submitSearch\}/);
 assert.match(ui,/setSubmitted\(query.trim\(\)\)/);
 assert.match(ui,/searchNoticeTitlesPage\(submitted,category\)/);
 assert.match(ui,/searchNoticeTitlesPage\(submitted,category,searchCursor\)/);
 assert.match(ui,/className="news-write-row"/);
 assert.match(ui,/type="submit" className="outline-action news-search-button"/);
});
test('Ddrak launches in a new tab from desktop, mobile and footer activity links',async()=>{
 const [nav,app]=await Promise.all([read('src/app/siteNavigation.ts'),read('src/App.tsx')]);
 assert.match(nav,/\{id:'equipment',label:'장비 대여'\},\{id:'ddrak',label:'뜨락',href:'https:\/\/ddrak.vercel.app\/'\}/);
 assert.equal((app.match(/target="_blank" rel="noopener noreferrer"/g)||[]).length>=3,true);
});
test('site images retain shimmer after load errors, without retries, and feature placeholder shadows are kept',async()=>{
 const [img,pages,css]=await Promise.all([read('src/ImageShimmer.tsx'),read('src/pages/SitePages.tsx'),read('src/styles/management.css')]);
 assert.match(img,/onError=\{\(\)=>setState\('pending'\)\}/);
 assert.doesNotMatch(img,/사진을 불러올 수 없습니다|setTimeout|retry|setInterval/);
 assert.match(pages,/className="home-hero-image"\/>/);
 assert.match(pages,/className="about-hero-image"\/>/);
 assert.match(css,/\.hero-media>\.placeholder\.home-hero-image,\.about-intro>\.placeholder\.about-hero-image\{box-shadow/);
 for(const file of ['src/PhotoGallery.tsx','src/NoticeImageCarousel.tsx','src/NoticeComposer.tsx','src/GalleryUploadDialog.tsx','src/EquipmentManager.tsx'])
  assert.match(await read(file),/ImageShimmer/);
});
test('temporary default equipment is removed from server and client, and other reset purges inventory',async()=>{
 const [equipment,api,client,app,defaults]=await Promise.all([
  read('functions/_lib/equipment.js'),read('functions/api/equipment/purge.js'),
  read('src/adminResets.ts'),read('src/App.tsx'),read('src/equipmentDemo.ts')]);
 assert.doesNotMatch(equipment,/DEFAULT_EQUIPMENT|defaultMap/);
 assert.match(equipment,/isRetiredSample/);
 assert.doesNotMatch(defaults,/demo-guitar|demo-mic|demo-di|demo-stand/);
 assert.match(api,/assertAccess\(request,env,'president'\)/);
 assert.match(api,/!caller.superadmin/);
 assert.match(api,/clearImageFolder\(env,'equipment'\)/);
 assert.match(client,/purgeEquipmentInventory/);
 assert.match(app,/await drain\(purgeEquipmentInventory/);
 assert.match(app,/await drain\(resetEquipmentLoans/);
});
test('supporting copy and finance more buttons are consistent',async()=>{
 const [page,finance,css]=await Promise.all([read('src/pages/SitePages.tsx'),read('src/FinancePages.tsx'),read('src/styles/finance.css')]);
 assert.match(page,/합주와 공연, 그리고 함께한 순간들을 통해 모여락만의 이야기를 만들어 갑니다/);
 assert.equal((finance.match(/className="list-bottom finance-load-more"/g)||[]).length,2);
 assert.match(css,/\.finance-load-more\{justify-content:flex-end\}/);
});
