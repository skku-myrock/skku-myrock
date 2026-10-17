import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const uuid='11111111-1111-4111-8111-111111111111';
const imageUrl='https://myrock-images.pages.dev/equipment/'+uuid+'.webp';
const env={MYROCK_IMAGES_PUBLIC_BASE_URL:'https://myrock-images.pages.dev/',GITHUB_IMAGES_TOKEN:'test'};
async function loadModule(){
 let code=await read('functions/_lib/githubImages.js');
 for(const [original,replacement] of [
  ["import {reject} from './shared.js';","const reject=(message,status=400)=>{throw Object.assign(new Error(message),{status})};"],
  ["import {getAbout} from './aboutContent.js';","const getAbout=async()=>globalThis.__equipmentPhotoRefs.about;"],
  ["import {listNotices} from './notices.js';","const listNotices=async()=>globalThis.__equipmentPhotoRefs.notices;"],
  ["import {listGalleryAlbums} from './gallery.js';","const listGalleryAlbums=async()=>globalThis.__equipmentPhotoRefs.albums;"],
  ["import {listEquipment} from './equipment.js';","const listEquipment=async()=>globalThis.__equipmentPhotoRefs.equipment;"],
 ]){if(!code.includes(original))throw Error('source import changed');code=code.replace(original,replacement);}
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
test('used equipment photos are never removed, including references in other content',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('Unexpected GitHub request');};
 const base=()=>({equipment:[],albums:[],notices:[],about:{content:{homeImage:'',heroImage:'',officers:[]}}});
 try{
  const {deleteUnusedEquipmentImages}=await loadModule();
  for(const scenario of [
   {equipment:[{imageUrl}]},
   {albums:[{photos:[imageUrl]}]},
   {notices:[{blocks:[{kind:'image',url:imageUrl}]}]},
   {about:{content:{homeImage:imageUrl,heroImage:'',officers:[]}}},
  ]){
   globalThis.__equipmentPhotoRefs={...base(),...scenario};
   assert.equal((await deleteUnusedEquipmentImages(env,[imageUrl])).deleted,0);
  }
  assert.equal((await deleteUnusedEquipmentImages(env,[imageUrl.replace('/equipment/','/gallery/')])).deleted,0);
  assert.equal(calls,0);
 }finally{globalThis.fetch=original;delete globalThis.__equipmentPhotoRefs;}
});
test('unreferenced generated equipment images are removed only from equipment folder',async()=>{
 const previous=globalThis.fetch,actions=[];
 globalThis.__equipmentPhotoRefs={equipment:[],albums:[],notices:[],about:{content:{homeImage:'',heroImage:'',officers:[]}}};
 globalThis.fetch=async(url,init={})=>{
  const path=String(url).split('/myrock-images/')[1];
  actions.push({path,method:init.method??'GET',body:init.body?JSON.parse(init.body):null});
  if(path==='git/ref/heads/main')return Response.json({object:{sha:'head'}});
  if(path==='git/commits/head')return Response.json({tree:{sha:'old-tree'}});
  if(path==='git/trees/old-tree?recursive=1')return Response.json({truncated:false,tree:[{path:'equipment/'+uuid+'.webp',type:'blob'}]});
  if(path==='git/trees')return Response.json({sha:'new-tree'});
  if(path==='git/commits')return Response.json({sha:'new-commit'});
  if(path==='git/refs/heads/main')return Response.json({});
  throw Error('Unexpected GitHub path: '+path);
 };
 try{
  const {deleteUnusedEquipmentImages}=await loadModule();
  assert.equal((await deleteUnusedEquipmentImages(env,[imageUrl])).deleted,1);
  const change=actions.find(x=>x.method==='POST'&&x.path==='git/trees');
  assert.deepEqual(change.body.tree,[{path:'equipment/'+uuid+'.webp',mode:'100644',type:'blob',sha:null}]);
  assert.ok(actions.some(x=>x.path==='git/refs/heads/main'&&x.method==='PATCH'));
 }finally{globalThis.fetch=previous;delete globalThis.__equipmentPhotoRefs;}
});
