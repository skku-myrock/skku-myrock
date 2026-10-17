import {readStyles} from './readStyles.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clearImageFolder} from '../functions/_lib/githubImages.js';
import {withoutAboutPhotoUrls,resetAboutTextKeepingImages,DEFAULT_ABOUT} from '../functions/_lib/aboutContent.js';
const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('notice management action stays aligned with author and date',async()=>{
 const app=await source('src/pages/SitePages.tsx'),style=await readStyles();
 const h=app.indexOf('<header className="notice-detail-header">'),e=app.indexOf('</header>',h);
 const section=app.slice(h,e);
 assert.match(section,/notice-detail-meta/);
 assert.match(section,/notice-detail-byline/);
 assert.ok(section.indexOf('notice-detail-byline')<section.indexOf('notice-manage-actions'));
 assert.match(style,/\.notice-detail-meta\{[^}]*justify-content:space-between/);
});

test('desktop and mobile menus expose exactly four composed reset actions',async()=>{
 const app=await source('src/App.tsx');
 assert.match(app,/isDeveloperSuperadmin=Boolean\(user && profile\?\.superadmin && hasSystemClaim\)/);
 for(const name of ['후원 회계 초기화','활동 초기화','나머지 초기화','완전 초기화'])
   assert.equal(app.split('>'+name).length-1,2,name);
 for(const scope of ['finance','activity','other','all'])
   assert.equal(app.split("resetCategory('"+scope+"')").length-1,2,scope);
 assert.doesNotMatch(app,/>명단 초기화|>에셋 초기화|>갤러리 초기화/);
 const start=app.indexOf('async function resetCategory(');
 const end=app.indexOf('const isDeveloperSuperadmin=',start);
 const section=app.slice(start,end);
 for(const step of ['purgeDonations','purgeSchedules','resetEquipmentLoans','purgeNotices','purgeGallery','resetSiteAssets','resetClubIntroduction'])
   assert.ok(section.includes(step),step);
 assert.ok(section.indexOf('purgeNotices')<section.indexOf('resetSiteAssets'));
 assert.ok(section.indexOf('resetSiteAssets')<section.indexOf('resetClubIntroduction'));
 assert.match(section,/회원 명단·로그인 계정·인수인계/);
});

test('all reset APIs enforce signed and stored superadmin flags',async()=>{
 const handlers=await Promise.all(['functions/api/about/reset.js','functions/api/notices/purge.js','functions/api/images/reset.js','functions/api/gallery/purge.js','functions/api/schedules/purge.js','functions/api/equipment/reset.js'].map(source));
 for(const code of handlers){
   assert.match(code,/assertAccess\(request,env,'president'\)/);
   assert.match(code,/if\(!caller.superadmin\)reject/);
   assert.match(code,/confirmation/);
 }
 assert.match(handlers[0],/DEFAULT_ABOUT/);
 assert.doesNotMatch(handlers[0],/clearImageFolder|GITHUB_IMAGES_TOKEN/);
 assert.match(handlers[1],/clearImageFolder\(env,'notices'\)/);
 assert.match(handlers[1],/BATCH_SIZE=20/);
 assert.match(handlers[2],/clearImageFolder\(env,'site'\)/);
 assert.match(handlers[2],/legacyPrefix/);
 assert.match(handlers[2],/listNotices/);
 assert.match(handlers[3],/clearImageFolder\(env,'gallery'\)/);
 assert.match(handlers[3],/BATCH_SIZE=20/);
});

