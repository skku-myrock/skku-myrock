import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const uid='11111111-1111-4111-8111-111111111111';
const photo='https://myrock-images.pages.dev/gallery/'+uid+'.webp';
const env={MYROCK_IMAGES_PUBLIC_BASE_URL:'https://myrock-images.pages.dev/',GITHUB_IMAGES_TOKEN:'example'};
async function loadCleanup(){
  let js=await read('functions/_lib/githubImages.js');
  js=js.replace("import {reject} from './shared.js';","const reject=(message,status=400)=>{throw Object.assign(new Error(message),{status})};");
  js=js.replace("import {getAbout} from './aboutContent.js';","const getAbout=async()=>globalThis.__galleryCleanupState.about;");
  js=js.replace("import {listNotices} from './notices.js';","const listNotices=async()=>globalThis.__galleryCleanupState.notices;");
  js=js.replace("import {listGalleryAlbums} from './gallery.js';","const listGalleryAlbums=async()=>globalThis.__galleryCleanupState.albums;");
  return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
test('gallery cleanup preserves photos still referenced by another album, notices or introduction',async()=>{
  const original=globalThis.fetch;let count=0;
  globalThis.fetch=async()=>{count++;throw Error('Should not contact GitHub');};
  try{
    const {deleteUnusedGalleryImages}=await loadCleanup();
    const about={content:{homeImage:'',heroImage:'',officers:[]}};
    globalThis.__galleryCleanupState={albums:[{photos:[photo]}],about,notices:[]};
    assert.equal((await deleteUnusedGalleryImages(env,[photo])).deleted,0);
    globalThis.__galleryCleanupState={albums:[],about,notices:[{blocks:[{kind:'image',url:photo}]}]};
    assert.equal((await deleteUnusedGalleryImages(env,[photo])).deleted,0);
    globalThis.__galleryCleanupState={albums:[],about:{content:{homeImage:'',heroImage:photo,officers:[]}},notices:[]};
    assert.equal((await deleteUnusedGalleryImages(env,[photo])).deleted,0);
    globalThis.__galleryCleanupState={albums:[],about,notices:[]};
    for(const value of ['https://another.example/gallery/'+uid+'.webp',env.MYROCK_IMAGES_PUBLIC_BASE_URL+'site/'+uid+'.webp'])
      assert.equal((await deleteUnusedGalleryImages(env,[value])).deleted,0);
    assert.equal(count,0);
  }finally{globalThis.fetch=original;delete globalThis.__galleryCleanupState;}
});
test('gallery cleanup removes only unreferenced gallery WebP UUID blobs',async()=>{
  const original=globalThis.fetch;const calls=[];
  globalThis.__galleryCleanupState={albums:[],about:{content:{homeImage:'',heroImage:'',officers:[]}},notices:[]};
  globalThis.fetch=async(url,options={})=>{
    const path=new URL(url).pathname.split('/myrock-images/')[1];
    calls.push({path,method:options.method??'GET',body:options.body?JSON.parse(options.body):null});
    if(path==='git/ref/heads/main')return Response.json({object:{sha:'head'}});
    if(path==='git/commits/head')return Response.json({tree:{sha:'old-tree'}});
    if(path==='git/trees/old-tree')return Response.json({truncated:false,tree:[
      {path:'gallery/'+uid+'.webp',type:'blob'},
      {path:'site/'+uid+'.webp',type:'blob'},
      {path:'notices/'+uid+'.webp',type:'blob'},
    ]});
    if(path==='git/trees')return Response.json({sha:'next-tree'});
    if(path==='git/commits')return Response.json({sha:'next-commit'});
    if(path==='git/refs/heads/main')return Response.json({});
    throw Error('Unexpected endpoint: '+path);
  };
  try{
    const {deleteUnusedGalleryImages}=await loadCleanup();
    assert.equal((await deleteUnusedGalleryImages(env,[photo])).deleted,1);
    const modification=calls.find(x=>x.path==='git/trees'&&x.method==='POST');
    assert.deepEqual(modification.body.tree,[{path:'gallery/'+uid+'.webp',mode:'100644',type:'blob',sha:null}]);
    assert.ok(calls.some(x=>x.path==='git/refs/heads/main'&&x.body.force===false));
    const ignored=await deleteUnusedGalleryImages(env,['https://myrock-images.pages.dev/gallery/'+uid+'.jpg']);
    assert.equal(ignored.deleted,0);
  }finally{globalThis.fetch=original;delete globalThis.__galleryCleanupState;}
});
