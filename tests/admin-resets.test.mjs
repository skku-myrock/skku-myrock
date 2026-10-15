import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clearSiteImages} from '../functions/api/about/reset.js';
const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('notice management action is part of publication metadata, not beneath header',async()=>{
 const app=await source('src/App.tsx'),style=await source('src/styles.css');
 const h=app.indexOf('<header className="notice-detail-header">');
 const e=app.indexOf('</header>',h);
 const section=app.slice(h,e);
 assert.match(section,/notice-detail-meta/);
 assert.match(section,/notice-detail-byline/);
 assert.match(section,/notice-manage-actions/);
 assert.ok(section.indexOf('notice-detail-byline')<section.indexOf('notice-manage-actions'));
 assert.match(style,/\.notice-detail-meta\{[^}]*justify-content:space-between/);
 assert.match(style,/\.notice-manage-actions\{[^}]*margin:0 0 0 auto/);
});

test('both reset buttons are shown only inside verified superadmin menus',async()=>{
 const app=await source('src/App.tsx');
 assert.match(app,/const isDeveloperSuperadmin=Boolean\(user && profile\?\.superadmin && hasSystemClaim\)/);
 assert.equal(app.split('>공지사항 초기화').length-1,2);
 assert.equal(app.split('>모여락 소개 초기화').length-1,2);
 assert.match(app,/purgeNotices\(\)/);
 assert.match(app,/resetClubIntroduction\(\)/);
 assert.match(app,/공지사항에 사용된 사진도 사라져 링크가 깨질 수 있습니다/);
});

test('destructive reset handlers require server verified superadmin and typed confirmation',async()=>{
 const about=await source('functions/api/about/reset.js'),notices=await source('functions/api/notices/purge.js');
 for(const value of [about,notices]){
   assert.match(value,/assertAccess\(request,env,'president'\)/);
   assert.match(value,/if\(!caller.superadmin\)reject/);
   assert.match(value,/confirmation/);
 }
 assert.match(about,/DEFAULT_ABOUT/);
 assert.match(notices,/BATCH_SIZE=20/);
 assert.match(notices,/currentDocument.updateTime/);
});

test('site purge commits replacement directory but never mutates gallery or other paths',async()=>{
 const original=globalThis.fetch;
 const calls=[];
 let stage=0;
 const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json'}});
 globalThis.fetch=async(url,options={})=>{
   const uri=new URL(String(url));calls.push({path:uri.pathname,method:options.method,body:options.body?JSON.parse(options.body):undefined});
   if(uri.pathname.endsWith('git/ref/heads/main'))return reply({object:{sha:'old-commit'}});
   if(uri.pathname.endsWith('git/commits/old-commit'))return reply({tree:{sha:'original-root'}});
   if(uri.pathname.endsWith('git/trees')&&options.method==='POST'){
     stage++;return reply({sha:stage===1?'clean-site':'new-root'});
   }
   if(uri.pathname.endsWith('git/commits')&&options.method==='POST')return reply({sha:'new-commit'});
   if(uri.pathname.endsWith('git/refs/heads/main')&&options.method==='PATCH')return reply({});
   throw Error('unexpected GitHub URL '+uri);
 };
 try{
   const result=await clearSiteImages({GITHUB_IMAGES_TOKEN:'fake-token'});
   assert.deepEqual(result,{changed:true,commit:'new-commit'});
   const creates=calls.filter(x=>x.path.endsWith('git/trees'));
   assert.equal(creates.length,2);
   assert.deepEqual(creates[0].body.tree,[{path:'.gitkeep',mode:'100644',type:'blob',content:''}]);
   assert.equal(creates[1].body.base_tree,'original-root');
   assert.deepEqual(creates[1].body.tree,[{path:'site',mode:'040000',type:'tree',sha:'clean-site'}]);
   assert.ok(!JSON.stringify(calls).includes('gallery'));
   assert.deepEqual(calls.at(-1).body,{sha:'new-commit',force:false});
 }finally{globalThis.fetch=original;}
});