test('GitHub cleanup replaces only the requested image directory',async()=>{
 const original=globalThis.fetch;
 const calls=[];let stage=0;
 const reply=obj=>new Response(JSON.stringify(obj),{status:200,headers:{'content-type':'application/json'}});
 globalThis.fetch=async(url,options={})=>{
   const uri=new URL(String(url));calls.push({path:uri.pathname,method:options.method,body:options.body?JSON.parse(options.body):undefined});
   if(uri.pathname.endsWith('git/ref/heads/main'))return reply({object:{sha:'base-commit'}});
   if(uri.pathname.endsWith('git/commits/base-commit'))return reply({tree:{sha:'base-root'}});
   if(uri.pathname.endsWith('git/trees')&&options.method==='POST')return reply({sha:++stage%2?'clean-subtree':'new-root'});
   if(uri.pathname.endsWith('git/commits')&&options.method==='POST')return reply({sha:'new-commit'});
   if(uri.pathname.endsWith('git/refs/heads/main')&&options.method==='PATCH')return reply({});
   throw Error('unexpected GitHub API '+uri);
 };
 try{
  for(const folder of ['notices','site']){
   calls.length=0;
   const result=await clearImageFolder({GITHUB_IMAGES_TOKEN:'fake'},folder);
   assert.deepEqual(result,{changed:true,commit:'new-commit'});
   const trees=calls.filter(x=>x.path.endsWith('git/trees'));
   assert.equal(trees.length,2);
   assert.deepEqual(trees[0].body.tree,[{path:'.gitkeep',mode:'100644',type:'blob',content:''}]);
   assert.deepEqual(trees[1].body.tree,[{path:folder,mode:'040000',type:'tree',sha:'clean-subtree'}]);
   assert.equal(trees[1].body.base_tree,'base-root');
   assert.ok(!JSON.stringify(calls).includes('gallery'));
   assert.deepEqual(calls.at(-1).body,{sha:'new-commit',force:false});
  }
  const galleryResult=await clearImageFolder({GITHUB_IMAGES_TOKEN:'fake'},'gallery');
  assert.equal(galleryResult.changed,true);
  const mostRecentTree=calls.filter(x=>x.path.endsWith('git/trees')).at(-1);
  assert.equal(mostRecentTree.body.tree[0].path,'gallery');
  await assert.rejects(clearImageFolder({GITHUB_IMAGES_TOKEN:'fake'},'unknown'),/허용되지 않은 이미지 폴더/);
 }finally{globalThis.fetch=original;}
});

test('asset cleanup clears all Firestore intro photo references but preserves club content',()=>{
 const original={
  ...DEFAULT_ABOUT,homeImage:'https://images.example/site/home.jpg',
  heroImage:'https://images.example/site/intro.jpg',
  officers:DEFAULT_ABOUT.officers.map((person,index)=>({...person,photoUrl:index%2===0?'https://images.example/site/member.jpg':''}))
 };
 const cleaned=withoutAboutPhotoUrls(original);
 assert.equal(cleaned.homeImage,'');
 assert.equal(cleaned.heroImage,'');
 assert.ok(cleaned.officers.every(person=>person.photoUrl===''));
 assert.deepEqual(cleaned.officers.map(({photoUrl,...person})=>person),original.officers.map(({photoUrl,...person})=>person));
 assert.equal(cleaned.cohortLabel,original.cohortLabel);
 assert.deepEqual(cleaned.history,original.history);
 assert.deepEqual(withoutAboutPhotoUrls(cleaned),cleaned);
 assert.deepEqual(original.officers[0].photoUrl,'https://images.example/site/member.jpg');
});

test('asset reset checks legacy notice references before GitHub reset, then clears Firestore URLs',async()=>{
 const handler=await source('functions/api/images/reset.js');
 assert.match(handler,/getAbout\(env\)/);
 assert.match(handler,/withoutAboutPhotoUrls\(content\)/);
 assert.match(handler,/saveAbout\(env,withoutPhotos,updateTime\)/);
 assert.match(handler,/if\(photosPresent\)/);
 assert.ok(handler.indexOf('if(referenced)reject')<handler.indexOf('clearImageFolder(env,\'site\')'));
 assert.ok(handler.indexOf('clearImageFolder(env,\'site\')')<handler.indexOf('saveAbout(env,withoutPhotos,updateTime)'));
 const app=await source('src/App.tsx');
 assert.match(app,/await resetSiteAssets\(\)/);
 assert.match(app,/invalidateAboutCache\(\);setAboutRevision\(v=>v\+1\)/);
 assert.match(app,/'home': <Home key=\{aboutRevision\}/);
 const notices=await source('functions/api/notices/purge.js');
 assert.doesNotMatch(notices,/getAbout|saveAbout|withoutAboutPhotoUrls/);
 assert.match(notices,/clearImageFolder\(env,'notices'\)/);
});

