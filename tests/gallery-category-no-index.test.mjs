import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const root='https://firestore.googleapis.com/v1/projects/myrock/databases/(default)/documents';
const category='공연';
const raw=await read('functions/_lib/gallery.js');
const mocked=raw
 .replace("import {FIRESTORE_ROOT,docFields,toFields,reject,validateUpdateTime} from './shared.js';",
  "const FIRESTORE_ROOT="+JSON.stringify(root)+";const docFields=doc=>doc.fields;const toFields=data=>data;const reject=(message,status)=>{const error=new Error(message);error.status=status;throw error};const validateUpdateTime=value=>value;")
 .replace("import {googleRequest} from './google.js';",
  "const googleRequest=(env,url,options)=>globalThis.__galleryCategoryRequest(env,url,options);");
const gallery=await import('data:text/javascript;base64,'+Buffer.from(mocked).toString('base64'));
const documents=Array.from({length:35},(_,i)=>({
 name:root+'/galleryAlbums/'+String(i).padStart(6,'0'),
 updateTime:'2026-10-17T10:00:00Z',
 fields:{category,title:'앨범 '+i,createdAt:new Date(Date.UTC(2026,9,17,0,i)).toISOString(),
  photos:['https://example.org/gallery/'+i+'.webp']}
}));
function mock({noIndex=false,countFailure=false,rows=documents,errorCode='FAILED_PRECONDITION'}={}){
 const calls=[];
 globalThis.__galleryCategoryRequest=async(env,url,options)=>{
  calls.push({url,body:options?.body});
  const query=options?.body?.structuredQuery;
  if(url.endsWith(':runAggregationQuery'))
   return countFailure?{ok:false,status:400,code:errorCode}:
    {ok:true,data:[{result:{aggregateFields:{total:{integerValue:String(rows.length)}}}}]};
  if(url.endsWith(':runQuery')){
   if(query.orderBy?.length&&noIndex)return {ok:false,status:400,code:errorCode};
   const selected=query.orderBy?.length? [...rows].sort((a,b)=>b.fields.createdAt.localeCompare(a.fields.createdAt)||b.name.localeCompare(a.name)):rows;
   const offset=query.offset??0;
   return {ok:true,data:selected.slice(offset,offset+(query.limit??selected.length)).map(document=>({document}))};
  }
  throw Error('unexpected URL '+url);
 };
 return calls;
}

test('gallery UI displays only existing albums without placeholder cards',async()=>{
 const [ui,css]=await Promise.all([read('src/PhotoGallery.tsx'),read('src/styles/gallery.css')]);
 assert.match(ui,/shown\.map\(album/);
 assert.doesNotMatch(ui,/placeholders|gallery-album-placeholder|빈 갤러리/);
 assert.doesNotMatch(css,/gallery-album-placeholder/);
 assert.match(ui,/const PAGE_SIZE=12/);
});

test('category pagination uses indexed server-side query when index is available',async()=>{
 const calls=mock();
 try{
  const result=await gallery.readGalleryPage({}, {page:2,category});
  assert.equal(result.total,35);
  assert.equal(result.totalPages,3);
  assert.equal(result.albums.length,12);
  assert.equal(result.albums[0].title,'앨범 22');
  const q=calls.find(c=>c.body?.structuredQuery?.orderBy);
  assert.equal(q.body.structuredQuery.offset,12);
  assert.equal(q.body.structuredQuery.limit,12);
  assert.equal(q.body.structuredQuery.where.fieldFilter.value.stringValue,category);
 }finally{delete globalThis.__galleryCategoryRequest;}
});

test('missing Firestore composite index falls back to category-only queries and retains newest-first order',async()=>{
 const calls=mock({noIndex:true});
 try{
  const result=await gallery.readGalleryPage({}, {page:2,category});
  assert.equal(result.total,35);
  assert.equal(result.totalPages,3);
  assert.equal(result.albums.length,12);
  assert.deepEqual(result.albums.map(a=>a.title),Array.from({length:12},(_,i)=>'앨범 '+(22-i)));
  const fallback=calls.filter(c=>c.body?.structuredQuery&&!c.body.structuredQuery.orderBy);
  assert.equal(fallback.length,1);
  assert.equal(fallback[0].body.structuredQuery.where.fieldFilter.value.stringValue,category);
 }finally{delete globalThis.__galleryCategoryRequest;}
});

test('missing count index uses fallback for empty categories without showing false albums',async()=>{
 const calls=mock({noIndex:true,countFailure:true,rows:[]});
 try{
  const result=await gallery.readGalleryPage({}, {page:1,category:'일상'});
  assert.deepEqual(result,{albums:[],page:1,total:0,totalPages:1,pageSize:12});
  assert.equal(calls.some(c=>c.url.endsWith(':runQuery')),true);
 }finally{delete globalThis.__galleryCategoryRequest;}
});

test('Firestore HTTP 400 invalid-index responses also use safe category-only fallback',async()=>{
 const calls=mock({noIndex:true,errorCode:'INVALID_ARGUMENT'});
 try{
  const result=await gallery.readGalleryPage({}, {page:3,category});
  assert.equal(result.total,35);
  assert.equal(result.page,3);
  assert.deepEqual(result.albums.map(a=>a.title),Array.from({length:11},(_,i)=>'앨범 '+(10-i)));
  assert.ok(calls.some(c=>c.body?.structuredQuery&&!c.body.structuredQuery.orderBy));
 }finally{delete globalThis.__galleryCategoryRequest;}
});

test('empty filtered category avoids an unnecessary composite-index query',async()=>{
 const calls=mock({rows:[]});
 try{
  const result=await gallery.readGalleryPage({}, {page:1,category:'일상'});
  assert.deepEqual(result,{albums:[],page:1,total:0,totalPages:1,pageSize:12});
  assert.equal(calls.filter(c=>c.url.endsWith(':runQuery')).length,0);
 }finally{delete globalThis.__galleryCategoryRequest;}
});

test('gallery page load preserves normal cursor but active filter, pagination and deletes are busy',async()=>{
 const source=await read('src/PhotoGallery.tsx');
 assert.match(source,/const \[interactionPending,setInteractionPending\]=useState\(false\)/);
 assert.match(source,/data-async-busy=\{deleting\|\|interactionPending\?"true":undefined\}/);
 assert.doesNotMatch(source,/data-async-busy=\{loading\|\|deleting/);
 assert.match(source,/function changeCategory\(category:Filter\)/);
 assert.match(source,/function changePage\(next:number\)/);
 assert.match(source,/setInteractionPending\(false\)/);
});

test('category filter does not hide unexpected Firestore errors with a fallback',async()=>{
 mock({noIndex:true,errorCode:'PERMISSION_DENIED'});
 try{
  await assert.rejects(()=>gallery.readGalleryPage({}, {page:1,category}),/갤러리 목록 조회 실패 400/);
 }finally{delete globalThis.__galleryCategoryRequest;}
});

test('gallery category and createdAt composite index is declared for deployment',async()=>{
 const [config,definition]=await Promise.all([read('firebase.json'),read('firestore.indexes.json')]);
 const firebase=JSON.parse(config),indexes=JSON.parse(definition);
 assert.equal(firebase.firestore.indexes,'firestore.indexes.json');
 assert.deepEqual(indexes.indexes,[{
  collectionGroup:'galleryAlbums',queryScope:'COLLECTION',fields:[
   {fieldPath:'category',order:'ASCENDING'},{fieldPath:'createdAt',order:'DESCENDING'}
  ]
 }]);
});
