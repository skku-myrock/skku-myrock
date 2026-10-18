import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const uid='11111111-1111-4111-8111-111111111111';
const base='https://myrock-images.pages.dev/';
const sitePhoto=base+'site/'+uid+'.webp';

async function loadImages(){
 let code=await read('functions/_lib/githubImages.js');
 for(const [from,to] of [
  ["import {reject} from './shared.js';","const reject=(message,status)=>{throw Object.assign(new Error(message),{status})};"],
  ["import {getAbout} from './aboutContent.js';","const getAbout=async()=>globalThis.__equipmentPhotoRefs.about;"],
  ["import {listNotices} from './notices.js';","const listNotices=async()=>globalThis.__equipmentPhotoRefs.notices;"],
  ["import {listGalleryAlbums} from './gallery.js';","const listGalleryAlbums=async()=>globalThis.__equipmentPhotoRefs.albums;"],
  ["import {listEquipment} from './equipment.js';","const listEquipment=async()=>globalThis.__equipmentPhotoRefs.equipment;"],
 ]){if(!code.includes(from))throw Error('Source import changed');code=code.replace(from,to);}
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
const empty=()=>({equipment:[],notices:[],albums:[],about:{content:{homeImage:'',heroImage:'',officers:[]}}});
const env={GITHUB_IMAGES_TOKEN:'test',MYROCK_IMAGES_PUBLIC_BASE_URL:base};

test('logical equipment uploads commit only to site/ while still requiring part-leader permission',async()=>{
 let code=await read('functions/api/images/batch.js');
 code=code.replace("import {failure,reject,secureOrigin,success} from '../../_lib/shared.js';",
  `const reject=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const secureOrigin=()=>{};
const success=(body,status=200)=>new Response(JSON.stringify(body),{status});
const failure=error=>new Response(JSON.stringify({error:error.message}),{status:error.status??500});`);
 code=code.replace("import {assertAccess} from '../../_lib/google.js';",
  "const assertAccess=async(req,env,role)=>{globalThis.__uploadRequestedRole=role;};");
 const upload=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).uploadImages;
 const oldFetch=globalThis.fetch,actions=[];
 globalThis.fetch=async(url,opts={})=>{
  const path=String(url).split('/myrock-images/')[1];
  actions.push({path,method:opts.method??'GET',body:opts.body?JSON.parse(opts.body):null});
  if(path==='git/ref/heads/main')return Response.json({object:{sha:'head'}});
  if(path==='git/commits/head')return Response.json({tree:{sha:'old-tree'}});
  if(path==='git/blobs')return Response.json({sha:'blob-sha'});
  if(path==='git/trees')return Response.json({sha:'tree-sha'});
  if(path==='git/commits')return Response.json({sha:'commit-sha'});
  if(path==='git/refs/heads/main')return Response.json({});
  throw Error('Unexpected path '+path);
 };
 try{
  const form=new FormData(),bytes=new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80,86,80,56,32]);
  form.append('folder','equipment');
  form.append('images',new Blob([bytes],{type:'image/webp'}),'test.webp');
  const request=new Request('https://skku-myrock.pages.dev/api/images/batch',{method:'POST',body:form});
  const result=await upload({request,env});
  assert.equal(result.status,201);
  assert.equal(globalThis.__uploadRequestedRole,'part_leader');
  const data=await result.json();
  assert.match(data.url,/^https:\/\/myrock-images\.pages\.dev\/site\/[a-f0-9-]+\.webp$/);
  assert.match(data.path,/^site\/[a-f0-9-]+\.webp$/);
  const tree=actions.find(a=>a.path==='git/trees');
  assert.equal(tree.body.tree.length,1);
  assert.match(tree.body.tree[0].path,/^site\/[a-f0-9-]+\.webp$/);
  assert.ok(!actions.some(a=>JSON.stringify(a.body).includes('equipment/')));
 }finally{globalThis.fetch=oldFetch;delete globalThis.__uploadRequestedRole;}
});

test('shared site cleaner protects equipment, gallery, notice, and introduction references',async()=>{
 const saved=globalThis.fetch;let fetchCalls=0;
 globalThis.fetch=async()=>{fetchCalls++;throw Error('Unexpected GitHub request');};
 try{
  const {deleteUnusedSiteImages}=await loadImages();
  for(const extra of [
   {equipment:[{imageUrl:sitePhoto}]},
   {albums:[{photos:[sitePhoto]}]},
   {notices:[{blocks:[{kind:'image',url:sitePhoto}]}]},
   {about:{content:{homeImage:'',heroImage:sitePhoto,officers:[]}}},
  ]){
   globalThis.__equipmentPhotoRefs={...empty(),...extra};
   assert.equal((await deleteUnusedSiteImages(env,[sitePhoto])).deleted,0);
  }
  assert.equal(fetchCalls,0);
 }finally{globalThis.fetch=saved;delete globalThis.__equipmentPhotoRefs;}
});

test('retiring an equipment site image removes the unused site blob only',async()=>{
 const saved=globalThis.fetch,actions=[];
 globalThis.__equipmentPhotoRefs=empty();
 globalThis.fetch=async(url,opts={})=>{
  const path=String(url).split('/myrock-images/')[1];
  actions.push({path,method:opts.method??'GET',body:opts.body?JSON.parse(opts.body):null});
  if(path==='git/ref/heads/main')return Response.json({object:{sha:'head'}});
  if(path==='git/commits/head')return Response.json({tree:{sha:'old-tree'}});
  if(path==='git/trees')return Response.json({sha:'next-tree'});
  if(path==='git/commits')return Response.json({sha:'new-commit'});
  if(path==='git/refs/heads/main')return Response.json({});
  throw Error('Unexpected API '+path);
 };
 try{
  const {deleteUnusedEquipmentImages}=await loadImages();
  assert.equal((await deleteUnusedEquipmentImages(env,[sitePhoto])).deleted,1);
  const tree=actions.find(action=>action.path==='git/trees');
  assert.deepEqual(tree.body.tree,[{path:'site/'+uid+'.webp',mode:'100644',type:'blob',sha:null}]);
  assert.ok(actions.some(a=>a.path==='git/refs/heads/main'&&a.method==='PATCH'));
 }finally{globalThis.fetch=saved;delete globalThis.__equipmentPhotoRefs;}
});

test('site reset refuses to erase live equipment URLs and the composed other reset removes equipment first',async()=>{
 const [siteReset,equipmentPurge,app,images]=await Promise.all([
  read('functions/api/images/reset.js'),read('functions/api/equipment/purge.js'),
  read('src/App.tsx'),read('functions/_lib/githubImages.js')
 ]);
 assert.match(siteReset,/const equipment=await listEquipment\(env\)/);
 assert.match(siteReset,/item\.imageUrl\.startsWith\(legacyPrefix\)/);
 assert.ok(siteReset.indexOf('listEquipment(env)')<siteReset.indexOf("clearImageFolder(env,'site')"));
 assert.doesNotMatch(equipmentPurge,/clearImageFolder\(env,'equipment'\)/);
 const start=app.indexOf('async function resetCategory('),end=app.indexOf('async function createDummyData(',start);
 const reset=app.slice(start,end);
 assert.ok(reset.indexOf('await drain(purgeEquipmentInventory')<reset.indexOf('await resetSiteAssets()'));
 assert.match(images,/const FOLDERS=new Set\(\['site','notices','gallery'\]\)/);
});
