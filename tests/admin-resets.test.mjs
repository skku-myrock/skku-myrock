import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clearImageFolder} from '../functions/_lib/githubImages.js';
const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('notice management action stays aligned with author and date',async()=>{
 const app=await source('src/App.tsx'),style=await source('src/styles.css');
 const h=app.indexOf('<header className="notice-detail-header">'),e=app.indexOf('</header>',h);
 const section=app.slice(h,e);
 assert.match(section,/notice-detail-meta/);
 assert.match(section,/notice-detail-byline/);
 assert.ok(section.indexOf('notice-detail-byline')<section.indexOf('notice-manage-actions'));
 assert.match(style,/\.notice-detail-meta\{[^}]*justify-content:space-between/);
});

test('desktop and mobile menus expose exactly three independently scoped reset actions',async()=>{
 const app=await source('src/App.tsx');
 assert.match(app,/isDeveloperSuperadmin=Boolean\(user && profile\?\.superadmin && hasSystemClaim\)/);
 for(const name of ['공지사항 초기화','모여락 소개 초기화','에셋 초기화'])
   assert.equal(app.split('>'+name).length-1,2,name);
 for(const method of ['purgeNotices()','resetClubIntroduction()','resetSiteAssets()'])
   assert.ok(app.includes(method),method);
 assert.match(app,/GitHub 이미지 파일은 그대로 유지됩니다/);
});

test('all reset APIs enforce signed and stored superadmin flags',async()=>{
 const handlers=await Promise.all(['functions/api/about/reset.js','functions/api/notices/purge.js','functions/api/images/reset.js'].map(source));
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
  await assert.rejects(clearImageFolder({GITHUB_IMAGES_TOKEN:'fake'},'gallery'),/허용되지 않은 이미지 폴더/);
 }finally{globalThis.fetch=original;}
});
