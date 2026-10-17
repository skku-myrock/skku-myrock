import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const uuid='11111111-1111-4111-8111-111111111111';
const oldUrl='https://myrock-images.pages.dev/site/'+uuid+'.webp';
const env={GITHUB_IMAGES_TOKEN:'example',MYROCK_IMAGES_PUBLIC_BASE_URL:'https://myrock-images.pages.dev/'};

async function cleanupModule(){
  let code=await source('functions/_lib/githubImages.js');
  code=code.replace("import {reject} from './shared.js';","const reject=(message,status=400)=>{throw Object.assign(new Error(message),{status})};")
    .replace("import {getAbout} from './aboutContent.js';","const getAbout=async()=>globalThis.__cleanupState.about;")
    .replace("import {listNotices} from './notices.js';","const listNotices=async()=>globalThis.__cleanupState.notices;")
    .replace("import {listGalleryAlbums} from './gallery.js';","const listGalleryAlbums=async()=>globalThis.__cleanupState.albums??[];");
    .replace("import {listEquipment} from './equipment.js';","const listEquipment=async()=>[];");
  return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}

test('site cleanup deletes only replaced, unreferenced generated site files',async()=>{
  const originalFetch=globalThis.fetch;
  const actions=[];
  globalThis.__cleanupState={about:{content:{homeImage:'https://myrock-images.pages.dev/site/new.webp',heroImage:'',officers:[]}},notices:[]};
  globalThis.fetch=async(url,options={})=>{
    const path=new URL(url).pathname.split('/myrock-images/')[1];
    actions.push({path,method:options.method??'GET',body:options.body?JSON.parse(options.body):null});
    if(path==='git/ref/heads/main')return Response.json({object:{sha:'previous'}});
    if(path==='git/commits/previous')return Response.json({tree:{sha:'old-tree'}});
    if(path==='git/trees')return Response.json({sha:'new-tree'});
    if(path==='git/commits')return Response.json({sha:'new-commit'});
    if(path==='git/refs/heads/main')return Response.json({});
    throw Error('Unexpected API path '+path);
  };
  try{
    const {deleteUnusedSiteImages}=await cleanupModule();
    const result=await deleteUnusedSiteImages(env,[oldUrl,'https://other.example/site/'+uuid+'.webp','https://myrock-images.pages.dev/notices/'+uuid+'.webp']);
    assert.equal(result.deleted,1);
    const tree=actions.find(action=>action.path==='git/trees');
    assert.deepEqual(tree.body.tree,[{path:'site/'+uuid+'.webp',mode:'100644',type:'blob',sha:null}]);
  }finally{
    globalThis.fetch=originalFetch;delete globalThis.__cleanupState;
  }
});

test('site cleanup refuses deletion while intro or past notices reference the image',async()=>{
  const originalFetch=globalThis.fetch;
  let fetches=0;
  globalThis.fetch=async()=>{fetches++;throw Error('Should not mutate GitHub');};
  try{
    const {deleteUnusedSiteImages}=await cleanupModule();
    globalThis.__cleanupState={about:{content:{homeImage:oldUrl,heroImage:'',officers:[]}},notices:[]};
    assert.equal((await deleteUnusedSiteImages(env,[oldUrl])).deleted,0);
    globalThis.__cleanupState={about:{content:{homeImage:'',heroImage:'',officers:[]}},notices:[{blocks:[{kind:'image',url:oldUrl}]}]};
    assert.equal((await deleteUnusedSiteImages(env,[oldUrl])).deleted,0);
    globalThis.__cleanupState.notices=Array.from({length:1000},()=>({blocks:[]}));
    await assert.rejects(deleteUnusedSiteImages(env,[oldUrl]),/참조 검사/);
    assert.equal(fetches,0);
  }finally{globalThis.fetch=originalFetch;delete globalThis.__cleanupState;}
});

test('about save commits Firestore first and cleans only after success',async()=>{
  const handler=await source('functions/api/about/content.js');
  assert.ok(handler.indexOf('const saved=await saveAbout(env,')<handler.indexOf('await deleteUnusedSiteImages(env,obsolete)'));
  assert.match(handler,/catch\(error\)\{\s*console\.error\('Site image cleanup deferred/);
  assert.match(handler,/return success\(\{\.\.\.saved,siteCleanup\}\)/);
  const api=await source('functions/api/images/batch.js');
  assert.match(api,/const extensions=\{'image\/webp':'webp'\}/);
  assert.match(api,/folder!=='site'&&folder!=='notices'/);
});

test('public intro data cache deduplicates reads and invalidates on demand',async()=>{
  let code=await source('src/aboutContent.ts');
  code=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
    .replace("import { auth } from './firebase';","const auth={currentUser:null};");
  const originalFetch=globalThis.fetch;
  let calls=0,allow;
  const gate=new Promise(resolve=>{allow=resolve;});
  const data={content:{homeImage:'https://image.example/home.webp',heroImage:'',officers:[],history:[],cohortLabel:''}};
  globalThis.fetch=async()=>{calls++;await gate;return Response.json(data);};
  try{
    const cache=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
    const one=cache.getAbout(),two=cache.getAbout();
    assert.equal(calls,1);
    allow();
    const [a,b]=await Promise.all([one,two]);
    assert.equal(a,b);
    assert.equal(cache.peekAboutCache()?.content.homeImage,data.content.homeImage);
    await cache.getAbout();
    assert.equal(calls,1);
    cache.invalidateAboutCache();
    assert.equal(cache.peekAboutCache(),null);
    await cache.getAbout();
    assert.equal(calls,2);
  }finally{globalThis.fetch=originalFetch;}
});

test('gallery warning precedes inputs and add-photo tile joins the image grid',async()=>{
  const [dialog,css,pages,gallery]=await Promise.all([source('src/GalleryUploadDialog.tsx'),source('src/styles/gallery.css'),source('src/pages/SitePages.tsx'),source('src/PhotoGallery.tsx')]);
  assert.ok(dialog.indexOf('새로운 갤러리 앨범을 구성합니다.')<dialog.indexOf('className="image-compression-notice"'));
  assert.ok(dialog.indexOf('className="image-compression-notice"')<dialog.indexOf('className="gallery-upload-fields"'));
  assert.match(dialog,/\{photos\.length === 0 && dropZone\}/);
  assert.match(dialog,/\{dropZone\}\s*<\/div>/);
  assert.match(css,/gallery-upload-dropzone\.is-compact/);
  assert.match(pages,/homeImage===null\?<div className="home-hero-image image-pending"/);
  assert.match(pages,/contentLoaded\?<Placeholder label="동아리 대표 사진"/);
  assert.match(pages,/fetchPriority="high"/);
  assert.match(pages,/fetchPriority="low"/);
  assert.match(gallery,/photoIndex\+offset\+count/);
});
