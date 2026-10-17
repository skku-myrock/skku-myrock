import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root='https://firestore.googleapis.com/v1/projects/skku-myrock/databases/(default)/documents';
async function loadModule(){
 const path=new URL('../functions/_lib/gallery.js',import.meta.url);
 let code=await readFile(path,'utf8');
 code=code.replace("import {FIRESTORE_ROOT,docFields,toFields,reject,validateUpdateTime} from './shared.js';",
  'const FIRESTORE_ROOT='+JSON.stringify(root)+';const docFields=doc=>doc.fields;const toFields=obj=>obj;const reject=(message,status=400)=>{throw Object.assign(new Error(message),{status})};const validateUpdateTime=x=>x;');
 code=code.replace("import {googleRequest} from './google.js';",
  "const googleRequest=async(env,url,options)=>{globalThis.__galleryQueries.push({url,options});if(url.endsWith(':runAggregationQuery'))return {ok:true,data:[{result:{aggregateFields:{albumCount:{integerValue:'27'}}}}]};return {ok:true,data:[{document:{name:'projects/test/databases/(default)/documents/galleryAlbums/example',fields:{category:'공연',title:'최근 공연',createdAt:'2026-10-15T10:00:00Z',photos:[]}}}]};};");
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
test('real gallery page number, category, count and date order use 12-record Firestore queries',async()=>{
 globalThis.__galleryQueries=[];
 try{
  const mod=await loadModule();
  const result=await mod.listGalleryPage({}, {page:2,category:'공연'});
  assert.equal(result.page,2);
  assert.equal(result.total,27);
  assert.equal(result.totalPages,3);
  assert.equal(result.pageSize,12);
  assert.deepEqual(result.albums.map(x=>x.title),['최근 공연']);
  const [count,query]=globalThis.__galleryQueries;
  assert.ok(count.url.endsWith(':runAggregationQuery'));
  assert.equal(count.options.body.structuredAggregationQuery.structuredQuery.where.fieldFilter.value.stringValue,'공연');
  assert.ok(query.url.endsWith(':runQuery'));
  const q=query.options.body.structuredQuery;
  assert.equal(q.limit,12);
  assert.equal(q.offset,12);
  assert.equal(q.where.fieldFilter.value.stringValue,'공연');
  assert.deepEqual(q.orderBy.map(x=>x.field.fieldPath),['createdAt','__name__']);
  assert.ok(q.orderBy.every(x=>x.direction==='DESCENDING'));
  const moved=await mod.listGalleryPage({},{page:4});
  assert.equal(moved.page,3);
  assert.equal(globalThis.__galleryQueries.at(-1).options.body.structuredQuery.offset,24);
  await assert.rejects(()=>mod.listGalleryPage({},{page:0}),/페이지 번호/);
 }finally{delete globalThis.__galleryQueries}
});
