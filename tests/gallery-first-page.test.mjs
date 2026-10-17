import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const path=new URL('../functions/_lib/gallery.js',import.meta.url);
const root='https://firestore.googleapis.com/v1/projects/myrock/databases/(default)/documents';
const doc=(id,createdAt)=>({
 name:root+'/galleryAlbums/'+id,
 fields:{category:'공연',title:id,photos:['https://images.example/gallery/'+id+'.webp'],createdAt},
 updateTime:'2026-10-17T00:00:00Z',
});
async function loadGallery(firstPageData){
 const original=await readFile(path,'utf8');
 const js=original
  .replace("import {FIRESTORE_ROOT,docFields,toFields,reject,validateUpdateTime} from './shared.js';",
   "const FIRESTORE_ROOT="+JSON.stringify(root)+";const docFields=doc=>doc.fields;const toFields=data=>data;const reject=msg=>{throw Error(msg)};const validateUpdateTime=value=>value;")
  .replace("import {googleRequest} from './google.js';",
   "const googleRequest=async(env,url,options)=>{globalThis.__galleryFirstPageRequest={url,options};return {ok:true,data:globalThis.__galleryFirstPageRows};};");
 globalThis.__galleryFirstPageRows=firstPageData;
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
test('gallery first page queries only 12 newest album documents',async()=>{
 try{
  const expected=[doc('new','2026-10-16T09:00:00Z'),doc('older','2026-10-15T09:00:00Z')];
  const lib=await loadGallery(expected.map(document=>({document})));
  const albums=await lib.listGalleryFirstPage({});
  assert.deepEqual(albums.map(a=>a.title),['new','older']);
  assert.equal(globalThis.__galleryFirstPageRequest.url,root+':runQuery');
  assert.deepEqual(globalThis.__galleryFirstPageRequest.options.body.structuredQuery.orderBy,[{field:{fieldPath:'createdAt'},direction:'DESCENDING'}]);
  assert.equal(globalThis.__galleryFirstPageRequest.options.body.structuredQuery.limit,12);
  assert.equal(globalThis.__galleryFirstPageRequest.options.method,'POST');
 }finally{delete globalThis.__galleryFirstPageRows;delete globalThis.__galleryFirstPageRequest;}
});