test('introduction reset preserves homepage, about and all eight officer photos',()=>{
 const source={
   ...DEFAULT_ABOUT,
   cohortLabel:'임시 운영진 소개',
   homeImage:'https://myrock-images.pages.dev/site/home.webp',
   heroImage:'https://myrock-images.pages.dev/site/intro.webp',
   officers:DEFAULT_ABOUT.officers.map((person,index)=>({...person,id:'custom-'+index,position:'임시 직책',photoUrl:'https://myrock-images.pages.dev/site/'+index+'.jpg'})),
   history:[{id:'recent',year:'2026년',description:'임시 연혁'}]
 };
 const reset=resetAboutTextKeepingImages(source);
 assert.equal(reset.homeImage,source.homeImage);
 assert.equal(reset.heroImage,source.heroImage);
 assert.deepEqual(reset.officers.map(person=>person.photoUrl),source.officers.map(person=>person.photoUrl));
 assert.deepEqual(reset.officers.map(({photoUrl,...person})=>person),DEFAULT_ABOUT.officers.map(({photoUrl,...person})=>person));
 assert.deepEqual(reset.history,DEFAULT_ABOUT.history);
 assert.equal(reset.cohortLabel,DEFAULT_ABOUT.cohortLabel);
 assert.deepEqual(resetAboutTextKeepingImages(reset),reset);
 assert.equal(source.officers[0].position,'임시 직책');
});

test('introduction reset preserves officer photo ownership if member order changed',()=>{
 const original={
   ...DEFAULT_ABOUT,
   officers:[...DEFAULT_ABOUT.officers].reverse().map((person,index)=>({...person,photoUrl:'https://photos.example/'+person.name+'.webp'}))
 };
 const result=resetAboutTextKeepingImages(original);
 for(const person of result.officers)
   assert.equal(person.photoUrl,'https://photos.example/'+person.name+'.webp');
});

test('introduction reset API reuses stored image links instead of blank image defaults',async()=>{
 const handler=await source('functions/api/about/reset.js');
 assert.match(handler,/resetAboutTextKeepingImages\(original\.ok\?docFields\(original\.data\):DEFAULT_ABOUT\)/);
 assert.match(handler,/toFields\(next\)/);
 assert.doesNotMatch(handler,/toFields\(DEFAULT_ABOUT\)/);
 assert.doesNotMatch(handler,/clearImageFolder/);
 const asset=await source('functions/api/images/reset.js');
 assert.match(asset,/withoutAboutPhotoUrls\(content\)/);
});

test('composed reset confirmation is shown once and clients use signed requests',async()=>{
 const app=await source('src/App.tsx');
 assert.doesNotMatch(app,/window\.prompt\(/);
 const start=app.indexOf('async function resetCategory(');
 const end=app.indexOf('const isDeveloperSuperadmin=',start);
 const block=app.slice(start,end);
 assert.equal((block.match(/window\.confirm\(/g)||[]).length,1);
 assert.match(block,/setResettingScope\(scope\)/);
 const client=await source('src/adminResets.ts');
 assert.match(client,/confirmation/);
 assert.match(client,/purgeSchedules/);
 assert.match(client,/resetEquipmentLoans/);
});

test('schedule reset removes participant subcollections before schedule documents, then invitations and throttles',async()=>{
 const endpoint=await source('functions/api/schedules/purge.js');
 assert.match(endpoint,/SCHEDULES,INVITATIONS,THROTTLES/);
 assert.match(endpoint,/schedule\.name\+'\/participants'/);
 assert.ok(endpoint.indexOf("participants=await removePage")<endpoint.indexOf('await commit(env,validateDocuments([schedule]'));
 assert.match(endpoint,/currentDocument:\{updateTime:doc\.updateTime\}/);
 assert.match(endpoint,/RESET_SCHEDULES_CONFIRMATION/);
});

test('equipment reset retains definitions and photos, clears only loan state',async()=>{
 const endpoint=await source('functions/api/equipment/reset.js');
 assert.match(endpoint,/resolvedItem/);
 assert.match(endpoint,/item\.archived/);
 assert.match(endpoint,/itemWrite\(\{\.\.\.item,borrower:null,queue:\[\],returnRequestedAt:''\},doc\)/);
 assert.doesNotMatch(endpoint,/clearImageFolder|deleteUnusedEquipmentImages|method:'DELETE'/);
});
